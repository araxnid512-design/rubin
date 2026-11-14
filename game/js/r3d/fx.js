'use strict';
/* 3D-бой: эффекты. Частицы — плоскости к камере в двух сетках на всё поле (дым/пыль/кровь — обычное смешение,
   вспышки/искры/трассеры — сложение света); вспышка дула освещает всё вокруг (один общий точечный свет);
   гильзы — латунные бруски (дробь — красные гильзы) с отскоком от грунта, ложатся и лежат до конца боя;
   взрыв — вспышка, огненный шар, дым, обломки, пятно копоти; граната и ракета летят по дуге в 3D (у РПГ — струя
   назад); пятна крови и копоти — на земле, лужа крови под телом растекается.
   Выстрел — очередь по тому же расписанию, что звук и 2D-вспышки (TR2.shotFx: через pre мс, каждые gap мс), но по
   часам боя (замедление — медленнее, остановленные часы — стоп-кадр): на каждый выстрел — вспышка дула с мерцанием
   света, дымок, гильза вправо из окна выброса, трассер, а когда пуля долетит — попадание: кровь по цели или
   пыль/крошка/искры там, где пуля ударилась (земля, укрытие, стена — по лучу). Гильзы и следы — с ограничением
   по уровню графики (телефоны). */
(function (DW) {
  const R3 = DW.R3, THREE = R3.THREE, U = DW.U, D = DW.D;
  if (!THREE) return;
  const T = R3.T, LV = R3.LV;
  const FX = R3.fx = {};
  const V = function (x, y, z) { return new THREE.Vector3(x || 0, y || 0, z || 0); };
  const now = function () { return DW.TR2 ? DW.TR2.now() : performance.now(); };
  const q = function () { return R3.q ? R3.q() : 2; };

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
  /* ---------- Сетка плоскостей к камере ----------
     частица: p — место, v — скорость (g — тяжесть, drag — торможение, floor — отскок от земли), t0/life — время,
     s0→s1 — размер, a — яркость, c — цвет; p2 — полоса от p до p2: m 'trc' — трассер (голова летит за fly мс,
     хвост len м), m 'st' — неподвижная полоса (язык пламени), без m — бегущий отрезок (как раньше) */
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
  const cR = V(), cU = V(), tmp = V(), tmp2 = V(), cD = V(), cS = V(), cC = V();
  Cloud.prototype.draw = function (t, dt) {
    const cam = R3.camera;
    cR.setFromMatrixColumn(cam.matrixWorld, 0); cU.setFromMatrixColumn(cam.matrixWorld, 1);
    let n = 0;
    const L = this.list, P = this.pos, C = this.col;
    for (let i = L.length - 1; i >= 0; i--) if ((t - L[i].t0) / L[i].life >= 1) L.splice(i, 1);
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
      let al = p.a * a * (p.hold ? (k < p.hold ? 1 : (1 - k) / (1 - p.hold)) : (1 - k));
      const sz = p.s0 + (p.s1 - p.s0) * k;
      const o = n * 12;
      if (p.p2) {
        let A, Bp;
        if (p.m === 'trc') {
          // трассер: голова летит от дула до точки удара за fly мс, хвост — len м; долетел — гаснет
          const ms = t - p.t0, d = p.p.distanceTo(p.p2) || 1;
          const h = Math.min(1, ms / p.fly), tl = Math.max(0, h - p.len / d);
          A = tmp.copy(p.p).lerp(p.p2, tl); Bp = tmp2.copy(p.p).lerp(p.p2, h);
          al = p.a * (ms < p.fly ? 1 : Math.max(0, 1 - (ms - p.fly) / Math.max(1, p.life - p.fly)));
        } else if (p.m === 'st') { A = p.p; Bp = p.p2; }
        else {
          const a0 = U.clamp(k * 1.6 - 0.6, 0, 1), a1 = U.clamp(k * 1.6, 0, 1);
          A = tmp.copy(p.p).lerp(p.p2, a0); Bp = tmp2.copy(p.p).lerp(p.p2, a1);
        }
        cD.subVectors(Bp, A);
        cS.crossVectors(cD, cC.subVectors(cam.position, A)).normalize().multiplyScalar(sz);
        P[o] = A.x - cS.x; P[o + 1] = A.y - cS.y; P[o + 2] = A.z - cS.z;
        P[o + 3] = A.x + cS.x; P[o + 4] = A.y + cS.y; P[o + 5] = A.z + cS.z;
        P[o + 6] = Bp.x + cS.x; P[o + 7] = Bp.y + cS.y; P[o + 8] = Bp.z + cS.z;
        P[o + 9] = Bp.x - cS.x; P[o + 10] = Bp.y - cS.y; P[o + 11] = Bp.z - cS.z;
      } else {
        const rx = cR.x * sz, ry = cR.y * sz, rz = cR.z * sz, ux = cU.x * sz, uy = cU.y * sz, uz = cU.z * sz;
        const x = p.p.x, y = p.p.y, z = p.p.z;
        P[o] = x - rx - ux; P[o + 1] = y - ry - uy; P[o + 2] = z - rz - uz;
        P[o + 3] = x + rx - ux; P[o + 4] = y + ry - uy; P[o + 5] = z + rz - uz;
        P[o + 6] = x + rx + ux; P[o + 7] = y + ry + uy; P[o + 8] = z + rz + uz;
        P[o + 9] = x - rx + ux; P[o + 10] = y - ry + uy; P[o + 11] = z - rz + uz;
      }
      const c = p.c, oc = n * 16;
      for (let v = 0; v < 4; v++) { C[oc + v * 4] = c.r; C[oc + v * 4 + 1] = c.g; C[oc + v * 4 + 2] = c.b; C[oc + v * 4 + 3] = al; }
      n++;
    }
    this.geo.setDrawRange(0, n * 6);
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.color.needsUpdate = true;
  };
  let TEX = null, smoke = null, glow = null, light = null, lightT = 0, lightI = 0, cas = null, casL = [], projs = [], decals = null, group = null;
  let spent = null, spentN = 0;   // стреляные гильзы, оставшиеся на земле (до конца боя, по кругу)
  let marks = null, markN = 0;    // следы пуль на земле
  let pools = null, poolL = [];   // лужи крови под телами (растекаются)
  let rounds = [], hits = [], tPrev = 0;
  const SPENT_MAX = 160, MARK_MAX = 60, POOL_MAX = 40;
  const CAS_FLY = [14, 40, 80], CAS_LIE = [30, 90, 160];
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
    // гильзы: цвет — на гильзу (латунь, у дроби — красный пластик)
    const cg = new THREE.BoxGeometry(0.016, 0.016, 0.046);
    cas = new THREE.InstancedMesh(cg, new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.85, roughness: 0.32 }), 80);
    cas.setColorAt(0, col('#d8a840')); cas.count = 0; cas.frustumCulled = false; group.add(cas);
    spent = new THREE.InstancedMesh(cg, R3.fogify(new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.8, roughness: 0.42 })), SPENT_MAX);
    spent.setColorAt(0, col('#c89a40')); spent.count = 0; spentN = 0; spent.frustumCulled = false; group.add(spent);
    // следы пуль на земле и лужи крови — по одной сетке-экземплярам (по одному вызову отрисовки)
    marks = new THREE.InstancedMesh(decalGeo, R3.fogify(new THREE.MeshStandardMaterial({ map: decalTex('hole1'), transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 })), MARK_MAX);
    marks.count = 0; markN = 0; marks.frustumCulled = false; marks.renderOrder = 2; marks.receiveShadow = true; group.add(marks);
    pools = new THREE.InstancedMesh(decalGeo, R3.fogify(new THREE.MeshStandardMaterial({ map: decalTex('pool'), transparent: true, depthWrite: false, roughness: 0.25, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -3 })), POOL_MAX);
    pools.setColorAt(0, col('#ffffff')); pools.count = 0; pools.frustumCulled = false; pools.renderOrder = 3; pools.receiveShadow = true; group.add(pools);
    casL = []; projs = []; rounds = []; hits = []; poolL = []; tPrev = now();
    decals = new THREE.Group(); group.add(decals);
    (B.decals || []).forEach(function (d) { FX.decal(d.x, d.y, d.k, d.s, true); });
  };
  const COL = {};
  const col = function (s) { return COL[s] || (COL[s] = new THREE.Color(s)); };
  function puff(p, n, o) {
    for (let i = 0; i < n; i++) {
      const v = V((Math.random() - 0.5) * o.sp, (o.up || 0) + Math.random() * (o.upr || 0), (Math.random() - 0.5) * o.sp);
      if (o.dir) v.addScaledVector(o.dir, (o.dv || 0) * (0.6 + Math.random() * 0.8));
      (o.add ? glow : smoke).add({ p: p.clone().add(V((Math.random() - 0.5) * (o.r || 0), 0, (Math.random() - 0.5) * (o.r || 0))), v: v, g: o.g || 0, drag: o.drag || 0.5, floor: o.floor,
        t0: (o.t0 !== undefined ? o.t0 : now()) + (o.delay || 0) + Math.random() * (o.jit || 0), life: o.life * (0.7 + Math.random() * 0.6), s0: o.s0, s1: o.s1, a: o.a, c: col(o.c), fadeIn: o.fadeIn, hold: o.hold });
    }
  }
  FX.puff = puff;
  /* вспышка с освещением округи */
  function flashAt(p, r, life, c, t0) {
    const tt = t0 !== undefined ? t0 : now();
    glow.add({ p: p.clone(), t0: tt, life: life, s0: r, s1: r * 1.4, a: 1, c: col(c || '#ffd890') });
    // высокая графика: широкий мягкий ореол вокруг вспышки (та же сетка частиц — без лишних проходов)
    if (q() >= 2) glow.add({ p: p.clone(), t0: tt, life: life * 1.6, s0: r * 3.2, s1: r * 4, a: 0.22, c: col(c || '#ffd890') });
    light.position.copy(p); light.intensity = Math.max(light.intensity, 6 * r); light.distance = 6 + r * 8; lightT = tt + life;
  }
  FX.flash = flashAt;
  /* время полёта пули на глаз (мс): трассер долетает, тогда — попадание и вздрагивание цели (units.js) */
  FX.flyMs = function (dist) { return U.clamp(dist / 0.16, 25, 70); };

  /* ---------- Выстрел: очередь по расписанию 2D (TR2.shotFx), но по часам боя ---------- */
  FX.shot = function (att, tgt, hit, W, show, suppress, opt) {
    const tr = DW.TR2, s = (DW.settings && DW.settings.speed) || 1;
    const FW = tr.FXof ? tr.FXof(W) : {};
    const cnt = FW.n || ({ rifle: 3, lmg: 5, shotgun: 1, sniper: 1, spit: 1, beam: 1 }[W.snd] || 1);
    const gap = (FW.gap || (W.snd === 'lmg' ? 70 : 90)) / s;
    const pre = W.snd === 'spit' ? 300 / s : 220 / s;
    // какие пули попадают — то же, что видит units.js (TR3.shotFx: att._burst.hits); иначе — все при попадании
    const t0 = now() + pre, b = att._burst && Math.abs(att._burst.t0 - t0) < 2 ? att._burst : null;
    const cover = opt && opt.coverTile;
    for (let i = 0; i < cnt; i++) {
      rounds.push({ t: t0 + i * gap, i: i, n: cnt, att: att, tgt: tgt, W: W, FW: FW, hit: b && b.hits ? !!b.hits[i] : (!!hit && !suppress), burstHit: !!hit, sup: !!suppress, cover: cover, fly: b ? b.fly : 0, last: i === cnt - 1, s: s });
    }
  };
  const _m = V(), _md = V(), _e = V(), _dir = V(), _side = V(), _up = V(), _ep = V();
  function fireRound(r) {
    const att = r.att, tgt = r.tgt, W = r.W, FW = r.FW, tr = DW.TR2;
    const m = R3.units.muzzle(att) || R3.units.anchor(att, false).add(V(0, 1.3, 0));
    _m.copy(m);
    const tA = R3.units.anchor(tgt, false).add(V(0, (tgt.type === 'queen' ? 1.4 : 1.05) * (tr.unitScale(tgt) / 1.13), 0));
    const e = _e.copy(tA);
    let land = null;
    if (r.cover && !r.sup) {
      // промах в укрытие: пуля бьёт в его лицевую сторону (к стрелку)
      const cx = (r.cover[0] + 0.5) * T, cz = (r.cover[1] + 0.5) * T;
      _dir.set(cx - _m.x, 0, cz - _m.z).normalize();
      e.set(cx - _dir.x * 0.42 + (Math.random() - 0.5) * 0.5, R3.hAt(r.cover[0], r.cover[1]) + 0.25 + Math.random() * 0.6, cz - _dir.z * 0.42 + (Math.random() - 0.5) * 0.5);
      land = { p: e.clone(), mat: objMat(DW.BT.get(), r.cover[0], r.cover[1]) || 'stone' };
    } else if (!r.hit) {
      // мимо: рядом с целью (у очереди — ближе) и дальше по лучу — до земли, укрытия или стены
      const a = Math.random() * Math.PI * 2, d = (r.burstHit ? 0.35 + Math.random() * 0.45 : 0.6 + Math.random() * 0.9) * (FW.spread || 1);
      e.add(_dir.set(Math.cos(a) * d, (Math.random() - 0.35) * 0.9, Math.sin(a) * d));
    } else e.add(_dir.set((Math.random() - 0.5) * 0.22, (Math.random() - 0.5) * 0.35, (Math.random() - 0.5) * 0.22));
    if (W.snd === 'spit') { projs.push({ a: _m.clone(), b: e.clone(), t0: r.t, dur: 280, arc: 0.6, kind: 'spit' }); return; }
    const dirv = _dir.subVectors(e, _m).normalize();
    if (!r.hit && !land) land = rayLand(_m, dirv, _m.distanceTo(e) + 7);
    const endP = r.hit ? e.clone() : (land ? land.p : e.clone().addScaledVector(dirv, 6));
    const dist = _m.distanceTo(endP);
    const fly = r.hit && r.fly ? r.fly : FX.flyMs(dist) / r.s;
    const md = R3.units.muzzleDir ? (R3.units.muzzleDir(att, _md) || _md.copy(dirv)) : _md.copy(dirv);
    // трассер: светящаяся полоса летит от дула (по одному на выстрел)
    const tc = col(FW.tr || (W.snd === 'beam' ? '#6fd8ff' : '#ffe08a'));
    const tw = 0.011 * (FW.w || 2);
    glow.add({ p: _m.clone(), p2: endP.clone(), m: 'trc', fly: fly, len: Math.min(2.4, dist * 0.45), t0: r.t, life: fly + 45, s0: tw, s1: tw, a: 1, c: tc });
    if (W.snd === 'shotgun') for (let k = 0; k < 6; k++) {
      const pe = endP.clone().add(V((Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.8));
      glow.add({ p: _m.clone(), p2: pe, m: 'trc', fly: fly, len: Math.min(1.2, dist * 0.3), t0: r.t, life: fly + 35, s0: 0.008, s1: 0.008, a: 0.75, c: tc });
    }
    muzzleFlash(_m, md, FW, W, r);
    // гильза: из окна выброса вправо-вверх (у дробовика — на помпе, у обреза и РПГ — нет)
    if (W.snd !== 'beam' && W.id !== 'obrez' && FW.eject !== 0) eject(att, md, FW, W, r);
    // попадание — когда пуля долетит
    hits.push({ t: r.t + fly, p: endP, dir: dirv.clone(), hit: r.hit, u: tgt, mat: land ? land.mat : null, n: land ? land.n : null, ground: land ? land.ground : false, big: W.snd === 'shotgun' || W.snd === 'sniper' });
  }
  /* вспышка дула по виду ствола: ядро, язык вперёд, лепестки вбок (АК — «звезда», снайперка — тормоз, дробь — шар),
     свет вокруг мерцает от выстрела к выстрелу */
  const _px = V(), _py = V();
  function muzzleFlash(m, md, FW, W, r) {
    const fr = (FW.flash || 14) / 60, life = FW.flife || 70, kind = FW.fk || 'std', t0 = r.t;
    const jit = 0.8 + Math.random() * 0.45;
    glow.add({ p: m.clone(), t0: t0, life: life, s0: fr * 0.75 * jit, s1: fr * 0.45, a: 1, c: col('#fff2c8') });
    if (q() >= 1) glow.add({ p: m.clone(), t0: t0, life: life * 1.5, s0: fr * 2.4, s1: fr * 3, a: 0.18, c: col('#ffb860') });
    // язык пламени вперёд
    const fl = fr * ({ smg: 1.6, std: 2.2, wide: 1.7, long: 2.8 }[kind] || 2) * jit;
    glow.add({ p: m.clone(), p2: m.clone().addScaledVector(md, fl), m: 'st', t0: t0, life: life * 0.8, s0: fr * (kind === 'wide' ? 0.62 : 0.36), s1: fr * 0.2, a: 0.95, c: col('#ffc870') });
    // лепестки вбок
    _px.crossVectors(md, UPV); if (_px.lengthSq() < 1e-4) _px.set(1, 0, 0); _px.normalize(); _py.crossVectors(_px, md).normalize();
    const np = kind === 'long' ? 2 : (kind === 'smg' ? 3 : (kind === 'wide' ? 5 : 4));
    const rot = Math.random() * Math.PI;
    for (let k = 0; k < np && q() >= 1; k++) {
      const a = rot + k / np * Math.PI * 2, ox = Math.cos(a), oy = Math.sin(a);
      const L = fr * (kind === 'long' ? 1.5 : 0.9) * (0.7 + Math.random() * 0.5);
      const base = m.clone().addScaledVector(md, fr * (kind === 'long' ? 0.5 : 0.25));
      const tip = base.clone().addScaledVector(_px, ox * L).addScaledVector(_py, oy * L).addScaledVector(md, L * 0.35);
      glow.add({ p: base, p2: tip, m: 'st', t0: t0, life: life * 0.6, s0: fr * 0.16, s1: fr * 0.08, a: 0.85, c: col('#ffd890') });
    }
    // свет: мерцает — каждый выстрел своей силы
    light.position.copy(m).addScaledVector(md, 0.15);
    light.intensity = Math.max(light.intensity, (5 + Math.random() * 4) * fr * (kind === 'wide' ? 1.4 : 1));
    light.distance = 5 + fr * 9; lightT = t0 + life * 0.6; lightI = light.intensity;
    // дымок у дула: вперёд и вверх (на последнем выстреле очереди — гуще)
    const ns = Math.max(1, Math.round((FW.smoke || 4) / 3)) + (r.last ? Math.round((FW.smoke || 4) / 2) : 0);
    puff(m, q() === 0 ? 1 : ns, { t0: t0, dir: md, dv: 0.55, sp: 0.18, up: 0.18, upr: 0.18, drag: 1.6, life: r.last ? 1500 : 900, s0: 0.07, s1: r.last ? 0.5 : 0.32, a: 0.2, c: '#d6cfc4', fadeIn: 0.12 });
    if (FW.ring && r.last && q() >= 1) for (let k = 0; k < 8; k++) {
      const a = k / 8 * Math.PI * 2, v = V().addScaledVector(_px, Math.cos(a) * 0.9).addScaledVector(_py, Math.sin(a) * 0.9).addScaledVector(md, 0.6);
      smoke.add({ p: m.clone().addScaledVector(md, 0.1), v: v, drag: 2.4, t0: t0, life: 900, s0: 0.06, s1: 0.18, a: 0.25, c: col('#ddd6cc') });
    }
  }
  const UPV = V(0, 1, 0);
  /* гильза: окно выброса (units.ejectPort) — вправо и вверх от ствола, вращение; дробовик — на помпе */
  function eject(att, md, FW, W, r) {
    const sh = W.snd === 'shotgun';
    const p = R3.units.ejectPort ? R3.units.ejectPort(att, _ep) : null;
    const from = p ? p.clone() : _m.clone().addScaledVector(md, -0.4);
    const right = _side.crossVectors(md, UPV); if (right.lengthSq() < 1e-4) right.set(1, 0, 0); right.normalize();
    const ej = FW.eject === undefined ? 1 : FW.eject;
    const v = right.clone().multiplyScalar((1.6 + Math.random() * 1.1) * ej).addScaledVector(UPV, 1.4 + Math.random() * 1.0).addScaledVector(md, -0.4 + Math.random() * 0.3);
    const c = { p: from, v: v, r: V((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30), e: new THREE.Euler(Math.random() * 3, Math.random() * 3, 0), t0: r.t + (sh ? 330 / r.s : 0), life: 2600, tk: false,
      col: col(FW.cas || (sh ? '#b8302a' : '#d8a840')), s: (FW.casS || 2.4) / 2.4, n: 0, rest: false };
    casL.push(c);
    const cap = CAS_FLY[q()];
    if (casL.length > cap) lay(casL.shift());
  }
  /* куда ударилась пуля: луч от дула — до грунта, предмета на клетке или стены (шагами по 0,2 м) */
  const OMAT = { 23: 'metal', 21: 'wood', 22: 'wood', 7: 'metal', 9: 'metal', 11: 'metal', 12: 'metal', 15: 'metal', 18: 'metal', 4: 'wood', 5: 'wood', 10: 'cloth', 13: 'wood', 19: 'wood', 1: 'stone', 2: 'stone', 3: 'stone', 8: 'stone', 14: 'stone', 17: 'wood', 6: 'sand', 16: 'flesh', 20: 'stone' };
  const GMAT = { 3: 'stone', 4: 'metal', 6: 'flesh', 7: 'acid', 8: 'stone', 9: 'wood', 11: 'wood', 12: 'stone' };
  function objMat(B, x, y) { const o = B && B.obj[y * B.w + x]; return o ? (OMAT[o] || 'stone') : null; }
  // высота предмета на клетке (м над её грунтом): стены — в рост, укрытия — по пояс
  function objH(o) { const O = D.OBJ[o]; if (!O) return 0; return O.cover === 2 ? (O.lift > 1 ? 2.5 : 1.3) : 0.75; }
  const _rl = V();
  function rayLand(m, dir, maxD) {
    const B = DW.BT.get();
    if (!B) return null;
    const gy = R3.units.groundY || function (X, Z) { return R3.hAt(X / T - 0.5, Z / T - 0.5); };
    for (let s = 0.4; s < maxD; s += 0.2) {
      _rl.copy(m).addScaledVector(dir, s);
      const x = Math.floor(_rl.x / T), y = Math.floor(_rl.z / T);
      if (x < 0 || y < 0 || x >= B.w || y >= B.h) return null;
      const i = y * B.w + x, g = gy(_rl.x, _rl.z);
      const o = B.obj[i];
      if (o && _rl.y < g + objH(o) && s > 1.2) return { p: _rl.clone().addScaledVector(dir, -0.1), mat: OMAT[o] || 'stone', ground: false };
      if (_rl.y <= g) {
        // точнее: назад до поверхности
        const dy = dir.y < -1e-3 ? (g - _rl.y) / -dir.y : 0;
        const p = _rl.clone().addScaledVector(dir, -Math.min(0.2, dy));
        p.y = Math.max(p.y, g + 0.01);
        return { p: p, mat: GMAT[B.ground[i]] || 'dirt', ground: true };
      }
    }
    return null;
  }
  /* удар пули: брызги по материалу — земля (пыль и комья), камень (крошка, пыль, искра), металл (искры), дерево (щепа),
     мешки (песок), кислота (всплеск); на земле остаётся след */
  function impactAt(p, mat, opt) {
    const t0 = opt && opt.t0 !== undefined ? opt.t0 : now(), big = opt && opt.big;
    const gy = R3.units.groundY ? R3.units.groundY(p.x, p.z) : R3.hAt(p.x / T - 0.5, p.z / T - 0.5);
    const floorY = Math.min(p.y, gy + 0.02);
    const k = big ? 1.5 : 1, lo = q() === 0;
    const c = { dirt: '#7a6048', sand: '#a89068', stone: '#9a948a', wood: '#9a6a3a', metal: '#ffe6a0', flesh: '#5a1a14', acid: '#8ab030', cloth: '#6d6a48' }[mat] || '#8a8070';
    // комья / крошка / щепа — с тяжестью
    puff(p, Math.round((lo ? 3 : 6) * k), { t0: t0, sp: 1.6, up: 1.3, upr: 1.4, g: 7, drag: 0.6, floor: floorY, life: 650, s0: mat === 'wood' ? 0.03 : 0.025, s1: 0.02, a: 0.95, c: mat === 'metal' ? '#5a5650' : c });
    // облачко пыли
    if (mat !== 'metal') puff(p, lo ? 1 : Math.round(3 * k), { t0: t0, sp: 0.4, up: 0.3, upr: 0.35, drag: 1.4, life: 1000, s0: 0.1, s1: 0.42 * k, a: mat === 'acid' ? 0.3 : 0.32, c: mat === 'dirt' || mat === 'sand' ? '#b8a586' : (mat === 'acid' ? '#9ac050' : '#b8b0a4'), fadeIn: 0.08 });
    // искры по металлу и камню
    if (mat === 'metal' || mat === 'stone') puff(p, mat === 'metal' ? Math.round(6 * k) : 2, { t0: t0, add: true, sp: 2.8, up: 1.4, upr: 1.4, g: 8, drag: 0.4, life: 240, s0: 0.022, s1: 0.008, a: 1, c: '#fff2b0' });
    if (mat === 'metal') glow.add({ p: p.clone(), t0: t0, life: 60, s0: 0.12, s1: 0.06, a: 0.9, c: col('#fff0c0') });
  }
  FX.impact = function (p, mat) { impactAt(p, mat); };
  /* попадание пули в бойца/мутанта: струя по ходу пули (навылет), брызги назад, облачко */
  function bloodHit(u, p, dir, t0, big) {
    // мутанты — своя кровь (r3d/mfx.js: тёмная, у Плевуна — кислота, у Стража — масло)
    const en = R3.units.ent ? R3.units.ent(u) : null;
    const k = en && en.kind === 'creature' && R3.mfx && R3.mfx.bloodKind ? R3.mfx.bloodKind(u) : (DW.TR2.bloodKind ? DW.TR2.bloodKind(u) : 'blood');
    const c = k === 'oil' ? '#2a2420' : (k === 'acid' ? '#6a8a28' : (k === 'mut' ? '#4a1208' : '#7a1610'));
    const fl = (R3.units.groundY ? R3.units.groundY(p.x, p.z) : R3.hAt(u.x, u.y)) + 0.02;
    const n = q() === 0 ? 3 : (big ? 9 : 6);
    puff(p, n, { t0: t0, dir: dir, dv: 2.4, sp: 0.9, up: 0.4, upr: 0.8, g: 8, drag: 0.6, floor: fl, life: 650, s0: 0.03, s1: 0.022, a: 0.95, c: c });
    puff(p, q() === 0 ? 0 : 2, { t0: t0, dir: dir, dv: -0.9, sp: 0.5, up: 0.3, upr: 0.5, g: 6, drag: 0.8, floor: fl, life: 450, s0: 0.025, s1: 0.02, a: 0.9, c: c });
    puff(p, 1, { t0: t0, dir: dir, dv: 0.5, sp: 0.2, up: 0.05, upr: 0.1, drag: 2.2, life: 520, s0: 0.08, s1: big ? 0.38 : 0.26, a: 0.42, c: k === 'oil' ? '#3a3430' : '#8a2a22', fadeIn: 0.05 });
    if (k === 'oil') puff(p, 5, { t0: t0, add: true, sp: 2.5, up: 1, upr: 1, g: 8, life: 220, s0: 0.03, s1: 0.01, a: 1, c: '#ffe6a0' });
  }
  /* попадание по бойцу (после очереди, с уроном): брызги — по направлению выстрела */
  FX.hit = function (u) {
    const p = R3.units.anchor(u, false).add(V(0, 1.1 * (DW.TR2.unitScale(u) / 1.13), 0));
    const sb = u._shotBy;
    let d = null;
    if (sb && sb.att && now() - sb.t0 < 4000) { d = V(u.x - sb.att.x, 0.1, u.y - sb.att.y); if (d.lengthSq() < 1e-4) d = null; else d.normalize(); }
    bloodHit(u, p, d || V(0, 0.4, 0), now(), true);
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
  /* тело упало на землю: пыль из-под него (str — сила: отброшенного — больше) */
  FX.bodyFall = function (p, str) {
    const n = q() === 0 ? 2 : Math.round(5 * (str || 1));
    puff(V(p.x, (R3.units.groundY ? R3.units.groundY(p.x, p.z) : p.y) + 0.05, p.z), n, { sp: 1.4 * (str || 1), up: 0.12, upr: 0.25, drag: 2.2, life: 1300, s0: 0.15, s1: 0.65, a: 0.3, c: '#ab9b80', fadeIn: 0.06, r: 0.5 });
  };
  /* граната / ракета / плевок по дуге; delay — старт позже (РПГ: вскинул на плечо), тогда же — струя назад */
  FX.projectile = function (x0, y0, x1, y1, kind, from, dur, delay) {
    // ракета — из трубы, граната — из руки бросающего (кто стоит в клетке x0, y0)
    const B = DW.BT.get();
    const thrower = from || (B && B.units.find(function (q2) { return q2.alive && q2.x === x0 && q2.y === y0; }));
    const b = V((x1 + 0.5) * T, R3.hAt(x1, y1) + 0.15, (y1 + 0.5) * T);
    const P = { a: null, b: b, t0: now() + (delay || 0), dur: dur, arc: kind === 'rocket' ? 0.35 : 2.4, kind: kind, thrower: thrower, x0: x0, y0: y0 };
    if (!delay) P.a = launchPt(P);
    projs.push(P);
  };
  function launchPt(P) {
    let a = null;
    if (P.thrower && P.kind === 'rocket') a = R3.units.muzzle(P.thrower);
    else if (P.thrower) a = R3.units.hand(P.thrower);
    return a || V((P.x0 + 0.5) * T, R3.hAt(P.x0, P.y0) + 1.4, (P.y0 + 0.5) * T);
  }
  /* РПГ: вспышка у дула, огненная струя и туча пыли назад из трубы, свет */
  const _bb = V(), _bd = V();
  function backblast(u, a, t0) {
    const rear = R3.units.gunRear ? R3.units.gunRear(u, _bb) : null;
    const md = R3.units.muzzleDir ? R3.units.muzzleDir(u, _bd) : null;
    flashAt(a, 0.45, 90, '#ffe2a0', t0);
    if (!rear || !md) return;
    const back = md.clone().negate();
    glow.add({ p: rear.clone(), p2: rear.clone().addScaledVector(back, 1.1), m: 'st', t0: t0, life: 110, s0: 0.22, s1: 0.1, a: 0.95, c: col('#ffb050') });
    flashAt(rear.clone().addScaledVector(back, 0.3), 0.6, 120, '#ffc070', t0);
    const fl = (R3.units.groundY ? R3.units.groundY(rear.x, rear.z) : 0) + 0.05;
    puff(rear, q() === 0 ? 5 : 12, { t0: t0, dir: back, dv: 4.5, sp: 1.2, up: 0.2, upr: 0.5, drag: 2.4, life: 1800, s0: 0.18, s1: 0.95, a: 0.4, c: '#c8bea8', fadeIn: 0.05 });
    puff(V(rear.x + back.x * 0.9, fl, rear.z + back.z * 0.9), q() === 0 ? 3 : 8, { t0: t0, dir: back, dv: 2.5, sp: 2.2, up: 0.3, upr: 0.5, drag: 1.8, life: 1600, s0: 0.2, s1: 0.8, a: 0.32, c: '#ab9b80', fadeIn: 0.05, r: 0.6 });
    R3.cam.shake = Math.max(R3.cam.shake, 3);
  }
  /* сбор груза у Портала */
  FX.cargo = function (x, y) {
    const p = V((x + 0.5) * T, R3.hAt(x, y) + 0.4, (y + 0.5) * T);
    flashAt(p, 1.2, 500, '#bfefff');
    puff(p, 18, { add: true, sp: 2, up: 1.5, upr: 1.5, drag: 1.5, life: 700, s0: 0.06, s1: 0.02, a: 1, c: '#bfefff' });
  };
  /* пятна на земле: кровь, копоть, следы пуль (материал — один на вид, плоскость — одна на все) */
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
    } else if (kind === 'hole' || kind === 'hole1') {
      // следы пуль: ямка с тёмной серединой и светлым выбросом (hole — россыпь, hole1 — один след)
      const n = kind === 'hole' ? 4 : 1;
      for (let i = 0; i < n; i++) {
        const x = n > 1 ? 30 + rnd() * 68 : 64, y = n > 1 ? 30 + rnd() * 68 : 64, r = n > 1 ? 9 : 26;
        const gr = g.createRadialGradient(x, y, 1, x, y, r * 1.6); gr.addColorStop(0, 'rgba(14,10,8,0.85)'); gr.addColorStop(0.35, 'rgba(40,32,24,0.55)'); gr.addColorStop(0.6, 'rgba(150,130,100,0.25)'); gr.addColorStop(1, 'rgba(150,130,100,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, r * 1.6, 0, 7); g.fill();
      }
    } else if (kind === 'pool') {
      // лужа: сплошная середина и неровный край (белая — цвет задаётся на экземпляр)
      for (let i = 0; i < 14; i++) {
        const a = rnd() * 6.28, d = i ? 12 + rnd() * 26 : 0, x = 64 + Math.cos(a) * d, y = 64 + Math.sin(a) * d, r = i ? 12 + rnd() * 16 : 34;
        const gr = g.createRadialGradient(x, y, 1, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      }
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
    const mt = decMat[k] || (decMat[k] = R3.fogify(new THREE.MeshStandardMaterial({ map: decalTex(k), transparent: true, depthWrite: false, roughness: kind === 'scorch' || kind === 'hole' ? 1 : 0.35, polygonOffset: true, polygonOffsetFactor: -2 })));
    const m = new THREE.Mesh(decalGeo, mt);
    m.scale.set(s, s, 1);
    m.rotation.x = -Math.PI / 2; m.rotation.z = Math.random() * 6.28;
    m.position.set((x + 0.5) * T, R3.hAt(Math.round(x), Math.round(y)) + 0.012, (y + 0.5) * T);
    m.receiveShadow = true; m.renderOrder = 2;
    decals.add(m);
    if (decals.children.length > 120) decals.remove(decals.children[0]);
  };
  /* лужа крови под телом: растекается несколько секунд (раненый — дольше и больше), потом — неподвижна */
  const POOLC = { blood: '#6a0c08', red: '#6a0c08', oil: '#1e1a16', acid: '#4a6a18' };
  FX.pool = function (x, y, z, kind, size, instant, slow) {
    if (!pools || q() === 0 && poolL.length >= 12) return;
    const i = poolL.length < POOL_MAX ? poolL.length : poolL.findIndex(function (p) { return p.done; });
    if (i < 0) return;
    const P = { i: i, x: x, y: y + 0.014 + i * 0.0004, z: z, s: (size || 0.7) * (slow ? 1.5 : 1.25), rot: Math.random() * 6.28, t0: now(), dur: slow ? 10000 : 4000, done: false, inst: !!instant };
    poolL[i] = P;
    pools.setColorAt(i, col(POOLC[kind] || POOLC.blood)); pools.instanceColor.needsUpdate = true;
    pools.count = Math.max(pools.count, i + 1);
    poolDraw(P, now());
  };
  function poolDraw(P, t) {
    const k = P.inst ? 1 : Math.min(1, (t - P.t0) / P.dur), e = 1 - Math.pow(1 - k, 2.6);
    const s = P.s * (0.3 + 0.7 * e);
    dummy.position.set(P.x, P.y, P.z); dummy.rotation.set(-Math.PI / 2, 0, P.rot); dummy.scale.set(s, s * 0.85, 1); dummy.updateMatrix();
    pools.setMatrixAt(P.i, dummy.matrix); pools.instanceMatrix.needsUpdate = true;
    dummy.scale.set(1, 1, 1);
    if (k >= 1) P.done = true;
  }
  /* след пули на земле */
  function markAt(p) {
    if (!marks || q() === 0) return;
    dummy.position.set(p.x, (R3.units.groundY ? R3.units.groundY(p.x, p.z) : p.y) + 0.013, p.z);
    dummy.rotation.set(-Math.PI / 2, 0, Math.random() * 6.28);
    const s = 0.16 + Math.random() * 0.08; dummy.scale.set(s, s, 1); dummy.updateMatrix(); dummy.scale.set(1, 1, 1);
    marks.setMatrixAt(markN % MARK_MAX, dummy.matrix);
    markN++; marks.count = Math.min(MARK_MAX, markN);
    marks.instanceMatrix.needsUpdate = true;
  }

  /* ---------- Кадр ---------- */
  const dummy = new THREE.Object3D();
  FX.update = function (dt) {
    if (!group) return;
    const t = now();
    // шаг по часам боя: в замедлении частицы и гильзы летят медленнее, при остановленных часах — стоят
    const dtB = Math.max(0, Math.min(0.05, (t - tPrev) / 1000)); tPrev = t;
    // выстрелы очередей и попадания пуль — в свой момент (по часам боя)
    if (rounds.length) {
      for (let i = 0; i < rounds.length; i++) { const r = rounds[i]; if (t >= r.t && !r.done) { r.done = true; try { fireRound(r); } catch (err) { console.warn('fx round', err); } } }
      rounds = rounds.filter(function (r) { return !r.done; });
    }
    if (hits.length) {
      for (let i = 0; i < hits.length; i++) {
        const h = hits[i];
        if (t < h.t || h.done) continue;
        h.done = true;
        if (h.hit) bloodHit(h.u, h.p, h.dir, h.t, h.big);
        else if (h.mat) { impactAt(h.p, h.mat, { t0: h.t, big: h.big }); if (h.ground && Math.random() < 0.6) markAt(h.p); }
      }
      hits = hits.filter(function (h) { return !h.done; });
    }
    // свет вспышки: мерцает и гаснет
    if (light.intensity > 0) {
      if (t > lightT) light.intensity *= Math.exp(-dtB * 22);
      else light.intensity = lightI * (0.75 + Math.random() * 0.35);
      if (light.intensity < 0.05) light.intensity = 0;
    }
    // снаряды
    for (let i = projs.length - 1; i >= 0; i--) {
      const p = projs[i], k = (t - p.t0) / p.dur;
      if (k >= 1) { projs.splice(i, 1); if (p.kind === 'spit') { puff(p.b, 10, { sp: 1.5, up: 0.6, upr: 0.8, g: 5, drag: 0.6, floor: p.b.y - 1, life: 700, s0: 0.05, s1: 0.04, a: 1, c: '#a8e03a' }); } continue; }
      if (k < 0) continue;
      if (!p.a) { p.a = launchPt(p); if (p.kind === 'rocket' && p.thrower) backblast(p.thrower, p.a, p.t0); }
      const pos = p.a.clone().lerp(p.b, k); pos.y += Math.sin(k * Math.PI) * p.arc;
      if (p.kind === 'rocket') { glow.add({ p: pos.clone(), t0: t, life: 90, s0: 0.18, s1: 0.1, a: 1, c: col('#ffc060') }); smoke.add({ p: pos.clone(), v: V(0, 0.3, 0), drag: 1, t0: t, life: 700, s0: 0.12, s1: 0.5, a: 0.35, c: col('#c8c4bc') }); }
      else if (p.kind === 'spit') glow.add({ p: pos, t0: t, life: 60, s0: 0.1, s1: 0.08, a: 1, c: col('#a8e03a') });
      else smoke.add({ p: pos, t0: t, life: 40, s0: 0.07, s1: 0.07, a: 1, c: col('#4a5530') });
    }
    // гильзы: полёт, отскок от грунта (не сквозь стену), легла — на землю до конца боя
    const B = DW.BT.get(), gy = R3.units.groundY;
    let n = 0;
    for (let i = casL.length - 1; i >= 0; i--) { const c = casL[i]; if (t - c.t0 > c.life || c.rest) { lay(c); casL.splice(i, 1); } }
    for (let i = 0; i < casL.length; i++) {
      const c = casL[i];
      if (t < c.t0) continue;
      const ox = c.p.x, oz = c.p.z;
      c.p.addScaledVector(c.v, dtB); c.v.y -= 9.8 * dtB;
      if (B) { const x = Math.floor(c.p.x / T), y = Math.floor(c.p.z / T); const o = x >= 0 && y >= 0 && x < B.w && y < B.h ? B.obj[y * B.w + x] : 0; if (o && D.OBJ[o] && D.OBJ[o].cover === 2) { c.p.x = ox; c.p.z = oz; c.v.x *= -0.3; c.v.z *= -0.3; } }
      c.floor = (gy ? gy(c.p.x, c.p.z) : R3.hAt(c.p.x / T - 0.5, c.p.z / T - 0.5)) + 0.009;
      if (c.p.y < c.floor) {
        c.p.y = c.floor;
        if (!c.tk && c.v.y < -1.2) { c.tk = true; if (DW.SFX.tink) DW.SFX.tink(c.s > 1.1); }
        c.v.y = -c.v.y * 0.32; c.v.x *= 0.5; c.v.z *= 0.5; c.r.multiplyScalar(0.45);
        if (++c.n > 3 || Math.abs(c.v.y) < 0.35) c.rest = true;
      }
      c.e.x += c.r.x * dtB; c.e.y += c.r.y * dtB; c.e.z += c.r.z * dtB; dummy.position.copy(c.p); dummy.rotation.copy(c.e);
      dummy.scale.setScalar(c.s); dummy.updateMatrix(); dummy.scale.set(1, 1, 1);
      cas.setMatrixAt(n, dummy.matrix); cas.setColorAt(n, c.col); n++;
    }
    cas.count = n; cas.instanceMatrix.needsUpdate = true; if (n && cas.instanceColor) cas.instanceColor.needsUpdate = true;
    // лужи растекаются
    for (let i = 0; i < poolL.length; i++) if (poolL[i] && !poolL[i].done) poolDraw(poolL[i], t);
    smoke.draw(t, dtB); glow.draw(t, dtB);
  };
  /* гильза отлетала — остаётся лежать на земле до конца боя (на слабой графике — меньше) */
  function lay(c) {
    if (!spent || t0ok(c)) return;
    const cap = Math.min(SPENT_MAX, CAS_LIE[q()]);
    dummy.position.set(c.p.x, (c.floor || c.p.y) - 0.001, c.p.z); dummy.rotation.set(0, c.e.y, Math.PI / 2 * (c.e.x > 1.5 ? 1 : 0)); dummy.scale.setScalar(c.s); dummy.updateMatrix(); dummy.scale.set(1, 1, 1);
    spent.setMatrixAt(spentN % cap, dummy.matrix); spent.setColorAt(spentN % cap, c.col);
    spentN++; spent.count = Math.min(cap, spentN);
    spent.instanceMatrix.needsUpdate = true; if (spent.instanceColor) spent.instanceColor.needsUpdate = true;
  }
  // гильза так и не вылетела (бой закончился раньше) — не класть
  function t0ok(c) { return now() < c.t0; }
  // для тестов: сколько луж, гильз в полёте и на земле, следов
  FX.stats = function () { return { pools: poolL.length, poolDone: poolL.filter(function (p) { return p && p.done; }).length, casFly: casL.length, casLie: spentN, marks: markN, rounds: rounds.length }; };
  FX.busy = function () { return rounds.length > 0 || hits.length > 0 || projs.length > 0 || (glow && glow.list.length > 0) || light.intensity > 0.05; };
})(window.DW);
