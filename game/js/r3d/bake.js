'use strict';
/* 3D-бой: запечённый свет статики. Раз на карту (и когда меняется солнце, рушится стена, встают модели) по сетке
   высот поля — рельеф, провалы, лестницы, стены и окна, низкие стенки, предметы и техника (по их треугольникам),
   сталагмиты — считается текстура (K точек на клетку):
     r — высота «верха тени»: точка ниже неё закрыта от солнца (луч к солнцу — проход по сетке со стороны солнца,
         одна выборка на точку);
     g — затенение у оснований: насколько закрыт горизонт вокруг (стены, уступы, ящики, машины — тёмная кайма
         у подножия);
     b — высота земли: затенение гаснет выше 0,9 м над землёй.
   Текстуру читают все материалы мира (R3.fogify): земля, стены, предметы, трава и бойцы темнеют в тени стены, у
   подножий — тёмная кайма. Карта теней в кадре рисует только бойцов и ажурное (деревья, фонари) — дешевле. */
(function (DW) {
  const R3 = DW.R3, THREE = R3 && R3.THREE;
  if (!THREE) return;
  const T = R3.T, LV = R3.LV;
  const BK = R3.bake = {};
  const H0 = -3.5, HR = 16;   // высоты в текстуре: от −3,5 до 12,5 м (шаг 6 см)
  let B = null, K = 5, ts = T / K, W = 0, Hh = 0;
  let G = null, O = null, M = null, data = null, tex = null;
  let models = [], cones = [], dirty = false, reqT = 0, sunKey = '';

  /* новое поле: сетка и текстура; первое запекание — в ближайшем кадре */
  BK.build = function (b) {
    B = b; models = []; cones = [];
    K = 5; ts = T / K;   // 0,256 м: стена (0,34 м) — ровно одна точка, грань стены не затеняет сама себя
    W = b.w * K; Hh = b.h * K;
    G = new Float32Array(W * Hh); O = new Float32Array(W * Hh); M = new Float32Array(W * Hh);
    data = new Uint8Array(W * Hh * 4);
    if (tex) tex.dispose();
    tex = new THREE.DataTexture(data, W, Hh, THREE.RGBAFormat);
    tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; tex.generateMipmaps = false;
    R3.giU.tGI.value = R3.giNeutral;
    BK.request(0);
  };
  /* перезапечь чуть позже (модели встают одна за другой — запекается один раз, когда все встали) */
  BK.request = function (delay) { dirty = true; reqT = performance.now() + (delay === undefined ? 300 : delay); };
  // сетку высот модели считаем сразу, когда она встала (модели приходят по одной — нагрузка размазана по кадрам)
  BK.addModel = function (obj) { if (!B) return; models.push({ o: obj, r: raster(obj) }); BK.request(); };
  /* конус (сталагмит) из мелких деталей: центр, радиус и верх, м */
  BK.addCone = function (x, z, r, top) { cones.push([x, z, r, top]); };
  /* каждый кадр (env.update): запечь, если пора */
  BK.tick = function () {
    if (!B || B !== DW.BT.get() || !R3.env || !R3.env.sunDir) return;
    const sd = R3.env.sunDir, k = sd.x.toFixed(3) + ',' + sd.y.toFixed(3) + ',' + sd.z.toFixed(3);
    if (k !== sunKey) dirty = true;
    if (!dirty || performance.now() < reqT) return;
    run();
  };

  /* ---------- Сетка высот ---------- */
  // поднять до top точки сетки с центрами внутри прямоугольника (м); тоньше точки — ближайшая точка
  function fill(x0, z0, x1, z1, top) {
    let i0 = Math.ceil(x0 / ts - 0.5), i1 = Math.floor(x1 / ts - 0.5), j0 = Math.ceil(z0 / ts - 0.5), j1 = Math.floor(z1 / ts - 0.5);
    if (i1 < i0) i0 = i1 = Math.round((x0 + x1) / 2 / ts - 0.5);
    if (j1 < j0) j0 = j1 = Math.round((z0 + z1) / 2 / ts - 0.5);
    i0 = Math.max(0, i0); j0 = Math.max(0, j0); i1 = Math.min(W - 1, i1); j1 = Math.min(Hh - 1, j1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = j * W + i; if (O[k] < top) O[k] = top; }
  }
  function base() {
    const w = B.w, hgt = B.hgt;
    // рельеф по клеткам; провал — на 2,5 м ниже
    for (let j = 0; j < Hh; j++) {
      const ty = (j / K) | 0;
      for (let i = 0; i < W; i++) { const t = ty * w + ((i / K) | 0); G[j * W + i] = hgt[t] * LV - (B.ground[t] === 10 ? 2.5 : 0); }
    }
    // марш лестницы — пандус к уступу
    (B.ladders || []).forEach(function (l) {
      if (!l.st) return;
      const h0 = hgt[l.y * w + l.x] * LV, h1 = hgt[l.ry * w + l.rx] * LV, gx = l.rx - l.x, gy = l.ry - l.y;
      for (let b2 = 0; b2 < K; b2++) for (let a = 0; a < K; a++) {
        const fx = (a + 0.5) / K, fz = (b2 + 0.5) / K;
        const t = gx > 0 ? fx : (gx < 0 ? 1 - fx : (gy > 0 ? fz : 1 - fz));
        G[(l.y * K + b2) * W + l.x * K + a] = h0 + (h1 - h0) * t;
      }
    });
    O.set(G);
    // стены (как в world.js buildWalls), окна — подоконник (свет проходит в проём), низкие стенки и частоколы
    const WL = R3.world.WALLS, OP = R3.world.open || {}, WH = R3.WALL_H, th = 0.17;
    const at = function (x, y) { return x < 0 || y < 0 || x >= w || y >= B.h ? -1 : B.obj[y * w + x]; };
    const isWall = function (x, y) { return !!WL[at(x, y)]; };
    const isOpen = function (x, y) { return x >= 0 && y >= 0 && x < w && y < B.h && !!OP[y * w + x]; };
    for (let y = 0; y < B.h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, o = B.obj[i], cx = (x + 0.5) * T, cz = (y + 0.5) * T, b0 = hgt[i] * LV;
      if (WL[o]) {
        const top = b0 + WH;
        fill(cx - th, cz - th, cx + th, cz + th, top);
        if (isWall(x + 1, y) || isOpen(x + 1, y)) fill(cx, cz - th, (x + 1) * T, cz + th, top);
        if (isWall(x - 1, y) || isOpen(x - 1, y)) fill(x * T, cz - th, cx, cz + th, top);
        if (isWall(x, y + 1) || isOpen(x, y + 1)) fill(cx - th, cz, cx + th, (y + 1) * T, top);
        if (isWall(x, y - 1) || isOpen(x, y - 1)) fill(cx - th, y * T, cx + th, cz, top);
        continue;
      }
      const op = OP[i];
      if (op) {
        if (op.kind === 'window') {
          if (op.ax === 0) fill(x * T, cz - th, (x + 1) * T, cz + th, b0 + 0.92); else fill(cx - th, y * T, cx + th, (y + 1) * T, b0 + 0.92);
        }
        continue;
      }
      if (o === 1 || o === 13) {
        const hh = o === 1 ? 0.92 : 1.15, t2 = o === 1 ? 0.2 : 0.16, top = b0 + hh;
        const same = function (xx, yy) { const q = at(xx, yy); return q === o || WL[q]; };
        fill(cx - t2, cz - t2, cx + t2, cz + t2, top);
        if (same(x + 1, y)) fill(cx, cz - t2, (x + 1) * T, cz + t2, top);
        if (same(x - 1, y)) fill(x * T, cz - t2, cx, cz + t2, top);
        if (same(x, y + 1)) fill(cx - t2, cz, cx + t2, (y + 1) * T, top);
        if (same(x, y - 1)) fill(cx - t2, y * T, cx + t2, cz, top);
        if (!same(x + 1, y) && !same(x - 1, y) && !same(x, y + 1) && !same(x, y - 1)) fill(x * T + 0.1, cz - t2, (x + 1) * T - 0.1, cz + t2, top);
      }
    }
    // сталагмиты: конус
    cones.forEach(function (c) {
      const r = c[2], b0 = c[3];
      for (let j = Math.max(0, Math.floor((c[1] - r) / ts)); j <= Math.min(Hh - 1, Math.floor((c[1] + r) / ts)); j++)
        for (let i = Math.max(0, Math.floor((c[0] - r) / ts)); i <= Math.min(W - 1, Math.floor((c[0] + r) / ts)); i++) {
          const d = Math.hypot((i + 0.5) * ts - c[0], (j + 0.5) * ts - c[1]) / r;
          if (d < 1) { const k = j * W + i, top = G[k] + (b0 - G[k]) * (1 - d); if (O[k] < top) O[k] = top; }
        }
    });
  }
  /* модель (предмет, машина) → точки сетки и высота над ними: по треугольникам, один раз на модель */
  const vA = new THREE.Vector3();
  let scr = null, touched = null;   // рабочий слой сетки (без Map — быстрее)
  function scratch() { if (!scr || scr.length !== W * Hh) { scr = new Float32Array(W * Hh).fill(-1e9); touched = new Int32Array(W * Hh); } return scr; }
  function raster(obj) {
    obj.updateMatrixWorld(true);
    scratch();
    let nt = 0;
    const put = function (i, j, top) {
      if (i < 0 || j < 0 || i >= W || j >= Hh) return;
      const k = j * W + i;
      if (scr[k] === -1e9) touched[nt++] = k;
      if (scr[k] < top) scr[k] = top;
    };
    obj.traverse(function (m) {
      if (!m.isMesh || !m.geometry || !m.geometry.attributes.position) return;
      const pos = m.geometry.attributes.position, idx = m.geometry.index, n = pos.count, e = m.matrixWorld.elements;
      const P = new Float32Array(n * 3);
      for (let v = 0; v < n; v++) {
        const x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v);
        P[v * 3] = (e[0] * x + e[4] * y + e[8] * z + e[12]) / ts; P[v * 3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; P[v * 3 + 2] = (e[2] * x + e[6] * y + e[10] * z + e[14]) / ts;
      }
      const ia = idx ? idx.array : null, cnt = idx ? idx.count : n;
      for (let t = 0; t + 2 < cnt; t += 3) {
        const a = (ia ? ia[t] : t) * 3, b = (ia ? ia[t + 1] : t + 1) * 3, c = (ia ? ia[t + 2] : t + 2) * 3;
        const top = Math.max(P[a + 1], P[b + 1], P[c + 1]);
        const ax = P[a], az = P[a + 2], bx = P[b], bz = P[b + 2], cx = P[c], cz = P[c + 2];
        const i0 = Math.floor(Math.min(ax, bx, cx)), i1 = Math.floor(Math.max(ax, bx, cx)), j0 = Math.floor(Math.min(az, bz, cz)), j1 = Math.floor(Math.max(az, bz, cz));
        if (i1 - i0 <= 1 && j1 - j0 <= 1) { for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) put(i, j, top); continue; }
        // крупный треугольник: точки сетки внутри него (и его вершины)
        put(Math.floor(ax), Math.floor(az), top); put(Math.floor(bx), Math.floor(bz), top); put(Math.floor(cx), Math.floor(cz), top);
        const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
        if (Math.abs(d) < 1e-9) continue;
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          const px = i + 0.5, pz = j + 0.5;
          const l1 = ((bz - cz) * (px - cx) + (cx - bx) * (pz - cz)) / d, l2 = ((cz - az) * (px - cx) + (ax - cx) * (pz - cz)) / d;
          if (l1 >= -0.05 && l2 >= -0.05 && l1 + l2 <= 1.05) put(i, j, top);
        }
      }
    });
    const r = { i: new Int32Array(nt), h: new Float32Array(nt) };
    for (let q = 0; q < nt; q++) { const k = touched[q]; r.i[q] = k; r.h[q] = scr[k]; scr[k] = -1e9; }
    return r;
  }

  /* ---------- Запекание ---------- */
  const enc = function (h) { const v = (h - H0) / HR * 255; return v < 0 ? 0 : (v > 255 ? 255 : Math.round(v)); };
  function run() {
    dirty = false;
    const t0 = performance.now();
    const sd = R3.env.sunDir;
    sunKey = sd.x.toFixed(3) + ',' + sd.y.toFixed(3) + ',' + sd.z.toFixed(3);
    base();
    const t1 = performance.now();
    // модели, ещё стоящие на поле (разбитые убраны из сцены)
    models = models.filter(function (q) { return q.o.parent; });
    models.forEach(function (q) {
      if (!q.r) q.r = raster(q.o);
      const r = q.r;
      for (let k = 0; k < r.i.length; k++) { const i = r.i[k]; if (O[i] < r.h[k]) O[i] = r.h[k]; }
    });
    const t2 = performance.now();
    // тень: проход от солнца. S(p) = max(O, S)(p + шаг к солнцу) − подъём луча за шаг; шаг — одна точка сетки
    // по главной оси, по второй — дробный (линейно между соседями): одна выборка на точку
    const hl = Math.hypot(sd.x, sd.z), S = M;
    if (hl < 0.02) { for (let k = 0; k < S.length; k++) S[k] = -100; }
    else {
      const ux = sd.x / hl, uz = sd.z / hl, tanE = sd.y / hl;
      const alongX = Math.abs(ux) >= Math.abs(uz);
      const sa = alongX ? Math.sign(ux) : Math.sign(uz), f = alongX ? uz / Math.abs(ux) : ux / Math.abs(uz);
      const rise = ts / Math.max(Math.abs(ux), Math.abs(uz)) * tanE;
      const NA = alongX ? W : Hh, NB = alongX ? Hh : W;
      const idx = alongX ? function (a, b) { return b * W + a; } : function (a, b) { return a * W + b; };
      const top = function (a, b) { const k = idx(a, b); return O[k] > S[k] ? O[k] : S[k]; };
      for (let s = 0; s < NA; s++) {
        const a = sa > 0 ? NA - 1 - s : s, a1 = a + sa;
        for (let b = 0; b < NB; b++) {
          const k = idx(a, b);
          if (a1 < 0 || a1 >= NA) { S[k] = -100; continue; }
          const pb = b + f, b0 = Math.floor(pb), fr = pb - b0;
          let v;
          if (b0 < 0 || b0 + 1 >= NB) v = b0 >= 0 && b0 < NB ? top(a1, b0) : (b0 + 1 >= 0 && b0 + 1 < NB ? top(a1, b0 + 1) : -100);
          else v = top(a1, b0) * (1 - fr) + top(a1, b0 + 1) * fr;
          S[k] = v - rise;
        }
      }
    }
    const t3 = performance.now();
    // затенение у оснований: 8 направлений, 2 расстояния (0,26 и 0,66 м); закрытость = тангенс угла горизонта. Сначала — максимум
    // высоты в окне ±3 точки (два прохода): на открытом месте затенения нет, считать нечего
    const RD = 3, D = scratch(), D2 = S;
    // верх тени — сразу в текстуру; дальше слой S свободен и идёт под окно максимумов
    for (let k = 0; k < W * Hh; k++) data[k * 4] = enc(Math.max(S[k], G[k] - 0.35));
    for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
      let m = -1e9;
      for (let a = Math.max(0, i - RD); a <= Math.min(W - 1, i + RD); a++) { const v = O[j * W + a]; if (v > m) m = v; }
      D2[j * W + i] = m;
    }
    for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
      let m = -1e9;
      for (let b = Math.max(0, j - RD); b <= Math.min(Hh - 1, j + RD); b++) { const v = D2[b * W + i]; if (v > m) m = v; }
      D[j * W + i] = m;
    }
    const OFF = [];
    const R = [1, 2.6], NR = R.length, DX = [1, 0.7071, 0, -0.7071, -1, -0.7071, 0, 0.7071], DZ = [0, 0.7071, 1, 0.7071, 0, -0.7071, -1, -0.7071];
    for (let d = 0; d < 8; d++) for (let r = 0; r < NR; r++) { const di = Math.round(DX[d] * R[r]), dj = Math.round(DZ[d] * R[r]); OFF.push(di, dj, 1 / (Math.hypot(di, dj) * ts)); }
    for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
      const k = j * W + i, g = G[k];
      let ao = 1;
      if (D[k] > g + 0.05) {
        let occ = 0;
        const inner = i >= RD && j >= RD && i < W - RD && j < Hh - RD;
        for (let d = 0; d < 8; d++) {
          let m = 0;
          for (let r = 0; r < NR; r++) {
            const o = (d * NR + r) * 3, ii = i + OFF[o], jj = j + OFF[o + 1];
            if (!inner && (ii < 0 || jj < 0 || ii >= W || jj >= Hh)) continue;
            const tn = (O[jj * W + ii] - g) * OFF[o + 2];
            if (tn > m) m = tn;
          }
          occ += m / (1 + m);
        }
        ao = 1 - 0.9 * occ / 8;
      }
      data[k * 4 + 1] = Math.round(Math.max(0, Math.min(1, ao)) * 255); data[k * 4 + 2] = enc(g); data[k * 4 + 3] = 255;
    }
    D.fill(-1e9);
    tex.needsUpdate = true;
    R3.giU.tGI.value = tex;
    BK.ms = performance.now() - t0;
    BK.parts = [t1 - t0, t2 - t1, t3 - t2, performance.now() - t3].map(function (v) { return +v.toFixed(1); });
    BK.runs = (BK.runs || 0) + 1;
  }
  /* для проверки: высота верха тени и затенение в точке (м) */
  BK.probe = function (x, z) {
    if (!data) return null;
    const i = Math.max(0, Math.min(W - 1, Math.floor(x / ts))), j = Math.max(0, Math.min(Hh - 1, Math.floor(z / ts))), k = j * W + i;
    return { hs: H0 + data[k * 4] / 255 * HR, ao: data[k * 4 + 1] / 255, g: G[k], o: O[k] };
  };
})(window.DW);
