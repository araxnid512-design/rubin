'use strict';
/* 3D-бой: персонажи. Люди — скелетные модели, движения из общей библиотеки (DW.ANIM3: повороты костей
   относительно позы покоя, переносятся на любое тело), плавная смена движений; оружие ставится от корпуса так же,
   как в запекании спрайтов (прицел — приклад в плечо, переноска — вперёд-вниз, за спиной, в кисти), при гибели
   выпадает на землю. Мутанты — свои клипы (AnimationMixer); у четвероногих атака, попадание, рык и гибель —
   наклоном тела. Логика позы — та же, что в 2D (render_battle: укрытие, дозор, перезарядка, выстрел…). */
(function (DW) {
  const R3 = DW.R3, THREE = R3.THREE, D = DW.D, U = DW.U;
  if (!THREE) return;
  const T = R3.T, LV = R3.LV;
  const UN = R3.units = {};
  const V = function (x, y, z) { return new THREE.Vector3(x || 0, y || 0, z || 0); };

  /* кости по смыслу (как в tools/art3d/chars.js) */
  const MAP = {
    Hips: ['mixamorigHips', 'Hip', 'Hips', 'Pelvis'], Spine: ['mixamorigSpine', 'Waist', 'Spine'], Spine1: ['mixamorigSpine1', 'Spine01', 'Spine1'],
    Spine2: ['mixamorigSpine2', 'Spine02', 'Spine2', 'Chest'], Neck: ['mixamorigNeck', 'NeckTwist01', 'Neck'], Head: ['mixamorigHead', 'Head'],
    LeftShoulder: ['mixamorigLeftShoulder', 'L_Clavicle', 'LeftShoulder'], LeftArm: ['mixamorigLeftArm', 'L_Upperarm', 'LeftArm', 'LeftUpperArm'],
    LeftForeArm: ['mixamorigLeftForeArm', 'L_Forearm', 'LeftForeArm', 'LeftLowerArm'], LeftHand: ['mixamorigLeftHand', 'L_Hand', 'LeftHand'],
    RightShoulder: ['mixamorigRightShoulder', 'R_Clavicle', 'RightShoulder'], RightArm: ['mixamorigRightArm', 'R_Upperarm', 'RightArm', 'RightUpperArm'],
    RightForeArm: ['mixamorigRightForeArm', 'R_Forearm', 'RightForeArm', 'RightLowerArm'], RightHand: ['mixamorigRightHand', 'R_Hand', 'RightHand'],
    LeftUpLeg: ['mixamorigLeftUpLeg', 'L_Thigh', 'LeftUpLeg', 'LeftUpperLeg'], LeftLeg: ['mixamorigLeftLeg', 'L_Calf', 'LeftLeg', 'LeftLowerLeg'],
    LeftFoot: ['mixamorigLeftFoot', 'L_Foot', 'LeftFoot'], LeftToeBase: ['mixamorigLeftToeBase', 'L_ToeBase', 'LeftToeBase', 'LeftToes'],
    RightUpLeg: ['mixamorigRightUpLeg', 'R_Thigh', 'RightUpLeg', 'RightUpperLeg'], RightLeg: ['mixamorigRightLeg', 'R_Calf', 'RightLeg', 'RightLowerLeg'],
    RightFoot: ['mixamorigRightFoot', 'R_Foot', 'RightFoot'], RightToeBase: ['mixamorigRightToeBase', 'R_ToeBase', 'RightToeBase', 'RightToes']
  };
  function findBones(root) {
    const all = {};
    root.traverse(function (o) { if (o.isBone) all[o.name] = o; });
    const out = {};
    for (const k in MAP) for (const n of MAP[k]) if (all[n]) { out[k] = all[n]; break; }
    return out;
  }

  /* ---------- Тело: копия модели, поворот лицом к +Z, рост H, стопы на земле (как makeBody) ---------- */
  function makeBody(gl, H, human, yawFix, preClip) {
    const root = THREE.SkeletonUtils.clone(gl.scene);
    const meshes = [];
    root.traverse(function (m) {
      if (m.isMesh) {
        m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true;
        if (m.isSkinnedMesh && m.skeleton) m.skeleton.pose();
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        m.material = mats.length === 1 ? R3.world.fogMat(mats[0]) : mats.map(R3.world.fogMat);
        meshes.push(m);
      }
    });
    const holder = new THREE.Group(), fix = new THREE.Group();
    fix.add(root); holder.add(fix);
    // мутанты: верх и перёд — по позе их собственного движения (у новых моделей поза привязки повёрнута иначе,
    // чем корень в клипах, — Костолом висел вверх ногами); позу не сбрасываем — дальше её ведёт свой mixer
    if (preClip) { const mx = new THREE.AnimationMixer(root); mx.clipAction(preClip).play(); mx.update(0.01); }
    holder.updateMatrixWorld(true);
    const B = findBones(root);
    let up, fwd;
    // ориентация — по костям, если скелет двуногий (люди и мутанты-двуногие), иначе по модели (+Y вверх, к голове)
    const biped = !!(B.LeftUpLeg && B.RightUpLeg && B.Head && B.Hips);
    if (biped) {
      const pl = B.LeftUpLeg.getWorldPosition(V()), pr = B.RightUpLeg.getWorldPosition(V());
      const head = B.Head.getWorldPosition(V()), hip = B.Hips.getWorldPosition(V());
      up = head.clone().sub(hip).normalize();
      const right = pr.clone().sub(pl); right.addScaledVector(up, -right.dot(up)).normalize();
      fwd = V().crossVectors(up, right).normalize();
    } else {
      let head = null, rb = null;
      root.traverse(function (o) { if (o.isBone) { if (!rb) rb = o; if (!head && /head/i.test(o.name)) head = o; } });
      up = V(0, 1, 0);
      fwd = head && rb ? head.getWorldPosition(V()).sub(rb.getWorldPosition(V())) : V(0, 0, 1);
      fwd.y = 0; if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, 1); fwd.normalize();
      B.Hips = B.Hips || rb; B.Head = B.Head || head || rb;
    }
    const m = new THREE.Matrix4().makeBasis(V().crossVectors(up, fwd).normalize(), up, fwd);
    fix.quaternion.copy(new THREE.Quaternion().setFromRotationMatrix(m).invert());
    if (yawFix) fix.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yawFix * Math.PI / 180));
    holder.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(fix, true);
    let k;
    if (biped) {
      const tall = (B.Head.getWorldPosition(V()).y - box.min.y) * 1.1;
      k = H / Math.max(tall, box.max.y - box.min.y > tall * 1.4 ? tall : box.max.y - box.min.y);
    } else k = H / Math.max(0.01, box.max.y - box.min.y);
    fix.scale.setScalar(k);
    holder.updateMatrixWorld(true);
    const box2 = new THREE.Box3().setFromObject(fix, true);
    const hp = B.Hips.getWorldPosition(V());
    fix.position.set(-hp.x, -box2.min.y, -hp.z);
    holder.updateMatrixWorld(true);
    const rest = {};
    for (const k2 in B) rest[k2] = { q: B[k2].quaternion.clone(), p: B[k2].position.clone(), wq: B[k2].getWorldQuaternion(new THREE.Quaternion()), wp: B[k2].getWorldPosition(V()) };
    return { holder: holder, fix: fix, root: root, B: B, rest: rest, meshes: meshes, k: k, H: H };
  }

  /* ---------- Оружие (как makeWeapon): ствол к −Z, начало — точка хвата ---------- */
  function makeWeapon(gl, w) {
    const obj = gl.scene.clone(true);
    if (w.flip) { obj.rotation.y = Math.PI; obj.updateMatrixWorld(true); }
    obj.traverse(function (m) { if (m.isMesh) { m.castShadow = true; m.frustumCulled = false; const mats = Array.isArray(m.material) ? m.material : [m.material]; m.material = mats.length === 1 ? R3.world.fogMat(mats[0]) : mats.map(R3.world.fogMat); } });
    const box = new THREE.Box3().setFromObject(obj, true);
    const size = box.getSize(V());
    const L = size.z, k = w.len / L;
    const inner = new THREE.Group(); inner.add(obj);
    obj.scale.setScalar(k);
    const zg = box.max.z - w.grip * L, yg = box.min.y + (w.gy !== undefined ? w.gy : 0.3) * size.y;
    const cx = (box.min.x + box.max.x) / 2;
    obj.position.set(-cx * k, -yg * k, -zg * k);
    const g = new THREE.Group(); g.add(inner);
    g.matrixAutoUpdate = false;
    return {
      g: g, len: w.len, free: !!w.free, hipAim: !!w.hip, pistol: !!w.pistol, melee: !!w.melee,
      fore: V(0, (box.min.y + (w.fy !== undefined ? w.fy : 0.55) * size.y - yg) * k, -(w.fore - w.grip) * L * k),
      muzzle: V(0, (box.min.y + (w.my !== undefined ? w.my : 0.75) * size.y - yg) * k, -(1 - w.grip) * L * k),
      buttZ: w.grip * L * k, buttY: (box.min.y + (w.by !== undefined ? w.by : 0.62) * size.y - yg) * k
    };
  }

  /* ---------- Хват от корпуса (как в tools/art3d/baker.js) ---------- */
  const GRIP = {
    // приклад — в плечевую впадину (раньше был за плечевым суставом: правый локоть уходил за спину);
    // в переноске — у подмышки, чтобы локоть не заходил в корпус
    aim: { butt: [-0.05, 0.015, 0.06], pitch: 2, yaw: 4, roll: 0, level: true },
    carry: { butt: [-0.03, -0.135, 0.12], pitch: -30, yaw: 20, roll: -6, minEl: -32, ground: true },
    hip: { butt: [0.0, -0.34, 0.0], pitch: 0, yaw: 6, roll: 0, level: true },
    sling: { butt: [-0.14, -0.5, -0.17], pitch: 38, yaw: 42, roll: 0, back: true },
    // пистолет: в прицеливании — на вытянутых руках у груди, в покое — опущен вперёд-вниз
    pistol: { butt: [-0.1, -0.1, 0.36], pitch: 0, yaw: 3, roll: 0, level: true },
    pistolLow: { butt: [-0.03, -0.36, 0.2], pitch: -38, yaw: 8, roll: 0, minEl: -45, level: true },
    // пистолет в одной руке (ТТ старшего клана): рука вытянута вперёд от плеча
    pistol1: { butt: [0.0, -0.06, 0.47], pitch: 0, yaw: 2, roll: 0, level: true },
    // РПГ: труба на правом плече, задний срез — за плечом
    rpg: { butt: [0.0, 0.11, -0.3], pitch: 1, yaw: 3, roll: 0, level: true }
  };
  const _a = V(), _b = V(), _c = V(), _d = V();
  /* оси корпуса: R/L — плечевые суставы, X — вправо, Y — вверх по позвоночнику, Z — грудью вперёд.
     out (необязательно) — свой объект с векторами: без выделения памяти (кадр бойца) */
  function torso(B, out) {
    const o = out || { R: V(), L: V(), X: V(), Y: V(), Z: V() };
    const R = B.RightArm.getWorldPosition(o.R), L = B.LeftArm.getWorldPosition(o.L);
    const top = (B.Neck || B.Head).getWorldPosition(_a), hip = B.Hips.getWorldPosition(_b);
    const X = o.X.copy(R).sub(L).normalize();
    const Y = o.Y.copy(top).sub(hip); Y.addScaledVector(X, -Y.dot(X)).normalize();
    o.Z.crossVectors(Y, X).normalize();
    return o;
  }
  const mkTorso = function () { return { R: V(), L: V(), X: V(), Y: V(), Z: V() }; };
  const UP = V(0, 1, 0);
  /* aim (необязательно): { p: точка в мире, k: 0–1 доля наведения } — ствол от приклада в эту точку, с пределами по
     сторонам (±50° от корпуса) и по высоте (−45°…+40°) */
  const _aD = V(), _aH = V(), _aZ = V();
  const _gB = V(), _gDir = V(), _gZh = V(), _gXh = V(), _gZw = V(), _gYw = V(), _gXw = V(), _gBl = V(), _gRot = new THREE.Matrix4();
  /* матрица оружия в мире (out — куда записать; без out — новая матрица) */
  function gunMatrix(Tq, wpn, g, groundY, aim, out) {
    const butt = _gB.copy(Tq.R).addScaledVector(Tq.X, g.butt[0]).addScaledVector(Tq.Y, g.butt[1]).addScaledVector(Tq.Z, g.butt[2]);
    const pitch = g.pitch * Math.PI / 180, yaw = g.yaw * Math.PI / 180, roll = (aim && aim.k > 0 ? g.roll * (1 - aim.k) : g.roll) * Math.PI / 180;
    const dir = _gDir;
    if (g.level) {
      const zh = _gZh.copy(Tq.Z); zh.y = 0; zh.normalize();
      const xh = _gXh.copy(Tq.X); xh.y = 0; xh.normalize();
      dir.copy(zh).multiplyScalar(Math.cos(pitch) * Math.cos(yaw)).addScaledVector(xh, -Math.cos(pitch) * Math.sin(yaw)).addScaledVector(UP, Math.sin(pitch)).normalize();
    } else {
      dir.copy(Tq.Z).multiplyScalar((g.back ? -1 : 1) * Math.cos(pitch) * Math.cos(yaw)).addScaledVector(Tq.X, -Math.cos(pitch) * Math.sin(yaw)).addScaledVector(Tq.Y, Math.sin(pitch)).normalize();
    }
    if (aim && aim.k > 0) {
      _aD.subVectors(aim.p, butt);
      if (_aD.lengthSq() > 0.04) {
        _aD.normalize();
        // по сторонам — не дальше 50° от груди
        _aZ.copy(Tq.Z).setY(0).normalize(); _aH.copy(_aD).setY(0);
        const hl = _aH.length();
        if (hl > 1e-4) {
          _aH.multiplyScalar(1 / hl);
          const ang = Math.acos(Math.max(-1, Math.min(1, _aH.dot(_aZ)))), lim = 50 * Math.PI / 180;
          if (ang > lim) { const sgn = Math.sign(_aZ.x * _aH.z - _aZ.z * _aH.x) || 1; _aH.copy(_aZ).applyAxisAngle(UP, -sgn * lim); }
        } else _aH.copy(_aZ);
        // по высоте: −45°…+40°
        const elA = Math.max(-45 * Math.PI / 180, Math.min(40 * Math.PI / 180, Math.asin(Math.max(-1, Math.min(1, _aD.y)))));
        _aD.copy(_aH).multiplyScalar(Math.cos(elA)).setY(Math.sin(elA)).normalize();
        dir.lerp(_aD, aim.k).normalize();
      }
    }
    const el = Math.asin(Math.max(-1, Math.min(1, dir.y)));
    let elMin = g.minEl !== undefined ? g.minEl * Math.PI / 180 : -Math.PI / 2;
    if (g.ground) elMin = Math.max(elMin, Math.asin(Math.max(-1, Math.min(1, (0.08 - (butt.y - groundY)) / 1.45))));
    if (el < elMin) { const h = _gZh.copy(dir); h.y = 0; if (h.lengthSq() < 1e-6) h.copy(Tq.Z).setY(0); h.normalize(); dir.copy(h).multiplyScalar(Math.cos(elMin)).addScaledVector(UP, Math.sin(elMin)).normalize(); }
    const zW = _gZw.copy(dir).negate();
    // оружие стоит ровно (магазином вниз) по вертикали мира, а не по корпусу: в движениях корпус бывает повёрнут
    // и ствол заваливался набок (СВД у тяжёлого бойца); за спиной — по корпусу
    const upRef = g.back ? Tq.Y : UP;
    const yW = _gYw.copy(upRef).addScaledVector(zW, -upRef.dot(zW)).normalize();
    yW.applyAxisAngle(dir, roll);
    const xW = _gXw.crossVectors(yW, zW).normalize();
    yW.crossVectors(zW, xW).normalize();
    const M = (out || new THREE.Matrix4()).makeBasis(xW, yW, zW);
    const buttL = _gBl.set(0, wpn.buttY || 0.03, wpn.buttZ).applyMatrix4(_gRot.extractRotation(M));
    M.setPosition(butt.sub(buttL));
    return M;
  }

  /* ---------- Руки на оружие: двухзвенная IK (как tools/art3d/chars.js) ---------- */
  function aimBone(bone, childNow, want) {
    const p = bone.getWorldPosition(V());
    const from = childNow.clone().sub(p).normalize(), to = want.clone().sub(p).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(from, to);
    const nq = q.multiply(bone.getWorldQuaternion(new THREE.Quaternion()));
    bone.quaternion.copy(bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(nq));
    bone.updateMatrixWorld(true);
  }
  function ik2(a, b, c, target, pole) {
    const pa = a.getWorldPosition(V()), pb = b.getWorldPosition(V()), pc = c.getWorldPosition(V());
    const la = pa.distanceTo(pb), lb = pb.distanceTo(pc);
    const d = Math.min(target.distanceTo(pa), la + lb - 1e-4);
    const dir = target.clone().sub(pa).normalize();
    const ang = Math.acos(THREE.MathUtils.clamp((la * la + d * d - lb * lb) / (2 * la * d), -1, 1));
    const pl = pole.clone().sub(pa); pl.addScaledVector(dir, -pl.dot(dir)); if (pl.lengthSq() < 1e-8) pl.set(0, -1, 0); pl.normalize();
    const elbow = pa.clone().addScaledVector(dir, Math.cos(ang) * la).addScaledVector(pl, Math.sin(ang) * la);
    aimBone(a, pb, elbow);
    aimBone(b, c.getWorldPosition(V()), pa.clone().addScaledVector(dir, d));
  }
  function palm(body, side) {
    const hand = body.B[side + 'Hand'];
    if (body.mid === undefined) {
      body.mid = {};
      ['Left', 'Right'].forEach(function (sd) { let m = null; body.B[sd + 'Hand'].traverse(function (o) { if (!m && o !== body.B[sd + 'Hand'] && o.isBone && /Mid|Middle/.test(o.name)) m = o; }); body.mid[sd] = m; });
    }
    const p = hand.getWorldPosition(V()), mid = body.mid[side];
    if (mid) return p.lerp(mid.getWorldPosition(V()), 0.75);
    const fa = body.B[side + 'ForeArm'].getWorldPosition(V());
    return p.clone().add(p.clone().sub(fa).multiplyScalar(0.3));
  }
  function reach(body, side, target, pole) {
    const B = body.B, P = palm(body, side);
    const wrist = B[side + 'Hand'].getWorldPosition(V()).add(target.clone().sub(P));
    ik2(B[side + 'Arm'], B[side + 'ForeArm'], B[side + 'Hand'], wrist, pole);
  }
  /* правая — к рукояти, левая — к цевью (у перезарядки левая свободна) */
  function handsTo(body, grip, fore, freeL) {
    const B = body.B;
    if (!B.RightArm || !B.RightForeArm || !B.RightHand) return;
    for (let k = 0; k < 2; k++) {
      const Tq = torso(B);
      reach(body, 'Right', grip, B.RightForeArm.getWorldPosition(V()).addScaledVector(Tq.Y, -0.4).addScaledVector(Tq.X, 0.25));
      if (!freeL && B.LeftArm && B.LeftForeArm && B.LeftHand) reach(body, 'Left', fore, B.LeftForeArm.getWorldPosition(V()).addScaledVector(Tq.Y, -0.4).addScaledVector(Tq.X, -0.12));
    }
  }

  /* ---------- Библиотека движений: перенос на тело ---------- */
  const LIBQ = new THREE.Quaternion(), LIBQ2 = new THREE.Quaternion();
  function libClip(key) { const L = DW.ANIM3; return L && L.clips[key] && !L.clips[key].err ? L.clips[key] : null; }
  UN.has = function (key) { return !!libClip(key); };
  /* поза движения key в момент t (с): массив дельт-кватернионов и смещение таза (интерполяция между кадрами) */
  function samplePose(key, t, out) {
    const c = libClip(key);
    const L = DW.ANIM3, nb = L.bones.length;
    if (!out) out = { q: new Float32Array(nb * 4), hp: V() };
    if (!c) return null;
    let f = 0;
    if (c.n > 1 && c.dur > 0) {
      f = c.loop ? ((t / c.dur) % 1 + 1) % 1 * c.n : Math.max(0, Math.min(1, t / c.dur)) * (c.n - 1);
    }
    const i0 = Math.floor(f), fr = f - i0;
    const i1 = c.loop ? (i0 + 1) % c.n : Math.min(c.n - 1, i0 + 1);
    for (let b = 0; b < nb; b++) {
      const o0 = (i0 * nb + b) * 4, o1 = (i1 * nb + b) * 4;
      LIBQ.set(c.q[o0], c.q[o0 + 1], c.q[o0 + 2], c.q[o0 + 3]);
      if (fr > 0.001) { LIBQ2.set(c.q[o1], c.q[o1 + 1], c.q[o1 + 2], c.q[o1 + 3]); LIBQ.slerp(LIBQ2, fr); }
      out.q[b * 4] = LIBQ.x; out.q[b * 4 + 1] = LIBQ.y; out.q[b * 4 + 2] = LIBQ.z; out.q[b * 4 + 3] = LIBQ.w;
    }
    const h0 = i0 * 3, h1 = i1 * 3;
    out.hp.set(c.hp[h0] + (c.hp[h1] - c.hp[h0]) * fr, c.hp[h0 + 1] + (c.hp[h1 + 1] - c.hp[h0 + 1]) * fr, c.hp[h0 + 2] + (c.hp[h1 + 2] - c.hp[h0 + 2]) * fr);
    return out;
  }
  function blendPose(a, b, k, out) {
    const nb = a.q.length / 4;
    for (let i = 0; i < nb; i++) {
      LIBQ.set(a.q[i * 4], a.q[i * 4 + 1], a.q[i * 4 + 2], a.q[i * 4 + 3]);
      LIBQ2.set(b.q[i * 4], b.q[i * 4 + 1], b.q[i * 4 + 2], b.q[i * 4 + 3]);
      LIBQ.slerp(LIBQ2, k);
      out.q[i * 4] = LIBQ.x; out.q[i * 4 + 1] = LIBQ.y; out.q[i * 4 + 2] = LIBQ.z; out.q[i * 4 + 3] = LIBQ.w;
    }
    out.hp.copy(a.hp).lerp(b.hp, k);
    return out;
  }
  /* выравнивание костей тела к библиотеке (поза покоя может отличаться направлением костей) */
  function retargetSetup(body) {
    const L = DW.ANIM3;
    body.align = {};
    const CH = { Hips: 'Spine', Spine: 'Spine1', Spine1: 'Spine2', Spine2: 'Neck', Neck: 'Head', LeftShoulder: 'LeftArm', LeftArm: 'LeftForeArm', LeftForeArm: 'LeftHand', RightShoulder: 'RightArm', RightArm: 'RightForeArm', RightForeArm: 'RightHand', LeftUpLeg: 'LeftLeg', LeftLeg: 'LeftFoot', LeftFoot: 'LeftToeBase', RightUpLeg: 'RightLeg', RightLeg: 'RightFoot', RightFoot: 'RightToeBase' };
    L.bones.forEach(function (k) {
      const a = new THREE.Quaternion();
      const ch = CH[k];
      if (ch && body.B[k] && body.B[ch] && L.dirs[k]) {
        const ds = V(L.dirs[k][0], L.dirs[k][1], L.dirs[k][2]);
        const dd = body.rest[ch].wp.clone().sub(body.rest[k].wp).normalize();
        a.setFromUnitVectors(dd, ds);
      }
      body.align[k] = a;
    });
    body.hipK = body.rest.Hips.wp.y / Math.max(0.01, L.hip[1]);
    body.wq = {};   // мировые повороты костей в кадре (кэш)
  }
  const _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _hq = new THREE.Quaternion();
  const _apP = new THREE.Quaternion(), _apI = new THREE.Quaternion(), _apV = V();
  /* мировой поворот кости по цепочке родителей (без updateMatrixWorld); кэш — на тело, по номеру кадра позы
     (кватернионы заводятся один раз — без мусора в кадре) */
  function wqSlot(body, bone) {
    if (!body.wqC) body.wqC = new Map();
    let c = body.wqC.get(bone);
    if (!c) { c = { q: new THREE.Quaternion(), f: -1 }; body.wqC.set(bone, c); }
    return c;
  }
  function worldQ(body, bone) {
    const c = wqSlot(body, bone);
    if (c.f === body.frm) return c.q;
    const p = bone.parent;
    if (!p || !p.isBone) { if (p) p.getWorldQuaternion(c.q); else c.q.identity(); }
    else c.q.copy(worldQ(body, p));
    c.q.multiply(bone.quaternion);
    c.f = body.frm;
    return c.q;
  }
  function applyPose(body, pose) {
    const L = DW.ANIM3;
    body.holder.updateMatrixWorld(true);
    body.frm = (body.frm || 0) + 1;
    _hq.copy(body.holder.quaternion);
    for (let i = 0; i < L.bones.length; i++) {
      const k = L.bones[i], b = body.B[k];
      if (!b) continue;
      _q.set(pose.q[i * 4], pose.q[i * 4 + 1], pose.q[i * 4 + 2], pose.q[i * 4 + 3]);
      // в осях персонажа: d · выравнивание · покой; в мире — ещё поворот держателя
      const c = wqSlot(body, b), target = c.q;
      target.copy(_hq).multiply(_q).multiply(body.align[k]).multiply(body.rest[k].wq);
      const pw = b.parent && b.parent.isBone ? worldQ(body, b.parent) : (b.parent ? b.parent.getWorldQuaternion(_pq) : _apI);
      b.quaternion.copy(_apP.copy(pw).invert().multiply(target));
      c.f = body.frm;
      if (k === 'Hips') {
        const want = _apV.copy(pose.hp).multiplyScalar(body.hipK).add(body.rest.Hips.wp);
        b.position.copy(b.parent.worldToLocal(body.holder.localToWorld(want)));
      }
    }
    body.holder.updateMatrixWorld(true);
  }

  /* ---------- Поза бойца (та же логика, что в 2D) ---------- */
  const KNEEL_T = 0.3;   // доля клипа «колено»: ровная поза с оружием у плеча (на всю очередь и в укрытии)
  const TR2 = function () { return DW.TR2 || DW.TR; };
  function walls4(u) {
    return DW.BT.DIR4.find(function (q) { const o = DW.BT.objAt(u.x + q[0], u.y + q[1]); return o && D.OBJ[o].cover === 2; });
  }
  /* → { key, t (с от начала движения), facing (рад, если стойка задаёт), speed } */
  function humanPose(e, u, t) {
    const tr = TR2();
    const tw = tr.tweenOf(u.id);
    let an = tr.curAnimOf(u);
    const has = UN.has;
    const dur = function (k) { const c = libClip(k); return c ? c.dur : 1; };
    const ts = t / 1000;
    // попадание: стойка остаётся прежней (укрытие, колено, дозор), вздрагивание — поверх (flinch, по направлению выстрела)
    if (an && an.kind === 'hit') an = null;
    const TE = u.type && D.ENEMIES[u.type];
    if (TE && TE.shield && has('shieldwalk')) {
      // щитовик: идёт за щитом, стоит за щитом, стреляет из-за края щита
      if (u.alive && tw && tw.kind === 'step') return { key: 'shieldwalk', t: ((tr.walkPhase(u) || 0) / (Math.PI * 2) % 1 + 1) % 1 * dur('shieldwalk') };
      if (u.alive && an && an.kind === 'shoot') return { key: 'shieldshoot', t: (0.3 + U.clamp(an.p, 0, 1) * 0.45) * dur('shieldshoot') };
      if (u.alive && an && (an.kind === 'aimup' || an.kind === 'aimhold')) return { key: 'shieldshoot', t: 0.32 * dur('shieldshoot') };
      if (u.alive && (!an || an.kind === 'idle')) return { key: 'shieldshoot', t: 0.08 * dur('shieldshoot') };
    }
    if (TE && TE.blade && u.alive) {
      if (tw && tw.kind === 'step' && has('macherun')) return { key: 'macherun', t: ((tr.walkPhase(u) || 0) / (Math.PI * 2) % 1 + 1) % 1 * dur('macherun') };
      if (an && an.kind === 'atk' && has('machehit')) return { key: 'machehit', t: U.clamp(an.p, 0, 1) * dur('machehit') };
    }
    if (TE && TE.flash && an && an.kind === 'throw' && has('flash')) return { key: 'flash', t: U.clamp(an.p, 0, 1) * dur('flash') };
    if (TE && TE.leader && an && an.kind === 'signal' && has('warcry')) return { key: 'warcry', t: U.clamp(an.p, 0, 1) * dur('warcry') };
    if (tw && tw.kind === 'step') {
      // обычный ход — шагом (1,7 клетки/с, цикл шага 1,3 клетки), рывок — бегом с оружием (3,4 клетки/с, цикл 1,9)
      const Bq = DW.BT.get();
      const key = tw.run && has('run') ? 'run' : 'walk';
      const per = key === 'run' ? 1.9 : 1.3;
      const ph = (tw.dist0 + (tw.len || 1) * tr.stepKOf(tw)) / per;
      const fx = tw.fx, fy = tw.fy;
      const dh = tw.tx !== undefined ? (Bq.hgt[tw.ty * Bq.w + tw.tx] - Bq.hgt[fy * Bq.w + fx]) : 0;
      // ступени (перепад в уровень) — обычный шаг; лестница на крышу — лезет вверх, вниз — тот же клип в обратную сторону
      if (Math.abs(dh) > 1 && has('climb')) { const p = U.clamp((tr.now() - tw.t0) / tw.dur, 0, 1); return { key: 'climb', t: (dh > 0 ? p : 1 - p) * dur('climb') }; }
      return { key: key, t: (ph % 1 + 1) % 1 * dur(key) };
    }
    if (an) {
      const p = U.clamp(an.p, 0, 0.999);
      const cv = tr.coverLevel(u);
      switch (an.kind) {
        case 'shoot': {
          const P = tr.poseFor(u, an);
          const rpg = an.a && an.a.data && an.a.data.rpg;
          const c2 = rpg ? 0 : cv;
          // затвор после выстрела — только у винтовки с ручным затвором (КСВК); СВД и ВСС — самозарядные, держат прицел
          const bolt = P.reload > 0 && !rpg && u.weapon !== 'sniper' && u.weapon !== 'vss';
          if (bolt && has('reload') && !(c2 >= 1 || u.overwatch || u.crouch)) return { key: 'reload', t: P.reload * dur('reload') };
          if (c2 === 2) return { key: has('aim') ? 'aim' : 'shoot', t: 0, stepOut: true };
          // с колена — ровная поза прицеливания на всю очередь (раньше клип колена прокручивался за 0,4 с — дёргало)
          if ((c2 === 1 || u.overwatch || u.crouch) && has('kneel')) return { key: 'kneel', t: KNEEL_T * dur('kneel') };
          return { key: has('aim') ? 'aim' : 'shoot', t: 0 };
        }
        case 'reload': return { key: 'reload', t: p * dur('reload') };
        case 'throw': { const k = cv >= 1 && has('throwk') ? 'throwk' : (has('throw') ? 'throw' : 'melee'); return { key: k, t: p * dur(k) }; }
        case 'atk': { const k = u.side === 'e' && has('punch') ? 'punch' : 'melee'; return { key: k, t: p * dur(k) }; }
        case 'slide': { const k = has('slide') ? 'slide' : 'crouch'; return { key: k, t: p * dur(k) }; }
        case 'heal': return { key: has('heal') ? 'heal' : 'idle', t: ts };
        case 'scan': case 'signal': case 'look': case 'check':
          if (u.side === 'p' && has('idle2')) return { key: 'idle2', t: p * dur('idle2') };
          return { key: 'idle', t: ts + (u.id || 0) };
        case 'aimup': case 'aimhold':
          if (cv === 2) return { key: has('aim') ? 'aim' : 'shoot', t: 0, stepOut: true };
          if ((cv === 1 || u.overwatch || u.crouch) && has('kneel')) return { key: 'kneel', t: KNEEL_T * dur('kneel') };
          return { key: has('aim') ? 'aim' : 'shoot', t: 0 };
        default: return { key: 'idle', t: ts + (u.id || 0) };
      }
    }
    // очередь ещё не кончилась (между «вскинул», «очередь» и «удержание» 2D бывает пустой кадр) — ствол не опускать
    if (u._aimAt && tr.now() < (u._aimUntil || 0) - 80 && !tw) {
      const cv2 = tr.coverLevel(u);
      if (cv2 === 2) return { key: has('aim') ? 'aim' : 'shoot', t: 0, stepOut: true };
      if ((cv2 === 1 || u.overwatch || u.crouch) && has('kneel')) return { key: 'kneel', t: KNEEL_T * dur('kneel') };
      return { key: has('aim') ? 'aim' : 'shoot', t: 0 };
    }
    const Bv = DW.BT.get();
    if (Bv && Bv.over === 'victory' && u.side === 'p' && has('cheer')) return { key: 'cheer', t: ts + (u.id || 0) };
    if (u.panicked && has('panic')) return { key: 'panic', t: ts };
    if (u.hunker && has('duck')) return { key: 'duck', t: ts + (u.id || 0) };
    if (u.hunker && has('hunker')) return { key: 'hunker', t: 0 };
    if (u.overwatch && has('watch')) return { key: 'watch', t: ts + (u.id || 0) };
    // присел (кнопка «Присесть»): на корточках с оружием
    if (u.crouch && has('crouch')) return { key: 'crouch', t: (ts + (u.id || 0)) % dur('crouch') };
    const cv = tr.coverLevel(u);
    if (cv === 1 && has('kneel')) return { key: 'kneel', t: KNEEL_T * dur('kneel') };
    if (cv === 2) {
      const wd = walls4(u);
      return { key: 'idle', t: ts + (u.id || 0) * 3.1, facing: wd ? Math.atan2(wd[1], wd[0]) + Math.PI / 2 : null };
    }
    // в покое бойцы отряда изредка осматриваются и проверяют оружие (раз в ~20 с, у каждого в своё время)
    if (u.side === 'p' && has('idle2') && !(Bv && Bv.over)) {
      const per = 19 + (u.id || 0) % 5 * 2.3, ph = (ts + (u.id || 0) * 7.7) % per;
      if (ph < dur('idle2')) return { key: 'idle2', t: ph };
    }
    return { key: 'idle', t: ts + (u.id || 0) * 3.1 };
  }

  /* ---------- Существа: клипы по ключам, наклоны для четвероногих ---------- */
  function fxAt(fx, p) {
    const e = function (x) { return x * x * (3 - 2 * x); }, Dg = Math.PI / 180;
    if (fx === 'lunge') { const k = [[-6, -0.08], [10, 0.12], [16, 0.22], [4, 0.06]]; const a = k[Math.min(3, Math.round(p * 3))]; return { rx: a[0] * Dg, rz: 0, fw: a[1], sy: 1 }; }
    if (fx === 'recoil') return { rx: (p < 0.5 ? -12 : -5) * Dg, rz: (p < 0.5 ? 6 : 2) * Dg, fw: p < 0.5 ? -0.08 : -0.03, sy: 1 };
    if (fx === 'fall') { const q = e(Math.min(1, p * 1.15)); return { rx: 6 * q * Dg, rz: 86 * q * Dg, fw: 0, sy: 1 }; }
    if (fx === 'roar') return { rx: (p < 0.5 ? -14 : -8) * Dg, rz: 0, fw: -0.04, sy: 1.03 };
    if (fx === 'breathe') return { rx: 0, rz: 0, fw: 0, sy: 1 + 0.02 * Math.sin(p * Math.PI * 2) };
    return null;
  }
  /* ---------- Мутанты: кости по смыслу (шея, хвост, челюсть, уши и шипы, лапы), глаза, разбор клипов ----------
     Живость (голова следит за ближайшим бойцом, дыхание, подёргивания, хвост и уши), фирменные приёмы (прыжок,
     удар оземь, плевок, рык, выводок), отдача от попадания, хромота, падение с перекатом и лёжка по рельефу —
     поверх клипов: клип ставит позу, затем повороты костей в мировых осях. Картинка эффектов — r3d/mfx.js. */
  // глаза — точки в осях модели при её росте h (сняты по ортоснимкам морд), главная кость головы, челюсть;
  // у двуногих глаза — по костям L_Eye/R_Eye; нет данных — без глаз
  const CRT = {
    scav: { h: 1, head: 'tripoHead_2', eyes: [[-0.064, 0.862, 0.578], [0.052, 0.862, 0.578]], eye: 0xffa82a, es: 0.075, jaw: ['tripoHead_3'], leap: true },
    scav2: { h: 1, head: 'tripoHead_1', eyes: [[-0.010, 0.909, 0.376], [0.057, 0.909, 0.376]], eye: 0xffc040, es: 0.07, leap: true },
    alpha: { h: 1.6, head: 'tripoHead_0', eyes: [[-0.093, 1.19, 0.8], [0.096, 1.19, 0.8]], eye: 0xff4a18, es: 0.1 },
    queen: { h: 1.9, head: 'tripoHead_1', eyes: [[-0.138, 1.78, 0.33], [0.034, 1.757, 0.36]], eye: 0xc8ff3a, es: 0.12, jaw: ['tripoHead_2', 'bone_32', 'bone_34'] },
    brute: { eye: 0xff3a18, es: 0.07 },
    spitter: { eye: 0x9cff30, es: 0.06, acid: true },
    guardian: { eye: 0xff2010, es: 0.13, one: true, mech: true }
  };
  const LIMB = /Limb|Thigh|Calf|Foot|Toe|Clavicle|Upperarm|Forearm|Hand/, TRUNK = /Root|Spine|Hip|Pelvis|Waist/;
  const SPD = function () { return (DW.settings && DW.settings.speed) || 1; };
  const smo = function (x) { x = x < 0 ? 0 : (x > 1 ? 1 : x); return x * x * (3 - 2 * x); };
  const DG = Math.PI / 180;
  const crCache = {};
  /* разбор вершин модели (один раз на вид): кости с весом, стопы (к ним привязаны самые нижние вершины), габарит */
  function crAnalyze(id, body) {
    if (crCache[id]) return crCache[id];
    let mesh = null;
    body.root.traverse(function (o) { if (o.isSkinnedMesh && !mesh) mesh = o; });
    const out = { weighted: new Set(), feet: [], box: new THREE.Box3() };
    if (!mesh) return (crCache[id] = out);
    body.holder.updateMatrixWorld(true);
    const bones = mesh.skeleton.bones, si = mesh.geometry.attributes.skinIndex, sw = mesh.geometry.attributes.skinWeight;
    for (let i = 0; i < si.count; i++) for (let k = 0; k < 4; k++) if (sw.getComponent(i, k) > 0.2) out.weighted.add(bones[si.getComponent(i, k)].name);
    const step = Math.max(1, Math.floor(si.count / 2500)), P = [], v = V();
    for (let i = 0; i < si.count; i += step) { mesh.getVertexPosition(i, v); v.applyMatrix4(mesh.matrixWorld); out.box.expandByPoint(v); P.push(i, v.x, v.y, v.z); }
    // стопы: кости нижних вершин (до 12 % роста над самой низкой точкой); по одной на лапу — скопления по месту
    const cnt = new Float32Array(bones.length), cx = new Float32Array(bones.length), cz = new Float32Array(bones.length), low = out.box.min.y + body.H * 0.12;
    for (let j = 0; j < P.length; j += 4) {
      if (P[j + 2] > low) continue;
      let bi = 0, bw = -1;
      for (let k = 0; k < 4; k++) { const w = sw.getComponent(P[j], k); if (w > bw) { bw = w; bi = si.getComponent(P[j], k); } }
      cnt[bi]++; cx[bi] += P[j + 1]; cz[bi] += P[j + 3];
    }
    const rel = function (a, b) { let p = a.parent; while (p) { if (p === b) return true; p = p.parent; } p = b.parent; while (p) { if (p === a) return true; p = p.parent; } return false; };
    const cand = [];
    for (let b = 0; b < bones.length; b++) if (cnt[b] >= 2) { cx[b] /= cnt[b]; cz[b] /= cnt[b]; cand.push(b); }
    cand.sort(function (a, b) { return cnt[b] - cnt[a]; });
    const feet = [], fp = [];
    // двуногие — стопы по костям; четвероногие — сперва концы цепочек «…Limb_N» (наибольший номер), затем
    // безымянные лапы по нижним вершинам
    if (body.B.LeftFoot && body.B.RightFoot) [body.B.LeftFoot, body.B.RightFoot].forEach(function (f) { const w = f.getWorldPosition(V()); feet.push(f); fp.push([w.x, w.z]); });
    else {
      const ends = {};
      bones.forEach(function (b) { const m = /^(.*Limb)_(\d+)$/.exec(b.name); if (m && (!ends[m[1]] || +m[2] > ends[m[1]].n)) ends[m[1]] = { n: +m[2], b: b }; });
      for (const k in ends) { const f = ends[k].b, w = f.getWorldPosition(V()); if (feet.length < 6) { feet.push(f); fp.push([w.x, w.z]); } }
    }
    cand.forEach(function (b) {
      const B0 = bones[b];
      if (feet.length >= 6 || feet.some(function (f) { return f === B0 || rel(f, B0); })) return;
      if (fp.some(function (q) { return Math.hypot(q[0] - cx[b], q[1] - cz[b]) < body.H * 0.13; })) return;
      feet.push(B0); fp.push([cx[b], cz[b]]);
    });
    out.feet = feet.map(function (b) { return b.name; });
    return (crCache[id] = out);
  }
  function crRig(e, id, ci) {
    const body = e.body, root = body.root, D0 = CRT[id] || {};
    const R = e.rig = { id: id, D: D0, biped: !!(body.B.LeftUpLeg && body.B.RightUpLeg), rest: new Map(), legs: [] };
    body.holder.updateMatrixWorld(true);
    const A0 = crAnalyze(id, body);
    R.box = A0.box;
    const bones = {};
    root.traverse(function (o) { if (o.isBone) bones[o.name] = o; });
    const limbBelow = function (b) { let f = false; b.traverse(function (o) { if (o !== b && o.isBone && LIMB.test(o.name)) f = true; }); return f; };
    // голова и шея: от головы вверх, пока в поддереве нет лап (иначе поворот шеи сдвигал бы ноги)
    let head = (D0.head && bones[D0.head]) || body.B.Head;
    R.head = head;
    R.look = [];
    if (R.biped) { if (body.B.Neck) R.look.push(body.B.Neck); if (head) R.look.push(head); }
    else { let b = head; while (b && b.isBone && R.look.length < 4 && !TRUNK.test(b.name) && !limbBelow(b)) { R.look.unshift(b); b = b.parent; } }
    // хвост: кости «Tail» и безымянные звенья над ними (без развилок)
    R.tail = [];
    let t0 = null;
    root.traverse(function (o) { if (!t0 && o.isBone && /Tail/.test(o.name)) t0 = o; });
    if (t0) {
      let b = t0.parent;
      while (b && b.isBone && b.children.filter(function (c) { return c.isBone; }).length === 1 && !TRUNK.test(b.name)) { R.tail.unshift(b); b = b.parent; }
      let c = t0;
      while (c) { R.tail.push(c); c = c.children.find(function (ch) { return ch.isBone && /Tail/.test(ch.name); }) || null; }
    }
    R.jaw = (D0.jaw || []).map(function (n) { return bones[n]; }).filter(Boolean);
    // уши, шипы, гребни, жвала: безымянные кости с весом при голове и хребте
    R.flaps = [];
    root.traverse(function (o) {
      if (R.flaps.length >= 8 || !o.isBone || !/^bone_\d+$/.test(o.name) || !o.parent || !o.parent.isBone || !A0.weighted.has(o.name)) return;
      if (R.jaw.indexOf(o) >= 0 || R.tail.indexOf(o) >= 0 || R.look.indexOf(o) >= 0 || limbBelow(o) || LIMB.test(o.parent.name)) return;
      if (R.look.indexOf(o.parent) >= 0 || /Head|Spine/.test(o.parent.name)) R.flaps.push(o);
    });
    // лапы: стопа и звенья над ней до туловища (у четвероногих — сгиб при гибели и вытяжка в прыжке)
    const cz = (R.box.min.z + R.box.max.z) / 2;
    R.feet = A0.feet.map(function (n) { return bones[n]; }).filter(Boolean);
    const under = function (p, x) { while (x) { if (x === p) return true; x = x.parent; } return false; };
    if (!R.biped) R.feet.forEach(function (f) {
      const ch = [];
      let b = f;
      while (b && b.isBone && ch.length < 6) {
        ch.unshift(b);
        const p = b.parent;
        if (!p || !p.isBone || TRUNK.test(p.name) || (head && under(p, head)) || R.feet.some(function (f2) { return f2 !== f && under(p, f2); })) break;
        b = p;
      }
      if (ch.length >= 4 && /^bone_/.test(ch[0].name)) ch.shift();
      R.legs.push({ ch: ch.slice(0, 3), front: ch[0].getWorldPosition(V()).z > cz });
    });
    // кости, которые поворачиваем сами
    R.legs.forEach(function (l) { l.ch.forEach(function (b) { R.rest.set(b, b.quaternion.clone()); }); });
    [].concat(R.look, R.tail, R.jaw, R.flaps).forEach(function (b) { R.rest.set(b, b.quaternion.clone()); });
    // глаза: точки у главной кости головы (чуть наружу из глазниц), рот — ниже и впереди глаз
    e.eyes = [];
    const pts = [];
    if (R.biped) {
      const L = bones.L_Eye, Rr = bones.R_Eye;
      if (L && Rr) {
        const a = L.getWorldPosition(V()), b2 = Rr.getWorldPosition(V());
        if (D0.one) pts.push(a.clone().lerp(b2, 0.5)); else pts.push(a, b2);
        pts.forEach(function (p) { p.z += 0.012 * body.H; });
      }
    } else if (D0.eyes && head) {
      const k = ci.h / (D0.h || ci.h), hc = head.getWorldPosition(V());
      D0.eyes.forEach(function (q) { const p = V(q[0], q[1], q[2]).multiplyScalar(k); pts.push(p.add(p.clone().sub(hc).normalize().multiplyScalar(0.012 * body.H))); });
    }
    const ec = new THREE.Color(D0.eye || 0xffa030);
    if (head) pts.forEach(function (p) { const o = new THREE.Object3D(); head.add(o); o.position.copy(head.worldToLocal(p.clone())); e.eyes.push({ o: o, s: D0.es || 0.07, c: ec }); });
    if (head) {
      const mid = pts.length ? pts.reduce(function (a, p) { return a.add(p); }, V()).multiplyScalar(1 / pts.length) : head.getWorldPosition(V()).add(V(0, 0, 0.08 * body.H));
      const mo = new THREE.Object3D(), mf = new THREE.Object3D();
      head.add(mo); head.add(mf);
      const mp = mid.clone().add(V(0, -(R.biped ? 0.045 : 0.08) * body.H, (R.biped ? 0.03 : 0.07) * body.H));
      mo.position.copy(head.worldToLocal(mp.clone()));
      mf.position.copy(head.worldToLocal(mp.clone().add(V(0, -0.05 * body.H, 0.3 * body.H))));
      R.mouthO = mo; R.mouthF = mf;
    }
    e.eyeA = 1;
    // клипы с ходом: увод таза за цикл (у ходьбы и бега Костолома тело поднималось на полметра) и длина шага цикла
    R.drift = {}; R.cyc = {};
    const hb = e.hipB;
    if (hb) {
      const meas = function (c, tm) { for (const n in e.cl) e.cl[n].act.weight = 0; c.act.weight = 1; c.act.time = tm; e.mixer.update(0); body.holder.updateMatrixWorld(true); return { l: hb.position.clone(), w: hb.getWorldPosition(V()) }; };
      for (const key in e.cl) {
        const c = e.cl[key];
        if (!c.a.loop) continue;
        const a0 = c.a.t0 || 0, a1 = c.a.t1 !== undefined ? Math.min(c.a.t1, c.dur) : c.dur;
        if (a1 - a0 < 0.3) continue;
        const A = meas(c, a0), Bm = meas(c, a1 - 1e-3);
        R.drift[key] = Bm.l.clone().sub(A.l);
        const tr = Math.hypot(Bm.w.x - A.w.x, Bm.w.z - A.w.z);
        if (tr > 0.5 * body.H && (key === 'walk' || key === 'run')) R.cyc[key] = tr;
      }
      for (const n in e.cl) e.cl[n].act.weight = 0;
      e.mixer.update(0);
    }
    // поза клипа у костей, которые крутим сами: mixer пишет кость, только если значение клипа изменилось,
    // поэтому перед каждым его шагом возвращаем «чистую» позу клипа — иначе наши повороты копились бы
    // (труп и стойка — клип стоит на месте)
    R.mods = []; R.rest.forEach(function (q0, b) { R.mods.push(b); });
    R.clipQ = R.mods.map(function (b) { return b.quaternion.clone(); });
    e.hipClip = e.hipB ? e.hipB.position.clone() : null;
    let mesh = null;
    root.traverse(function (o) { if (o.isSkinnedMesh && !mesh) mesh = o; });
    R.mesh = mesh;
    e.fs = R.feet.map(function () { return { lo: 1e9, hi: -1e9, up: false }; });
  }
  /* поворот кости в мировых осях вокруг сустава (дети следуют): ось axis, угол ang; вторая ось — по желанию.
     Мировые матрицы к этому моменту свежие (holder.updateMatrixWorld), после поворота обновляется только ветка
     кости — родителей не пересчитываем (дёшево на телефоне) */
  const _rw = new THREE.Quaternion(), _rp = new THREE.Quaternion(), _rq = new THREE.Quaternion(), _rq2 = new THREE.Quaternion(), _rm = V(), _rs = V();
  function rotW(bone, axis, ang, axis2, ang2) {
    const a1 = Math.abs(ang) > 1e-4, a2 = axis2 && Math.abs(ang2) > 1e-4;
    if (!a1 && !a2) return;
    if (a1) _rq.setFromAxisAngle(axis, ang); else _rq.identity();
    if (a2) _rq.multiply(_rq2.setFromAxisAngle(axis2, ang2));
    bone.matrixWorld.decompose(_rm, _rw, _rs); _rw.premultiply(_rq);
    bone.parent.matrixWorld.decompose(_rm, _rp, _rs); _rp.invert();
    bone.quaternion.copy(_rp.multiply(_rw));
    bone.updateMatrixWorld(true);
  }
  /* приём (прыжок, удар, укус, плевок, рык, выводок): своя шкала времени поверх 2D-движения */
  function mkAct(e, u, kind, t0, o) {
    const s = SPD();
    const A = { kind: kind, t0: t0, done: {} };
    if (kind === 'leap' || kind === 'smash' || kind === 'bite') {
      A.fx = u.x; A.fy = u.y; A.tx = o && o.tx !== undefined ? o.tx : u.x + Math.round(Math.cos(u.face || 0)); A.ty = o && o.ty !== undefined ? o.ty : u.y + Math.round(Math.sin(u.face || 0));
      A.dur = ({ leap: 580, smash: 800, bite: 540 })[kind] / s; A.imp = 300 / s; A.reach = 0.6;
    } else if (kind === 'spit') { A.dur = 950 / s; A.imp = 300 / s; }
    else if (kind === 'snarl') A.dur = 720 / s;
    else if (kind === 'hiss') A.dur = 820 / s;
    else if (kind === 'brood') A.dur = 1500 / s;
    else A.dur = 1350 / s;
    return A;
  }
  function crRoarKind(u) { return u.type === 'scav' ? 'snarl' : (u.type === 'spitter' ? 'hiss' : (u.type === 'guardian' ? null : 'roar')); }
  /* сигналы 2D-боя: новое движение (атака, рывок, плевок, попадание, гибель), вступление в бой */
  function crSignals(e, u, t) {
    const tr = TR2(), an = tr.curAnimOf(u);
    if (an && an.a !== e.anA) {
      e.anA = an.a;
      const k = an.kind, t0 = an.a.t0;
      if (k === 'die') crDie(e, u, t0);
      else if (u.alive && k === 'hit') {
        e.hit = { t0: t0, d: (R3.mfx && R3.mfx.hitDir(u)) || { x: -Math.cos(u.face || 0), z: -Math.sin(u.face || 0) } };
        e.hitD = e.hit.d; e.exert = 1;
        if (e.act && (e.act.kind === 'roar' || e.act.kind === 'snarl' || e.act.kind === 'hiss')) e.act = null;
      } else if (u.alive && k === 'atk') {
        const tw = tr.tweenOf(u.id);
        const o = tw && tw.kind === 'lunge' ? { tx: tw.tx, ty: tw.ty } : null;
        e.act = mkAct(e, u, u.type === 'brute' ? 'smash' : (e.rig.D.leap ? 'leap' : 'bite'), t0, o);
        e.exert = 1;
      } else if (u.alive && k === 'charge' && u.type === 'spitter') { e.act = mkAct(e, u, 'spit', t0); e.exert = 1; }
    } else if (!an) e.anA = null;
    // вступил в бой у нас на глазах — рык (Падальщик огрызается, Плевун шипит)
    if (e.wasAct === undefined) e.wasAct = !!u.active;
    else if (u.active && !e.wasAct && u.alive) {
      const kd = crRoarKind(u);
      if (kd && !e.act) e.act = mkAct(e, u, kd, t + (u.type === 'alpha' || u.type === 'queen' ? 0 : Math.random() * 400));
    }
    e.wasAct = !!u.active;
  }
  /* гибель: куда падать (от стрелка), разворот в падении, на какой бок */
  function crDie(e, u, t0) {
    const d = (R3.mfx && R3.mfx.hitDir(u)) || e.hitD || null;
    const th = Math.PI / 2 - (u.face || 0);
    let lx = 0, lz = 0;
    if (d) { lx = Math.cos(th) * d.x - Math.sin(th) * d.z; lz = Math.sin(th) * d.x + Math.cos(th) * d.z; }
    const side = Math.abs(lx) > 0.2 ? (lx > 0 ? -1 : 1) : ((u.id || 0) % 2 ? 1 : -1);
    let twist = (Math.random() - 0.5) * 0.5;
    // двуногие валятся по клипу влево (+X модели): довернуть, чтобы падали от стрелка
    if (e.rig.biped && d) twist = U.clamp(Math.atan2(-lz, lx), -1.1, 1.1);
    e.die = { t0: t0, dur: (e.rig.biped ? 1350 : 1150) / SPD(), side: side, twist: twist, settle: null };
    e.act = null; e.hit = null;
  }
  function creaturePose(e, u, t) {
    const tr = TR2();
    const tw = tr.tweenOf(u.id), an = tr.curAnimOf(u);
    const ts = t / 1000;
    if (!u.alive) {
      const dk = e.die ? U.clamp((t - e.die.t0) / e.die.dur, 0, 1) : 1;
      // двуногие: клип «fall» — 0–0,33 пошатнулся, 0,33–0,8 упал и затих
      return { key: 'die', p: e.rig.biped ? (dk < 0.25 ? 0.33 * dk / 0.25 : 0.33 + 0.47 * smo((dk - 0.25) / 0.6)) : 1, dk: dk };
    }
    const A = e.act && e.act.k >= 0 ? e.act : null;
    if (A) {
      const k = A.k;
      if (A.kind === 'leap') return { key: 'atk', p: k < 0.2 ? 0.1 : (k < 0.55 ? 0.45 : 0.1 + 0.5 * k), act: A };
      if (A.kind === 'smash') { const kI = A.imp / A.dur; return { key: 'atk', p: k < kI ? 0.45 * Math.pow(k / kI, 0.85) : 0.45 + 0.35 * smo((k - kI) / (1 - kI)), act: A }; }
      if (A.kind === 'bite') return { key: 'atk', p: Math.min(0.999, k * A.dur / (300 / SPD())), act: A, fx: true };
      if (A.kind === 'spit') { const ms = (t - A.t0) * SPD(); return { key: 'atk', p: ms < 300 ? 0.27 * smo(ms / 300) : 0.27 + 0.33 * U.clamp((ms - 300) / 650, 0, 1), act: A }; }
      // рык, оскал, шипение, выводок
      if (e.cl.roar) return { key: 'roar', p: e.rig.biped ? 0.05 + 0.8 * k : k, act: A, fx: true };
      if (u.type === 'spitter' && e.cl.atk) return { key: 'atk', p: 0.16 * Math.sin(Math.min(1, k * 1.2) * Math.PI), act: A };
      return { key: 'idle', ts: ts + (u.id || 0), act: A };
    }
    if (tw && tw.kind === 'step') {
      const key = tw.run && e.cl.run ? 'run' : 'walk';
      const cyc = e.rig.cyc[key];
      let ph;
      // клип с ходом: шаг клипа = шаг по земле (ноги не скользят); иначе — как в 2D
      if (cyc && tr.stepKOf) ph = ((tw.dist0 || 0) + (tw.len || 1) * tr.stepKOf(tw)) * T / (cyc * e.sc);
      else ph = (tr.walkPhase(u) || 0) / (Math.PI * 2);
      return { key: key, ph: (ph % 1 + 1) % 1, walk: true, run: key === 'run' };
    }
    if (an) {
      const p = U.clamp(an.p, 0, 0.999);
      switch (an.kind) {
        case 'shoot': case 'throw': case 'atk': return { key: 'atk', p: p };
        case 'charge': return { key: 'atk', p: 0 };
        case 'hit': return { key: 'hit', p: p, hit: true };
        case 'shake': case 'sniff': return { key: e.cl.roar ? 'roar' : 'idle', p: p, ts: ts, fx: true };
      }
    }
    return { key: 'idle', ts: ts + (u.id || 0), idle: true };
  }

  /* ---------- Набор моделей ---------- */
  const ents = {};       // id → сущность
  let group = null, refAK = null, initDone = false;
  UN.init = function (B) {
    if (group) { R3.scene.remove(group); }
    spots = []; lieOcc = {};
    for (const k in ents) delete ents[k];
    group = new THREE.Group(); group.name = 'units';
    R3.scene.add(group);
    const M3 = DW.M3;
    if (!refAK && M3 && M3.weapons.ak) R3.loadGLB('models/' + M3.weapons.ak.f + '.glb').then(function (gl) { if (gl) refAK = makeWeapon(gl, M3.weapons.ak); });
    if (R3.mfx && R3.mfx.init) R3.mfx.init(B);
    initDone = false;
    B.units.forEach(function (u) { ensure(u); });
    initDone = true;
  };
  /* мягкое пятно тени под ногами (на слабой графике теней нет — без него фигуры «висят») */
  let blobTex = null;
  function blob(size) {
    if (!blobTex) {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
      gr.addColorStop(0, 'rgba(0,0,0,0.75)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      blobTex = new THREE.CanvasTexture(c);
    }
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: R3.q() === 0 ? 0.9 : 0.45, polygonOffset: true, polygonOffsetFactor: -3 }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.015; m.renderOrder = 3;
    return m;
  }
  const ONEHAND = { tt: 1 };   // пистолет в одной руке
  function bodyIdOf(u) {
    const S = DW.S3 && DW.S3.setsFor(u);
    if (!S) return null;
    if (S.kind === 'turret') return { kind: 'turret' };
    if (S.kind === 'creature') { let id = S.body.slice(2); return { kind: 'creature', id: id }; }
    const T = u.type && D.ENEMIES[u.type];
    // рубака клана — с тесаком (только 3D), щитовик — щит на левой руке
    const wid = T && T.blade && DW.M3 && DW.M3.weapons.machete ? 'machete' : (S.weapon ? S.weapon.slice(2) : null);
    return { kind: 'human', id: S.body.slice(2), weapon: wid, shield: !!(T && T.shield) };
  }
  function ensure(u) {
    if (ents[u.id]) return ents[u.id];
    const M3 = DW.M3;
    const k = bodyIdOf(u);
    const e = ents[u.id] = { u: u, kind: k ? k.kind : null, ready: false, prev: null, cur: null, x: 0, cl: {} };
    // появился посреди боя (выводок Матки) — вылупляется
    if (k && k.kind === 'creature' && initDone) e.spawned = true;
    if (!k || !M3) return e;
    if (k.kind === 'human') {
      const bi = M3.bodies[k.id] || M3.bodies.krut;
      Promise.all([R3.loadGLB('models/' + (R3.q() < 2 && bi.lo ? bi.lo : bi.f) + '.glb'), k.weapon && M3.weapons[k.weapon] ? R3.loadGLB('models/' + M3.weapons[k.weapon].f + '.glb') : null,
        M3.weapons.rpg ? R3.loadGLB('models/' + M3.weapons.rpg.f + '.glb') : null,
        k.shield && M3.weapons.shield ? R3.loadGLB('models/' + M3.weapons.shield.f + '.glb') : null]).then(function (r) {
        if (!r[0] || !group || ents[u.id] !== e) return;
        const body = makeBody(r[0], bi.h || 1.8, true);
        retargetSetup(body);
        e.body = body;
        group.add(body.holder);
        e.blob = blob(0.95); group.add(e.blob);
        if (r[1]) { e.wpn = makeWeapon(r[1], M3.weapons[k.weapon]); e.wpn.id = k.weapon; e.wpn.one = !!ONEHAND[k.weapon]; group.add(e.wpn.g); if (R3.wmods && R3.wmods.attach && u.mods && u.mods.length) R3.wmods.attach(e.wpn, u.mods, k.weapon); }
        if (r[2] && u.cls === 'heavy') { e.rpg = makeWeapon(r[2], M3.weapons.rpg); e.rpg.g.visible = false; group.add(e.rpg.g); }
        if (r[3]) { e.shield = makeWeapon(r[3], M3.weapons.shield); group.add(e.shield.g); }
        if (R3.gear) R3.gear.attach(e, u);
        e.pose = { q: new Float32Array(DW.ANIM3.bones.length * 4), hp: V() };
        e.ready = true;
      });
    } else if (k.kind === 'creature') {
      const ci = M3.creatures[k.id];
      if (!ci) return e;
      Promise.all([R3.loadGLB('models/' + ci.f + '.glb')].concat(ci.more.map(function (m) { return R3.loadGLB('models/' + m + '.glb'); }))).then(function (r) {
        if (!r[0] || !group || ents[u.id] !== e) return;
        const pre = r[0].animations.find(function (an) { return /idle/i.test(an.name); }) || r[0].animations[0] || null;
        const body = makeBody(r[0], ci.h, false, ci.yaw || 0, pre);
        e.body = body; e.ci = ci;
        group.add(body.holder);
        e.blob = blob(ci.quad ? ci.h * 1.2 : Math.max(1.0, ci.h * 0.6)); group.add(e.blob);
        // клипы: из основного файла и дополнительных (тот же скелет)
        const clips = {};
        r.forEach(function (g, i) { if (g) g.animations.forEach(function (a) { clips[(i ? ci.more[i - 1] : ci.f) + '|' + a.name] = a; clips[a.name] = clips[a.name] || a; }); });
        e.mixer = new THREE.AnimationMixer(body.root);
        // поиск клипа по имени как в запекании: точно, без регистра, по части имени («walk» → «preset:quadruped:walk»)
        const all = [];
        r.forEach(function (g, i) { if (g) g.animations.forEach(function (an) { all.push({ f: i ? ci.more[i - 1] : ci.f, c: an }); }); });
        const find = function (name, file) {
          const L = file ? all.filter(function (q) { return q.f === file; }) : all;
          if (!L.length) return null;
          if (name === '*') return L[0].c;
          const lc = name.toLowerCase();
          const hit = L.find(function (q) { return q.c.name === name; }) || L.find(function (q) { return q.c.name.toLowerCase() === lc; }) ||
            L.find(function (q) { return q.c.name.toLowerCase().split(':').pop() === lc; }) || L.find(function (q) { return q.c.name.toLowerCase().indexOf(lc) >= 0; });
          return hit ? hit.c : null;
        };
        ci.anims.forEach(function (a) {
          const c = a.src ? find(a.clip, a.src) : find(a.clip);
          if (!c) return;
          const act = e.mixer.clipAction(c);
          act.play(); act.weight = 0; act.paused = true;
          e.cl[a.key] = { act: act, a: a, dur: c.duration };
        });
        // кость хода (таз): движение «вперёд» клипа гасим — существо остаётся на клетке
        body.root.traverse(function (o) { if (!e.hipB && o.isBone && /^(hips?|pelvis)$/i.test(o.name)) e.hipB = o; });
        e.hipB = e.hipB || body.B.Hips;
        e.hip0 = e.hipB ? e.hipB.position.clone() : null;
        // кости по смыслу, глаза, разбор клипов; мокрая кожа — r3d/mfx.js
        crRig(e, k.id, ci);
        if (R3.mfx && R3.mfx.dress) R3.mfx.dress(e, k.id, r[0]);
        e.ready = true;
      });
    } else if (k.kind === 'turret' && M3.turret) {
      R3.loadGLB('models/' + M3.turret.f + '.glb').then(function (gl) {
        if (!gl || !group || ents[u.id] !== e) return;
        const m = R3.world.placeModel(gl, { len: M3.turret.len, hMax: M3.turret.hMax }, V(), 0);
        e.body = { holder: m }; group.add(m); e.ready = true;
      });
    }
    return e;
  }
  UN.ensure = ensure;

  /* ---------- Кадр ---------- */
  const tmpM = new THREE.Matrix4();
  function visibleUnit(u) {
    if (u.evac) return false;
    if (u.side === 'p') return true;
    return !!u.seen || !u.alive && DW.BT.get().explored[u.y * DW.BT.get().w + u.x];
  }
  /* фонари отряда ночью: светят ближайшие к камере бойцы (по уровню графики 1–3 фонаря) */
  let spots = [];
  function flashlights(B) {
    // фонари только в темноте — а темноты в боях больше нет (дорогие прожекторы не создаются)
    const night = !!(B.dark && B.lights);
    const n = night ? [1, 2, 3][R3.q()] : 0;
    while (spots.length < n) {
      const s = new THREE.SpotLight(0xfff0d8, 0, 13, 0.42, 0.55, 1.4);
      s.castShadow = false; group.add(s); group.add(s.target); spots.push(s);
    }
    const cx = R3.cam.tx, cz = R3.cam.tz;
    const list = night ? B.units.filter(function (u) { return u.side === 'p' && u.alive && !u.evac && ents[u.id] && ents[u.id].ready && ents[u.id].body.B; })
      .sort(function (a, b) { const pa = ents[a.id].body.holder.position, pb = ents[b.id].body.holder.position; return Math.hypot(pa.x - cx, pa.z - cz) - Math.hypot(pb.x - cx, pb.z - cz); }) : [];
    spots.forEach(function (s, i) {
      const u = list[i];
      if (!u || i >= n) { s.intensity = 0; return; }
      const e = ents[u.id];
      const W = e.wpn && e.wpn.g.visible ? e.wpn : null;
      // фонарь — у дульного среза и чуть впереди: светит вперёд, а не по самому стволу (раньше ствол засвечивало добела)
      const p = W ? V(W.muzzle.x, W.muzzle.y + 0.03, W.muzzle.z - 0.12).applyMatrix4(W.g.matrixWorld) : e.body.B.Head.getWorldPosition(V());
      const dir = W ? V(0, 0, -1).transformDirection(W.g.matrixWorld) : V(Math.cos(u.face || 0), -0.25, Math.sin(u.face || 0));
      dir.y = Math.min(dir.y, -0.12); dir.normalize();
      s.position.copy(p); s.target.position.copy(p).addScaledVector(dir, 6); s.target.updateMatrixWorld();
      s.intensity = 26;
    });
  }
  UN.update = function (dt, t) {
    const B = DW.BT.get();
    if (!B || !group) return;
    const tr = TR2();
    flashlights(B);
    B.units.forEach(function (u) {
      const e = ensure(u);
      if (!e.ready) return;
      const vis = visibleUnit(u);
      e.body.holder.visible = vis;
      if (e.wpn) e.wpn.g.visible = vis;
      if (e.blob && !vis) e.blob.visible = false;
      if (!vis) return;
      // тело улеглось и замерло: ни позы, ни матриц (только видимость)
      if (e.still) { if (e.shield) e.shield.g.visible = vis; if (e.blob) e.blob.visible = false; return; }
      // положение: как в 2D (ход по сглаженному пути, прижаться к укрытию), высота по уровню; падающее тело ведёт гибель
      const p = u.alive ? tr.leanPos(u) : [u.x, u.y];
      const lvl = tr.uLevel(u);
      if (u.alive || !e.dth) e.body.holder.position.set((p[0] + 0.5) * T, lvl * LV, (p[1] + 0.5) * T);
      if (e.blob) { e.blob.visible = u.alive; e.blob.position.set(e.body.holder.position.x, lvl * LV + 0.015, e.body.holder.position.z); }
      let face = tr.dispFace(u);
      if (e.kind === 'turret') { e.body.holder.rotation.y = -face; return; }
      if (e.kind === 'human') updHuman(e, u, t, dt, face);
      else updCreature(e, u, t, dt, face);
    });
    // эффекты мутантов (частицы, следы, глаза) — r3d/mfx.js
    if (R3.mfx && R3.mfx.update) R3.mfx.update(dt, t);
  };
  /* ---------- Живость: корпус доворачивается к цели при прицеливании, голова смотрит на ближайшего врага ---------- */
  const _lq = new THREE.Quaternion(), _lq2 = new THREE.Quaternion(), _lw = new THREE.Quaternion(), _lp = new THREE.Quaternion();
  const _lv = V(), _lv2 = V(), _lv3 = V(), _lI = new THREE.Quaternion();
  const NOLOOK = { climb: 1, vault: 1, reload: 1, throw: 1, throwk: 1, heal: 1, melee: 1, punch: 1, panic: 1, cheer: 1, hit: 1, hit2: 1, die: 1, die2: 1, die3: 1, idle2: 1, slide: 1, wall: 1, duck: 1 };
  const _lv4 = V(), _lv5 = V(), _lv6 = V(), _lv7 = V();
  function rotWorld(bone, q) {
    // поворот кости в мире на q (вокруг её сустава); дети идут за ней. Мировые матрицы к этому моменту свежие (после
    // позы, IK и прежних поворотов) — родителей не пересчитываем, берём готовые (дешевле на телефоне)
    bone.matrixWorld.decompose(_lv4, _lw, _lv5);
    _lw.premultiply(q);
    bone.parent.matrixWorld.decompose(_lv4, _lp, _lv5); _lp.invert();
    bone.quaternion.copy(_lp.multiply(_lw));
    bone.updateMatrixWorld(true);
  }
  function lookTarget(e, u, t) {
    // раз в полсекунды: ближайший видимый противник в 14 клетках
    if (e.lookT && t - e.lookT < 500) return e.lookU;
    e.lookT = t; e.lookU = null;
    const B = DW.BT.get(); if (!B) return null;
    let best = 14 * 14;
    B.units.forEach(function (o) {
      if (!o.alive || o.evac || o.side === u.side) return;
      if (u.side === 'p' ? !o.seen : !(u.active)) return;
      const d = (o.x - u.x) * (o.x - u.x) + (o.y - u.y) * (o.y - u.y);
      if (d < best) { best = d; e.lookU = o; }
    });
    return e.lookU;
  }
  function liveliness(e, u, P, t, dt) {
    const B = e.body.B;
    if (!B.Spine || !B.Head || !u.alive) { e.lookW = 0; return; }
    const tr = TR2();
    const aiming = u._aimAt && tr.now() < (u._aimUntil || 0) && (P.key === 'aim' || P.key === 'kneel' || P.key === 'shoot');
    const tgtU = aiming ? u._aimAt : (NOLOOK[P.key] ? null : lookTarget(e, u, t));
    // плавные веса
    e.twW = (e.twW || 0) + ((aiming ? 1 : 0) - (e.twW || 0)) * Math.min(1, dt * 8);
    e.lookW = (e.lookW || 0) + ((tgtU ? 1 : 0) - (e.lookW || 0)) * Math.min(1, dt * 4);
    if (tgtU) { e.lookP = UN.anchor(tgtU, false); e.lookP.y += 1.3 * (tr.unitScale(tgtU) / 1.13); }
    if (!e.lookP || (e.twW < 0.01 && e.lookW < 0.01)) return;
    const Tq = torso(B, e.tq || (e.tq = mkTorso()));
    // корпус: доворот по горизонтали до 60°, тремя позвонками; цель выше или ниже — верх корпуса наклоняется к ней
    // (часть угла, остальное — руки и ствол); доворот и наклон — одним поворотом на позвонок
    if (e.twW > 0.01) {
      _lv.copy(Tq.Z).setY(0).normalize();
      _lv3.setFromMatrixPosition(B.Spine.matrixWorld);
      _lv2.copy(e.lookP).sub(_lv3).setY(0);
      if (_lv2.lengthSq() > 0.01) {
        const hl = _lv2.length();
        _lv2.multiplyScalar(1 / hl);
        let ang = Math.atan2(_lv.z * _lv2.x - _lv.x * _lv2.z, _lv.dot(_lv2));
        ang = Math.max(-1.05, Math.min(1.05, ang)) * e.twW;
        _lq.setFromAxisAngle(UP, ang / 3);
        rotWorld(B.Spine, _lq);
        const el = hl > 0.3 ? Math.max(-0.6, Math.min(0.6, Math.atan2(e.lookP.y - _lv3.y - 0.45, hl))) * 0.4 * e.twW : 0;
        _lv4.set(_lv2.z, 0, -_lv2.x);   // ось: верх — к цели по горизонтали (+) / от неё (−)
        _lq2.setFromAxisAngle(_lv4, -el / 2).multiply(_lq);
        if (B.Spine1) rotWorld(B.Spine1, _lq2); if (B.Spine2) rotWorld(B.Spine2, _lq2);
      }
    }
    // голова: на цель, до 55° в сторону и 30° вверх-вниз, пополам шея и голова (оружие у плеча — голова к прицелу,
    // это sightHead после хвата)
    if (e.lookW > 0.01 && B.Neck && !(e.sightW > 0.97)) {
      const T2 = torso(B, Tq);
      const hp = B.Head.getWorldPosition(_lv3);
      _lv2.copy(e.lookP).sub(hp);
      if (_lv2.lengthSq() > 0.04) {
        _lv2.normalize();
        _lv.copy(T2.Z).normalize();
        // ограничить отклонение от груди
        const fh = _lv6.copy(_lv).setY(0).normalize(), th = _lv7.copy(_lv2).setY(0);
        if (th.lengthSq() > 1e-4) {
          th.normalize();
          let yaw = Math.atan2(fh.z * th.x - fh.x * th.z, fh.dot(th));
          yaw = Math.max(-0.96, Math.min(0.96, yaw));
          const pit = Math.max(-0.52, Math.min(0.52, Math.asin(Math.max(-1, Math.min(1, _lv2.y)))));
          _lv2.copy(fh).applyAxisAngle(UP, yaw).multiplyScalar(Math.cos(pit)).setY(Math.sin(pit)).normalize();
          _lq.setFromUnitVectors(_lv, _lv2);
          _lq2.copy(_lI).slerp(_lq, 0.5 * e.lookW);
          rotWorld(B.Neck, _lq2); rotWorld(B.Head, _lq2);
        }
      }
    }
  }
  function updHuman(e, u, t, dt, face) {
    // гибель и лёжка — свой порядок (падение от выстрела, ствол на земле, потом тело замирает)
    if (!u.alive) { deathUpd(e, u, t); return; }
    if (e.dth || e.still) deathReset(e);
    // шаг по часам боя: замедление (кинокамера) замедляет и сглаживание, остановленные часы — стоп-кадр
    const dtB = e.tB !== undefined ? Math.max(0, Math.min(0.1, (t - e.tB) / 1000)) : 0;
    e.tB = t;
    const tr = TR2(), H = e.body.holder;
    const P = humanPose(e, u, t);
    const c = libClip(P.key) || libClip('idle');
    if (!c) return;
    if (P.facing !== undefined && P.facing !== null) face = P.facing;
    // из-за стены: шаг вбок из-за угла (в свободную сторону) на время выстрела, потом обратно
    if (P.stepOut && !e.soDir) {
      const B = DW.BT.get(), f = u.face || 0;
      const sides = [[-Math.sin(f), Math.cos(f)], [Math.sin(f), -Math.cos(f)]];
      const free = function (d) { const x = Math.round(u.x + d[0]), y = Math.round(u.y + d[1]); const o = DW.BT.objAt(x, y); return x >= 0 && y >= 0 && x < B.w && y < B.h && !(o && D.OBJ[o].cover === 2); };
      e.soDir = free(sides[0]) ? sides[0] : sides[1];
    }
    e.so = (e.so || 0) + ((P.stepOut ? 1 : 0) - (e.so || 0)) * Math.min(1, dtB * 9);
    if (!P.stepOut && e.so < 0.02) { e.so = 0; e.soDir = null; }
    const so = e.so > 0 && e.soDir ? smo(e.so) : 0;
    if (so > 0) { H.position.x += e.soDir[0] * so * 0.5 * T; H.position.z += e.soDir[1] * so * 0.5 * T; }
    // попадание: вздрагивание от выстрела — шаг назад и присед (до позы), наклон корпуса и головы (после)
    const F = flinchState(e, u, t);
    if (F) { H.position.x += F.x * F.k * 0.07; H.position.z += F.z * F.k * 0.07; }
    if (e.blob) { e.blob.position.x = H.position.x; e.blob.position.z = H.position.z; }
    H.rotation.y = Math.PI / 2 - face + (c.yaw || 0) * Math.PI / 180;
    H.scale.setScalar(1);
    // смена движения — плавно: старая поза растворяется за 0,12–0,25 с (к плечу — 0,16 с)
    if (e.key !== P.key) {
      if (e.key) {
        const fp = e.fromP || (e.fromP = { q: new Float32Array(e.pose.q.length), hp: V() });
        fp.q.set(e.pose.q); fp.hp.copy(e.pose.hp); e.from = fp; e.fromT = t;
        e.fromD = (P.key === 'aim' || P.key === 'kneel' || P.key === 'shoot') ? 160 : ((P.key === 'walk' || P.key === 'run' || e.key === 'walk' || e.key === 'run' || P.key === 'sneak') ? 150 : 260);
      }
      e.key = P.key;
    }
    samplePose(P.key, P.t, e.pose);
    if (e.from) {
      const k = (t - e.fromT) / e.fromD;
      if (k >= 1 || k < 0) e.from = null;
      else blendPose(e.from, e.pose, k * k * (3 - 2 * k), e.pose);
    }
    if (F) e.pose.hp.y -= 0.035 * F.k;
    // пистолет в одной руке: левая рука — как в покое (не тянется к несуществующему цевью)
    if (e.wpn && e.wpn.one && c.mode === 'aim') {
      const ip = e.p1 || (e.p1 = { q: new Float32Array(e.pose.q.length), hp: V() });
      samplePose('idle', t / 1000 + (u.id || 0) * 3.1, ip);
      for (let i = 0; i < LARM.length; i++) { const j = DW.ANIM3.bones.indexOf(LARM[i]) * 4; if (j >= 0) { e.pose.q[j] = ip.q[j]; e.pose.q[j + 1] = ip.q[j + 1]; e.pose.q[j + 2] = ip.q[j + 2]; e.pose.q[j + 3] = ip.q[j + 3]; } }
    }
    applyPose(e.body, e.pose);
    if (F) flinchApply(e, F);
    // из-за угла: шагнул в сторону и выглянул — корпус наклонён наружу (верх — к открытой стороне)
    if (so > 0 && e.body.B.Spine && e.body.B.Spine1) {
      _huV.set(e.soDir[1], 0, -e.soDir[0]);
      _huQ.setFromAxisAngle(_huV, 9 * DG * so);
      rotWorld(e.body.B.Spine, _huQ); rotWorld(e.body.B.Spine1, _huQ);
    }
    liveliness(e, u, P, t, dtB);
    // оружие
    const an = tr.curAnimOf(u);
    const rpg = !!(e.rpg && an && an.kind === 'shoot' && an.a.data && an.a.data.rpg);
    if (e.rpg) e.rpg.g.visible = rpg && H.visible;
    const W = rpg ? e.rpg : e.wpn;
    if (e.wpn) e.wpn.g.visible = !rpg && H.visible;
    if (!W || !refAK) return;
    if (!e.cal || e.cal.w !== W) calibrate(e, W);
    let mode = c.mode || 'carry';
    if (mode === 'left') mode = 'sling';
    if (W.melee && mode !== 'sling') mode = 'hand';   // тесак — всегда в кисти
    const groundY = H.position.y;
    const R = recoilEval(e, u, t);
    const M = e.gM || (e.gM = new THREE.Matrix4());
    if (mode === 'hand' || mode === 'left') {
      const hand = mode === 'left' ? e.body.B.LeftHand : e.body.B.RightHand;
      M.compose(hand.getWorldPosition(_huV), hand.getWorldQuaternion(_huQ), _ONE).multiply(mode === 'left' ? e.cal.offL : e.cal.offR);
      // щитовик стреляет из-за щита одной рукой: отдача — кисть с пистолетом вверх-назад, кисть идёт за рукоятью
      if (R.on) applyRecoil(M, null, null, W, R);
      if (mode === 'hand' && R3.grip && R3.grip.apply) R3.grip.apply({ body: e.body, W: W, M: M, mode: 'hand', grip: _huV.setFromMatrixPosition(M), fore: null, key: P.key, freeL: true, reload: false });
      e.gk = null; e.sightW = 0;
    } else {
      // отдача корпусом: плечи назад, пулемётчика раскачивает (до хвата — оружие идёт от плеча)
      if (R.on) bodyRecoil(e, R);
      const Tq = torso(e.body.B, e.tq || (e.tq = mkTorso()));
      const grp = gripKey(W, mode, rpg);
      const G = GRIP[grp] || GRIP.carry;
      // переход между хватами: к плечу — быстро и с дотягом, вниз — мягко
      if (e.gk !== grp) { e.gkFrom = e.gk || grp; e.gk = grp; e.gkT0 = t; e.gkD = (AIMG[grp] ? 170 : 320) / SPD(); }
      // наведение в цель на время выстрела (TR3.shotFx): грудь цели — та же точка, куда летят пули
      const aiming = AIMG[grp] && u._aimAt && tr.now() < (u._aimUntil || 0);
      e.aimK = Math.max(0, Math.min(1, (e.aimK || 0) + (aiming ? dtB : -dtB) / 0.15));
      let AIM = null;
      if (e.aimK > 0 && u._aimAt) {
        const tg = u._aimAt;
        if (aiming || !e.aimP) e.aimP = UN.anchor(tg, false).add(_huV.set(0, (tg.type === 'queen' ? 1.4 : 1.05) * (tr.unitScale(tg) / 1.13), 0));
        AIM = e.aimO || (e.aimO = { p: null, k: 0 });
        AIM.p = e.aimP; AIM.k = e.aimK * e.aimK * (3 - 2 * e.aimK);
      }
      const grip = e.gG || (e.gG = V()), fore = e.gF || (e.gF = V());
      place(Tq, W, G, groundY, AIMG[grp] ? AIM : null, mode, M, grip, fore);
      let aimW = AIMG[grp] ? 1 : 0;
      const gk = e.gkD > 0 ? (t - e.gkT0) / e.gkD : 1;
      if (e.gkFrom !== grp && gk < 1 && gk >= 0) {
        const raise = !!AIMG[grp], k = raise ? 1 - Math.pow(1 - gk, 3) : gk * gk * (3 - 2 * gk);
        place(Tq, W, GRIP[e.gkFrom] || GRIP.carry, groundY, AIMG[e.gkFrom] ? AIM : null, mode, _huM2, _huG2, _huF2);
        blendM(_huM2, M, k, M); grip.lerpVectors(_huG2, grip, k); fore.lerpVectors(_huF2, fore, k);
        aimW = raise ? k : 1 - k;
        if (!raise && AIMG[e.gkFrom]) aimW = 1 - k;
      }
      // отдача: ствол назад и вверх вокруг приклада, увод за очередь; дробовик — помпа, обрез — переломить
      if (R.on) applyRecoil(M, grip, fore, W, R);
      // руки на оружие (кроме «за спиной»); перезарядка — левая рука: магазин → подсумок на поясе → магазин → цевьё
      if (c.freeL && P.key === 'reload') {
        const pr = c.dur > 0 ? U.clamp(P.t / c.dur, 0, 1) : 0;
        const up = _huV.set(0, 1, 0).transformDirection(M);
        const mag = _huG2.copy(grip).lerp(fore, 0.42).addScaledVector(up, -0.09);
        const T2 = torso(e.body.B, e.tq);
        const pouch = e.body.B.Hips.getWorldPosition(_huF2).addScaledVector(T2.Z, 0.16).addScaledVector(T2.X, -0.12).addScaledVector(T2.Y, 0.05);
        const sm = function (a0, a1, x) { const k = U.clamp((x - a0) / (a1 - a0), 0, 1); return k * k * (3 - 2 * k); };
        // 0–0,2 к магазину, 0,25–0,45 вниз к поясу, 0,55–0,75 обратно, 0,82–1 на цевьё
        const L = _huL.copy(fore).lerp(mag, sm(0, 0.18, pr));
        L.lerp(pouch, sm(0.25, 0.45, pr) * (1 - sm(0.55, 0.75, pr)));
        L.lerp(fore, sm(0.82, 1, pr));
        handsTo(e.body, grip, L, false);
        if (R3.grip && R3.grip.apply) R3.grip.apply({ body: e.body, W: W, M: M, mode: mode, grip: grip, fore: L, key: P.key, freeL: false, reload: true });
      } else if (mode !== 'sling') {
        const freeL = c.freeL || !!e.shield || (W.pistol && W.one);
        handsTo(e.body, grip, fore, freeL);
        // поворот кистей (ладонь на рукояти, левая — под цевьём) и сгиб пальцев — модуль r3d/grip.js; помпа — левая назад
        if (R3.grip && R3.grip.apply) R3.grip.apply({ body: e.body, W: W, M: M, mode: mode, grip: grip, fore: fore, key: P.key, freeL: freeL, reload: false, foreSlide: R.pump * 0.1 });
      } else if (R3.grip && R3.grip.relax) R3.grip.relax(e.body);   // ствол за спиной — пальцы разжаты
      // голова к прицелу: щекой к прикладу, взгляд вдоль ствола (у пистолета — над руками, у РПГ — к прицелу слева)
      if (aimW > 0.01 && !(UN._dbg && UN._dbg.noSight)) sightHead(e, M, W, aimW, grp, R);
      e.sightW = grp === 'hip' ? 0 : aimW;
    }
    W.g.matrix.copy(M);
    W.g.matrixWorldNeedsUpdate = true;
    W.g.updateMatrixWorld(true);
    if (e.shield) placeShield(e, u);
    (e.lp || (e.lp = V())).copy(H.position);   // откуда начнётся падение, если убьют
  }
  const LARM = ['LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand'];
  const _huV = V(), _huQ = new THREE.Quaternion(), _ONE = V(1, 1, 1), _huM2 = new THREE.Matrix4(), _huG2 = V(), _huF2 = V(), _huL = V();
  // хваты «у плеча» (наведение в цель, голова к прицелу)
  const AIMG = { aim: 1, hip: 1, pistol: 1, rpg: 1, pistol1: 1 };
  function gripKey(W, mode, rpg) {
    if (rpg) return 'rpg';
    if (W.pistol) return mode === 'aim' ? (W.one ? 'pistol1' : 'pistol') : (mode === 'carry' ? 'pistolLow' : mode);
    return (W.hipAim && mode === 'aim') ? 'hip' : mode;
  }
  /* оружие по хвату: матрица M, точки кистей (рукоять, цевьё) — как раньше: у обычного ствола по эталонному АК */
  const _plMA = new THREE.Matrix4(), _plV = V();
  function place(Tq, W, G, groundY, AIM, mode, M, grip, fore) {
    gunMatrix(Tq, W, G, groundY, AIM, M);
    if (!W.free && !W.pistol) {
      const MA = gunMatrix(Tq, refAK, G, groundY, AIM, _plMA);
      grip.setFromMatrixPosition(MA); fore.copy(refAK.fore).applyMatrix4(MA);
      const sh = mode === 'sling' ? 0 : Math.max(0, W.buttZ - refAK.buttZ);
      _plV.set(0, 0, -1).transformDirection(M);
      M.setPosition(_huV.copy(grip).addScaledVector(_plV, sh));
    } else { grip.setFromMatrixPosition(M); fore.copy(W.fore).applyMatrix4(M); }
  }
  const _bmP = V(), _bmP2 = V(), _bmQ = new THREE.Quaternion(), _bmQ2 = new THREE.Quaternion(), _bmS = V();
  function blendM(A, Bm, k, out) {
    A.decompose(_bmP, _bmQ, _bmS); Bm.decompose(_bmP2, _bmQ2, _bmS);
    _bmP.lerp(_bmP2, k); _bmQ.slerp(_bmQ2, k);
    return out.compose(_bmP, _bmQ, _ONE);
  }

  /* ---------- Отдача: каждый выстрел очереди по расписанию TR3.shotFx (u._burst: t0, n, gap — как звук) ----------
     Класс ствола задаёт характер: kick — толчок назад (м), rise — подброс ствола (°), climb — увод вверх, копится за
     очередь и уходит после неё (°), yaw — разброс вбок (°), body — плечи назад (°), sway — пулемётчика раскачивает (°),
     head — голова уходит с прицела и возвращается (°), tk — возврат после толчка (мс), tc — возврат увода (мс).
     Сила — ещё и по «отдаче» ствола из Мастерской оружия (WT fire.kick). */
  const RECOIL = {
    smg: { kick: 0.022, rise: 1.6, climb: 1.1, yaw: 0.9, body: 1.0, sway: 0, tk: 45, tc: 200, head: 1 },
    rifle: { kick: 0.035, rise: 2.6, climb: 1.4, yaw: 0.8, body: 1.8, sway: 0, tk: 60, tc: 260, head: 2 },
    lmg: { kick: 0.03, rise: 2.2, climb: 0.9, yaw: 1.4, body: 2.4, sway: 2.2, tk: 70, tc: 320, head: 1.5 },
    sniper: { kick: 0.065, rise: 8, climb: 0, yaw: 0.6, body: 5.5, sway: 0, tk: 115, tc: 450, head: 7 },
    shotgun: { kick: 0.09, rise: 13, climb: 0, yaw: 1.5, body: 8.5, sway: 0, tk: 125, tc: 480, head: 6 },
    pistol: { kick: 0.028, rise: 12, climb: 2, yaw: 1, body: 1, sway: 0, tk: 70, tc: 240, head: 1 },
    rpg: { kick: 0.07, rise: 3.5, climb: 0, yaw: 0, body: 6, sway: 0, tk: 170, tc: 500, head: 3 }
  };
  const WCLS = { ppsh: 'smg', vityaz: 'smg', ak: 'rifle', ak2: 'rifle', ak74m: 'rifle', val: 'rifle', lmg: 'lmg', pkp: 'lmg', hlmg: 'lmg', sniper: 'sniper', vss: 'sniper', hsniper: 'sniper', shotgun: 'shotgun', obrez: 'shotgun', gsh18: 'pistol', tt: 'pistol', rpg: 'rpg' };
  const KREF = { smg: 1.2, rifle: 2, lmg: 1.6, sniper: 3, shotgun: 3.4, pistol: 1, rpg: 1 };
  const wcls = function (id) { return WCLS[id] || 'rifle'; };
  function kickMul(id, cl) { const F = DW.WT && DW.WT.has(id) ? DW.WT.get(id).fire : null; return F && F.kick ? U.clamp(F.kick / KREF[cl], 0.5, 1.6) : 1; }
  const hash2 = function (a, b) { const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return s - Math.floor(s); };
  const pulse = function (a, tk) { return a < 0 ? 0 : (a < 12 ? a / 12 : Math.exp(-(a - 12) / tk)); };
  const bump = function (x) { return x <= 0 || x >= 1 ? 0 : Math.sin(x * Math.PI); };
  const REC = { back: 0, up: 0, yaw: 0, body: 0, sway: 0, head: 0, pump: 0, brk: 0, on: 0 };
  function recoilEval(e, u, t) {
    const R = REC;
    R.back = R.up = R.yaw = R.body = R.sway = R.head = R.pump = R.brk = 0; R.on = 0;
    const b = u._burst;
    if (!b || t < b.t0) return R;
    const sp = SPD(), last = b.t0 + (b.n - 1) * b.gap;
    if ((t - last) * sp > 1300) return R;
    const cl = b.rpg ? 'rpg' : wcls(b.wid), C = RECOIL[cl];
    if (b.km === undefined) b.km = kickMul(b.wid, cl);
    let climb = 0;
    for (let i = 0; i < b.n; i++) {
      const ti = b.t0 + i * b.gap;
      if (t < ti) break;
      const a = (t - ti) * sp;
      const p1 = pulse(a, C.tk), p2 = pulse(a, C.tk * 1.6);
      R.back += C.kick * p1;
      R.up += C.rise * p2;
      climb += C.climb * Math.exp(-a / C.tc);
      R.yaw += (hash2(u.id || 0, i + b.t0 * 0.001) - 0.5) * 2 * C.yaw * p2;
      R.body += C.body * pulse(a, C.tk * 2.2);
      R.head += C.head * pulse(a, C.tk * 2.6);
      // дробовик: после выстрела — помпа (левая назад-вперёд); обрез — переломить после последнего
      if (b.wid === 'shotgun') R.pump = Math.max(R.pump, bump((a - 300) / 380));
    }
    if (b.wid === 'obrez') R.brk = bump(((t - last) * sp - 330) / 760);
    if (C.sway) {
      const a = (t - b.t0) * sp, env = Math.min(1, a / 60) * Math.max(0, 1 - Math.max(0, (t - last) * sp - 60) / 300);
      R.sway = C.sway * Math.sin(a / 150 * Math.PI) * env;
    }
    const km = b.km, D2 = DG;
    R.back = Math.min(R.back, C.kick * 1.7) * km;
    R.up = (R.up + Math.min(climb, C.climb * 4)) * km * D2;
    R.yaw *= km * D2; R.body *= km * D2; R.sway *= km * D2; R.head *= km * D2;
    R.on = 1;
    return R;
  }
  /* ствол: поворот вокруг приклада (упор в плечо) вверх и вбок, толчок назад по стволу; обрез — переломить
     (стволы вниз вокруг шарнира перед спуском). Точки кистей идут вместе с оружием */
  const _rcB = V(), _rcX = V(), _rcZ = V(), _rcQ = new THREE.Quaternion(), _rcQ2 = new THREE.Quaternion(), _rcM = new THREE.Matrix4(), _rcT = new THREE.Matrix4();
  function rotAbout(M, pv, q, back, z) {
    _rcM.makeRotationFromQuaternion(q);
    _rcT.makeTranslation(-pv.x, -pv.y, -pv.z); _rcM.multiply(_rcT);
    _rcT.makeTranslation(pv.x + z.x * back, pv.y + z.y * back, pv.z + z.z * back); _rcM.premultiply(_rcT);
    return _rcM;
  }
  function applyRecoil(M, grip, fore, W, R) {
    _rcX.setFromMatrixColumn(M, 0).normalize(); _rcZ.setFromMatrixColumn(M, 2).normalize();
    if (R.up || R.yaw || R.back) {
      const pv = _rcB.set(0, W.buttY || 0.03, W.buttZ || 0.1).applyMatrix4(M);
      _rcQ.setFromAxisAngle(_rcX, R.up); _rcQ2.setFromAxisAngle(UP, R.yaw); _rcQ.premultiply(_rcQ2);
      const Mr = rotAbout(M, pv, _rcQ, R.back, _rcZ);
      M.premultiply(Mr); if (grip) grip.applyMatrix4(Mr); if (fore) fore.applyMatrix4(Mr);
    }
    if (R.brk > 0) {
      const pv = _rcB.set(0, 0.02, -0.07).applyMatrix4(M);
      _rcQ.setFromAxisAngle(_rcX, -0.62 * smo(R.brk));
      const Mr = rotAbout(M, pv, _rcQ, 0, _rcZ);
      M.premultiply(Mr); if (fore) fore.applyMatrix4(Mr);
    }
  }
  /* корпус: плечи назад (по оси «вправо» корпуса), пулемётчика раскачивает вокруг вертикали */
  const _brQ = new THREE.Quaternion(), _brX = V();
  function bodyRecoil(e, R) {
    const B = e.body.B;
    if (!B.Spine1 || !B.Spine2) return;
    const Tq = torso(B, e.tq || (e.tq = mkTorso()));
    if (R.body) { _brX.copy(Tq.X); _brQ.setFromAxisAngle(_brX, R.body * 0.5); rotWorld(B.Spine1, _brQ); rotWorld(B.Spine2, _brQ); }
    if (R.sway && B.Spine) { _brQ.setFromAxisAngle(UP, R.sway); rotWorld(B.Spine, _brQ); }
  }

  /* ---------- Голова к прицелу ----------
     глаз (правый, прицельный) — в осях кости головы по позе покоя; цель — линия прицела над стволом: шея ведёт глаз к ней,
     голова смотрит вдоль ствола. Пистолет — на вытянутых руках (глаз далеко за рукоятью), РПГ — прицел слева от трубы */
  const SIGHT = { aim: [0, 0.085, -0.17], hip: [0, 0.2, -0.05], pistol: [0, 0.05, 0.5], pistol1: [0, 0.07, 0.62], rpg: [-0.085, 0.06, 0.06] };
  const _shE = V(), _shT = V(), _shN = V(), _shF = V(), _shD = V(), _shQ = new THREE.Quaternion(), _shQ2 = new THREE.Quaternion(), _shI = new THREE.Quaternion();
  function eyeSetup(body) {
    const r = body.rest.Head, s = body.H / 1.8;
    const inv = r.wq.clone().invert();
    // боец в покое смотрит на +Z, его правая сторона — −X
    body.eyeL = V(-0.032 * s, 0.05 * s, 0.09 * s).applyQuaternion(inv);
    body.fwdL = V(0, 0, 1).applyQuaternion(inv);
    body.upL = V(0, 1, 0).applyQuaternion(inv);
  }
  function limitQ(q, max) {
    const w = Math.min(1, Math.abs(q.w)), ang = 2 * Math.acos(w);
    if (ang > max) q.slerp(_shI.identity(), 1 - max / ang);
    return q;
  }
  // шея: глаз — к точке P (не больше max), с весом w (матрицы свежие — без пересчёта родителей)
  function neckTo(body, P, w, max) {
    const B = body.B, pN = _shN.setFromMatrixPosition(B.Neck.matrixWorld);
    B.Head.matrixWorld.decompose(_shD, _shQ2, _shE);
    const eye = _shE.copy(body.eyeL).applyQuaternion(_shQ2).add(_shD);
    _shD.subVectors(eye, pN); _shF.subVectors(P, pN);
    if (_shD.lengthSq() < 1e-6 || _shF.lengthSq() < 1e-6) return;
    _shD.normalize(); _shF.normalize();
    _shQ.setFromUnitVectors(_shD, _shF); limitQ(_shQ, max);
    _shQ2.identity().slerp(_shQ, w);
    rotWorld(B.Neck, _shQ2);
  }
  function sightHead(e, M, W, w, grp, R) {
    const body = e.body, B = body.B;
    if (!B.Head || !B.Neck || grp === 'hip') return;
    if (!body.eyeL) eyeSetup(body);
    const S = SIGHT[grp] || SIGHT.aim;
    // прицельная линия: у винтовок — над стволом в 17 см перед прикладом; высота — по дульному срезу модели
    if (grp === 'aim') _shT.set(0, W.muzzle.y + S[1], (W.buttZ || 0.3) + S[2]);
    else _shT.set(S[0], W.muzzle.y + S[1], S[2]);
    _shT.applyMatrix4(M);
    // шея: голову — вперёд-вниз, щекой к прикладу (умеренно: сильный изгиб шеи рвёт воротник у моделей)
    neckTo(body, _shT, w * 0.92, 30 * DG);
    // голова: взгляд вдоль ствола, но чуть опущена (глаз смотрит через прицел исподлобья) и наклонена к прикладу
    headAim(body, M, w, grp, R);
  }
  // голова: взгляд — вдоль ствола на 12° ниже, наклон к прикладу; на выстреле снайперки/дробовика голову подбрасывает.
  // Поворот взгляда и наклон — одним поворотом кости
  const _haQ = new THREE.Quaternion(), _haU = V();
  function headAim(body, M, w, grp, R) {
    const B = body.B;
    _shN.setFromMatrixColumn(M, 0).normalize();
    _shF.set(0, 0, -1).transformDirection(M).applyAxisAngle(_shN, -12 * DG + (R ? R.head : 0));
    B.Head.matrixWorld.decompose(_shE, _shQ2, _shD);
    _shD.copy(body.fwdL).applyQuaternion(_shQ2);
    _shQ.setFromUnitVectors(_shD, _shF); limitQ(_shQ, 50 * DG);
    // «верх» головы после поворота взгляда → к вертикали, наклонённой на cant вокруг взгляда
    _shD.copy(body.upL).applyQuaternion(_shQ2).applyQuaternion(_shQ);
    _haU.copy(UP).applyAxisAngle(_shF, (grp === 'rpg' ? -5 : 8) * DG);
    _shD.addScaledVector(_shF, -_shD.dot(_shF)); _haU.addScaledVector(_shF, -_haU.dot(_shF));
    if (_shD.lengthSq() > 1e-6 && _haU.lengthSq() > 1e-6) {
      _shD.normalize(); _haU.normalize();
      _haQ.setFromUnitVectors(_shD, _haU); limitQ(_haQ, 25 * DG);
      _shQ.premultiply(_haQ);
    }
    _shQ2.identity().slerp(_shQ, w);
    rotWorld(B.Head, _shQ2);
  }

  /* ---------- Попадание: вздрагивание от выстрела ----------
     направление — от стрелка (u._shotBy, TR3.shotFx) или рывка/взрыва (mfx.hitDir); сила — по урону и стволу:
     дробь и снайперка сильнее, пистолет слабее. Пока летят пули очереди — мелкие толчки на каждое попадание */
  const FLK = { smg: 0.85, rifle: 1, lmg: 1.05, sniper: 1.35, shotgun: 1.5, pistol: 0.75, rpg: 1.3 };
  const flk = function (a) { return a <= 0 ? 0 : Math.min(1, a / 35) * Math.exp(-Math.max(0, a - 35) / 170); };
  const FL = { k: 0, x: 0, z: 0, tw: 0 };
  function shotSrc(u, t) {
    const sb = u._shotBy;
    return sb && t - sb.t0 < 4000 && t >= sb.t0 - 400 ? sb : null;
  }
  // откуда удар: стрелок → цель (мир xz); нет — от груди назад
  function hitVec(u, t, out) {
    const sb = shotSrc(u, t);
    let x = 0, z = 0;
    if (sb && sb.att) { x = u.x - sb.att.x; z = u.y - sb.att.y; }
    if (x * x + z * z < 1e-4) { const d = R3.mfx && R3.mfx.hitDir ? R3.mfx.hitDir(u) : null; if (d) { x = d.x; z = d.z; } }
    if (x * x + z * z < 1e-4) { x = -Math.cos(u.face || 0); z = -Math.sin(u.face || 0); }
    const l = Math.hypot(x, z);
    out.x = x / l; out.z = z / l;
    return out;
  }
  const _fv = { x: 0, z: 0 };
  function flinchState(e, u, t) {
    const an = TR2().curAnimOf(u);
    if (an && an.kind === 'hit' && an.a !== e.flA) {
      e.flA = an.a;
      const sb = shotSrc(u, t), d = hitVec(u, t, _fv);
      const dmg = sb && sb.hp0 !== undefined ? Math.max(1, sb.hp0 - u.hp) : 2;
      const cl = sb && sb.W ? wcls(sb.W.id) : 'rifle';
      const fwx = Math.cos(u.face || 0), fwz = Math.sin(u.face || 0);
      e.fl = { t0: an.a.t0, x: d.x, z: d.z, s: U.clamp(0.5 + dmg / Math.max(4, u.maxHp || 8) * 1.8, 0.5, 1.2) * (FLK[cl] || 1), tw: fwx * d.z - fwz * d.x };
    }
    const sp = SPD();
    let k = 0;
    if (e.fl) { const a = (t - e.fl.t0) * sp; if (a > 900) e.fl = null; else { k = e.fl.s * flk(a); FL.x = e.fl.x; FL.z = e.fl.z; FL.tw = e.fl.tw; } }
    // пули очереди: толчок на каждое попадание (когда долетела)
    const sb = u._shotBy;
    if (sb && sb.hits && !sb.sup && t >= sb.t0 && (t - sb.t0) * sp < sb.n * sb.gap * sp + 700) {
      let j = 0;
      for (let i = 0; i < sb.n; i++) { if (!sb.hits[i]) continue; const a = (t - sb.t0 - i * sb.gap - sb.fly) * sp; if (a > 0 && a < 700) j += flk(a); }
      if (j > 0) {
        if (!e.fl) { hitVec(u, t, _fv); FL.x = _fv.x; FL.z = _fv.z; FL.tw = 0; }
        k += Math.min(1, j) * 0.4 * (FLK[sb.W ? wcls(sb.W.id) : 'rifle'] || 1);
      }
    }
    if (k < 0.01) return null;
    FL.k = Math.min(1.5, k);
    return FL;
  }
  const _flA = V(), _flQ = new THREE.Quaternion(), _flQ2 = new THREE.Quaternion();
  const FLB = ['Spine', 'Spine1', 'Spine2', 'Neck', 'Head'], FLW = [0.22, 0.22, 0.2, 0.1, 0.26];
  function flinchApply(e, F) {
    const B = e.body.B;
    // ось: перпендикуляр к направлению удара — верх корпуса уходит от стрелка; сбоку — ещё и разворот
    _flA.set(F.z, 0, -F.x);
    const a = 24 * DG * F.k, tw = -12 * DG * F.k * F.tw;   // грудь отворачивается от стрелка
    for (let i = 0; i < FLB.length; i++) {
      const b = B[FLB[i]];
      if (!b) continue;
      _flQ.setFromAxisAngle(_flA, a * FLW[i]);
      if (i < 3 && tw) _flQ.premultiply(_flQ2.setFromAxisAngle(UP, tw / 3));
      rotWorld(b, _flQ);
    }
  }
  /* баллистический щит: лицом вперёд (по груди), у левого предплечья; убит — щит лежит на земле */
  const _sf = V(), _sr = V(), _sp = V();
  function placeShield(e, u) {
    const S = e.shield, B = e.body.B;
    const Tq = torso(B);
    _sf.copy(Tq.Z).setY(0).normalize();
    const m = S.g.matrix;
    if (u.alive && B.LeftForeArm && B.LeftHand) {
      _sp.copy(B.LeftForeArm.getWorldPosition(V())).lerp(B.LeftHand.getWorldPosition(V()), 0.55).addScaledVector(_sf, 0.16);
      _sp.y = Math.max(_sp.y, e.body.holder.position.y + 0.95);
      _sr.crossVectors(_sf, UP).normalize();
      m.makeBasis(_sf, UP, _sr);
    } else {
      _sp.copy(e.body.holder.position).addScaledVector(_sf, 0.7); _sp.y += 0.04;
      _sr.crossVectors(UP, _sf).normalize();
      m.makeBasis(UP, _sf.clone().negate(), _sr.clone().negate());
    }
    m.setPosition(_sp);
    S.g.matrixWorldNeedsUpdate = true;
    S.g.visible = e.body.holder.visible;
  }
  /* калибровка «в кисти»: переноска, затем запомнить положение ствола относительно кистей */
  function calibrate(e, W) {
    const keep = { q: Float32Array.from(e.pose.q), hp: e.pose.hp.clone() };
    const rot = e.body.holder.rotation.y;
    const tmp = { q: new Float32Array(e.pose.q.length), hp: V() };
    samplePose('idle', 0.3, tmp);
    applyPose(e.body, tmp);
    const Tq = torso(e.body.B);
    const M = gunMatrix(Tq, W, GRIP.carry, e.body.holder.position.y);
    if (!W.free && refAK) {
      const MA = gunMatrix(Tq, refAK, GRIP.carry, e.body.holder.position.y);
      M.setPosition(V().setFromMatrixPosition(MA).addScaledVector(V(0, 0, -1).transformDirection(M), Math.max(0, W.buttZ - refAK.buttZ)));
      handsTo(e.body, V().setFromMatrixPosition(MA), refAK.fore.clone().applyMatrix4(MA), false);
      if (R3.grip && R3.grip.apply) R3.grip.apply({ body: e.body, W: W, M: M, mode: 'carry', grip: V().setFromMatrixPosition(MA), fore: refAK.fore.clone().applyMatrix4(MA), key: 'idle', freeL: false, reload: false, calib: true });
    }
    const rel = function (bone) { return new THREE.Matrix4().compose(bone.getWorldPosition(V()), bone.getWorldQuaternion(new THREE.Quaternion()), V(1, 1, 1)).invert().multiply(M); };
    e.cal = { w: W, offR: rel(e.body.B.RightHand), offL: rel(e.body.B.LeftHand) };
    e.body.holder.rotation.y = rot;
    applyPose(e.body, keep);
  }

  /* ---------- Гибель людей: падение от выстрела, ствол на земле, лужа крови, тело замирает ----------
     Вариант — по тому, откуда и чем убит: в спину — лицом вперёд (die3 с середины), сбоку — разворот и на бок (die2 с
     поворотом), в лицо — подкосились колени (die3 → die2), навзничь (die) или с разворотом (die2); дробь в упор,
     крупный калибр, большой перебор урона и взрыв — отбрасывает (die быстрее, с полётом). Падает от стрелка, но в
     свободную сторону: не в стену, ящик, машину, не с обрыва, не на другое тело. Конечная поза меряется заранее —
     тело ложится на грунт (марш лестницы — наклоном), ни одна кость не уходит под землю. Потом тело замирает: ни поз,
     ни матриц в кадре (дёшево). Тяжело раненый боец (u.down) лежит, но живой: дышит, ворочается, держится за рану. */
  // сегменты: [движение, с какого места (с), по какое (с), темп]; rel — когда выпадает ствол (мс), launch — бросок
  const DVAR = {
    crumple: { seg: [['die3', 0.05, 1.15, 1.05], ['die2', 0.95, 1.8, 1.0]], rel: 380 },
    back: { seg: [['die', 0, 2.2, 1.3]], rel: 240 },
    twist: { seg: [['die2', 0, 1.8, 1.15]], rel: 280 },
    thrown: { seg: [['die', 0.22, 2.2, 1.7]], rel: 30, launch: 1 },
    forward: { seg: [['die3', 0.32, 2.958, 1.35]], rel: 200 },
    thrownF: { seg: [['die3', 0.6, 2.958, 1.55]], rel: 30, launch: 1 },
    spin: { seg: [['die2', 0, 1.8, 1.05]], rel: 260, spin: 1 }
  };
  const XFADE = 260;   // переход между сегментами, мс
  // толщина тела у суставов (м при росте 1,8): кость не ближе к грунту
  const BRAD = { Hips: 0.11, Spine: 0.11, Spine1: 0.12, Spine2: 0.12, Neck: 0.07, Head: 0.1, LeftShoulder: 0.07, RightShoulder: 0.07, LeftArm: 0.06, RightArm: 0.06, LeftForeArm: 0.045, RightForeArm: 0.045, LeftHand: 0.03, RightHand: 0.03, LeftUpLeg: 0.09, RightUpLeg: 0.09, LeftLeg: 0.06, RightLeg: 0.06, LeftFoot: 0.045, RightFoot: 0.045, LeftToeBase: 0.025, RightToeBase: 0.025 };
  const LIFT = ['Head', 'Spine2', 'Hips', 'LeftHand', 'RightHand', 'LeftFoot', 'RightFoot', 'LeftLeg', 'RightLeg', 'LeftForeArm', 'RightForeArm'];
  /* грунт под точкой мира: высота клетки; марш лестницы — наклонная плоскость от наружного края к верхней клетке */
  function groundY(X, Z) {
    const B = DW.BT.get();
    if (!B || !B.hgt) return 0;
    const fx = X / T, fz = Z / T;
    const x = Math.max(0, Math.min(B.w - 1, Math.floor(fx))), y = Math.max(0, Math.min(B.h - 1, Math.floor(fz))), i = y * B.w + x;
    const st = DW.BT.stairAt ? DW.BT.stairAt(i) : null;
    if (st) {
      const hx = st.hi % B.w, hy = (st.hi - hx) / B.w;
      const s = (fx - x - 0.5) * (hx - x) + (fz - y - 0.5) * (hy - y);
      return (B.hgt[i] + (B.hgt[st.hi] - B.hgt[i]) * Math.max(0, Math.min(1, s + 0.5))) * LV + 0.02;
    }
    return B.hgt[i] * LV;
  }
  UN.groundY = groundY;
  // где уже лежат тела (клетка → id): падать на другого не надо
  let lieOcc = {};
  /* насколько плохо лечь телом в точку: стена/машина/обрыв вверх — очень, ящик/мешки — плохо, обрыв вниз — плохо,
     другое тело или живой — немного */
  function lieCost(B, X, Z, lvl, self) {
    const x = Math.floor(X / T), y = Math.floor(Z / T);
    if (x < 0 || y < 0 || x >= B.w || y >= B.h) return 9;
    const i = y * B.w + x;
    let c = 0;
    const o = B.obj[i];
    if (o) c += D.OBJ[o] && D.OBJ[o].cover === 2 ? 9 : 5;
    if (DW.BT.stairAt && DW.BT.stairAt(i)) c += 1.2;
    else {
      const h = B.hgt[i];
      if (h > lvl + 0.3) c += 9; else if (h < lvl - 0.3) c += 4.5;
    }
    if (lieOcc[i] !== undefined && lieOcc[i] !== self) c += 2.5;
    for (let k = 0; k < B.units.length; k++) { const o2 = B.units[k]; if (o2.alive && !o2.evac && o2.x === x && o2.y === y && o2.id !== self) { c += 2; break; } }
    return c;
  }
  // от чего погиб: направление удара (мир xz, от стрелка к цели), сила, чем
  function deathCause(u, t) {
    const sb = shotSrc(u, t), d = hitVec(u, t, { x: 0, z: 0 });
    const out = { x: d.x, z: d.z, strong: false, blast: -1, cls: sb && sb.W ? wcls(sb.W.id) : (sb && sb.melee ? 'melee' : 'rifle'), wid: sb && sb.W ? sb.W.id : '' };
    const bl = R3.lastBlast || (R3.mfx && R3.mfx.lastBlast);
    if (bl && t - bl.t < 1200) {
      const dd = Math.hypot(u.x - bl.x, u.y - bl.y);
      if (dd <= (bl.r || 1.5) + 1.2) {
        out.blast = dd;
        if (dd > 0.2) { out.x = (u.x - bl.x) / dd; out.z = (u.y - bl.y) / dd; }
        else { const a = hash2(u.id || 0, 7) * Math.PI * 2; out.x = Math.cos(a); out.z = Math.sin(a); }
        out.strong = true;
        return out;
      }
    }
    if (sb && sb.att) {
      const dist = Math.hypot(u.x - sb.att.x, u.y - sb.att.y);
      const W = sb.W, over = W && W.dmg ? (W.dmg[1] - (sb.hp0 || 0)) / W.dmg[1] : 0;
      out.strong = (out.cls === 'shotgun' && dist <= 4.5) || out.wid === 'hsniper' || out.wid === 'hlmg' || over > 0.45;
    }
    return out;
  }
  function deathVariant(u, c, side, cause, seed) {
    if (cause.strong) return c > 0.5 ? 'thrownF' : (Math.abs(c) <= 0.5 && seed < 0.5 ? 'spin' : 'thrown');
    if (c > 0.45) return 'forward';
    if (c > -0.45) return 'spin';
    return seed < 0.4 ? 'crumple' : (seed < 0.7 ? 'back' : 'twist');
  }
  // поза в конце сегмента (оси бойца): куда легла голова от таза — направление падения движения
  const fallDirCache = {};
  function clipFall(e, key, tEnd) {
    const ck = key + '@' + tEnd;
    if (fallDirCache[ck]) return fallDirCache[ck];
    const H = e.body.holder, keepP = _dkP.copy(H.position), keepQ = _dkQ.copy(H.quaternion);
    H.position.set(0, 0, 0); H.quaternion.identity();
    samplePose(key, tEnd, e.dkPose); applyPose(e.body, e.dkPose);
    const hd = e.body.B.Head.getWorldPosition(V()), hp = e.body.B.Hips.getWorldPosition(V());
    H.position.copy(keepP); H.quaternion.copy(keepQ);
    let x = hd.x - hp.x, z = hd.z - hp.z; const l = Math.hypot(x, z) || 1;
    return (fallDirCache[ck] = { x: x / l, z: z / l });
  }
  const _dkP = V(), _dkQ = new THREE.Quaternion(), _dv = V(), _dv2 = V(), _dv3 = V(), _dq = new THREE.Quaternion(), _dq2 = new THREE.Quaternion();
  const wrapA = function (a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
  function deathInit(e, u, t) {
    const tr = TR2(), an = tr.curAnimOf(u), body = e.body, H = body.holder, B = DW.BT.get();
    const live = !!(an && an.kind === 'die' && an.p < 1);
    if (!e.dkPose) e.dkPose = { q: new Float32Array(e.pose.q.length), hp: V() };
    const cause = deathCause(u, t);
    // лицом куда (держатель: +Z бойца → мир)
    const ry0 = e.key ? H.rotation.y : Math.PI / 2 - (u.face || 0);
    const fx = Math.sin(ry0), fz = Math.cos(ry0);
    const c = fx * cause.x + fz * cause.z, side = fx * cause.z - fz * cause.x;
    const seed = hash2(u.id || 0, Math.floor(t / 997));
    let vk = deathVariant(u, c, side, cause, seed);
    if (!UN.has('die3') && /crumple|forward|thrownF/.test(vk)) vk = 'back';
    if (!UN.has('die2') && /twist|spin|crumple/.test(vk)) vk = 'back';
    const V0 = DVAR[vk], sp = SPD();
    const segs = V0.seg.filter(function (s) { return UN.has(s[0]); }).map(function (s) { const c2 = libClip(s[0]); return { k: s[0], a: Math.min(s[1], c2.dur), b: Math.min(s[2], c2.dur), v: s[3] }; });
    let tt = 0;
    segs.forEach(function (s, i) { s.t0 = tt; s.d = (s.b - s.a) / s.v * 1000; tt += s.d - (i < segs.length - 1 ? XFADE : 0); });
    const dur = tt;
    const last = segs[segs.length - 1];
    const lf = clipFall(e, last.k, last.b);
    // клетка и уровень; бросок
    const P0 = V((u.x + 0.5) * T, 0, (u.y + 0.5) * T), lvl = B.hgt[u.y * B.w + u.x];
    P0.y = groundY(P0.x, P0.z);
    let L = 0;
    if (V0.launch) L = cause.blast >= 0 ? U.clamp(1.5 - cause.blast * 0.35, 0.6, 1.5) : 0.75;
    // куда лечь: от удара, в свободную сторону (16 направлений, отклонение — дороже); лучшие — проверить конечной
    // позой: ни одна кость не в стене/предмете, не на террасе выше, не над обрывом, тело не поднято над грунтом
    const a0 = Math.atan2(cause.z, cause.x), cands = [];
    for (let k = 0; k < 16; k++) {
      const off = (k % 2 ? -1 : 1) * Math.ceil(k / 2) * Math.PI / 8;
      const a = a0 + off, cx = Math.cos(a), cz = Math.sin(a);
      for (let li = 0; li < (L > 0 ? 3 : 1); li++) {
        const l = L * [1, 0.5, 0][li];
        let sc = Math.abs(off) * 1.3 + (L - l) * 1.5;
        sc += lieCost(B, P0.x + cx * (0.6 + l), P0.z + cz * (0.6 + l), lvl, u.id);
        sc += lieCost(B, P0.x + cx * (1.25 + l), P0.z + cz * (1.25 + l), lvl, u.id);
        sc += lieCost(B, P0.x - cx * (0.7 - l * 0.5), P0.z - cz * (0.7 - l * 0.5), lvl, u.id) * 0.6;
        sc += (lieCost(B, P0.x - cz * 0.55 + cx * 0.4, P0.z + cx * 0.55 + cz * 0.4, lvl, u.id) + lieCost(B, P0.x + cz * 0.55 + cx * 0.4, P0.z - cx * 0.55 + cz * 0.4, lvl, u.id)) * 0.25;
        cands.push({ a: a, l: l, s: sc });
      }
    }
    cands.sort(function (p, q2) { return p.s - q2.s; });
    const D0 = e.dth = {
      vk: vk, segs: segs, dur: dur, t0: live ? an.a.t0 : t - 1e7, sp: sp, cause: cause, uid: u.id, ix0: u.y * B.w + u.x,
      p0: e.lp && e.key ? e.lp.clone() : P0.clone(), pT: P0, ry0: ry0, ry1: ry0, dx: 1, dz: 0, L: 0, lvl: lvl,
      spinD: (V0.spin ? 0.55 : 0.4) * dur, launchD: Math.min(420, dur * 0.35),
      rel: V0.rel, imp: dur * 0.5, fromQ: null, wd: null, sd: null, events: 0,
      down: u.kind === 'soldier' && u.down > 0
    };
    let pick = null, pickS = 1e9;
    for (let k = 0; k < Math.min(6, cands.length); k++) {
      const C = cands[k];
      D0.dx = Math.cos(C.a); D0.dz = Math.sin(C.a); D0.L = C.l;
      // разворот: направление падения движения (оси бойца) → выбранное направление
      D0.ry1 = ry0 + wrapA(Math.atan2(D0.dx, D0.dz) - Math.atan2(lf.x, lf.z) - ry0);
      deathSettle(e, D0);
      const ok = D0.bad < 0.5 && D0.dy < 0.25 && D0.dy > -0.35;
      const sc = C.s * 0.25 + D0.bad * 2 + Math.max(0, D0.dy - 0.1) * 6 + Math.max(0, -0.3 - D0.dy) * 3;
      if (sc < pickS) { pickS = sc; pick = { a: C.a, l: C.l, ry1: D0.ry1 }; }
      if (ok) break;
    }
    D0.dx = Math.cos(pick.a); D0.dz = Math.sin(pick.a); D0.L = pick.l; D0.ry1 = pick.ry1;
    deathSettle(e, D0);
    const dx = D0.dx, dz = D0.dz;
    // откуда начинается падение: текущая поза (плавный переход), тело с начала боя — сразу лежит
    if (live && e.key) { D0.fromQ = { q: Float32Array.from(e.pose.q), hp: e.pose.hp.clone() }; }
    // когда тело касается земли: таз ниже 0,35 м в последнем сегменте
    const lc = libClip(last.k);
    if (lc && lc.hp && lc.n > 1) {
      for (let f = 0; f < lc.n; f++) {
        const tf = f / (lc.n - 1) * lc.dur;
        if (tf < last.a) continue;
        if (lc.hp[f * 3 + 1] * body.hipK + body.rest.Hips.wp.y < 0.38) { D0.imp = last.t0 + (tf - last.a) / last.v * 1000; break; }
      }
    }
    // занятые телом клетки
    const ix = function (X, Z) { return Math.floor(Z / T) * B.w + Math.floor(X / T); };
    D0.occ = [ix(D0.p1.x, D0.p1.z), ix(D0.p1.x + dx * 1.0, D0.p1.z + dz * 1.0), ix(D0.p1.x - dx * 0.6, D0.p1.z - dz * 0.6)];
    D0.occ.forEach(function (i) { lieOcc[i] = u.id; });
    // щит (СОБР) — падает перед телом
    if (e.shield) { D0.sd = mkDrop(e.shield.g.matrix, _dv.set(fx * 0.8, 0.5, fz * 0.8), D0.t0 + 150, D0, true, e); D0.sd.instant = !live; }
  }
  /* конечная поза в конечном месте: наклон по грунту (голова/ноги на разной высоте), подъём над грунтом */
  function deathSettle(e, D0) {
    const body = e.body, H = body.holder, B = body.B, s = body.H / 1.8;
    const keepP = _dkP.copy(H.position), keepQ = _dkQ.copy(H.quaternion);
    D0.p1 = D0.pT.clone().add(V(D0.dx * D0.L, 0, D0.dz * D0.L));
    const last = D0.segs[D0.segs.length - 1];
    samplePose(last.k, last.b, e.dkPose);
    D0.q1 = new THREE.Quaternion().setFromAxisAngle(UP, D0.ry1);
    D0.tilt = null; D0.dy = 0;
    for (let pass = 0; pass < 2; pass++) {
      H.position.copy(D0.p1); H.quaternion.copy(D0.q1);
      if (D0.tilt) H.quaternion.premultiply(D0.tilt);
      applyPose(body, e.dkPose);
      if (pass === 0) {
        // наклон: высота грунта под головой и под ступнями
        const hd = B.Head.getWorldPosition(_dv), ft = B.LeftFoot.getWorldPosition(_dv2).add(B.RightFoot.getWorldPosition(_dv3)).multiplyScalar(0.5);
        const gh = groundY(hd.x, hd.z), gf = groundY(ft.x, ft.z), dist = Math.hypot(hd.x - ft.x, hd.z - ft.z);
        if (Math.abs(gh - gf) > 0.05 && dist > 0.3) {
          const ang = U.clamp(Math.atan2(gh - gf, dist), -0.6, 0.6);
          const ax = V(hd.x - ft.x, 0, hd.z - ft.z).normalize();
          D0.tilt = new THREE.Quaternion().setFromAxisAngle(V().crossVectors(UP, ax).normalize(), -ang);
          continue;
        }
      }
      // подъём: каждая кость — не ниже грунта на свою толщину (опускаем, если тело висит в воздухе);
      // плохие кости: в предмете или стене, над террасой выше или над обрывом (марш лестницы — можно)
      let dy = -1e9, bad = 0;
      const Bt = DW.BT.get(), lv = D0.lvl * LV, own = D0.ix0;
      for (const k in BRAD) {
        const b = B[k]; if (!b) continue;
        b.getWorldPosition(_dv);
        const g = groundY(_dv.x, _dv.z);
        dy = Math.max(dy, g + BRAD[k] * s - _dv.y);
        const x = Math.floor(_dv.x / T), y = Math.floor(_dv.z / T), i = y * Bt.w + x;
        if (x < 0 || y < 0 || x >= Bt.w || y >= Bt.h) { bad += 2; continue; }
        if (i !== own && Bt.obj[i]) bad += D.OBJ[Bt.obj[i]] && D.OBJ[Bt.obj[i]].cover === 2 ? 2 : 1;
        if (!(DW.BT.stairAt && DW.BT.stairAt(i)) && Math.abs(g - lv) > 0.4) bad += g > lv ? 2 : 1;
        if (lieOcc[i] !== undefined && lieOcc[i] !== D0.uid) bad += 0.25;
      }
      D0.dy = dy > -1e8 ? U.clamp(dy, -0.4, 1.6) : 0;
      D0.bad = bad;
      break;
    }
    // грудь на земле — сюда лужа крови
    const ch = (B.Spine1 || B.Hips).getWorldPosition(V());
    D0.pool = V(ch.x, 0, ch.z); D0.pool.y = groundY(ch.x, ch.z);
    H.position.copy(keepP); H.quaternion.copy(keepQ);
    D0.endQ = null;
  }
  /* поза падения в момент tau (мс): сегменты с переходом */
  function deathPose(D0, tau, out) {
    const S = D0.segs;
    let i = S.length - 1;
    while (i > 0 && tau < S[i].t0) i--;
    const s = S[i];
    samplePose(s.k, Math.min(s.b, s.a + Math.max(0, tau - s.t0) / 1000 * s.v), out);
    if (i < S.length - 1) {
      const n = S[i + 1], x = (tau - n.t0) / XFADE;
      if (x > 0) {
        const tmp = D0.tmpP || (D0.tmpP = { q: new Float32Array(out.q.length), hp: V() });
        samplePose(n.k, n.a + Math.max(0, tau - n.t0) / 1000 * n.v, tmp);
        blendPose(out, tmp, smo(x), out);
      }
    }
    return out;
  }
  const _dM = new THREE.Matrix4(), _dP = V(), _dQ = new THREE.Quaternion();
  function deathUpd(e, u, t) {
    if (e.still) return;
    if (!e.dth) deathInit(e, u, t);
    const D0 = e.dth, body = e.body, H = body.holder, sp = SPD();
    const tau = Math.max(0, (t - D0.t0) * sp);
    const end = tau >= D0.dur;
    // поза: сегменты падения; первые 150 мс — переход из живой позы
    if (!end || !D0.endDone) {
      deathPose(D0, Math.min(tau, D0.dur), e.pose);
      if (D0.fromQ && tau < 150) blendPose(D0.fromQ, e.pose, smo(tau / 150), e.pose);
      // держатель: от места гибели к месту падения (бросок — по дуге), разворот, наклон и подъём — к концу падения
      const kp = smo(tau / 300), kl = D0.L > 0 ? 1 - Math.pow(1 - Math.min(1, tau / D0.launchD), 2) : 0;
      H.position.lerpVectors(D0.p0, D0.pT, kp);
      H.position.y = D0.p0.y + (D0.pT.y - D0.p0.y) * kp;
      if (D0.L > 0) { H.position.x += D0.dx * D0.L * kl; H.position.z += D0.dz * D0.L * kl; H.position.y += (0.16 + D0.L * 0.16) * 4 * kl * (1 - kl) * (tau < D0.launchD ? 1 : 0); }
      const ks = smo((tau - D0.imp * 0.55) / Math.max(1, D0.dur - D0.imp * 0.55));
      H.position.y += D0.dy * ks;
      const ky = smo(Math.min(1, tau / D0.spinD));
      _dQ.setFromAxisAngle(UP, D0.ry0 + (D0.ry1 - D0.ry0) * ky);
      if (D0.tilt) { _dq.identity().slerp(D0.tilt, ks); _dQ.premultiply(_dq); }
      H.quaternion.copy(_dQ);
      applyPose(body, e.pose);
      // отброшенного выгибает назад на лету
      if ((D0.vk === 'thrown') && tau < 500 && body.B.Spine2) { const a = -0.45 * bump(tau / 500); const T2 = torso(body.B, e.tq || (e.tq = mkTorso())); _dq.setFromAxisAngle(T2.X, -a); rotWorld(body.B.Spine2, _dq); if (body.B.Head) rotWorld(body.B.Head, _dq); }
      // в падении ни одна кость не под землёй
      if (!end) {
        let pen = 0;
        const s = body.H / 1.8;
        for (let i = 0; i < LIFT.length; i++) { const b = body.B[LIFT[i]]; if (!b) continue; b.getWorldPosition(_dP); pen = Math.max(pen, groundY(_dP.x, _dP.z) + BRAD[LIFT[i]] * s * 0.8 - _dP.y); }
        if (pen > 0.002) { H.position.y += pen; H.updateMatrixWorld(true); }
      }
      if (end) {
        D0.endDone = true;
        // запомнить позу лёжки (раненому — основа для шевеления)
        D0.endQ = body.lie || (body.lie = {});
        DW.ANIM3.bones.forEach(function (k) { const b = body.B[k]; if (b) (D0.endQ[k] || (D0.endQ[k] = new THREE.Quaternion())).copy(b.quaternion); });
        D0.endH = (D0.endH || V()).copy(body.B.Hips.position);
      }
    } else if (D0.down && u.down > 0) writhe(e, u, t, D0);
    // события: тело ударилось о землю — пыль, лужа крови растекается из-под груди
    if (!(D0.events & 1) && tau >= D0.imp) {
      D0.events |= 1;
      const fresh = tau - D0.imp < 400;
      if (R3.fx && R3.fx.bodyFall && fresh && H.visible) R3.fx.bodyFall(body.B.Hips.getWorldPosition(_dP), D0.cause.strong ? 1.3 : 1);
      if (R3.fx && R3.fx.pool) R3.fx.pool(D0.pool.x, D0.pool.y, D0.pool.z, TR2().bloodKind ? TR2().bloodKind(u) : 'red', 0.55 + hash2(u.id || 0, 3) * 0.3, !fresh, D0.down && u.down > 0);
    }
    // оружие: в руке до «выпустил», потом — полёт, удар о землю, подскок, лежит
    deathWeapon(e, u, t, D0, tau);
    if (D0.sd && e.shield) { dropAt(D0.sd, t, e.shield.g.matrix); e.shield.g.matrixWorldNeedsUpdate = true; e.shield.g.updateMatrixWorld(true); e.shield.g.visible = H.visible; }
    // всё легло — заморозить (раненый живой — нет)
    const wDone = !D0.wd || D0.wd.done, sDone = !D0.sd || D0.sd.done;
    if (end && wDone && sDone && !(D0.down && u.down > 0)) freeze(e);
  }
  /* ствол: в кисти (как в движении «в кисти»), выпустил — полёт с текущей скоростью кисти и от тела, лёг на бок */
  function deathWeapon(e, u, t, D0, tau) {
    const W = e.wpn;
    if (e.rpg) e.rpg.g.visible = false;
    if (!W) return;
    W.g.visible = e.body.holder.visible;
    if (!e.cal || e.cal.w !== W) calibrate(e, W);
    const M = W.g.matrix;
    if (!D0.wd) {
      if (tau < D0.rel && !W.melee) {
        // в руке
        const hand = e.body.B.RightHand;
        _dM.compose(hand.getWorldPosition(_dP), hand.getWorldQuaternion(_dQ), _ONE).multiply(e.cal.offR);
        if (D0.wPrev && tau > D0.wPrevT) { D0.wVel = (D0.wVel || V()).copy(_dP.setFromMatrixPosition(_dM)).sub(D0.wPrev).multiplyScalar(1000 / Math.max(8, tau - D0.wPrevT)); }
        D0.wPrev = (D0.wPrev || V()).setFromMatrixPosition(_dM); D0.wPrevT = tau;
        M.copy(_dM);
      } else {
        // выпустил: из кисти (тело с начала боя — сразу на земле, от кисти конечной позы)
        if (!D0.wPrev) { const hand = e.body.B.RightHand; M.compose(hand.getWorldPosition(_dP), hand.getWorldQuaternion(_dQ), _ONE).multiply(e.cal.offR); }
        const v = _dv.copy(D0.wVel || _dv2.set(0, 0, 0));
        if (v.length() > 3.5) v.setLength(3.5);
        v.multiplyScalar(0.6).add(_dv2.set(D0.dx * 0.9, 0.9, D0.dz * 0.9));
        const sd = hash2(u.id || 0, 11) - 0.5;
        v.x += -D0.dz * sd * 1.2; v.z += D0.dx * sd * 1.2;
        D0.wd = mkDrop(M, v, D0.t0 + D0.rel / D0.sp, D0, false, e);
        if (tau > D0.rel + 4000) D0.wd.instant = true;
      }
    }
    if (D0.wd) dropAt(D0.wd, t, M);
    W.g.matrixWorldNeedsUpdate = true;
    W.g.updateMatrixWorld(true);
  }
  /* брошенный предмет: полёт по дуге (без пошагового счёта — по времени), удар, подскок, лёг на бок.
     shield — щит: ложится плашмя лицом вверх */
  function mkDrop(M, v, t0, D0, shield, e) {
    const B = DW.BT.get();
    const p0 = V().setFromMatrixPosition(M), q0 = new THREE.Quaternion().setFromRotationMatrix(_dM.extractRotation(M));
    const v0 = v.clone();
    // не дальше 1,1 м по горизонтали и не в стену/ящик/уступ
    const h = Math.hypot(v0.x, v0.z);
    const tf0 = (v0.y + Math.sqrt(v0.y * v0.y + 19.6 * Math.max(0, p0.y - groundY(p0.x, p0.z)))) / 9.8;
    if (h * tf0 > 1.1) { v0.x *= 1.1 / (h * tf0); v0.z *= 1.1 / (h * tf0); }
    let px = p0.x + v0.x * tf0, pz = p0.z + v0.z * tf0;
    const lvl = D0.lvl;
    if (lieCost(B, px, pz, lvl, -999) >= 4) { v0.x *= 0.25; v0.z *= 0.25; px = p0.x + v0.x * tf0; pz = p0.z + v0.z * tf0; if (lieCost(B, px, pz, lvl, -999) >= 4) { v0.x = 0; v0.z = 0; } }
    // лёг: ствол по горизонтали (курс — как летел, ±35°), на боку; щит — плашмя
    const fw = V(0, 0, -1).applyQuaternion(q0); fw.y = 0;
    if (fw.lengthSq() < 0.01) fw.set(D0.dx, 0, D0.dz);
    fw.normalize().applyAxisAngle(UP, (hash2(e.u.id || 0, 5) - 0.5) * 1.2);
    let q1;
    if (shield) { const zW = UP.clone(), xW = V().crossVectors(fw, zW).normalize(), yW = V().crossVectors(zW, xW); q1 = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xW, yW, zW)); }
    else {
      const sideUp = hash2(e.u.id || 0, 9) < 0.5 ? 1 : -1;
      const zW = fw.clone().negate(), xW = V(0, sideUp, 0), yW = V().crossVectors(zW, xW).normalize();
      q1 = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xW, yW, zW));
    }
    const yr = (shield ? 0.03 : 0.035);
    const dp = { t0: t0, p0: p0, v0: v0, q0: q0, q1: q1, yr: yr, done: false, instant: false };
    // время удара о грунт (грунт — в точке падения)
    const gy = groundY(p0.x + v0.x * tf0, p0.z + v0.z * tf0) + yr;
    dp.tl = (v0.y + Math.sqrt(Math.max(0, v0.y * v0.y + 19.6 * Math.max(0, p0.y - gy)))) / 9.8;
    dp.gy = gy;
    const vy = v0.y - 9.8 * dp.tl;
    dp.vb = Math.min(1.1, Math.abs(vy) * 0.3); dp.tb = 2 * dp.vb / 9.8;
    dp.pl = V(p0.x + v0.x * dp.tl, gy, p0.z + v0.z * dp.tl);
    dp.spin = (hash2(e.u.id || 0, 13) - 0.5) * 2.4;
    return dp;
  }
  const _drQ = new THREE.Quaternion(), _drA = V();
  function dropAt(dp, t, out) {
    const tau = dp.instant ? 1e3 : Math.max(0, (t - dp.t0) * SPD() / 1000);
    if (tau < dp.tl) {
      const k = tau / dp.tl;
      _dP.set(dp.p0.x + dp.v0.x * tau, dp.p0.y + dp.v0.y * tau - 4.9 * tau * tau, dp.p0.z + dp.v0.z * tau);
      _drQ.copy(dp.q0).slerp(dp.q1, smo(Math.min(1, k * 1.15)));
      // кувырок в полёте вокруг ствола
      _drA.set(0, 0, 1).applyQuaternion(_drQ); _dq2.setFromAxisAngle(_drA, dp.spin * Math.sin(k * Math.PI) * 0.5); _drQ.premultiply(_dq2);
    } else if (tau < dp.tl + dp.tb) {
      const a = tau - dp.tl, k = a / dp.tb;
      _dP.set(dp.pl.x + dp.v0.x * 0.25 * a, dp.gy + dp.vb * a - 4.9 * a * a, dp.pl.z + dp.v0.z * 0.25 * a);
      // подскок: качнулся вокруг ствола и лёг
      _drA.set(0, 0, 1).applyQuaternion(dp.q1); _dq2.setFromAxisAngle(_drA, 0.22 * Math.sin(k * Math.PI)); _drQ.copy(dp.q1).premultiply(_dq2);
    } else {
      _dP.set(dp.pl.x + dp.v0.x * 0.25 * dp.tb, dp.gy, dp.pl.z + dp.v0.z * 0.25 * dp.tb);
      _drQ.copy(dp.q1);
      dp.done = true;
    }
    if (_dP.y < groundY(_dP.x, _dP.z) + dp.yr * 0.6) _dP.y = groundY(_dP.x, _dP.z) + dp.yr * 0.6;
    out.compose(_dP, _drQ, _ONE);
    return dp.done;
  }
  /* тяжело ранен: лежит, дышит часто, ворочается, левая рука — к ране; стабилизирован — спокойнее */
  const _wq = new THREE.Quaternion(), _wa = V();
  function writhe(e, u, t, D0) {
    const body = e.body, B = body.B, Q = D0.endQ;
    for (const k in Q) if (B[k]) B[k].quaternion.copy(Q[k]);
    if (D0.endH) B.Hips.position.copy(D0.endH);
    body.holder.updateMatrixWorld(true);
    const calm = u.stable ? 0.4 : 1, ts = t / 1000, id = (u.id || 0) * 1.7;
    const T2 = torso(B, e.tq || (e.tq = mkTorso()));
    // дыхание: грудь
    if (B.Spine2) { _wq.setFromAxisAngle(T2.X, (0.04 + 0.03 * calm) * Math.sin(ts * (u.stable ? 2.2 : 4.4))); rotWorld(B.Spine2, _wq); }
    // голова: медленно поворачивается, приподнимается
    if (B.Neck) { _wq.setFromAxisAngle(T2.Y, 0.35 * calm * Math.sin(ts * 0.7 + id)); _dq2.setFromAxisAngle(T2.X, -0.12 * calm * (0.5 + 0.5 * Math.sin(ts * 0.43 + id))); _wq.multiply(_dq2); rotWorld(B.Neck, _wq); }
    // нога подтягивается и распрямляется
    if (B.RightUpLeg && B.RightLeg) { const k = calm * (0.5 + 0.5 * Math.sin(ts * 0.9 + id)); _wq.setFromAxisAngle(T2.X, -0.45 * k); rotWorld(B.RightUpLeg, _wq); _wq.setFromAxisAngle(T2.X, 0.7 * k); rotWorld(B.RightLeg, _wq); }
    // правая рука скребёт по земле
    if (B.RightArm) { _wq.setFromAxisAngle(T2.Z, 0.25 * calm * Math.sin(ts * 1.3 + id)); rotWorld(B.RightArm, _wq); }
    // левая — к животу (рана)
    if (B.LeftArm && B.LeftForeArm && B.LeftHand && B.Spine) {
      const w = B.Spine.getWorldPosition(_wa).addScaledVector(T2.Z, 0.13 * body.H / 1.8).addScaledVector(T2.X, 0.03);
      reach(body, 'Left', w, B.LeftForeArm.getWorldPosition(V()).addScaledVector(T2.X, -0.3).addScaledVector(T2.Z, 0.1));
    }
  }
  /* тело улеглось: больше ни поз, ни матриц — ни у тела, ни у ствола; кости кожи — тоже (кадр позже, после отрисовки) */
  const NOOP = function () { };
  function freeze(e) {
    e.still = 1;
    e.body.holder.updateMatrixWorld(true);
    e.body.holder.updateMatrixWorld = NOOP;
    if (e.wpn) { e.wpn.g.updateMatrixWorld(true); e.wpn.g.updateMatrixWorld = NOOP; }
    if (e.shield) { e.shield.g.updateMatrixWorld(true); e.shield.g.updateMatrixWorld = NOOP; }
    // кости кожи: посчитать один раз (тело могло быть не видно в этот кадр) — и больше не пересчитывать
    (e.body.meshes || []).forEach(function (m) { if (m.isSkinnedMesh && m.skeleton && m.skeleton.update !== NOOP) { THREE.Skeleton.prototype.update.call(m.skeleton); m.skeleton.update = NOOP; } });
  }
  /* снова жив (или новое тело): всё как было */
  function deathReset(e) {
    if (e.still) {
      delete e.body.holder.updateMatrixWorld;
      if (e.wpn) delete e.wpn.g.updateMatrixWorld;
      if (e.shield) delete e.shield.g.updateMatrixWorld;
      (e.body.meshes || []).forEach(function (m) { if (m.isSkinnedMesh && m.skeleton) delete m.skeleton.update; });
    }
    if (e.dth && e.dth.occ) e.dth.occ.forEach(function (i) { if (lieOcc[i] === e.u.id) delete lieOcc[i]; });
    e.still = 0; e.dth = null; e.key = null; e.from = null; e.gk = null;
  }
  /* прыжок Падальщика: присел → дуга на цель (нос вверх, затем вниз) → приземлился и вцепился → отскок назад.
     f — доля пути до клетки цели, h — высота, rx — наклон носа, sq — сжатие, air — вытяжка лап, jaw — пасть */
  function leapCurve(A, H) {
    const k = A.k, kI = A.imp / A.dur, kT = 0.17, kL = Math.min(0.9, kI + 0.15);
    const o = { f: 0, h: 0, rx: 0, sq: 1, air: 0, jaw: 0 };
    if (k < kT) { const q = smo(k / kT); o.f = -0.05 * q; o.h = -0.06 * H * q; o.rx = 8 * q; o.sq = 1 - 0.08 * q; }
    else if (k < kI) { const q = (k - kT) / (kI - kT); o.f = -0.05 + (A.reach + 0.05) * smo(q); o.h = 4 * 0.5 * H * q * (1 - q); o.rx = -24 + 40 * q; o.air = Math.sin(q * Math.PI); o.jaw = 30 * DG * smo((q - 0.45) / 0.55); }
    else if (k < kL) { const q = (k - kI) / (kL - kI); o.f = A.reach; o.h = -0.05 * H * Math.sin(q * Math.PI); o.rx = 14 * (1 - q); o.sq = 1 - 0.1 * Math.sin(q * Math.PI); o.jaw = 30 * DG * (1 - q); }
    else { const q = (k - kL) / (1 - kL); o.f = A.reach * (1 - smo(q)); o.h = 4 * 0.12 * H * q * (1 - q); o.rx = -10 * Math.sin(q * Math.PI); }
    return o;
  }
  /* на кого смотреть: ближайший боец отряда в 12 клетках (раз в 0,45 с); не вступивший в бой — ни на кого */
  function crLookU(e, u, t) {
    if (e.lkT && t - e.lkT < 450) return e.lkU;
    e.lkT = t; e.lkU = null;
    if (!u.active) return null;
    let best = 144;
    DW.BT.get().units.forEach(function (o) {
      if (!o.alive || o.evac || o.side !== 'p') return;
      const d = (o.x - u.x) * (o.x - u.x) + (o.y - u.y) * (o.y - u.y);
      if (d < best) { best = d; e.lkU = o; }
    });
    return e.lkU;
  }
  /* подёргивания в покое: быстрый поворот головы, дёрнулось ухо — раз в 2–6 с */
  function crTwitch(e, t) {
    if (!e.twN) e.twN = t + 1500 + Math.random() * 3000;
    if (t > e.twN) { e.tw = { t0: t, y: (Math.random() - 0.5) * 0.7, p: (Math.random() - 0.4) * 0.35, ear: Math.random() < 0.6 ? 1 : 0 }; e.twN = t + 1800 + Math.random() * 4200; }
    const w = e.tw;
    if (!w) return null;
    const k = (t - w.t0) / 650;
    if (k >= 1 || k < 0) { e.tw = null; return null; }
    const env = k < 0.12 ? k / 0.12 : (k < 0.55 ? 1 : 1 - (k - 0.55) / 0.45);
    return { y: w.y * env, p: w.p * env, ear: w.ear * (k < 0.3 ? Math.sin(k / 0.3 * Math.PI) : 0) };
  }
  /* новорождённый из выводка Матки: мешок лопается на клетке, Матка рычит */
  function crBorn(e, u, t) {
    e.bornChk = true;
    if (u.type !== 'scav') return;
    const qn = DW.BT.get().units.find(function (o) { return o.alive && o.type === 'queen' && Math.max(Math.abs(o.x - u.x), Math.abs(o.y - u.y)) <= 2; });
    if (!qn) return;
    e.born = t;
    if (R3.mfx && !R3.mfx.recentBurst(u.x, u.y)) R3.mfx.burst(u.x, u.y);
    const qe = ents[qn.id];
    if (qe && qe.ready && qe.rig && (!qe.act || qe.act.kind !== 'brood')) qe.act = mkAct(qe, qn, 'brood', t);
  }
  /* лёжка: самая нижняя вершина — на грунт своей клетки; край тела на уступе выше — приподнять (наклон через
     дальний край), больше трети тела над обрывом — свесить; один раз в конце падения */
  function crSettle(e, u, t) {
    const R = e.rig, holder = e.body.holder, mesh = R.mesh, MF = R3.mfx;
    const S = { dy: 0, q: null, pv: null, t0: e.die.t0 < -1e8 ? -1e9 : t };
    if (!mesh || !MF) return S;
    const base = MF.groundAt((u.x + 0.5) * T, (u.y + 0.5) * T);
    const n = mesh.geometry.attributes.position.count, step = Math.max(1, Math.floor(n / 450)), pts = [], hs = [];
    for (let i = 0; i < n; i += step) { const v = V(); mesh.getVertexPosition(i, v); v.applyMatrix4(mesh.matrixWorld); pts.push(v); hs.push(MF.groundAt(v.x, v.z)); }
    let dy = -1e9;
    for (let i = 0; i < pts.length; i++) if (hs[i] <= base + 0.05) dy = Math.max(dy, hs[i] - pts[i].y);
    if (dy < -1e8) dy = 0;
    S.dy = dy;
    let ex = 0, iEx = -1;
    for (let i = 0; i < pts.length; i++) if (hs[i] > base + 0.05) { const x = hs[i] - (pts[i].y + dy); if (x > ex) { ex = x; iEx = i; } }
    const hp = holder.position;
    if (iEx >= 0 && ex > 0.02) {
      const r = V(pts[iEx].x - hp.x, 0, pts[iEx].z - hp.z);
      if (r.lengthSq() > 1e-6) {
        r.normalize();
        let iMin = 0, dMin = 1e9;
        pts.forEach(function (p, i) { const d = (p.x - hp.x) * r.x + (p.z - hp.z) * r.z; if (d < dMin) { dMin = d; iMin = i; } });
        S.pv = pts[iMin].clone(); S.pv.y += dy;
        const L = (pts[iEx].x - S.pv.x) * r.x + (pts[iEx].z - S.pv.z) * r.z;
        S.q = new THREE.Quaternion().setFromAxisAngle(V().crossVectors(r, UP).normalize(), Math.min(35 * DG, Math.atan2(ex, Math.max(0.25, L))));
      }
    } else {
      let over = 0;
      const oc = V();
      for (let i = 0; i < pts.length; i++) if (hs[i] < base - 0.3) { over++; oc.add(pts[i]); }
      if (over > pts.length * 0.3) {
        oc.multiplyScalar(1 / over);
        const r = V(oc.x - hp.x, 0, oc.z - hp.z);
        if (r.lengthSq() > 1e-4) { r.normalize(); S.pv = V(hp.x, base, hp.z); S.q = new THREE.Quaternion().setFromAxisAngle(V().crossVectors(r, UP).normalize(), -12 * DG); }
      }
    }
    return S;
  }
  const _cqY = new THREE.Quaternion(), _cqL = new THREE.Quaternion(), _cqT = new THREE.Quaternion(), _cI = new THREE.Quaternion(), _ce = new THREE.Euler(0, 0, 0, 'YXZ');
  const _cv = V(), _cv2 = V(), _cv3 = V(), _cX = V(), _cY = V(), _cZ = V(), _cPv = V();
  function updCreature(e, u, t, dt, face) {
    const tr = TR2(), R = e.rig, holder = e.body.holder, s = SPD();
    // труп улёгся — поза больше не меняется, кадр не тратится
    if (e.frozen) { holder.position.copy(e.frozen.p); holder.quaternion.copy(e.frozen.q); holder.scale.copy(e.frozen.s); return; }
    if (!R) return;
    crSignals(e, u, t);
    const sc = e.sc = Math.min(1.25, tr.unitScale(u) / 1.13), H = e.ci.h * sc, Q = R3.q(), MF = R3.mfx;
    if (e.spawned && !e.bornChk) crBorn(e, u, t);
    let A0 = e.act;
    if (A0) {
      A0.k = (t - A0.t0) / A0.dur;
      const tw0 = tr.tweenOf(u.id);
      if (A0.k >= 1 || !u.alive || (tw0 && tw0.kind === 'step' && A0.kind !== 'leap' && A0.kind !== 'smash' && A0.kind !== 'bite')) e.act = A0 = null;
    }
    if (!u.alive && !e.die) e.die = { t0: -1e9, dur: 1, side: (u.id || 0) % 2 ? 1 : -1, twist: 0, settle: null };   // убит до начала боя
    const P = creaturePose(e, u, t);
    const AA = P.act || null;
    // разворот тела и хвоста: скорость поворота (хвост запаздывает)
    let df = face - (e.lastFace === undefined ? face : e.lastFace);
    while (df > Math.PI) df -= Math.PI * 2;
    while (df < -Math.PI) df += Math.PI * 2;
    e.lastFace = face;
    e.turnV = (e.turnV || 0) + (df / Math.max(0.005, dt) - (e.turnV || 0)) * Math.min(1, dt * 6);
    // смещения тела: вперёд/вбок/вверх (м), наклоны (rx — нос вниз, rz — крен), лишний рыск, масштаб; ось наклона
    let fwM = 0, sideM = 0, upM = 0, rx = 0, rz = 0, yawX = 0, sx = 1, sy = 1, sz = 1, pivX = 0, pivY = H * 0.42;
    let jaw = 0, hpitch = 0, hyaw = 0, tailAmp = 0.12, flapAmp = 3 * DG, fold = 0, stretch = 0, lookP = null, droop = 0;
    // приём с перемещением (прыжок, удар) — положение ведём сами от клетки (2D-рывок не нужен)
    if (AA && (AA.kind === 'leap' || AA.kind === 'smash')) {
      const dx = AA.tx - AA.fx, dy = AA.ty - AA.fy;
      let f = 0, h = 0;
      if (AA.kind === 'leap') { const o = leapCurve(AA, H); f = o.f; h = o.h; rx += o.rx * DG; sy *= o.sq; sx /= Math.sqrt(o.sq); sz /= Math.sqrt(o.sq); stretch = o.air; jaw = o.jaw; }
      else { const kI = AA.imp / AA.dur, k = AA.k; f = 0.2 * smo(k / kI) * (1 - smo((k - 0.68) / 0.32)); h = -0.05 * H * Math.exp(-Math.pow((k - kI) / 0.07, 2)); rx += (6 * Math.exp(-Math.pow((k - kI) / 0.12, 2)) - 3 * smo(k / kI) * (1 - smo((k - kI) / 0.1))) * DG; }
      const h0 = tr.uLevel(u) * LV, h1 = R3.hAt(AA.tx, AA.ty);
      holder.position.set((AA.fx + 0.5 + dx * f) * T, h0 + (h1 - h0) * U.clamp(f / AA.reach, 0, 1) + h, (AA.fy + 0.5 + dy * f) * T);
      lookP = _cv3.set((AA.tx + 0.5) * T, h1 + 0.9, (AA.ty + 0.5) * T);
    }
    // клип и плавный переход между клипами
    const cl = e.cl[P.key] || e.cl.idle || e.cl.walk;
    if (!cl) return;
    if (e.ckey !== P.key) { e.cprev = e.cl[e.ckey] || null; e.ckey = P.key; e.cT = t; }
    const kf = Math.min(1, (t - (e.cT || 0)) / 200);
    for (const n in e.cl) e.cl[n].act.weight = 0;
    const timeOf = function (c2, P2) {
      const a = c2.a, t0 = a.t0 || 0, t1 = a.t1 !== undefined ? Math.min(a.t1, c2.dur) : c2.dur;
      if (P2.ph !== undefined) return t0 + (t1 - t0) * P2.ph;
      if (P2.p !== undefined) return t0 + (t1 - t0) * P2.p;
      return t0 + ((P2.ts || 0) % Math.max(0.1, t1 - t0));
    };
    // хромота (здоровье < 40 %): сбивка шага, провал на больную ногу, крен
    e.limp = (e.limp || 0) + ((u.alive && u.hp / Math.max(1, u.maxHp || u.hp) < 0.4 ? 1 : 0) - (e.limp || 0)) * Math.min(1, dt * 1.5);
    if (P.walk && e.limp > 0.01) P.ph = ((P.ph + 0.035 * e.limp * Math.sin(P.ph * Math.PI * 4)) % 1 + 1) % 1;
    cl.act.time = timeOf(cl, P); cl.act.weight = e.cprev && e.cprev !== cl ? kf : 1;
    if (e.cprev && e.cprev !== cl && kf < 1) e.cprev.act.weight = 1 - kf;
    for (let i = 0; i < R.mods.length; i++) R.mods[i].quaternion.copy(R.clipQ[i]);
    if (e.hipClip) e.hipB.position.copy(e.hipClip);
    e.mixer.update(0);
    for (let i = 0; i < R.mods.length; i++) R.clipQ[i].copy(R.mods[i].quaternion);
    if (e.hipClip) e.hipClip.copy(e.hipB.position);
    // таз — на месте (клипы с ходом уводили тело вперёд, а ходьба и бег двуногих — ещё и вверх); при гибели —
    // не дальше 0,25 м, в ударах и выстрелах — не дальше 0,12 м
    if (e.hipB && e.hip0) {
      const hp = e.hipB.position, dr = R.drift[P.key];
      if (dr && cl.a.loop) { const a0 = cl.a.t0 || 0, a1 = cl.a.t1 !== undefined ? Math.min(cl.a.t1, cl.dur) : cl.dur; hp.addScaledVector(dr, -U.clamp((cl.act.time - a0) / Math.max(0.01, a1 - a0), 0, 1) * cl.act.weight); }
      const dx = hp.x - e.hip0.x, dz = hp.z - e.hip0.z;
      const lim = P.key === 'die' ? 0.25 : (cl.a.loop ? 0 : 0.12);
      if (lim) { const l = Math.hypot(dx, dz), mx = lim / Math.max(0.001, e.body.k); if (l > mx) { hp.x = e.hip0.x + dx * mx / l; hp.z = e.hip0.z + dz * mx / l; } }
      else { hp.x = e.hip0.x + dx * 0.15; hp.z = e.hip0.z + dz * 0.15; }
    }
    // наклоны клипа (четвероногие: укус, рык)
    const fxv = P.fx && cl.a.fx ? fxAt(cl.a.fx, P.p !== undefined ? P.p : ((P.ts || 0) % 1)) : null;
    if (fxv) { rx += fxv.rx; rz += fxv.rz; fwM += fxv.fw; sy *= fxv.sy; }
    // приёмы: голова, пасть
    if (AA) {
      const k = AA.k;
      if (AA.kind === 'bite') { const jk = Math.exp(-Math.pow((k - AA.imp / AA.dur * 0.9) / 0.14, 2)); jaw = 30 * DG * jk; hpitch += 16 * DG * jk; lookP = _cv3.set((AA.tx + 0.5) * T, R3.hAt(AA.tx, AA.ty) + 0.9, (AA.ty + 0.5) * T); }
      else if (AA.kind === 'spit') {
        // запрокинул голову — плюнул рывком вперёд
        const ms = (t - AA.t0) * s, rear = ms < 300 ? smo(ms / 300) : Math.max(0, 1 - (ms - 300) / 90), th2 = ms < 300 ? 0 : Math.sin(Math.min(1, (ms - 300) / 380) * Math.PI);
        hpitch += (-18 * rear + 20 * th2) * DG; rx += (-5 * rear + 6 * th2) * DG;
      } else if (AA.kind !== 'leap' && AA.kind !== 'smash') {
        const env = smo(k / 0.18) * (1 - smo((k - 0.72) / 0.28));
        if (AA.kind === 'snarl') { hpitch += 6 * DG * env; jaw = 24 * DG * env; sy *= 1 - 0.03 * env; }
        else if (AA.kind === 'hiss') { hpitch -= 14 * DG * env; rx -= 6 * DG * env; sy *= 1 + 0.03 * env; }
        else {
          hpitch -= (R.biped ? 8 : 20) * DG * env; jaw = 32 * DG * env;
          if (AA.kind === 'brood') { const pl = Math.sin(k * Math.PI * 9) * env; sy *= 1 + 0.05 * pl; sx *= 1 - 0.025 * pl; sz *= 1 - 0.02 * pl; }
        }
        e.roarEnv = env;
      }
    }
    // попадание: отдача от удара (сдвиг и наклон прочь от стрелка, голова дёргается)
    if (e.hit && u.alive) {
      const ht = (t - e.hit.t0) * s / 1000;
      if (ht > 0.75) e.hit = null;
      else if (ht > 0) {
        const r = (ht / 0.085) * Math.exp(1 - ht / 0.085), th = Math.PI / 2 - face;
        const lx = Math.cos(th) * e.hit.d.x - Math.sin(th) * e.hit.d.z, lz = Math.sin(th) * e.hit.d.x + Math.cos(th) * e.hit.d.z;
        sideM += lx * 0.1 * H * r; fwM += lz * 0.1 * H * r;
        rx += lz * 14 * DG * r; rz -= lx * 12 * DG * r;
        hpitch += lz * 18 * DG * r; hyaw += lx * 25 * DG * r;
      }
    }
    e.exert = Math.max(0, (e.exert || 0) - dt / 4);
    // живой: дыхание (чаще после рывка и раненым), переминание, хромота на ходу
    if (u.alive) {
      if (P.walk) {
        const c = P.ph * Math.PI * 4;
        if (e.limp > 0.01) { upM -= 0.045 * H * e.limp * Math.max(0, Math.sin(c)); rz += 6 * DG * e.limp * Math.sin(c); rx += 4 * DG * e.limp; }
        tailAmp = P.run ? 0.32 : 0.22; flapAmp = (P.run ? 8 : 5) * DG;
      } else if (!AA) {
        const Tb = 2.8 - 1.8 * Math.max(e.exert, e.limp * 0.7), ph = Math.sin(t / 1000 / Tb * Math.PI * 2 + (u.id || 0));
        const amp = 0.011 + 0.012 * e.exert + 0.006 * e.limp;
        sy *= 1 + amp * ph; sx *= 1 + amp * 0.5 * ph; sz *= 1 + amp * 0.4 * ph;
        rx += 5 * DG * e.limp;
        if (!R.biped) { rz += 1.1 * DG * Math.sin(t / 5100 * 6.283 + (u.id || 0)); fwM += 0.012 * H * Math.sin(t / 6300 * 6.283 + (u.id || 0) * 2); }
      }
      e.eyeA = 1;
    }
    // гибель: четвероногий переваливается через лапы на бок (с отскоком), лапы подгибаются, голова никнет;
    // двуногий — клип падения, развёрнутый от стрелка; тело опускается к земле
    let dk = 1;
    if (!u.alive) {
      const Dd = e.die;
      dk = P.dk;
      yawX += Dd.twist * smo(dk / 0.6);
      if (!R.biped) {
        const ra = 84 * DG, roll = dk < 0.5 ? ra * Math.pow(dk / 0.5, 2) : (dk < 0.8 ? ra * (1 - 0.07 * Math.sin(Math.PI * (dk - 0.5) / 0.3)) : ra);
        rz += Dd.side * roll; rx += 5 * DG * smo(dk);
        const hw = (R.box.max.x - R.box.min.x) * 0.4 * sc;
        pivY = 0; pivX = -Dd.side * hw;
        fold = smo((dk - 0.15) / 0.6); droop = fold; jaw = 16 * DG * smo((dk - 0.3) / 0.5); tailAmp = 0;
      }
      if (!Dd.thud && dk > (R.biped ? 0.6 : 0.5)) { Dd.thud = true; if (MF && MF.thud) MF.thud(u, holder.position, H); }
      e.eyeA = Math.max(0, 1 - dk / 0.45);
    }
    // тело: рыск × наклоны вокруг оси (pivX, pivY), сдвиги в осях рыска, масштаб
    const th = Math.PI / 2 - face + yawX;
    _cqY.setFromAxisAngle(UP, th);
    _ce.set(rx, 0, rz, 'YXZ'); _cqL.setFromEuler(_ce);
    holder.quaternion.copy(_cqY).multiply(_cqL);
    _cPv.set(pivX, pivY, 0); _cv.copy(_cPv).applyQuaternion(_cqL); _cv.subVectors(_cPv, _cv);
    _cv.add(_cv2.set(sideM, upM, fwM)).applyQuaternion(_cqY);
    holder.position.add(_cv);
    holder.scale.set(sc * sx, sc * sy, sc * sz);
    // пятно тени — под телом (в прыжке и ударе тело ведём сами)
    if (e.blob && u.alive) { e.blob.position.x = holder.position.x; e.blob.position.z = holder.position.z; }
    // вылупился из мешка: сперва не виден, потом растёт
    if (e.born) {
      const em = (t - e.born) * s;
      if (em < 520) { holder.visible = false; if (e.blob) e.blob.visible = false; }
      else if (em < 1000) { const g = smo((em - 520) / 450); holder.scale.multiplyScalar(0.35 + 0.65 * g); }
      else e.born = null;
    }
    holder.updateMatrixWorld(true);
    _cX.setFromMatrixColumn(holder.matrixWorld, 0).normalize();
    _cY.setFromMatrixColumn(holder.matrixWorld, 1).normalize();
    _cZ.setFromMatrixColumn(holder.matrixWorld, 2).normalize();
    // голова: следит за ближайшим бойцом (в пределах шеи), подёргивания, отдача; при плевке — на цель
    if (R.look.length && R.head) {
      if (u.alive) {
        if (!lookP && u._aimAt && tr.now() < (u._aimUntil || 0)) { const a = UN.anchor(u._aimAt, false); lookP = _cv3.set(a.x, a.y + 1.1, a.z); }
        if (!lookP && !P.hit && !AA) { const o = crLookU(e, u, t); if (o) { const a = UN.anchor(o, false); lookP = _cv3.set(a.x, a.y + 1.2 * (tr.unitScale(o) / 1.13), a.z); } }
        let ty = 0, tp = 0;
        if (lookP) {
          const hp = _cv2.setFromMatrixPosition(R.head.matrixWorld);
          const dx = lookP.x - hp.x, dy = lookP.y - hp.y, dz = lookP.z - hp.z, hl = Math.hypot(dx, dz);
          const fl = Math.hypot(_cZ.x, _cZ.z) || 1, fx = _cZ.x / fl, fz = _cZ.z / fl;
          const yl = R.biped ? 1.0 : 0.85;
          ty = Math.atan2(fz * dx - fx * dz, fx * dx + fz * dz);
          if (Math.abs(ty) > 2.2) ty = 0;                       // за спиной — не выворачивать шею
          ty = U.clamp(ty, -yl, yl); tp = U.clamp(-Math.atan2(dy, Math.max(0.1, hl)), -0.42, 0.42);
        }
        const lk = e.lk || (e.lk = { y: 0, p: 0 });
        const rate = Math.min(1, dt * (AA ? 9 : 4.5));
        lk.y += (ty - lk.y) * rate; lk.p += (tp - lk.p) * rate;
        const tw2 = !P.walk && !AA ? crTwitch(e, t) : null;
        const Y = lk.y + hyaw + (tw2 ? tw2.y : 0), Pp = lk.p + hpitch + (tw2 ? tw2.p : 0);
        e.ear = tw2 ? tw2.ear : 0;
        const n = R.look.length, W = n * (n + 1) / 2;
        for (let i = 0; i < n; i++) { const w = (i + 1) / W; rotW(R.look[i], UP, Y * w, _cX, Pp * w); }
      } else if (droop > 0.001 && !R.biped) {
        // мёртвый: голова никнет к земле
        const n = R.look.length;
        for (let i = 0; i < n; i++) rotW(R.look[i], _cY, -e.die.side * 0.45 * droop / n);
      }
    }
    // пасть: петля у челюсти — вниз; жвала по бокам — в стороны
    if (jaw > 0.001 && R.jaw.length) {
      const hp = _cv2.setFromMatrixPosition(R.head.matrixWorld);
      R.jaw.forEach(function (b) {
        const bp = _cv.setFromMatrixPosition(b.matrixWorld).sub(hp), sd = bp.dot(_cX);
        if (Math.abs(sd) > 0.04 * H) rotW(b, _cY, Math.sign(sd) * jaw * 0.6); else rotW(b, _cX, jaw);
      });
    }
    // хвост: покачивание (на ходу — чаще), отстаёт при развороте; у мёртвого — обвис
    if (R.tail.length && (Q >= 1 || P.walk)) {
      const n = R.tail.length, fr = P.walk ? (P.run ? 11 : 7.5) : 2.1;
      for (let i = 0; i < n; i++) {
        const w = 0.35 + 0.65 * i / Math.max(1, n - 1);
        const a = tailAmp * Math.sin(t / 1000 * fr - i * 0.75 + (u.id || 0)) * w / n * 2.2 - U.clamp(e.turnV, -6, 6) * 0.05 * w;
        if (!u.alive) rotW(R.tail[i], _cY, -e.die.side * 0.12 * fold);
        else rotW(R.tail[i], UP, a, _cX, 0.08 * e.limp);
      }
    }
    // уши, шипы, жвала: мелкая дрожь, ухо дёргается
    if (u.alive && Q >= 1 && R.flaps.length) {
      for (let i = 0; i < R.flaps.length; i++) {
        const a = flapAmp * (Math.sin(t * 0.0071 + i * 1.9) * 0.6 + Math.sin(t * 0.0173 + i * 0.7) * 0.4) + (e.ear || 0) * 0.32 * (i % 2 ? 1 : -1);
        rotW(R.flaps[i], _cX, a);
      }
    }
    // лапы четвероногих: в прыжке вытянуты (передние вперёд, задние назад), у мёртвого — подогнуты
    if (!R.biped && (fold > 0.001 || stretch > 0.001)) {
      R.legs.forEach(function (L, i) {
        const fa = L.front ? [40, -60, 30] : [-35, 55, -28], sa = L.front ? [-45, 15, 0] : [45, -15, 0];
        L.ch.forEach(function (b, j) { rotW(b, _cX, (fa[j] * fold + sa[j] * stretch) * DG * (1 + (((i * 7 + j * 3) % 5) - 2) * 0.08)); });
      });
    }
    if (MF && holder.visible) crEffects(e, u, P, AA, t, dt, H, th, Q);
    // гибель закончена — лёжка по рельефу, затем «заморозка» трупа
    if (!u.alive) {
      const Dd = e.die;
      if (dk >= 1 && !Dd.settle) Dd.settle = crSettle(e, u, t);
      if (Dd.settle) {
        const S = Dd.settle, w = smo((t - S.t0) / (260 / s));
        holder.position.y += S.dy * w;
        if (S.q) {
          _cqT.copy(_cI).slerp(S.q, w);
          _cPv.copy(S.pv); _cPv.y -= S.dy * (1 - w);
          holder.position.sub(_cPv).applyQuaternion(_cqT).add(_cPv);
          holder.quaternion.premultiply(_cqT);
        }
        holder.updateMatrixWorld(true);
        if (w >= 1) e.frozen = { p: holder.position.clone(), q: holder.quaternion.clone(), s: holder.scale.clone() };
      }
    }
  }
  /* эффекты приёмов, шагов и капель — в r3d/mfx.js */
  function crEffects(e, u, P, AA, t, dt, H, th, Q) {
    const MF = R3.mfx, R = e.rig, holder = e.body.holder;
    if (AA) {
      const kI = AA.imp ? AA.imp / AA.dur : 0;
      if (AA.kind === 'leap' && !AA.done.land && AA.k >= kI) {
        AA.done.land = true;
        MF.leapLand(u, holder.position.clone().addScaledVector(_cZ, 0.32 * H), th + Math.PI, H);
      } else if (AA.kind === 'smash' && !AA.done.imp && AA.k >= kI) {
        AA.done.imp = true;
        // точка удара — между кулаками, на земле
        const B = e.body.B;
        const p = B.LeftHand && B.RightHand ? B.LeftHand.getWorldPosition(V()).lerp(B.RightHand.getWorldPosition(V()), 0.5) : holder.position.clone().addScaledVector(_cZ, 0.6 * H / 2.3);
        MF.smash(u, p, H);
      } else if (AA.kind === 'bite' && !AA.done.imp && AA.k >= kI) {
        AA.done.imp = true;
        MF.bite(u, V((AA.tx + 0.5) * T, 0, (AA.ty + 0.5) * T), th + Math.PI, H);
      } else if ((AA.kind === 'roar' || AA.kind === 'brood' || AA.kind === 'snarl') && R.mouthO) {
        const big = AA.kind !== 'snarl';
        const mo = R.mouthO.getWorldPosition(V()), md = R.mouthF.getWorldPosition(V()).sub(mo).normalize();
        if (!AA.done.burst && AA.k >= 0.2 && big) { AA.done.burst = true; MF.roarBurst(u, holder.position.clone(), _cZ.clone().setY(0).normalize(), u.type === 'queen' ? 1.3 : (u.type === 'alpha' ? 1 : 0.5)); }
        if ((e.roarEnv || 0) > 0.25 && (big || Q >= 2)) MF.breath(u, mo, md, e.roarEnv, dt, big && u.type !== 'brute', _cZ.clone().setY(0).normalize());
      }
    }
    // капли кислоты из пасти Плевуна (перед плевком — чаще)
    if (u.alive && R.D.acid && Q >= 1 && R.mouthO) {
      e.dripT = (e.dripT || 0) - dt * (AA && AA.kind === 'spit' ? 3 : 1);
      if (e.dripT <= 0) { e.dripT = Q >= 2 ? 0.35 + Math.random() * 0.4 : 0.8 + Math.random() * 0.7; MF.drip(R.mouthO.getWorldPosition(V())); }
    }
    // шаги: стопа опустилась на землю (по высоте кости за цикл) — пыль, отпечаток, когти
    if (u.alive && P.walk && R.feet.length) {
      const by = holder.position.y, heavy = u.type === 'brute' || u.type === 'queen' || u.type === 'alpha';
      for (let i = 0; i < R.feet.length; i++) {
        const f = R.feet[i], m = f.matrixWorld.elements, y = m[13] - by, S = e.fs[i];
        S.lo = Math.min(y, S.lo + dt * 0.08); S.hi = Math.max(y, S.hi - dt * 0.08);
        const rg = S.hi - S.lo;
        if (rg < 0.025 * H) continue;
        if (S.up && y < S.lo + 0.22 * rg) { S.up = false; MF.foot(u, V(m[12], 0, m[14]), th + Math.PI, heavy, !!P.run); }
        else if (!S.up && y > S.lo + 0.6 * rg) S.up = true;
      }
    }
  }

  /* ---------- Для эффектов и интерфейса ---------- */
  UN.muzzle = function (u) {
    const e = ents[u.id];
    if (!e || !e.ready) return null;
    const W = e.rpg && e.rpg.g.visible ? e.rpg : e.wpn;
    if (W && W.g.visible) return W.muzzle.clone().applyMatrix4(W.g.matrixWorld);
    if (e.kind === 'turret') { const f = u.face || 0; return e.body.holder.position.clone().add(V(Math.cos(f) * 0.55, 0.75, Math.sin(f) * 0.55)); }
    // существо: у головы
    if (e.body && e.body.B && e.body.B.Head) return e.body.B.Head.getWorldPosition(V());
    return null;
  };
  /* куда смотрит ствол (единичный вектор) и где окно выброса гильз (справа над рукоятью) — для вспышек и гильз */
  UN.muzzleDir = function (u, out) {
    const e = ents[u.id];
    if (!e || !e.ready) return null;
    const W = e.rpg && e.rpg.g.visible ? e.rpg : e.wpn;
    if (!W || !W.g.visible) return null;
    return (out || V()).set(0, 0, -1).transformDirection(W.g.matrixWorld);
  };
  UN.ejectPort = function (u, out) {
    const e = ents[u.id];
    if (!e || !e.ready || !e.wpn || !e.wpn.g.visible || (e.rpg && e.rpg.g.visible)) return null;
    const W = e.wpn;
    return (out || V()).set(0.022, (W.muzzle.y || 0.05) * 0.8, W.pistol ? -0.03 : -0.1).applyMatrix4(W.g.matrixWorld);
  };
  /* задний срез трубы РПГ (реактивная струя назад) */
  UN.gunRear = function (u, out) {
    const e = ents[u.id];
    if (!e || !e.ready) return null;
    const W = e.rpg && e.rpg.g.visible ? e.rpg : e.wpn;
    if (!W) return null;
    return (out || V()).set(0, W.muzzle.y || 0, W.buttZ || 0.3).applyMatrix4(W.g.matrixWorld);
  };
  /* лежит ли тело (упало и замерло) — для тестов и эффектов */
  UN.lying = function (u) { const e = ents[u.id]; return !!(e && e.still); };
  /* кисть (откуда летит граната) */
  UN.hand = function (u, left) {
    const e = ents[u.id];
    if (!e || !e.ready || !e.body.B) return null;
    const h = e.body.B[left ? 'LeftHand' : 'RightHand'];
    return h ? h.getWorldPosition(V()) : null;
  };
  /* точки над головой и у ног (для полосок здоровья, реплик, выбора касанием) */
  UN.anchor = function (u, top) {
    const e = ents[u.id];
    const lvl = TR2().uLevel(u);
    const p = u.alive ? TR2().leanPos(u) : [u.x, u.y];
    const base = V((p[0] + 0.5) * T, lvl * LV, (p[1] + 0.5) * T);
    if (!top) return base;
    let h = 2.0;
    if (e && e.ready && e.body.B && e.body.B.Head) { const hp = e.body.B.Head.getWorldPosition(V()); h = hp.y - base.y + 0.3; }
    else if (u.type === 'queen') h = 2.6;
    return base.add(V(0, h, 0));
  };
  UN.pick = function (sx, sy) {
    const B = DW.BT.get();
    if (!B) return null;
    let best = null, bd = 1e9;
    B.units.forEach(function (u) {
      if (!u.alive || u.evac || (u.side === 'e' && !u.seen)) return;
      const a = R3.toScreen(UN.anchor(u, false)), b = R3.toScreen(UN.anchor(u, true));
      if (!a || !b) return;
      const w = Math.max(16, Math.abs(a[1] - b[1]) * 0.32);
      if (sx < Math.min(a[0], b[0]) - w || sx > Math.max(a[0], b[0]) + w || sy < b[1] - 6 || sy > a[1] + 10) return;
      const d = a[2];
      if (d < bd) { bd = d; best = u; }
    });
    return best;
  };
  /* неподвижная фигура в позе (пленник и т. п.): тело id, движение key в момент t; cb(holder) */
  UN.staticFigure = function (id, key, t, cb) {
    const M3 = DW.M3, bi = M3 && (M3.bodies[id] || M3.bodies.krut);
    if (!bi) return;
    R3.loadGLB('models/' + (R3.q() < 2 && bi.lo ? bi.lo : bi.f) + '.glb').then(function (gl) {
      if (!gl) return;
      const body = makeBody(gl, bi.h || 1.8, true);
      retargetSetup(body);
      const pose = samplePose(libClip(key) ? key : 'idle', t, null);
      if (pose) applyPose(body, pose);
      cb(body.holder);
    });
  };
  UN.ent = function (u) { return ents[u.id]; };
  /* пасть мутанта (откуда летит плевок, валит пар при рыке) */
  UN.mouth = function (u) {
    const e = ents[u.id];
    return e && e.ready && e.rig && e.rig.mouthO ? e.rig.mouthO.getWorldPosition(V()) : null;
  };
  /* начать приём мутанта вручную (крючки r3d/mfx.js: MF.roar, MF.leap, MF.brood): kind — roar, leap, brood… */
  UN.act = function (u, kind, o) {
    const e = ents[u.id];
    if (!e || e.kind !== 'creature' || !e.ready || !e.rig || !u.alive) return false;
    if (kind === 'roar') kind = crRoarKind(u);
    if (!kind) return false;
    e.act = mkAct(e, u, kind, TR2().now(), o);
    return true;
  };
  // для модуля хвата (r3d/grip.js) и стенда настройки хвата (tools/three3d/griplab)
  UN._lib = { makeBody: makeBody, makeWeapon: makeWeapon, retargetSetup: retargetSetup, samplePose: samplePose, applyPose: applyPose, gunMatrix: gunMatrix, torso: torso, handsTo: handsTo, GRIP: GRIP, libClip: libClip };
  UN.group = function () { return group; };
})(window.DW);
