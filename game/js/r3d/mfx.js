'use strict';
/* 3D-бой: эффекты мутантов. Фирменные приёмы — прыжок Падальщика (когти и пыль на месте приземления), плевок
   Плевуна (сгусток кислоты по дуге, брызги, шипение, ожог на земле), удар Костолома оземь (пылевое кольцо, трещины,
   крошка, тряска), рык Вожака (пар/пыль из пасти конусом, тряска камеры), выводок Матки (мешки с яйцами лопаются
   на клетках). Брызги крови — по направлению попадания (у Плевуна — кислота, у Стража — масло с искрами), следы
   лап и когтей, пыль из-под ног, светящиеся глаза (ночью и под землёй ярче), мокрая блестящая кожа, капли кислоты.
   Частицы — две сетки плоскостей к камере (обычная и «световая»: глаза, кислота, искры), т. е. два вызова отрисовки
   на всё поле; следы на земле — по одной сетке-экземплярам на вид следа. Объём — по уровню графики R3.q().
   Позу и движения мутантов ведёт r3d/units.js; сюда — только картинка. Сигналы — те же, что у 2D: выстрел (fx.shot),
   попадание (fx.hit), пятна (fx.decal), взрыв (fx.explosion) — обёртки ниже; необязательные крючки для логики боя:
   MF.roar(u), MF.brood(queen, spots), MF.leap(u, tx, ty). */
(function (DW) {
  const R3 = DW.R3, THREE = R3 && R3.THREE;
  if (!THREE) return;
  const T = R3.T, LV = R3.LV, D = DW.D;
  const MF = R3.mfx = {};
  const V = function (x, y, z) { return new THREE.Vector3(x || 0, y || 0, z || 0); };
  const now = function () { return DW.TR2 ? DW.TR2.now() : performance.now(); };
  const spd = function () { return (DW.settings && DW.settings.speed) || 1; };
  const rnd = function (a, b) { return a + Math.random() * (b - a); };
  const COL = {};
  const col = function (s) { return COL[s] || (COL[s] = new THREE.Color(s)); };
  const q = function () { return R3.q ? R3.q() : 2; };

  /* высота земли под мировой точкой (на марше лестницы — середина подъёма, как у бойцов) */
  function groundAt(X, Z) {
    const B = DW.BT.get();
    if (!B || !B.hgt) return 0;
    const x = Math.max(0, Math.min(B.w - 1, Math.floor(X / T))), y = Math.max(0, Math.min(B.h - 1, Math.floor(Z / T)));
    return (DW.BT.visLevel ? DW.BT.visLevel(x, y) : B.hgt[y * B.w + x]) * LV;
  }
  MF.groundAt = groundAt;
  /* темно ли: ночью, в пещере и в помещении глаза и кислота светят сильнее */
  function darkK() {
    const B = DW.BT.get();
    if (!B) return 0.3;
    if (B.tod === 'night' || B.tod === 'cave' || B.tod === 'interior' || B.dark) return 1;
    if (B.tod === 'dusk' || B.tod === 'dawn') return 0.62;
    return 0.3;
  }
  MF.darkK = darkK;

  /* ---------- Текстуры (рисуются один раз) ---------- */
  function canvasTex(n, draw, srgb) {
    const c = document.createElement('canvas'); c.width = c.height = n;
    draw(c.getContext('2d'), n);
    const t = new THREE.CanvasTexture(c);
    if (srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  let TEX = null, RING = null;
  const DTEX = {};
  function softTex() {
    return canvasTex(64, function (g, n) {
      const gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, n, n);
    });
  }
  function ringTex() {
    return canvasTex(128, function (g, n) {
      const gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
      gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.05)'); gr.addColorStop(0.78, 'rgba(255,255,255,0.85)');
      gr.addColorStop(0.9, 'rgba(255,255,255,0.4)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, n, n);
    });
  }
  /* следы на земле: когти, отпечаток лапы Костолома, трещины, ожог кислоты, слизь из яиц */
  function decalTex(kind) {
    if (DTEX[kind]) return DTEX[kind];
    const R = function () { return Math.random(); };
    DTEX[kind] = canvasTex(128, function (g, n) {
      g.lineCap = 'round'; g.lineJoin = 'round';
      if (kind === 'claw') {
        // четыре изогнутые борозды: тёмное дно и светлый край вывороченной земли
        for (let i = 0; i < 4; i++) {
          const x0 = 34 + i * 18 + (R() - 0.5) * 4, bend = 8 + R() * 6;
          for (let pass = 0; pass < 2; pass++) {
            g.strokeStyle = pass ? 'rgba(24,17,11,0.85)' : 'rgba(176,156,124,0.45)';
            g.lineWidth = pass ? 4.5 - i * 0.3 : 7;
            g.beginPath(); g.moveTo(x0 + (pass ? 0 : 2), 18 + i * 3); g.quadraticCurveTo(x0 + bend, 64, x0 - 2 + (pass ? 0 : 2), 110 - i * 4); g.stroke();
          }
        }
      } else if (kind === 'print') {
        // пятка и три пальца — продавленная земля
        const blob = function (x, y, rx, ry, a) {
          g.save(); g.translate(x, y); g.scale(rx / ry, 1);
          const gr = g.createRadialGradient(0, 0, 1, 0, 0, ry); gr.addColorStop(0, 'rgba(22,16,10,' + a + ')'); gr.addColorStop(0.7, 'rgba(30,22,14,' + (a * 0.6) + ')'); gr.addColorStop(1, 'rgba(30,22,14,0)');
          g.fillStyle = gr; g.beginPath(); g.arc(0, 0, ry, 0, 7); g.fill(); g.restore();
        };
        blob(64, 84, 20, 26, 0.6);
        blob(42, 40, 9, 14, 0.62); blob(64, 30, 10, 15, 0.66); blob(86, 40, 9, 14, 0.62);
      } else if (kind === 'crack') {
        // вмятина и лучи трещин с ответвлениями
        const gr = g.createRadialGradient(64, 64, 2, 64, 64, 34); gr.addColorStop(0, 'rgba(12,9,6,0.75)'); gr.addColorStop(0.6, 'rgba(30,24,18,0.35)'); gr.addColorStop(1, 'rgba(30,24,18,0)');
        g.fillStyle = gr; g.fillRect(0, 0, n, n);
        const ray = function (x, y, a, len, w, depth) {
          g.strokeStyle = 'rgba(14,10,7,' + (0.95 - depth * 0.2) + ')'; g.lineWidth = w;
          g.beginPath(); g.moveTo(x, y);
          let px = x, py = y;
          const steps = 5 + (len / 10 | 0);
          for (let s = 0; s < steps; s++) {
            a += (R() - 0.5) * 0.7; const l = len / steps;
            px += Math.cos(a) * l; py += Math.sin(a) * l; g.lineTo(px, py);
            if (depth < 2 && R() < 0.22) { g.stroke(); ray(px, py, a + (R() < 0.5 ? 0.8 : -0.8), len * 0.45, Math.max(0.8, w * 0.6), depth + 1); g.strokeStyle = 'rgba(14,10,7,' + (0.95 - depth * 0.2) + ')'; g.lineWidth = w; g.beginPath(); g.moveTo(px, py); }
            w = Math.max(0.7, w * 0.86); g.lineWidth = w;
          }
          g.stroke();
        };
        const k = 7 + (R() * 3 | 0);
        for (let i = 0; i < k; i++) ray(64, 64, i / k * 6.283 + R() * 0.5, 34 + R() * 26, 3.2, 0);
      } else if (kind === 'acid') {
        // ожог: тёмное пятно с ядовито-зелёной каймой и пузырьками
        for (let i = 0; i < 7; i++) {
          const x = 64 + (R() - 0.5) * 46, y = 64 + (R() - 0.5) * 46, r = 12 + R() * 20;
          const gr = g.createRadialGradient(x, y, 1, x, y, r); gr.addColorStop(0, 'rgba(26,34,8,0.85)'); gr.addColorStop(0.65, 'rgba(70,110,18,0.55)'); gr.addColorStop(1, 'rgba(120,190,30,0)');
          g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
        }
        for (let i = 0; i < 16; i++) { g.fillStyle = 'rgba(170,240,60,' + (0.35 + R() * 0.4) + ')'; g.beginPath(); g.arc(64 + (R() - 0.5) * 70, 64 + (R() - 0.5) * 70, 1 + R() * 2.5, 0, 7); g.fill(); }
      } else {
        // слизь из лопнувших яиц
        for (let i = 0; i < 8; i++) {
          const x = 64 + (R() - 0.5) * 52, y = 64 + (R() - 0.5) * 52, r = 10 + R() * 22;
          const gr = g.createRadialGradient(x, y, 1, x, y, r); gr.addColorStop(0, 'rgba(160,168,70,0.8)'); gr.addColorStop(0.7, 'rgba(120,130,50,0.45)'); gr.addColorStop(1, 'rgba(110,120,40,0)');
          g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
        }
        for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(235,230,190,0.5)'; g.beginPath(); g.arc(64 + (R() - 0.5) * 50, 64 + (R() - 0.5) * 50, 2 + R() * 3, 0, 7); g.fill(); }
      }
    });
    return DTEX[kind];
  }

  /* ---------- Частицы: плоскости к камере; полоски — вдоль скорости (капли, крошка) ---------- */
  function Cloud(max, add) {
    this.max = max; this.list = [];
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 12); this.col = new Float32Array(max * 16);
    const uv = new Float32Array(max * 8), idx = new Uint16Array(max * 6);
    for (let i = 0; i < max; i++) { idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6); uv.set([0, 0, 1, 0, 1, 1, 0, 1], i * 8); }
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    this.geo = g;
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: TEX, vertexColors: true, transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, fog: !add, toneMapped: !add }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = add ? 21 : 16;
  }
  Cloud.prototype.add = function (p) { if (this.list.length >= this.max) this.list.shift(); this.list.push(p); return p; };
  const cR = V(), cU = V(), _pa = V(), _pb = V(), _pd = V(), _ps = V(), _pc = V();
  Cloud.prototype.quad = function (n, x, y, z, s, c, a) {
    const rx = cR.x * s, ry = cR.y * s, rz = cR.z * s, ux = cU.x * s, uy = cU.y * s, uz = cU.z * s, P = this.pos, o = n * 12;
    P[o] = x - rx - ux; P[o + 1] = y - ry - uy; P[o + 2] = z - rz - uz; P[o + 3] = x + rx - ux; P[o + 4] = y + ry - uy; P[o + 5] = z + rz - uz;
    P[o + 6] = x + rx + ux; P[o + 7] = y + ry + uy; P[o + 8] = z + rz + uz; P[o + 9] = x - rx + ux; P[o + 10] = y - ry + uy; P[o + 11] = z - rz + uz;
    this.tint(n, c, a);
  };
  Cloud.prototype.tint = function (n, c, a) { const C = this.col, o = n * 16; for (let v = 0; v < 4; v++) { C[o + v * 4] = c.r; C[o + v * 4 + 1] = c.g; C[o + v * 4 + 2] = c.b; C[o + v * 4 + 3] = a; } };
  /* extra — «постоянные» точки этого кадра (глаза): { p, s, c, a } */
  Cloud.prototype.draw = function (t, dt, extra) {
    const cam = R3.camera;
    cR.setFromMatrixColumn(cam.matrixWorld, 0); cU.setFromMatrixColumn(cam.matrixWorld, 1);
    let n = 0;
    if (extra) for (let i = 0; i < extra.length && n < this.max; i++) { const e = extra[i]; this.quad(n++, e.p.x, e.p.y, e.p.z, e.s, e.c, e.a); }
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) { const p = L[i]; if (p.dead || t - p.t0 >= p.life) L.splice(i, 1); }
    for (let i = 0; i < L.length && n < this.max; i++) {
      const p = L[i], k = (t - p.t0) / p.life;
      if (k < 0 || p.dead) continue;
      if (p.v) {
        p.p.addScaledVector(p.v, dt);
        p.v.y -= (p.g || 0) * dt;
        if (p.drag) p.v.multiplyScalar(Math.exp(-p.drag * dt));
        if (p.floor !== undefined && p.p.y < p.floor) {
          if (p.land) { p.dead = true; p.p.y = p.floor; p.land(p); continue; }
          p.p.y = p.floor; p.v.y = Math.abs(p.v.y) * 0.2; p.v.x *= 0.4; p.v.z *= 0.4;
        }
      }
      const a = (p.fadeIn && k < p.fadeIn ? k / p.fadeIn : 1) * p.a * (p.hold ? (k < p.hold ? 1 : (1 - k) / (1 - p.hold)) : (1 - k));
      const sz = p.s0 + (p.s1 - p.s0) * k;
      if (p.streak && p.v) {
        // капля/крошка — полоска вдоль скорости
        const sp = p.v.length();
        const len = Math.min(0.28, Math.max(sz * 1.5, sp * p.streak));
        _pd.copy(p.v).multiplyScalar(sp > 1e-4 ? 1 / sp : 0);
        _pa.copy(p.p); _pb.copy(p.p).addScaledVector(_pd, -len);
        _ps.crossVectors(_pd, _pc.subVectors(cam.position, _pa)).normalize().multiplyScalar(sz);
        const P = this.pos, o = n * 12;
        P[o] = _pa.x - _ps.x; P[o + 1] = _pa.y - _ps.y; P[o + 2] = _pa.z - _ps.z; P[o + 3] = _pa.x + _ps.x; P[o + 4] = _pa.y + _ps.y; P[o + 5] = _pa.z + _ps.z;
        P[o + 6] = _pb.x + _ps.x; P[o + 7] = _pb.y + _ps.y; P[o + 8] = _pb.z + _ps.z; P[o + 9] = _pb.x - _ps.x; P[o + 10] = _pb.y - _ps.y; P[o + 11] = _pb.z - _ps.z;
        this.tint(n, p.c, a);
      } else this.quad(n, p.p.x, p.p.y, p.p.z, sz, p.c, a);
      n++;
    }
    this.geo.setDrawRange(0, n * 6);
    this.mesh.visible = n > 0;
    if (n) { this.geo.attributes.position.needsUpdate = true; this.geo.attributes.color.needsUpdate = true; }
  };

  /* ---------- Следы на земле: сетка-экземпляры на вид, новые вытесняют старые ---------- */
  const DMAX = { claw: [0, 26, 48], print: [0, 24, 40], crack: [6, 8, 12], acid: [8, 16, 24], slime: [4, 8, 10] };
  function Decals(kind) {
    this.kind = kind; this.max = Math.max(1, DMAX[kind][q()]); this.n = 0;
    const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
    const glossy = kind === 'acid' || kind === 'slime';
    const mat = new THREE.MeshStandardMaterial({ map: decalTex(kind), transparent: true, depthWrite: false, roughness: glossy ? 0.22 : 1, metalness: 0, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    if (kind === 'acid') { mat.emissive = new THREE.Color(0x4f7a18); mat.emissiveMap = decalTex(kind); mat.emissiveIntensity = 0.5; }
    if (R3.fogify) R3.fogify(mat);
    this.mesh = new THREE.InstancedMesh(geo, mat, this.max);
    this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.receiveShadow = true; this.mesh.renderOrder = 3; this.mesh.visible = false;
  }
  const _dm = new THREE.Matrix4(), _dq = new THREE.Quaternion(), _dp = V(), _ds = V();
  Decals.prototype.add = function (X, Z, Y, yaw, sx, sz) {
    if (!this.max || DMAX[this.kind][q()] === 0) return;
    _dq.setFromAxisAngle(V(0, 1, 0), yaw); _dp.set(X, Y, Z); _ds.set(sx, 1, sz);
    this.mesh.setMatrixAt(this.n % this.max, _dm.compose(_dp, _dq, _ds));
    this.n++;
    this.mesh.count = Math.min(this.n, this.max);
    this.mesh.instanceMatrix.needsUpdate = true; this.mesh.visible = true;
  };
  function decal(kind, X, Z, yaw, sx, sz) {
    const d = DEC[kind]; if (!d) return;
    d.add(X, Z, groundAt(X, Z) + 0.014 + Object.keys(DEC).indexOf(kind) * 0.002, yaw, sx, sz || sx);
  }
  MF.decal = decal;

  /* ---------- Набор на бой ---------- */
  let grp = null, smoke = null, glow = null, DEC = {}, rings = [], blobs = [], sacs = [], Qt = [], eyesL = [], acidU = { value: 0.6 };
  MF.acidU = acidU;
  function later(ms, fn) { Qt.push({ t: now() + ms, fn: fn }); }
  MF.later = later;
  MF.init = function () {
    if (!TEX) { TEX = softTex(); RING = ringTex(); }
    if (grp) {
      // прошлый бой: сетки и материалы — в утиль (текстуры общие, остаются)
      if (grp.parent) grp.parent.remove(grp);
      grp.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    }
    grp = new THREE.Group(); grp.name = 'mfx';
    R3.scene.add(grp);
    const Q = q();
    smoke = new Cloud([160, 260, 380][Q], false); glow = new Cloud([110, 170, 240][Q], true);
    grp.add(smoke.mesh); grp.add(glow.mesh);
    DEC = {};
    ['claw', 'print', 'crack', 'acid', 'slime'].forEach(function (k) { DEC[k] = new Decals(k); grp.add(DEC[k].mesh); });
    rings = []; for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: RING, transparent: true, depthWrite: false, color: 0xb8a888, opacity: 0, polygonOffset: true, polygonOffsetFactor: -4 }));
      m.visible = false; m.renderOrder = 14; grp.add(m); rings.push({ m: m, t0: 0, life: 1 });
    }
    blobs = []; for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0x86d82a, emissive: 0x4c9c12, emissiveIntensity: 0.9, roughness: 0.12, metalness: 0.05 }));
      m.visible = false; grp.add(m); blobs.push({ m: m, on: false });
    }
    sacs = []; for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshStandardMaterial({ color: 0xcdb27a, emissive: 0x3a2808, emissiveIntensity: 0.6, roughness: 0.2, metalness: 0 }));
      m.visible = false; m.castShadow = Q >= 1; grp.add(m); sacs.push({ m: m, on: false });
    }
    Qt = []; MF.lastBlast = null; broodT = {};
  };

  /* ---------- Простые выбросы ---------- */
  function P(o) { return (o.add ? glow : smoke).add(o); }
  /* капли/крошка веером: dir — основное направление (может быть null), cone — разброс, up — подброс */
  function spray(p, n, o) {
    for (let i = 0; i < n; i++) {
      const v = V((Math.random() - 0.5) * 2 * o.cone, rnd(o.up0 || 0, o.up1 || 0), (Math.random() - 0.5) * 2 * o.cone);
      if (o.dir) v.addScaledVector(o.dir, rnd(o.s0 || 1, o.s1 || 2));
      P({ p: p.clone().add(V((Math.random() - 0.5) * (o.r || 0), (Math.random() - 0.5) * (o.r || 0) * 0.5, (Math.random() - 0.5) * (o.r || 0))), v: v, g: o.g === undefined ? 9 : o.g, drag: o.drag || 0.3,
        floor: o.floor, land: o.land, t0: now() + Math.random() * (o.jit || 0), life: o.life * rnd(0.7, 1.3), s0: o.sz, s1: o.sz * (o.shrink || 0.8), a: o.a || 1,
        c: col(o.cs ? o.cs[(Math.random() * o.cs.length) | 0] : o.c), streak: o.streak, add: !!o.add, fadeIn: o.fadeIn, hold: o.hold });
    }
  }
  /* клубы: медленно расползаются и тают */
  function puffs(p, n, o) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, r = o.r || 0;
      const v = V(Math.cos(a) * rnd(0.3, 1) * (o.sp || 0.4), rnd(o.up0 || 0.05, o.up1 || 0.3), Math.sin(a) * rnd(0.3, 1) * (o.sp || 0.4));
      if (o.dir) v.addScaledVector(o.dir, rnd(o.ds0 || 0, o.ds1 || 0));
      P({ p: p.clone().add(V(Math.cos(a) * r * Math.random(), 0, Math.sin(a) * r * Math.random())), v: v, g: o.g || 0, drag: o.drag || 1.5, t0: now() + Math.random() * (o.jit || 0), life: o.life * rnd(0.75, 1.25),
        s0: o.s0, s1: o.s1, a: o.a, c: col(o.c), fadeIn: o.fadeIn === undefined ? 0.12 : o.fadeIn, add: !!o.add });
    }
  }
  /* кольцо пыли по земле */
  function ring(X, Y, Z, r0, r1, life, a, c) {
    const R = rings.find(function (x) { return !x.m.visible; }) || rings.reduce(function (a2, b) { return a2.t0 < b.t0 ? a2 : b; });
    R.t0 = now(); R.life = life; R.r0 = r0; R.r1 = r1; R.a = a;
    R.m.material.color.set(c || 0xb8a888); R.m.position.set(X, Y + 0.03, Z); R.m.visible = true; R.m.scale.setScalar(r0 * 2);
  }
  function shake(v, u) {
    if (u && u.side === 'e' && !u.seen) return;
    R3.cam.shake = Math.max(R3.cam.shake || 0, v);
  }
  /* пыль по виду грунта под точкой */
  function dustCol(X, Z) {
    const B = DW.BT.get();
    if (!B) return '#a8987e';
    const i = Math.max(0, Math.min(B.h - 1, Math.floor(Z / T))) * B.w + Math.max(0, Math.min(B.w - 1, Math.floor(X / T)));
    const g = B.ground ? B.ground[i] : 0;
    return { 3: '#9c968c', 4: '#8a8a88', 5: '#7c7468', 6: '#7a5848', 8: '#a09888', 12: '#9c968c' }[g] || (B.tod === 'cave' ? '#7c7468' : '#a8987e');
  }

  /* ---------- Кровь: брызги по направлению удара ---------- */
  function bloodKind(u) {
    const TE = u && D.ENEMIES[u.type];
    if (TE && TE.mech) return 'oil';
    if (u && u.type === 'spitter') return 'acid';
    return 'mut';
  }
  MF.bloodKind = bloodKind;
  const BLOOD = {
    mut: { cs: ['#5a0e0a', '#6e1a10', '#4a1208', '#6a3a14'], mist: '#4a1410' },
    acid: { cs: ['#8fd630', '#a8e83a', '#6fb020'], mist: '#9ab870' },
    oil: { cs: ['#2a2420', '#1e1a16', '#3a3028'], mist: '#3a3430' }
  };
  /* откуда пришёл удар: стрелок (TR3.shotFx ставит att._aimAt), рывок к клетке, недавний взрыв → вектор xz от
     нападавшего к цели (в клетках = в мире) или null */
  MF.hitDir = function (u) {
    const B = DW.BT.get(), tr = DW.TR2;
    if (!B || !tr || !u) return null;
    const t = tr.now();
    let src = null;
    for (let i = 0; i < B.units.length && !src; i++) { const o = B.units[i]; if (o !== u && o._aimAt === u && t < (o._aimUntil || 0)) src = [o.x, o.y]; }
    for (let i = 0; i < B.units.length && !src; i++) { const o = B.units[i]; if (o === u) continue; const tw = tr.tweenOf(o.id); if (tw && tw.kind === 'lunge' && tw.tx === u.x && tw.ty === u.y) src = [tw.fx, tw.fy]; }
    if (!src && MF.lastBlast && t - MF.lastBlast.t < 900) src = [MF.lastBlast.x, MF.lastBlast.y];
    if (!src) return null;
    const dx = u.x - src[0], dz = u.y - src[1], l = Math.hypot(dx, dz);
    return l > 1e-3 ? { x: dx / l, z: dz / l } : null;
  };
  /* попадание по мутанту: струя навылет, мелкие брызги назад, облачко; кислота шипит, масло — с искрами */
  MF.splash = function (u) {
    const e = R3.units.ent(u);
    if (!e || !e.ready) return;
    const kd = bloodKind(u), BK = BLOOD[kd];
    const sc = e.body.holder.scale.x || 1, H = (e.ci ? e.ci.h : 1.5) * sc;
    const hd = MF.hitDir(u) || (e.hitD) || { x: -Math.cos(u.face || 0), z: -Math.sin(u.face || 0) };
    const dir = V(hd.x, 0.15, hd.z).normalize();
    const c = R3.units.anchor(u, false);
    const fl = c.y + 0.02;
    const p = c.clone().add(V(0, H * (e.rig && e.rig.biped ? 0.62 : 0.55), 0)).addScaledVector(dir, H * 0.08);
    const Q = q(), n = [7, 11, 16][Q];
    const land = Q >= 1 ? function (pp) { smoke.add({ p: pp.p.clone().setY(pp.floor + 0.02), t0: now(), life: 900, s0: 0.03, s1: 0.07, a: 0.8, c: pp.c }); } : null;
    spray(p, n, { dir: dir, s0: 1.4, s1: 3.6, cone: 0.9, up0: 0.4, up1: 2.0, g: 9.5, drag: 0.4, floor: fl, land: land, life: 900, sz: 0.034, shrink: 0.7, cs: BK.cs, streak: 0.055, r: 0.08 });
    spray(p, Math.max(2, n >> 2), { dir: dir.clone().negate(), s0: 0.6, s1: 1.4, cone: 0.6, up0: 0.3, up1: 1.2, g: 9.5, floor: fl, life: 700, sz: 0.02, cs: BK.cs, streak: 0.04 });
    puffs(p, Q ? 2 : 1, { dir: dir, ds0: 0.3, ds1: 0.8, sp: 0.25, up0: 0, up1: 0.15, drag: 2, life: 650, s0: 0.1, s1: 0.42 * Math.min(1.4, H / 1.6), a: kd === 'acid' ? 0.3 : 0.38, c: BK.mist });
    if (kd === 'acid') {
      spray(p, [2, 4, 6][Q], { dir: dir, s0: 1, s1: 2.6, cone: 0.8, up0: 0.5, up1: 1.6, g: 9, floor: fl, life: 600, sz: 0.03, c: '#b8ff50', a: 0.9, add: true, streak: 0.04 });
      puffs(p, 2, { sp: 0.2, up0: 0.2, up1: 0.5, drag: 1.2, life: 1500, s0: 0.12, s1: 0.5, a: 0.18, c: '#c8d8a0', jit: 200 });
    } else if (kd === 'oil') {
      spray(p, [3, 5, 7][Q], { dir: dir, s0: 1.5, s1: 3, cone: 1.2, up0: 0.6, up1: 1.8, g: 8, life: 260, sz: 0.022, c: '#ffe6a0', add: true, streak: 0.03 });
    }
    // капли стекают с раны
    if (Q >= 1) for (let i = 0; i < 2; i++) later(120 + i * 260, function () { spray(p.clone().addScaledVector(dir, -H * 0.05), 1, { cone: 0.05, up0: 0, up1: 0.1, g: 7, floor: fl, life: 1100, sz: 0.018, cs: BK.cs, streak: 0.05 }); });
  };

  /* ---------- Плевок: сгусток по дуге, след капель, брызги и ожог ---------- */
  MF.spitShot = function (att, tgt, hit, W, show, suppress, opt) {
    const tr = DW.TR2, s = spd();
    const tA = R3.units.anchor(tgt, false).add(V(0, (tgt.type === 'queen' ? 1.4 : 1.05) * (tr.unitScale(tgt) / 1.13), 0));
    const cover = opt && opt.coverTile;
    later(300 / s, function () {
      const m = (R3.units.mouth && R3.units.mouth(att)) || R3.units.muzzle(att) || R3.units.anchor(att, false).add(V(0, 1.3, 0));
      let e = tA.clone(), ground = false;
      if (cover && !suppress) e = V((cover[0] + 0.5) * T + (Math.random() - 0.5) * 0.4, R3.hAt(cover[0], cover[1]) + 0.5 + Math.random() * 0.6, (cover[1] + 0.5) * T + (Math.random() - 0.5) * 0.4);
      else if (!hit || suppress) {
        // мимо: падает на землю рядом с целью
        const a = Math.random() * Math.PI * 2, d = 0.5 + Math.random() * 0.9;
        e.add(V(Math.cos(a) * d, 0, Math.sin(a) * d)); e.y = groundAt(e.x, e.z) + 0.05; ground = true;
      } else e.add(V((Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.2));
      const B = blobs.find(function (b) { return !b.on; }) || blobs[0];
      const dist = m.distanceTo(e);
      B.on = true; B.a = m; B.b = e; B.t0 = now(); B.dur = 280 + dist * 12; B.arc = 0.35 + dist * 0.06; B.ground = ground; B.tgt = hit && !suppress && !cover ? tgt : null; B.trail = 0; B.prev = m.clone();
      B.m.visible = true; B.m.position.copy(m); B.m.scale.setScalar(0.06);
      // вспышка у пасти и брызги вперёд
      const fw = e.clone().sub(m).normalize();
      glow.add({ p: m.clone(), t0: now(), life: 160, s0: 0.22, s1: 0.32, a: 0.9, c: col('#b8ff50') });
      spray(m, [2, 4, 6][q()], { dir: fw, s0: 1.2, s1: 2.6, cone: 0.5, up0: 0, up1: 0.6, g: 9, floor: groundAt(m.x, m.z) + 0.02, life: 500, sz: 0.018, cs: BLOOD.acid.cs, streak: 0.04 });
    });
  };
  function blobUpd(B, t) {
    const k = (t - B.t0) / B.dur;
    if (k >= 1) { B.on = false; B.m.visible = false; acidHit(B); return; }
    const p = _pa.copy(B.a).lerp(B.b, k); p.y += Math.sin(k * Math.PI) * B.arc;
    // сгусток вытянут вдоль полёта и «дышит»
    const v = _pb.subVectors(p, B.prev);
    B.m.position.copy(p);
    if (v.lengthSq() > 1e-8) { B.m.quaternion.setFromUnitVectors(_pd.set(0, 0, 1), v.normalize()); }
    const wob = 1 + Math.sin(t * 0.06) * 0.12;
    B.m.scale.set(0.055 * wob, 0.055 / wob, 0.09);
    // след: светящиеся капли и редкие падающие
    B.trail++;
    glow.add({ p: p.clone(), t0: t, life: 140, s0: 0.09, s1: 0.04, a: 0.75, c: col('#a8f040') });
    if (q() >= 1 && B.trail % 2 === 0) spray(p, 1, { cone: 0.2, up0: -0.2, up1: 0.2, g: 9, floor: groundAt(p.x, p.z) + 0.02, life: 700, sz: 0.016, cs: BLOOD.acid.cs, streak: 0.05, land: q() >= 2 ? sizzleDot : null });
    B.prev.copy(p);
  }
  function sizzleDot(pp) {
    smoke.add({ p: pp.p.clone().setY(pp.floor + 0.03), v: V(0, 0.25, 0), drag: 1, t0: now(), life: 700, s0: 0.03, s1: 0.12, a: 0.25, c: col('#c8d8a0'), fadeIn: 0.1 });
    glow.add({ p: pp.p.clone().setY(pp.floor + 0.02), t0: now(), life: 300, s0: 0.05, s1: 0.02, a: 0.6, c: col('#a8f040') });
  }
  function acidHit(B) {
    const e = B.b, Q = q();
    const fl = groundAt(e.x, e.z) + 0.02;
    const dir = V().subVectors(B.b, B.a); dir.y = 0; dir.normalize();
    glow.add({ p: e.clone(), t0: now(), life: 220, s0: 0.35, s1: 0.6, a: 0.85, c: col('#a8f040') });
    spray(e, [8, 12, 18][Q], { dir: dir, s0: 0.4, s1: 1.8, cone: 1.4, up0: 0.6, up1: 2.2, g: 9, drag: 0.3, floor: fl, life: 800, sz: 0.024, cs: BLOOD.acid.cs, streak: 0.045, land: Q >= 2 ? sizzleDot : null, r: 0.06 });
    spray(e, [2, 4, 6][Q], { s0: 0, s1: 0, cone: 1.6, up0: 0.8, up1: 2, g: 9, floor: fl, life: 500, sz: 0.03, c: '#c8ff60', a: 0.9, add: true, streak: 0.035 });
    // шипение: зеленоватый дымок поднимается
    puffs(V(e.x, fl + 0.05, e.z), [2, 4, 6][Q], { r: 0.25, sp: 0.15, up0: 0.25, up1: 0.6, drag: 0.9, life: 1800, s0: 0.1, s1: 0.55, a: 0.2, c: '#b8c890', jit: 500 });
    // ожог на земле: под ногами цели или в месте падения
    const gx = B.tgt ? (B.tgt.x + 0.5) * T + dir.x * 0.25 : e.x, gz = B.tgt ? (B.tgt.y + 0.5) * T + dir.z * 0.25 : e.z;
    decal('acid', gx, gz, Math.random() * 6.28, 0.8 + Math.random() * 0.35);
    // кислота стекает с цели
    if (B.tgt && Q >= 1) for (let i = 0; i < 3; i++) later(150 + i * 220, function () { spray(e.clone().add(V((Math.random() - 0.5) * 0.2, -0.1, (Math.random() - 0.5) * 0.2)), 1, { cone: 0.05, up0: 0, up1: 0.05, g: 8, floor: fl, life: 1000, sz: 0.02, cs: BLOOD.acid.cs, streak: 0.05, land: sizzleDot }); });
  }
  /* капля кислоты из пасти Плевуна */
  MF.drip = function (p) {
    spray(p, 1, { cone: 0.03, up0: -0.1, up1: 0, g: 8, floor: groundAt(p.x, p.z) + 0.02, life: 1200, sz: 0.017, cs: BLOOD.acid.cs, streak: 0.05, land: q() >= 1 ? sizzleDot : null });
    if (q() >= 2) glow.add({ p: p.clone(), t0: now(), life: 200, s0: 0.05, s1: 0.03, a: 0.5, c: col('#a8f040') });
  };

  /* ---------- Удар Костолома оземь: кольцо пыли, трещины, крошка, тряска ---------- */
  MF.smash = function (u, p, H) {
    const Q = q(), Y = groundAt(p.x, p.z), dc = dustCol(p.x, p.z);
    const s = Math.max(0.8, (H || 2.3) / 2.3);
    ring(p.x, Y, p.z, 0.25 * s, 3.0 * s, 620, 0.9, 0x8f8068);
    if (Q >= 1) later(90, function () { ring(p.x, Y, p.z, 0.15 * s, 1.7 * s, 480, 0.7, 0x6e604c); });
    const c = V(p.x, Y + 0.08, p.z);
    for (let i = 0, n = [8, 12, 18][Q]; i < n; i++) {
      const a = i / n * 6.283 + Math.random() * 0.3, sp = rnd(2.2, 3.8) * s;
      smoke.add({ p: c.clone().add(V(Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3)), v: V(Math.cos(a) * sp, rnd(0.2, 0.7), Math.sin(a) * sp), drag: 2.4, t0: now(), life: rnd(1300, 2100), s0: 0.22, s1: rnd(0.8, 1.2) * s, a: 0.5, c: col(dc), fadeIn: 0.05, hold: 0.35 });
    }
    spray(c, [6, 10, 14][Q], { s0: 0, s1: 0, cone: 2.4, up0: 1.5, up1: 3.8, g: 9.8, drag: 0.2, floor: Y + 0.02, life: 1200, sz: 0.03, cs: ['#3a3026', '#5a4c3c', '#2a241e'], streak: 0.03, r: 0.4 });
    puffs(c, Q ? 3 : 2, { r: 0.3, sp: 0.5, up0: 0.4, up1: 0.9, drag: 1.4, life: 2600, s0: 0.3, s1: 1.5 * s, a: 0.38, c: dc, jit: 120 });
    decal('crack', p.x, p.z, Math.random() * 6.28, 2.1 * s);
    shake(7, u);
  };

  /* ---------- Прыжок Падальщика: приземление — когти и пыль ---------- */
  MF.leapLand = function (u, p, yaw, H) {
    const Y = groundAt(p.x, p.z), dc = dustCol(p.x, p.z), s = Math.max(0.7, H || 1);
    decal('claw', p.x, p.z, yaw, 0.55 * s, 0.7 * s);
    if (q() >= 1) decal('claw', p.x + Math.cos(yaw) * 0.18, p.z - Math.sin(yaw) * 0.18, yaw + 0.25, 0.45 * s, 0.6 * s);
    puffs(V(p.x, Y + 0.05, p.z), [3, 5, 7][q()], { r: 0.35, sp: 0.9, up0: 0.05, up1: 0.3, drag: 2.2, life: 1000, s0: 0.12, s1: 0.55 * s, a: 0.3, c: dc });
    spray(V(p.x, Y + 0.05, p.z), [2, 4, 6][q()], { s0: 0, s1: 0, cone: 1.3, up0: 0.8, up1: 1.8, g: 9.8, floor: Y + 0.02, life: 700, sz: 0.022, cs: ['#4a3c2c', '#6a5a46'], streak: 0.03 });
  };
  /* удар когтями/укус (Вожак, Матка): царапины у цели */
  MF.bite = function (u, p, yaw, H) {
    if (u.type === 'alpha' || u.type === 'queen') decal('claw', p.x, p.z, yaw, 0.6 * (H || 1.6) / 1.6, 0.8 * (H || 1.6) / 1.6);
    puffs(V(p.x, groundAt(p.x, p.z) + 0.05, p.z), [2, 3, 4][q()], { r: 0.25, sp: 0.6, up0: 0.05, up1: 0.25, drag: 2, life: 800, s0: 0.1, s1: 0.45, a: 0.25, c: dustCol(p.x, p.z) });
  };

  /* тело рухнуло: пыль из-под туши */
  MF.thud = function (u, p, H) {
    const Y = groundAt(p.x, p.z), s = Math.max(0.7, (H || 1.5) / 1.6);
    puffs(V(p.x, Y + 0.05, p.z), [3, 4, 6][q()], { r: 0.5 * s, sp: 0.9, up0: 0.05, up1: 0.3, drag: 2, life: 1300, s0: 0.15, s1: 0.7 * s, a: 0.26, c: dustCol(p.x, p.z) });
    if (H > 1.8) shake(2.2, u);
  };

  /* ---------- Рык: конус пара/пыли из пасти (каждый кадр, пока пасть открыта), кольцо пыли, тряска ---------- */
  let breathAcc = 0;
  const _bd = V();
  MF.breath = function (u, mouth, dir, k, dt, big, fwd) {
    breathAcc += dt * [18, 30, 46][q()] * (big ? 1 : 0.6) * k;
    // конус — вперёд из пасти, почти по горизонтали (запрокинутая голова не даёт столба вверх)
    _bd.copy(dir);
    if (fwd) _bd.lerp(fwd, 0.5);
    _bd.y = Math.max(-0.3, Math.min(0.22, _bd.y));
    if (_bd.lengthSq() < 1e-4) _bd.set(0, 0, 1);
    _bd.normalize(); dir = _bd;
    const dk = darkK(), c = dk > 0.6 ? '#d0d8de' : '#857560';
    while (breathAcc >= 1) {
      breathAcc -= 1;
      const v = dir.clone().multiplyScalar(rnd(2.2, 3.8) * (big ? 1 : 0.7)).add(V((Math.random() - 0.5) * 1.3, (Math.random() - 0.3) * 0.8, (Math.random() - 0.5) * 1.3));
      smoke.add({ p: mouth.clone(), v: v, drag: 2.4, t0: now(), life: rnd(650, 1000), s0: 0.09, s1: rnd(0.45, 0.8) * (big ? 1.25 : 0.8), a: (dk > 0.6 ? 0.4 : 0.42), c: col(c), fadeIn: 0.1 });
      if (Math.random() < 0.25 && q() >= 1) spray(mouth, 1, { dir: dir, s0: 1.5, s1: 3, cone: 0.5, up0: 0, up1: 0.4, g: 8, floor: groundAt(mouth.x, mouth.z) + 0.02, life: 600, sz: 0.012, c: '#d8d0b8', a: 0.7, streak: 0.04 });
    }
  };
  MF.roarBurst = function (u, p, dir, power) {
    const Y = groundAt(p.x, p.z), f = p.clone().addScaledVector(dir, 0.9);
    ring(f.x, Y, f.z, 0.2, 1.4 + power * 0.8, 700, 0.6, 0x9a8c70);
    puffs(V(f.x, Y + 0.05, f.z), [3, 5, 8][q()], { r: 0.5, sp: 1.2, dir: dir, ds0: 0.5, ds1: 1.5, up0: 0.05, up1: 0.25, drag: 2, life: 1200, s0: 0.15, s1: 0.8, a: 0.24, c: dustCol(f.x, f.z) });
    shake(2.5 + power * 2.2, u);
  };

  /* ---------- Шаги: пыль, отпечатки, когти ---------- */
  MF.foot = function (u, p, yaw, heavy, run) {
    const Q = q(), Y = groundAt(p.x, p.z), dc = dustCol(p.x, p.z), ty = u.type;
    if (heavy) {
      puffs(V(p.x, Y + 0.04, p.z), [2, 3, 5][Q], { r: 0.15, sp: 0.8, up0: 0.05, up1: 0.25, drag: 2.4, life: 1100, s0: 0.12, s1: ty === 'queen' ? 0.6 : 0.5, a: 0.3, c: dc });
      if (ty === 'brute') decal('print', p.x, p.z, yaw, 0.42, 0.5);
      else if (Math.random() < 0.6) decal('claw', p.x, p.z, yaw, 0.32, 0.4);
    } else {
      if (run && Q >= 1) puffs(V(p.x, Y + 0.03, p.z), 1, { r: 0.05, sp: 0.4, up0: 0.05, up1: 0.15, drag: 2, life: 800, s0: 0.08, s1: 0.32, a: 0.2, c: dc });
      if (Math.random() < (run ? 0.4 : 0.22)) decal('claw', p.x, p.z, yaw, 0.2, 0.26);
    }
  };

  /* ---------- Выводок Матки: мешок с яйцами набухает и лопается на клетке ---------- */
  let broodT = {};
  MF.burst = function (x, y) {
    const key = x + ',' + y, t = now();
    if (broodT[key] && t - broodT[key] < 2500) return;
    broodT[key] = t;
    const S = sacs.find(function (s) { return !s.on; }) || sacs[0];
    const X = (x + 0.5) * T, Z = (y + 0.5) * T, Y = groundAt(X, Z);
    S.on = true; S.t0 = t; S.X = X; S.Y = Y; S.Z = Z; S.pop = false; S.m.visible = true; S.m.position.set(X, Y, Z); S.m.scale.setScalar(0.01);
  };
  MF.recentBurst = function (x, y) { const b = broodT[x + ',' + y]; return b && now() - b < 2500; };
  function sacUpd(S, t) {
    const s = spd(), k = (t - S.t0) / (520 / s);
    if (k < 1) {
      // набухает и пульсирует
      const g = Math.min(1, k * 1.6), pul = 1 + Math.sin(k * 26) * 0.06 * k;
      S.m.scale.set(0.34 * g * pul, 0.42 * g / pul, 0.34 * g * pul); S.m.position.y = S.Y + 0.36 * g * 0.6;
      return;
    }
    if (!S.pop) {
      S.pop = true; S.on = false; S.m.visible = false;
      const c = V(S.X, S.Y + 0.3, S.Z), Q = q();
      spray(c, [8, 12, 18][Q], { s0: 0, s1: 0, cone: 2.2, up0: 1.2, up1: 3.2, g: 9.5, drag: 0.3, floor: S.Y + 0.02, life: 1100, sz: 0.035, cs: ['#d8c8a0', '#b8a070', '#8a7a50'], streak: 0.025, r: 0.2 });
      spray(c, [6, 10, 14][Q], { s0: 0, s1: 0, cone: 1.8, up0: 0.8, up1: 2.4, g: 9, floor: S.Y + 0.02, life: 900, sz: 0.026, cs: ['#a8b048', '#c8c870', '#8a9a30'], streak: 0.04 });
      puffs(c, Q + 2, { r: 0.2, sp: 0.6, up0: 0.1, up1: 0.4, drag: 1.6, life: 1300, s0: 0.15, s1: 0.6, a: 0.28, c: '#b8b088' });
      glow.add({ p: c, t0: now(), life: 200, s0: 0.4, s1: 0.6, a: 0.45, c: col('#d8ff80') });
      decal('slime', S.X, S.Z, Math.random() * 6.28, 1.0 + Math.random() * 0.3);
    }
  }

  /* ---------- Крючки для логики боя (необязательные): вызываются из battle.js / ai.js ---------- */
  MF.roar = function (u) { if (u && R3.units.act) R3.units.act(u, 'roar'); };
  MF.leap = function (u, tx, ty) { if (u && R3.units.act) R3.units.act(u, 'leap', { tx: tx, ty: ty }); };
  MF.brood = function (queen, spots) {
    (spots || []).forEach(function (s, i) { later(i * 140, function () { MF.burst(s[0], s[1]); }); });
    if (queen && R3.units.act) R3.units.act(queen, 'brood');
  };

  /* ---------- Материалы: мокрая кожа, светящаяся кислота ---------- */
  // rough — шероховатость (0 — зеркало), coat — лаковый слой «влаги» (только высокая графика), acid — светятся
  // зелёные места текстуры (мешки с кислотой у Плевуна)
  const WET = {
    scav: { rough: 0.5, coat: 0.45, coatR: 0.32 }, scav2: { rough: 0.52, coat: 0.4, coatR: 0.34 },
    alpha: { rough: 0.48, coat: 0.35, coatR: 0.3 }, queen: { rough: 0.4, coat: 0.7, coatR: 0.22 },
    brute: { rough: 0.5, coat: 0.45, coatR: 0.3 }, spitter: { rough: 0.38, coat: 0.85, coatR: 0.18, acid: true }
  };
  const wetCache = {};
  function wetMat(src, id) {
    const W = WET[id];
    if (!W || !src || !src.isMeshStandardMaterial) return null;
    const Q = q(), key = id + '|' + src.uuid + '|' + Q;
    if (wetCache[key]) return wetCache[key];
    let m;
    if (Q >= 2 && W.coat) {
      m = new THREE.MeshPhysicalMaterial({
        map: src.map, normalMap: src.normalMap, roughnessMap: src.roughnessMap, metalnessMap: src.metalnessMap, aoMap: src.aoMap,
        emissiveMap: src.emissiveMap, color: src.color, emissive: src.emissive, side: src.side, transparent: src.transparent, alphaTest: src.alphaTest
      });
      if (src.normalScale) m.normalScale.copy(src.normalScale);
      m.clearcoat = W.coat; m.clearcoatRoughness = W.coatR;
    } else m = src.clone();
    m.roughness = Q === 0 ? Math.max(0.6, W.rough) : W.rough;
    m.metalness = Math.min(src.metalness || 0, 0.25);
    m.userData = {};
    let extra = null;
    if (W.acid) {
      // светятся зелёные участки текстуры (мешки с кислотой), ночью ярче, медленно «дышат»
      extra = function (sh) {
        sh.uniforms.uAcid = acidU;
        sh.fragmentShader = 'uniform float uAcid;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', [
          '#include <emissivemap_fragment>',
          '  { float gD = diffuseColor.g - max(diffuseColor.r, diffuseColor.b);',
          '    float ac = smoothstep(0.04, 0.2, gD) * smoothstep(0.12, 0.35, diffuseColor.g);',
          '    totalEmissiveRadiance += diffuseColor.rgb * vec3(0.8, 1.3, 0.5) * ac * uAcid; }'
        ].join('\n'));
      };
      m.userData.key = 'acid';
    } else m.userData.key = 'wet' + (m.isMeshPhysicalMaterial ? 'p' : 's');
    if (R3.fogify) R3.fogify(m, extra);
    return (wetCache[key] = m);
  }
  /* одеть тело мутанта: мокрые материалы вместо исходных (gl — исходная модель, у неё — материалы файла) */
  MF.dress = function (e, id, gl) {
    if (!WET[id] || !gl || !e.body) return;
    const src = [];
    gl.scene.traverse(function (m) { if (m.isMesh) src.push(m.material); });
    let i = 0;
    e.body.root.traverse(function (m) {
      if (!m.isMesh) return;
      const s = src[i++];
      if (Array.isArray(s)) { const mm = s.map(function (x) { return wetMat(x, id); }); if (mm.every(Boolean)) m.material = mm; }
      else { const w = wetMat(s, id); if (w) m.material = w; }
    });
  };

  /* ---------- Обёртки сигналов боя (fx.js не трогаем: оборачиваем его функции) ---------- */
  (function hook() {
    const FX = R3.fx;
    if (!FX || FX.__mfx) return;
    FX.__mfx = true;
    const shot0 = FX.shot, hit0 = FX.hit, dec0 = FX.decal, exp0 = FX.explosion;
    // плевок — свой сгусток (вместо светящейся точки)
    if (shot0) FX.shot = function (att, tgt, hit, W) {
      if (W && W.snd === 'spit' && att && tgt && grp) { try { return MF.spitShot.apply(MF, arguments); } catch (err) { console.warn('mfx spit', err); } }
      return shot0.apply(FX, arguments);
    };
    // попадание по мутанту — брызги по направлению удара (своего цвета)
    if (hit0) FX.hit = function (u) {
      const e = u && R3.units.ent && R3.units.ent(u);
      if (e && e.kind === 'creature' && e.ready && grp) { try { MF.splash(u); return; } catch (err) { console.warn('mfx hit', err); } }
      return hit0.apply(FX, arguments);
    };
    // пятна крови зверей: зелёная кислота — только у Плевуна, у прочих — тёмная кровь
    if (dec0) FX.decal = function (x, y, kind, size, silent) {
      if (kind === 'acid') {
        const B = DW.BT.get();
        if (B) {
          const X = Math.round(x), Y = Math.round(y);
          let sp = false, beast = false;
          B.units.forEach(function (o) { if (o.x === X && o.y === Y && D.ENEMIES[o.type] && D.ENEMIES[o.type].beast) { beast = true; if (o.type === 'spitter') sp = true; } });
          if (beast && !sp) kind = 'blood';
        }
      }
      return dec0.call(FX, x, y, kind, size, silent);
    };
    // взрыв — откуда отбросило (направление попадания)
    if (exp0) FX.explosion = function (x, y, r) { MF.lastBlast = { x: x, y: y, t: now() }; return exp0.apply(FX, arguments); };
    // пока летит сгусток или лопается мешок — кадры не прореживать (бой «занят»)
    const busy0 = FX.busy;
    if (busy0) FX.busy = function () { return busy0.apply(FX, arguments) || MF.busy(); };
  })();

  /* ---------- Кадр ---------- */
  const _white = new THREE.Color(1, 1, 1);
  let eyePool = [];
  MF.update = function (dt, t) {
    if (!grp) return;
    // отложенные события (по часам боя)
    if (Qt.length) { const due = Qt.filter(function (x) { return t >= x.t; }); if (due.length) { Qt = Qt.filter(function (x) { return t < x.t; }); due.forEach(function (x) { try { x.fn(); } catch (err) { console.warn('mfx', err); } }); } }
    const dk = darkK();
    acidU.value = (0.35 + dk * 0.9) * (0.8 + 0.2 * Math.sin(t * 0.0021));
    blobs.forEach(function (b) { if (b.on) blobUpd(b, t); });
    sacs.forEach(function (s) { if (s.on) sacUpd(s, t); });
    rings.forEach(function (R) {
      if (!R.m.visible) return;
      const k = (t - R.t0) / R.life;
      if (k >= 1) { R.m.visible = false; return; }
      const e = 1 - Math.pow(1 - k, 2.2);
      R.m.scale.setScalar((R.r0 + (R.r1 - R.r0) * e) * 2);
      R.m.material.opacity = R.a * Math.pow(1 - k, 1.4);
    });
    // глаза: у каждого видимого живого мутанта — ореол и яркая точка
    const B = DW.BT.get();
    eyesL.length = 0;
    let ei = 0;
    if (B) B.units.forEach(function (u) {
      const e = R3.units.ent(u);
      if (!e || !e.ready || !e.eyes || !e.body.holder.visible || !(e.eyeA > 0.02)) return;
      const sc = e.body.holder.scale.x || 1, a = e.eyeA * (0.3 + 0.7 * dk);
      e.eyes.forEach(function (E) {
        // запись на глаз — из запаса (без мусора в кадре): ореол и ядро
        const p = eyePool[ei] || (eyePool[ei] = { p: V(), h: { p: null, s: 0, c: null, a: 0 }, k: { p: null, s: 0, c: new THREE.Color(), a: 0 } }); ei++;
        p.p.setFromMatrixPosition(E.o.matrixWorld);
        p.h.p = p.p; p.h.s = E.s * sc * (1.3 + dk * 0.6); p.h.c = E.c; p.h.a = a * 0.28;
        p.k.p = p.p; p.k.s = E.s * sc * 0.42; p.k.c.copy(E.c).lerp(_white, 0.45); p.k.a = Math.min(1, a * 1.1);
        eyesL.push(p.h, p.k);
      });
    });
    smoke.draw(t, Math.min(0.1, dt));
    glow.draw(t, Math.min(0.1, dt), eyesL);
  };
  MF.busy = function () { return blobs.some(function (b) { return b.on; }) || sacs.some(function (s) { return s.on; }) || rings.some(function (r) { return r.m.visible; }); };
})(window.DW);
