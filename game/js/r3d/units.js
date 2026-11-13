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
      g: g, len: w.len, free: !!w.free, hipAim: !!w.hip,
      fore: V(0, (box.min.y + (w.fy !== undefined ? w.fy : 0.55) * size.y - yg) * k, -(w.fore - w.grip) * L * k),
      muzzle: V(0, (box.min.y + (w.my !== undefined ? w.my : 0.75) * size.y - yg) * k, -(1 - w.grip) * L * k),
      buttZ: w.grip * L * k, buttY: (box.min.y + (w.by !== undefined ? w.by : 0.62) * size.y - yg) * k
    };
  }

  /* ---------- Хват от корпуса (как в tools/art3d/baker.js) ---------- */
  const GRIP = {
    // приклад — в плечевую впадину (раньше был за плечевым суставом: правый локоть уходил за спину);
    // в переноске — у подмышки, чтобы локоть не заходил в корпус
    aim: { butt: [-0.05, -0.015, 0.06], pitch: 2, yaw: 4, roll: 0, level: true },
    carry: { butt: [-0.03, -0.135, 0.12], pitch: -30, yaw: 20, roll: -6, minEl: -32, ground: true },
    hip: { butt: [0.0, -0.34, 0.0], pitch: 0, yaw: 6, roll: 0, level: true },
    sling: { butt: [-0.14, -0.5, -0.17], pitch: 38, yaw: 42, roll: 0, back: true }
  };
  const _a = V(), _b = V(), _c = V(), _d = V();
  function torso(B) {
    const R = B.RightArm.getWorldPosition(V()), L = B.LeftArm.getWorldPosition(V());
    const top = (B.Neck || B.Head).getWorldPosition(_a), hip = B.Hips.getWorldPosition(_b);
    const X = R.clone().sub(L).normalize();
    const Y = top.clone().sub(hip); Y.addScaledVector(X, -Y.dot(X)).normalize();
    const Z = V().crossVectors(Y, X).normalize();
    return { R: R, L: L, X: X, Y: Y, Z: Z };
  }
  const UP = V(0, 1, 0);
  function gunMatrix(Tq, wpn, g, groundY) {
    const butt = Tq.R.clone().addScaledVector(Tq.X, g.butt[0]).addScaledVector(Tq.Y, g.butt[1]).addScaledVector(Tq.Z, g.butt[2]);
    const pitch = g.pitch * Math.PI / 180, yaw = g.yaw * Math.PI / 180, roll = g.roll * Math.PI / 180;
    let dir;
    if (g.level) {
      const zh = Tq.Z.clone(); zh.y = 0; zh.normalize();
      const xh = Tq.X.clone(); xh.y = 0; xh.normalize();
      dir = zh.multiplyScalar(Math.cos(pitch) * Math.cos(yaw)).addScaledVector(xh, -Math.cos(pitch) * Math.sin(yaw)).addScaledVector(UP, Math.sin(pitch)).normalize();
    } else {
      dir = Tq.Z.clone().multiplyScalar((g.back ? -1 : 1) * Math.cos(pitch) * Math.cos(yaw)).addScaledVector(Tq.X, -Math.cos(pitch) * Math.sin(yaw)).addScaledVector(Tq.Y, Math.sin(pitch)).normalize();
    }
    const el = Math.asin(Math.max(-1, Math.min(1, dir.y)));
    let elMin = g.minEl !== undefined ? g.minEl * Math.PI / 180 : -Math.PI / 2;
    if (g.ground) elMin = Math.max(elMin, Math.asin(Math.max(-1, Math.min(1, (0.08 - (butt.y - groundY)) / 1.45))));
    if (el < elMin) { const h = dir.clone(); h.y = 0; if (h.lengthSq() < 1e-6) h.copy(Tq.Z).setY(0); h.normalize(); dir = h.multiplyScalar(Math.cos(elMin)).addScaledVector(UP, Math.sin(elMin)).normalize(); }
    const zW = dir.clone().negate();
    // оружие стоит ровно (магазином вниз) по вертикали мира, а не по корпусу: в движениях корпус бывает повёрнут
    // и ствол заваливался набок (СВД у тяжёлого бойца); за спиной — по корпусу
    const upRef = g.back ? Tq.Y : UP;
    let yW = upRef.clone().addScaledVector(zW, -upRef.dot(zW)).normalize();
    yW.applyAxisAngle(dir, roll);
    const xW = V().crossVectors(yW, zW).normalize();
    yW = V().crossVectors(zW, xW).normalize();
    const M = new THREE.Matrix4().makeBasis(xW, yW, zW);
    const buttL = V(0, wpn.buttY || 0.03, wpn.buttZ).applyMatrix4(new THREE.Matrix4().extractRotation(M));
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
  /* мировой поворот кости по цепочке родителей (без updateMatrixWorld) */
  function worldQ(body, bone) {
    const c = body.wq[bone.uuid];
    if (c) return c;
    const p = bone.parent;
    let pq;
    if (!p || !p.isBone) { pq = p ? p.getWorldQuaternion(new THREE.Quaternion()) : new THREE.Quaternion(); }
    else pq = worldQ(body, p);
    const w = pq.clone().multiply(bone.quaternion);
    body.wq[bone.uuid] = w;
    return w;
  }
  function applyPose(body, pose) {
    const L = DW.ANIM3;
    body.holder.updateMatrixWorld(true);
    body.wq = {};
    _hq.copy(body.holder.quaternion);
    for (let i = 0; i < L.bones.length; i++) {
      const k = L.bones[i], b = body.B[k];
      if (!b) continue;
      _q.set(pose.q[i * 4], pose.q[i * 4 + 1], pose.q[i * 4 + 2], pose.q[i * 4 + 3]);
      // в осях персонажа: d · выравнивание · покой; в мире — ещё поворот держателя
      const target = _hq.clone().multiply(_q).multiply(body.align[k]).multiply(body.rest[k].wq);
      const pw = b.parent && b.parent.isBone ? worldQ(body, b.parent) : (b.parent ? b.parent.getWorldQuaternion(_pq) : new THREE.Quaternion());
      b.quaternion.copy(pw.clone().invert().multiply(target));
      body.wq[b.uuid] = target;
      if (k === 'Hips') {
        const want = body.rest.Hips.wp.clone().add(pose.hp.clone().multiplyScalar(body.hipK));
        b.position.copy(b.parent.worldToLocal(body.holder.localToWorld(want)));
      }
    }
    body.holder.updateMatrixWorld(true);
  }

  /* ---------- Поза бойца (та же логика, что в 2D) ---------- */
  const TR2 = function () { return DW.TR2 || DW.TR; };
  function walls4(u) {
    return DW.BT.DIR4.find(function (q) { const o = DW.BT.objAt(u.x + q[0], u.y + q[1]); return o && D.OBJ[o].cover === 2; });
  }
  /* → { key, t (с от начала движения), facing (рад, если стойка задаёт), speed } */
  function humanPose(e, u, t) {
    const tr = TR2();
    const tw = tr.tweenOf(u.id);
    const an = tr.curAnimOf(u);
    const has = UN.has;
    const dur = function (k) { const c = libClip(k); return c ? c.dur : 1; };
    const ts = t / 1000;
    if (!u.alive) {
      if (!e.die) { const v = ['die', 'die2', 'die3'][(u.id || 0) % 3]; e.die = has(v) ? v : 'die'; }
      // падение в естественном темпе: от момента гибели (тела с начала боя — сразу лежат)
      if (e.dieT0 === undefined) e.dieT0 = an && an.kind === 'die' && an.p < 1 ? tr.now() - an.p * 820 : -1e9;
      return { key: e.die, t: Math.min(dur(e.die), (tr.now() - e.dieT0) / 1000 * 1.1) };
    }
    if (tw && tw.kind === 'step') {
      // перемещение идёт со скоростью бега трусцой (2,3 клетки/с, рывок — 3,6): шаг «ходьба» семенил бы;
      // берём боевой бег с оружием (как в XCOM), цикл — 1,9 клетки; скрытно — крадущийся шаг, цикл — 1 клетка
      const Bq = DW.BT.get();
      let key = has('run') ? 'run' : 'walk';
      if (u.side === 'p' && Bq && Bq.concealed && has('sneak')) key = 'sneak';
      const per = key === 'sneak' ? 1.0 : (key === 'run' ? 1.9 : 1.3);
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
          if (P.reload > 0 && has('reload') && !(c2 >= 1 || u.overwatch)) return { key: 'reload', t: P.reload * dur('reload'), recoil: 0 };
          if (c2 === 2) return { key: has('aim') ? 'aim' : 'shoot', t: 0, recoil: P.recoil, stepOut: true };
          if ((c2 === 1 || u.overwatch) && has('kneel')) return { key: 'kneel', t: p * dur('kneel'), recoil: P.recoil };
          return { key: has('aim') ? 'aim' : 'shoot', t: 0, recoil: P.recoil };
        }
        case 'reload': return { key: 'reload', t: p * dur('reload') };
        case 'hit': { const k = has('hit2') ? 'hit2' : 'hit'; return { key: k, t: p * dur(k) }; }
        case 'throw': { const k = cv >= 1 && has('throwk') ? 'throwk' : (has('throw') ? 'throw' : 'melee'); return { key: k, t: p * dur(k) }; }
        case 'atk': { const k = u.side === 'e' && has('punch') ? 'punch' : 'melee'; return { key: k, t: p * dur(k) }; }
        case 'slide': { const k = has('slide') ? 'slide' : 'crouch'; return { key: k, t: p * dur(k) }; }
        case 'heal': return { key: has('heal') ? 'heal' : 'idle', t: ts };
        case 'scan': case 'signal': case 'look': case 'check':
          if (u.side === 'p' && has('idle2')) return { key: 'idle2', t: p * dur('idle2') };
          return { key: 'idle', t: ts + (u.id || 0) };
        case 'aimup': case 'aimhold':
          if (cv === 2) return { key: has('aim') ? 'aim' : 'shoot', t: 0, stepOut: true };
          if ((cv === 1 || u.overwatch) && has('kneel')) return { key: 'kneel', t: 0 };
          return { key: has('aim') ? 'aim' : 'shoot', t: 0 };
        default: return { key: 'idle', t: ts + (u.id || 0) };
      }
    }
    const Bv = DW.BT.get();
    if (Bv && Bv.over === 'victory' && u.side === 'p' && has('cheer')) return { key: 'cheer', t: ts + (u.id || 0) };
    if (u.panicked && has('panic')) return { key: 'panic', t: ts };
    if (u.hunker && has('duck')) return { key: 'duck', t: ts + (u.id || 0) };
    if (u.hunker && has('hunker')) return { key: 'hunker', t: 0 };
    if (u.overwatch && has('watch')) return { key: 'watch', t: ts + (u.id || 0) };
    const cv = tr.coverLevel(u);
    if (cv === 1 && has('kneel')) return { key: 'kneel', t: 0 };
    if (cv === 2) {
      const wd = walls4(u);
      return { key: 'idle', t: ts + (u.id || 0) * 3.1, facing: wd ? Math.atan2(wd[1], wd[0]) + Math.PI / 2 : null };
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
  function creaturePose(e, u, t) {
    const tr = TR2();
    const tw = tr.tweenOf(u.id), an = tr.curAnimOf(u);
    const ts = t / 1000;
    if (!u.alive) return { key: 'die', p: an && an.kind === 'die' ? U.clamp(an.p, 0, 1) : 1 };
    if (tw && tw.kind === 'step') return { key: tw.run && e.cl.run ? 'run' : 'walk', ph: ((tr.walkPhase(u) || 0) / (Math.PI * 2) % 1 + 1) % 1 };
    if (an) {
      const p = U.clamp(an.p, 0, 0.999);
      switch (an.kind) {
        case 'shoot': case 'throw': case 'atk': return { key: 'atk', p: p };
        case 'charge': return { key: 'atk', p: 0 };
        case 'hit': return { key: 'hit', p: p };
        case 'shake': case 'sniff': return { key: e.cl.roar ? 'roar' : 'idle', p: p, ts: ts };
      }
    }
    return { key: 'idle', ts: ts + (u.id || 0) };
  }

  /* ---------- Набор моделей ---------- */
  const ents = {};       // id → сущность
  let group = null, refAK = null;
  UN.init = function (B) {
    if (group) { R3.scene.remove(group); }
    spots = [];
    for (const k in ents) delete ents[k];
    group = new THREE.Group(); group.name = 'units';
    R3.scene.add(group);
    const M3 = DW.M3;
    if (!refAK && M3 && M3.weapons.ak) R3.loadGLB('models/' + M3.weapons.ak.f + '.glb').then(function (gl) { if (gl) refAK = makeWeapon(gl, M3.weapons.ak); });
    B.units.forEach(function (u) { ensure(u); });
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
  function bodyIdOf(u) {
    const S = DW.S3 && DW.S3.setsFor(u);
    if (!S) return null;
    if (S.kind === 'turret') return { kind: 'turret' };
    if (S.kind === 'creature') { let id = S.body.slice(2); return { kind: 'creature', id: id }; }
    return { kind: 'human', id: S.body.slice(2), weapon: S.weapon ? S.weapon.slice(2) : null };
  }
  function ensure(u) {
    if (ents[u.id]) return ents[u.id];
    const M3 = DW.M3;
    const k = bodyIdOf(u);
    const e = ents[u.id] = { u: u, kind: k ? k.kind : null, ready: false, prev: null, cur: null, x: 0, cl: {} };
    if (!k || !M3) return e;
    if (k.kind === 'human') {
      const bi = M3.bodies[k.id] || M3.bodies.krut;
      Promise.all([R3.loadGLB('models/' + (R3.q() < 2 && bi.lo ? bi.lo : bi.f) + '.glb'), k.weapon && M3.weapons[k.weapon] ? R3.loadGLB('models/' + M3.weapons[k.weapon].f + '.glb') : null,
        M3.weapons.rpg ? R3.loadGLB('models/' + M3.weapons.rpg.f + '.glb') : null]).then(function (r) {
        if (!r[0] || !group || ents[u.id] !== e) return;
        const body = makeBody(r[0], bi.h || 1.8, true);
        retargetSetup(body);
        e.body = body;
        group.add(body.holder);
        e.blob = blob(0.95); group.add(e.blob);
        if (r[1]) { e.wpn = makeWeapon(r[1], M3.weapons[k.weapon]); group.add(e.wpn.g); }
        if (r[2] && u.cls === 'heavy') { e.rpg = makeWeapon(r[2], M3.weapons.rpg); e.rpg.g.visible = false; group.add(e.rpg.g); }
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
    const night = B.tod === 'night' || B.tod === 'cave' || B.tod === 'interior' || (B.dark && B.lights);
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
      const p = W ? V(0, 0.05, -0.2).applyMatrix4(W.g.matrixWorld) : e.body.B.Head.getWorldPosition(V());
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
      // положение: как в 2D (ход по сглаженному пути, прижаться к укрытию), высота по уровню
      const p = u.alive ? tr.leanPos(u) : [u.x, u.y];
      const lvl = tr.uLevel(u);
      e.body.holder.position.set((p[0] + 0.5) * T, lvl * LV, (p[1] + 0.5) * T);
      if (e.blob) { e.blob.visible = u.alive; e.blob.position.set(e.body.holder.position.x, lvl * LV + 0.015, e.body.holder.position.z); }
      let face = tr.dispFace(u);
      if (e.kind === 'turret') { e.body.holder.rotation.y = -face; return; }
      if (e.kind === 'human') updHuman(e, u, t, dt, face);
      else updCreature(e, u, t, dt, face);
    });
  };
  function updHuman(e, u, t, dt, face) {
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
    e.so = (e.so || 0) + ((P.stepOut ? 1 : 0) - (e.so || 0)) * Math.min(1, dt * 9);
    if (!P.stepOut && e.so < 0.02) { e.so = 0; e.soDir = null; }
    if (e.so > 0 && e.soDir) { e.body.holder.position.x += e.soDir[0] * e.so * 0.55 * T; e.body.holder.position.z += e.soDir[1] * e.so * 0.55 * T; if (e.blob) { e.blob.position.x = e.body.holder.position.x; e.blob.position.z = e.body.holder.position.z; } }
    e.body.holder.rotation.y = Math.PI / 2 - face + (c.yaw || 0) * Math.PI / 180;
    e.body.holder.scale.setScalar(1);
    // смена движения — плавно: старая поза растворяется за 0,12–0,25 с
    if (e.key !== P.key) {
      if (e.key) { e.from = { q: Float32Array.from(e.pose.q), hp: e.pose.hp.clone() }; e.fromT = t; e.fromD = (P.key === 'aim' || P.key === 'kneel' || P.key === 'shoot') ? 110 : ((P.key === 'walk' || P.key === 'run' || e.key === 'walk' || e.key === 'run' || P.key === 'sneak') ? 150 : 230); }
      e.key = P.key;
    }
    samplePose(P.key, P.t, e.pose);
    if (e.from) {
      const k = (t - e.fromT) / e.fromD;
      if (k >= 1) e.from = null;
      else blendPose(e.from, e.pose, k * k * (3 - 2 * k), e.pose);
    }
    applyPose(e.body, e.pose);
    // оружие
    const rpg = e.rpg && TR2().curAnimOf(u) && TR2().curAnimOf(u).kind === 'shoot' && TR2().curAnimOf(u).a.data && TR2().curAnimOf(u).a.data.rpg;
    if (e.rpg) e.rpg.g.visible = !!rpg;
    const W = rpg ? e.rpg : e.wpn;
    if (e.wpn) e.wpn.g.visible = !rpg;
    if (!W || !refAK) return;
    if (!e.cal || e.cal.w !== W) calibrate(e, W);
    let mode = c.mode || 'carry';
    if (mode === 'left') mode = 'sling';
    const groundY = e.body.holder.position.y;
    let M;
    if (mode === 'hand' || mode === 'left') {
      const hand = mode === 'left' ? e.body.B.LeftHand : e.body.B.RightHand;
      M = new THREE.Matrix4().compose(hand.getWorldPosition(V()), hand.getWorldQuaternion(new THREE.Quaternion()), V(1, 1, 1)).multiply(mode === 'left' ? e.cal.offL : e.cal.offR);
      if (c.drop && !u.alive) M = dropLerp(e, u, M, c, P);
      // кисть смыкается на рукояти (ствол по-прежнему идёт за кистью движения)
      else if (mode === 'hand' && R3.grip && R3.grip.apply) R3.grip.apply({ body: e.body, W: W, M: M, mode: 'hand', grip: V().setFromMatrixPosition(M), fore: null, key: P.key, freeL: true, reload: false });
    } else {
      const Tq = torso(e.body.B);
      const grp = (W.hipAim && mode === 'aim') ? 'hip' : mode;
      const G = GRIP[grp] || GRIP.carry;
      M = gunMatrix(Tq, W, G, groundY);
      let grip = null, fore = null;
      if (!W.free) {
        const MA = gunMatrix(Tq, refAK, G, groundY);
        const g0 = V().setFromMatrixPosition(MA);
        grip = g0.clone(); fore = refAK.fore.clone().applyMatrix4(MA);
        const sh = mode === 'sling' ? 0 : Math.max(0, W.buttZ - refAK.buttZ);
        M.setPosition(g0.addScaledVector(V(0, 0, -1).transformDirection(M), sh));
      } else { grip = V().setFromMatrixPosition(M); fore = W.fore.clone().applyMatrix4(M); }
      // руки на оружие (кроме «за спиной»); перезарядка — левая рука: магазин → подсумок на поясе → магазин → цевьё
      if (c.freeL && P.key === 'reload') {
        const pr = c.dur > 0 ? U.clamp(P.t / c.dur, 0, 1) : 0;
        const up = V(0, 1, 0).transformDirection(M), fw = V(0, 0, -1).transformDirection(M);
        const mag = grip.clone().lerp(fore, 0.42).addScaledVector(up, -0.09);
        const Tq = torso(e.body.B);
        const pouch = e.body.B.Hips.getWorldPosition(V()).addScaledVector(Tq.Z, 0.16).addScaledVector(Tq.X, -0.12).addScaledVector(Tq.Y, 0.05);
        const sm = function (a0, a1, x) { const k = U.clamp((x - a0) / (a1 - a0), 0, 1); return k * k * (3 - 2 * k); };
        // 0–0,2 к магазину, 0,25–0,45 вниз к поясу, 0,55–0,75 обратно, 0,82–1 на цевьё
        let L = fore.clone().lerp(mag, sm(0, 0.18, pr));
        L.lerp(pouch, sm(0.25, 0.45, pr) * (1 - sm(0.55, 0.75, pr)));
        L.lerp(fore, sm(0.82, 1, pr));
        void fw;
        handsTo(e.body, grip, L, false);
        if (R3.grip && R3.grip.apply) R3.grip.apply({ body: e.body, W: W, M: M, mode: mode, grip: grip, fore: L, key: P.key, freeL: false, reload: true });
      } else if (mode !== 'sling') {
        handsTo(e.body, grip, fore, c.freeL);
        // поворот кистей (ладонь на рукояти, левая — под цевьём) и сгиб пальцев — модуль r3d/grip.js
        if (R3.grip && R3.grip.apply) R3.grip.apply({ body: e.body, W: W, M: M, mode: mode, grip: grip, fore: fore, key: P.key, freeL: c.freeL, reload: false });
      } else if (R3.grip && R3.grip.relax) R3.grip.relax(e.body);   // ствол за спиной — пальцы разжаты
      // отдача: толчок назад по стволу и стволом вверх
      if (P.recoil > 0) {
        const kick = P.recoil * 0.05;
        const back = V(0, 0, kick).transformDirection(M).multiplyScalar(kick);
        M.multiply(tmpM.makeRotationX(P.recoil * 5 * Math.PI / 180));
        M.setPosition(V().setFromMatrixPosition(M).add(back));
      }
    }
    W.g.matrix.copy(M);
    W.g.matrixWorldNeedsUpdate = true;
    W.g.updateMatrixWorld(true);
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
  /* гибель: ствол выпадает и ложится на землю у кисти (цель — по концу движения) */
  function dropLerp(e, u, Mh, c, P) {
    const pr = c.dur > 0 ? U.clamp(P.t / c.dur, 0, 1) : 1;
    const x = U.clamp((pr - c.drop[0]) / (c.drop[1] - c.drop[0]), 0, 1), w = x * x * (3 - 2 * x);
    if (!e.dropT) {
      // куда ляжет: ствол по горизонтали, на бок, у кисти в конце движения
      const pos = V().setFromMatrixPosition(Mh);
      const dir = V(0, 0, -1).transformDirection(Mh); dir.y = 0;
      if (dir.lengthSq() < 0.04) dir.set(Math.cos(u.face || 0), 0, Math.sin(u.face || 0));
      dir.normalize();
      const zW = dir.clone().negate(), xW = V(0, 1, 0), yW = V().crossVectors(zW, xW).normalize();
      const end = samplePose(c === libClip(e.key) ? e.key : 'die', c.dur, { q: new Float32Array(e.pose.q.length), hp: V() });
      // кисть в конце: временно ставим конечную позу
      const keep = { q: Float32Array.from(e.pose.q), hp: e.pose.hp.clone() };
      applyPose(e.body, end);
      const hp2 = e.body.B.RightHand.getWorldPosition(V());
      applyPose(e.body, keep);
      e.dropT = new THREE.Matrix4().makeBasis(xW, yW, zW).setPosition(hp2.x, e.body.holder.position.y + 0.035, hp2.z);
      void pos;
    }
    if (w <= 0) return Mh;
    const p0 = V().setFromMatrixPosition(Mh), q0 = new THREE.Quaternion().setFromRotationMatrix(Mh);
    const p1 = V().setFromMatrixPosition(e.dropT), q1 = new THREE.Quaternion().setFromRotationMatrix(e.dropT);
    return new THREE.Matrix4().compose(p0.lerp(p1, w), q0.slerp(q1, w), V(1, 1, 1));
  }
  function updCreature(e, u, t, dt, face) {
    const P = creaturePose(e, u, t);
    const sc = TR2().unitScale(u) / 1.13;
    e.body.holder.scale.setScalar(Math.min(1.25, sc));
    e.body.holder.rotation.order = 'YXZ';
    e.body.holder.rotation.y = Math.PI / 2 - face;
    let cl = e.cl[P.key] || e.cl.idle || e.cl.walk;
    if (!cl) return;
    // плавный переход между клипами
    if (e.ckey !== P.key) { e.cprev = e.cl[e.ckey] || null; e.ckey = P.key; e.cT = t; }
    const k = Math.min(1, (t - (e.cT || 0)) / 200);
    for (const n in e.cl) e.cl[n].act.weight = 0;
    const timeOf = function (c2, P2) {
      const a = c2.a, t0 = a.t0 || 0, t1 = a.t1 !== undefined ? Math.min(a.t1, c2.dur) : c2.dur;
      if (P2.ph !== undefined) return t0 + (t1 - t0) * P2.ph;
      if (P2.p !== undefined) return t0 + (t1 - t0) * P2.p;
      return t0 + ((P2.ts || 0) % Math.max(0.1, t1 - t0));
    };
    cl.act.time = timeOf(cl, P); cl.act.weight = e.cprev && e.cprev !== cl ? k : 1;
    if (e.cprev && e.cprev !== cl && k < 1) e.cprev.act.weight = 1 - k;
    e.mixer.update(0);
    // таз — на месте (клипы с ходом уводили тело вперёд); при гибели — не дальше 0,25 м
    if (e.hipB && e.hip0) {
      const hp = e.hipB.position;
      const dx = hp.x - e.hip0.x, dz = hp.z - e.hip0.z;
      if (P.key === 'die') { const l = Math.hypot(dx, dz), mx = 0.25 / Math.max(0.001, e.body.k); if (l > mx) { hp.x = e.hip0.x + dx * mx / l; hp.z = e.hip0.z + dz * mx / l; } }
      else { hp.x = e.hip0.x + dx * 0.15; hp.z = e.hip0.z + dz * 0.15; }
    }
    // наклоны (четвероногие без клипов атаки, попадания, гибели)
    const fx = cl.a.fx ? fxAt(cl.a.fx, P.p !== undefined ? P.p : ((P.ts || 0) % 1)) : null;
    if (fx) {
      const piv = e.body.H * 0.42;
      e.body.holder.rotation.x = fx.rx; e.body.holder.rotation.z = fx.rz;
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(fx.rx, 0, fx.rz, 'YXZ'));
      const pv = V(0, piv, 0), off = pv.clone().sub(pv.clone().applyQuaternion(q));
      const cy = Math.cos(e.body.holder.rotation.y), sy = Math.sin(e.body.holder.rotation.y);
      e.body.holder.position.x += (off.x * cy + (off.z + fx.fw) * sy); e.body.holder.position.z += (-off.x * sy + (off.z + fx.fw) * cy);
      e.body.holder.position.y += off.y;
      e.body.holder.scale.y *= fx.sy;
    } else { e.body.holder.rotation.x = 0; e.body.holder.rotation.z = 0; }
    e.body.holder.updateMatrixWorld(true);
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
  // для модуля хвата (r3d/grip.js) и стенда настройки хвата (tools/three3d/griplab)
  UN._lib = { makeBody: makeBody, makeWeapon: makeWeapon, retargetSetup: retargetSetup, samplePose: samplePose, applyPose: applyPose, gunMatrix: gunMatrix, torso: torso, handsTo: handsTo, GRIP: GRIP, libClip: libClip };
  UN.group = function () { return group; };
})(window.DW);
