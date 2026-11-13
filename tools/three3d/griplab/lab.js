'use strict';
/* Стенд хвата оружия (tools/three3d/griplab): тот же код, что в игре (game/js/r3d/units.js → R3.units._lib,
   game/js/r3d/grip.js → R3.grip), поза бойца собирается как в units.js updHuman/calibrate. Ползунки меняют
   R3.grip.P на лету, «JSON» — параметры для вставки в grip.js. Режим ?sheet=1 — лист снимков без окна
   (sheet.js): bodies, weapons, poses (движение[@доля][:режим][~поворот°]), views, cell, grip=0 (без grip.js),
   hook=1 (grip.apply и «в кисти» — предлагаемая правка units.js), dbg=1 (оси, точки, сетка оружия 2 см),
   wa=0.5 (оружие полупрозрачно), nobody=1 (виды оружия без тела), trace=1 (проходы решателя), P={…} (поправки P). */
(function () {
  const DW = window.DW, R3 = DW.R3, THREE = R3.THREE, UL = R3.units._lib, M3 = DW.M3, GP = R3.grip;
  const BASE = '../../../game/';
  const qs = new URLSearchParams(location.search);
  const SHEET = qs.get('sheet') === '1';
  const V = function (x, y, z) { return new THREE.Vector3(x || 0, y || 0, z || 0); };
  const DEF = JSON.parse(JSON.stringify(GP.P));          // исходные параметры (кнопка «Сброс»)

  /* ---------- Сцена ---------- */
  const canvas = document.getElementById('cv');
  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: !SHEET, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.setScissorTest(true);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x3a3f46);
  scene.add(new THREE.HemisphereLight(0xe8eeff, 0x4a3c30, 1.6));
  const sun = new THREE.DirectionalLight(0xfff2e0, 2.4); sun.position.set(2.5, 6, 4); scene.add(sun);
  const fill = new THREE.DirectionalLight(0xc8d8ff, 0.9); fill.position.set(-4, 2, -3); scene.add(fill);
  const grid = new THREE.GridHelper(6, 24, 0x666c74, 0x4a5058); scene.add(grid);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.02, 60);

  /* отладка: точки хвата и оси кистей (F — красная, нормаль ладони — зелёная) */
  const dbgG = new THREE.Group(); scene.add(dbgG);
  const dot = function (c) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.005, 10, 8), new THREE.MeshBasicMaterial({ color: c, depthTest: false })); m.renderOrder = 9; dbgG.add(m); return m; };
  const dGrip = dot(0xff3030), dFore = dot(0x30a0ff), dPalmR = dot(0xffff40), dPalmL = dot(0xffff40);
  const arrow = function (c) { const a = new THREE.ArrowHelper(V(1, 0, 0), V(), 0.06, c, 0.022, 0.01); a.line.material.depthTest = false; a.cone.material.depthTest = false; a.line.renderOrder = a.cone.renderOrder = 9; dbgG.add(a); return a; };
  const aRF = arrow(0xff4040), aRN = arrow(0x40ff40), aLF = arrow(0xff4040), aLN = arrow(0x40ff40);

  /* ---------- Загрузка ---------- */
  const glbs = {};
  function load(f) { return glbs[f] || (glbs[f] = R3.loadGLB(BASE + 'models/' + f + '.glb')); }
  let refAK = null;
  async function makeSet(bodyId, wpnId, lo) {
    const bi = M3.bodies[bodyId] || M3.bodies.krut, wi = M3.weapons[wpnId] || M3.weapons.ak;
    const r = await Promise.all([load(lo && bi.lo ? bi.lo : bi.f), load(wi.f), load(M3.weapons.ak.f)]);
    if (!refAK) refAK = UL.makeWeapon(r[2], M3.weapons.ak);
    const body = UL.makeBody(r[0], bi.h || 1.8, true);
    UL.retargetSetup(body);
    const W = UL.makeWeapon(r[1], wi);
    // сетка в плоскости YZ оружия (клетка 2 см, оси — жёлтым): мерить рукоять и цевьё для P.wpn
    const gp = [], gc = [];
    for (let z = -0.6; z <= 0.3001; z += 0.02) { const k = Math.abs(z) < 1e-6 ? 1 : (Math.abs(Math.round(z * 50) % 5) === 0 ? 0.6 : 0.3); gp.push(0, -0.24, z, 0, 0.12, z); gc.push(k, k, k * (k === 1 ? 0 : 1), k, k, k * (k === 1 ? 0 : 1)); }
    for (let y = -0.24; y <= 0.1201; y += 0.02) { const k = Math.abs(y) < 1e-6 ? 1 : (Math.abs(Math.round(y * 50) % 5) === 0 ? 0.6 : 0.3); gp.push(0, y, -0.6, 0, y, 0.3); gc.push(k, k, k * (k === 1 ? 0 : 1), k, k, k * (k === 1 ? 0 : 1)); }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3)); gg.setAttribute('color', new THREE.Float32BufferAttribute(gc, 3));
    const wgrid = new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true, opacity: 0.55 }));
    wgrid.renderOrder = 8; wgrid.visible = false; W.g.add(wgrid); W.grid = wgrid;
    const wa = +(qs.get('wa') || 1);
    if (wa < 1) W.g.traverse(function (m) { if (m.isMesh) { m.material = m.material.clone(); m.material.transparent = true; m.material.opacity = wa; m.material.depthWrite = false; } });
    return { id: bodyId, wid: wpnId, body: body, W: W, pose: { q: new Float32Array(DW.ANIM3.bones.length * 4), hp: V() }, cal: null };
  }

  /* ---------- Поза (как units.js updHuman / calibrate) ---------- */
  let gripOn = qs.get('grip') !== '0', handHook = qs.get('hook') !== '0';   // как в units.js (hook=0 — без)
  function calibrate(S) {
    const body = S.body, W = S.W;
    const keep = { q: Float32Array.from(S.pose.q), hp: S.pose.hp.clone() };
    const tmp = { q: new Float32Array(S.pose.q.length), hp: V() };
    UL.samplePose('idle', 0.3, tmp);
    UL.applyPose(body, tmp);
    const Tq = UL.torso(body.B);
    const M = UL.gunMatrix(Tq, W, UL.GRIP.carry, body.holder.position.y);
    if (!W.free && refAK) {
      const MA = UL.gunMatrix(Tq, refAK, UL.GRIP.carry, body.holder.position.y);
      M.setPosition(V().setFromMatrixPosition(MA).addScaledVector(V(0, 0, -1).transformDirection(M), Math.max(0, W.buttZ - refAK.buttZ)));
      UL.handsTo(body, V().setFromMatrixPosition(MA), refAK.fore.clone().applyMatrix4(MA), false);
      if (gripOn) GP.apply({ body: body, W: W, M: M, mode: 'carry', grip: V().setFromMatrixPosition(MA), fore: refAK.fore.clone().applyMatrix4(MA), key: 'idle', freeL: false, reload: false, calib: true });
    }
    const rel = function (bone) { return new THREE.Matrix4().compose(bone.getWorldPosition(V()), bone.getWorldQuaternion(new THREE.Quaternion()), V(1, 1, 1)).invert().multiply(M); };
    S.cal = { offR: rel(body.B.RightHand), offL: rel(body.B.LeftHand) };
    UL.applyPose(body, keep);
  }
  const sm = function (a0, a1, x) { const k = Math.max(0, Math.min(1, (x - a0) / (a1 - a0))); return k * k * (3 - 2 * k); };
  function poseSet(S, o) {
    const body = S.body, B = body.B, W = S.W;
    const c = UL.libClip(o.key) || UL.libClip('idle');
    body.holder.position.set(0, 0, 0); body.holder.rotation.y = (o.yaw || 0) * Math.PI / 180 + (c.yaw || 0) * Math.PI / 180;
    body.holder.updateMatrixWorld(true);
    UL.samplePose(UL.libClip(o.key) ? o.key : 'idle', o.t, S.pose);
    UL.applyPose(body, S.pose);
    calibrate(S);
    let mode = o.mode && o.mode !== 'auto' ? o.mode : (c.mode || 'carry');
    if (mode === 'left') mode = 'sling';
    let M, grip = null, fore = null;
    if (mode === 'hand') {
      const hand = B.RightHand;
      M = new THREE.Matrix4().compose(hand.getWorldPosition(V()), hand.getWorldQuaternion(new THREE.Quaternion()), V(1, 1, 1)).multiply(S.cal.offR);
      grip = V().setFromMatrixPosition(M);
      // предлагаемая правка units.js: в движениях «в кисти» тоже вызывать grip.apply (кисть на рукоять)
      if (gripOn && handHook) GP.apply({ body: body, W: W, M: M, mode: 'hand', grip: grip, fore: null, key: o.key, freeL: true, reload: false });
    } else {
      const Tq = UL.torso(B);
      const grp = (W.hipAim && mode === 'aim') ? 'hip' : mode;
      const G = UL.GRIP[grp] || UL.GRIP.carry;
      M = UL.gunMatrix(Tq, W, G, 0);
      if (!W.free) {
        const MA = UL.gunMatrix(Tq, refAK, G, 0);
        const g0 = V().setFromMatrixPosition(MA);
        grip = g0.clone(); fore = refAK.fore.clone().applyMatrix4(MA);
        const sh = mode === 'sling' ? 0 : Math.max(0, W.buttZ - refAK.buttZ);
        M.setPosition(g0.addScaledVector(V(0, 0, -1).transformDirection(M), sh));
      } else { grip = V().setFromMatrixPosition(M); fore = W.fore.clone().applyMatrix4(M); }
      if (c.freeL && o.key === 'reload') {
        const pr = c.dur > 0 ? Math.max(0, Math.min(1, o.t / c.dur)) : 0;
        const up = V(0, 1, 0).transformDirection(M);
        const mag = grip.clone().lerp(fore, 0.42).addScaledVector(up, -0.09);
        const Tq2 = UL.torso(B);
        const pouch = B.Hips.getWorldPosition(V()).addScaledVector(Tq2.Z, 0.16).addScaledVector(Tq2.X, -0.12).addScaledVector(Tq2.Y, 0.05);
        const L = fore.clone().lerp(mag, sm(0, 0.18, pr));
        L.lerp(pouch, sm(0.25, 0.45, pr) * (1 - sm(0.55, 0.75, pr)));
        L.lerp(fore, sm(0.82, 1, pr));
        UL.handsTo(body, grip, L, false);
        if (gripOn) GP.apply({ body: body, W: W, M: M, mode: mode, grip: grip, fore: L, key: o.key, freeL: false, reload: true });
        fore = L;
      } else if (mode !== 'sling') {
        UL.handsTo(body, grip, fore, c.freeL);
        if (gripOn) GP.apply({ body: body, W: W, M: M, mode: mode, grip: grip, fore: fore, key: o.key, freeL: c.freeL, reload: false });
      } else if (gripOn && handHook) GP.relax(body);      // предлагаемая правка units.js: за спиной — пальцы разжаты
    }
    W.g.matrix.copy(M); W.g.matrixWorldNeedsUpdate = true; W.g.updateMatrixWorld(true);
    body.holder.updateMatrixWorld(true);
    S.M = M; S.grip = grip; S.fore = fore; S.mode = mode;
    return S;
  }
  /* ладонь (как palm() в units.js) */
  function palmOf(S, side, out) {
    const h = S.body.B[side + 'Hand'];
    let mid = null; h.traverse(function (o) { if (!mid && o !== h && o.isBone && /Mid|Middle/.test(o.name)) mid = o; });
    out.copy(h.getWorldPosition(V()));
    if (mid) out.lerp(mid.getWorldPosition(V()), 0.75);
    return out;
  }

  /* ---------- Виды ---------- */
  const VIEWS = {
    front: { n: 'спереди' }, side: { n: 'справа' }, sidel: { n: 'слева' }, top: { n: 'сверху' }, back: { n: 'сзади' },
    game: { n: 'камера игры (спереди-справа)' }, gameb: { n: 'камера игры (сзади-слева)' }, gamef: { n: 'камера игры, далеко' },
    rclose: { n: 'правая кисть снаружи' }, rin: { n: 'правая кисть изнутри' }, rbelow: { n: 'правая кисть снизу' },
    lclose: { n: 'левая кисть снизу' }, lup: { n: 'левая кисть сверху' }, lside: { n: 'левая кисть слева' },
    nearr: { n: 'кисти: спереди-справа' }, nearl: { n: 'кисти: спереди-слева' }, neart: { n: 'кисти: сверху (как игра)' }, nearb: { n: 'кисти: снизу-справа' },
    rarm: { n: 'правое предплечье' }, larm: { n: 'левое предплечье' },
    wpn: { n: 'оружие справа' }, wgrip: { n: 'рукоять справа' }, wfore: { n: 'цевьё справа' },
    gl: { n: 'рукоять слева (пальцы)' }, gr: { n: 'рукоять справа (кисть)' }, gd: { n: 'рукоять снизу' }, gb: { n: 'рукоять сзади' }, fu: { n: 'цевьё сверху' }, fr: { n: 'цевьё справа (пальцы)' }, fl: { n: 'цевьё слева (большой)' }, fd: { n: 'цевьё снизу (ладонь)' }
  };
  function setCam(cam, S, v, aspect) {
    const hold = S.body.holder, yaw = hold.rotation.y;
    const rot = function (x, y, z) { const p = V(x, y, z); p.applyAxisAngle(V(0, 1, 0), yaw); return p; };
    const ctr = V(0, 1.05, 0.15).applyAxisAngle(V(0, 1, 0), yaw);
    cam.fov = 30; cam.aspect = aspect || 1; cam.near = 0.02;
    const M = S.M, ax = function (x, y, z) { return V(x, y, z).transformDirection(M).multiplyScalar(Math.hypot(x, y, z)); };
    let pos, tgt = ctr;
    const fig = function (dx, dy, dz, d) { const dir = rot(dx, dy, dz).normalize(); return ctr.clone().addScaledVector(dir, d); };
    switch (v) {
      case 'front': pos = fig(0, 0.15, 1, 3.4); break;
      case 'side': pos = fig(-1, 0.15, 0.05, 3.4); break;
      case 'sidel': pos = fig(1, 0.15, 0.05, 3.4); break;
      case 'back': pos = fig(0, 0.2, -1, 3.4); break;
      case 'top': pos = fig(0.001, 1, 0.02, 3.6); break;
      // камера игры: наклон ~48° (R3.cam.pitch 0.84), с угла
      case 'game': pos = fig(-Math.sin(0.785), Math.tan(0.84), Math.cos(0.785), 4.6); break;
      case 'gameb': pos = fig(Math.sin(0.785), Math.tan(0.84), -Math.cos(0.785), 4.6); break;
      case 'gamef': pos = fig(-Math.sin(0.785), Math.tan(0.84), Math.cos(0.785), 12); break;
      // крупно: камера в осях оружия, всё ближе 0,12 м к кисти отсекается (туловище не заслоняет)
      case 'rclose': tgt = palmOf(S, 'Right', V()); pos = tgt.clone().add(ax(0.34, 0.08, -0.16)); cam.fov = 34; cam.near = 0.22; break;
      case 'rin': tgt = palmOf(S, 'Right', V()); pos = tgt.clone().add(ax(-0.34, 0.1, -0.14)); cam.fov = 34; cam.near = 0.22; break;
      case 'rbelow': tgt = palmOf(S, 'Right', V()); pos = tgt.clone().add(ax(0.14, -0.36, -0.1)); cam.fov = 34; cam.near = 0.22; break;
      case 'lclose': tgt = palmOf(S, 'Left', V()); pos = tgt.clone().add(ax(-0.28, -0.22, -0.14)); cam.fov = 34; cam.near = 0.2; break;
      case 'lup': tgt = palmOf(S, 'Left', V()); pos = tgt.clone().add(ax(0.22, 0.3, -0.08)); cam.fov = 34; cam.near = 0.2; break;
      case 'lside': tgt = palmOf(S, 'Left', V()); pos = tgt.clone().add(ax(-0.38, 0.04, 0.02)); cam.fov = 34; cam.near = 0.2; break;
      // средний план: обе кисти и предплечья (центр — между ладонями)
      case 'nearr': case 'nearl': case 'neart': case 'nearb': {
        tgt = palmOf(S, 'Right', V()).lerp(palmOf(S, 'Left', V()), 0.5);
        const d = v === 'nearr' ? rot(-0.75, 0.45, 0.6) : v === 'nearl' ? rot(0.8, 0.3, 0.55) : v === 'neart' ? rot(-0.45, Math.tan(0.84) * 0.75, 0.45) : rot(-0.55, -0.35, 0.75);
        pos = tgt.clone().addScaledVector(d.normalize(), 1.15); cam.fov = 34; break;
      }
      // предплечье: от локтя до кисти, снаружи-снизу (скрутка, излом запястья)
      case 'rarm': case 'larm': {
        const sd = v === 'rarm' ? 'Right' : 'Left', B = S.body.B;
        tgt = B[sd + 'ForeArm'].getWorldPosition(V()).lerp(B[sd + 'Hand'].getWorldPosition(V()), 0.5);
        const out = B[sd + 'ForeArm'].getWorldPosition(V()).sub(B[sd + 'Arm'].getWorldPosition(V())).normalize();
        pos = tgt.clone().add(rot(v === 'rarm' ? -0.6 : 0.6, -0.3, 0.5).normalize().multiplyScalar(0.55)).addScaledVector(out, 0.0); cam.fov = 34; cam.near = 0.2; break;
      }
      // оружие сбоку (справа, по оси X оружия) — целиком; и крупно рукоять
      case 'wpn': { const L = S.W.len; tgt = V(0, 0, -L * 0.2).applyMatrix4(M); pos = tgt.clone().add(ax(L * 1.9, 0, 0)); cam.fov = 30; cam.near = L * 1.9 - 0.12; break; }
      case 'wgrip': tgt = V(0, -0.05, 0).applyMatrix4(M); pos = tgt.clone().add(ax(0.6, 0, 0)); cam.fov = 30; cam.near = 0.45; break;
      case 'wfore': tgt = S.W.fore.clone().applyMatrix4(M); pos = tgt.clone().add(ax(0.6, 0, 0)); cam.fov = 30; cam.near = 0.45; break;
      // хват по оружию: рукоять слева (кончики пальцев и большой палец), цевьё сверху/справа/слева/снизу
      case 'gl': case 'gr': case 'gd': case 'gb': case 'fu': case 'fr': case 'fl': case 'fd': {
        const w = GP.P.wpn[S.wid] || { g: [0, 0], f: [0, 0] };
        tgt = /^g/.test(v) ? V(w.g[2] || 0, w.g[0], w.g[1]).applyMatrix4(M) : V(w.f[2] || 0, S.W.fore.y + w.f[0], S.W.fore.z + w.f[1]).applyMatrix4(M);
        const d = { gl: [-1, 0.05, -0.15], gr: [1, 0.05, -0.15], gd: [0.05, -1, 0.35], gb: [0.25, 0.3, 1], fu: [0.25, 1, -0.1], fr: [1, 0.15, -0.1], fl: [-1, 0.1, -0.1], fd: [0.1, -1, -0.15] }[v];
        pos = tgt.clone().add(ax(d[0], d[1], d[2]).normalize().multiplyScalar(0.4)); cam.fov = 32; cam.near = 0.3; break;
      }
      default: pos = fig(0, 0.15, 1, 3.4);
    }
    cam.position.copy(pos); cam.up.set(0, 1, 0); cam.lookAt(tgt);
    cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  }
  function updDebug(S, on) {
    dbgG.visible = !!on;
    if (!on || !S) return;
    dGrip.position.copy(S.grip || V()); dFore.position.copy(S.fore || V());
    palmOf(S, 'Right', dPalmR.position); palmOf(S, 'Left', dPalmL.position);
    const G = gripOn ? GP.rig(S.body) : null;
    [['Right', aRF, aRN, 'R'], ['Left', aLF, aLN, 'L']].forEach(function (a) {
      const h = S.body.B[a[0] + 'Hand'], q = h.getWorldQuaternion(new THREE.Quaternion()), p = palmOf(S, a[0], V());
      const sd = G && G[a[3]];
      a[1].visible = a[2].visible = !!sd;
      if (!sd) return;
      a[1].position.copy(p); a[1].setDirection(sd.F.clone().applyQuaternion(q));
      a[2].position.copy(p); a[2].setDirection(sd.N.clone().applyQuaternion(q));
    });
  }

  /* ---------- Лист снимков (без окна) ---------- */
  function deepSet(dst, src) { for (const k in src) { if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k]) && dst[k] && typeof dst[k] === 'object') deepSet(dst[k], src[k]); else dst[k] = src[k]; } }
  // ?P={…} — поправки параметров поверх grip.js (подбор без правки файла)
  if (qs.get('P')) { deepSet(GP.P, JSON.parse(qs.get('P'))); GP.touch(); }
  // ?G={…} — проба поправок units.js GRIP (положение оружия от корпуса) только на стенде
  if (qs.get('G')) deepSet(UL.GRIP, JSON.parse(qs.get('G')));
  async function sheet() {
    const bodies = (qs.get('bodies') || 'krut').split(','), wpns = (qs.get('weapons') || 'ak').split(',');
    const poses = (qs.get('poses') || 'idle,aim').split(','), views = (qs.get('views') || 'game,front,rclose,lclose').split(',');
    const cell = +(qs.get('cell') || 200), lab = 16;
    const rows = [];
    bodies.forEach(function (b) { wpns.forEach(function (w) { poses.forEach(function (p) { rows.push({ b: b, w: w, p: p }); }); }); });
    const Wd = views.length * cell, Hd = rows.length * (cell + lab);
    renderer.setSize(Wd, Hd, false);
    const out = document.createElement('canvas'); out.width = Wd; out.height = Hd;
    const g = out.getContext('2d');
    g.fillStyle = '#202328'; g.fillRect(0, 0, Wd, Hd);
    let S = null, sk = '';
    for (let r = 0; r < rows.length; r++) {
      const R = rows[r];
      if (sk !== R.b + R.w) { if (S) { scene.remove(S.body.holder); scene.remove(S.W.g); } S = await makeSet(R.b, R.w, qs.get('lo') === '1'); scene.add(S.body.holder); scene.add(S.W.g); sk = R.b + R.w; }
      // поза: key[@доля времени][:режим][~поворот°]
      const m = /^([^@:~]+)(?:@([\d.]+))?(?::([a-z]+))?(?:~(-?\d+))?$/.exec(R.p) || [0, 'idle'];
      const c = UL.libClip(m[1]);
      const t = (c ? c.dur : 1) * (m[2] !== undefined ? +m[2] : 0.3);
      if (qs.get('trace') === '1') { GP.trace = []; }
      poseSet(S, { key: m[1], t: t, mode: m[3] || 'auto', yaw: m[4] ? +m[4] : 0 });
      if (GP.trace) { (window.__trace = window.__trace || []).push('== ' + R.b + ' ' + R.w + ' ' + R.p, ...GP.trace); GP.trace = null; }
      updDebug(S, qs.get('dbg') === '1');
      const y0 = r * (cell + lab);
      for (let i = 0; i < views.length; i++) {
        setCam(camera, S, views[i], 1);
        S.W.grid.visible = /^w/.test(views[i]) && qs.get('dbg') === '1';
        S.body.holder.visible = !(/^w/.test(views[i]) && qs.get('nobody') === '1');
        renderer.setViewport(i * cell, Hd - y0 - lab - cell, cell, cell);
        renderer.setScissor(i * cell, Hd - y0 - lab - cell, cell, cell);
        renderer.render(scene, camera);
      }
      const dg = GP.rig(S.body);
      const jt = GP.joints ? GP.joints(S.body, S.W) : null;
      if (jt) { const n = function (x) { return x === undefined ? '  -' : (x >= 0 ? ' ' : '') + x.toFixed(0); };
        ['R', 'L'].forEach(function (sd) { const j = jt[sd];
          (window.__joints = window.__joints || []).push((R.b + ' ' + R.w + ' ' + R.p).padEnd(26) + sd +
            ' | кл ' + n(j.clElev) + '/' + n(j.clProt) + ' | пл подъём ' + n(j.shElev) + ' гор ' + n(j.shHoriz) + ' скр ' + n(j.shTwist) + ' за спиной ' + n(j.shBack) + ' до середины ' + (j.elbowMid * 100).toFixed(0) + 'см' +
            ' | лок ' + n(j.elFlex) + ' вбок ' + n(j.elSide) + ' | пред ' + n(j.pron) + ' (кости ' + n(j.boneFore) + '/' + n(j.boneWrist) + ')' +
            ' | зап сгиб ' + n(j.wrFlex) + ' откл ' + n(j.wrDev) + ' | ' + (j.bad.length ? 'НАРУШЕНО: ' + j.bad.join(', ') : 'ОК')); }); }
      const ck = gripOn && GP.check ? GP.check(S.body, S.W) : null;
      if (ck) { const f2 = function (x) { return x === undefined ? '  -  ' : x.toFixed(2).padStart(5); };
        (window.__checks = window.__checks || []).push((R.b + ' ' + R.w + ' ' + R.p).padEnd(34) + ' rN ' + f2(ck.rN) + ' rF ' + f2(ck.rF) + ' rD ' + (ck.rD * 100).toFixed(1).padStart(4) + 'см (кулак ' + (ck.rH * 100).toFixed(1) + ') | lN ' + f2(ck.lN) + ' lD ' + (ck.lD * 100).toFixed(1).padStart(4) + 'см (кулак ' + (ck.lH * 100).toFixed(1) + ') ' + (ck.lMode || '') + (ck.lS ? ' сдв ' + ck.lS.toFixed(2) : '') +
          ((ck.rN > 0.6 && ck.rF > 0.7 && ck.rD < 0.03 && (ck.lN === undefined || (ck.lN > 0.5 && ck.lD < 0.04))) ? '  ОК' : '  ПЛОХО')); }
      const di = function (d) { return 'изгиб ' + d.rawBend.toFixed(0) + '° скр ' + d.twist.toFixed(0) + '/' + d.roll.toFixed(0) + (d.rollG || d.devN ? ' пов ' + d.rollG.toFixed(0) + '/' + d.devN.toFixed(0) : '') + (d.slide ? ' сдв ' + d.slide.toFixed(2) : ''); };
      R.info = dg && gripOn ? 'R ' + di(dg.R.dbg) + ' | L ' + di(dg.L.dbg) : '';
    }
    g.drawImage(renderer.domElement, 0, 0);
    g.font = '11px sans-serif';
    rows.forEach(function (R, r) {
      const y0 = r * (cell + lab);
      g.fillStyle = '#e0a040'; g.fillText(R.b + ' · ' + R.w + ' · ' + R.p + (gripOn ? '' : ' · БЕЗ ХВАТА'), 4, y0 + 12);
      g.fillStyle = '#9aa4ae'; g.fillText(R.info || '', Math.min(Wd - 330, 230), y0 + 12);
    });
    views.forEach(function (v, i) { g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillText(VIEWS[v] ? VIEWS[v].n : v, i * cell + 4, lab + 12); });
    window.__sheet = out.toDataURL('image/png');
    document.body.innerHTML = ''; out.style.maxWidth = '100%'; document.body.appendChild(out); document.body.style.overflow = 'auto';
  }

  if (SHEET) { sheet().catch(function (e) { window.__sheetErr = String(e && e.stack || e); }); return; }

  /* ---------- Окно: панель, ползунки, виды ---------- */
  const side = document.getElementById('side');
  const st = { body: qs.get('body') || 'krut', wpn: qs.get('weapon') || 'ak', lo: false, key: qs.get('key') || 'aim', t: 0.3, play: false, mode: 'auto', yaw: 0, dbg: true, main: 'orbit', small: ['game', 'nearr', 'nearl', 'neart', 'rclose', 'rin', 'lclose', 'lup'] };
  let S = null, busy = false;
  const el = function (tag, attrs, parent) { const e = document.createElement(tag); for (const k in attrs || {}) { if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); } if (parent) parent.appendChild(e); return e; };
  const row = function (parent, name) { const r = el('div', { class: 'row' }, parent); el('label', { text: name, title: name }, r); return r; };
  function selectRow(parent, name, opts, val, cb) {
    const r = row(parent, name), s = el('select', {}, r);
    opts.forEach(function (o) { const op = el('option', { value: o[0], text: o[1] }, s); if (o[0] === val) op.selected = true; });
    s.onchange = function () { cb(s.value); };
    return s;
  }
  function slider(parent, name, min, max, step, get, set) {
    const r = row(parent, name), inp = el('input', { type: 'range', min: min, max: max, step: step }, r), val = el('span', { class: 'val' }, r);
    const show = function () { const v = get(); inp.value = v; val.textContent = (Math.abs(step) < 0.01 ? (+v).toFixed(3) : (+v).toFixed(step < 1 ? 2 : 0)); };
    inp.oninput = function () { set(+inp.value); show(); GP.touch(); redraw(); };
    show();
    return { show: show, inp: inp };
  }
  el('h3', { text: 'Боец и оружие' }, side);
  selectRow(side, 'Тело', Object.keys(M3.bodies).map(function (k) { return [k, k + ' (' + M3.bodies[k].f + ')']; }), st.body, function (v) { st.body = v; rebuild(); });
  selectRow(side, 'Оружие', Object.keys(M3.weapons).map(function (k) { return [k, k + ' (' + M3.weapons[k].f + ')']; }), st.wpn, function (v) { st.wpn = v; rebuild(); });
  const loRow = row(side, 'Упрощ. модель'); const loC = el('input', { type: 'checkbox' }, loRow); loC.onchange = function () { st.lo = loC.checked; rebuild(); };
  el('h3', { text: 'Движение' }, side);
  const keys = Object.keys(DW.ANIM3.clips).filter(function (k) { return !DW.ANIM3.clips[k].err; });
  let tSl = null;
  selectRow(side, 'Движение', keys.map(function (k) { const c = DW.ANIM3.clips[k]; return [k, k + ' · ' + c.mode + (c.freeL ? ' · своб. левая' : '')]; }), st.key, function (v) { st.key = v; st.t = Math.min(st.t, clipDur()); tSl.inp.max = clipDur(); tSl.show(); redraw(); });
  const clipDur = function () { const c = UL.libClip(st.key); return c ? Math.max(0.001, c.dur) : 1; };
  tSl = slider(side, 'Время, с', 0, clipDur(), 0.01, function () { return st.t; }, function (v) { st.t = v; });
  const plRow = row(side, 'Проигрывать'); const plC = el('input', { type: 'checkbox' }, plRow); plC.onchange = function () { st.play = plC.checked; };
  selectRow(side, 'Режим', [['auto', 'как в движении'], ['aim', 'aim — прицел'], ['carry', 'carry — переноска'], ['hip', 'hip — от бедра'], ['hand', 'hand — в кисти'], ['sling', 'sling — за спиной']], st.mode, function (v) { st.mode = v; redraw(); });
  slider(side, 'Поворот, °', -180, 180, 5, function () { return st.yaw; }, function (v) { st.yaw = v; });
  const gRow = row(side, 'Хват (grip.js)'); const gC = el('input', { type: 'checkbox' }, gRow); gC.checked = gripOn; gC.onchange = function () { gripOn = gC.checked; rebuild(); };
  const hRow = row(side, '«В кисти»+apply'); const hC = el('input', { type: 'checkbox', title: 'предлагаемая правка units.js: grip.apply и в режиме hand' }, hRow); hC.checked = handHook; hC.onchange = function () { handHook = hC.checked; redraw(); };
  const dRow = row(side, 'Оси и точки'); const dC = el('input', { type: 'checkbox' }, dRow); dC.checked = st.dbg; dC.onchange = function () { st.dbg = dC.checked; redraw(); };
  el('h3', { text: 'Большой вид' }, side);
  const vb = el('div', { class: 'btns' }, side);
  ['orbit'].concat(Object.keys(VIEWS)).forEach(function (v) { const b = el('button', { text: v === 'orbit' ? 'вращать' : VIEWS[v].n }, vb); b.onclick = function () { st.main = v; if (v === 'orbit') orbitFrom('front'); redraw(); }; });
  const dbgBox = el('div', { id: 'dbg' }, side);

  /* параметры grip.js — ползунки по структуре P */
  el('h3', { text: 'Параметры хвата (R3.grip.P)' }, side);
  const parBox = el('div', {}, side);
  const RANGE = function (path) {
    if (/^w\.(g|f)\./.test(path)) return [-0.3, 0.3, 0.002];
    if (/^w\.rk/.test(path)) return [-10, 60, 1];
    if (/\.off\./.test(path)) return [-0.12, 0.12, 0.002];
    if (/depth|fwd|\.up$/.test(path)) return [-0.08, 0.08, 0.001];
    if (/\.rot\./.test(path)) return [-180, 180, 1];
    if (/curl|thumb/.test(path)) return [-40, 130, 1];
    if (/rake|fan|tilt/.test(path)) return [-90, 90, 1];
    if (/foreTwist|align|kTwist|kElbow/.test(path)) return [0, 1, 0.01];
    if (/kUp/.test(path)) return [0, 20, 0.1];
    if (/elbowUp/.test(path)) return [-1, 1, 0.01];
    if (/rollMax|devMax/.test(path)) return [0, 90, 1];
    if (/twistMax|bendMax/.test(path)) return [0, 180, 1];
    if (/poleDown/.test(path)) return [-0.5, 0.5, 0.01];
    if (/reach/.test(path)) return [0.8, 1.0, 0.005];
    if (/weaponPts/.test(path)) return [0, 1, 1];
    return [-1, 1, 0.01];
  };
  const NAMES = { R: 'Правая (рукоять)', L: 'Левая (цевьё)', g: 'рукоять [y, z]', f: 'цевьё [y, z] от W.fore', relax: 'Свободная кисть', curl: 'сгиб', rot: 'поворот [скрутка, отклон., сгиб]', off: 'смещение [x, y, z]', thumb: 'большой [разв., 1, 2, 3]' };
  const sliders = [];
  function buildParams(parent, obj, path) {
    Object.keys(obj).forEach(function (k) {
      const v = obj[k], p = path ? path + '.' + k : k;
      if (k === 'wpn') return;
      if (Array.isArray(v)) {
        el('h4', { text: (NAMES[k] || k) }, parent);
        v.forEach(function (x, i) { const rg = RANGE(p + '.' + i); sliders.push(slider(parent, k + '[' + i + ']', rg[0], rg[1], rg[2], function () { return obj[k][i]; }, function (n) { obj[k][i] = n; })); });
      } else if (v && typeof v === 'object') {
        const d = el('details', {}, parent); if (!path) d.open = k === 'R' || k === 'L';
        el('summary', { text: NAMES[k] || k }, d);
        buildParams(d, v, p);
      } else if (typeof v === 'number') {
        const rg = RANGE(p);
        sliders.push(slider(parent, k, rg[0], rg[1], rg[2], function () { return obj[k]; }, function (n) { obj[k] = n; }));
      }
    });
  }
  function buildAll() {
    parBox.innerHTML = ''; sliders.length = 0;
    buildParams(parBox, GP.P, '');
    // текущее оружие: центр рукояти g [y, z], ось цевья f [y, z] от W.fore, наклон рукояти rk
    const wd = el('details', {}, parBox); wd.open = true;
    el('summary', { text: 'Оружие «' + st.wpn + '» (P.wpn.' + st.wpn + ')' }, wd);
    if (!GP.P.wpn[st.wpn]) GP.P.wpn[st.wpn] = { g: [0, 0], f: [0, 0] };
    const w = GP.P.wpn[st.wpn];
    if (w.rk === undefined) w.rk = GP.P.R.rake;
    while (w.g.length < 3) w.g.push(0);
    while (w.f.length < 3) w.f.push(0);
    buildParams(wd, w, 'w');
  }
  el('h3', { text: 'JSON' }, side);
  const jb = el('div', { class: 'btns' }, side);
  const ta = el('textarea', { spellcheck: 'false' }, side);
  const prune = function () {
    const P = JSON.parse(JSON.stringify(GP.P));
    for (const k in P.wpn) { const w = P.wpn[k]; if (w.rk === P.R.rake) delete w.rk; ['g', 'f'].forEach(function (a) { if (w[a].length > 2 && !w[a][2]) w[a].length = 2; }); }
    return P;
  };
  el('button', { text: 'JSON → поле и буфер' }, jb).onclick = function () { ta.value = JSON.stringify(prune(), null, 1).replace(/\[\s+([^\]{}]*?)\s+\]/g, function (m, a) { return '[' + a.replace(/\s+/g, ' ') + ']'; }); ta.select(); try { navigator.clipboard.writeText(ta.value); } catch (e) { /* без буфера */ } };
  el('button', { text: 'Применить из поля' }, jb).onclick = function () { try { const o = JSON.parse(ta.value); deepAssign(GP.P, o); GP.touch(); buildAll(); redraw(); } catch (e) { alert('JSON: ' + e.message); } };
  el('button', { text: 'Сброс' }, jb).onclick = function () { deepAssign(GP.P, JSON.parse(JSON.stringify(DEF))); GP.P.wpn = JSON.parse(JSON.stringify(DEF.wpn)); GP.touch(); buildAll(); redraw(); };
  function deepAssign(dst, src) { for (const k in src) { if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k]) && dst[k] && typeof dst[k] === 'object') deepAssign(dst[k], src[k]); else dst[k] = Array.isArray(src[k]) ? src[k].slice() : src[k]; } }

  /* ---------- Камера «вращать» ---------- */
  const orb = { yaw: 0, pitch: 0.2, dist: 3.4, tgt: V(0, 1.05, 0.15) };
  function orbitFrom() { orb.yaw = 0; orb.pitch = 0.2; orb.dist = 3.4; orb.tgt.set(0, 1.05, 0.15); }
  let drag = null;
  canvas.addEventListener('pointerdown', function (e) { if (e.clientY - canvas.getBoundingClientRect().top < mainH()) { drag = { x: e.clientX, y: e.clientY, pan: e.button === 2 || e.shiftKey }; if (st.main !== 'orbit') { st.main = 'orbit'; } canvas.setPointerCapture(e.pointerId); } });
  canvas.addEventListener('pointermove', function (e) {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
    if (drag.pan) { const r = V(Math.cos(orb.yaw), 0, -Math.sin(orb.yaw)); orb.tgt.addScaledVector(r, -dx * orb.dist * 0.0015); orb.tgt.y += dy * orb.dist * 0.0015; }
    else { orb.yaw -= dx * 0.008; orb.pitch = Math.max(-1.5, Math.min(1.5, orb.pitch + dy * 0.008)); }
    redraw();
  });
  canvas.addEventListener('pointerup', function () { drag = null; });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  canvas.addEventListener('wheel', function (e) { e.preventDefault(); orb.dist = Math.max(0.15, Math.min(12, orb.dist * Math.exp(e.deltaY * 0.001))); redraw(); }, { passive: false });
  /* двойной щелчок по малому виду — сделать его большим */
  canvas.addEventListener('dblclick', function (e) {
    const r = canvas.getBoundingClientRect(), y = e.clientY - r.top, x = e.clientX - r.left;
    if (y < mainH()) { st.main = 'orbit'; orbitFrom(); redraw(); return; }
    const i = Math.floor(x / (r.width / st.small.length));
    if (st.small[i]) { st.main = st.small[i]; redraw(); }
  });
  const mainH = function () { return Math.round(canvas.clientHeight * 0.64); };

  /* ---------- Отрисовка ---------- */
  const labels = [];
  function label(i, text, x, y) { let d = labels[i]; if (!d) { d = labels[i] = el('div', { class: 'lbl' }, document.getElementById('view')); } d.textContent = text; d.style.left = x + 'px'; d.style.top = y + 'px'; d.style.display = text ? 'block' : 'none'; }
  let need = true;
  function redraw() { need = true; }
  function frame(now) {
    requestAnimationFrame(frame);
    if (st.play && S) { st.t = (st.t + 1 / 60) % clipDur(); tSl.show(); need = true; }
    if (!need || !S || busy) return;
    need = false;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    poseSet(S, { key: st.key, t: st.t, mode: st.mode, yaw: st.yaw });
    updDebug(S, st.dbg);
    const mh = mainH();
    // большой вид
    if (st.main === 'orbit') {
      camera.fov = 30; camera.aspect = w / mh;
      const cp = Math.cos(orb.pitch);
      camera.position.set(orb.tgt.x + Math.sin(orb.yaw) * cp * orb.dist, orb.tgt.y + Math.sin(orb.pitch) * orb.dist, orb.tgt.z + Math.cos(orb.yaw) * cp * orb.dist);
      camera.lookAt(orb.tgt); camera.updateProjectionMatrix();
    } else setCam(camera, S, st.main, w / mh);
    S.W.grid.visible = st.dbg && /^w/.test(st.main);
    renderer.setViewport(0, h - mh, w, mh); renderer.setScissor(0, h - mh, w, mh);
    renderer.render(scene, camera);
    label(0, st.main === 'orbit' ? 'вращать: левая кнопка — поворот, правая/Shift — сдвиг, колесо — ближе; двойной щелчок по малому виду — крупно' : (VIEWS[st.main] || {}).n, 6, 4);
    // малые виды
    const n = st.small.length, sw = w / n, sh = h - mh;
    st.small.forEach(function (v, i) {
      setCam(camera, S, v, sw / sh);
      S.W.grid.visible = st.dbg && /^w/.test(v);
      renderer.setViewport(Math.round(i * sw), 0, Math.round(sw), sh); renderer.setScissor(Math.round(i * sw), 0, Math.round(sw), sh);
      renderer.render(scene, camera);
      label(i + 1, VIEWS[v].n, Math.round(i * sw) + 4, mh + 4);
    });
    const G = gripOn ? GP.rig(S.body) : null;
    const f = function (d) { return 'изгиб ' + d.rawBend.toFixed(0) + '° (огр. ' + d.bend.toFixed(0) + '°), скрутка запястья ' + d.twist.toFixed(0) + '°, предплечья ' + d.roll.toFixed(0) + '°' + (d.rollG || d.devN ? ', проворот ' + d.rollG.toFixed(0) + '°/' + d.devN.toFixed(0) + '°' : '') + (d.slide ? ', сдвиг ' + d.slide.toFixed(3) + ' м' : ''); };
    dbgBox.textContent = 'режим: ' + S.mode + (G ? '\nкисть ×' + G.R.hs.toFixed(2) + '\nR: ' + f(G.R.dbg) + '\nL: ' + f(G.L.dbg) : '\n(хват выключен)');
  }
  async function rebuild() {
    busy = true;
    if (S) { scene.remove(S.body.holder); scene.remove(S.W.g); }
    S = await makeSet(st.body, st.wpn, st.lo);
    scene.add(S.body.holder); scene.add(S.W.g);
    buildAll();
    busy = false; redraw();
  }
  window.addEventListener('resize', redraw);
  window.__lab = { st: st, get S() { return S; }, redraw: redraw, poseSet: poseSet };
  orbitFrom();
  rebuild();
  requestAnimationFrame(frame);
})();
