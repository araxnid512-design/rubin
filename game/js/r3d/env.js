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
    dawn: { sun: 0xffb27a, si: 2.1, sky: 0xc9a58e, gnd: 0x5a4636, hi: 0.8, az: 2.3, el: 0.32, fog: 0xc79a80, fd: 0.012, top: 0x5a6888, bot: 0xf0a878, exp: 1.05 },
    dusk: { sun: 0xff9a5a, si: 2.0, sky: 0xb88a78, gnd: 0x4a3a2e, hi: 0.72, az: -0.8, el: 0.28, fog: 0xa77a64, fd: 0.013, top: 0x3e4468, bot: 0xe08a5a, exp: 1.05 },
    night: { sun: 0x8fa8d8, si: 0.55, sky: 0x405070, gnd: 0x1a1a22, hi: 0.42, az: 1.2, el: 0.85, fog: 0x1a2030, fd: 0.02, top: 0x070b16, bot: 0x1e2638, exp: 1.25 },
    interior: { sun: 0xffe2b8, si: 0.9, sky: 0x8a7a68, gnd: 0x3a3028, hi: 0.55, az: 0.9, el: 1.1, fog: 0x2a241e, fd: 0.02, top: 0x1a1612, bot: 0x2a241e, exp: 1.15 },
    cave: { sun: 0xbfd8e8, si: 0.5, sky: 0x506070, gnd: 0x2a221c, hi: 0.4, az: 0.9, el: 1.2, fog: 0x12100e, fd: 0.03, top: 0x0a0908, bot: 0x161210, exp: 1.25 }
  };
  const WEATHER = { rain: { fd: 1.35, dim: 0.72, fog: 0x7d828a }, dust: { fd: 1.8, dim: 0.85, fog: 0xb08a5e }, ash: { fd: 1.6, dim: 0.75, fog: 0x8a8580 } };
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
        uniforms: { cTop: { value: new THREE.Color() }, cBot: { value: new THREE.Color() }, cSun: { value: new THREE.Color() }, dSun: { value: new THREE.Vector3() } },
        vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; }',
        fragmentShader: 'uniform vec3 cTop, cBot, cSun, dSun; varying vec3 vD; void main(){ float h = clamp(vD.y * 1.6 + 0.15, 0.0, 1.0); vec3 c = mix(cBot, cTop, h); float s = pow(max(0.0, dot(normalize(vD), dSun)), 24.0); c += cSun * s * 0.6; gl_FragColor = vec4(c, 1.0); }'
      }));
      sky.renderOrder = -10;
    }
    sky.material.uniforms.cTop.value.set(t.top).multiplyScalar(dim);
    sky.material.uniforms.cBot.value.copy(fogCol);
    sky.material.uniforms.cSun.value.set(t.sun);
    sky.material.uniforms.dSun.value.copy(E.sunDir);
    g.add(sky);
    R3.renderer.toneMappingExposure = t.exp;
    R3.renderer.setClearColor(fogCol);
    E.B = B;
  };
  /* тень следует за точкой взгляда камеры: охват — сколько видно на экране */
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
  };
})(window.DW);
