'use strict';
/* 3D-бой: ядро. Отрисовщик WebGL (three.js, game/js/lib/three.min.js), камера тактического вида (поворот на 90°,
   приближение, сдвиг, плавный перелёт к клетке), свет, загрузка моделей и материалов, выбор клетки лучом.
   Координаты: клетка (x, y) → мир (X = (x + 0.5)·T, Z = (y + 0.5)·T), уровень высоты h → Y = h·LV. */
(function (DW) {
  const THREE = window.THREE;
  const R3 = DW.R3 = { ok: false };
  if (!THREE) return;
  const T = R3.T = 1.28;          // клетка, м (как в запекании спрайтов)
  const LV = R3.LV = 1.5;         // уровень террасы, м (возвышенность — по плечо человеку; наверх — по лестнице)
  R3.WALL_H = 2.5;                // стена дома, м
  R3.THREE = THREE;

  /* ---------- Уровни качества ----------
     0 — слабый телефон: без теней, без сглаживания, текстуры 512, свет попроще;
     1 — средний: тени 1024, сглаживание выкл.; 2 — сильный: тени 2048 мягкие, сглаживание */
  R3.q = function () { return DW.gfxLevel ? DW.gfxLevel() : 2; };

  let renderer = null, canvas = null;
  R3.scene = null; R3.camera = null;
  R3.supported = function () {
    if (R3._sup !== undefined) return R3._sup;
    try { const c = document.createElement('canvas'); R3._sup = !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { R3._sup = false; }
    return R3._sup;
  };
  R3.ensure = function () {
    if (renderer) return true;
    if (!R3.supported()) return false;
    canvas = document.createElement('canvas');
    canvas.id = 'gl';
    const app = document.getElementById('app');
    app.insertBefore(canvas, app.firstChild);
    const q = R3.q();
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: q >= 2, powerPreference: 'high-performance', alpha: false, stencil: false });
    } catch (e) { console.error(e); canvas.remove(); canvas = null; R3._sup = false; return false; }
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = q >= 1;
    renderer.shadowMap.type = q >= 2 ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    R3.renderer = renderer;
    R3.maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    R3.scene = new THREE.Scene();
    R3.camera = new THREE.PerspectiveCamera(30, 1, 0.5, 220);
    R3.ok = true;
    return true;
  };
  R3.show = function (on) { if (canvas) canvas.style.display = on ? 'block' : 'none'; };
  R3.applyQuality = function () {
    if (!renderer) return;
    const q = R3.q();
    renderer.shadowMap.enabled = q >= 1;
    renderer.shadowMap.type = q >= 2 ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    if (R3.sun) {
      const s = q >= 2 ? 2048 : 1024;
      R3.sun.castShadow = q >= 1;
      if (R3.sun.shadow.mapSize.x !== s) { R3.sun.shadow.mapSize.set(s, s); if (R3.sun.shadow.map) { R3.sun.shadow.map.dispose(); R3.sun.shadow.map = null; } }
    }
    R3.scene && R3.scene.traverse(function (o) { if (o.material && o.material.needsUpdate !== undefined) o.material.needsUpdate = true; });
  };
  R3.resize = function (w, h, dpr) {
    if (!renderer) return;
    // чёткость 3D: потолок по уровню графики и масштаб, который снижает авто-FPS на слабом телефоне (до 0.6)
    const px = Math.max(0.5, Math.min(dpr || 1, [1.0, 1.35, 1.75][R3.q()]) * (R3.scale || 1));
    if (R3._sz !== w + 'x' + h + '@' + px) {
      R3._sz = w + 'x' + h + '@' + px;
      renderer.setPixelRatio(px);
      renderer.setSize(w, h, false);
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    }
    R3.camera.aspect = w / Math.max(1, h);
    R3.camera.updateProjectionMatrix();
    R3.view = { w: w, h: h };
  };
  R3.view = { w: 800, h: 450 };

  /* ---------- Координаты ---------- */
  R3.tileX = function (x) { return (x + 0.5) * T; };
  R3.tileZ = function (y) { return (y + 0.5) * T; };
  R3.hAt = function (x, y) {
    const B = DW.BT.get();
    if (!B || !B.hgt) return 0;
    const xi = Math.max(0, Math.min(B.w - 1, Math.round(x))), yi = Math.max(0, Math.min(B.h - 1, Math.round(y)));
    return B.hgt[yi * B.w + xi] * LV;
  };
  /* плавная высота для дробных координат (ход по уступам) */
  R3.hSmooth = function (x, y) {
    const B = DW.BT.get();
    if (!B || !B.hgt) return 0;
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    const h = function (a, b) { a = Math.max(0, Math.min(B.w - 1, a)); b = Math.max(0, Math.min(B.h - 1, b)); return B.hgt[b * B.w + a] * LV; };
    // ступенька, а не наклон: высота ближайшей клетки, сглаженная только на последних 30 % пути
    const near = h(Math.round(x), Math.round(y));
    const fx2 = Math.abs(fx - 0.5), fy2 = Math.abs(fy - 0.5);
    if (fx2 < 0.35 && fy2 < 0.35) return near;
    return near * 0.5 + (h(x0, y0) * (1 - fx) * (1 - fy) + h(x0 + 1, y0) * fx * (1 - fy) + h(x0, y0 + 1) * (1 - fx) * fy + h(x0 + 1, y0 + 1) * fx * fy) * 0.5;
  };
  R3.toWorld = function (x, y, lift) { return new THREE.Vector3(R3.tileX(x), R3.hSmooth(x, y) + (lift || 0), R3.tileZ(y)); };

  /* ---------- Камера ----------
     Вид сверху-сбоку под ~52°, по умолчанию с угла +x+y (как в изометрии 2D). yaw поворачивается на 90°. */
  const cam = R3.cam = { tx: 0, tz: 0, ty: 0, yaw: Math.PI / 4, yawTo: Math.PI / 4, pitch: 0.84, dist: 25, goal: null, shake: 0, waiters: [] };
  R3.camLimits = { dMin: 9, dMax: 42 };
  function camUpdate(dt) {
    const B = DW.BT.get();
    if (cam.goal) {
      const k = 1 - Math.exp(-dt * 6);
      cam.tx += (cam.goal[0] - cam.tx) * k; cam.tz += (cam.goal[1] - cam.tz) * k;
      if (cam.goal[2] !== undefined) cam.dist += (cam.goal[2] - cam.dist) * k;
      if (Math.hypot(cam.goal[0] - cam.tx, cam.goal[1] - cam.tz) < 0.08) { cam.goal = null; const w = cam.waiters; cam.waiters = []; w.forEach(function (f) { f(); }); }
    }
    // поворот на 90° — плавно
    const dy = cam.yawTo - cam.yaw;
    cam.yaw += dy * (1 - Math.exp(-dt * 7));
    // высота точки взгляда — по рельефу под ней (без рывков)
    if (B) { const th = R3.hAt(cam.tx / T - 0.5, cam.tz / T - 0.5); cam.ty += (th - cam.ty) * (1 - Math.exp(-dt * 3)); }
    clamp();
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    let ox = 0, oz = 0, oy = 0;
    if (cam.shake > 0.01) { ox = (Math.random() - 0.5) * cam.shake * 0.04; oz = (Math.random() - 0.5) * cam.shake * 0.04; oy = (Math.random() - 0.5) * cam.shake * 0.03; cam.shake *= Math.exp(-dt * 8); }
    const c = R3.camera;
    const ly = cam.ty + (cam.lift || 0);   // lift — подъём точки взгляда (крупный план, проверки)
    c.position.set(cam.tx + Math.sin(cam.yaw) * cp * cam.dist + ox, ly + sp * cam.dist + oy, cam.tz + Math.cos(cam.yaw) * cp * cam.dist + oz);
    c.lookAt(cam.tx + ox, ly + oy, cam.tz + oz);
    c.updateMatrixWorld();
  }
  R3.camUpdate = camUpdate;
  function clamp() {
    const B = DW.BT.get();
    if (!B) return;
    cam.dist = Math.max(R3.camLimits.dMin, Math.min(R3.camLimits.dMax, cam.dist));
    cam.tx = Math.max(-T, Math.min((B.w + 1) * T, cam.tx));
    cam.tz = Math.max(-T, Math.min((B.h + 1) * T, cam.tz));
  }
  /* сдвиг пальцем: экранные точки → земля (вправо по экрану и «вверх» по экрану) */
  R3.pan = function (dx, dy) {
    const k = cam.dist * Math.tan(R3.camera.fov * Math.PI / 360) * 2 / Math.max(1, R3.view.h);
    const rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);          // вправо на экране
    const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);         // «вверх» по экрану — от камеры по земле
    const up = k / Math.sin(cam.pitch);
    cam.tx -= rx * dx * k - fx * dy * up; cam.tz -= rz * dx * k - fz * dy * up;
    cam.goal = null;
    clamp();
  };
  R3.zoomAt = function (f, sx, sy) {
    const a = R3.groundAt(sx, sy);
    const d0 = cam.dist;
    cam.dist = Math.max(R3.camLimits.dMin, Math.min(R3.camLimits.dMax, cam.dist / f));
    if (a) {
      // точка под пальцем остаётся на месте
      const k = 1 - cam.dist / d0;
      cam.tx += (a.x - cam.tx) * k; cam.tz += (a.z - cam.tz) * k;
    }
    cam.goal = null;
    clamp();
  };
  R3.rotate = function (dir) { cam.yawTo += dir * Math.PI / 2; };
  R3.focus = function (x, y, force, dist) {
    const X = R3.tileX(x), Z = R3.tileZ(y);
    if (!force) {
      const s = R3.toScreen(new THREE.Vector3(X, R3.hAt(x, y) + 1, Z));
      const mx = R3.view.w * 0.2, myT = R3.view.h * 0.24, myB = R3.view.h * 0.26;
      if (s && s[0] > mx && s[0] < R3.view.w - mx && s[1] > myT && s[1] < R3.view.h - myB) return Promise.resolve();
    }
    cam.goal = [X, Z, dist];
    return new Promise(function (res) { cam.waiters.push(res); setTimeout(res, 700); });
  };
  R3.centerOn = function (X, Z, dist) { cam.tx = X; cam.tz = Z; if (dist) cam.dist = dist; cam.goal = null; clamp(); };

  /* ---------- Экран ↔ мир ---------- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  R3.ray = function (sx, sy) {
    ndc.set(sx / R3.view.w * 2 - 1, -(sy / R3.view.h) * 2 + 1);
    ray.setFromCamera(ndc, R3.camera);
    return ray;
  };
  /* точка на поверхности под экранной точкой: сначала верх клеток (рельеф), иначе плоскость y = 0 */
  R3.pickables = [];
  R3.groundAt = function (sx, sy) {
    const r = R3.ray(sx, sy);
    if (R3.pickables.length) {
      const hit = r.intersectObjects(R3.pickables, false)[0];
      if (hit) return hit.point;
    }
    const t = -r.ray.origin.y / r.ray.direction.y;
    return t > 0 ? r.ray.origin.clone().addScaledVector(r.ray.direction, t) : null;
  };
  R3.screenToTile = function (sx, sy) {
    const p = R3.groundAt(sx, sy);
    if (!p) return [-1, -1];
    return [Math.floor(p.x / T), Math.floor(p.z / T)];
  };
  const v3 = new THREE.Vector3();
  R3.toScreen = function (p) {
    v3.copy(p).project(R3.camera);
    if (v3.z > 1) return null;
    return [(v3.x + 1) / 2 * R3.view.w, (1 - v3.y) / 2 * R3.view.h, v3.z];
  };
  R3.tileToScreen = function (x, y, lift) { return R3.toScreen(R3.toWorld(x, y, lift === undefined ? 1.0 : lift)) || [-999, -999]; };

  /* ---------- Загрузка ---------- */
  const loader = new THREE.GLTFLoader();
  loader.setMeshoptDecoder(THREE.MeshoptDecoder);
  const glbCache = {};
  /* В APK игра открыта из файлов (file:///android_asset): fetch там не работает, а XMLHttpRequest — работает
     (WebView: setAllowFileAccessFromFileURLs). Поэтому файл читается через XHR и разбирается GLTFLoader.parse. */
  function xhrBuffer(url) {
    return new Promise(function (res, rej) {
      const x = new XMLHttpRequest();
      x.open('GET', url, true);
      x.responseType = 'arraybuffer';
      x.onload = function () { if ((x.status === 200 || x.status === 0) && x.response && x.response.byteLength) res(x.response); else rej(new Error('XHR ' + x.status)); };
      x.onerror = function () { rej(new Error('XHR ошибка')); };
      x.send();
    });
  }
  R3.loadGLB = function (url) {
    if (!glbCache[url]) glbCache[url] = new Promise(function (res) {
      const fail = function (e) { console.warn('3D: нет модели', url, e && e.message); res(null); };
      if (location.protocol === 'file:') {
        xhrBuffer(url).then(function (buf) {
          loader.parse(buf, url.replace(/[^/]*$/, ''), function (g) { res(g); }, fail);
        }, fail);
      } else loader.load(url, function (g) { res(g); }, undefined, fail);
    });
    return glbCache[url];
  };
  const texLoader = new THREE.TextureLoader();
  const texCache = {};
  /* Память текстур: на слабой графике картинки уменьшаются перед загрузкой в видеокарту (вчетверо меньше памяти
     и быстрее выборка). Сжатые форматы (KTX2/Basis) не используются: декодеру нужны Worker и WASM через fetch,
     а из file:// в WebView fetch не работает. Одна и та же картинка уменьшается один раз (общая для всех копий). */
  const capped = new WeakMap();
  R3.texCap = function () { return [256, 512, 1024][R3.q()]; };
  R3.capTex = function (t, max) {
    const img = t && t.image;
    if (!img || !max) return t;
    const w = img.width || 0, h = img.height || 0;
    if (!w || !h || Math.max(w, h) <= max) return t;
    let c = capped.get(img);
    if (!c) {
      const k = max / Math.max(w, h);
      c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
      try {
        const g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
        g.drawImage(img, 0, 0, c.width, c.height);
      } catch (e) { return t; }
      capped.set(img, c);
    }
    t.image = c; t.needsUpdate = true;
    return t;
  };
  // текстуры земли и стен (game/tex3d, 512): на слабой графике — 256
  const pend = new Map();   // копии ещё не загруженной текстуры: обновить, когда придёт картинка
  const texLoad = function (url) {
    return texLoader.load(url, function (t) {
      if (R3.q() === 0) R3.capTex(t, 256);
      const L = pend.get(t);
      if (L) { L.forEach(function (c) { c.needsUpdate = true; }); pend.delete(t); }
    });
  };
  R3.tex = function (url, srgb, rep) {
    const k = url + (srgb ? '|s' : '');
    if (texCache[k]) return texCache[k];
    const t = texLoad(url);
    t.wrapS = t.wrapT = rep === false ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    t.anisotropy = R3.maxAniso || 4;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return (texCache[k] = t);
  };
  /* отдельный экземпляр текстуры (свой repeat/offset): копия общей — картинка и память видеокарты одни на все копии
     (раньше каждая дорога в каждом бою грузила свою картинку заново и не освобождала) */
  R3.texNew = function (url, srgb) {
    const base = R3.tex(url, srgb), t = base.clone();
    if (base.image && base.image.width) t.needsUpdate = true;
    else { t.version = 0; const L = pend.get(base) || []; L.push(t); pend.set(base, L); }   // до загрузки — не выгружать пустую
    return t;
  };
  /* PBR-материал из game/tex3d: <вид>_c (цвет), _n (нормали), _a (AO/шероховатость/металл) */
  const matCache = {};
  R3.pbr = function (kind, o) {
    o = o || {};
    const key = kind + JSON.stringify(o);
    if (matCache[key]) return matCache[key];
    const m = new THREE.MeshStandardMaterial({
      map: R3.tex('tex3d/' + kind + '_c.jpg', true), normalMap: R3.tex('tex3d/' + kind + '_n.jpg'),
      roughnessMap: R3.tex('tex3d/' + kind + '_a.jpg'), metalnessMap: o.metal ? R3.tex('tex3d/' + kind + '_a.jpg') : null,
      aoMap: null, roughness: o.rough !== undefined ? o.rough : 1, metalness: o.metal ? 1 : 0, color: o.color !== undefined ? o.color : 0xffffff
    });
    m.normalScale.set(o.ns || 1, o.ns || 1);
    return (matCache[key] = m);
  };

  /* ---------- Кадр ---------- */
  R3.render = function () {
    if (!renderer) return;
    renderer.render(R3.scene, R3.camera);
  };
  R3.info = function () { return renderer ? renderer.info : null; };
})(window.DW);
