'use strict';
/* 3D-бой: эффекты. Частицы — плоскости к камере в двух сетках на всё поле (дым/пыль/кровь — обычное смешение,
   вспышки/искры/трассеры — сложение света); вспышка дула освещает всё вокруг (один общий точечный свет);
   гильзы — мелкие латунные бруски с отскоком; взрыв — вспышка, огненный шар, дым, обломки, пятно копоти;
   граната и ракета летят по дуге в 3D; пятна крови и копоти — на земле. Сроки — те же, что в 2D. */
(function (DW) {
  const R3 = DW.R3, THREE = R3.THREE, U = DW.U;
  if (!THREE) return;
  const T = R3.T, LV = R3.LV;
  const FX = R3.fx = {};
  const V = function (x, y, z) { return new THREE.Vector3(x || 0, y || 0, z || 0); };
  const now = function () { return DW.TR2 ? DW.TR2.now() : performance.now(); };

  /* ---------- Мягкое пятно (текстура частиц) ---------- */
  function softTex() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  /* ---------- Сетка плоскостей к камере ---------- */
  function Cloud(max, additive) {
    this.max = max; this.list = [];
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 4 * 3); this.col = new Float32Array(max * 4 * 4); this.uv = new Float32Array(max * 4 * 2);
    const idx = new Uint16Array(max * 6);
    for (let i = 0; i < max; i++) {
      idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
      this.uv.set([0, 0, 1, 0, 1, 1, 0, 1], i * 8);
    }
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    this.geo = g;
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: TEX, vertexColors: true, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: !additive }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = additive ? 20 : 15;
  }
  Cloud.prototype.add = function (p) { if (this.list.length >= this.max) this.list.shift(); this.list.push(p); return p; };
  const cR = V(), cU = V(), tmp = V(), tmp2 = V();
  Cloud.prototype.draw = function (t, dt) {
    const cam = R3.camera;
    cR.setFromMatrixColumn(cam.matrixWorld, 0); cU.setFromMatrixColumn(cam.matrixWorld, 1);
    let n = 0;
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i], k = (t - p.t0) / p.life;
      if (k >= 1) { L.splice(i, 1); continue; }
    }
    for (let i = 0; i < L.length && n < this.max; i++) {
      const p = L[i], k = (t - p.t0) / p.life;
      if (k < 0) continue;
      // движение: скорость, тяжесть, торможение; отскок от земли
      if (p.v) {
        p.p.addScaledVector(p.v, dt);
        p.v.y -= (p.g || 0) * dt;
        p.v.multiplyScalar(Math.exp(-(p.drag || 0) * dt));
        if (p.floor !== undefined && p.p.y < p.floor) { p.p.y = p.floor; p.v.y = Math.abs(p.v.y) * 0.25; p.v.x *= 0.5; p.v.z *= 0.5; }
      }
      const a = p.fadeIn && k < p.fadeIn ? k / p.fadeIn : 1;
      const al = p.a * a * (p.hold ? (k < p.hold ? 1 : (1 - k) / (1 - p.hold)) : (1 - k));
      const sz = p.s0 + (p.s1 - p.s0) * k;
      const o = n * 12;
      if (p.p2) {
        // трассер: полоса от p до p2 (видимая часть движется)
        const a0 = U.clamp(k * 1.6 - 0.6, 0, 1), a1 = U.clamp(k * 1.6, 0, 1);
        const A = tmp.copy(p.p).lerp(p.p2, a0), Bp = tmp2.copy(p.p).lerp(p.p2, a1);
        const dir = V().subVectors(Bp, A);
        const side = V().crossVectors(dir, V().subVectors(cam.position, A)).normalize().multiplyScalar(sz);
        this.pos.set([A.x - side.x, A.y - side.y, A.z - side.z, A.x + side.x, A.y + side.y, A.z + side.z, Bp.x + side.x, Bp.y + side.y, Bp.z + side.z, Bp.x - side.x, Bp.y - side.y, Bp.z - side.z], o);
      } else {
        const rx = cR.x * sz, ry = cR.y * sz, rz = cR.z * sz, ux = cU.x * sz, uy = cU.y * sz, uz = cU.z * sz;
        const x = p.p.x, y = p.p.y, z = p.p.z;
        this.pos.set([x - rx - ux, y - ry - uy, z - rz - uz, x + rx - ux, y + ry - uy, z + rz - uz, x + rx + ux, y + ry + uy, z + rz + uz, x - rx + ux, y - ry + uy, z - rz + uz], o);
      }
      const c = p.c;
      for (let v = 0; v < 4; v++) this.col.set([c.r, c.g, c.b, al], n * 16 + v * 4);
      n++;
    }
    this.geo.setDrawRange(0, n * 6);
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.color.needsUpdate = true;
  };
  let TEX = null, smoke = null, glow = null, light = null, lightT = 0, cas = null, casL = [], projs = [], decals = null, group = null;
  let spent = null, spentN = 0;   // стреляные гильзы, оставшиеся на земле (до конца боя, по кругу)
  const SPENT_MAX = 160;
  FX.init = function (B) {
    if (group) {
      R3.scene.remove(group);
      // прошлый бой: буферы частиц и гильз — освободить (геометрия пятен общая)
      group.traverse(function (o) { if (o.isInstancedMesh) o.dispose(); else if (o.isMesh && o.geometry !== decalGeo) o.geometry.dispose(); });
    }
    group = new THREE.Group(); R3.scene.add(group);
    if (!TEX) TEX = softTex();
    smoke = new Cloud(420, false); glow = new Cloud(320, true);
    group.add(smoke.mesh); group.add(glow.mesh);
    light = new THREE.PointLight(0xffb060, 0, 9, 1.6); light.castShadow = false;
    group.add(light);
    // гильзы
    cas = new THREE.InstancedMesh(new THREE.BoxGeometry(0.018, 0.018, 0.05), new THREE.MeshStandardMaterial({ color: 0xd8a840, metalness: 0.9, roughness: 0.3 }), 80);
    cas.count = 0; cas.frustumCulled = false; group.add(cas);
    spent = new THREE.InstancedMesh(cas.geometry, R3.fogify(new THREE.MeshStandardMaterial({ color: 0xc89a40, metalness: 0.85, roughness: 0.4 })), SPENT_MAX);
    spent.count = 0; spentN = 0; spent.frustumCulled = false; group.add(spent);
    casL = []; projs = [];
    decals = new THREE.Group(); group.add(decals);
    (B.decals || []).forEach(function (d) { FX.decal(d.x, d.y, d.k, d.s, true); });
  };
  const col = function (s) { return new THREE.Color(s); };
  function puff(p, n, o) {
    for (let i = 0; i < n; i++) {
      const v = V((Math.random() - 0.5) * o.sp, (o.up || 0) + Math.random() * (o.upr || 0), (Math.random() - 0.5) * o.sp);
      (o.add ? glow : smoke).add({ p: p.clone().add(V((Math.random() - 0.5) * (o.r || 0), 0, (Math.random() - 0.5) * (o.r || 0))), v: v, g: o.g || 0, drag: o.drag || 0.5, floor: o.floor,
        t0: now() + (o.delay || 0) + Math.random() * (o.jit || 0), life: o.life * (0.7 + Math.random() * 0.6), s0: o.s0, s1: o.s1, a: o.a, c: col(o.c), fadeIn: o.fadeIn, hold: o.hold });
    }
  }
  FX.puff = puff;
  /* вспышка с освещением округи */
  function flashAt(p, r, life, c) {
    glow.add({ p: p.clone(), t0: now(), life: life, s0: r, s1: r * 1.4, a: 1, c: col(c || '#ffd890') });
    // высокая графика: широкий мягкий ореол вокруг вспышки (та же сетка частиц — без лишних проходов)
    if (R3.q() >= 2) glow.add({ p: p.clone(), t0: now(), life: life * 1.6, s0: r * 3.2, s1: r * 4, a: 0.22, c: col(c || '#ffd890') });
    light.position.copy(p); light.intensity = Math.max(light.intensity, 6 * r); light.distance = 6 + r * 8; lightT = now() + life;
  }
  FX.flash = flashAt;

  /* ---------- Выстрел: вспышки, трассеры, гильзы, дым — по таймингам 2D (shotFx) ---------- */
  FX.shot = function (att, tgt, hit, W, show, suppress, opt) {
    const tr = DW.TR2, s = (DW.settings && DW.settings.speed) || 1;
    const FW = tr.FXof ? tr.FXof(W) : {};
    const cnt = FW.n || ({ rifle: 3, lmg: 5, shotgun: 1, sniper: 1, spit: 1, beam: 1 }[W.snd] || 1);
    const gap = (FW.gap || (W.snd === 'lmg' ? 70 : 90)) / s;
    const pre = W.snd === 'spit' ? 300 / s : 220 / s;
    const tA = R3.units.anchor(tgt, false).add(V(0, (tgt.type === 'queen' ? 1.4 : 1.05) * (tr.unitScale(tgt) / 1.13), 0));
    const cover = opt && opt.coverTile;
    for (let i = 0; i < cnt; i++) {
      setTimeout(function () {
        const m = R3.units.muzzle(att) || R3.units.anchor(att, false).add(V(0, 1.3, 0));
        let e = tA.clone();
        if (cover && !suppress) e = V((cover[0] + 0.5) * T + (Math.random() - 0.5) * 0.4, R3.hAt(cover[0], cover[1]) + 0.5 + Math.random() * 0.6, (cover[1] + 0.5) * T + (Math.random() - 0.5) * 0.4);
        else if (!hit || suppress) { const a = Math.random() * Math.PI * 2, d = (0.6 + Math.random() * 0.9) * (FW.spread || 1); e.add(V(Math.cos(a) * d, (Math.random() - 0.3) * 0.8, Math.sin(a) * d)); }
        else e.add(V((Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.25));
        if (W.snd === 'spit') {
          projs.push({ a: m, b: e, t0: now(), dur: 280, arc: 0.6, kind: 'spit' });
          return;
        }
        const tc = FW.tr || (W.snd === 'beam' ? '#6fd8ff' : '#ffe08a');
        const dirv = V().subVectors(e, m).normalize();
        // трассер дальше цели (если мимо — пролетает)
        const far = hit && !suppress ? e : e.clone().addScaledVector(dirv, 4);
        glow.add({ p: m.clone(), p2: far, t0: now(), life: FW.life || 115, s0: 0.022 * (FW.w || 2), s1: 0.022 * (FW.w || 2), a: 1, c: col(tc) });
        if (W.snd === 'shotgun') for (let k = 0; k < 6; k++) glow.add({ p: m.clone(), p2: far.clone().add(V((Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.9)), t0: now(), life: 110, s0: 0.016, s1: 0.016, a: 0.8, c: col(tc) });
        // вспышка дула: шар и «языки» по стволу
        const fr = (FW.flash || 14) / 60;
        flashAt(m, fr, FW.flife || 70, '#ffe0a0');
        glow.add({ p: m.clone().addScaledVector(dirv, fr * 0.9), t0: now(), life: (FW.flife || 70) * 0.7, s0: fr * 0.8, s1: fr * 0.5, a: 0.9, c: col('#ffb050') });
        // дымок у дула
        puff(m, Math.max(1, Math.round((FW.smoke || 4) / 2)), { sp: 0.25, up: 0.25, upr: 0.2, drag: 1.5, life: 1100, s0: 0.12, s1: 0.45, a: 0.22, c: '#cfc8bc', fadeIn: 0.1 });
        // гильза: вбок от ствола, отскок
        const side = V().crossVectors(dirv, V(0, 1, 0)).normalize();
        const ej = FW.eject === undefined ? 1 : FW.eject;
        casL.push({ p: m.clone().addScaledVector(dirv, -0.35), v: side.multiplyScalar((1.2 + Math.random()) * ej).add(V(0, 1.8 + Math.random(), 0)), r: V(Math.random() * 12, Math.random() * 12, Math.random() * 12), e: new THREE.Euler(), t0: now(), life: 2600, floor: R3.hAt(att.x, att.y) + 0.01, tk: false });
        if (casL.length > 80) casL.shift();
        // попадание мимо: фонтанчик земли / крошка укрытия
        if (!hit && !suppress) setTimeout(function () { impactAt(e, cover ? 'stone' : 'dirt'); }, 60);
      }, (pre + i * gap) / (DW.timeScale || 1));
    }
  };
  function impactAt(p, mat) {
    const floorY = Math.min(p.y, R3.hAt(p.x / T - 0.5, p.z / T - 0.5) + 0.02);
    const c = { dirt: '#7a6048', stone: '#9a948a', wood: '#9a6a3a', metal: '#ffe6a0', flesh: '#8a2a20' }[mat] || '#8a8070';
    puff(p, 5, { sp: 1.6, up: 1.2, upr: 1.2, g: 6, drag: 0.6, floor: floorY, life: 650, s0: 0.035, s1: 0.03, a: 0.95, c: c });
    puff(p, 3, { sp: 0.35, up: 0.2, upr: 0.3, drag: 1.2, life: 900, s0: 0.12, s1: 0.4, a: 0.35, c: '#b8ab98', fadeIn: 0.1 });
    if (mat === 'metal' || mat === 'stone') puff(p, 3, { add: true, sp: 2.4, up: 1.5, upr: 1, g: 8, drag: 0.4, life: 220, s0: 0.03, s1: 0.01, a: 1, c: '#fff2b0' });
  }
  FX.impact = impactAt;
  /* попадание по бойцу: брызги, искры по броне */
  FX.hit = function (u) {
    const p = R3.units.anchor(u, false).add(V(0, 1.1 * (DW.TR2.unitScale(u) / 1.13), 0));
    const k = DW.TR2.bloodKind ? DW.TR2.bloodKind(u) : 'red';
    const c = k === 'oil' ? '#2a2420' : (k === 'acid' ? '#7ab030' : '#8a1a14');
    puff(p, 8, { sp: 1.8, up: 0.8, upr: 1.2, g: 7, drag: 0.4, floor: R3.hAt(u.x, u.y) + 0.02, life: 700, s0: 0.04, s1: 0.03, a: 0.95, c: c });
    if (k === 'oil') puff(p, 5, { add: true, sp: 2.5, up: 1, upr: 1, g: 8, life: 220, s0: 0.03, s1: 0.01, a: 1, c: '#ffe6a0' });
  };
  /* взрыв */
  FX.explosion = function (x, y, r) {
    const p = V((x + 0.5) * T, R3.hAt(x, y) + 0.3, (y + 0.5) * T);
    flashAt(p.clone().add(V(0, 0.6, 0)), 1.6 + r * 0.6, 260, '#ffe2a0');
    light.intensity = 30; light.distance = 14;
    puff(p, 14, { add: true, sp: 3.5, up: 2.5, upr: 2.5, drag: 2.2, life: 520, s0: 0.5, s1: 1.4, a: 0.9, c: '#ff8a30', r: r * 0.6 });
    puff(p, 18, { sp: 1.6, up: 0.9, upr: 1.4, drag: 0.6, life: 3200, s0: 0.6, s1: 2.4, a: 0.42, c: '#3e3832', r: r * 0.8, fadeIn: 0.08 });
    puff(p, 16, { sp: 7, up: 4, upr: 5, g: 9.8, drag: 0.2, floor: p.y - 0.28, life: 1300, s0: 0.05, s1: 0.04, a: 1, c: '#2e2620' });
    puff(p, 10, { add: true, sp: 9, up: 4, upr: 4, g: 9.8, drag: 0.2, life: 500, s0: 0.04, s1: 0.02, a: 1, c: '#ffd070' });
    R3.cam.shake = 12;
  };
  FX.debris = function (x, y, color) {
    const p = V((x + 0.5) * T, R3.hAt(x, y) + 0.8, (y + 0.5) * T);
    puff(p, 14, { sp: 4, up: 2.5, upr: 3, g: 9.8, drag: 0.3, floor: p.y - 0.78, life: 1400, s0: 0.06, s1: 0.05, a: 1, c: color || '#8a8278' });
    puff(p, 10, { sp: 1.2, up: 0.5, upr: 0.8, drag: 0.8, life: 2400, s0: 0.4, s1: 1.4, a: 0.4, c: '#a49a8c', fadeIn: 0.08 });
    R3.cam.shake = Math.max(R3.cam.shake, 5);
  };
  FX.chips = function (x, y, color) {
    const p = V((x + 0.5) * T, R3.hAt(x, y) + 0.6 + Math.random() * 0.6, (y + 0.5) * T);
    impactAt(p, 'stone');
  };
  /* пыль из-под ног */
  FX.step = function (u) {
    const p = R3.units.anchor(u, false).add(V(0, 0.05, 0));
    puff(p, 2, { sp: 0.4, up: 0.15, upr: 0.2, drag: 1.6, life: 900, s0: 0.12, s1: 0.45, a: 0.2, c: '#a8987e', fadeIn: 0.15 });
  };
  /* граната / ракета / плевок по дуге */
  FX.projectile = function (x0, y0, x1, y1, kind, from, dur) {
    // ракета — из трубы, граната — из руки бросающего (кто стоит в клетке x0, y0)
    const B = DW.BT.get();
    const thrower = from || (B && B.units.find(function (q) { return q.alive && q.x === x0 && q.y === y0; }));
    let a = null;
    if (thrower && kind === 'rocket') a = R3.units.muzzle(thrower);
    else if (thrower) a = R3.units.hand(thrower);
    if (!a) a = V((x0 + 0.5) * T, R3.hAt(x0, y0) + 1.4, (y0 + 0.5) * T);
    const b = V((x1 + 0.5) * T, R3.hAt(x1, y1) + 0.15, (y1 + 0.5) * T);
    projs.push({ a: a, b: b, t0: now(), dur: dur, arc: kind === 'rocket' ? 0.35 : 2.4, kind: kind });
  };
  /* сбор груза у Портала */
  FX.cargo = function (x, y) {
    const p = V((x + 0.5) * T, R3.hAt(x, y) + 0.4, (y + 0.5) * T);
    flashAt(p, 1.2, 500, '#bfefff');
    puff(p, 18, { add: true, sp: 2, up: 1.5, upr: 1.5, drag: 1.5, life: 700, s0: 0.06, s1: 0.02, a: 1, c: '#bfefff' });
  };
  /* пятна на земле: кровь, копоть (материал — один на вид, плоскость — одна на все) */
  const decTex = {}, decMat = {};
  const decalGeo = new THREE.PlaneGeometry(1, 1);
  function decalTex(kind) {
    if (decTex[kind]) return decTex[kind];
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const rnd = function () { return Math.random(); };
    if (kind === 'scorch') {
      const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(10,8,6,0.9)'); gr.addColorStop(0.6, 'rgba(25,20,16,0.6)'); gr.addColorStop(1, 'rgba(30,24,18,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    } else {
      const base = kind === 'oil' ? '30,26,22' : (kind === 'acid' ? '90,130,30' : '95,12,10');
      for (let i = 0; i < 9; i++) {
        const x = 64 + (rnd() - 0.5) * 50, y = 64 + (rnd() - 0.5) * 50, r = 10 + rnd() * 22;
        const gr = g.createRadialGradient(x, y, 1, x, y, r); gr.addColorStop(0, 'rgba(' + base + ',0.85)'); gr.addColorStop(1, 'rgba(' + base + ',0)');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      }
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return (decTex[kind] = t);
  }
  FX.decal = function (x, y, kind, size) {
    if (!decals) return;
    const s = (size || 1) * (kind === 'scorch' ? 1.6 : 0.9) * T;
    const k = kind === 'scorch' ? 'scorch' : kind;
    const mt = decMat[k] || (decMat[k] = R3.fogify(new THREE.MeshStandardMaterial({ map: decalTex(k), transparent: true, depthWrite: false, roughness: kind === 'scorch' ? 1 : 0.35, polygonOffset: true, polygonOffsetFactor: -2 })));
    const m = new THREE.Mesh(decalGeo, mt);
    m.scale.set(s, s, 1);
    m.rotation.x = -Math.PI / 2; m.rotation.z = Math.random() * 6.28;
    m.position.set((x + 0.5) * T, R3.hAt(Math.round(x), Math.round(y)) + 0.012, (y + 0.5) * T);
    m.receiveShadow = true; m.renderOrder = 2;
    decals.add(m);
    if (decals.children.length > 120) decals.remove(decals.children[0]);
  };

  /* ---------- Кадр ---------- */
  const dummy = new THREE.Object3D();
  FX.update = function (dt) {
    if (!group) return;
    const t = now();
    // свет вспышки гаснет
    if (light.intensity > 0) { if (t > lightT) light.intensity *= Math.exp(-dt * 18); if (light.intensity < 0.05) light.intensity = 0; }
    // снаряды
    for (let i = projs.length - 1; i >= 0; i--) {
      const p = projs[i], k = (t - p.t0) / p.dur;
      if (k >= 1) { projs.splice(i, 1); if (p.kind === 'spit') { puff(p.b, 10, { sp: 1.5, up: 0.6, upr: 0.8, g: 5, drag: 0.6, floor: p.b.y - 1, life: 700, s0: 0.05, s1: 0.04, a: 1, c: '#a8e03a' }); } continue; }
      if (k < 0) continue;
      const pos = p.a.clone().lerp(p.b, k); pos.y += Math.sin(k * Math.PI) * p.arc;
      if (p.kind === 'rocket') { glow.add({ p: pos.clone(), t0: t, life: 90, s0: 0.18, s1: 0.1, a: 1, c: col('#ffc060') }); smoke.add({ p: pos.clone(), v: V(0, 0.3, 0), drag: 1, t0: t, life: 700, s0: 0.12, s1: 0.5, a: 0.35, c: col('#c8c4bc') }); }
      else if (p.kind === 'spit') glow.add({ p: pos, t0: t, life: 60, s0: 0.1, s1: 0.08, a: 1, c: col('#a8e03a') });
      else smoke.add({ p: pos, t0: t, life: 40, s0: 0.07, s1: 0.07, a: 1, c: col('#4a5530') });
    }
    // гильзы
    let n = 0;
    for (let i = casL.length - 1; i >= 0; i--) { if (t - casL[i].t0 > casL[i].life) { lay(casL[i]); casL.splice(i, 1); } }
    casL.forEach(function (c) {
      c.p.addScaledVector(c.v, dt); c.v.y -= 9.8 * dt;
      if (c.p.y < c.floor) { c.p.y = c.floor; if (!c.tk && c.v.y < -1.2) { c.tk = true; if (DW.SFX.tink) DW.SFX.tink(false); } c.v.y = -c.v.y * 0.3; c.v.x *= 0.5; c.v.z *= 0.5; c.r.multiplyScalar(0.5); }
      c.e.x += c.r.x * dt; c.e.y += c.r.y * dt; c.e.z += c.r.z * dt; dummy.position.copy(c.p); dummy.rotation.copy(c.e);
      dummy.updateMatrix(); cas.setMatrixAt(n++, dummy.matrix);
    });
    cas.count = n; cas.instanceMatrix.needsUpdate = true;
    smoke.draw(t, dt); glow.draw(t, dt);
  };
  /* гильза отлетала — остаётся лежать на земле до конца боя (последние 160) */
  function lay(c) {
    if (!spent) return;
    dummy.position.set(c.p.x, c.floor + 0.008, c.p.z); dummy.rotation.set(0, c.e.y, 0); dummy.updateMatrix();
    spent.setMatrixAt(spentN % SPENT_MAX, dummy.matrix);
    spentN++; spent.count = Math.min(SPENT_MAX, spentN);
    spent.instanceMatrix.needsUpdate = true;
  }
  FX.busy = function () { return projs.length > 0 || (glow && glow.list.length > 0) || light.intensity > 0.05; };
})(window.DW);
