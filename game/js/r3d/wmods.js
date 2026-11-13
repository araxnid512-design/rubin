'use strict';
/* 3D-бой: модули оружия на модели — прицел, глушитель, расширенный магазин, приклад (в бою и в окне отряда).
   R3.wmods.attach(W, mods, weaponId): W — оружие из units.js makeWeapon (W.g — группа; ствол к −Z, +Y вверх, начало —
   рукоять), mods — ['scope','mag','supp','stock'], weaponId — ключ DW.M3.weapons.
   Детали — простая процедурная геометрия (до ~300 треугольников на модуль), места — по таблице TAB, снятой с моделей
   (срезы геометрии в координатах W.g). Геометрия строится один раз на пару «оружие + модуль» и общая у всех бойцов;
   материалы — через R3.world.fogMat (туман войны); окно отряда (preview.js) после attach само заменяет их копиями без
   тумана. Детали — дочерние W.g с готовыми матрицами: каждый кадр ничего не считается. С глушителем W.muzzle
   переносится на его торец (вспышка и трассер — оттуда); повторный attach (или detach) снимает прежние детали. */
(function (DW) {
  const R3 = DW.R3, THREE = R3 && R3.THREE;
  if (!THREE) return;
  const D2R = Math.PI / 180;

  /* Таблица по моделям (метры, координаты W.g). x — ось ствола по ширине при z = 0, k — её наклон dx/dz (модель АК-107
     чуть повёрнута); все прочие x — от этой оси.
     supp: [y оси, z начала у дульного среза, радиус, длина, x];
     scope: { y — ось трубы, z — задний край (окуляр), f — высота опор под задним и передним кольцом (кольца в 8 и 16 см
            от окуляра) } или shade: [z, y, r, длина, x] — бленда на родной прицел (СВД, КСВК);
     mag: twin — второй магазин «валетом» на изоленте: p — контур родного магазина сбоку (z, y по кругу), x — его
            ширина [x0, x1], c — изолента [z, y середины, наклон магазина°, ширина поперёк];
          drum — хомут на диск [z, y центра, r, x, толщина]; tube — удлинитель подствольного магазина [y, z торца, r, длина];
          box — длинный коробчатый магазин [z0, z1, y верха, y низа, ширина]; can — патронный короб [то же];
     stock: pad — резиновый затыльник [z торца, y0, y1, ширина, наклон торца°, x], cheek — щека по верху приклада
            [z0, y0, z1, y1, ширина, x]. */
  const TAB = {
    ppsh: { x: -0.018,
      supp: [0.065, -0.48, 0.021, 0.18],
      scope: { y: 0.122, z: 0.05, f: [0.091, 0.094] },
      mag: { drum: [-0.17, -0.042, 0.095, 0.002, 0.052] },
      stock: { pad: [0.330, -0.137, 0.011, 0.066, 0], cheek: [0.14, 0.034, 0.26, 0.021, 0.044] } },
    ak: { x: -0.008,
      supp: [0.0805, -0.545, 0.019, 0.18],
      scope: { y: 0.152, z: 0.095, f: [0.126, 0.126] },
      mag: { twin: { p: [-0.080, -0.012, -0.082, -0.030, -0.089, -0.050, -0.098, -0.070, -0.108, -0.090, -0.121, -0.110, -0.136, -0.130,
        -0.153, -0.150, -0.176, -0.170, -0.192, -0.183, -0.240, -0.118, -0.235, -0.110, -0.223, -0.100, -0.211, -0.090, -0.201, -0.080,
        -0.192, -0.070, -0.180, -0.050, -0.168, -0.030, -0.160, -0.012], x: [-0.020, 0.021], c: [-0.1685, -0.100, 40, 0.09] } },
      stock: { pad: [0.312, -0.062, 0.073, 0.054, 0], cheek: [0.15, 0.086, 0.27, 0.077, 0.04] } },
    ak2: { x: 0.006, k: 0.066,
      supp: [0.073, -0.565, 0.019, 0.18],
      scope: { y: 0.146, z: 0.095, f: [0.12, 0.12] },
      mag: { twin: { p: [-0.077, -0.030, -0.082, -0.050, -0.087, -0.070, -0.093, -0.090, -0.101, -0.110, -0.109, -0.130, -0.119, -0.150,
        -0.127, -0.170, -0.131, -0.176, -0.207, -0.133, -0.197, -0.120, -0.187, -0.100, -0.177, -0.080, -0.169, -0.060, -0.162, -0.040,
        -0.158, -0.030], x: [-0.025, 0.019], c: [-0.142, -0.100, 25, 0.088] } },
      stock: { pad: [0.334, -0.072, 0.078, 0.06, 0, 0.002], cheek: [0.16, 0.076, 0.29, 0.076, 0.042, 0.002] } },
    lmg: { x: 0,
      supp: [0.095, -0.69, 0.02, 0.19],
      scope: { y: 0.179, z: 0.105, f: [0.135, 0.135] },
      mag: { twin: { p: [-0.020, -0.012, -0.022, -0.020, -0.028, -0.040, -0.035, -0.060, -0.043, -0.080, -0.055, -0.100, -0.067, -0.120,
        -0.080, -0.140, -0.097, -0.160, -0.117, -0.180, -0.129, -0.190, -0.135, -0.197, -0.192, -0.125, -0.190, -0.120, -0.181, -0.110,
        -0.170, -0.100, -0.160, -0.090, -0.149, -0.080, -0.135, -0.060, -0.122, -0.040, -0.113, -0.020, -0.110, -0.012],
        x: [-0.021, 0.020], c: [-0.121, -0.110, 37, 0.10] } },
      stock: { pad: [0.341, -0.064, 0.079, 0.056, 0], cheek: [0.18, 0.091, 0.30, 0.080, 0.044] } },
    sniper: { x: -0.004,
      supp: [0.020, -0.785, 0.02, 0.19, -0.001],
      shade: [-0.151, 0.1085, 0.0355, 0.045, 0.001],
      mag: { twin: { p: [-0.049, -0.040, -0.049, -0.155, -0.141, -0.155, -0.139, -0.040], x: [-0.021, 0.024], c: [-0.0945, -0.0975, 0, 0.097] } },
      stock: { pad: [0.386, -0.145, 0.021, 0.072, 0, 0.001], cheek: [0.21, 0.043, 0.30, 0.043, 0.05, 0.001] } },
    shotgun: { x: 0.001,
      supp: [0.088, -0.692, 0.02, 0.18],
      scope: { y: 0.165, z: 0.07, f: [0.112, 0.126] },
      mag: { tube: [0.0505, -0.70, 0.019, 0.10] },
      stock: { pad: [0.296, -0.121, 0.02, 0.088, 0], cheek: [0.13, 0.061, 0.23, 0.031, 0.08] } },
    hsniper: { x: 0,
      supp: [0.054, -0.765, 0.03, 0.24, 0.002],
      shade: [-0.209, 0.1465, 0.051, 0.06],
      mag: { box: [0.355, 0.435, -0.092, -0.172, 0.042] },
      stock: { pad: [0.562, -0.144, 0.047, 0.066, 0], cheek: [0.37, 0.068, 0.48, 0.068, 0.05] } },
    hlmg: { x: -0.002,
      supp: [0.147, -1.10, 0.032, 0.26],
      scope: { y: 0.257, z: 0.05, f: [0.233, 0.224] },
      mag: { can: [-0.20, -0.035, -0.018, -0.14, 0.09] },
      stock: { pad: [0.469, -0.061, 0.177, 0.106, 4.3], cheek: [0.28, 0.177, 0.42, 0.177, 0.07] } }
  };

  /* ---------- Материалы (общие; туман войны — R3.world.fogMat, по копии на материал) ---------- */
  let MAT = null;
  function mats() {
    if (MAT) return MAT;
    const S = function (name, c, mt, ro, o) {
      const m = new THREE.MeshStandardMaterial(Object.assign({ color: c, metalness: mt, roughness: ro }, o || {}));
      m.name = 'wmod_' + name;
      return m;
    };
    MAT = {
      steel: S('steel', 0x2e3034, 0.3, 0.5),       // воронёная сталь: прицел, кольца, кронштейны
      matte: S('matte', 0x292b2d, 0.15, 0.78),     // глушитель — матовый
      rubber: S('rubber', 0x1a1a1a, 0, 0.92),      // резиновый затыльник
      pad: S('pad', 0x4d4832, 0, 0.9),             // щека в оливковом чехле
      lens: S('lens', 0x0d2442, 0.2, 0.2, { emissive: 0x3f8fff, emissiveIntensity: 0.9 }),   // блик объектива
      mag: S('mag', 0x404246, 0.25, 0.5),          // второй магазин
      tape: S('tape', 0x5d5837, 0, 0.85),          // изолента
      band: S('band', 0x8a8d90, 0.4, 0.4),         // светлый хомут на диске
      can: S('can', 0x3e4830, 0.2, 0.65)           // патронный короб
    };
    return MAT;
  }
  function fm(m) { return R3.world && R3.world.fogMat ? R3.world.fogMat(m) : m; }

  /* ---------- Сборка: детали одного материала сливаются в одну геометрию ---------- */
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _one = new THREE.Vector3(1, 1, 1);
  function Parts() { this.by = {}; }
  Parts.prototype.add = function (mat, geo, x, y, z, rx, ry, rz) {
    _e.set(rx || 0, ry || 0, rz || 0); _q.setFromEuler(_e); _p.set(x || 0, y || 0, z || 0);
    _m.compose(_p, _q, _one);
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    g.applyMatrix4(_m);
    (this.by[mat] = this.by[mat] || []).push(g);
  };
  Parts.prototype.done = function () {
    const out = [];
    for (const mat in this.by) {
      const list = this.by[mat];
      let n = 0;
      for (const g of list) n += g.attributes.position.count;
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
      let o = 0;
      for (const g of list) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; g.dispose(); }
      const G = new THREE.BufferGeometry();
      G.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      G.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      G.computeBoundingSphere();
      out.push({ m: mat, g: G });
    }
    return out;
  };
  // тело вращения вдоль −Z: профиль [r, h] (h от заднего края вперёд); повтор точки — острая кромка
  function lathe(pts, seg) {
    const g = new THREE.LatheGeometry(pts.map(function (q) { return new THREE.Vector2(q[0], q[1]); }), seg);
    g.rotateX(-Math.PI / 2);
    return g;
  }
  function cylZ(r, len, seg, open) { const g = new THREE.CylinderGeometry(r, r, len, seg, 1, !!open); g.rotateX(Math.PI / 2); return g; }
  function rrect(w, h, r) {
    const s = new THREE.Shape(), x = w / 2, y = h / 2;
    s.moveTo(-x + r, -y); s.lineTo(x - r, -y); s.absarc(x - r, -y + r, r, -Math.PI / 2, 0, false);
    s.lineTo(x, y - r); s.absarc(x - r, y - r, r, 0, Math.PI / 2, false);
    s.lineTo(-x + r, y); s.absarc(-x + r, y - r, r, Math.PI / 2, Math.PI, false);
    s.lineTo(-x, -y + r); s.absarc(-x + r, -y + r, r, Math.PI, Math.PI * 1.5, false);
    return s;
  }

  /* глушитель: матовая труба с кольцевым буртиком у ствола и фаской на торце */
  function bSupp(P, s) {
    const r = s[2], L = s[3];
    P.add('matte', lathe([[0.6 * r, 0], [r, 0.004], [r, 0.026], [1.08 * r, 0.03], [1.08 * r, 0.04], [r, 0.044], [r, L - 0.01], [r, L - 0.01],
      [0.84 * r, L], [0.84 * r, L], [0.3 * r, L], [0.3 * r, L], [0.3 * r, L - 0.015]], 12), s[4] || 0, s[0], s[1]);
  }
  /* оптический прицел: труба Ø32 мм, раструб объектива, окуляр, барабаны, два кольца на кронштейнах, синий блик */
  const SC = { L: 0.235, rT: 0.016, rE: 0.019, rB: 0.0215, rL: 0.0172 };
  function bScope(P, s) {
    const L = SC.L, rT = SC.rT, rE = SC.rE, rB = SC.rB, rL = SC.rL, y = s.y, z = s.z;
    P.add('steel', lathe([[0, 0], [rE - 0.003, 0], [rE, 0.004], [rE, 0.045], [rT, 0.06], [rT, L - 0.075], [rB, L - 0.045],
      [rB, L], [rB, L], [rL, L], [rL, L - 0.005]], 10), 0, y, z);
    // барабаны: сверху и справа
    const tz = z - 0.12;
    P.add('steel', new THREE.CylinderGeometry(0.0085, 0.0085, 0.012, 6), 0, y + rT + 0.004, tz);
    P.add('steel', new THREE.CylinderGeometry(0.0085, 0.0085, 0.012, 6), rT + 0.004, y, tz, 0, 0, Math.PI / 2);
    // кольца и кронштейны до ствольной коробки
    [0.08, 0.16].forEach(function (h, i) {
      const zr = z - h, foot = s.f[i], top = y - rT + 0.002, bot = foot - 0.003;
      P.add('steel', cylZ(rT + 0.0028, 0.012, 10, true), 0, y, zr);
      if (top > bot) P.add('steel', new THREE.BoxGeometry(0.016, top - bot, Math.min(0.03, 0.012 + 0.6 * (top - bot))), 0, (top + bot) / 2, zr);
    });
    // блик объектива
    const lens = new THREE.CircleGeometry(rL, 10); lens.rotateY(Math.PI);
    P.add('lens', lens, 0, y, z - L + 0.0045);
  }
  /* бленда на родной прицел снайперской винтовки: тонкостенная труба перед объективом */
  function bShade(P, s) {
    const r = s[2], ri = r - 0.004, L = s[3];
    P.add('steel', lathe([[r, 0], [r, 0], [r, L], [r, L], [ri, L], [ri, L], [ri, 0]], 14), s[4] || 0, s[1], s[0]);
  }
  /* второй магазин «валетом»: контур родного, повёрнутый на 180° в плоскости YZ, сбоку справа и чуть ниже; изолента вокруг обоих */
  function bTwin(P, t) {
    const p = t.p, c = t.c, a = c[2] * D2R, sh = 0.018, gap = 0.003, th = (t.x[1] - t.x[0]) * 0.8;
    const dz = -Math.sin(a) * sh, dy = -Math.cos(a) * sh;   // сдвиг вдоль магазина — вниз и вперёд
    const S = new THREE.Shape();
    for (let i = 0; i < p.length; i += 2) {
      const zz = 2 * c[0] - p[i] + dz, yy = 2 * c[1] - p[i + 1] + dy;
      if (i) S.lineTo(zz, yy); else S.moveTo(zz, yy);
    }
    const g = new THREE.ExtrudeGeometry(S, { depth: th - 0.004, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.0015, bevelSegments: 1, curveSegments: 1 });
    g.translate(0, 0, 0.002);
    g.rotateY(-Math.PI / 2);   // контур (z, y) → вытягивание к −X
    P.add('mag', g, t.x[1] + gap + th, 0, 0);
    const xa = t.x[0] - 0.003, xb = t.x[1] + gap + th + 0.003;
    P.add('tape', new THREE.BoxGeometry(xb - xa, 0.022, c[3]), (xa + xb) / 2, c[1] + dy / 2, c[0] + dz / 2, a);
  }
  /* хомут на диск ППШ: светлая стальная скоба по ободу с заходом на боковины (нижняя видимая дуга), замок спереди снизу */
  function bDrum(P, d) {
    const R = d[2], h = d[4] / 2 + 0.002, ro = R + 0.003, ri = R - 0.013, a = 100 * D2R;
    const g = new THREE.LatheGeometry([[ri, -h], [ro, -h], [ro, -h], [ro, h], [ro, h], [ri, h]].map(function (q) { return new THREE.Vector2(q[0], q[1]); }), 24, Math.PI / 2 - a, 2 * a);
    g.rotateZ(-Math.PI / 2);   // ось вдоль X: y = −r·sinφ, z = r·cosφ (низ — φ = 90°)
    P.add('band', g, d[3], d[1], d[0]);
    const th = 1.25 * Math.PI, rr = ro + 0.004;
    P.add('band', new THREE.BoxGeometry(2 * h + 0.004, 0.01, 0.026), d[3], d[1] + rr * Math.sin(th), d[0] + rr * Math.cos(th), Math.PI / 2 - th);
    P.add('steel', new THREE.BoxGeometry(2 * h + 0.01, 0.006, 0.008), d[3], d[1] + (rr + 0.006) * Math.sin(th), d[0] + (rr + 0.006) * Math.cos(th), Math.PI / 2 - th);
  }
  /* удлинитель подствольного магазина (дробовик): труба вперёд от торца, муфта на стыке, крышка */
  function bTube(P, t) {
    const y = t[0], z = t[1], r = t[2], L = t[3];
    P.add('steel', cylZ(r, L, 12), 0, y, z - L / 2);
    P.add('steel', cylZ(r * 1.13, 0.014, 12), 0, y, z + 0.003);
    P.add('steel', cylZ(r * 1.1, 0.012, 12), 0, y, z - L + 0.004);
  }
  /* длинный коробчатый магазин (КСВК: за рукоятью, из-под приклада) */
  function bBox(P, b) {
    const z0 = b[0], z1 = b[1], y0 = b[2], y1 = b[3], w = b[4];
    P.add('mag', new THREE.BoxGeometry(w, y0 - y1, z1 - z0), 0, (y0 + y1) / 2, (z0 + z1) / 2);
    P.add('mag', new THREE.BoxGeometry(w + 0.006, 0.009, z1 - z0 + 0.008), 0, y1 + 0.002, (z0 + z1) / 2);
    P.add('mag', new THREE.BoxGeometry(w + 0.003, 0.004, z1 - z0 - 0.02), 0, (y0 + y1) / 2 - 0.012, (z0 + z1) / 2);
  }
  /* патронный короб под ствольной коробкой (КОРД): короб, крышка, защёлка, ручка */
  function bCan(P, b) {
    const z0 = b[0], z1 = b[1], y0 = b[2], y1 = b[3], w = b[4], zc = (z0 + z1) / 2, d = z1 - z0;
    P.add('can', new THREE.BoxGeometry(w, y0 - y1, d), 0, (y0 + y1) / 2, zc);
    P.add('can', new THREE.BoxGeometry(w + 0.005, 0.012, d + 0.005), 0, y0 - 0.012, zc);
    P.add('steel', new THREE.BoxGeometry(0.03, 0.022, 0.008), 0, y0 - 0.028, z0 - 0.003);
    P.add('steel', new THREE.BoxGeometry(0.008, 0.012, d * 0.55), w / 2 + 0.004, (y0 + y1) / 2 + 0.01, zc);
  }
  /* приклад: резиновый затыльник со скруглёнными углами и щека по верху */
  function bPad(P, p) {
    const h = p[2] - p[1], w = p[3], t = 0.02;
    const g = new THREE.ExtrudeGeometry(rrect(w, h, Math.min(0.013, w * 0.3)), { depth: t, bevelEnabled: false, curveSegments: 3 });
    g.translate(0, 0, -0.003);
    P.add('rubber', g, p[5] || 0, (p[1] + p[2]) / 2, p[0], (p[4] || 0) * D2R);
  }
  function bCheek(P, c) {
    const dz = c[2] - c[0], dy = c[3] - c[1], L = Math.hypot(dz, dy), w = c[4], h = 0.02;
    const S = new THREE.Shape();
    S.moveTo(-w / 2, 0); S.lineTo(w / 2, 0); S.lineTo(w / 2, h * 0.45);
    S.quadraticCurveTo(w / 2, h, 0, h); S.quadraticCurveTo(-w / 2, h, -w / 2, h * 0.45); S.lineTo(-w / 2, 0);
    const g = new THREE.ExtrudeGeometry(S, { depth: L, bevelEnabled: false, curveSegments: 4 });
    g.translate(0, -0.005, -L / 2);
    P.add('pad', g, c[5] || 0, (c[1] + c[3]) / 2, (c[0] + c[2]) / 2, -Math.atan2(dy, dz));
  }

  const CACHE = {};
  function build(id, mod) {
    const key = id + ':' + mod;
    if (CACHE[key] !== undefined) return CACHE[key];
    const T = TAB[id], P = new Parts();
    if (mod === 'supp' && T.supp) bSupp(P, T.supp);
    else if (mod === 'scope') { if (T.scope) bScope(P, T.scope); else if (T.shade) bShade(P, T.shade); }
    else if (mod === 'mag' && T.mag) {
      const m = T.mag;
      if (m.twin) bTwin(P, m.twin); else if (m.drum) bDrum(P, m.drum); else if (m.tube) bTube(P, m.tube);
      else if (m.box) bBox(P, m.box); else if (m.can) bCan(P, m.can);
    } else if (mod === 'stock' && T.stock) { if (T.stock.pad) bPad(P, T.stock.pad); if (T.stock.cheek) bCheek(P, T.stock.cheek); }
    const out = P.done();
    return (CACHE[key] = out.length ? out : null);
  }

  function detach(W) {
    if (!W._wm) return;
    if (W._wm.parent) W._wm.parent.remove(W._wm);
    if (W._mz0) W.muzzle.copy(W._mz0);
    W._wm = null; W._mz0 = null;
  }
  function attach(W, mods, id) {
    if (!W || !W.g) return;
    detach(W);
    const T = TAB[id];
    if (!T || !mods || !mods.length) return;
    const M = mats();
    const grp = new THREE.Group();
    grp.name = 'wmods';
    grp.position.set(T.x || 0, 0, 0); grp.rotation.y = Math.atan(T.k || 0);
    grp.updateMatrix(); grp.matrixAutoUpdate = false;
    const seen = {};
    for (const mod of mods) {
      if (seen[mod]) continue;
      seen[mod] = 1;
      const parts = build(id, mod);
      if (!parts) continue;
      for (const pt of parts) {
        const mesh = new THREE.Mesh(pt.g, fm(M[pt.m]));
        mesh.name = 'wmod_' + mod; mesh.userData.wmod = mod;
        mesh.matrixAutoUpdate = false; mesh.castShadow = pt.m !== 'lens';
        grp.add(mesh);
      }
    }
    if (!grp.children.length) return;
    W.g.add(grp); W._wm = grp;
    // с глушителем вспышка и трассер — от его торца
    if (seen.supp && T.supp && W.muzzle) {
      const s = T.supp, zf = s[1] - s[3];
      W._mz0 = W.muzzle.clone();
      W.muzzle.set((T.x || 0) + (s[4] || 0) + (T.k || 0) * zf, s[0], zf);
    }
  }

  R3.wmods = { attach: attach, detach: detach, TAB: TAB };
})(window.DW);
