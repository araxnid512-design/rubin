'use strict';
/* 3D-бой: мир из карты боя. Земля — одна поверхность с плавным смешением 4 видов грунта (PBR, нормали),
   уступы и скалы, полы и крыши, стены домов с дверями, окнами и воротами (передние срезаются, когда за ними
   боец), низкие укрытия, предметы и техника из моделей, туман войны (неразведанное — темно, вне обзора — сумрак). */
(function (DW) {
  const R3 = DW.R3, THREE = R3.THREE, D = DW.D;
  if (!THREE) return;
  const T = R3.T, LV = R3.LV;
  const W3 = R3.world = {};

  /* ---------- Общие вставки в шейдеры: туман войны ---------- */
  const FOG = { tex: null, size: new THREE.Vector2(1, 1), data: null };
  const fogU = { tFog: { value: null }, uFogSize: { value: FOG.size }, uTime: { value: 0 } };
  R3.fogU = fogU;
  /* запечённый свет статики (bake.js): r — высота, ниже которой точка в тени солнца, g — затенение у оснований,
     b — высота земли; пока не запечено — нейтральная текстура 1×1 (тени нет, затенения нет) */
  const giNeutral = new THREE.DataTexture(new Uint8Array([0, 255, 0, 255]), 1, 1, THREE.RGBAFormat);
  giNeutral.needsUpdate = true;
  const giU = R3.giU = { tGI: { value: giNeutral }, uGIRange: { value: new THREE.Vector2(-3.5, 16) } };
  R3.giNeutral = giNeutral;
  /* цветокоррекция по времени суток и месту (env.js): насыщенность, контраст, усиление каналов, подъём теней */
  const gradeU = R3.gradeU = { uGradeSC: { value: new THREE.Vector2(1, 1) }, uGradeGain: { value: new THREE.Vector3(1, 1, 1) }, uGradeLift: { value: new THREE.Vector3(0, 0, 0) } };
  // в освещение: тень от статики гасит только солнце, затенение у оснований — в основном рассеянный свет
  const GI_LIGHT = [
    'float giSun = 1.0, giAO = 1.0;',
    '{ vec3 giN = inverseTransformDirection( normal, viewMatrix );',
    '  vec2 giUV = ( vWP.xz + giN.xz * 0.22 ) / uFogSize;',
    '  vec4 gi = texture2D( tGI, giUV );',
    '  float giIn = max( max( -giUV.x, giUV.x - 1.0 ), max( -giUV.y, giUV.y - 1.0 ) ) < 0.0 ? 1.0 : 0.0;',
    '  float hS = uGIRange.x + gi.r * uGIRange.y, hG = uGIRange.x + gi.b * uGIRange.y;',
    '  giSun = mix( 1.0, smoothstep( -0.16, 0.16, vWP.y + 0.08 - hS ), giIn );',
    '  giAO = mix( 1.0, mix( gi.g, 1.0, smoothstep( 0.0, 0.9, vWP.y - hG ) ), giIn ); }'
  ].join('\n');
  const GI_AO = 'reflectedLight.indirectDiffuse *= giAO; reflectedLight.indirectSpecular *= giAO; reflectedLight.directDiffuse *= mix( 1.0, giAO, 0.6 );\n#include <aomap_fragment>';
  /* добавить к материалу туман войны (и мировую позицию vWP) */
  R3.fogify = function (m, extra) {
    if (m.userData.fogged) return m;
    m.userData.fogged = true;
    const prev = m.onBeforeCompile;
    m.onBeforeCompile = function (sh, r) {
      sh.uniforms.tFog = fogU.tFog; sh.uniforms.uFogSize = fogU.uFogSize; sh.uniforms.uTime = fogU.uTime;
      sh.uniforms.tGI = giU.tGI; sh.uniforms.uGIRange = giU.uGIRange;
      sh.uniforms.uGradeSC = gradeU.uGradeSC; sh.uniforms.uGradeGain = gradeU.uGradeGain; sh.uniforms.uGradeLift = gradeU.uGradeLift;
      if (!/varying vec3 vWP;/.test(sh.vertexShader)) {
        // мировая позиция фрагмента (с учётом instanced-копий — трава, камешки, гильзы)
        sh.vertexShader = 'varying vec3 vWP;\n' + sh.vertexShader.replace('#include <project_vertex>', [
          '#include <project_vertex>',
          '  { vec4 wpF = vec4(transformed, 1.0);',
          '  #ifdef USE_INSTANCING',
          '    wpF = instanceMatrix * wpF;',
          '  #endif',
          '    vWP = (modelMatrix * wpF).xyz; }'
        ].join('\n'));
        sh.fragmentShader = 'varying vec3 vWP;\n' + sh.fragmentShader;
      }
      // запечённый свет: только в освещаемых материалах (у MeshBasic нет нормали и освещения)
      if (sh.fragmentShader.indexOf('#include <lights_fragment_begin>') >= 0) {
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <lights_fragment_begin>', GI_LIGHT + '\n' + THREE.ShaderChunk.lights_fragment_begin.replace('getDirectionalLightInfo( directionalLight, directLight );', 'getDirectionalLightInfo( directionalLight, directLight );\n\t\tdirectLight.color *= giSun;'))
          .replace('#include <aomap_fragment>', GI_AO);
      }
      // туман войны: видно — как есть; разведано — приглушено; не разведано — тёмная дымка с еле заметным рельефом
      sh.fragmentShader = 'uniform sampler2D tFog, tGI; uniform vec2 uFogSize, uGIRange, uGradeSC; uniform float uTime; uniform vec3 uGradeGain, uGradeLift;\n' + sh.fragmentShader.replace('#include <dithering_fragment>', [
        '#include <dithering_fragment>',
        // цветокоррекция (после тонального сжатия): насыщенность, контраст, оттенок светов и теней
        '  { vec3 gc = gl_FragColor.rgb; float gL = dot(gc, vec3(0.299, 0.587, 0.114));',
        '    gc = (mix(vec3(gL), gc, uGradeSC.x) - 0.5) * uGradeSC.y + 0.5;',
        '    gl_FragColor.rgb = max(gc * uGradeGain + uGradeLift, 0.0); }',
        '  { vec2 fu = vWP.xz / uFogSize; float fv = texture2D(tFog, fu).r;',
        '    float outside = max(max(-fu.x, fu.x - 1.0), max(-fu.y, fu.y - 1.0)); if (outside > 0.0) fv = mix(fv, 0.5, smoothstep(0.0, 0.08, outside));',
        '    float lum = dot(gl_FragColor.rgb, vec3(0.3, 0.59, 0.11));',
        '    vec3 dim = mix(vec3(lum), gl_FragColor.rgb, 0.55) * 0.55;',
        '    vec3 dark = vec3(0.035, 0.04, 0.05) + vec3(lum) * 0.16;',
        '    vec3 c = fv > 0.62 ? mix(dim, gl_FragColor.rgb, smoothstep(0.62, 1.0, fv)) : mix(dark, dim, smoothstep(0.0, 0.62, fv));',
        '    gl_FragColor.rgb = c; }'
      ].join('\n'));
      if (prev) prev(sh, r);
      if (extra) extra(sh, r);
    };
    m.customProgramCacheKey = function () { return (m.userData.key || '') + 'fog'; };
    return m;
  };
  /* обновить туман: vis — видно сейчас, explored — разведано (как в 2D) */
  W3.updateFog = function (B, vis) {
    if (!FOG.tex || FOG.w !== B.w || FOG.h !== B.h) {
      FOG.w = B.w; FOG.h = B.h;
      FOG.data = new Uint8Array(B.w * B.h * 4);
      FOG.tex = new THREE.DataTexture(FOG.data, B.w, B.h, THREE.RGBAFormat);
      FOG.tex.magFilter = THREE.LinearFilter; FOG.tex.minFilter = THREE.LinearFilter;
      FOG.tex.wrapS = FOG.tex.wrapT = THREE.ClampToEdgeWrapping;
      fogU.tFog.value = FOG.tex;
      FOG.size.set(B.w * T, B.h * T);
      FOG.cur = new Float32Array(B.w * B.h);
    }
    for (let i = 0; i < B.w * B.h; i++) {
      const v = vis && vis[i] ? 1 : (B.explored && B.explored[i] ? 0.62 : 0.0);
      FOG.cur[i] = v;
    }
    FOG.dirty = true;
  };
  W3.tick = function (dt) { if (W3.acidN) { W3.acidN.offset.x += dt * 0.012; W3.acidN.offset.y += dt * 0.007; } };
  W3.fogTick = function () {
    if (!FOG.tex || !FOG.dirty) return;
    let ch = false;
    for (let i = 0; i < FOG.cur.length; i++) {
      const o = FOG.data[i * 4] / 255, n = FOG.cur[i];
      if (Math.abs(o - n) > 0.004) { const v = o + (n - o) * 0.18; FOG.data[i * 4] = Math.round(v * 255); ch = true; }
      else FOG.data[i * 4] = Math.round(n * 255);
    }
    FOG.tex.needsUpdate = true;
    if (!ch) FOG.dirty = false;
  };

  /* ---------- Геометрия: сборщик четырёхугольников с мировыми UV ---------- */
  function Geo() { this.p = []; this.n = []; this.uv = []; this.t = []; this.i = []; }
  Geo.prototype.quad = function (a, b, c, d, nrm, uvs, tile) {
    const o = this.p.length / 3;
    [a, b, c, d].forEach(function (v, k) { this.p.push(v[0], v[1], v[2]); this.n.push(nrm[0], nrm[1], nrm[2]); this.uv.push(uvs[k][0], uvs[k][1]); this.t.push(tile ? tile[0] : 0, tile ? tile[1] : 0, tile ? tile[2] : 0); }, this);
    this.i.push(o, o + 1, o + 2, o, o + 2, o + 3);
  };
  /* коробка без дна, UV — в метрах / sc */
  Geo.prototype.box = function (x0, y0, z0, x1, y1, z1, sc, tile, noTop) {
    const s = sc || 2;
    const P = function (x, y, z) { return [x, y, z]; };
    // +Z
    this.quad(P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1), [0, 0, 1], [[x0 / s, y0 / s], [x1 / s, y0 / s], [x1 / s, y1 / s], [x0 / s, y1 / s]], tile);
    // −Z
    this.quad(P(x1, y0, z0), P(x0, y0, z0), P(x0, y1, z0), P(x1, y1, z0), [0, 0, -1], [[-x1 / s, y0 / s], [-x0 / s, y0 / s], [-x0 / s, y1 / s], [-x1 / s, y1 / s]], tile);
    // +X
    this.quad(P(x1, y0, z1), P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), [1, 0, 0], [[-z1 / s, y0 / s], [-z0 / s, y0 / s], [-z0 / s, y1 / s], [-z1 / s, y1 / s]], tile);
    // −X
    this.quad(P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0), [-1, 0, 0], [[z0 / s, y0 / s], [z1 / s, y0 / s], [z1 / s, y1 / s], [z0 / s, y1 / s]], tile);
    if (!noTop) this.quad(P(x0, y1, z1), P(x1, y1, z1), P(x1, y1, z0), P(x0, y1, z0), [0, 1, 0], [[x0 / s, z1 / s], [x1 / s, z1 / s], [x1 / s, z0 / s], [x0 / s, z0 / s]], tile);
  };
  Geo.prototype.build = function () {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('aTile', new THREE.Float32BufferAttribute(this.t, 3));
    g.setIndex(this.i);
    g.computeBoundingSphere();
    // касательные для карт нормалей (по UV)
    try { g.computeTangents(); } catch (e) { /* без касательных — нормали по производным */ }
    return g;
  };
  W3.Geo = Geo;

  /* ---------- Земля: смешение 4 видов грунта ---------- */
  const GKIND = { 0: 'grain', 1: 'ash', 2: 'earth', 3: 'concrete', 5: 'cave', 6: 'flesh', 8: 'rubble' };   // природный грунт
  const HARD = { 4: 'metal', 9: 'wood', 11: 'planks', 12: 'roof' };   // ('planks' — и для пола комнат)                                     // полы, настилы, крыши
  const ROUGH = { grain: 0.95, ash: 0.98, earth: 0.95, concrete: 0.88, cave: 0.9, flesh: 0.6, rubble: 0.95 };
  function splatMaterial(B, kinds) {
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 });
    const U = {
      tA: { value: R3.tex('tex3d/' + kinds[0] + '_c.jpg', true) }, tB: { value: R3.tex('tex3d/' + kinds[1] + '_c.jpg', true) },
      tC: { value: R3.tex('tex3d/' + kinds[2] + '_c.jpg', true) }, tD: { value: R3.tex('tex3d/' + kinds[3] + '_c.jpg', true) },
      nA: { value: R3.tex('tex3d/' + kinds[0] + '_n.jpg') }, nB: { value: R3.tex('tex3d/' + kinds[1] + '_n.jpg') },
      nC: { value: R3.tex('tex3d/' + kinds[2] + '_n.jpg') }, nD: { value: R3.tex('tex3d/' + kinds[3] + '_n.jpg') },
      tSplat: { value: null }, uSize: { value: new THREE.Vector2(B.w * T, B.h * T) },
      uRough: { value: new THREE.Vector4(ROUGH[kinds[0]] || 0.95, ROUGH[kinds[1]] || 0.95, ROUGH[kinds[2]] || 0.95, ROUGH[kinds[3]] || 0.95) },
      uScale: { value: 0.42 }
    };
    m.userData.key = 'splat';
    m.userData.U = U;
    R3.fogify(m, function (sh) {
      Object.assign(sh.uniforms, U);
      sh.fragmentShader = 'uniform sampler2D tA, tB, tC, tD, nA, nB, nC, nD, tSplat; uniform vec2 uSize; uniform vec4 uRough; uniform float uScale;\n' + sh.fragmentShader
        .replace('#include <map_fragment>', [
          'vec2 suv = vWP.xz * uScale;',
          // второй масштаб гасит повтор плитки
          'vec2 suv2 = vWP.xz * uScale * 0.31 + vec2(0.37, 0.71);',
          'vec4 cA = mix(texture2D(tA, suv), texture2D(tA, suv2), 0.35), cB = mix(texture2D(tB, suv), texture2D(tB, suv2), 0.35);',
          'vec4 cC = mix(texture2D(tC, suv), texture2D(tC, suv2), 0.35), cD = mix(texture2D(tD, suv), texture2D(tD, suv2), 0.35);',
          'vec4 sw = texture2D(tSplat, vWP.xz / uSize);',
          // смешение по «высоте» рисунка: камешки выступают из пыли, а не просвечивают
          'vec4 hh = vec4(dot(cA.rgb, vec3(0.33)), dot(cB.rgb, vec3(0.33)), dot(cC.rgb, vec3(0.33)), dot(cD.rgb, vec3(0.33)));',
          'sw = sw * (0.35 + hh * 1.3); sw = sw * sw * sw * sw; sw /= max(1e-4, sw.x + sw.y + sw.z + sw.w);',
          'vec4 gcol = cA * sw.x + cB * sw.y + cC * sw.z + cD * sw.w;',
          // крупные пятна (сырость, выгоревшие места)
          'float big = texture2D(tB, vWP.xz * 0.023 + 0.13).g;',
          'gcol.rgb *= mix(0.82, 1.12, big);',
          'diffuseColor *= gcol;'
        ].join('\n'))
        .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = dot(sw, uRough);')
        .replace('#include <normal_fragment_maps>', [
          'vec3 tnA = texture2D(nA, suv).xyz * 2.0 - 1.0, tnB = texture2D(nB, suv).xyz * 2.0 - 1.0, tnC = texture2D(nC, suv).xyz * 2.0 - 1.0, tnD = texture2D(nD, suv).xyz * 2.0 - 1.0;',
          'vec3 tn = normalize(tnA * sw.x + tnB * sw.y + tnC * sw.z + tnD * sw.w);',
          'vec3 nW = normalize(vec3(tn.x, tn.z, tn.y));',
          'normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);'
        ].join('\n'));
    });
    return m;
  }
  function buildSplat(B, kinds) {
    const data = new Uint8Array(B.w * B.h * 4);
    for (let i = 0; i < B.w * B.h; i++) {
      const k = GKIND[B.ground[i]] || 'grain';
      let c = kinds.indexOf(k);
      if (c < 0) c = 0;
      data[i * 4 + c] = 255;
    }
    const t = new THREE.DataTexture(data, B.w, B.h, THREE.RGBAFormat);
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.needsUpdate = true;
    return t;
  }

  /* ---------- Проёмы домов (как в 2D: окно — низкая стенка между стенами, дверь — пустая клетка) ---------- */
  const WALLS = { 2: 1, 11: 1, 14: 1, 17: 1 };
  W3.WALLS = WALLS;
  function openings(B) {
    const map = {}, Wd = B.w;
    const wall = function (x, y) { return x >= 0 && y >= 0 && x < Wd && y < B.h && WALLS[B.obj[y * Wd + x]]; };
    const floor = function (x, y) { if (x < 0 || y < 0 || x >= Wd || y >= B.h) return false; const gi = B.ground[y * Wd + x]; return gi === 11 || gi === 3 || gi === 4; };
    for (let y = 0; y < B.h; y++) for (let x = 0; x < Wd; x++) {
      const j = y * Wd + x, o = B.obj[j];
      if (o !== 0 && o !== 1) continue;
      if (o === 0 && B.ground[j] === 8) continue;
      let ax = -1;
      if (wall(x - 1, y) && wall(x + 1, y) && !wall(x, y - 1) && !wall(x, y + 1) && (floor(x, y - 1) || floor(x, y + 1))) ax = 0;
      else if (wall(x, y - 1) && wall(x, y + 1) && !wall(x - 1, y) && !wall(x + 1, y) && (floor(x - 1, y) || floor(x + 1, y))) ax = 1;
      if (ax >= 0) { map[j] = { kind: o === 1 ? 'window' : 'door', ax: ax }; continue; }
      if (o !== 0) continue;
      const gap = function (dx, dy) {
        let a = 0, b = 0;
        while (a < 3 && !wall(x - dx * (a + 1), y - dy * (a + 1)) && B.obj[(y - dy * (a + 1)) * Wd + x - dx * (a + 1)] === 0) a++;
        while (b < 3 && !wall(x + dx * (b + 1), y + dy * (b + 1)) && B.obj[(y + dy * (b + 1)) * Wd + x + dx * (b + 1)] === 0) b++;
        return wall(x - dx * (a + 1), y - dy * (a + 1)) && wall(x + dx * (b + 1), y + dy * (b + 1)) && a + b + 1 <= 3;
      };
      if (gap(1, 0) && !wall(x, y - 1) && !wall(x, y + 1) && (floor(x, y - 1) || floor(x, y + 1))) map[j] = { kind: 'gate', ax: 0 };
      else if (gap(0, 1) && !wall(x - 1, y) && !wall(x + 1, y) && (floor(x - 1, y) || floor(x + 1, y))) map[j] = { kind: 'gate', ax: 1 };
    }
    return map;
  }
  W3.openings = openings;

  /* ---------- Срез стен перед бойцами (как в XCOM) ---------- */
  const CUT = { tex: null, data: null };
  const cutU = { tCut: { value: null }, uCutSize: { value: new THREE.Vector2(1, 1) }, uCutH: { value: 0.55 } };
  function cutMaterial(kind, o) {
    const base = R3.pbr(kind, o);
    const m = base.clone();
    m.userData = { key: 'wall' };
    R3.fogify(m, function (sh) {
      sh.uniforms.tCut = cutU.tCut; sh.uniforms.uCutSize = cutU.uCutSize; sh.uniforms.uCutH = cutU.uCutH;
      sh.vertexShader = 'attribute vec3 aTile; uniform sampler2D tCut; uniform vec2 uCutSize; uniform float uCutH;\n' + sh.vertexShader.replace('#include <begin_vertex>', [
        '#include <begin_vertex>',
        'float cutOn = texture2D(tCut, (aTile.xy + 0.5) / uCutSize).r;',
        'float cutDy = transformed.y - (aTile.z + uCutH);',
        'if (cutOn > 0.5 && cutDy > 0.0) {',
        '  transformed.y -= cutDy;',
        // кладка не сжимается: верх среза — обрезанный край, а не «пила»
        '  #ifdef USE_MAP', '  vMapUv.y -= cutDy / 2.0;', '  #endif',
        '  #ifdef USE_NORMALMAP', '  vNormalMapUv.y -= cutDy / 2.0;', '  #endif',
        '  #ifdef USE_ROUGHNESSMAP', '  vRoughnessMapUv.y -= cutDy / 2.0;', '  #endif',
        '}'
      ].join('\n'));
    });
    return m;
  }
  const cutDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  cutDepth.onBeforeCompile = function (sh) {
    sh.uniforms.tCut = cutU.tCut; sh.uniforms.uCutSize = cutU.uCutSize; sh.uniforms.uCutH = cutU.uCutH;
    sh.vertexShader = 'attribute vec3 aTile; uniform sampler2D tCut; uniform vec2 uCutSize; uniform float uCutH;\n' + sh.vertexShader.replace('#include <begin_vertex>', [
      '#include <begin_vertex>',
      'float cutOn = texture2D(tCut, (aTile.xy + 0.5) / uCutSize).r;',
      'if (cutOn > 0.5 && transformed.y > aTile.z + uCutH) transformed.y = aTile.z + uCutH;'
    ].join('\n'));
  };
  W3.setCut = function (B, set) {
    if (!CUT.tex || CUT.w !== B.w || CUT.h !== B.h) {
      CUT.w = B.w; CUT.h = B.h; CUT.data = new Uint8Array(B.w * B.h * 4);
      CUT.tex = new THREE.DataTexture(CUT.data, B.w, B.h, THREE.RGBAFormat);
      CUT.tex.magFilter = CUT.tex.minFilter = THREE.NearestFilter;
      cutU.tCut.value = CUT.tex; cutU.uCutSize.value.set(B.w, B.h);
    }
    let ch = false;
    for (let i = 0; i < B.w * B.h; i++) { const v = set && set[i] ? 255 : 0; if (CUT.data[i * 4] !== v) { CUT.data[i * 4] = v; ch = true; } }
    if (ch) CUT.tex.needsUpdate = true;
  };

  /* ---------- Неровные скальные уступы ----------
     Грань уступа делится на сетку (≈0,32 × 0,5 м), вершины выдвигаются наружу по шуму от мировой позиции.
     Верхний край — ровно по краю клетки (верх ровный и проходимый, клетки совпадают), ниже — бугры до 0,24 м и
     только наружу (иначе у подножия была бы щель между гранью и землёй). Одинаковая точка → одинаковый сдвиг,
     нормаль — сумма граней в точке: на углах и стыках клеток швов нет. Грани у лестниц и маршей не трогаются. */
  function hash3(x, y, z) { let h = (x * 374761393 + y * 668265263 + z * 1440662683) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function vnoise(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    let fx = x - xi, fy = y - yi, fz = z - zi;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
    const L = function (a, b, t) { return a + (b - a) * t; };
    const c = function (dx, dy, dz) { return hash3(xi + dx, yi + dy, zi + dz); };
    return L(L(L(c(0, 0, 0), c(1, 0, 0), fx), L(c(0, 1, 0), c(1, 1, 0), fx), fy), L(L(c(0, 0, 1), c(1, 0, 1), fx), L(c(0, 1, 1), c(1, 1, 1), fx), fy), fz);
  }
  function roughCliffs(list) {
    const AMP = 0.24, NH = 4;
    const key = function (x, y, z) { return Math.round(x * 64) + ',' + Math.round(y * 64) + ',' + Math.round(z * 64); };
    const acc = {}, fixed = {}, bottom = {};
    const faces = list.map(function (f) {
      const nv = Math.max(2, Math.round((f.h - f.hn) / 0.5)), v = [];
      for (let r = 0; r <= nv; r++) for (let c = 0; c <= NH; c++) {
        // от b к a, сверху вниз — тот же обход, что у прежнего четырёхугольника (лицом наружу)
        const t = c / NH, y = f.h - (f.h - f.hn) * r / nv;
        const x = f.b[0] + (f.a[0] - f.b[0]) * t, z = f.b[1] + (f.a[1] - f.b[1]) * t;
        const k = key(x, y, z);
        v.push({ x: x, y: y, z: z, k: k });
        const q = acc[k] || (acc[k] = [0, 0]); q[0] += f.n[0]; q[1] += f.n[2];
        if (r === 0 || f.fz) fixed[k] = 1;
        if (r === nv) bottom[k] = 1;
      }
      return { f: f, nv: nv, v: v };
    });
    // сдвиг каждой точки — один раз
    const off = {};
    for (const k in acc) {
      if (fixed[k]) { off[k] = [0, 0, 0]; continue; }
      const p = k.split(',').map(function (s) { return +s / 64; });
      const n = acc[k], l = Math.hypot(n[0], n[1]) || 1;
      const nz = vnoise(p[0] * 1.7, p[1] * 1.9, p[2] * 1.7) * 0.75 + vnoise(p[0] * 4.3 + 7, p[1] * 4.1, p[2] * 4.3) * 0.25;
      const d = AMP * (0.12 + 0.88 * nz);
      // по высоте — чуть вразброс, подножие — только вниз (в землю), чтобы не было щели
      off[k] = [n[0] / l * d, bottom[k] ? -0.04 : (vnoise(p[0] * 3, p[1] * 3 + 5, p[2] * 3) - 0.5) * 0.14, n[1] / l * d];
    }
    const P = [], UV = [], I = [];
    faces.forEach(function (F) {
      const o = P.length / 3, f = F.f;
      F.v.forEach(function (q) {
        const d = off[q.k];
        P.push(q.x + d[0], q.y + d[1], q.z + d[2]);
        UV.push((f.n[0] ? q.z : q.x) / 2, q.y / 2);
      });
      for (let r = 0; r < F.nv; r++) for (let c = 0; c < NH; c++) {
        const a = o + r * (NH + 1) + c, b = a + 1, cc = a + NH + 2, d = a + NH + 1;
        I.push(a, b, cc, a, cc, d);
      }
    });
    // нормали — по всем граням в точке (гладко через стыки клеток)
    const nacc = {}, keys = [];
    faces.forEach(function (F) { F.v.forEach(function (q) { keys.push(q.k); }); });
    for (let t = 0; t < I.length; t += 3) {
      const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      [I[t], I[t + 1], I[t + 2]].forEach(function (vi) { const q = nacc[keys[vi]] || (nacc[keys[vi]] = [0, 0, 0]); q[0] += nx; q[1] += ny; q[2] += nz; });
    }
    const N = [];
    keys.forEach(function (k) { const q = nacc[k], l = Math.hypot(q[0], q[1], q[2]) || 1; N.push(q[0] / l, q[1] / l, q[2] / l); });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
    g.setIndex(I);
    g.computeBoundingSphere();
    try { g.computeTangents(); } catch (e) { /* без касательных — нормали по производным */ }
    return g;
  }
  W3.roughEdges = [];

  /* ---------- Сборка мира ---------- */
  let group = null;
  const WMAT = { 2: 'brick', 11: 'bulkhead', 14: 'stone', 17: 'plaster' };
  const CAVE = { crystalcave: 1, nest: 1, lair: 1, vein: 1 };
  W3.build = function (B) {
    if (group) { R3.scene.remove(group); dispose(group); }
    group = new THREE.Group();
    group.name = 'world';
    R3.scene.add(group);
    R3.pickables = [];
    W3.open = openings(B);
    const H = function (x, y) { return x < 0 || y < 0 || x >= B.w || y >= B.h ? 0 : B.hgt[y * B.w + x]; };
    const hgt = B.hgt || new Uint8Array(B.w * B.h);
    if (!B.hgt) B.hgt = hgt;
    // 4 самых частых природных грунта
    const cnt = {};
    for (let i = 0; i < B.w * B.h; i++) { const k = GKIND[B.ground[i]]; if (k) cnt[k] = (cnt[k] || 0) + 1; }
    const kinds = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; }).slice(0, 4);
    const fill = ['earth', 'grain', 'rubble', 'ash'];
    while (kinds.length < 4) { const f = fill.find(function (k) { return kinds.indexOf(k) < 0; }); kinds.push(f); }
    const sm = splatMaterial(B, kinds);
    sm.userData.U.tSplat.value = buildSplat(B, kinds);
    // комнаты домов: пол — доски (на клетках с мебелью в карте остаётся уличный грунт)
    const inRoom = new Uint8Array(B.w * B.h);
    (B.rooms || []).forEach(function (r) { for (let y = r[1]; y <= r[3]; y++) for (let x = r[0]; x <= r[2]; x++) if (x >= 0 && y >= 0 && x < B.w && y < B.h) inRoom[y * B.w + x] = 1; });
    // верх клеток
    const gTop = new Geo(), gHard = {}, gSide = {}, gAcid = new Geo(), gPit = new Geo(), gPitW = new Geo();
    const side = function (k) { return gSide[k] || (gSide[k] = new Geo()); };
    // скальные уступы — неровные (cliffs), кроме граней, к которым приставлены лестница или марш
    const rough = [], frozen = {};
    (B.ladders || []).forEach(function (l) { frozen[l.y * B.w + l.x] = 1; });
    if (DW.BT.stairAt) for (let i = 0; i < B.w * B.h; i++) if (DW.BT.stairAt(i)) frozen[i] = 1;
    for (let y = 0; y < B.h; y++) for (let x = 0; x < B.w; x++) {
      const i = y * B.w + x, gid = B.ground[i], h = hgt[i] * LV;
      const x0 = x * T, x1 = (x + 1) * T, z0 = y * T, z1 = (y + 1) * T;
      if (gid === 10) {
        // провал (овраг): скальные стенки там, где сосед — не провал, дно на 2,5 м ниже
        const d = h - 2.5;
        gPit.quad([x0, d, z1], [x1, d, z1], [x1, d, z0], [x0, d, z0], [0, 1, 0], [[x0 / 2, z1 / 2], [x1 / 2, z1 / 2], [x1 / 2, z0 / 2], [x0 / 2, z0 / 2]]);
        [[0, -1, x0, z0, x1, z0], [1, 0, x1, z0, x1, z1], [0, 1, x1, z1, x0, z1], [-1, 0, x0, z1, x0, z0]].forEach(function (e) {
          const nx = x + e[0], ny = y + e[1];
          if (nx >= 0 && ny >= 0 && nx < B.w && ny < B.h && B.ground[ny * B.w + nx] === 10) return;
          const top = (nx < 0 || ny < 0 || nx >= B.w || ny >= B.h) ? h : Math.max(h, hgt[ny * B.w + nx] * LV);
          const u0 = (e[2] + e[3]) / 2, u1 = (e[4] + e[5]) / 2;
          gPitW.quad([e[2], top, e[3]], [e[4], top, e[5]], [e[4], d, e[5]], [e[2], d, e[3]], [-e[0], 0, -e[1]], [[u0, top / 2], [u1, top / 2], [u1, d / 2], [u0, d / 2]]);
        });
        continue;
      }
      const top = [[x0, h, z1], [x1, h, z1], [x1, h, z0], [x0, h, z0]];
      const uvT = [[x0 / 2, z1 / 2], [x1 / 2, z1 / 2], [x1 / 2, z0 / 2], [x0 / 2, z0 / 2]];
      if (gid === 7) { const ta = top.map(function (p) { return [p[0], p[1] - 0.12, p[2]]; }); gAcid.quad(ta[0], ta[1], ta[2], ta[3], [0, 1, 0], uvT); }
      else if (HARD[gid] || (inRoom[i] && GKIND[gid] && !WALLS[B.obj[i]])) { const hk = HARD[gid] || 'planks'; (gHard[hk] = gHard[hk] || new Geo()).quad(top[0], top[1], top[2], top[3], [0, 1, 0], uvT); }
      else gTop.quad(top[0], top[1], top[2], top[3], [0, 1, 0], uvT);
      // стенки уступов: где сосед ниже
      const sk = gid === 12 ? 'plaster' : (gid === 9 ? 'wood' : (gid === 3 || gid === 4 ? 'concrete' : 'cliff'));
      [[0, -1, [x1, z0], [x0, z0], [0, 0, -1]], [1, 0, [x1, z1], [x1, z0], [1, 0, 0]], [0, 1, [x0, z1], [x1, z1], [0, 0, 1]], [-1, 0, [x0, z0], [x0, z1], [-1, 0, 0]]].forEach(function (e) {
        const nx = x + e[0], ny = y + e[1];
        const out = nx < 0 || ny < 0 || nx >= B.w || ny >= B.h;
        const hn = out ? -0.6 : hgt[ny * B.w + nx] * LV;
        if (hn >= h - 0.01) return;
        const a = e[2], b = e[3], u0 = (e[4][0] ? a[1] : a[0]) / 2, u1 = (e[4][0] ? b[1] : b[0]) / 2;
        if (sk === 'cliff') { rough.push({ a: a, b: b, h: h, hn: hn, n: e[4], fz: !out && !!frozen[ny * B.w + nx] }); return; }
        // лицом наружу (против часовой, если смотреть снаружи)
        side(sk).quad([b[0], h, b[1]], [a[0], h, a[1]], [a[0], hn, a[1]], [b[0], hn, b[1]], e[4], [[u1, h / 2], [u0, h / 2], [u0, hn / 2], [u1, hn / 2]]);
      });
    }
    // земля вокруг поля (до горизонта, в тумане)
    const E = 40;
    // кольцом вокруг поля (под самим полем пусто — иначе закрыло бы дно оврагов)
    const W0 = B.w * T, H0 = B.h * T, ring = function (ax, az, bx, bz) { gTop.quad([ax, -0.6, bz], [bx, -0.6, bz], [bx, -0.6, az], [ax, -0.6, az], [0, 1, 0], [[ax / 2, bz / 2], [bx / 2, bz / 2], [bx / 2, az / 2], [ax / 2, az / 2]]); };
    ring(-E, -E, 0, H0 + E); ring(W0, -E, W0 + E, H0 + E); ring(0, -E, W0, 0); ring(0, H0, W0, H0 + E);
    const top = new THREE.Mesh(gTop.build(), sm);
    top.receiveShadow = true;
    group.add(top); R3.pickables.push(top);
    for (const k in gHard) {
      const m = new THREE.Mesh(gHard[k].build(), R3.fogify(R3.pbr(k, k === 'roof' ? { metal: true, rough: 1 } : {}).clone()));
      m.receiveShadow = true; group.add(m); R3.pickables.push(m);
    }
    // тени статики запекаются (bake.js) — в карту теней каждый кадр идут только бойцы и «ажурное» (деревья)
    const live = !R3.bake;
    for (const k in gSide) {
      const m = new THREE.Mesh(gSide[k].build(), R3.fogify(R3.pbr(k).clone()));
      m.receiveShadow = true; m.castShadow = live; group.add(m);
    }
    W3.roughEdges = rough;
    if (rough.length) {
      const m = new THREE.Mesh(roughCliffs(rough), R3.fogify(R3.pbr('cliff').clone()));
      m.receiveShadow = true; m.castShadow = live; group.add(m);
    }
    if (gAcid.i.length) {
      // кислота: мутная жидкость с бликами и медленной рябью (нормали сдвигаются во времени); текстура — одна на все бои
      const nm = W3.acidN || R3.texNew('tex3d/cliff_n.jpg'); nm.repeat.set(0.6, 0.6);
      const am = R3.fogify(new THREE.MeshStandardMaterial({ color: 0x2c4214, emissive: 0x1c4a08, emissiveIntensity: 0.55, roughness: 0.06, metalness: 0.1, normalMap: nm, transparent: true, opacity: 0.93 }));
      am.normalScale.set(0.35, 0.35);
      W3.acidN = nm;
      const a = new THREE.Mesh(gAcid.build(), am); group.add(a); R3.pickables.push(a);
    }
    if (gPit.i.length) {
      const pf = new THREE.Mesh(gPit.build(), R3.fogify(R3.pbr('rock', { color: 0x8a7e72 }).clone())); pf.receiveShadow = true; group.add(pf);
      const pwm = R3.fogify(R3.pbr('cliff', { color: 0xc8bcb0 }).clone()); pwm.side = THREE.DoubleSide;
      const pw = new THREE.Mesh(gPitW.build(), pwm); pw.receiveShadow = true; pw.castShadow = live; group.add(pw);
    }
    buildWalls(B);
    W3.buildProps(B);
    W3.updateFog(B, DW.BT.visible ? DW.BT.visible() : null);
    W3.setCut(B, null);
    if (R3.bake) R3.bake.build(B);
    return group;
  };
  function dispose(o) {
    o.traverse(function (m) { if (m.geometry && !m.userData.shared) m.geometry.dispose(); });
  }

  /* ---------- Стены, проёмы, низкие укрытия ---------- */
  let wallGroup = null;
  function buildWalls(B) {
    if (wallGroup) { group.remove(wallGroup); dispose(wallGroup); }
    wallGroup = new THREE.Group();
    group.add(wallGroup);
    const OP = W3.open;
    const G = {}, geo = function (k) { return G[k] || (G[k] = new Geo()); };
    const at = function (x, y) { return x < 0 || y < 0 || x >= B.w || y >= B.h ? -1 : B.obj[y * B.w + x]; };
    const isWall = function (x, y) { return !!WALLS[at(x, y)]; };
    const isOpen = function (x, y) { return x >= 0 && y >= 0 && x < B.w && y < B.h && !!OP[y * B.w + x]; };
    const WH = R3.WALL_H, th = 0.34 / 2;
    const frame = geo('frame');
    for (let y = 0; y < B.h; y++) for (let x = 0; x < B.w; x++) {
      const i = y * B.w + x, o = B.obj[i];
      const cx = (x + 0.5) * T, cz = (y + 0.5) * T, base = B.hgt[i] * LV;
      const tile = [x, y, base];
      if (WALLS[o]) {
        const g = geo(WMAT[o] || 'brick');
        g.box(cx - th, base, cz - th, cx + th, base + WH, cz + th, 2, tile);
        // рукава к соседям-стенам и проёмам
        if (isWall(x + 1, y) || isOpen(x + 1, y)) g.box(cx + th, base, cz - th, (x + 1) * T, base + WH, cz + th, 2, tile, false);
        if (isWall(x - 1, y) || isOpen(x - 1, y)) g.box(x * T, base, cz - th, cx - th, base + WH, cz + th, 2, tile, false);
        if (isWall(x, y + 1) || isOpen(x, y + 1)) g.box(cx - th, base, cz + th, cx + th, base + WH, (y + 1) * T, 2, tile, false);
        if (isWall(x, y - 1) || isOpen(x, y - 1)) g.box(cx - th, base, y * T, cx + th, base + WH, cz - th, 2, tile, false);
        continue;
      }
      const op = OP[i];
      if (op) {
        // проём между стенами: перемычка, рамы, у окна — подоконная стенка
        const nb = op.ax === 0 ? at(x - 1, y) : at(x, y - 1);
        const g = geo(WMAT[nb] || 'brick');
        const top0 = op.kind === 'window' ? 1.95 : (op.kind === 'door' ? 2.1 : 2.25);
        const a0 = op.ax === 0 ? [x * T, cz - th] : [cx - th, y * T], a1 = op.ax === 0 ? [(x + 1) * T, cz + th] : [cx + th, (y + 1) * T];
        g.box(a0[0], base + top0, a0[1], a1[0], base + WH, a1[1], 2, tile);
        if (op.kind === 'window') g.box(a0[0], base, a0[1], a1[0], base + 0.92, a1[1], 2, tile);
        if (op.kind !== 'gate') {
          // деревянная рама: два косяка и брус
          const fw = 0.07, ft = th + 0.03;
          const y0 = base + (op.kind === 'window' ? 0.92 : 0);
          if (op.ax === 0) {
            frame.box(x * T, y0, cz - ft, x * T + fw, base + top0, cz + ft, 1, tile);
            frame.box((x + 1) * T - fw, y0, cz - ft, (x + 1) * T, base + top0, cz + ft, 1, tile);
            frame.box(x * T, base + top0 - fw, cz - ft, (x + 1) * T, base + top0, cz + ft, 1, tile);
            if (op.kind === 'window') frame.box(x * T, y0, cz - ft - 0.04, (x + 1) * T, y0 + 0.05, cz + ft + 0.04, 1, tile);
          } else {
            frame.box(cx - ft, y0, y * T, cx + ft, base + top0, y * T + fw, 1, tile);
            frame.box(cx - ft, y0, (y + 1) * T - fw, cx + ft, base + top0, (y + 1) * T, 1, tile);
            frame.box(cx - ft, base + top0 - fw, y * T, cx + ft, base + top0, (y + 1) * T, 1, tile);
            if (op.kind === 'window') frame.box(cx - ft - 0.04, y0, y * T, cx + ft + 0.04, y0 + 0.05, (y + 1) * T, 1, tile);
          }
        }
        continue;
      }
      if (o === 1 || o === 13) {
        // низкая стенка (кирпич) и частокол (брёвна) — по рядам соседей
        const g = geo(o === 1 ? 'brick' : 'wood');
        const hh = o === 1 ? 0.92 : 1.15, t2 = o === 1 ? 0.2 : 0.16;
        const same = function (xx, yy) { const q = at(xx, yy); return q === o || WALLS[q]; };
        g.box(cx - t2, base, cz - t2, cx + t2, base + hh, cz + t2, 1.5, tile);
        if (same(x + 1, y)) g.box(cx + t2, base, cz - t2, (x + 1) * T, base + hh, cz + t2, 1.5, tile);
        if (same(x - 1, y)) g.box(x * T, base, cz - t2, cx - t2, base + hh, cz + t2, 1.5, tile);
        if (same(x, y + 1)) g.box(cx - t2, base, cz + t2, cx + t2, base + hh, (y + 1) * T, 1.5, tile);
        if (same(x, y - 1)) g.box(cx - t2, base, y * T, cx + t2, base + hh, cz - t2, 1.5, tile);
        if (!same(x + 1, y) && !same(x - 1, y) && !same(x, y + 1) && !same(x, y - 1)) g.box(x * T + 0.1, base, cz - t2, (x + 1) * T - 0.1, base + hh, cz + t2, 1.5, tile);
      }
    }
    for (const k in G) {
      if (!G[k].i.length) continue;
      const mat = k === 'frame' ? cutMaterial('wood', { color: 0x9a8a78 }) : cutMaterial(k, k === 'bulkhead' ? { metal: true } : {});
      const m = new THREE.Mesh(G[k].build(), mat);
      m.castShadow = !R3.bake; m.receiveShadow = true;
      m.customDepthMaterial = cutDepth;   // тень срезанной стены — тоже срезанная
      wallGroup.add(m);
    }
  }
  W3.rebuildWalls = function (B) { W3.open = openings(B); buildWalls(B); if (R3.bake) R3.bake.request(); };

  /* ---------- Предметы (модели), техника ---------- */
  let propGroup = null;
  const propMeshes = {};   // клетка → объект
  function hash(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return (h ^ (h >>> 16)) >>> 0; }
  /* поставить модель, вписав в размеры (как в запекании): len — клеток по большей стороне, h / hMax — высота */
  /* настоящие размеры (м): [длина по большей стороне, высота] — техника и крупные предметы как в жизни рядом с бойцом 1,8 м */
  const REAL = {
    e_vaz_burned: [4.1, 1.42], e_vaz_crashed: [4.1, 1.42], e_vaz2107: [4.1, 1.44], e_volga: [4.8, 1.48], e_niva: [3.7, 1.64],
    e_uaz: [4.0, 2.0], e_paz: [7.0, 2.95], e_ural: [7.4, 2.9], e_btr80: [7.65, 2.45], e_container: [6.06, 2.59],
    p_tank: [9.5, 2.3], p_bmp: [6.7, 2.15], p_heli: [12.5, 3.8], p_busstop: [4.0, 2.6], p_hedgehog: [1.8, 1.4], p_tires: [1.9, 1.0]
  };
  W3.REAL = REAL;
  /* мебель и укрытия: высота как в жизни (низкие укрытия — по пояс, ~1 м) */
  const HFIX = {
    e_table: 0.76, e_sofa: 0.85, e_bunk: 1.6, e_chair: 0.92, e_drawers: 0.95, e_wardrobe: 1.95, e_fridge: 1.75, e_buffet: 1.85,
    e_pech: 1.7, e_bench: 0.46, e_nightstand: 0.6, e_bed: 0.6, e_tv: 0.62
  };
  // невысокие укрытия кладутся в два ряда (мешки, ящики), если одной модели ниже пояса
  const STACK = { e_sandbags: 0.98, e_crate: 1.0, e_ammo: 0.9, e_chest: 0.8, p_pallets: 1.0 };
  function placeModel(gl, v, pos, yawExtra) {
    const src = gl.scene;
    const o = src.clone(true);
    const holder = new THREE.Group();
    holder.add(o);
    o.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(o, true);
    const sz = b.getSize(new THREE.Vector3()), ctr = b.getCenter(new THREE.Vector3());
    let k = 1;
    const R = v.f && REAL[v.f] && v.real !== false ? REAL[v.f] : null;
    if (R) {
      // по настоящей длине, но не выше настоящей высоты; v.maxLen (клетки) — не вылезать за свои клетки сильно
      k = R[0] / Math.max(sz.x, sz.z);
      if (sz.y * k > R[1] * 1.08) k = R[1] * 1.08 / sz.y;
      if (v.maxLen && Math.max(sz.x, sz.z) * k > v.maxLen * T) k = v.maxLen * T / Math.max(sz.x, sz.z);
    } else {
      if (v.len) k = v.len * T / Math.max(sz.x, sz.z);
      if (v.h) k = v.h / sz.y;
      const hf = v.f && HFIX[v.f];
      if (hf) k = Math.min(hf / sz.y, (v.len || 1.2) * 1.25 * T / Math.max(sz.x, sz.z));
      else if (v.hMax && sz.y * k > v.hMax) k = v.hMax / sz.y;
    }
    if (v.k) k *= v.k;
    o.scale.setScalar(k);
    o.position.set(-ctr.x * k, -b.min.y * k, -ctr.z * k);
    // второй ряд: мешки и ящики по пояс
    const st = v.f && STACK[v.f];
    if (st && sz.y * k < st * 0.8) {
      const hh = sz.y * k, n = Math.min(3, Math.ceil(st / hh));
      for (let q = 1; q < n; q++) {
        const c = o.clone(true);
        const kq = k * (1 - 0.04 * q);
        c.scale.setScalar(kq);
        c.rotation.y = (q % 2 ? 1 : -1) * 0.07;
        c.position.set(-ctr.x * kq + (q % 2 ? 0.03 : -0.02), -b.min.y * kq + hh * q * 0.9, -ctr.z * kq);
        holder.add(c);
      }
    }
    holder.rotation.y = ((v.yaw || 0) + (yawExtra || 0)) * Math.PI / 180;
    if (v.sx || v.sy || v.sz) holder.scale.set(v.sx || 1, v.sy || 1, v.sz || 1);
    holder.position.copy(pos);
    o.traverse(function (m) {
      if (m.isMesh) {
        m.castShadow = true; m.receiveShadow = true;
        m.geometry.userData.shared = true; m.userData.shared = true;
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        m.material = mats.map(function (mt) { return capMat(fogMat(mt)); });
        if (m.material.length === 1) m.material = m.material[0];
      }
    });
    return holder;
  }
  const fogMats = new Map();
  const TEXK = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap'];
  /* предметы, техника и фон: текстуры не больше 256 на слабой графике и 512 на средней (бойцы — свои _lo-модели) */
  function capMat(c) {
    const q = R3.q();
    if (q >= 2 || c.userData.capped === q) return c;
    c.userData.capped = q;
    TEXK.forEach(function (k) { if (c[k]) R3.capTex(c[k], q === 0 ? 256 : 512); });
    return c;
  }
  function fogMat(mt) {
    if (fogMats.has(mt)) return fogMats.get(mt);
    const c = mt.clone();
    if ('metalness' in c) c.metalness = Math.min(c.metalness, 0.5);
    if ('roughness' in c) c.roughness = Math.max(c.roughness, 0.45);
    R3.fogify(c);
    fogMats.set(mt, c);
    return c;
  }
  W3.fogMat = fogMat;
  W3.placeModel = placeModel;
  W3.buildProps = function (B) {
    if (propGroup) { group.remove(propGroup); }
    propGroup = new THREE.Group();
    group.add(propGroup);
    for (const k in propMeshes) delete propMeshes[k];
    const M3 = DW.M3 || { props: {} };
    const vehTiles = {};
    (B.vehicles || []).forEach(function (v) { DW.BT.vehTiles(v).forEach(function (q) { vehTiles[q[1] * B.w + q[0]] = v; }); });
    for (let y = 0; y < B.h; y++) for (let x = 0; x < B.w; x++) {
      const i = y * B.w + x, o = B.obj[i];
      if (!o || WALLS[o] || o === 1 || o === 13 || vehTiles[i]) continue;
      const list = M3.props[o];
      if (!list || !list.length) continue;
      let v = list[hash(x, y) % list.length];
      // в пещерах валуны — стены пещеры: выше человека и шире клетки
      if (o === 3 && CAVE[B.map]) v = Object.assign({}, v, { len: 1.45, hMax: 2.6 });
      // груда металлолома (раньше — машина в одну клетку, игрушечная рядом с бойцом)
      if (o === 7) { const sc = (M3.props[8] || []).find(function (q) { return q.f === 'p_scrap'; }); v = sc ? Object.assign({}, sc, { len: 1.05, hMax: 1.55, sy: 1.45 }) : Object.assign({}, v, { len: 1.85, hMax: 1.25 }); }
      // обломки и валуны — полное укрытие: выше пригнувшегося человека
      if ((o === 3 && !CAVE[B.map]) || (o === 8 && v.f === 'p_scrap')) v = Object.assign({}, v, { hMax: Math.max(v.hMax || 0, o === 3 ? 1.6 : 1.5) });
      // контейнер в клетку — мусорный бак в настоящий размер (морской на клетку — игрушка)
      if (o === 18) { const dm = (M3.props[18] || []).find(function (q) { return q.f === 'e_dumpster'; }); if (dm) v = Object.assign({}, dm, { len: 1.4, hMax: 1.35, yaw: hash(x, y) % 2 ? 90 : 0 }); }
      const pos = new THREE.Vector3((x + 0.5) * T, B.hgt[i] * LV, (y + 0.5) * T);
      const jitter = o === 3 || o === 8 || o === 16 || o === 20 || o === 19 ? (hash(y, x) % 360) : 0;
      const pg = propGroup;
      R3.loadGLB('models/' + v.f + '.glb').then(function (gl) {
        if (!gl || pg !== propGroup || B !== DW.BT.get()) return;   // поле перестроили — опоздавшую модель не ставим
        const m = placeModel(gl, v, pos, jitter);
        if (o === 15) m.traverse(function (q) { if (q.isMesh && q.material.emissive) { q.material.emissive.set(0x3fb8d8); q.material.emissiveIntensity = 0.6; } });
        m.userData.tile = i;
        propGroup.add(m);
        propMeshes[i] = m;
        // сплошные предметы — в запечённую тень (сетка высот по их треугольникам); сухие деревья и Портал —
        // ажурные, их тень остаётся настоящей
        if (R3.bake && !AIRY[o]) { m.traverse(function (q) { if (q.isMesh) q.castShadow = false; }); R3.bake.addModel(m); }
      });
    }
    // техника на 2–3 клетки
    (B.vehicles || []).forEach(function (v) {
      if (v.dead) return;
      const e = M3.veh && M3.veh.length ? M3.veh[(v.m * 4 + v.d * 2 + (v.o || 0)) % M3.veh.length] : null;
      if (!e) return;
      const wd = v.wd || 1;
      const x1 = v.d === 0 ? v.x + v.len - 1 : v.x + wd - 1, y1 = v.d === 0 ? v.y + wd - 1 : v.y + v.len - 1;
      const pos = new THREE.Vector3(((v.x + x1) / 2 + 0.5) * T, B.hgt[v.y * B.w + v.x] * LV, ((v.y + y1) / 2 + 0.5) * T);
      const pg2 = propGroup;
      R3.loadGLB('models/' + e.f + '.glb').then(function (gl) {
        if (!gl || pg2 !== propGroup || B !== DW.BT.get()) return;
        const m = placeModel(gl, REAL[e.f] ? { f: e.f, maxLen: v.len + 0.45, yaw: e.yaw } : { len: e.len * 1.32, hMax: (e.hMax || 2.4) * 1.3, yaw: e.yaw }, pos, 0);
        m.userData.veh = v;
        propGroup.add(m);
        v._m3 = m;
        if (R3.bake) { m.traverse(function (q) { if (q.isMesh) q.castShadow = false; }); R3.bake.addModel(m); }
      });
    });
  };
  /* клетка изменилась (стену пробили, предмет разбит) */
  const AIRY = { 5: 1, 15: 1 };
  W3.tileChanged = function (B, x, y) {
    const i = y * B.w + x;
    if (propMeshes[i] && !B.obj[i]) { propGroup.remove(propMeshes[i]); delete propMeshes[i]; }
    W3.rebuildWalls(B);
    (B.vehicles || []).forEach(function (v) { if (v.dead && v._m3) { propGroup.remove(v._m3); v._m3 = null; } });
  };
  W3.group = function () { return group; };
})(window.DW);
