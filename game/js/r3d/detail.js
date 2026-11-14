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
  let group = null, lights = [], sources = [], glows = [];   // glows — ореолы без своего света (кристаллы из decor)
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
  let grassTex = null;
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
  /* трава качается на ветру (R3.windU — сила по погоде): верх пучка ходит, корень на месте; фаза — от места
     пучка, по полю идёт волна. Только вершинный шейдер, ~10 операций на вершину */
  function sway(sh) {
    sh.uniforms.uWind = R3.windU ? R3.windU.uWind : { value: 0.35 };
    sh.vertexShader = 'uniform float uWind, uTime;\n' + sh.vertexShader.replace('#include <project_vertex>', [
      'vec4 mvPosition = vec4( transformed, 1.0 );',
      '#ifdef USE_INSTANCING',
      '  mvPosition = instanceMatrix * mvPosition;',
      '#endif',
      '{ float sw = clamp( position.y / 0.42, 0.0, 1.0 ); sw *= sw * uWind;',
      '  float ph = uTime * ( 1.3 + uWind ) + dot( mvPosition.xz, vec2( 0.55, 0.35 ) );',
      '  mvPosition.x += sw * ( 0.075 * sin( ph ) + 0.025 * sin( ph * 2.7 + 1.3 ) );',
      '  mvPosition.z += sw * 0.045 * sin( ph * 0.8 + 0.6 ); }',
      'mvPosition = modelViewMatrix * mvPosition;',
      'gl_Position = projectionMatrix * mvPosition;'
    ].join('\n'));
  }
  function grassMat(color) {
    const m = new THREE.MeshStandardMaterial({ map: grass(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1, color: color });
    m.userData.key = 'grass';
    return R3.fogify(m, sway);
  }
  function mats() {
    if (sets.tuft) return;
    const fm = function (m) { return R3.fogify(m); };
    // пучок травы: две скрещённые плоскости
    const gq = new THREE.PlaneGeometry(0.5, 0.42); gq.translate(0, 0.21, 0);
    const g2 = gq.clone(); g2.rotateY(Math.PI / 2);
    const tuftGeo = THREE.BufferGeometryUtils.mergeGeometries([gq, g2]);
    set('tuft', tuftGeo, grassMat(0xffffff), false);
    set('reeds', tuftGeo, grassMat(0x9a9a70), false);
    set('stone', new THREE.IcosahedronGeometry(0.09, 0), R3.fogify(R3.pbr('rock').clone()), false);
    // осыпь у подножия уступов: камни крупнее и площе
    set('scree', new THREE.DodecahedronGeometry(0.1, 0), R3.fogify(R3.pbr('rock', { color: 0xb8aea2 }).clone()), false);
    set('brick', new THREE.BoxGeometry(0.22, 0.07, 0.11), R3.fogify(R3.pbr('brick').clone()), false);
    set('bone', new THREE.CylinderGeometry(0.018, 0.022, 0.32, 5), fm(new THREE.MeshStandardMaterial({ color: 0xd8cfb8, roughness: 0.8 })), false);
    // мелочь у земли — без настоящей тени (у основания — запечённое затенение, bake.js)
    set('skull', new THREE.SphereGeometry(0.09, 8, 6), fm(new THREE.MeshStandardMaterial({ color: 0xd8cfb8, roughness: 0.75 })), false);
    set('tire', new THREE.TorusGeometry(0.24, 0.09, 6, 14), fm(new THREE.MeshStandardMaterial({ color: 0x1c1b1a, roughness: 0.9 })), false);
    set('can', new THREE.CylinderGeometry(0.035, 0.035, 0.12, 8), fm(new THREE.MeshStandardMaterial({ color: 0x8a5a3a, metalness: 0.6, roughness: 0.5 })), false);
    set('paper', new THREE.PlaneGeometry(0.2, 0.28), fm(new THREE.MeshStandardMaterial({ color: 0xcfc6b0, roughness: 1, side: THREE.DoubleSide })), false);
    set('pipe', new THREE.CylinderGeometry(0.06, 0.06, 1.0, 8), R3.fogify(R3.pbr('bulkhead', { metal: true }).clone()), false);
    set('rebar', new THREE.CylinderGeometry(0.012, 0.012, 0.7, 4), fm(new THREE.MeshStandardMaterial({ color: 0x6a3a22, metalness: 0.7, roughness: 0.6 })), false);
    set('wire', new THREE.TorusGeometry(0.2, 0.012, 4, 18), fm(new THREE.MeshStandardMaterial({ color: 0x55504a, metalness: 0.8, roughness: 0.4 })), false);
    set('stump', new THREE.CylinderGeometry(0.16, 0.2, 0.32, 9), R3.fogify(R3.pbr('wood').clone()), false);
    set('stalag', new THREE.ConeGeometry(0.22, 1.1, 7), R3.fogify(R3.pbr('rock').clone()), false);
    set('shroom', new THREE.SphereGeometry(0.07, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), fm(new THREE.MeshStandardMaterial({ color: 0x9effc0, emissive: 0x4fe090, emissiveIntensity: 1.2, roughness: 0.6 })), false);
    set('stalk', new THREE.CylinderGeometry(0.012, 0.016, 0.12, 5), fm(new THREE.MeshStandardMaterial({ color: 0xcfe8d0, roughness: 0.8 })), false);
    set('shard', new THREE.OctahedronGeometry(0.12, 0), fm(new THREE.MeshStandardMaterial({ color: 0x9af0ff, emissive: 0x2fb8d8, emissiveIntensity: 1.0, roughness: 0.2, metalness: 0.1 })), false);
    set('sign', new THREE.BoxGeometry(0.5, 0.35, 0.03), fm(new THREE.MeshStandardMaterial({ color: 0x8a7a50, metalness: 0.5, roughness: 0.7 })));
    set('pole', new THREE.CylinderGeometry(0.025, 0.025, 1.2, 6), fm(new THREE.MeshStandardMaterial({ color: 0x55504a, metalness: 0.6, roughness: 0.6 })));
    set('log', new THREE.CylinderGeometry(0.07, 0.08, 0.6, 7), R3.fogify(R3.pbr('wood').clone()), false);
    set('sleeper', new THREE.BoxGeometry(0.24, 0.12, 2.6), R3.fogify(R3.pbr('wood', { color: 0x6a5a48 }).clone()), false);
    set('railbar', new THREE.BoxGeometry(T + 0.01, 0.14, 0.08), fm(new THREE.MeshStandardMaterial({ color: 0x5c534a, metalness: 0.75, roughness: 0.45 })), false);
    // стреляные гильзы у укрытий (латунь, лежат на боку)
    const cg = new THREE.CylinderGeometry(0.0075, 0.0075, 0.036, 6); cg.rotateZ(Math.PI / 2);
    set('casing', cg, fm(new THREE.MeshStandardMaterial({ color: 0xc8a050, metalness: 0.85, roughness: 0.35 })), false);
  }

  /* ---------- Следы на земле ----------
     Все следы — одна текстура-атлас 4×4 (трещины, «вены», масло, копоть, колея, сетка трещин асфальта, трещина у
     края уступа, грязь, ржавчина) и одна сетка на всё поле: один вызов отрисовки вместо сотни. Лужи — тоже одной
     сеткой (своя маска и блеск). */
  const AT = { crack: 0, veins: 1, oil: 2, soot: 3, rut: 4, acrack: 5, edge: 6, mud: 7, rust: 8 };
  let atlasTex = null, decalMatC = null, puddleMatC = null;
  function atlas() {
    if (atlasTex) return atlasTex;
    atlasTex = canvasTex(512, 512, function (g) {
      const cell = function (n, draw) { g.save(); g.translate((n % 4) * 128, Math.floor(n / 4) * 128); g.beginPath(); g.rect(4, 4, 120, 120); g.clip(); draw(g, rng(31 + n * 7)); g.restore(); };
      const blob = function (g, r, rgb, a, k, rad) {
        for (let i = 0; i < k; i++) {
          const x = 64 + (r() - 0.5) * 50, y = 64 + (r() - 0.5) * 50, rr = rad * (0.5 + r() * 0.6);
          const gr = g.createRadialGradient(x, y, 1, x, y, rr); gr.addColorStop(0, 'rgba(' + rgb + ',' + a + ')'); gr.addColorStop(1, 'rgba(' + rgb + ',0)');
          g.fillStyle = gr; g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill();
        }
      };
      // трещина: ветвится от середины
      cell(AT.crack, function (g, r) {
        g.strokeStyle = 'rgba(15,12,10,0.85)'; g.lineCap = 'round';
        const br = function (x, y, a, len, wd) {
          if (len < 4 || wd < 0.35) return;
          const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
          g.lineWidth = wd; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
          br(x2, y2, a + (r() - 0.5) * 0.9, len * 0.75, wd * 0.75);
          if (r() < 0.5) br(x2, y2, a + (r() < 0.5 ? 1 : -1) * (0.6 + r() * 0.6), len * 0.55, wd * 0.6);
        };
        for (let i = 0; i < 3; i++) br(64, 64, r() * 6.28, 20, 1.8);
      });
      // «вены» плоти
      cell(AT.veins, function (g, r) {
        for (let i = 0; i < 7; i++) {
          g.strokeStyle = 'rgba(' + (110 + Math.floor(r() * 40)) + ',30,45,0.8)'; g.lineWidth = 1.2 + r() * 2.6;
          g.beginPath(); let x = 64 + (r() - 0.5) * 60, y = 64 + (r() - 0.5) * 60; g.moveTo(x, y);
          for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 36; y += (r() - 0.5) * 36; g.lineTo(x, y); }
          g.stroke();
        }
      });
      // масляное пятно: тёмное, плотное, с разводами
      cell(AT.oil, function (g, r) { blob(g, r, '14,12,10', 0.8, 7, 26); blob(g, r, '40,36,30', 0.35, 4, 34); });
      // копоть: тёмный центр, рваный край, крапины
      cell(AT.soot, function (g, r) {
        const gr = g.createRadialGradient(64, 64, 3, 64, 64, 58); gr.addColorStop(0, 'rgba(8,7,6,0.9)'); gr.addColorStop(0.55, 'rgba(18,15,12,0.55)'); gr.addColorStop(1, 'rgba(20,16,12,0)');
        g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
        for (let i = 0; i < 60; i++) { const a = r() * 6.28, d = 20 + r() * 38; g.fillStyle = 'rgba(10,8,6,' + (0.2 + r() * 0.4) + ')'; g.fillRect(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 1 + r() * 3, 1 + r() * 3); }
      });
      // колея: полоса вдоль (по высоте клетки атласа) с рисунком протектора, края мягкие
      cell(AT.rut, function (g, r) {
        const gr = g.createLinearGradient(4, 0, 124, 0);
        gr.addColorStop(0, 'rgba(30,24,18,0)'); gr.addColorStop(0.25, 'rgba(30,24,18,0.5)'); gr.addColorStop(0.5, 'rgba(24,19,14,0.62)'); gr.addColorStop(0.75, 'rgba(30,24,18,0.5)'); gr.addColorStop(1, 'rgba(30,24,18,0)');
        g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
        g.fillStyle = 'rgba(12,10,8,0.45)';
        for (let y = 4; y < 128; y += 9) { const o = (y / 9 | 0) % 2 ? 6 : 0; g.fillRect(34 + o, y, 22, 4); g.fillRect(70 - o, y + 4, 22, 4); }
      });
      // сетка трещин асфальта
      cell(AT.acrack, function (g, r) {
        g.strokeStyle = 'rgba(12,12,12,0.75)'; g.lineCap = 'round';
        const pts = []; for (let i = 0; i < 9; i++) pts.push([16 + r() * 96, 16 + r() * 96]);
        pts.forEach(function (p, i) {
          const q = pts[(i + 1 + Math.floor(r() * 3)) % pts.length];
          g.lineWidth = 0.7 + r() * 1.1; g.beginPath(); g.moveTo(p[0], p[1]);
          const mx = (p[0] + q[0]) / 2 + (r() - 0.5) * 14, my = (p[1] + q[1]) / 2 + (r() - 0.5) * 14;
          g.lineTo(mx, my); g.lineTo(q[0], q[1]); g.stroke();
        });
      });
      // трещина вдоль края уступа: ломаная по середине, мелкие отростки
      cell(AT.edge, function (g, r) {
        g.strokeStyle = 'rgba(14,11,9,0.85)'; g.lineCap = 'round';
        let x = 6, y = 64; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y);
        while (x < 122) { x += 6 + r() * 8; y = 64 + (r() - 0.5) * 16; g.lineTo(x, y); if (r() < 0.3) { g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 12, y + (r() - 0.5) * 34); g.moveTo(x, y); } }
        g.stroke();
      });
      cell(AT.mud, function (g, r) { blob(g, r, '58,44,30', 0.5, 8, 24); });
      cell(AT.rust, function (g, r) { blob(g, r, '112,58,26', 0.45, 6, 22); blob(g, r, '40,26,16', 0.35, 4, 14); });
    });
    return atlasTex;
  }
  /* набор следов: [x, z, y, ширина (вдоль rot), длина (поперёк), rot, клетка атласа, непрозрачность] → одна сетка */
  function decalMesh(list, cellUV, mat) {
    if (!list.length) return null;
    const n = list.length, P = new Float32Array(n * 12), N = new Float32Array(n * 12), UV = new Float32Array(n * 8), C = new Float32Array(n * 16), I = [];
    list.forEach(function (d, q) {
      const c = Math.cos(d[5]), s = Math.sin(d[5]), hw = d[3] / 2, hl = d[4] / 2;
      const uv = cellUV(d[6]);
      [[-hw, -hl, uv[0], uv[1]], [hw, -hl, uv[2], uv[1]], [hw, hl, uv[2], uv[3]], [-hw, hl, uv[0], uv[3]]].forEach(function (v, k) {
        const o = q * 4 + k;
        P[o * 3] = d[0] + c * v[0] - s * v[1]; P[o * 3 + 1] = d[2] + 0.01; P[o * 3 + 2] = d[1] + s * v[0] + c * v[1];
        N[o * 3 + 1] = 1; UV[o * 2] = v[2]; UV[o * 2 + 1] = v[3];
        C[o * 4] = C[o * 4 + 1] = C[o * 4 + 2] = 1; C[o * 4 + 3] = d[7];
      });
      I.push(q * 4, q * 4 + 2, q * 4 + 1, q * 4, q * 4 + 3, q * 4 + 2);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(UV, 2)); g.setAttribute('color', new THREE.BufferAttribute(C, 4));
    g.setIndex(I); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true; m.renderOrder = 1;
    group.add(m);
    return m;
  }
  const atlasUV = function (n) { const x0 = (n % 4) * 128, y0 = Math.floor(n / 4) * 128; return [(x0 + 4) / 512, 1 - (y0 + 4) / 512, (x0 + 124) / 512, 1 - (y0 + 124) / 512]; };
  const unitUV = function () { return [0, 1, 1, 0]; };
  // следы матовые — освещение по Ламберту (дешевле PBR на каждой точке поверх земли)
  function decalMat() {
    return decalMatC || (decalMatC = R3.fogify(new THREE.MeshLambertMaterial({ map: atlas(), vertexColors: true, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })));
  }
  function puddleMat() {
    return puddleMatC || (puddleMatC = R3.fogify(new THREE.MeshStandardMaterial({ color: 0x343a3e, alphaMap: puddleMask(), vertexColors: true, roughness: 0.05, metalness: 0.15, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })));
  }
  /* старое поле: освободить буферы (общие геометрии моделей не трогаем) */
  function drop(g) {
    g.traverse(function (o) {
      if (o.isInstancedMesh) { o.dispose(); return; }
      if (o.isMesh && o.geometry && !o.userData.shared && !o.geometry.userData.shared) o.geometry.dispose();
    });
  }

  /* ---------- Сборка ---------- */
  DT.build = function (B) {
    if (group) { R3.scene.remove(group); drop(group); }
    haloMesh = null;
    group = new THREE.Group(); group.name = 'detail';
    R3.scene.add(group);
    for (const k in sets) sets[k].list = [];
    sources = []; glows = [];
    mats();
    const r = rng(B.seed || 1);
    const hAt = function (x, y) { const xi = Math.max(0, Math.min(B.w - 1, Math.floor(x))), yi = Math.max(0, Math.min(B.h - 1, Math.floor(y))); return B.hgt[yi * B.w + xi] * LV; };
    const free = function (x, y) { const xi = Math.floor(x), yi = Math.floor(y); return xi >= 0 && yi >= 0 && xi < B.w && yi < B.h && !B.obj[yi * B.w + xi]; };
    const marks = [], puddles = [];   // следы на земле (атлас) и лужи — по одной сетке
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
        case 'stalag': put('stalag', X, Y + 0.5 * s, Z, s, ry); if (R3.bake) R3.bake.addCone(X, Z, 0.22 * s, Y + 1.1 * s); break;
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
        case 'crack': { const sz = 1.4 + d.r * 1.2; marks.push([X, Z, Y, sz, sz, d.r * 6.28, AT.crack, 1]); break; }
        case 'veins': { const sz = 1.8 + d.r * 1.4; marks.push([X, Z, Y, sz, sz, d.r * 6.28, AT.veins, 1]); break; }
        case 'scorch': if (R3.fx && R3.fx.decal) R3.fx.decal(d.x - 0.5, d.y - 0.5, 'scorch', 0.8 + d.r); break;
        case 'blood': if (R3.fx && R3.fx.decal) R3.fx.decal(d.x - 0.5, d.y - 0.5, 'red', 0.6 + d.r * 0.5); break;
        case 'puddle': { const sz = 1.0 + d.r * 1.4; puddles.push([X, Z, Y, sz, sz, d.r * 6.28, 0, 1]); break; }
        case 'grass': for (let i = 0; i < 6; i++) put('tuft', X + (r() - 0.5) * 0.9, Y, Z + (r() - 0.5) * 0.9, 0.6 + r() * 0.7, r() * 6.28); break;
        case 'bones': for (let i = 0; i < 3; i++) put('bone', X + (r() - 0.5) * 0.4, Y + 0.02, Z + (r() - 0.5) * 0.4, 0.9, r() * 6.28, Math.PI / 2); break;
        case 'crystal': for (let i = 0; i < 3; i++) put('shard', X + (r() - 0.5) * 0.3, Y + 0.08, Z + (r() - 0.5) * 0.3, 0.8 + r() * 0.7, r() * 6.28, (r() - 0.5) * 0.5, 0, 1.8); glows.push(V(X, Y + 0.25, Z)); break;
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
    // новые следы и мелочи — своим генератором случайных чисел (раскладка прежней мелочи не меняется)
    traces(B, rng((B.seed || 1) * 7 + 3), marks);
    decalMesh(marks, atlasUV, decalMat());
    decalMesh(puddles, unitUV, puddleMat());
    // мир вокруг поля: за краем карты — руины, сухие деревья, валуны, обломки, остовы машин (уходят в дымку)
    backdrop(B, r);
    flush();
    halos(B);
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
  /* ---------- Следы боя и разрухи: из того, что есть на карте ----------
     колея и масло на дорогах и у машин, сетка трещин асфальта и бетона, копоть у костров, металлолома и стен,
     гильзы у укрытий, трещины у края уступов, осыпь камней у их подножия */
  const COVER = { 1: 1, 4: 1, 6: 1, 8: 1, 13: 1, 18: 1, 19: 1 };
  function traces(B, r, marks) {
    const w = B.w, hgt = B.hgt;
    const tile = function (x, z) { const tx = Math.floor(x / T), tz = Math.floor(z / T); return tx >= 0 && tz >= 0 && tx < w && tz < B.h ? tz * w + tx : -1; };
    const stair = function (i) { return DW.BT.stairAt && DW.BT.stairAt(i); };
    // ровно ли под следом: все углы — на одной клетке высоты, не провал, не кислота
    const flat = function (x, z, hw, hl, rot) {
      const i0 = tile(x, z);
      if (i0 < 0) return false;
      const h0 = hgt[i0], c = Math.cos(rot), s = Math.sin(rot);
      for (const v of [[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]]) {
        const i = tile(x + c * v[0] - s * v[1], z + s * v[0] + c * v[1]);
        if (i < 0 || hgt[i] !== h0 || B.ground[i] === 10 || B.ground[i] === 7 || stair(i)) return false;
      }
      return true;
    };
    const mark = function (x, z, wd, ln, rot, cell, a) { if (flat(x, z, wd / 2, ln / 2, rot)) { marks.push([x, z, hgt[tile(x, z)] * LV, wd, ln, rot, cell, a]); return true; } return false; };
    // колея: две полосы (колёса), по клетке вдоль; иногда разрыв; чуть виляет
    const ruts = function (x0, z0, dx, dz, n, gauge, a) {
      const px = -dz, pz = dx, rot = Math.atan2(-dx, dz), ph = r() * 6;
      for (let k = 0; k < n; k++) {
        if (r() < 0.12) continue;
        const cx = x0 + dx * (k + 0.5) * T, cz = z0 + dz * (k + 0.5) * T, wob = Math.sin(ph + k * 0.7) * 0.07;
        const aa = a * (0.7 + r() * 0.5);
        [-1, 1].forEach(function (sd) { mark(cx + px * (sd * gauge / 2 + wob), cz + pz * (sd * gauge / 2 + wob), 0.3, T * 1.04, rot, AT.rut, aa); });
      }
    };
    (B.decor || []).forEach(function (d) {
      if (d.t === 'road') {
        const n = d.w || w, dx = d.v ? 0 : 1, dz = d.v ? 1 : 0;
        const x0 = d.v ? (d.x + 1) * T : d.x * T, z0 = d.v ? d.y * T : (d.y + 1) * T;
        ruts(x0, z0, dx, dz, n, 1.5, 0.75);
        if (r() < 0.6) ruts(x0 + dz * 0.35, z0 + dx * 0.35, dx, dz, n, 1.5, 0.35);
        for (let k = 0; k < n; k++) {
          const cx = x0 + dx * (k + 0.5) * T, cz = z0 + dz * (k + 0.5) * T, off = (r() - 0.5) * 1.4;
          if (r() < 0.14) { const sz = 0.5 + r() * 0.5; mark(cx + dz * off, cz + dx * off, sz, sz, r() * 6.28, AT.oil, 0.65 + r() * 0.3); }
          if (r() < 0.2) { const sz = 0.9 + r() * 0.7; mark(cx + dz * off * 0.8, cz + dx * off * 0.8, sz, sz, r() * 6.28, AT.acrack, 0.8); }
        }
      } else if (d.t === 'fire') {
        mark(d.x * T, d.y * T, 1.7, 1.7, r() * 6.28, AT.soot, 0.75);
      }
    });
    // машины: масло и ржавчина под ними, колея от них к краю
    (B.vehicles || []).forEach(function (v) {
      const wd = v.wd || 1, lx = v.d === 0 ? v.len : wd, lz = v.d === 0 ? wd : v.len;
      const cx = (v.x + lx / 2) * T, cz = (v.y + lz / 2) * T;
      for (let k = 0; k < 2; k++) {
        const ox = (r() - 0.5) * (lx * T + 0.8), oz = (r() - 0.5) * (lz * T + 0.8), sz = 0.6 + r() * 0.6;
        marks.push([cx + ox, cz + oz, hgt[v.y * w + v.x] * LV, sz, sz, r() * 6.28, r() < 0.6 ? AT.oil : AT.rust, 0.7]);
      }
      const dx = v.d === 0 ? 1 : 0, dz = v.d === 0 ? 0 : 1, sg = r() < 0.5 ? 1 : -1, big = wd > 1;
      const ex = sg > 0 ? (v.d === 0 ? (v.x + lx) * T : cx) : (v.d === 0 ? v.x * T - 3 * T : cx);
      const ez = sg > 0 ? (v.d === 0 ? cz : (v.y + lz) * T) : (v.d === 0 ? cz : v.y * T - 3 * T);
      ruts(ex, ez, dx, dz, 3, big ? 1.9 : 1.45, 0.45);
    });
    for (let y = 0; y < B.h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, o = B.obj[i], g = B.ground[i], X = (x + 0.5) * T, Z = (y + 0.5) * T;
      // бетон: сетка трещин; голая земля — грязные пятна
      if (!o && g === 3 && r() < 0.09) { const sz = 0.9 + r() * 0.6; mark(X + (r() - 0.5) * 0.4, Z + (r() - 0.5) * 0.4, sz, sz, r() * 6.28, AT.acrack, 0.75); }
      else if (!o && (g === 0 || g === 2) && r() < 0.035) { const sz = 0.8 + r() * 0.8; mark(X, Z, sz, sz, r() * 6.28, AT.mud, 0.38); }
      // копоть у металлолома и у стен руин
      if (o === 7 && r() < 0.7) mark(X + (r() - 0.5) * 0.6, Z + (r() - 0.5) * 0.6, 1.6, 1.6, r() * 6.28, AT.soot, 0.6);
      if (R3.world.WALLS[o] && r() < 0.035) {
        const q = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(r() * 4)], nx = x + q[0], ny = y + q[1];
        if (nx >= 0 && ny >= 0 && nx < w && ny < B.h && !B.obj[ny * w + nx]) mark((nx + 0.5 - q[0] * 0.25) * T, (ny + 0.5 - q[1] * 0.25) * T, 1.2, 1.2, r() * 6.28, AT.soot, 0.5);
      }
      // гильзы у укрытий: здесь уже стреляли — горстка с той стороны, где стоял стрелок
      if (COVER[o] && r() < 0.3) {
        const q = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(r() * 4)], nx = x + q[0], ny = y + q[1];
        if (nx < 0 || ny < 0 || nx >= w || ny >= B.h) continue;
        const j = ny * w + nx;
        if (B.obj[j] || hgt[j] !== hgt[i] || B.ground[j] === 10 || B.ground[j] === 7 || stair(j)) continue;
        const bx = (nx + 0.5 - q[0] * 0.15) * T, bz = (ny + 0.5 - q[1] * 0.15) * T, Y = hgt[j] * LV + 0.008, n = 4 + Math.floor(r() * 6);
        for (let k = 0; k < n; k++) put('casing', bx + (r() - 0.5) * 0.6, Y, bz + (r() - 0.5) * 0.6, 0.9 + r() * 0.3, r() * 6.28);
      }
    }
    // уступы: трещины у края наверху и осыпь камней у подножия
    (R3.world.roughEdges || []).forEach(function (f) {
      if (f.fz) return;
      const ex = f.b[0] - f.a[0], ez = f.b[1] - f.a[1], L = Math.hypot(ex, ez) || 1, ux = ex / L, uz = ez / L, nx = f.n[0], nz = f.n[2];
      if (r() < 0.35) {
        const t = 0.3 + r() * 0.4, cx = f.a[0] + ex * t - nx * 0.24, cz = f.a[1] + ez * t - nz * 0.24;
        if (tile(cx, cz) >= 0 && Math.abs(hgt[tile(cx, cz)] * LV - f.h) < 0.01 && !B.obj[tile(cx, cz)]) marks.push([cx, cz, f.h, 1.0, 0.4, Math.atan2(uz, ux), AT.edge, 0.85]);
      }
      const n = 1 + Math.floor(r() * 3.2);
      for (let k = 0; k < n; k++) {
        const t = 0.08 + r() * 0.84, d = 0.12 + r() * 0.36;
        const px = f.a[0] + ex * t + nx * d, pz = f.a[1] + ez * t + nz * d;
        const i = tile(px, pz);
        if (i >= 0 && (B.obj[i] || stair(i) || B.ground[i] === 10 || B.ground[i] === 7 || Math.abs(hgt[i] * LV - f.hn) > 0.01)) continue;
        const sc = 0.8 + r() * r() * 2.2;
        put('scree', px, f.hn + 0.03 * sc, pz, sc, r() * 6.28, (r() - 0.5) * 0.5, (r() - 0.5) * 0.5, 0.55 + r() * 0.3);
        if (r() < 0.6) put('stone', px + (r() - 0.5) * 0.4, f.hn + 0.015, pz + (r() - 0.5) * 0.4, 0.4 + r() * 0.5, r() * 6.28, r() * 3, r() * 3);
      }
    });
  }

  /* ---------- Ореолы (только высокая графика): мягкое свечение вокруг огней, кристаллов и Портала ----------
     Квадраты к камере одной сеткой (instancing), сложение света; в тумане войны гаснут; костры мерцают. */
  let haloMesh = null;
  function halos(B) {
    if (haloMesh) { group.remove(haloMesh); haloMesh.geometry.dispose(); haloMesh = null; }
    if (R3.q() < 2) return;
    const night = B.tod === 'night' || B.tod === 'dusk' || B.tod === 'dawn' || B.tod === 'cave' || B.tod === 'interior';
    const L = [];   // x, y, z, r, g, b, размер, фаза, мерцание
    const add = function (p, c, sz, a, fl) { const col = new THREE.Color(c); L.push(p.x, p.y, p.z, col.r * a, col.g * a, col.b * a, sz, Math.random() * 6.28, fl ? 1 : 0); };
    sources.forEach(function (s) {
      if (s.night && !night) return;
      if (s.fire) add(s.p, 0xff8a30, 2.6, night ? 0.55 : 0.32, true);
      else if (s.night) add(s.p, s.c, 1.9, 0.5, false);
      else add(s.p, s.c, s.d > 3.3 ? 1.5 : 1.1, night ? 0.5 : 0.28, false);
    });
    for (let y = 0; y < B.h; y++) for (let x = 0; x < B.w; x++) {
      const o = B.obj[y * B.w + x], Y = B.hgt[y * B.w + x] * LV;
      if (o === 15) add(V((x + 0.5) * T, Y + 1.5, (y + 0.5) * T), 0x58d0f0, 4.2, night ? 0.6 : 0.4, false);
      else if (o === 20) add(V((x + 0.5) * T, Y + 0.55, (y + 0.5) * T), 0x6fe0ff, 1.8, night ? 0.5 : 0.3, false);
    }
    glows.forEach(function (p) { add(p, 0x78e6ff, 1.0, night ? 0.45 : 0.25, false); });
    const n = L.length / 9;
    if (!n) return;
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const P = new Float32Array(n * 3), C = new Float32Array(n * 4), F = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { P.set(L.slice(i * 9, i * 9 + 3), i * 3); C.set(L.slice(i * 9 + 3, i * 9 + 7), i * 4); F.set(L.slice(i * 9 + 7, i * 9 + 9), i * 2); }
    g.setAttribute('iP', new THREE.InstancedBufferAttribute(P, 3)); g.setAttribute('iC', new THREE.InstancedBufferAttribute(C, 4)); g.setAttribute('iF', new THREE.InstancedBufferAttribute(F, 2));
    g.instanceCount = n;
    const vtf = R3.renderer && R3.renderer.capabilities.vertexTextures;
    const m = new THREE.ShaderMaterial({
      uniforms: { uTime: R3.fogU.uTime, tFog: R3.fogU.tFog, uFogSize: R3.fogU.uFogSize },
      defines: vtf ? { FOG_VTF: 1 } : {},
      vertexShader: [
        'attribute vec3 iP; attribute vec4 iC; attribute vec2 iF; uniform float uTime; uniform sampler2D tFog; uniform vec2 uFogSize;',
        'varying vec2 vQ; varying vec3 vC;',
        'void main() {',
        '  float fl = iF.y > 0.5 ? 0.8 + 0.12 * sin(uTime * 9.0 + iF.x) + 0.08 * sin(uTime * 23.0 + iF.x * 3.0) : 0.92 + 0.08 * sin(uTime * 1.6 + iF.x);',
        '  vec4 mv = modelViewMatrix * vec4(iP, 1.0);',
        '  float s = iC.a * fl;',
        // к камере — чтобы свой же предмет не резал ореол
        '  mv.xyz += normalize(-mv.xyz) * min(s * 0.45, 1.2);',
        '  mv.xy += position.xy * s;',
        '  gl_Position = projectionMatrix * mv;',
        '  float fv = 1.0;',
        '  #ifdef FOG_VTF', '  fv = smoothstep(0.55, 0.95, texture2D(tFog, iP.xz / uFogSize).r);', '  #endif',
        '  vC = iC.rgb * fl * fv; vQ = position.xy * 2.0;',
        '}'
      ].join('\n'),
      fragmentShader: 'varying vec2 vQ; varying vec3 vC; void main() { float d = dot(vQ, vQ); float a = exp(-d * 3.5) * (1.0 - smoothstep(0.6, 1.0, d)); gl_FragColor = vec4(vC * a, 1.0); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false
    });
    haloMesh = new THREE.Mesh(g, m);
    haloMesh.frustumCulled = false; haloMesh.renderOrder = 22;
    group.add(haloMesh);
  }

  /* новый огонь в бою (взорвалась бочка): костёр из decor, которого ещё нет */
  DT.refreshFires = function (B) {
    if (!group || DT.B !== B) return;
    let add = false;
    (B.decor || []).forEach(function (d) {
      if (d.t !== 'fire' || d._3d) return;
      d._3d = true;
      const X = d.x * T, Z = d.y * T, Y = B.hgt[Math.max(0, Math.min(B.h - 1, Math.floor(d.y))) * B.w + Math.max(0, Math.min(B.w - 1, Math.floor(d.x)))] * LV;
      if (!sources.some(function (q) { return q.fire && Math.abs(q.p.x - X) < 0.3 && Math.abs(q.p.z - Z) < 0.3; })) { sources.push({ p: V(X, Y + 0.45, Z), c: 0xff9a40, i: 4, d: 8, flick: 2, fire: true }); add = true; }
    });
    if (add) halos(B);
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
