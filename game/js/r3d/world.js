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
  /* добавить к материалу туман войны (и мировую позицию vWP) */
  R3.fogify = function (m, extra) {
    if (m.userData.fogged) return m;
    m.userData.fogged = true;
    const prev = m.onBeforeCompile;
    m.onBeforeCompile = function (sh, r) {
      sh.uniforms.tFog = fogU.tFog; sh.uniforms.uFogSize = fogU.uFogSize; sh.uniforms.uTime = fogU.uTime;
      if (!/varying vec3 vWP;/.test(sh.vertexShader)) {
        sh.vertexShader = 'varying vec3 vWP;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n  vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        // worldpos_vertex есть не всегда (без теней) — запасной путь
        if (!/vWP = /.test(sh.vertexShader)) sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        sh.fragmentShader = 'varying vec3 vWP;\n' + sh.fragmentShader;
      }
      sh.fragmentShader = 'uniform sampler2D tFog; uniform vec2 uFogSize; uniform float uTime;\n' + sh.fragmentShader.replace('#include <dithering_fragment>',
        '#include <dithering_fragment>\n  { vec2 fu = vWP.xz / uFogSize; float fv = texture2D(tFog, fu).r; float outside = max(max(-fu.x, fu.x - 1.0), max(-fu.y, fu.y - 1.0)); if (outside > 0.0) fv = mix(fv, 0.5, smoothstep(0.0, 0.08, outside)); gl_FragColor.rgb *= mix(0.06, 1.0, smoothstep(0.0, 1.0, fv)); }');
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
  const HARD = { 4: 'metal', 9: 'wood', 11: 'planks', 12: 'roof' };                                     // полы, настилы, крыши
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
        'if (cutOn > 0.5 && transformed.y > aTile.z + uCutH) transformed.y = aTile.z + uCutH;'
      ].join('\n'));
    });
    return m;
  }
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

  /* ---------- Сборка мира ---------- */
  let group = null;
  const WMAT = { 2: 'brick', 11: 'bulkhead', 14: 'stone', 17: 'plaster' };
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
    // верх клеток
    const gTop = new Geo(), gHard = {}, gSide = {}, gAcid = new Geo(), gPit = new Geo();
    const side = function (k) { return gSide[k] || (gSide[k] = new Geo()); };
    for (let y = 0; y < B.h; y++) for (let x = 0; x < B.w; x++) {
      const i = y * B.w + x, gid = B.ground[i], h = hgt[i] * LV;
      const x0 = x * T, x1 = (x + 1) * T, z0 = y * T, z1 = (y + 1) * T;
      if (gid === 10) {
        // провал: тёмная яма
        const d = h - 3;
        gPit.quad([x0, d, z1], [x1, d, z1], [x1, d, z0], [x0, d, z0], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
        [[x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0]].forEach(function (e) {
          gPit.quad([e[0], h, e[1]], [e[2], h, e[3]], [e[2], d, e[3]], [e[0], d, e[1]], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
        });
        continue;
      }
      const top = [[x0, h, z1], [x1, h, z1], [x1, h, z0], [x0, h, z0]];
      const uvT = [[x0 / 2, z1 / 2], [x1 / 2, z1 / 2], [x1 / 2, z0 / 2], [x0 / 2, z0 / 2]];
      if (gid === 7) { const ta = top.map(function (p) { return [p[0], p[1] - 0.12, p[2]]; }); gAcid.quad(ta[0], ta[1], ta[2], ta[3], [0, 1, 0], uvT); }
      else if (HARD[gid]) (gHard[HARD[gid]] = gHard[HARD[gid]] || new Geo()).quad(top[0], top[1], top[2], top[3], [0, 1, 0], uvT);
      else gTop.quad(top[0], top[1], top[2], top[3], [0, 1, 0], uvT);
      // стенки уступов: где сосед ниже
      const sk = gid === 12 ? 'plaster' : (gid === 9 ? 'wood' : 'cliff');
      [[0, -1, [x1, z0], [x0, z0], [0, 0, -1]], [1, 0, [x1, z1], [x1, z0], [1, 0, 0]], [0, 1, [x0, z1], [x1, z1], [0, 0, 1]], [-1, 0, [x0, z0], [x0, z1], [-1, 0, 0]]].forEach(function (e) {
        const nx = x + e[0], ny = y + e[1];
        const out = nx < 0 || ny < 0 || nx >= B.w || ny >= B.h;
        const hn = out ? -0.6 : hgt[ny * B.w + nx] * LV;
        if (hn >= h - 0.01) return;
        const a = e[2], b = e[3], u0 = (e[4][0] ? a[1] : a[0]) / 2, u1 = (e[4][0] ? b[1] : b[0]) / 2;
        side(sk).quad([a[0], h, a[1]], [b[0], h, b[1]], [b[0], hn, b[1]], [a[0], hn, a[1]], e[4], [[u0, h / 2], [u1, h / 2], [u1, hn / 2], [u0, hn / 2]]);
      });
    }
    // земля вокруг поля (до горизонта, в тумане)
    const E = 40;
    gTop.quad([-E, -0.6, (B.h + 0) * T + E], [B.w * T + E, -0.6, B.h * T + E], [B.w * T + E, -0.6, -E], [-E, -0.6, -E], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    const top = new THREE.Mesh(gTop.build(), sm);
    top.receiveShadow = true;
    group.add(top); R3.pickables.push(top);
    for (const k in gHard) {
      const m = new THREE.Mesh(gHard[k].build(), R3.fogify(R3.pbr(k, k === 'roof' ? { metal: true, rough: 1 } : {}).clone()));
      m.receiveShadow = true; group.add(m); R3.pickables.push(m);
    }
    for (const k in gSide) {
      const m = new THREE.Mesh(gSide[k].build(), R3.fogify(R3.pbr(k).clone()));
      m.receiveShadow = true; m.castShadow = true; group.add(m);
    }
    if (gAcid.i.length) {
      const am = R3.fogify(new THREE.MeshStandardMaterial({ color: 0x4f9a22, emissive: 0x2f7a10, emissiveIntensity: 0.6, roughness: 0.15, metalness: 0, transparent: true, opacity: 0.88 }));
      const a = new THREE.Mesh(gAcid.build(), am); group.add(a); R3.pickables.push(a);
    }
    if (gPit.i.length) group.add(new THREE.Mesh(gPit.build(), new THREE.MeshBasicMaterial({ color: 0x050403 })));
    buildWalls(B);
    W3.buildProps(B);
    W3.updateFog(B, DW.BT.visible ? DW.BT.visible() : null);
    W3.setCut(B, null);
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
      m.castShadow = true; m.receiveShadow = true;
      wallGroup.add(m);
    }
  }
  W3.rebuildWalls = function (B) { W3.open = openings(B); buildWalls(B); };

  /* ---------- Предметы (модели), техника ---------- */
  let propGroup = null;
  const propMeshes = {};   // клетка → объект
  function hash(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return (h ^ (h >>> 16)) >>> 0; }
  /* поставить модель, вписав в размеры (как в запекании): len — клеток по большей стороне, h / hMax — высота */
  function placeModel(gl, v, pos, yawExtra) {
    const src = gl.scene;
    const o = src.clone(true);
    const holder = new THREE.Group();
    holder.add(o);
    o.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(o, true);
    const sz = b.getSize(new THREE.Vector3()), ctr = b.getCenter(new THREE.Vector3());
    let k = 1;
    if (v.len) k = v.len * T / Math.max(sz.x, sz.z);
    if (v.h) k = v.h / sz.y;
    if (v.hMax && sz.y * k > v.hMax) k = v.hMax / sz.y;
    if (v.k) k *= v.k;
    o.scale.setScalar(k);
    o.position.set(-ctr.x * k, -b.min.y * k, -ctr.z * k);
    holder.rotation.y = ((v.yaw || 0) + (yawExtra || 0)) * Math.PI / 180;
    if (v.sx || v.sy || v.sz) holder.scale.set(v.sx || 1, v.sy || 1, v.sz || 1);
    holder.position.copy(pos);
    o.traverse(function (m) {
      if (m.isMesh) {
        m.castShadow = true; m.receiveShadow = true;
        m.geometry.userData.shared = true; m.userData.shared = true;
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        m.material = mats.map(function (mt) { return fogMat(mt); });
        if (m.material.length === 1) m.material = m.material[0];
      }
    });
    return holder;
  }
  const fogMats = new Map();
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
    (B.vehicles || []).forEach(function (v) { for (let j = 0; j < v.len; j++) vehTiles[(v.d === 0 ? v.y : v.y + j) * B.w + (v.d === 0 ? v.x + j : v.x)] = v; });
    for (let y = 0; y < B.h; y++) for (let x = 0; x < B.w; x++) {
      const i = y * B.w + x, o = B.obj[i];
      if (!o || WALLS[o] || o === 1 || o === 13 || vehTiles[i]) continue;
      const list = M3.props[o];
      if (!list || !list.length) continue;
      const v = list[hash(x, y) % list.length];
      const pos = new THREE.Vector3((x + 0.5) * T, B.hgt[i] * LV, (y + 0.5) * T);
      const jitter = o === 3 || o === 8 || o === 16 || o === 20 || o === 19 ? (hash(y, x) % 360) : 0;
      R3.loadGLB('models/' + v.f + '.glb').then(function (gl) {
        if (!gl || !propGroup || B !== DW.BT.get()) return;
        const m = placeModel(gl, v, pos, jitter);
        if (o === 15) m.traverse(function (q) { if (q.isMesh && q.material.emissive) { q.material.emissive.set(0x3fb8d8); q.material.emissiveIntensity = 0.6; } });
        m.userData.tile = i;
        propGroup.add(m);
        propMeshes[i] = m;
      });
    }
    // техника на 2–3 клетки
    (B.vehicles || []).forEach(function (v) {
      if (v.dead) return;
      const e = M3.veh && M3.veh.length ? M3.veh[(v.m * 4 + v.d * 2 + (v.o || 0)) % M3.veh.length] : null;
      if (!e) return;
      const x1 = v.d === 0 ? v.x + v.len - 1 : v.x, y1 = v.d === 0 ? v.y : v.y + v.len - 1;
      const pos = new THREE.Vector3(((v.x + x1) / 2 + 0.5) * T, B.hgt[v.y * B.w + v.x] * LV, ((v.y + y1) / 2 + 0.5) * T);
      R3.loadGLB('models/' + e.f + '.glb').then(function (gl) {
        if (!gl || !propGroup || B !== DW.BT.get()) return;
        const m = placeModel(gl, e, pos, 0);
        m.userData.veh = v;
        propGroup.add(m);
        v._m3 = m;
      });
    });
  };
  /* клетка изменилась (стену пробили, предмет разбит) */
  W3.tileChanged = function (B, x, y) {
    const i = y * B.w + x;
    if (propMeshes[i] && !B.obj[i]) { propGroup.remove(propMeshes[i]); delete propMeshes[i]; }
    W3.rebuildWalls(B);
    (B.vehicles || []).forEach(function (v) { if (v.dead && v._m3) { propGroup.remove(v._m3); v._m3 = null; } });
  };
  W3.group = function () { return group; };
})(window.DW);
