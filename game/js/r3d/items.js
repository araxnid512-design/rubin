'use strict';
/* 3D-бой: предметы на поле и цели. Кристаллы (светятся, покачиваются), ящики с патронами, едой, лекарствами,
   груз Института (контейнер со светящейся полосой и столбом света), пленник (на коленях, руки связаны) —
   задание «освободить», лестницы на крыши, зона эвакуации. Список предметов меняется в бою (подобрали — убрали). */
(function (DW) {
  const R3 = DW.R3, THREE = R3.THREE;
  if (!THREE) return;
  const T = R3.T, LV = R3.LV;
  const IT = R3.items = {};
  const V = function (x, y, z) { return new THREE.Vector3(x || 0, y || 0, z || 0); };
  let group = null, meshes = {}, captive = null, pillarMat = null, B0 = null;

  function shardMat() { return R3.fogify(new THREE.MeshStandardMaterial({ color: 0x9af0ff, emissive: 0x38c8e8, emissiveIntensity: 1.3, roughness: 0.15, metalness: 0.1 })); }
  let SM = null;
  function gems() {
    const g = new THREE.Group();
    SM = SM || shardMat();
    const geo = new THREE.OctahedronGeometry(0.11, 0);
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(geo, SM);
      m.position.set((i % 2 - 0.5) * 0.14, 0.12 + (i > 1 ? 0.05 : 0), (i < 2 ? -0.06 : 0.07));
      m.scale.set(0.8 + i * 0.15, 1.6 + (i % 2) * 0.5, 0.8 + i * 0.1);
      m.rotation.set(0.2 * i, i * 1.3, 0.15 * (i - 1.5));
      m.castShadow = true;
      g.add(m);
    }
    g.userData.bob = true;
    return g;
  }
  function pillar(color) {
    // столб света — видно издалека, куда идти
    pillarMat = pillarMat || new THREE.MeshBasicMaterial({ color: color || 0x78dcff, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
    const geo = new THREE.CylinderGeometry(0.1, 0.22, 3.2, 12, 4, true);
    // снизу ярче, кверху гаснет
    const pos = geo.attributes.position, col = new Float32Array(pos.count * 4);
    for (let i = 0; i < pos.count; i++) { const k = 1 - (pos.getY(i) + 1.6) / 3.2; col.set([1, 1, 1, 0.16 * k * k], i * 4); }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
    const p = new THREE.Mesh(geo, pillarMat);
    p.position.y = 1.6; p.renderOrder = 21;
    return p;
  }
  function crate(kind, x, y, cb) {
    const M3 = DW.M3 || {};
    const v = (M3.props && M3.props[4]) || [];
    const f = kind === 'ammo' || kind === 'grenades' ? 'e_ammo' : 'e_crate';
    const e = v.find(function (q) { return q.f === f; }) || v[0];
    if (!e) return;
    R3.loadGLB('models/' + e.f + '.glb').then(function (gl) {
      if (!gl) return;
      cb(R3.world.placeModel(gl, { len: 0.42, hMax: 0.36, yaw: (x * 47 + y * 13) % 360 }, V(), 0));
    });
  }
  function cargo() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.5, 0.56), R3.fogify(R3.pbr('bulkhead', { metal: true, color: 0x9aa8b2 }).clone()));
    body.position.y = 0.25; body.castShadow = true; body.receiveShadow = true;
    g.add(body);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.58), new THREE.MeshStandardMaterial({ color: 0x6fd8ff, emissive: 0x4fc8ff, emissiveIntensity: 1.6 }));
    strip.position.y = 0.38; g.add(strip);
    g.add(pillar());
    return g;
  }
  /* лестница на крышу: два бруса и перекладины, низ отставлен от стены */
  let ladderGroup = null;
  function ladders(B) {
    if (ladderGroup) group.remove(ladderGroup);
    ladderGroup = new THREE.Group(); group.add(ladderGroup);
    const mat = R3.fogify(R3.pbr('wood', { color: 0xb8a088 }).clone());
    (B.ladders || []).forEach(function (l) {
      const h0 = B.hgt[l.y * B.w + l.x] * LV, h1 = B.hgt[l.ry * B.w + l.rx] * LV;
      // общая грань клетки лестницы и крыши
      const top = l.d === 0 ? V(l.x * T, h1 + 0.25, (l.y + 0.5) * T) : V((l.x + 0.5) * T, h1 + 0.25, l.y * T);
      const bot = l.d === 0 ? V(l.x * T + 0.38, h0, (l.y + 0.5) * T) : V((l.x + 0.5) * T, h0, l.y * T + 0.38);
      const along = l.d === 0 ? V(0, 0, 1) : V(1, 0, 0);
      const g = new THREE.Group();
      const len = top.distanceTo(bot), mid = top.clone().add(bot).multiplyScalar(0.5);
      const dir = top.clone().sub(bot).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir);
      [-0.22, 0.22].forEach(function (s) {
        const r = new THREE.Mesh(new THREE.BoxGeometry(0.05, len, 0.05), mat);
        r.position.copy(mid).addScaledVector(along, s); r.quaternion.copy(q); r.castShadow = true;
        g.add(r);
      });
      const n = Math.max(3, Math.round(len / 0.3));
      for (let k = 1; k < n; k++) {
        const p = bot.clone().lerp(top, k / n);
        const rung = new THREE.Mesh(new THREE.BoxGeometry(l.d === 0 ? 0.035 : 0.46, 0.035, l.d === 0 ? 0.46 : 0.035), mat);
        rung.position.copy(p); rung.castShadow = true;
        g.add(rung);
      }
      ladderGroup.add(g);
    });
  }
  /* зона эвакуации: зелёные клетки с контуром (показываются, если эвакуация доступна) */
  let evacMesh = null;
  function evac(B) {
    if (evacMesh) { group.remove(evacMesh); evacMesh = null; }
    if (!B.evac || !B.evac.length) return;
    const set = {};
    B.evac.forEach(function (e) { set[e[1] * B.w + e[0]] = 1; });
    const P = [], I = [];
    B.evac.forEach(function (e) {
      const x = e[0], y = e[1], h = B.hgt[y * B.w + x] * LV + 0.03, o = P.length / 3;
      P.push(x * T, h, (y + 1) * T, (x + 1) * T, h, (y + 1) * T, (x + 1) * T, h, y * T, x * T, h, y * T);
      I.push(o, o + 1, o + 2, o, o + 2, o + 3);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I);
    evacMesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x7fd06a, transparent: true, opacity: 0.08, depthWrite: false, fog: false }));
    evacMesh.renderOrder = 3;
    group.add(evacMesh);
  }

  IT.init = function (B) {
    if (group) R3.scene.remove(group);
    group = new THREE.Group(); group.name = 'items';
    R3.scene.add(group);
    meshes = {}; captive = null; B0 = B;
    ladders(B);
    evac(B);
  };
  const key = function (it) { return it.x + ',' + it.y + ',' + it.kind; };
  IT.update = function (t) {
    const B = DW.BT.get();
    if (!B || B !== B0 || !group) return;
    // предметы: новые — поставить, подобранные — убрать
    const live = {};
    (B.items || []).forEach(function (it) {
      const k = key(it);
      live[k] = 1;
      if (meshes[k]) return;
      const base = V((it.x + 0.5) * T, B.hgt[it.y * B.w + it.x] * LV, (it.y + 0.5) * T);
      const holder = new THREE.Group(); holder.position.copy(base);
      meshes[k] = holder; group.add(holder);
      if (it.kind === 'gems') holder.add(gems());
      else if (it.kind === 'cargo') holder.add(cargo());
      else crate(it.kind, it.x, it.y, function (m) { if (meshes[k] === holder) holder.add(m); });
    });
    for (const k in meshes) if (!live[k]) { group.remove(meshes[k]); delete meshes[k]; }
    // покачивание кристаллов, видимость по разведке
    for (const k in meshes) {
      const m = meshes[k], p = k.split(',');
      const i = (+p[1]) * B.w + (+p[0]);
      m.visible = !!(B.explored && B.explored[i]);
      m.children.forEach(function (c) { if (c.userData.bob) { c.position.y = 0.06 + Math.sin(t / 420 + i) * 0.05; c.rotation.y = t / 1600 + i; } });
    }
    // пленник: стоит на коленях, руки связаны, пока не освобождён
    const gl = B.goal;
    const need = gl && gl.kind === 'rescue' && !gl.done;
    if (need && !captive && R3.units.staticFigure) {
      captive = { pending: true };
      R3.units.staticFigure('pris4', 'duck', 0.4, function (h) {
        if (!captive || !captive.pending || !group) return;
        h.position.set((gl.x + 0.5) * T, B.hgt[gl.y * B.w + gl.x] * LV, (gl.y + 0.5) * T);
        h.rotation.y = Math.PI * 0.25;
        group.add(h);
        const rope = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 5, 12), new THREE.MeshStandardMaterial({ color: 0xa08050, roughness: 0.9 }));
        rope.position.set(0, 0.75, 0.15); rope.rotation.x = Math.PI / 2;
        h.add(rope);
        captive = { h: h };
      });
    }
    if (captive && captive.h) {
      captive.h.visible = !!(B.explored && B.explored[gl.y * B.w + gl.x]);
      if (!need) { group.remove(captive.h); captive = null; }
    }
  };
})(window.DW);
