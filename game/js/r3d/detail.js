'use strict';
/* 3D-бой: мелкие детали и свет. Сухая трава, кусты, камешки, кирпичи, кости, шины, банки, бумага, трубы,
   арматура, проволока, пни, сталагмиты, грибы и кристаллы со свечением, фонари и костры — всё из списков карты
   (B.props, B.decor), плюс россыпь по виду грунта. Мелочь — instanced-сетки (одна отрисовка на вид).
   Следы на земле: трещины, лужи, дорога, гарь, «вены» плоти. Огни (фонари, костры, кристаллы, грибы) — общий
   набор точечных источников: светят ближайшие к камере (их число — по уровню графики). */
(function (DW) {
  const R3 = DW.R3, THREE = R3.THREE;
  if (!THREE) return;
  const T = R3.T, LV = R3.LV;
  const DT = R3.detail = {};
  const V = function (x, y, z) { return new THREE.Vector3(x || 0, y || 0, z || 0); };
  let group = null, lights = [], sources = [];
  function rng(seed) { let s = seed >>> 0 || 1; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

  /* ---------- Текстуры на холсте ---------- */
  function canvasTex(w, h, draw, srgb) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    if (srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }
  let grassTex = null, crackTex = null, veinTex = null;
  function grass() {
    return grassTex || (grassTex = canvasTex(128, 128, function (g, w, h) {
      const r = rng(7);
      for (let i = 0; i < 34; i++) {
        const x = 10 + r() * 108, lean = (r() - 0.5) * 40, top = 20 + r() * 70;
        const c = 120 + Math.floor(r() * 70);
        g.strokeStyle = 'rgb(' + c + ',' + Math.floor(c * 0.86) + ',' + Math.floor(c * 0.55) + ')';
        g.lineWidth = 1.5 + r() * 2;
        g.beginPath(); g.moveTo(x, h); g.quadraticCurveTo(x + lean * 0.3, h - top * 0.5, x + lean, h - top); g.stroke();
      }
    }));
  }
  let puddleTex = null;
  function puddleMask() {
    return puddleTex || (puddleTex = canvasTex(128, 128, function (g) {
      const r = rng(17);
      g.fillStyle = '#000'; g.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 7; i++) {
        const x = 64 + (r() - 0.5) * 44, y = 64 + (r() - 0.5) * 30, rr = 14 + r() * 22;
        const gr = g.createRadialGradient(x, y, 1, x, y, rr); gr.addColorStop(0, '#fff'); gr.addColorStop(0.7, '#ccc'); gr.addColorStop(1, '#000');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill();
      }
    }, false));
  }
  function crack() {
    return crackTex || (crackTex = canvasTex(256, 256, function (g, w, h) {
      const r = rng(11);
      g.strokeStyle = 'rgba(15,12,10,0.85)';
      const branch = function (x, y, a, len, wd) {
        if (len < 8 || wd < 0.4) return;
        const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
        g.lineWidth = wd; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
        branch(x2, y2, a + (r() - 0.5) * 0.9, len * 0.75, wd * 0.75);
        if (r() < 0.5) branch(x2, y2, a + (r() < 0.5 ? 1 : -1) * (0.6 + r() * 0.6), len * 0.55, wd * 0.6);
      };
      for (let i = 0; i < 3; i++) branch(128, 128, r() * 6.28, 40, 3);
    }));
  }
  function veins() {
    return veinTex || (veinTex = canvasTex(256, 256, function (g, w, h) {
      const r = rng(5);
      for (let i = 0; i < 10; i++) {
        g.strokeStyle = 'rgba(' + (110 + Math.floor(r() * 40)) + ',30,45,0.8)'; g.lineWidth = 2 + r() * 5;
        g.beginPath(); let x = r() * w, y = r() * h; g.moveTo(x, y);
        for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 70; y += (r() - 0.5) * 70; g.lineTo(x, y); }
        g.stroke();
      }
    }));
  }

  /* ---------- Instanced-наборы ---------- */
  const sets = {};
  function set(key, geo, mat, cast) {
    if (sets[key]) return sets[key];
    return (sets[key] = { geo: geo, mat: mat, cast: cast !== false, list: [] });
  }
  function put(key, x, y, z, s, ry, rx, rz, sy, color) { sets[key].list.push([x, y, z, s, ry || 0, rx || 0, rz || 0, sy || 1, color]); }
  function flush() {
    const d = new THREE.Object3D();
    for (const k in sets) {
      const S = sets[k];
      if (!S.list.length) continue;
      const m = new THREE.InstancedMesh(S.geo, S.mat, S.list.length);
      S.list.forEach(function (p, i) {
        d.position.set(p[0], p[1], p[2]); d.rotation.set(p[5], p[4], p[6], 'YXZ'); d.scale.set(p[3], p[3] * p[7], p[3]); d.updateMatrix();
        m.setMatrixAt(i, d.matrix);
        if (p[8]) m.setColorAt(i, p[8]);
      });
      m.castShadow = S.cast; m.receiveShadow = true;
      m.frustumCulled = false;
      group.add(m);
    }
  }
  function mats() {
    const fm = function (m) { return R3.fogify(m); };
    const grassMat = fm(new THREE.MeshStandardMaterial({ map: grass(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1, color: 0xffffff }));
    // пучок травы: две скрещённые плоскости
    const gq = new THREE.PlaneGeometry(0.5, 0.42); gq.translate(0, 0.21, 0);
    const g2 = gq.clone(); g2.rotateY(Math.PI / 2);
    const tuftGeo = THREE.BufferGeometryUtils.mergeGeometries([gq, g2]);
    set('tuft', tuftGeo, grassMat, false);
    set('reeds', tuftGeo, fm(new THREE.MeshStandardMaterial({ map: grass(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1, color: 0x9a9a70 })), false);
    set('stone', new THREE.IcosahedronGeometry(0.09, 0), R3.fogify(R3.pbr('rock').clone()), false);
    set('brick', new THREE.BoxGeometry(0.22, 0.07, 0.11), R3.fogify(R3.pbr('brick').clone()), false);
    set('bone', new THREE.CylinderGeometry(0.018, 0.022, 0.32, 5), fm(new THREE.MeshStandardMaterial({ color: 0xd8cfb8, roughness: 0.8 })), false);
    set('skull', new THREE.SphereGeometry(0.09, 8, 6), fm(new THREE.MeshStandardMaterial({ color: 0xd8cfb8, roughness: 0.75 })));
    set('tire', new THREE.TorusGeometry(0.24, 0.09, 6, 14), fm(new THREE.MeshStandardMaterial({ color: 0x1c1b1a, roughness: 0.9 })));
    set('can', new THREE.CylinderGeometry(0.035, 0.035, 0.12, 8), fm(new THREE.MeshStandardMaterial({ color: 0x8a5a3a, metalness: 0.6, roughness: 0.5 })), false);
    set('paper', new THREE.PlaneGeometry(0.2, 0.28), fm(new THREE.MeshStandardMaterial({ color: 0xcfc6b0, roughness: 1, side: THREE.DoubleSide })), false);
    set('pipe', new THREE.CylinderGeometry(0.06, 0.06, 1.0, 8), R3.fogify(R3.pbr('bulkhead', { metal: true }).clone()));
    set('rebar', new THREE.CylinderGeometry(0.012, 0.012, 0.7, 4), fm(new THREE.MeshStandardMaterial({ color: 0x6a3a22, metalness: 0.7, roughness: 0.6 })), false);
    set('wire', new THREE.TorusGeometry(0.2, 0.012, 4, 18), fm(new THREE.MeshStandardMaterial({ color: 0x55504a, metalness: 0.8, roughness: 0.4 })), false);
    set('stump', new THREE.CylinderGeometry(0.16, 0.2, 0.32, 9), R3.fogify(R3.pbr('wood').clone()));
    set('stalag', new THREE.ConeGeometry(0.22, 1.1, 7), R3.fogify(R3.pbr('rock').clone()));
    set('shroom', new THREE.SphereGeometry(0.07, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), fm(new THREE.MeshStandardMaterial({ color: 0x9effc0, emissive: 0x4fe090, emissiveIntensity: 1.2, roughness: 0.6 })), false);
    set('stalk', new THREE.CylinderGeometry(0.012, 0.016, 0.12, 5), fm(new THREE.MeshStandardMaterial({ color: 0xcfe8d0, roughness: 0.8 })), false);
    set('shard', new THREE.OctahedronGeometry(0.12, 0), fm(new THREE.MeshStandardMaterial({ color: 0x9af0ff, emissive: 0x2fb8d8, emissiveIntensity: 1.0, roughness: 0.2, metalness: 0.1 })));
    set('sign', new THREE.BoxGeometry(0.5, 0.35, 0.03), fm(new THREE.MeshStandardMaterial({ color: 0x8a7a50, metalness: 0.5, roughness: 0.7 })));
    set('pole', new THREE.CylinderGeometry(0.025, 0.025, 1.2, 6), fm(new THREE.MeshStandardMaterial({ color: 0x55504a, metalness: 0.6, roughness: 0.6 })));
    set('log', new THREE.CylinderGeometry(0.07, 0.08, 0.6, 7), R3.fogify(R3.pbr('wood').clone()));
    set('sleeper', new THREE.BoxGeometry(0.24, 0.12, 2.6), R3.fogify(R3.pbr('wood', { color: 0x6a5a48 }).clone()));
    set('railbar', new THREE.BoxGeometry(T + 0.01, 0.14, 0.08), fm(new THREE.MeshStandardMaterial({ color: 0x5c534a, metalness: 0.75, roughness: 0.45 })));
  }

  /* ---------- Следы на земле ---------- */
  function groundDecal(x, z, y, size, mat, rot) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
    m.rotation.x = -Math.PI / 2; m.rotation.z = rot || 0;
    m.position.set(x, y + 0.008, z);
    m.receiveShadow = true; m.renderOrder = 1;
    group.add(m);
    return m;
  }

  /* ---------- Сборка ---------- */
  DT.build = function (B) {
    if (group) R3.scene.remove(group);
    group = new THREE.Group(); group.name = 'detail';
    R3.scene.add(group);
    for (const k in sets) sets[k].list = [];
    sources = [];
    mats();
    const r = rng(B.seed || 1);
    const hAt = function (x, y) { const xi = Math.max(0, Math.min(B.w - 1, Math.floor(x))), yi = Math.max(0, Math.min(B.h - 1, Math.floor(y))); return B.hgt[yi * B.w + xi] * LV; };
    const free = function (x, y) { const xi = Math.floor(x), yi = Math.floor(y); return xi >= 0 && yi >= 0 && xi < B.w && yi < B.h && !B.obj[yi * B.w + xi]; };
    const decalMat = function (tex, opts) { return R3.fogify(new THREE.MeshStandardMaterial(Object.assign({ map: tex, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 }, opts || {}))); };
    // предметы-мелочи из карты
    // над провалом (овраг) мелочи нет
    const pit = function (x, y) { const xi = Math.floor(x), yi = Math.floor(y); return xi >= 0 && yi >= 0 && xi < B.w && yi < B.h && B.ground[yi * B.w + xi] === 10; };
    (B.props || []).forEach(function (p) {
      if (pit(p.x, p.y)) return;
      const X = p.x * T, Z = p.y * T, Y = hAt(p.x, p.y);
      const s = 0.8 + r() * 0.4, ry = r() * 6.28;
      switch (p.t) {
        case 'tuft': for (let i = 0; i < 3; i++) put('tuft', X + (r() - 0.5) * 0.3, Y, Z + (r() - 0.5) * 0.3, 0.7 + r() * 0.6, r() * 6.28); break;
        case 'reeds': for (let i = 0; i < 4; i++) put('reeds', X + (r() - 0.5) * 0.35, Y, Z + (r() - 0.5) * 0.35, 1.3 + r() * 0.8, r() * 6.28, 0, 0, 1.6); break;
        case 'bush': for (let i = 0; i < 5; i++) put('tuft', X + (r() - 0.5) * 0.4, Y, Z + (r() - 0.5) * 0.4, 1.1 + r() * 0.6, r() * 6.28, 0, 0, 1.3, new THREE.Color(0x8a7050)); break;
        case 'bricks': for (let i = 0; i < 7; i++) put('brick', X + (r() - 0.5) * 0.5, Y + 0.035 + (i > 4 ? 0.07 : 0), Z + (r() - 0.5) * 0.5, 1, r() * 6.28, (r() - 0.5) * 0.4, (r() - 0.5) * 0.4); break;
        case 'bones': for (let i = 0; i < 4; i++) put('bone', X + (r() - 0.5) * 0.4, Y + 0.02, Z + (r() - 0.5) * 0.4, s, r() * 6.28, Math.PI / 2); break;
        case 'skull': put('skull', X, Y + 0.06, Z, s, ry, 0, 0, 0.85); put('bone', X + 0.15, Y + 0.02, Z, s, ry, Math.PI / 2); break;
        case 'tire': put('tire', X, Y + 0.09, Z, s, ry, Math.PI / 2 + (r() - 0.5) * 0.3); break;
        case 'can': for (let i = 0; i < 3; i++) put('can', X + (r() - 0.5) * 0.4, Y + 0.035, Z + (r() - 0.5) * 0.4, 1, r() * 6.28, Math.PI / 2); break;
        case 'papers': for (let i = 0; i < 4; i++) put('paper', X + (r() - 0.5) * 0.5, Y + 0.012, Z + (r() - 0.5) * 0.5, 1, r() * 6.28, -Math.PI / 2 + (r() - 0.5) * 0.2); break;
        case 'pipe': put('pipe', X, Y + 0.06, Z, s, ry, 0, Math.PI / 2); break;
        case 'rebar': for (let i = 0; i < 4; i++) put('rebar', X + (r() - 0.5) * 0.3, Y + 0.25, Z + (r() - 0.5) * 0.3, 1, r() * 6.28, (r() - 0.5) * 0.9, (r() - 0.5) * 0.9); break;
        case 'wire': put('wire', X, Y + 0.05, Z, s, ry, Math.PI / 2 + 0.2); put('wire', X + 0.12, Y + 0.05, Z, s * 0.8, ry, Math.PI / 2 - 0.2); break;
        case 'stump': put('stump', X, Y + 0.16, Z, s, ry); break;
        case 'stalag': put('stalag', X, Y + 0.5 * s, Z, s, ry); break;
        case 'sign': put('pole', X, Y + 0.6, Z, 1, 0, (r() - 0.5) * 0.25); put('sign', X, Y + 1.05, Z, 1, ry); break;
        case 'shroom':
          for (let i = 0; i < 5; i++) { const ox = (r() - 0.5) * 0.35, oz = (r() - 0.5) * 0.35, k = 0.6 + r() * 0.8; put('stalk', X + ox, Y + 0.06 * k, Z + oz, k); put('shroom', X + ox, Y + 0.12 * k, Z + oz, k); }
          sources.push({ p: V(X, Y + 0.3, Z), c: 0x8cffb4, i: 1.2, d: 3.2, flick: 0 });
          break;
        case 'shards':
          for (let i = 0; i < 4; i++) put('shard', X + (r() - 0.5) * 0.35, Y + 0.08, Z + (r() - 0.5) * 0.35, 0.7 + r() * 0.8, r() * 6.28, (r() - 0.5) * 0.6, (r() - 0.5) * 0.6, 1.8);
          sources.push({ p: V(X, Y + 0.35, Z), c: 0x78e6ff, i: 1.4, d: 3.5, flick: 0 });
          break;
        case 'lamp':
          const lg = group;
          R3.loadGLB('models/' + ((DW.M3.street && DW.M3.street[0] && DW.M3.street[0].f) || 'e_lamp') + '.glb').then(function (gl) { if (gl && group === lg) group.add(R3.world.placeModel(gl, { len: 0.6, hMax: 2.4 }, V(X, Y, Z), ry * 57)); });
          sources.push({ p: V(X, Y + 2.2, Z), c: 0xffcd8c, i: 3.2, d: 9, flick: 1, night: true });
          break;
      }
    });
    // следы на земле и прочее из decor
    (B.decor || []).forEach(function (d) {
      if (d.t !== 'road' && d.t !== 'rail' && pit(d.x, d.y)) return;
      const X = d.x * T, Z = d.y * T, Y = hAt(d.x, d.y);
      switch (d.t) {
        case 'crack': groundDecal(X, Z, Y, 1.4 + d.r * 1.2, decalMat(crack()), d.r * 6.28); break;
        case 'veins': groundDecal(X, Z, Y, 1.8 + d.r * 1.4, decalMat(veins(), { roughness: 0.5 }), d.r * 6.28); break;
        case 'scorch': if (R3.fx && R3.fx.decal) R3.fx.decal(d.x - 0.5, d.y - 0.5, 'scorch', 0.8 + d.r); break;
        case 'blood': if (R3.fx && R3.fx.decal) R3.fx.decal(d.x - 0.5, d.y - 0.5, 'red', 0.6 + d.r * 0.5); break;
        case 'puddle': {
          groundDecal(X, Z, Y, 1.0 + d.r * 1.4, R3.fogify(new THREE.MeshStandardMaterial({ color: 0x343a3e, alphaMap: puddleMask(), roughness: 0.05, metalness: 0.15, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 })), d.r * 6.28);
          break;
        }
        case 'grass': for (let i = 0; i < 6; i++) put('tuft', X + (r() - 0.5) * 0.9, Y, Z + (r() - 0.5) * 0.9, 0.6 + r() * 0.7, r() * 6.28); break;
        case 'bones': for (let i = 0; i < 3; i++) put('bone', X + (r() - 0.5) * 0.4, Y + 0.02, Z + (r() - 0.5) * 0.4, 0.9, r() * 6.28, Math.PI / 2); break;
        case 'crystal': for (let i = 0; i < 3; i++) put('shard', X + (r() - 0.5) * 0.3, Y + 0.08, Z + (r() - 0.5) * 0.3, 0.8 + r() * 0.7, r() * 6.28, (r() - 0.5) * 0.5, 0, 1.8); break;
        case 'road': {
          const w = (d.w || B.w) * T;
          const ta = R3.texNew('tex3d/asphalt_c.jpg', true), tn = R3.texNew('tex3d/asphalt_n.jpg');
          ta.repeat.set(w / 2, T * 0.9); tn.repeat.set(w / 2, T * 0.9);
          const m = new THREE.Mesh(new THREE.PlaneGeometry(w, T * 1.8), R3.fogify(new THREE.MeshStandardMaterial({ map: ta, normalMap: tn, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1 })));
          // полотно на двух рядах (d.y и d.y+1); d.v — поперёк, вдоль столбцов d.x и d.x+1
          m.rotation.x = -Math.PI / 2;
          if (d.v) { m.rotation.z = Math.PI / 2; m.position.set((d.x + 1) * T, hAt(d.x + 1, d.y + 1) + 0.006, w / 2 + d.y * T); }
          else m.position.set(w / 2 + d.x * T, hAt(d.x + 1, d.y + 1) + 0.006, (d.y + 1) * T);
          m.receiveShadow = true;
          group.add(m);
          break;
        }
        case 'rail': {
          // путь колеи 1520 мм вдоль x: шпалы через 0,6 м, два рельса; d.y — ось пути (граница рядов)
          const len = (d.w || B.w) * T, zc = d.y * T;
          for (let xx = 0.3; xx < len; xx += 0.62) put('sleeper', d.x * T + xx, hAt(d.x + xx / T, d.y) + 0.05, zc, 1, 0);
          for (let k = 0; k < (d.w || B.w); k++) { const X = (d.x + k + 0.5) * T, Y = hAt(d.x + k + 0.5, d.y); put('railbar', X, Y + 0.16, zc - 0.76, 1, 0); put('railbar', X, Y + 0.16, zc + 0.76, 1, 0); }
          break;
        }
        case 'fire': {
          d._3d = true;
          for (let i = 0; i < 5; i++) put('log', X + Math.cos(i * 1.26) * 0.12, Y + 0.05, Z + Math.sin(i * 1.26) * 0.12, 1, -i * 1.26, 0, Math.PI / 2 - 0.3);
          for (let i = 0; i < 8; i++) put('stone', X + Math.cos(i * 0.785) * 0.38, Y + 0.04, Z + Math.sin(i * 0.785) * 0.38, 1.2, r() * 6.28);
          sources.push({ p: V(X, Y + 0.45, Z), c: 0xff9a40, i: 4, d: 8, flick: 2, fire: true });
          break;
        }
      }
    });
    // россыпь по грунту: камешки на щебне, земле и в пещере, трава на пыли и земле
    for (let y = 0; y < B.h; y++) for (let x = 0; x < B.w; x++) {
      const i = y * B.w + x, gid = B.ground[i];
      if (B.obj[i] || (DW.BT.stairAt && DW.BT.stairAt(i))) continue;
      const Y = B.hgt[i] * LV;
      const n = gid === 8 ? 4 : (gid === 5 ? 3 : (gid === 2 || gid === 0 ? 1 : 0));
      for (let k = 0; k < n; k++) if (r() < 0.75) put('stone', (x + r()) * T, Y + 0.02, (y + r()) * T, 0.35 + r() * 0.6, r() * 6.28, r() * 3, r() * 3);
      if ((gid === 0 || gid === 2) && r() < 0.08) for (let k = 0; k < 3; k++) put('tuft', (x + r()) * T, Y, (y + r()) * T, 0.6 + r() * 0.6, r() * 6.28);
    }
    // мир вокруг поля: за краем карты — руины, сухие деревья, валуны, обломки, остовы машин (уходят в дымку)
    backdrop(B, r);
    flush();
    // источники света
    const q = R3.q();
    const n = [2, 4, 6][q];
    lights.forEach(function (l) { R3.scene.remove(l); });
    lights = [];
    for (let i = 0; i < n; i++) { const l = new THREE.PointLight(0xffffff, 0, 6, 1.6); l.castShadow = false; R3.scene.add(l); lights.push(l); }
    DT.B = B;
  };
  /* фон за краем поля: по кольцу шириной ~12 м вокруг карты; набор — по виду карты */
  const BACK = {
    city: [['e_rubble', 1.3, 1.6], ['e_container', 1.6, 1.6], ['e_vaz_burned', 1.5, 1.1], ['e_deadtree', 0, 3.4, 3.2], ['e_boulder', 1.2, 1.4], ['e_btr80', 2.3, 1.7], ['e_paz', 2.4, 2.0]],
    wild: [['e_deadtree', 0, 3.6, 3.4], ['e_deadtree', 0, 3.0, 2.8], ['e_boulder', 1.5, 1.6], ['e_boulder', 1.1, 1.2], ['e_log', 1.4, 0.8], ['e_rubble', 1.2, 1.3]],
    cave: [['e_boulder', 1.8, 2.6], ['e_boulder', 1.4, 2.0], ['e_crystal', 0.9, 1.4], ['e_chitin', 1.0, 1.2]]
  };
  const BTYPE = { ruins: 'city', landing: 'city', factory: 'city', camp: 'city', site: 'city', vault: 'city', defense: 'city', forest: 'wild', swamp: 'wild', lair: 'wild', nest: 'cave', vein: 'cave', crystalcave: 'cave',
    district: 'city', powerplant: 'city', railyard: 'city', bridge: 'wild', quarry: 'wild' };
  function backdrop(B, r) {
    const kind = BTYPE[B.map] || 'wild';
    if (B.tod === 'interior') return;      // в помещении — стены, а не горизонт
    const list = BACK[kind];
    // крупный фон из моделей Tripo (пятиэтажки, цеха, башни, ЛЭП, остовы, скалы): реже и дальше, не друг на друге
    const big = (DW.M3 && DW.M3.back && DW.M3.back[kind]) || [];
    const placed = [];
    if (big.length) {
      const nb = Math.round((B.w + B.h) * T / 9);
      for (let i = 0, tries = 0; i < nb && tries < nb * 6; tries++) {
        const e = big[Math.floor(r() * big.length)];
        const side = Math.floor(r() * 4), d = e.d0 + r() * (e.d1 - e.d0), t = r();
        const W0 = B.w * T, H0 = B.h * T;
        let x, z;
        if (side === 0) { x = -d; z = t * H0; } else if (side === 1) { x = W0 + d; z = t * H0; } else if (side === 2) { z = -d; x = t * W0; } else { z = H0 + d; x = t * W0; }
        const rad = e.len * 0.55;
        if (placed.some(function (p) { return Math.hypot(p[0] - x, p[1] - z) < p[2] + rad; })) continue;
        placed.push([x, z, rad]); i++;
        // фасадом к полю
        const yaw = (side === 0 ? 90 : side === 1 ? -90 : side === 2 ? 0 : 180) + (r() - 0.5) * 40;
        const bg = group, pos = V(x, -0.6, z);
        R3.loadGLB('models/' + e.f + '.glb').then(function (gl) {
          if (!gl || bg !== group || DT.B !== B) return;
          const m = R3.world.placeModel(gl, { f: e.f, len: e.len, hMax: e.hMax }, pos, yaw);
          m.traverse(function (o) { if (o.isMesh) o.castShadow = false; });
          group.add(m);
        });
      }
    }
    const W = B.w * T, Hh = B.h * T;
    const n = Math.round((W + Hh) * 0.42);
    for (let i = 0; i < n; i++) {
      // точка на кольце за краем: 1,5–12 м от края, гуще ближе к краю
      const side = Math.floor(r() * 4), d = 1.6 + Math.pow(r(), 1.6) * 11, t = r();
      let x, z;
      if (side === 0) { x = -d; z = t * (Hh + 2 * d) - d; }
      else if (side === 1) { x = W + d; z = t * (Hh + 2 * d) - d; }
      else if (side === 2) { z = -d; x = t * (W + 2 * d) - d; }
      else { z = Hh + d; x = t * (W + 2 * d) - d; }
      const e = list[Math.floor(r() * list.length)];
      const v = { len: e[1], h: e[3] || 0, hMax: e[2] };
      const pos = V(x, -0.6, z), yaw = r() * 360;
      const bg = group;
      R3.loadGLB('models/' + e[0] + '.glb').then(function (gl) {
        if (!gl || bg !== group || DT.B !== B) return;
        const m = R3.world.placeModel(gl, v, pos, yaw);
        m.traverse(function (o) { if (o.isMesh) o.castShadow = false; });
        group.add(m);
      });
      // россыпь камней и травы рядом
      for (let k = 0; k < 3; k++) put('stone', x + (r() - 0.5) * 2, -0.58, z + (r() - 0.5) * 2, 0.5 + r() * 1.2, r() * 6.28, r() * 3, r() * 3);
      if (kind === 'wild' && r() < 0.6) for (let k = 0; k < 4; k++) put('tuft', x + (r() - 0.5) * 2.5, -0.6, z + (r() - 0.5) * 2.5, 0.8 + r() * 0.8, r() * 6.28);
    }
  }
  /* новый огонь в бою (взорвалась бочка): костёр из decor, которого ещё нет */
  DT.refreshFires = function (B) {
    if (!group || DT.B !== B) return;
    (B.decor || []).forEach(function (d) {
      if (d.t !== 'fire' || d._3d) return;
      d._3d = true;
      const X = d.x * T, Z = d.y * T, Y = B.hgt[Math.max(0, Math.min(B.h - 1, Math.floor(d.y))) * B.w + Math.max(0, Math.min(B.w - 1, Math.floor(d.x)))] * LV;
      if (!sources.some(function (q) { return q.fire && Math.abs(q.p.x - X) < 0.3 && Math.abs(q.p.z - Z) < 0.3; })) sources.push({ p: V(X, Y + 0.45, Z), c: 0xff9a40, i: 4, d: 8, flick: 2, fire: true });
    });
  };
  /* огни: светят ближайшие к точке взгляда; мерцание костров и фонарей */
  DT.update = function (t) {
    if (!lights.length) return;
    const B = DT.B;
    const night = B && (B.tod === 'night' || B.tod === 'dusk' || B.tod === 'dawn' || B.tod === 'cave' || B.tod === 'interior');
    const cx = R3.cam.tx, cz = R3.cam.tz;
    const list = sources.filter(function (s) { return night || s.fire; }).sort(function (a, b) { return (a.p.x - cx) * (a.p.x - cx) + (a.p.z - cz) * (a.p.z - cz) - ((b.p.x - cx) * (b.p.x - cx) + (b.p.z - cz) * (b.p.z - cz)); });
    // огонь костра: частицы
    sources.forEach(function (s) {
      if (s.fire && R3.fx && R3.fx.puff && Math.random() < 0.5) {
        R3.fx.puff(s.p.clone().add(V(0, -0.3, 0)), 1, { add: true, sp: 0.15, up: 0.6, upr: 0.5, drag: 0.5, life: 520, s0: 0.16, s1: 0.04, a: 0.9, c: Math.random() < 0.5 ? '#ff9a3a' : '#ffd070', r: 0.2 });
        if (Math.random() < 0.3) R3.fx.puff(s.p.clone().add(V(0, 0.2, 0)), 1, { sp: 0.15, up: 0.5, upr: 0.4, drag: 0.4, life: 2400, s0: 0.15, s1: 0.7, a: 0.18, c: '#5a524a', fadeIn: 0.1 });
      }
    });
    lights.forEach(function (l, i) {
      const s = list[i];
      if (!s) { l.intensity = 0; return; }
      l.position.copy(s.p); l.color.set(s.c); l.distance = s.d;
      const fl = s.flick === 2 ? 0.75 + Math.sin(t / 70 + i) * 0.12 + Math.random() * 0.15 : (s.flick === 1 ? (Math.random() < 0.02 ? 0.3 : 1) : 1);
      l.intensity = s.i * fl * (night ? 1 : 0.6);
    });
  };
})(window.DW);
