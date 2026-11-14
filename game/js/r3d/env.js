'use strict';
/* 3D-бой: свет и небо по времени суток и погоде. Солнце с тенью (тень следует за камерой — чётче на телефоне),
   полусфера неба и земли, дымка до горизонта, градиентное небо. Ночь — луна и фонари (fx.js), подземелье — только
   лампы. */
(function (DW) {
  const R3 = DW.R3, THREE = R3.THREE;
  if (!THREE) return;
  const T = R3.T;
  const E = R3.env = {};
  // время суток: цвет и сила солнца, неба, земли; направление солнца (азимут, высота); дымка
  const TOD = {
    day: { sun: 0xfff1d8, si: 2.6, sky: 0xbfcfe0, gnd: 0x6a5a48, hi: 1.05, az: 0.6, el: 0.95, fog: 0xb7b1a6, fd: 0.0105, top: 0x7f97b4, bot: 0xd6cbb6, exp: 1.0 },
    dawn: { sun: 0xffc49a, si: 1.8, sky: 0xb8a698, gnd: 0x5a4636, hi: 0.8, az: 2.3, el: 0.32, fog: 0xc79a80, fd: 0.012, top: 0x5a6888, bot: 0xf0a878, exp: 1.05 },
    dusk: { sun: 0xffb486, si: 1.6, sky: 0xa89488, gnd: 0x4a3a2e, hi: 0.8, az: -0.8, el: 0.28, fog: 0xa77a64, fd: 0.013, top: 0x3e4468, bot: 0xe08a5a, exp: 1.05 },
    night: { sun: 0x9fb4e0, si: 0.95, sky: 0x4a5a7a, gnd: 0x202028, hi: 0.62, az: 1.2, el: 0.85, fog: 0x1a2030, fd: 0.02, top: 0x070b16, bot: 0x1e2638, exp: 1.4 },
    interior: { sun: 0xffe2b8, si: 0.9, sky: 0x8a7a68, gnd: 0x3a3028, hi: 0.55, az: 0.9, el: 1.1, fog: 0x2a241e, fd: 0.02, top: 0x1a1612, bot: 0x2a241e, exp: 1.15 },
    cave: { sun: 0xbfd8e8, si: 0.5, sky: 0x506070, gnd: 0x2a221c, hi: 0.4, az: 0.9, el: 1.2, fog: 0x12100e, fd: 0.03, top: 0x0a0908, bot: 0x161210, exp: 1.25 }
  };
  const WEATHER = { rain: { fd: 1.35, dim: 0.72, fog: 0x7d828a }, dust: { fd: 2.6, dim: 0.82, fog: 0xc09060 }, ash: { fd: 1.8, dim: 0.75, fog: 0x8a8580 } };
  /* цветокоррекция (в общем шейдере мира, после тонального сжатия — несколько умножений на точку, без отдельного
     прохода): s — насыщенность, c — контраст, g — усиление каналов, l — подъём теней. Закат — тёплый, ночь —
     холодная синяя, подземелья, болото и гнёзда — зеленоватые; погода приглушает цвет */
  const GRADE = {
    day: { s: 1.06, c: 1.04, g: [1.0, 0.995, 0.97], l: [0, 0, 0] },
    dawn: { s: 1.1, c: 1.06, g: [1.07, 0.98, 0.86], l: [0.012, 0.004, 0] },
    dusk: { s: 1.12, c: 1.07, g: [1.1, 0.95, 0.82], l: [0.016, 0.002, 0.006] },
    night: { s: 0.72, c: 1.06, g: [0.84, 0.95, 1.14], l: [0, 0.006, 0.022] },
    interior: { s: 0.95, c: 1.04, g: [1.04, 0.99, 0.92], l: [0.008, 0.004, 0] },
    cave: { s: 0.86, c: 1.06, g: [0.9, 1.03, 0.98], l: [0, 0.014, 0.01] }
  };
  const GRADE_MAP = {
    swamp: { s: 0.94, g: [0.93, 1.04, 0.86], l: [0, 0.01, 0] }, nest: { s: 0.92, g: [0.9, 1.06, 0.88], l: [0, 0.016, 0.004] },
    lair: { s: 0.95, g: [0.95, 1.03, 0.9], l: [0, 0.008, 0] }, vein: { s: 0.95, g: [0.94, 1.04, 0.92], l: [0.004, 0.012, 0] },
    crystalcave: { s: 1.0, g: [0.9, 1.0, 1.08], l: [0, 0.008, 0.016] }
  };
  const GRADE_WX = { rain: { s: 0.86, g: [0.97, 0.99, 1.04] }, dust: { s: 0.88, g: [1.06, 0.98, 0.86] }, ash: { s: 0.78, g: [0.98, 0.98, 0.98] } };
  function grade(B) {
    const a = GRADE[B.tod] || GRADE.day, m = GRADE_MAP[B.map] || {}, w = GRADE_WX[B.weather] || {};
    const sat = a.s * (m.s || 1) * (w.s || 1), con = a.c;
    const gain = [0, 1, 2].map(function (i) { return a.g[i] * (m.g ? m.g[i] : 1) * (w.g ? w.g[i] : 1); });
    const lift = [0, 1, 2].map(function (i) { return a.l[i] + (m.l ? m.l[i] : 0); });
    const U = R3.gradeU;
    if (U) { U.uGradeSC.value.set(sat, con); U.uGradeGain.value.set(gain[0], gain[1], gain[2]); U.uGradeLift.value.set(lift[0], lift[1], lift[2]); }
    return { s: sat, c: con, g: gain, l: lift };
  }
  /* ветер для травы (detail.js): тише в подземелье, сильнее в дождь и бурю */
  const windU = R3.windU = { uWind: { value: 0.35 } };
  const WIND = { rain: 0.85, dust: 1.1, ash: 0.5 };
  let sky = null;
  E.build = function (B) {
    const S = R3.scene;
    if (E.group) S.remove(E.group);
    const g = E.group = new THREE.Group();
    S.add(g);
    const t = TOD[B.tod] || TOD.day, w = WEATHER[B.weather] || null;
    const dim = w ? w.dim : 1;
    E.cfg = t;
    // небо и земля
    const hemi = new THREE.HemisphereLight(t.sky, t.gnd, t.hi * dim);
    g.add(hemi);
    // солнце (луна)
    const sun = new THREE.DirectionalLight(t.sun, t.si * dim);
    const q = R3.q();
    sun.castShadow = q >= 1;
    const s = q >= 2 ? 2048 : 1024;
    sun.shadow.mapSize.set(s, s);
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
    const sc = sun.shadow.camera;
    sc.left = -16; sc.right = 16; sc.top = 16; sc.bottom = -16; sc.near = 1; sc.far = 90;
    sun.shadow.radius = 3;
    g.add(sun); g.add(sun.target);
    R3.sun = sun;
    E.sunDir = new THREE.Vector3(Math.cos(t.el) * Math.cos(t.az), Math.sin(t.el), Math.cos(t.el) * Math.sin(t.az)).normalize();
    // дымка
    const fogCol = w ? new THREE.Color(t.fog).lerp(new THREE.Color(w.fog), 0.5) : new THREE.Color(t.fog);
    S.fog = new THREE.FogExp2(fogCol, t.fd * (w ? w.fd : 1));
    // небо — большой купол с градиентом (без текстур)
    if (!sky) {
      sky = new THREE.Mesh(new THREE.SphereGeometry(150, 24, 12), new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, fog: false,
        uniforms: { cTop: { value: new THREE.Color() }, cBot: { value: new THREE.Color() }, cSun: { value: new THREE.Color() }, dSun: { value: new THREE.Vector3() },
          uSC: { value: new THREE.Vector2(1, 1) }, uGain: { value: new THREE.Vector3(1, 1, 1) }, uLift: { value: new THREE.Vector3() } },
        vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; }',
        fragmentShader: 'uniform vec3 cTop, cBot, cSun, dSun, uGain, uLift; uniform vec2 uSC; varying vec3 vD; void main(){ float h = clamp(vD.y * 1.6 + 0.15, 0.0, 1.0); vec3 c = mix(cBot, cTop, h); float s = pow(max(0.0, dot(normalize(vD), dSun)), 24.0); c += cSun * s * 0.6;' +
          ' float l = dot(c, vec3(0.299, 0.587, 0.114)); c = (mix(vec3(l), c, uSC.x) - 0.5) * uSC.y + 0.5; gl_FragColor = vec4(max(c * uGain + uLift, 0.0), 1.0); }'
      }));
      sky.renderOrder = -10;
    }
    sky.material.uniforms.cTop.value.set(t.top).multiplyScalar(dim);
    sky.material.uniforms.cBot.value.copy(fogCol);
    sky.material.uniforms.cSun.value.set(t.sun);
    sky.material.uniforms.dSun.value.copy(E.sunDir);
    // небо — с той же цветокоррекцией, что и мир (иначе горизонт не сходится с дымкой)
    const gr = grade(B), su = sky.material.uniforms;
    su.uSC.value.set(gr.s, gr.c); su.uGain.value.set(gr.g[0], gr.g[1], gr.g[2]); su.uLift.value.set(gr.l[0], gr.l[1], gr.l[2]);
    windU.uWind.value = (B.tod === 'cave' || B.tod === 'interior') ? 0.12 : (WIND[B.weather] || 0.35);
    g.add(sky);
    R3.renderer.toneMappingExposure = t.exp;
    R3.renderer.setClearColor(fogCol);
    E.B = B;
    weather(B);
  };
  /* погода: дождь — косые струи, пыльная буря — летящая пыль, пепел — медленные хлопья; облако частиц вокруг камеры */
  let wx = null;
  function weather(B) {
    if (wx) { E.group.remove(wx.obj); wx = null; }
    const kind = B.weather;
    if (kind !== 'rain' && kind !== 'dust' && kind !== 'ash') return;
    if (B.tod === 'interior' || B.tod === 'cave') return;
    const q = R3.q(), N = kind === 'rain' ? [400, 800, 1300][q] : [250, 450, 700][q];
    const R = 18, Hh = 9;
    const pos = new Float32Array(N * (kind === 'rain' ? 6 : 3)), seed = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { seed[i * 3] = (Math.random() - 0.5) * 2 * R; seed[i * 3 + 1] = Math.random() * Hh; seed[i * 3 + 2] = (Math.random() - 0.5) * 2 * R; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    let obj;
    if (kind === 'rain') obj = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x9fb4c8, transparent: true, opacity: 0.38, depthWrite: false, fog: true }));
    else {
      if (!E.softTex) {
        const c = document.createElement('canvas'); c.width = c.height = 32;
        const cg = c.getContext('2d'), gr = cg.createRadialGradient(16, 16, 0, 16, 16, 16);
        gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        cg.fillStyle = gr; cg.fillRect(0, 0, 32, 32);
        E.softTex = new THREE.CanvasTexture(c);
      }
      // пыль — крупные полупрозрачные клубы песка, пепел — серые хлопья
      obj = new THREE.Points(g, new THREE.PointsMaterial({ map: E.softTex, color: kind === 'dust' ? 0xd2a46c : 0xb8b4ae, size: kind === 'dust' ? 0.55 : 0.16, transparent: true, opacity: kind === 'dust' ? 0.32 : 0.85, depthWrite: false, sizeAttenuation: true }));
    }
    obj.frustumCulled = false; obj.renderOrder = 25;
    E.group.add(obj);
    wx = { kind: kind, obj: obj, pos: pos, seed: seed, N: N, R: R, Hh: Hh, t: 0 };
  }
  E.tick = function (dt) {
    if (!wx) return;
    wx.t += dt;
    const c = R3.cam, p = wx.pos, s = wx.seed, R = wx.R, Hh = wx.Hh;
    const fall = wx.kind === 'rain' ? 11 : (wx.kind === 'ash' ? 0.7 : 0.25), wind = wx.kind === 'dust' ? 3.5 : (wx.kind === 'rain' ? 1.6 : 0.5);
    for (let i = 0; i < wx.N; i++) {
      let y = s[i * 3 + 1] - fall * dt;
      s[i * 3] += wind * dt + (wx.kind === 'ash' ? Math.sin(wx.t + i) * 0.2 * dt : 0);
      if (wx.kind === 'dust') y += Math.sin(wx.t * 1.3 + i * 0.7) * 0.4 * dt;
      if (y < 0) y += Hh;
      if (s[i * 3] > R) s[i * 3] -= 2 * R;
      s[i * 3 + 1] = y;
      const X = c.tx + s[i * 3], Y = c.ty + y, Z = c.tz + s[i * 3 + 2];
      if (wx.kind === 'rain') { p[i * 6] = X; p[i * 6 + 1] = Y; p[i * 6 + 2] = Z; p[i * 6 + 3] = X - wind * 0.035; p[i * 6 + 4] = Y + 0.4; p[i * 6 + 5] = Z; }
      else { p[i * 3] = X; p[i * 3 + 1] = Y; p[i * 3 + 2] = Z; }
    }
    wx.obj.geometry.attributes.position.needsUpdate = true;
  };
  /* тень следует за точкой взгляда камеры: охват — сколько видно на экране. Статика в карту теней не рисуется
     (запечена, bake.js), бойцы — да; карта теней перерисовывается, когда сдвинулась камера или идёт действие,
     а в покое — каждый третий кадр (дыхание и осмотр бойцов) */
  let frame = 0, camKey = '';
  E.update = function () {
    const sun = R3.sun;
    if (!sun) return;
    const c = R3.cam;
    const r = Math.max(10, c.dist * 0.75);
    sun.target.position.set(c.tx, c.ty, c.tz);
    sun.position.set(c.tx + E.sunDir.x * 40, c.ty + E.sunDir.y * 40, c.tz + E.sunDir.z * 40);
    const sc = sun.shadow.camera;
    if (Math.abs(sc.right - r) > 0.5) { sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.updateProjectionMatrix(); }
    if (sky) sky.position.set(c.tx, 0, c.tz);
    if (R3.bake) R3.bake.tick();
    const sm = R3.renderer.shadowMap;
    if (sm.enabled && R3.bake) {
      sm.autoUpdate = false;
      frame++;
      const k = c.tx.toFixed(2) + ',' + c.tz.toFixed(2) + ',' + c.ty.toFixed(2) + ',' + r.toFixed(1);
      // кто-то идёт (частицы огня, дыма и дождя в тень не попадают — по ним не перерисовываем)
      const Bb = E.B, tw = DW.TR2 && DW.TR2.tweenOf;
      const busy = frame % 3 === 0 || !!(Bb && tw && Bb.units.some(function (u) { return u.alive && tw(u.id); }));
      if (k !== camKey || busy) sm.needsUpdate = true;
      camKey = k;
    }
  };
})(window.DW);
