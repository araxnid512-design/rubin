'use strict';
/* Живая 3D-фигура бойца для окна отряда: та же модель и то же оружие, что в бою, стойка «оружие в руках»
   с дыханием; поворот пальцем. Свой маленький WebGL-холст (работает и вне боя), цикл кадров — только пока
   холст на экране. PV.snap — снимок модели в картинку (иконки оружия и брони — tools/wicons). */
(function (DW) {
  const R3 = DW.R3, THREE = R3 && R3.THREE;
  if (!THREE) return;
  const PV = R3.preview = {};
  const V = function (x, y, z) { return new THREE.Vector3(x || 0, y || 0, z || 0); };
  let rd = null, scene = null, cam = null, root = null, wroot = null, disc = null, canvas = null, failed = false;
  let cur = null, want = null, raf = 0, last = 0, yaw = 0.55, drag = null, ak = null;
  const W0 = 150, H0 = 190;

  function plain(m) {
    // материалы без тумана войны (он только для поля боя)
    const one = function (mt) { const c = mt.clone(); c.onBeforeCompile = function () {}; return c; };
    m.material = Array.isArray(m.material) ? m.material.map(one) : one(m.material);
  }
  function shadowDisc() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
    gr.addColorStop(0, 'rgba(0,0,0,0.7)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.005;
    return m;
  }
  function setup() {
    if (rd || failed) return !!rd;
    try {
      canvas = document.createElement('canvas');
      rd = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: 'low-power', preserveDrawingBuffer: true });
    } catch (e) { failed = true; rd = null; return false; }
    rd.setClearColor(0x000000, 0);
    rd.outputColorSpace = THREE.SRGBColorSpace;
    rd.toneMapping = THREE.ACESFilmicToneMapping; rd.toneMappingExposure = 1.1;
    scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xfff1de, 0x3a2c20, 1.25));
    const key = new THREE.DirectionalLight(0xffe4c4, 2.4); key.position.set(2.2, 3.2, 3.0); scene.add(key);
    const rim = new THREE.DirectionalLight(0xa8c4ff, 1.6); rim.position.set(-2.5, 2.4, -2.8); scene.add(rim);
    const fill = new THREE.DirectionalLight(0xffffff, 0.5); fill.position.set(-2, 1, 3); scene.add(fill);
    // фигура поворачивается вместе с root; оружие — в wroot (его матрица считается сразу в мире)
    root = new THREE.Group(); scene.add(root);
    wroot = new THREE.Group(); scene.add(wroot);
    disc = shadowDisc(); scene.add(disc);
    cam = new THREE.PerspectiveCamera(23, W0 / H0, 0.1, 40);
    canvas.className = 'fig fig3d';
    // поворот фигуры пальцем / мышью
    canvas.addEventListener('pointerdown', function (ev) { drag = { x: ev.clientX, y0: yaw }; try { canvas.setPointerCapture(ev.pointerId); } catch (e) { /* нет захвата */ } ev.stopPropagation(); });
    canvas.addEventListener('pointermove', function (ev) { if (drag) { yaw = drag.y0 + (ev.clientX - drag.x) * 0.018; ev.stopPropagation(); } });
    const up = function () { drag = null; };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    return true;
  }
  function size(w, h) {
    const pr = Math.min(2, window.devicePixelRatio || 1);
    rd.setPixelRatio(pr); rd.setSize(w, h, false);
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    cam.aspect = w / h; cam.updateProjectionMatrix();
  }
  function frameCam(H, k) {
    // вся фигура в кадре, взгляд чуть сверху
    const d = (H * 0.62) / Math.tan(cam.fov * Math.PI / 360) * (k || 1);
    cam.position.set(0, H * 0.62, d); cam.lookAt(0, H * 0.5, 0);
  }

  /* что показать: тело и оружие бойца — как в бою (DW.S3.setsFor) */
  function lookOf(s) {
    const M3 = DW.M3;
    if (!M3 || !M3.bodies) return null;
    let bid = 'krut', wid = s.weapon || 'ppsh';
    const S = DW.S3 && DW.S3.setsFor ? DW.S3.setsFor({ kind: 'soldier', name: s.name, armorId: s.armor, weapon: s.weapon, id: s.id, sid: s.id }) : null;
    if (S && S.body) bid = S.body.slice(2);
    if (!M3.bodies[bid]) bid = 'krut';
    if (!M3.weapons[wid]) wid = 'ak';
    const mods = (s.mods || []).filter(function (m) { return DW.D.MODS && DW.D.MODS[m]; }).sort();
    return { body: bid, weapon: wid, mods: mods, key: bid + '|' + wid + '|' + mods.join(',') };
  }
  function build(L) {
    const M3 = DW.M3, bi = M3.bodies[L.body], wi = M3.weapons[L.weapon];
    const lib = R3.units && R3.units._lib;
    if (!lib) return Promise.resolve(null);
    return Promise.all([R3.loadGLB('models/' + bi.f + '.glb'), R3.loadGLB('models/' + wi.f + '.glb'), M3.weapons.ak ? R3.loadGLB('models/' + M3.weapons.ak.f + '.glb') : null]).then(function (r) {
      if (!r[0] || !r[1]) return null;
      const body = lib.makeBody(r[0], bi.h || 1.8, true);
      lib.retargetSetup(body);
      body.holder.traverse(function (o) { if (o.isMesh) plain(o); });
      const W = lib.makeWeapon(r[1], wi);
      // модули оружия бойца (прицел, глушитель, магазин, приклад) — на 3D-модели (r3d/wmods.js)
      if (R3.wmods && R3.wmods.attach && L.mods && L.mods.length) R3.wmods.attach(W, L.mods, L.weapon);
      W.g.traverse(function (o) { if (o.isMesh) plain(o); });
      if (!ak && r[2]) ak = lib.makeWeapon(r[2], M3.weapons.ak);
      return { L: L, body: body, W: W, H: bi.h || 1.8, pose: null };
    });
  }
  const _q = new THREE.Quaternion();
  function pose(F, t) {
    const lib = R3.units._lib, body = F.body, W = F.W;
    const key = lib.libClip('idle') ? 'idle' : null;
    if (key) { F.pose = lib.samplePose(key, t, F.pose); lib.applyPose(body, F.pose); }
    body.holder.updateMatrixWorld(true);
    const Tq = lib.torso(body.B), G = lib.GRIP.carry;
    const M = lib.gunMatrix(Tq, W, G, 0);
    let grip, fore;
    if (!W.free && ak) {
      const MA = lib.gunMatrix(Tq, ak, G, 0);
      const g0 = V().setFromMatrixPosition(MA);
      grip = g0.clone(); fore = ak.fore.clone().applyMatrix4(MA);
      M.setPosition(g0.addScaledVector(V(0, 0, -1).transformDirection(M), Math.max(0, W.buttZ - ak.buttZ)));
    } else { grip = V().setFromMatrixPosition(M); fore = W.fore.clone().applyMatrix4(M); }
    lib.handsTo(body, grip, fore, false);
    if (R3.grip && R3.grip.apply) R3.grip.apply({ body: body, W: W, M: M, mode: 'carry', grip: grip, fore: fore, key: 'idle', freeL: false, reload: false });
    W.g.matrix.copy(M); W.g.matrixWorldNeedsUpdate = true;
    void _q;
  }
  function clear() { while (root.children.length) root.remove(root.children[0]); while (wroot.children.length) wroot.remove(wroot.children[0]); }
  function show(F) {
    clear();
    root.add(F.body.holder); wroot.add(F.W.g);
    cur = F;
    frameCam(F.H, 0.96);
  }
  function loop(ts) {
    raf = 0;
    if (!canvas || !canvas.isConnected) return;   // окно закрыто — цикл стоит
    raf = requestAnimationFrame(loop);
    if (ts - last < 33) return;                     // ~30 кадров в секунду хватает
    last = ts;
    if (!cur) return;
    root.rotation.y = yaw + (drag ? 0 : Math.sin(ts / 2600) * 0.06);
    root.updateMatrixWorld(true);
    pose(cur, ts / 1000);
    rd.render(scene, cam);
  }

  /* холст с живой фигурой бойца s или null (нет WebGL / моделей) */
  PV.figure = function (s) {
    if (!DW.M3 || !DW.ANIM3 || !R3.units || !R3.units._lib) return null;
    const L = lookOf(s);
    if (!L || !setup()) return null;
    size(W0, H0);
    if (!cur || cur.L.key !== L.key) {
      if (!want || want.key !== L.key) {
        want = L;
        build(L).then(function (F) { if (F && want === L) { show(F); if (!raf && canvas.isConnected) raf = requestAnimationFrame(loop); } });
      }
    }
    if (!raf) raf = requestAnimationFrame(function (ts) { raf = 0; loop(ts); });
    return canvas;
  };

  /* снимок в картинку: { body, weapon, pose: 'idle'|null, w, h, view: 'body'|'weapon'|'torso', yaw } → Promise<dataURL> */
  PV.snap = function (o) {
    if (!setup()) return Promise.resolve(null);
    const M3 = DW.M3, lib = R3.units._lib;
    const wasCur = cur;
    const done = function (url) { if (wasCur) show(wasCur); return url; };
    size(o.w || 256, o.h || 256);
    if (o.view === 'weapon') {
      const wi = M3.weapons[o.weapon];
      return R3.loadGLB('models/' + wi.f + '.glb').then(function (gl) {
        clear();
        const W = lib.makeWeapon(gl, wi);
        W.g.traverse(function (q) { if (q.isMesh) plain(q); });
        W.g.matrixAutoUpdate = true;
        // ствол вправо, вид сбоку, по размеру картинки
        W.g.rotation.set(0, -Math.PI / 2, 0); root.rotation.set(0, 0, 0);
        root.add(W.g); root.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(W.g, true), c = box.getCenter(V()), sz = box.getSize(V());
        const oc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 20);
        const asp = (o.w || 256) / (o.h || 256), pad = 1.06;
        let hw = sz.x / 2 * pad, hh = sz.y / 2 * pad;
        if (hw / hh > asp) hh = hw / asp; else hw = hh * asp;
        oc.left = -hw; oc.right = hw; oc.top = hh; oc.bottom = -hh; oc.updateProjectionMatrix();
        oc.position.set(c.x + 0.0, c.y + sz.y * 0.4, c.z + 5); oc.lookAt(c.x, c.y, c.z);
        disc.visible = false;
        rd.render(scene, oc);
        const url = canvas.toDataURL('image/png');
        disc.visible = true;
        root.remove(W.g);
        return done(url);
      });
    }
    return build({ body: o.body, weapon: o.weapon || 'ak', key: 'snap' }).then(function (F) {
      if (!F) return done(null);
      clear();
      root.add(F.body.holder); if (o.weapon) wroot.add(F.W.g);
      root.rotation.set(0, o.yaw || 0, 0); root.updateMatrixWorld(true);
      pose(F, 0.4);
      // броня: грудь и плечи крупно (от пояса до шеи)
      if (o.view === 'torso') { cam.position.set(0, F.H * 0.66, F.H * 1.25); cam.lookAt(0, F.H * 0.6, 0); }
      else frameCam(F.H, 1.04);
      disc.visible = o.view !== 'torso';
      rd.render(scene, cam);
      const url = canvas.toDataURL('image/png');
      disc.visible = true;
      return done(url);
    });
  };
})(window.DW);
