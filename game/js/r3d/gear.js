'use strict';
/* 3D-бой: снаряжение на бойце — подсумки с магазинами на поясе, граната Ф-1 (если в отряде есть гранаты),
   оранжевая аптечка (медик или есть аптечки), рация за спиной у командира. Детали — простая геометрия,
   сливаются в две сетки на бойца (пояс — к кости таза, спина — к груди) с цветом в вершинах: две отрисовки,
   на «низком» качестве не ставится. R3.gear.attach(e, u) — после создания тела (units.js ensure). */
(function (DW) {
  const R3 = DW.R3, THREE = R3 && R3.THREE;
  if (!THREE) return;
  const G3 = R3.gear = {};
  const V = function (x, y, z) { return new THREE.Vector3(x || 0, y || 0, z || 0); };
  let mat = null;
  function material() {
    if (mat) return mat;
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.12 });
    mat = R3.world && R3.world.fogMat ? R3.world.fogMat(m) : m;
    return mat;
  }
  // деталь: геометрия, цвет, место и поворот (в осях тела: +Z вперёд, +Y вверх)
  function part(list, geo, hex, p, rot) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    const m = new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(rot ? rot[0] : 0, rot ? rot[1] : 0, rot ? rot[2] : 0)), V(1, 1, 1));
    g.applyMatrix4(m);
    const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    if (g.attributes.uv) g.deleteAttribute('uv');
    list.push(g);
  }
  // слить детали и привязать к кости: вершины — в координатах тела, матрица сетки — обратная к кости
  function bind(list, bone) {
    if (!list.length || !bone) return null;
    const geo = THREE.BufferGeometryUtils.mergeGeometries(list);
    list.forEach(function (g) { g.dispose(); });
    const mesh = new THREE.Mesh(geo, material());
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
    mesh.matrixAutoUpdate = false;
    mesh.matrix.copy(bone.matrixWorld).invert();
    bone.add(mesh);
    return mesh;
  }
  G3.attach = function (e, u) {
    if (!e || !e.body || !u || u.side !== 'p' || u.kind !== 'soldier' || R3.q() < 1) return;
    const B = e.body.B;
    if (!B.Hips || !B.Spine2 || !B.LeftUpLeg || !B.RightUpLeg) return;
    e.body.holder.updateMatrixWorld(true);
    const st = DW.G.state || { res: {} };
    const hip = B.Hips.getWorldPosition(V()), chest = B.Spine2.getWorldPosition(V());
    const lx = B.LeftUpLeg.getWorldPosition(V()).x - B.RightUpLeg.getWorldPosition(V()).x;
    const L = lx >= 0 ? 1 : -1;                 // сторона левой руки по X
    const k = (e.body.H || 1.8) / 1.8;
    const by = hip.y + 0.05 * k, olive = 0x4a5236, strap = 0x2e2a22;
    const belt = [], back = [];
    // ремень и два подсумка с магазинами спереди
    part(belt, new THREE.TorusGeometry(0.155 * k, 0.012 * k, 4, 18), strap, V(hip.x, by, hip.z + 0.01 * k), [Math.PI / 2, 0, 0]);
    [-1, 1].forEach(function (s) { part(belt, new THREE.BoxGeometry(0.065 * k, 0.095 * k, 0.04 * k), olive, V(hip.x + s * 0.065 * k, by + 0.02 * k, hip.z + 0.15 * k)); });
    // граната Ф-1 на левом боку
    if ((st.res.grenades || 0) > 0) {
      const gx = hip.x + L * 0.16 * k, gz = hip.z + 0.03 * k;
      const s = new THREE.SphereGeometry(0.028 * k, 10, 8); s.scale(1, 1.22, 1);
      part(belt, s, 0x485634, V(gx, by - 0.035 * k, gz));
      part(belt, new THREE.CylinderGeometry(0.008 * k, 0.009 * k, 0.03 * k, 8), 0x8a887c, V(gx, by + 0.01 * k, gz));
    }
    // аптечка АИ-2 на правом боку (медик — всегда)
    if (u.cls === 'medic' || (st.res.meds || 0) > 0) part(belt, new THREE.BoxGeometry(0.035 * k, 0.085 * k, 0.075 * k), 0xd8641c, V(hip.x - L * 0.165 * k, by - 0.01 * k, hip.z - 0.01 * k));
    // фляга на ремне сзади у всех, за спиной у командира — рация
    part(belt, new THREE.CylinderGeometry(0.03 * k, 0.03 * k, 0.15 * k, 10), 0x3a4232, V(hip.x - L * 0.09 * k, by - 0.02 * k, hip.z - 0.14 * k));
    if (u.cls === 'leader') {
      part(back, new THREE.BoxGeometry(0.13 * k, 0.19 * k, 0.065 * k), 0x2e3228, V(chest.x, chest.y - 0.06 * k, chest.z - 0.16 * k));
      part(back, new THREE.CylinderGeometry(0.004 * k, 0.004 * k, 0.4 * k, 5), 0x1c1c1a, V(chest.x + L * 0.045 * k, chest.y + 0.24 * k, chest.z - 0.17 * k), [0.12, 0, 0]);
    }
    e.gear = [bind(belt, B.Hips), bind(back, B.Spine2)];
  };
})(window.DW);
