'use strict';
/* global THREE */
// =====================================================================
//  КАМПАНИЯ: фрегат «Вестник» на орбите, операции, отряд, наём, арсенал, исследования.
//  Подключается после game.js и пользуется его общими функциями (сцена, модели, бой).
// =====================================================================
const cnv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const crd = n => '◈ ' + Math.round(n).toLocaleString('ru-RU');

// ---------- шум для планет: значение на решётке + сглаживание, несколько октав
function hash3(x, y, z, s) { let h = (x * 374761393 + y * 668265263 + z * 1440662683 + s * 144665) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function vnoise(x, y, z, s) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const c = (a, b, d) => hash3(ix + a, iy + b, iz + d, s);
  return lerp(lerp(lerp(c(0, 0, 0), c(1, 0, 0), u), lerp(c(0, 1, 0), c(1, 1, 0), u), v), lerp(lerp(c(0, 0, 1), c(1, 0, 1), u), lerp(c(0, 1, 1), c(1, 1, 1), u), v), w);
}
function fbm(x, y, z, s, oct) { let a = 0.5, f = 1, sum = 0, n = 0; for (let i = 0; i < oct; i++) { sum += a * vnoise(x * f, y * f, z * f, s + i); n += a; a *= 0.5; f *= 2.03; } return sum / n; }
function rampLUT(stops) {
  const lut = [], rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  for (let i = 0; i < 256; i++) {
    const t = i / 255; let k = 0; while (k < stops.length - 2 && t > stops[k + 1][0]) k++;
    const [t0, c0] = stops[k], [t1, c1] = stops[k + 1], f = clamp((t - t0) / (t1 - t0), 0, 1), a = rgb(c0), b = rgb(c1);
    lut.push([lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)]);
  }
  return lut;
}

// склейка геометрий без индексов (позиции, нормали, UV) в одну — один вызов отрисовки на материал
function mergeGeos(list) {
  const out = new THREE.BufferGeometry();
  for (const [name, size] of [['position', 3], ['normal', 3], ['uv', 2]]) {
    const n = list.reduce((a, g) => a + g.attributes.position.count, 0), arr = new Float32Array(n * size); let o = 0;
    for (const g of list) { const at = g.attributes[name], c = g.attributes.position.count; if (at) arr.set(at.array.subarray(0, c * size), o); o += c * size; }
    out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  return out;
}

// =====================================================================
//  КОРАБЛЬ-БАЗА: своя 3D-сцена — звёзды, планета операции, фрегат, эскорт, вылет канонерки
// =====================================================================
const PLANET_LOOK = {
  desert: { ramp: [[0, '#4a200e'], [0.38, '#8e4620'], [0.55, '#c47a3c'], [0.72, '#e2a768'], [1, '#f7dcae']], bands: 0.2, cloud: [0.6, 0.35, 0xfff2e0], atmo: 0xffa86a, caps: false, scale: 2.2 },
  ice: { ramp: [[0, '#14304e'], [0.44, '#2c5a80'], [0.5, '#86a3bd'], [0.62, '#cbdae8'], [1, '#ffffff']], bands: 0.05, cloud: [0.55, 0.65, 0xffffff], atmo: 0x9fd0ff, caps: true, scale: 2.6 },
  storm: { ramp: [[0, '#06111c'], [0.47, '#123049'], [0.51, '#2a4434'], [0.7, '#3b583c'], [1, '#6b7a62']], bands: 0.04, cloud: [0.44, 0.9, 0x98a6b8], atmo: 0x6f9cff, caps: false, scale: 2.4 },
};
const Hub = (() => {
  const sc = new THREE.Scene(), cam3 = new THREE.PerspectiveCamera(36, 1, 0.1, 4000);
  const ship = new THREE.Group(), escorts = [], blinkers = [], engines = [], mods = {}, texCache = {};
  const P_POS = new THREE.Vector3(34, -40, -112), P_R = 50;
  const rimU = { value: new THREE.Color(0x9fd0ff) };
  let planet, clouds, atmo, built = false, t = 0, W = 1, H = 1, off = 0, toff = 0, dist = 26, tdist = 26, curPlanet = null, flash = 0, launch = null;
  const glow = glowTex();
  const spr = (col, s, op = 1) => { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: col, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false })); m.scale.setScalar(s); return m; };

  // звёздное небо с туманностями: одна текстура на сфере вокруг сцены
  function spaceTex() {
    const w = 2048, h = 1024, c = cnv(w, h), g = c.getContext('2d'), R = rng(77);
    g.fillStyle = '#02040a'; g.fillRect(0, 0, w, h);
    const neb = ['70,90,210', '130,60,190', '30,140,170', '200,80,130', '60,120,220'];
    for (let i = 0; i < 34; i++) {
      const x = R() * w, y = h * (0.3 + R() * 0.4), r = 90 + R() * 300, col = neb[Math.floor(R() * neb.length)], a = 0.04 + R() * 0.09;
      for (const dx of [-w, 0, w]) { const gr = g.createRadialGradient(x + dx, y, 0, x + dx, y, r); gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gr; g.fillRect(x + dx - r, y - r, r * 2, r * 2); }
    }
    for (let i = 0; i < 5200; i++) {
      const x = R() * w, y = h * (0.5 + (R() - 0.5) * (R() < 0.6 ? 0.55 : 1)), m = R(), s = m < 0.97 ? 0.4 + R() * 0.8 : 1.2 + R() * 1.2;
      const tint = R(); g.fillStyle = `rgba(${tint < 0.2 ? '255,214,180' : tint < 0.45 ? '190,215,255' : '255,255,255'},${0.35 + R() * 0.65})`;
      g.beginPath(); g.arc(x, y, s, 0, 7); g.fill();
      if (s > 1.6) { const gr = g.createRadialGradient(x, y, 0, x, y, s * 6); gr.addColorStop(0, 'rgba(200,220,255,.35)'); gr.addColorStop(1, 'rgba(200,220,255,0)'); g.fillStyle = gr; g.fillRect(x - s * 6, y - s * 6, s * 12, s * 12); }
    }
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
  }
  // поверхность и облака планеты по виду локации. Считаются порциями строк в фоне (в меню не подтормаживает)
  // и кэшируются; если планета нужна раньше, остаток досчитывается сразу
  const jobs = {};
  function planetJob(id) {
    if (jobs[id]) return jobs[id];
    const L = PLANET_LOOK[id], w = 512, h = 256, s = hashStr(id) % 97, lut = rampLUT(L.ramp);
    const c = cnv(w, h), g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data;
    const cc = cnv(w, h), cg = cc.getContext('2d'), cimg = cg.createImageData(w, h), cd = cimg.data;
    let y = 0;
    const step = rows => {
      for (const y1 = Math.min(h, y + rows); y < y1; y++) {
        const lat = (y / (h - 1) - 0.5) * Math.PI, cl = Math.cos(lat), sy = Math.sin(lat);
        for (let x = 0; x < w; x++) {
          const lon = x / w * Math.PI * 2, px = cl * Math.cos(lon), pz = cl * Math.sin(lon);
          let v = fbm(px * L.scale, sy * L.scale, pz * L.scale, s, 5);
          v += Math.sin(sy * 18 + v * 7) * L.bands * 0.5;
          v = clamp((v - 0.26) / 0.5, 0, 1);
          if (L.caps) v = Math.max(v, clamp((Math.abs(sy) - 0.8) * 6, 0, 1));
          const k = (y * w + x) * 4, col = lut[Math.round(v * 255)];
          d[k] = col[0]; d[k + 1] = col[1]; d[k + 2] = col[2]; d[k + 3] = 255;
          const cv = fbm(px * 3 + 5, sy * 4.4, pz * 3 - 3, s + 11, 3);
          cd[k] = cd[k + 1] = cd[k + 2] = 255; cd[k + 3] = clamp((cv - L.cloud[0]) / 0.16, 0, 1) * L.cloud[1] * 255;
        }
      }
      if (y >= h && !texCache[id]) {
        g.putImageData(img, 0, 0); cg.putImageData(cimg, 0, 0);
        const T = x => { const t = new THREE.CanvasTexture(x); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t; };
        texCache[id] = { map: T(c), cloud: T(cc) };
      }
    };
    return (jobs[id] = { step });
  }
  function planetTex(id) { if (!texCache[id]) planetJob(id).step(1e9); return texCache[id]; }
  function prepPlanets() { const id = Object.keys(PLANET_LOOK).find(i => !texCache[i]); if (!id) return; planetJob(id).step(8); setTimeout(prepPlanets, 40); }
  // светлая обшивка с панелями: текстура повторяется по корпусу
  function hullTex() {
    const c = cnv(256, 256), g = c.getContext('2d'), R = rng(5);
    g.fillStyle = '#c9ced4'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 60; i++) { const x = Math.floor(R() * 8) * 32, y = Math.floor(R() * 8) * 32, w = 32 * (1 + Math.floor(R() * 3)), hh = 32 * (1 + Math.floor(R() * 2)); const v = 190 + R() * 40; g.fillStyle = `rgb(${v},${v + 3},${v + 7})`; g.fillRect(x, y, w, hh); }
    g.strokeStyle = 'rgba(40,46,54,.55)'; g.lineWidth = 1.2;
    for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(0, i * 32 + 0.5); g.lineTo(256, i * 32 + 0.5); g.stroke(); }
    for (let i = 0; i < 40; i++) { const x = Math.floor(R() * 8) * 32 + 0.5, y = Math.floor(R() * 8) * 32; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 32); g.stroke(); }
    g.fillStyle = 'rgba(30,34,40,.35)'; for (let i = 0; i < 90; i++) g.fillRect(R() * 256, R() * 256, 2 + R() * 6, 1.5);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
  }

  function buildShip() {
    const ht = hullTex(); ht.repeat.set(0.22, 0.22);
    const HM = {
      hull: new THREE.MeshStandardMaterial({ color: 0xffffff, map: ht, roughness: 0.42, metalness: 0.35 }),
      hullD: new THREE.MeshStandardMaterial({ color: 0x8c939c, roughness: 0.5, metalness: 0.45 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x2a2e34, roughness: 0.55, metalness: 0.5 }),
      red: new THREE.MeshStandardMaterial({ color: 0xa8262a, roughness: 0.45, metalness: 0.2 }),
      glass: new THREE.MeshStandardMaterial({ color: 0x0b1420, roughness: 0.1, metalness: 0.9, emissive: 0x2f78b0, emissiveIntensity: 0.7 }),
      lit: new THREE.MeshBasicMaterial({ color: 0xffe2b0 }), engine: new THREE.MeshBasicMaterial({ color: 0xcdeeff }),
    };
    const parts = new Map(), add = (geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const g = geo.index ? geo.toNonIndexed() : geo; g.applyMatrix4(M4(x, y, z, rx, ry, rz, 1, 1, 1)); if (!parts.has(m)) parts.set(m, []); parts.get(m).push(g); };
    const layer = (pts, sx, sz, dx, depth, y, m, bev = 0.18) => {
      const shp = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x * sx + dx, z * sz)));
      const g = new THREE.ExtrudeGeometry(shp, { depth, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 1, curveSegments: 1 });
      g.rotateX(-Math.PI / 2); add(g, m, 0, y, 0);
    };
    // корпус-клинок: нижний пояс, основная палуба, верхняя палуба, хребет
    const HULL = [[7.6, 0], [2, 1.5], [-1.5, 3.3], [-6.4, 3.5], [-7.2, 2.8], [-7.2, -2.8], [-6.4, -3.5], [-1.5, -3.3], [2, -1.5]];
    layer(HULL, 0.93, 0.9, -0.2, 0.5, -0.78, HM.hullD);
    layer(HULL, 1, 1, 0, 0.7, -0.26, HM.hull);
    layer(HULL, 0.72, 0.62, -1.3, 0.45, 0.46, HM.hull, 0.14);
    layer([[3.2, 0], [-1, 0.9], [-6, 1.15], [-6, -1.15], [-1, -0.9]], 1, 1, 0, 0.42, 0.95, HM.hull, 0.1);
    // красные метки Республики: стрела на носу и полосы вдоль бортов
    layer([[7.2, 0], [5, 0.66], [5, -0.66]], 1, 1, 0, 0.02, 0.63, HM.red, 0.01);
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(4.4, 0.03, 0.28), HM.red, -4.1, 0.64, s * 2.8);
    // мостик на корме с окнами и антеннами
    add(new THREE.BoxGeometry(1.4, 1.1, 1.1), HM.hull, -4.7, 1.8, 0);
    add(new THREE.BoxGeometry(1.7, 0.46, 2.8), HM.hull, -4.6, 2.5, 0);
    add(new THREE.BoxGeometry(0.06, 0.13, 2.4), HM.glass, -3.74, 2.52, 0);
    for (const s of [-1, 1]) add(new THREE.SphereGeometry(0.32, 14, 10), HM.hullD, -5, 2.88, s * 0.95);
    add(new THREE.CylinderGeometry(0.03, 0.03, 1.3, 6), HM.dark, -5.2, 3.35, 0);
    // двигатели
    for (const [z, r] of [[-1.9, 0.72], [0, 0.95], [1.9, 0.72]]) {
      add(new THREE.CylinderGeometry(r, r * 1.12, 1.7, 20), HM.dark, -7.55, 0.02, z, 0, 0, Math.PI / 2);
      add(new THREE.CylinderGeometry(r * 1.15, r * 1.15, 0.14, 20), HM.hullD, -8.35, 0.02, z, 0, 0, Math.PI / 2);
      add(new THREE.CircleGeometry(r * 0.86, 20), HM.engine, -8.43, 0.02, z, 0, -Math.PI / 2, 0);
      const g = spr(0x8fd0ff, r * 3.6, 0.9); g.position.set(-8.6, 0.02, z); ship.add(g); engines.push({ s: g, base: r * 3.6 });
      const pl = spr(0x5aa8ff, r * 6, 0.35); pl.position.set(-9.8, 0.02, z); ship.add(pl); engines.push({ s: pl, base: r * 6 });
    }
    // ангары по бортам и ряды иллюминаторов
    const R = rng(9);
    for (const s of [-1, 1]) {
      add(new THREE.BoxGeometry(2.7, 0.5, 0.06), HM.dark, -3.4, 0.08, s * 3.55);
      add(new THREE.BoxGeometry(2.4, 0.32, 0.05), HM.lit, -3.4, 0.08, s * 3.57);
      for (let x = -6.3; x < -1.7; x += 0.32) for (const y of [-0.42, 0.3]) if (R() < 0.55 && !(y > 0 && x > -4.8 && x < -2)) add(new THREE.BoxGeometry(0.1, 0.06, 0.04), HM.lit, x, y, s * (3.56 + (y < 0 ? -0.1 : 0)));
    }
    // надстройки и турели на палубе
    for (let i = 0; i < 46; i++) {
      const x = -5.6 + R() * 7.5, wz = x < -1 ? 1.7 : 0.8, z = (R() * 2 - 1) * wz, w = 0.12 + R() * 0.5, d = 0.12 + R() * 0.4, hh = 0.06 + R() * 0.2;
      add(new THREE.BoxGeometry(w, hh, d), R() < 0.5 ? HM.hullD : HM.dark, x, 1.08 + hh / 2, z);
    }
    for (const [x, z] of [[1.2, 0.85], [1.2, -0.85], [-2.4, 1.8], [-2.4, -1.8]]) {
      add(new THREE.CylinderGeometry(0.22, 0.27, 0.16, 12), HM.dark, x, 1.12, z);
      for (const b of [-0.06, 0.06]) add(new THREE.BoxGeometry(0.62, 0.05, 0.05), HM.dark, x + 0.3, 1.2, z + b);
    }
    for (const [m, list] of parts) { const g = mergeGeos(list); list.forEach(x => x.dispose()); ship.add(new THREE.Mesh(g, m)); }
    // ходовые огни: красный — левый борт, зелёный — правый, белый — нос
    for (const [x, y, z, c] of [[-6.4, 0.2, 3.65, 0xff3030], [-6.4, 0.2, -3.65, 0x30ff60], [7.7, 0.25, 0, 0xffffff]]) { const b = spr(c, 0.9); b.position.set(x, y, z); ship.add(b); blinkers.push(b); }
    // улучшения корабля видны снаружи: десантные модули и антенна сканера
    const pod = s => { const g = new THREE.Group(); g.add(at(new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 2.4, 4, 12), HM.hull), 0, 0, 0, 0, 0, Math.PI / 2)); g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.18, 14), HM.red), 0.6, 0, 0, 0, 0, Math.PI / 2)); g.position.set(-2.8, -1.12, s * 1.45); ship.add(g); return g; };
    mods.drop1 = pod(1); mods.drop2 = pod(-1);
    mods.scanner = new THREE.Group();
    mods.scanner.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.62, 18, 8, 0, Math.PI * 2, 0, 1.0), HM.hullD), 0, 0.2, 0, Math.PI, 0, 0));
    mods.scanner.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.6, 8), HM.dark), 0, -0.1, 0));
    mods.scanner.position.set(-4.2, 3.05, 0); mods.scanner.rotation.z = 0.5; ship.add(mods.scanner);
    mods.armor = new THREE.Group();
    for (const s of [-1, 1]) mods.armor.add(at(new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.42, 0.12), HM.hullD), -4.4, -0.55, s * 3.62));
    ship.add(mods.armor);
    sc.add(ship);
  }
  function fighter() {
    const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: 0xd8dce2, roughness: 0.4, metalness: 0.4 }), r = new THREE.MeshStandardMaterial({ color: 0xa8262a, roughness: 0.5 });
    g.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.75, 6), m), 0.1, 0, 0, 0, 0, -Math.PI / 2));
    g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.025, 0.8), m), -0.08, 0, 0));
    g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.8), r), -0.08, 0.01, 0));
    const e = spr(0x8fc8ff, 0.5); e.position.x = -0.3; g.add(e); return g;
  }
  function gunshipModel() {
    const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: 0xdde1e6, roughness: 0.4, metalness: 0.35 }), r = new THREE.MeshStandardMaterial({ color: 0xa8262a, roughness: 0.5 });
    g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.32, 0.42), m), 0, 0, 0));
    g.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 8), m), 0.68, 0, 0, 0, 0, -Math.PI / 2));
    g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 1.5), m), -0.1, 0.12, 0, 0.12, 0, 0));
    g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 1.5), r), -0.05, 0.15, 0, 0.12, 0, 0));
    for (const s of [-1, 1]) { const e = spr(0x9fd8ff, 1.5); e.position.set(-0.5, 0, s * 0.16); g.add(e); }
    const tr = spr(0x6fb8ff, 3.2, 0.5); tr.position.set(-1.4, 0, 0); tr.scale.set(3.2, 0.9, 1); g.add(tr);
    g.visible = false; sc.add(g); return g;
  }
  let gunship = null;

  function build() {
    if (built) return; built = true;
    const sky = new THREE.Mesh(new THREE.SphereGeometry(1800, 48, 24), new THREE.MeshBasicMaterial({ map: spaceTex(), side: THREE.BackSide, depthWrite: false, toneMapped: false }));
    sky.rotation.set(0.3, 0, 0.25); sc.add(sky);
    sc.environment = envMap(['#0c1630', '#1b2a48', '#141820', '#05070c'], 0xffffff);
    sc.add(new THREE.HemisphereLight(0x8ea8d8, 0x0a0a12, 0.45));
    const sunL = new THREE.DirectionalLight(0xfff0dc, 2.6); sunL.position.set(-50, 60, 45); sc.add(sunL);
    const rimL = new THREE.DirectionalLight(0x5f8cff, 0.9); rimL.position.set(60, -10, -50); sc.add(rimL);
    // далёкое солнце вверху слева: блик и ореол
    const sun1 = spr(0xfff2dc, 160, 0.9), sun2 = spr(0xffc890, 520, 0.35); for (const s of [sun1, sun2]) { s.position.set(-700, 760, -1100); s.material.toneMapped = false; sc.add(s); }
    // планета: поверхность с контровым светом атмосферы, облака, ореол
    const pm = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0 });
    pm.onBeforeCompile = sh => { // контровой свет атмосферы по краю диска, цвет — свой у каждой планеты
      sh.uniforms.rimColor = rimU;
      sh.fragmentShader = 'uniform vec3 rimColor;\n' + sh.fragmentShader.replace('#include <output_fragment>',
        'float rimF = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 3.0);\noutgoingLight += rimColor * rimF * 1.6;\n#include <output_fragment>');
    };
    planet = new THREE.Mesh(new THREE.SphereGeometry(P_R, 72, 36), pm); planet.position.copy(P_POS); planet.rotation.z = 0.32; sc.add(planet);
    clouds = new THREE.Mesh(new THREE.SphereGeometry(P_R * 1.012, 72, 36), new THREE.MeshStandardMaterial({ transparent: true, depthWrite: false, roughness: 1 })); clouds.position.copy(P_POS); clouds.rotation.z = 0.32; sc.add(clouds);
    atmo = spr(0x9fd0ff, P_R * 2.75, 0.55); atmo.position.copy(P_POS); atmo.renderOrder = -1; sc.add(atmo);
    buildShip();
    for (let i = 0; i < 3; i++) { const f = fighter(); f.userData = { r: 9 + i * 1.8, y: 1.2 - i * 1.4, sp: 0.22 + i * 0.05, ph: i * 2.1 }; sc.add(f); escorts.push(f); }
    gunship = gunshipModel();
    setPlanet('desert'); setTimeout(prepPlanets, 1500);
  }
  function setPlanet(id) {
    if (!built || id === curPlanet) return; curPlanet = id;
    const tx = planetTex(id), L = PLANET_LOOK[id];
    planet.material.map = tx.map; planet.material.needsUpdate = true;
    clouds.material.map = tx.cloud; clouds.material.color.set(L.cloud[2]); clouds.material.needsUpdate = true;
    atmo.material.color.set(L.atmo); rimU.value.set(L.atmo); flash = 1;
  }
  function setMods(r) { if (!built) return; mods.drop1.visible = !!r.drop1; mods.drop2.visible = !!r.drop2; mods.scanner.visible = !!r.scanner; mods.armor.visible = !!r.armor; }
  function update(dt) {
    t += dt; const kk = 1 - Math.exp(-dt * 3); off = lerp(off, toff, kk); dist = lerp(dist, tdist, kk);
    ship.position.y = Math.sin(t * 0.5) * 0.12; ship.rotation.z = Math.sin(t * 0.33) * 0.015; ship.rotation.x = Math.sin(t * 0.27) * 0.02;
    planet.rotation.y += dt * 0.01; clouds.rotation.y += dt * 0.014;
    if (curPlanet === 'storm' && Math.random() < dt * 0.35) flash = Math.max(flash, 0.6);
    flash = Math.max(0, flash - dt * 2.5); clouds.material.emissive.setScalar(flash * 0.5);
    for (const e of engines) e.s.scale.setScalar(e.base * (0.92 + Math.random() * 0.16));
    blinkers.forEach((b, i) => { b.material.opacity = ((t * 0.9 + i * 0.33) % 1) < 0.12 ? 1 : 0.12; });
    for (const f of escorts) { const u = f.userData, a = t * u.sp + u.ph; f.position.set(Math.cos(a) * u.r, u.y + Math.sin(a * 2) * 0.3, Math.sin(a) * u.r * 0.6); f.rotation.y = -a - Math.PI / 2 + Math.PI; f.rotation.x = 0.35; }
    // камера медленно облетает фрегат
    const a = 0.32 + Math.sin(t * 0.045) * 0.22, r = dist;
    cam3.position.set(Math.sin(a) * r, r * 0.29 + Math.sin(t * 0.07) * 0.6, Math.cos(a) * r);
    const look = _look.set(0, 0.3, 0);
    if (launch) {
      launch.t += dt; const k = clamp(launch.t / launch.dur, 0, 1), e = k * k * (3 - 2 * k);
      const p = bez(launch.p, e); gunship.position.copy(p); gunship.lookAt(bez(launch.p, Math.min(1, e + 0.02))); gunship.rotateY(-Math.PI / 2);
      gunship.scale.setScalar(lerp(2.4, 0.6, e)); look.lerp(p, Math.min(0.55, k * 0.9));
      if (launch.t >= launch.fadeAt && !launch.faded) { launch.faded = true; $('fade').classList.add('on'); }
      if (launch.t >= launch.dur) { const cb = launch.cb; launch = null; gunship.visible = false; cb(); }
    }
    cam3.lookAt(look);
    cam3.setViewOffset(W, H, -W * off, 0, W, H);
  }
  const _look = new THREE.Vector3();
  const bez = (p, t) => { const u = 1 - t; return new THREE.Vector3().addScaledVector(p[0], u * u * u).addScaledVector(p[1], 3 * u * u * t).addScaledVector(p[2], 3 * u * t * t).addScaledVector(p[3], t * t * t); };
  function startLaunch(cb) {
    const s = ship.position;
    const p0 = new THREE.Vector3(-3.4, 0.1 + s.y, 3.9), p1 = new THREE.Vector3(-2.5, -0.6, 9), p3 = P_POS.clone().add(new THREE.Vector3(-P_R * 0.35, P_R * 0.35, P_R * 0.8));
    const p2 = p3.clone().lerp(p1, 0.6).add(new THREE.Vector3(0, 6, 0));
    gunship.visible = true; gunship.scale.setScalar(2.4); tdist = 21; toff = 0.08; launch = { t: 0, dur: 2.6, fadeAt: 2.0, p: [p0, p1, p2, p3], cb, faded: false };
  }
  function render() {
    const e = renderer.toneMappingExposure; renderer.toneMappingExposure = 1.0;
    renderer.render(sc, cam3); renderer.toneMappingExposure = e;
  }
  function resize(w, h) { W = w; H = h; cam3.aspect = w / h; cam3.updateProjectionMatrix(); }
  // на узком экране панель занимает больше места — фрегат сдвигаем сильнее
  function frame(mode) {
    const narrow = W < 900;
    toff = mode === 'panel' ? (narrow ? 0.3 : 0.24) : mode === 'brief' ? (narrow ? 0.36 : 0.3) : (narrow ? 0.24 : 0.2);
    tdist = mode === 'brief' ? 36 : narrow ? 32 : 28;
  }
  function hide() { for (const id of ['hubScr', 'briefScr']) $(id).classList.remove('show'); }
  return { build, setPlanet, setMods, update, render, resize, frame, hide, startLaunch, busy: () => !!launch, warm: () => { renderer.compile(sc, cam3); } };
})();

// =====================================================================
//  ДАННЫЕ КАМПАНИИ
// =====================================================================
const PLANETS = { desert: 'Ракхат', ice: 'Ильдор', storm: 'Вейлон' };
const CLASSES = {
  trooper: { name: 'Боец', weapon: 'Бластерная винтовка', price: 150, desc: 'Основа отряда: надёжная винтовка, граната, хороший ход.' },
  heavy: { name: 'Пулемётчик', weapon: 'Ротационный бластер', price: 220, desc: 'Очередь из трёх выстрелов и ракета по площади. Крепкий, но медленный.' },
  sniper: { name: 'Снайпер', weapon: 'Снайперская винтовка', price: 220, desc: 'Бьёт через всё поле и видит дальше всех. Вблизи стреляет хуже.' },
  commander: { name: 'Командир', weapon: 'Карабин командира', price: 300, desc: 'Меткий и выносливый, носит две гранаты. В отряде — только один.' },
};
const PAINTS = [['#2f6fdc', 'Синий'], ['#c8302a', 'Красный'], ['#4c8a3c', 'Зелёный'], ['#e07b22', 'Оранжевый'], ['#e2b53b', 'Жёлтый'], ['#7a4fd0', 'Фиолетовый'], ['#1fa3a3', 'Бирюзовый'], ['#5a5f66', 'Серый']];
const CLS_PAINT = { trooper: '#2f6fdc', heavy: '#c8302a', sniper: '#4c8a3c', commander: '#e07b22' };
const RANKS = [['Рядовой', 0], ['Капрал', 3], ['Сержант', 7], ['Лейтенант', 12], ['Капитан', 18]];
const UPGRADES = {
  hp: { name: 'Бронепластины', eff: '+1 здоровья', cost: [120, 220] },
  aim: { name: 'Стрелковая подготовка', eff: '+4 меткости', cost: [100, 170, 250] },
  mob: { name: 'Облегчённая выкладка', eff: '+1 к ходу', cost: [260] },
};
const WPN_COST = [180, 340];
const NADE_PRICE = 40, NADE_MAX = 20, ROSTER_MAX = 6;
const ICON = {
  pod: '<path d="M4 12h16M7 8h10l3 4-3 4H7l-3-4z"/>', shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>',
  scope: '<circle cx="12" cy="12" r="7"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>', nade: '<circle cx="12" cy="14" r="6"/><path d="M12 8V5M10 4h4"/>',
  rocket: '<path d="M5 19l4-4M14 4l6 6-8 8-6-6z"/><circle cx="15" cy="9" r="1.5"/>', radar: '<circle cx="12" cy="12" r="8"/><path d="M12 12l5-5M12 4v2"/><circle cx="12" cy="12" r="3"/>',
  cross: '<path d="M9 4h6v5h5v6h-5v5H9v-5H4V9h5z"/>',
};
const RESEARCH = [
  { id: 'drop1', name: 'Десантный модуль I', eff: 'В высадке 5 бойцов', cost: 300, icon: 'pod' },
  { id: 'drop2', name: 'Десантный модуль II', eff: 'В высадке 6 бойцов', cost: 600, icon: 'pod', req: 'drop1' },
  { id: 'optics', name: 'Тактическая оптика', eff: '+5 меткости всему отряду', cost: 300, icon: 'scope' },
  { id: 'armor', name: 'Композитная броня', eff: '+1 здоровья всему отряду', cost: 350, icon: 'shield' },
  { id: 'armor2', name: 'Тяжёлая броня', eff: 'Ещё +1 здоровья всему отряду', cost: 650, icon: 'shield', req: 'armor' },
  { id: 'pouch', name: 'Подсумки', eff: 'Каждый, кроме пулемётчика, берёт на 1 гранату больше', cost: 220, icon: 'nade' },
  { id: 'rockets', name: 'Двойной боекомплект', eff: 'Пулемётчик берёт 2 ракеты', cost: 260, icon: 'rocket' },
  { id: 'scanner', name: 'Орбитальный сканер', eff: '+2 к обзору всего отряда', cost: 280, icon: 'radar' },
  { id: 'bacta', name: 'Бакта-камеры', eff: 'Павший боец выживает с шансом 50%', cost: 420, icon: 'cross' },
];
const DROIDS = {
  b1: { tier: 1, desc: 'Лёгкий: слабая броня, неточен, берёт числом.' },
  snp: { tier: 2, desc: 'Бьёт издалека и метко, но хрупок и плох вблизи.' },
  cmd: { tier: 2, desc: 'Меткий, держит группу вместе.' },
  b2: { tier: 3, desc: 'Броня гасит 1 урона, стреляет очередью, носит ракету.' },
  bx: { tier: 3, desc: 'Быстрый, меткий и живучий охотник.' },
};
const PROLOGUE = [
  'Третий год Войны клонов. Внешнее Кольцо, сектор Кайрос.',
  'Неделю назад пропала связь со всеми гарнизонами Республики в секторе. Последнее сообщение оборвалось на полуслове.',
  'Фрегат «Вестник» вышел из гиперпространства над Ракхатом. На борту — один отряд: четыре клона под командованием CC-4012 «Сокола».',
  'Задача: выяснить, что случилось, и выбить армию дроидов из сектора. Подкреплений не будет — только кредиты штаба за каждую операцию. Нанимайте бойцов, улучшайте снаряжение и корабль.',
];
const STORY = [
  { id: 's1', title: 'Первая высадка', biome: 'desert', threat: 1, reward: 300, pods: [['b1', 'b1'], ['b1', 'b1', 'b1'], ['cmd', 'b1']],
    brief: 'Над каньоном Ракхата сбита наша канонерка. Её бортовой самописец мог записать, кто напал на сектор. У обломков уже стоит лагерь сепаратистов. Высаживаемся, уничтожаем охрану, забираем запись.',
    win: 'Самописец цел. На записи — транспорт сепаратистов, уходящий к ледяному Ильдору.' },
  { id: 's2', title: 'Ледяной сигнал', biome: 'ice', threat: 2, reward: 380, pods: [['b1', 'snp', 'b1'], ['b2', 'b1'], ['cmd', 'b1', 'snp']],
    brief: 'На перевале Ильдора дроиды поставили ретранслятор: через него идут приказы всем армиям сектора. Без него они будут действовать вслепую. Разведка заметила дроидов-снайперов — держитесь укрытий.',
    win: 'Ретранслятор замолчал. Последний перехваченный приказ называет склады на Вейлоне.' },
  { id: 's3', title: 'Ночь над Вейлоном', biome: 'storm', threat: 3, reward: 450, pods: [['b1', 'b1', 'b1'], ['b2', 'snp', 'b1'], ['cmd', 'b2', 'b1']],
    brief: 'Ночью под ливнем дроиды грузят боеприпасы на транспорт. Если груз уйдёт, фронт получит снарядов на месяц. Молнии выдают позиции — и наши, и их.',
    win: 'Склад взорван. Среди обломков нашли схему литейной — на Ракхате, прямо у нас под носом.' },
  { id: 's4', title: 'Тени каньона', biome: 'desert', threat: 3, reward: 520, pods: [['bx', 'b1', 'b1'], ['snp', 'b2', 'b1'], ['cmd', 'bx', 'b1']],
    brief: 'Литейная в каньоне выпускает дроидов-коммандос BX — быстрых и метких. Ломаем охрану, пока с конвейера не сошёл целый батальон.',
    win: 'Конвейер встал. Данные литейной ведут к главной кузне — подо льдами Ильдора.' },
  { id: 's5', title: 'Кузня подо льдом', biome: 'ice', threat: 4, reward: 620, pods: [['b1', 'b1', 'snp'], ['b2', 'bx', 'b1'], ['cmd', 'b2', 'snp'], ['bx', 'b1', 'b1']],
    brief: 'Под ледником Ильдора — главная кузня сектора. Охрану усилили супердроидами. Это самый крупный гарнизон, с которым встречался отряд: четыре группы.',
    win: 'Кузня обесточена. Тактический дроид ТХ-9, командующий сектором, бежал на Вейлон.' },
  { id: 's6', title: 'Око бури', biome: 'storm', threat: 5, reward: 800, pods: [['bx', 'b1', 'snp'], ['b2', 'b2', 'b1'], ['cmd', 'bx', 'snp'], ['b2', 'bx', 'bx']],
    brief: 'Последний бой. ТХ-9 укрылся в штабе посреди бури и стянул туда всё, что у него осталось. Возьмите штаб — и сектор Кайрос свободен.',
    win: 'Сектор Кайрос освобождён. Штаб благодарит отряд «Сокол». Патрули продолжаются: дроидов в секторе ещё хватает.' },
].map(o => Object.assign({ kind: 'story' }, o));
const PATROL_NAMES = [
  ['Зачистка заставы', 'Дроиды заняли брошенную заставу и перекрыли дорогу. Выбить их оттуда.'],
  ['Перехват патруля', 'Патруль дроидов прочёсывает район в поисках наших разведчиков. Встретить его первыми.'],
  ['Разведка боем', 'Нужно узнать, какие силы противник держит в районе. Лучший способ — напасть.'],
  ['Срыв поставок', 'Здесь дроиды перегружают запчасти и батареи. Уничтожить охрану склада.'],
  ['Охота на командира', 'Дроид-командир собирает вокруг себя новые отряды. Найти и уничтожить.'],
  ['Засада у перевала', 'Колонна дроидов пройдёт этим путём. Занять укрытия и не дать никому уйти.'],
];

// =====================================================================
//  СОХРАНЕНИЕ
// =====================================================================
const SAVE_KEY = 'cvd-save';
let S = null, cur = null; // S — кампания, cur — идущая операция
function newSave() {
  const f = (id, cls, call, num, xp) => ({ id, cls, call, num, xp, kills: 0, ops: 0, up: { hp: 0, aim: 0, mob: 0 }, paint: CLS_PAINT[cls] });
  const s = { v: 1, credits: 300, nades: 4, story: 0, research: {}, weapons: { trooper: 0, heavy: 0, sniper: 0, commander: 0 },
    roster: [f(1, 'commander', 'Сокол', 'CC-4012', 7), f(2, 'trooper', 'Искра', 'CT-5597', 3), f(3, 'heavy', 'Молот', 'CT-1138', 3), f(4, 'sniper', 'Тихий', 'CT-3301', 3)],
    deploy: [1, 2, 3, 4], patrols: [], nextId: 5, pseed: 1, stats: { ops: 0, wins: 0, kills: 0, lost: 0 }, fallen: [] };
  s.patrols = [genPatrol(s), genPatrol(s)];
  return s;
}
function loadSave() { try { const j = JSON.parse(store(SAVE_KEY) || 'null'); if (j && j.v === 1 && Array.isArray(j.roster)) return j; } catch (e) {} return null; }
function saveGame() { store(SAVE_KEY, JSON.stringify(S)); }

// патруль: случайная планета, угроза растёт с сюжетом, состав групп — по угрозе
function genPatrol(s) {
  const seed = s.pseed++, R = rng(seed * 7919 + 13), ids = Object.keys(PLANETS), [title, brief] = PATROL_NAMES[Math.floor(R() * PATROL_NAMES.length)];
  const threat = clamp(1 + Math.floor(s.story * 0.7) + (R() < 0.35 ? 1 : 0) - (R() < 0.25 ? 1 : 0), 1, 5);
  return { id: 'p' + seed, kind: 'patrol', title, brief, biome: ids[Math.floor(R() * ids.length)], threat, reward: 110 + threat * 60, pods: genPods(threat, R) };
}
function genPods(threat, R) {
  const total = [0, 6, 7, 9, 10, 11][threat], nP = total > 9 ? 4 : 3, pods = Array.from({ length: nP }, () => []);
  const leaders = [[], ['cmd'], ['cmd', 'b2'], ['cmd', 'b2', 'bx'], ['cmd', 'b2', 'bx', 'snp'], ['cmd', 'bx', 'b2', 'bx']][threat];
  const pool = threat >= 3 ? ['snp', 'b2', 'bx'] : threat >= 2 ? ['snp', 'b2'] : ['b1'];
  for (let i = 0; i < total; i++) pods[i % nP].push(i < leaders.length ? leaders[i] : R() < 0.1 * threat ? pool[Math.floor(R() * pool.length)] : 'b1');
  return pods;
}

// =====================================================================
//  БОЙЦЫ: характеристики = класс + звание + личные улучшения + оружие класса + исследования
// =====================================================================
const rankOf = xp => { let r = 0; while (r < RANKS.length - 1 && xp >= RANKS[r + 1][1]) r++; return r; };
const deploySlots = () => 4 + (S.research.drop1 ? 1 : 0) + (S.research.drop2 ? 1 : 0);
const fById = id => S.roster.find(f => f.id === id);
function stats(f) {
  const d = DEF[f.cls], r = rankOf(f.xp), R = S.research, w = S.weapons[f.cls] || 0;
  return {
    hp: d.hp + f.up.hp + (r >= 2 ? 1 : 0) + (r >= 4 ? 1 : 0) + (R.armor ? 1 : 0) + (R.armor2 ? 1 : 0),
    aim: d.aim + f.up.aim * 4 + r * 2 + (R.optics ? 5 : 0), mob: d.mob + f.up.mob, dmg: [d.dmg[0] + w, d.dmg[1] + w], range: d.range,
    nades: (d.nades || 0) + (R.pouch && f.cls !== 'heavy' ? 1 : 0), rockets: (d.rockets || 0) + (R.rockets && f.cls === 'heavy' ? 1 : 0), sight: d.sight + (R.scanner ? 2 : 0),
  };
}
const fTitle = f => `${CLASSES[f.cls].name} «${f.call}»`;
function deployList() {
  const n = deploySlots(), ids = S.deploy.filter(id => fById(id));
  for (const f of S.roster) if (ids.length < n && !ids.includes(f.id)) ids.push(f.id);
  S.deploy = ids.slice(0, n); return S.deploy.map(fById);
}
const CALLS = ['Гром', 'Вихрь', 'Клык', 'Ёж', 'Шторм', 'Факел', 'Кремень', 'Шрам', 'Рикошет', 'Тайга', 'Бор', 'Зенит', 'Каштан', 'Ворон', 'Кедр', 'Сыч', 'Барс', 'Пепел', 'Дозор', 'Комар', 'Хмурый', 'Штиль'];
function recruit(cls) {
  const used = new Set(S.roster.map(f => f.call).concat(S.fallen.map(f => f.call))), free = CALLS.filter(c => !used.has(c));
  const call = free.length ? free[Math.floor(Math.random() * free.length)] : 'Новичок-' + S.nextId;
  const num = (cls === 'commander' ? 'CC-' : 'CT-') + (1000 + Math.floor(Math.random() * 8999));
  const f = { id: S.nextId++, cls, call, num, xp: 0, kills: 0, ops: 0, up: { hp: 0, aim: 0, mob: 0 }, paint: CLS_PAINT[cls] };
  S.roster.push(f); return f;
}

// портреты бойцов и дроидов (3D-модель в картинку), превью операций
const PURL = new Map();
function purl(team, type, paint) { const k = team + type + (paint || ''); if (!PURL.has(k)) PURL.set(k, portraitImage(team, type, paint).toDataURL()); return PURL.get(k); }
const PREV = new Map();
function previewURL(op) {
  if (PREV.has(op.id)) return PREV.get(op.id);
  const w = 384, h = 216, b = BIOMES[op.biome], R = rng(hashStr(op.id) + 3), c = cnv(w, h), g = c.getContext('2d');
  const rgb = (a, k = 1) => `rgb(${a.map(v => Math.round(clamp(v * k, 0, 1) * 255)).join(',')})`;
  const night = op.biome === 'storm', hy = h * 0.56;
  const sk = g.createLinearGradient(0, 0, 0, hy); sk.addColorStop(0, b.sky[0]); sk.addColorStop(0.7, b.sky[1]); sk.addColorStop(1, b.sky[2]); g.fillStyle = sk; g.fillRect(0, 0, w, h);
  if (night) for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(220,230,255,${R() * 0.6})`; g.fillRect(R() * w, R() * hy * 0.7, 1.2, 1.2); }
  // светило
  const sx = w * (0.62 + R() * 0.25), sy = h * (0.14 + R() * 0.12);
  if (b.planet) { g.fillStyle = 'rgba(246,210,170,.85)'; g.beginPath(); g.arc(sx, sy, 22, 0, 7); g.fill(); g.strokeStyle = 'rgba(255,220,180,.6)'; g.lineWidth = 2.5; g.beginPath(); g.ellipse(sx, sy, 40, 8, -0.35, 0, 7); g.stroke(); }
  if (b.moon) { const mg = g.createRadialGradient(sx, sy, 0, sx, sy, 34); mg.addColorStop(0, 'rgba(240,246,255,1)'); mg.addColorStop(0.45, 'rgba(220,232,250,.9)'); mg.addColorStop(0.5, 'rgba(220,232,250,.25)'); mg.addColorStop(1, 'rgba(220,232,250,0)'); g.fillStyle = mg; g.fillRect(sx - 40, sy - 40, 80, 80); }
  const sun = g.createRadialGradient(w * 0.2, hy, 0, w * 0.2, hy, w * 0.5); sun.addColorStop(0, night ? 'rgba(120,150,200,.25)' : 'rgba(255,240,210,.45)'); sun.addColorStop(1, 'rgba(255,240,210,0)'); g.fillStyle = sun; g.fillRect(0, 0, w, h);
  // хребты в дымке
  const ridge = (base, amp, col, jag) => {
    g.fillStyle = col; g.beginPath(); g.moveTo(0, h); let y = base;
    for (let x = 0; x <= w; x += 6) { y = clamp(y + (R() - 0.5) * jag, base - amp, base + amp * 0.3); const yy = op.biome === 'desert' ? Math.round(y / 7) * 7 : y; g.lineTo(x, yy); }
    g.lineTo(w, h); g.fill();
  };
  const hazeCol = b.sky[2];
  ridge(hy - 34, 26, hazeCol, 9); g.fillStyle = rgb(b.terrain[2], 0.9); g.globalAlpha = 0.55; ridge(hy - 22, 24, rgb(b.terrain[2]), 12); g.globalAlpha = 1;
  ridge(hy - 8, 18, rgb(b.terrain[1]), 10);
  // земля поля боя
  const gr = g.createLinearGradient(0, hy, 0, h), sand = b.sand.map(v => v / 255);
  gr.addColorStop(0, rgb(sand, 0.85)); gr.addColorStop(1, rgb(sand, 0.55)); g.fillStyle = gr; g.fillRect(0, hy, w, h - hy);
  g.strokeStyle = 'rgba(111,208,255,.22)'; g.lineWidth = 1;
  for (let i = -10; i <= 10; i++) { g.beginPath(); g.moveTo(w / 2 + i * 14, hy); g.lineTo(w / 2 + i * 70, h); g.stroke(); }
  for (let i = 1; i < 7; i++) { const y = hy + (h - hy) * Math.pow(i / 7, 1.7); g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  // аванпост противника на горизонте
  const ox = w * (0.5 + R() * 0.25); g.fillStyle = rgb(b.terrain[2], 0.45);
  g.fillRect(ox, hy - 16, 46, 16); g.fillRect(ox + 10, hy - 30, 12, 14); g.fillRect(ox + 34, hy - 24, 6, 8); g.fillRect(ox + 15, hy - 46, 2, 16);
  g.fillStyle = '#ff4030'; g.beginPath(); g.arc(ox + 16, hy - 47, 2, 0, 7); g.fill();
  // силуэты дроидов (чем выше угроза, тем больше)
  const nd = 2 + op.threat;
  for (let i = 0; i < nd; i++) {
    const y = hy + 8 + R() * (h - hy) * 0.5, s = 0.6 + (y - hy) / (h - hy) * 1.2, x = w * 0.25 + R() * w * 0.7, big = R() < 0.12 * op.threat;
    g.fillStyle = 'rgba(14,12,12,.85)';
    if (big) { g.fillRect(x - 6 * s, y - 20 * s, 12 * s, 11 * s); g.fillRect(x - 4 * s, y - 9 * s, 3 * s, 9 * s); g.fillRect(x + 1 * s, y - 9 * s, 3 * s, 9 * s); g.fillRect(x - 9 * s, y - 19 * s, 3 * s, 9 * s); g.fillRect(x + 6 * s, y - 19 * s, 3 * s, 9 * s); }
    else { g.fillRect(x - 1.6 * s, y - 15 * s, 3.2 * s, 7 * s); g.fillRect(x - 1.5 * s, y - 8 * s, 1.2 * s, 8 * s); g.fillRect(x + 0.4 * s, y - 8 * s, 1.2 * s, 8 * s); g.beginPath(); g.ellipse(x + 1.2 * s, y - 17 * s, 3 * s, 1.4 * s, 0.3, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(255,70,50,.95)'; g.fillRect(x + (big ? -3 : 1.5) * s, y - (big ? 17 : 17.5) * s, (big ? 6 : 1.4) * s, 1.1 * s);
  }
  // погода
  if (b.weather === 'rain') { g.strokeStyle = 'rgba(190,210,240,.35)'; for (let i = 0; i < 130; i++) { const x = R() * w, y = R() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 3, y + 11); g.stroke(); }
    g.strokeStyle = 'rgba(230,240,255,.9)'; g.lineWidth = 1.6; let x = w * (0.15 + R() * 0.3), y = 0; g.beginPath(); g.moveTo(x, y); while (y < hy - 30) { x += (R() - 0.5) * 18; y += 8 + R() * 10; g.lineTo(x, y); } g.stroke(); }
  if (b.weather === 'snow') { g.fillStyle = 'rgba(255,255,255,.8)'; for (let i = 0; i < 150; i++) { g.beginPath(); g.arc(R() * w, R() * h, 0.6 + R() * 1.3, 0, 7); g.fill(); } }
  if (b.weather === 'dust') { const dg = g.createLinearGradient(0, hy - 30, 0, hy + 30); dg.addColorStop(0, 'rgba(255,220,180,0)'); dg.addColorStop(0.5, 'rgba(255,220,180,.35)'); dg.addColorStop(1, 'rgba(255,220,180,0)'); g.fillStyle = dg; g.fillRect(0, hy - 30, w, 60); }
  // виньетка и строки голоэкрана
  const vg = g.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.7); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,6,14,.6)'); g.fillStyle = vg; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(0,10,20,.12)'; for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
  const url = c.toDataURL('image/jpeg', 0.86); PREV.set(op.id, url); return url;
}

// =====================================================================
//  ИНТЕРФЕЙС КОРАБЛЯ
// =====================================================================
let tab = 'ops', selF = null;
const svg = (p, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24">${p}</svg>`;
const threatPips = n => `<span class="threat t${n}">${'<i></i>'.repeat(n)}${'<i class="e"></i>'.repeat(5 - n)}</span>`;
const rankStars = r => `<span class="stars">${'★'.repeat(r)}${'<i>★</i>'.repeat(RANKS.length - 1 - r)}</span>`;
function buy(cost) { if (S.credits < cost) { Snd.fx.deny(); toast('Не хватает кредитов'); return false; } S.credits -= cost; Snd.fx.roger(); return true; }
let toastT = 0;
function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 1800); }
function hubTop() {
  $('hubCr').textContent = crd(S.credits); $('hubNades').textContent = S.nades;
  $('hubSub').textContent = S.story >= STORY.length ? 'Сектор Кайрос освобождён · патрули' : `Сектор Кайрос · операция ${S.story + 1} из ${STORY.length}`;
  for (const b of document.querySelectorAll('#hubTabs button')) b.classList.toggle('on', b.dataset.v === tab);
  $('hMus').classList.toggle('off', !Snd.musOn); $('hSfx').classList.toggle('off', !Snd.sfxOn);
  Hub.setMods(S.research);
}
function renderHub() {
  hubTop(); const P = $('hubPanel');
  P.innerHTML = tab === 'ops' ? opsHTML() : tab === 'squad' ? squadHTML() : tab === 'hire' ? hireHTML() : tab === 'arsenal' ? arsenalHTML() : researchHTML();
  P.scrollTop = 0;
}
function refreshPanel() { const P = $('hubPanel'), y = P.scrollTop; hubTop(); P.innerHTML = tab === 'ops' ? opsHTML() : tab === 'squad' ? squadHTML() : tab === 'hire' ? hireHTML() : tab === 'arsenal' ? arsenalHTML() : researchHTML(); P.scrollTop = y; }

function opCard(op, opts = {}) {
  const tag = op.kind === 'story' ? `СЮЖЕТ · ${STORY.indexOf(op) + 1}/${STORY.length}` : 'ПАТРУЛЬ';
  return `<button class="op ${op.kind}${opts.locked ? ' locked' : ''}" data-a="${opts.locked ? '' : 'op'}" data-v="${op.id}" data-bio="${op.biome}"${opts.locked ? ' disabled' : ''}>
    <span class="opImg" style="background-image:url(${previewURL(op)})"><span class="opTag">${tag}</span>${opts.locked ? '<span class="lock">' + svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>') + '</span>' : ''}</span>
    <span class="opBody"><b>${esc(op.title)}</b><small>${PLANETS[op.biome]} · ${BIOMES[op.biome].name}</small>
    <span class="opRow">${threatPips(op.threat)}<span class="rew">${opts.locked ? 'Засекречено' : crd(op.reward)}</span></span></span></button>`;
}
function opsHTML() {
  const next = STORY[S.story], after = STORY[S.story + 1];
  let h = `<div class="ph"><h3>Операции</h3><span class="sub">Выберите цель высадки</span></div><div class="ops">`;
  if (next) h += opCard(next); else h += `<div class="done-all"><b>Сектор Кайрос освобождён</b><span>Сюжетная кампания пройдена. Патрули приносят кредиты и опыт.</span></div>`;
  for (const p of S.patrols) h += opCard(p);
  if (after) h += opCard(after, { locked: true });
  h += '</div>';
  if (S.story) h += `<div class="ph sm"><h4>Журнал операций</h4></div><div class="log">${STORY.slice(0, S.story).map(o => `<div><span class="ok">✓</span><b>${esc(o.title)}</b><small>${PLANETS[o.biome]}</small><em>${esc(o.win)}</em></div>`).join('')}</div>`;
  const st = S.stats; h += `<div class="foot">Операций: ${st.ops} · побед: ${st.wins} · уничтожено дроидов: ${st.kills} · потери: ${st.lost}</div>`;
  return h;
}
function statRows(f, s, editable) {
  const row = (lbl, val, key) => {
    let btn = '';
    if (editable && key) {
      const lv = f.up[key], U = UPGRADES[key];
      btn = lv < U.cost.length ? `<button class="up" data-a="up" data-v="${key}" title="${U.name}: ${U.eff}"><b>+</b>${crd(U.cost[lv])}</button>` : '<span class="max">макс.</span>';
    }
    return `<div class="sr"><span>${lbl}</span><b>${val}</b>${btn}</div>`;
  };
  return row('Здоровье', s.hp, 'hp') + row('Меткость', s.aim, 'aim') + row('Ход, клеток', s.mob, 'mob') + row('Урон', `${s.dmg[0]}–${s.dmg[1]}`) + row('Дальность', s.range) + row('Обзор', s.sight)
    + row(f.cls === 'heavy' ? 'Ракеты' : 'Гранаты', f.cls === 'heavy' ? s.rockets : s.nades);
}
function squadHTML() {
  const dep = deployList(), slots = deploySlots();
  if (!selF || !fById(selF)) selF = S.roster[0] && S.roster[0].id;
  let h = `<div class="ph"><h3>Отряд</h3><span class="sub">Бойцов ${S.roster.length}/${ROSTER_MAX} · в высадке ${dep.length}/${slots}</span></div><div class="sq"><div class="roster">`;
  for (const f of S.roster) {
    const r = rankOf(f.xp), on = dep.includes(f);
    h += `<button class="frow${f.id === selF ? ' sel' : ''}" data-a="sel" data-v="${f.id}"><img src="${purl('clone', f.cls, f.paint)}" alt=""><span><b>«${esc(f.call)}»</b><small>${CLASSES[f.cls].name} · ${RANKS[r][0]}</small></span>${on ? '<i class="dep" title="В высадке">✓</i>' : ''}</button>`;
  }
  for (let i = S.roster.length; i < ROSTER_MAX; i++) h += `<button class="frow empty" data-a="tab" data-v="hire"><span class="plus">+</span><span><b>Свободная койка</b><small>Нанять бойца</small></span></button>`;
  h += '</div>';
  const f = fById(selF);
  if (f) {
    const s = stats(f), r = rankOf(f.xp), nx = RANKS[r + 1], pct = nx ? Math.round((f.xp - RANKS[r][1]) / (nx[1] - RANKS[r][1]) * 100) : 100, on = dep.includes(f);
    h += `<div class="fd"><div class="fdHead"><img src="${purl('clone', f.cls, f.paint)}" alt=""><div><div class="fdName">${esc(fTitle(f))}</div><div class="fdNum">${f.num} · ${CLASSES[f.cls].weapon}</div>
      <div class="rank">${rankStars(r)} ${RANKS[r][0]}</div><div class="xp"><i style="width:${pct}%"></i></div><div class="fdNum">${nx ? `Опыт ${f.xp}/${nx[1]} до звания «${nx[0]}»` : 'Высшее звание'} · операций ${f.ops} · уничтожил ${f.kills}</div></div></div>
      <div class="stats">${statRows(f, s, true)}</div>
      <div class="paintL">Раскраска брони</div><div class="paint">${PAINTS.map(([c, n]) => `<button class="sw${f.paint === c ? ' on' : ''}" data-a="paint" data-v="${c}" style="--c:${c}" title="${n}" aria-label="${n}"></button>`).join('')}</div>
      <div class="fdAct"><button class="btn sm${on ? ' ghost' : ''}" data-a="dep">${on ? 'Убрать из высадки' : 'В высадку'}</button><button class="btn sm ghost danger" data-a="fire">Уволить</button></div></div>`;
  }
  return h + '</div>';
}
function hireHTML() {
  const full = S.roster.length >= ROSTER_MAX, hasCmd = S.roster.some(f => f.cls === 'commander');
  let h = `<div class="ph"><h3>Наём</h3><span class="sub">Бойцов ${S.roster.length}/${ROSTER_MAX} · оружие закреплено за классом</span></div><div class="hire">`;
  for (const [cls, C] of Object.entries(CLASSES)) {
    const d = DEF[cls], block = full ? 'Казарма заполнена' : cls === 'commander' && hasCmd ? 'Командир уже есть' : '';
    h += `<div class="hc"><img src="${purl('clone', cls, CLS_PAINT[cls])}" alt=""><b>${C.name}</b><small class="wpn">${C.weapon}</small><p>${C.desc}</p>
      <div class="mini"><span>❤ ${d.hp}</span><span>◎ ${d.aim}</span><span>➜ ${d.mob}</span><span>✶ ${d.dmg[0]}–${d.dmg[1]}</span></div>
      <button class="btn sm" data-a="hire" data-v="${cls}"${block ? ' disabled' : ''}>${block || 'Нанять · ' + crd(C.price)}</button></div>`;
  }
  return h + '</div>';
}
function arsenalHTML() {
  let h = `<div class="ph"><h3>Арсенал</h3><span class="sub">Гранаты и оружие классов</span></div>`;
  const carry = deployList().reduce((a, f) => a + (f.cls === 'heavy' ? 0 : stats(f).nades), 0);
  h += `<div class="ar nade"><div class="arIc">${svg(ICON.nade)}</div><div class="arTx"><b>Термодетонаторы: ${S.nades}</b><small>Отряд берёт с собой до ${carry} шт. (боец — 1, командир — 2). Неистраченные возвращаются на склад.</small></div>
    <div class="arBtns"><button class="btn sm" data-a="nade" data-v="1"${S.nades >= NADE_MAX ? ' disabled' : ''}>+1 · ${crd(NADE_PRICE)}</button><button class="btn sm ghost" data-a="nade" data-v="5"${S.nades + 5 > NADE_MAX ? ' disabled' : ''}>+5 · ${crd(NADE_PRICE * 5)}</button></div></div>`;
  h += '<div class="ph sm"><h4>Оружие классов</h4><span class="sub">Каждый уровень — +1 к урону у всех бойцов класса</span></div>';
  for (const [cls, C] of Object.entries(CLASSES)) {
    const lv = S.weapons[cls] || 0, d = DEF[cls];
    h += `<div class="ar"><img src="${purl('clone', cls, CLS_PAINT[cls])}" alt=""><div class="arTx"><b>${C.weapon}</b><small>${C.name} · урон ${d.dmg[0] + lv}–${d.dmg[1] + lv}${d.burst ? ' · очередь ×' + d.burst : ''}</small><span class="lv">${'<i class="on"></i>'.repeat(lv)}${'<i></i>'.repeat(WPN_COST.length - lv)}</span></div>
      <div class="arBtns">${lv < WPN_COST.length ? `<button class="btn sm" data-a="wpn" data-v="${cls}">Модернизация · ${crd(WPN_COST[lv])}</button>` : '<span class="max">Максимум</span>'}</div></div>`;
  }
  return h;
}
function researchHTML() {
  let h = `<div class="ph"><h3>Исследования</h3><span class="sub">Лаборатория фрегата · улучшения для всего отряда и корабля</span></div><div class="rs">`;
  for (const r of RESEARCH) {
    const done = S.research[r.id], need = r.req && !S.research[r.req];
    h += `<div class="rc${done ? ' done' : need ? ' need' : ''}"><div class="arIc">${svg(ICON[r.icon])}</div><b>${r.name}</b><small>${r.eff}</small>
      ${done ? '<span class="ok">✓ Изучено</span>' : need ? `<span class="req">Нужно: ${RESEARCH.find(x => x.id === r.req).name}</span>` : `<button class="btn sm" data-a="res" data-v="${r.id}">Изучить · ${crd(r.cost)}</button>`}</div>`;
  }
  return h + '</div>';
}

// ---------- брифинг: сюжет, разведданные, выбор отряда
let briefOp = null;
const findOp = id => STORY.find(o => o.id === id) || S.patrols.find(o => o.id === id);
function openBrief(id) {
  briefOp = findOp(id); if (!briefOp) return;
  Hub.setPlanet(briefOp.biome); Hub.frame('brief');
  $('hubScr').classList.remove('show'); renderBrief(); $('briefScr').classList.add('show'); Snd.fx.select();
}
function renderBrief() {
  const op = briefOp, dep = deployList(), slots = deploySlots(), count = {};
  for (const p of op.pods) for (const t of p) count[t] = (count[t] || 0) + 1;
  const total = Object.values(count).reduce((a, b) => a + b, 0);
  const want = dep.reduce((a, f) => a + (f.cls === 'heavy' ? 0 : stats(f).nades), 0), take = Math.min(want, S.nades);
  const tag = op.kind === 'story' ? `СЮЖЕТНАЯ ОПЕРАЦИЯ ${STORY.indexOf(op) + 1} ИЗ ${STORY.length}` : 'ПАТРУЛЬ';
  $('briefBody').innerHTML = `
    <div class="bHead"><span class="tag">${tag}</span><h3>${esc(op.title)}</h3><small>${PLANETS[op.biome]} · ${BIOMES[op.biome].name} · угроза ${threatPips(op.threat)}</small></div>
    <div class="bGrid"><div class="bL"><div class="bImg" style="background-image:url(${previewURL(op)})"></div><p class="story">${esc(op.brief)}</p>
      <div class="rewBox">Награда: <b>${crd(op.reward)}</b> + ${crd(10)} за каждого дроида</div></div>
    <div class="bR"><h4>Разведка · ${total} дроидов</h4><div class="intel">${Object.entries(count).sort((a, b) => DROIDS[a[0]].tier - DROIDS[b[0]].tier).map(([t, n]) => `<div class="irow"><img src="${purl('droid', t)}" alt=""><span><b>${DEF[t].name} ×${n}</b><small>${DROIDS[t].desc}</small></span></div>`).join('')}</div>
      <h4>Отряд высадки · ${dep.length}/${slots}</h4><div class="pick">${S.roster.map(f => `<button class="pf${dep.includes(f) ? ' on' : ''}" data-a="bdep" data-v="${f.id}"><img src="${purl('clone', f.cls, f.paint)}" alt=""><b>«${esc(f.call)}»</b><small>${CLASSES[f.cls].name}</small></button>`).join('')}</div>
      <div class="load">${svg(ICON.nade)} Гранат на складе: <b>${S.nades}</b> — отряд возьмёт <b>${take}</b>${take < want ? ' <span class="warn">(не хватает ' + (want - take) + ')</span>' : ''}</div></div></div>`;
  $('bLaunch').disabled = !dep.length;
}
function launch() {
  const op = briefOp, dep = deployList(); if (!dep.length) return;
  let stock = S.nades; const issued = {};
  SQUAD = dep.map(f => {
    const s = stats(f), n = f.cls === 'heavy' ? 0 : Math.min(s.nades, stock); stock -= n; issued[f.id] = n;
    return { cls: f.cls, call: f.call, num: f.num, paint: f.paint, fid: f.id, hp: s.hp, maxHp: s.hp, aim: s.aim, mob: s.mob, dmg: s.dmg, nades: n, rockets: s.rockets, sight: s.sight };
  });
  PODS = podsFrom(op.pods); cur = { op, issued, ids: dep.map(f => f.id) };
  $('briefScr').classList.remove('show'); Snd.fx.overwatch();
  Hub.startLaunch(() => { startGame(); setTimeout(() => $('fade').classList.remove('on'), 80); });
}

// ---------- итоги операции: кредиты, опыт и звания, потери, пополнение
function missionEnd(result) {
  const op = cur.op, win = result === 'win', lines = [];
  const clonesU = units.filter(u => u.team === 'clone');
  const base = win ? op.reward : 0, trophy = kills * 10, clean = win && clonesU.every(u => u.alive) ? Math.round(op.reward * 0.2) : 0, total = base + trophy + clean;
  S.credits += total; S.stats.ops++; S.stats.kills += kills; if (win) S.stats.wins++;
  // гранаты: выданные минус брошенные (у павших пропадают)
  let used = 0; for (const u of clonesU) used += (cur.issued[u.fid] || 0) - (u.alive ? u.nades : 0); S.nades = Math.max(0, S.nades - used);
  for (const u of clonesU) {
    const f = fById(u.fid); if (!f) continue;
    let note = '';
    if (!u.alive) {
      if (S.research.bacta && Math.random() < 0.5) note = ' · <i class="okc">спасён бакта-камерой</i>';
      else { S.roster = S.roster.filter(x => x !== f); S.fallen.push({ call: f.call, cls: f.cls, kills: f.kills + u.mk }); S.stats.lost++; lines.push(`<div class="fr dead"><img src="${purl('clone', f.cls, f.paint)}" alt=""><b>«${esc(f.call)}»</b><span>Погиб в бою</span></div>`); continue; }
    }
    const r0 = rankOf(f.xp), gain = (win ? 2 : 1) + u.mk; f.xp += gain; f.kills += u.mk; f.ops++;
    const r1 = rankOf(f.xp);
    lines.push(`<div class="fr${r1 > r0 ? ' promo' : ''}"><img src="${purl('clone', f.cls, f.paint)}" alt=""><b>«${esc(f.call)}»</b><span>+${gain} опыта${u.mk ? ' · уничтожил ' + u.mk : ''}${note}${r1 > r0 ? ` · <em>повышен: ${RANKS[r1][0]}</em>` : ''}</span></div>`);
  }
  if (win) { if (op.kind === 'story') S.story = Math.max(S.story, STORY.indexOf(op) + 1); else S.patrols = S.patrols.map(p => p === op ? genPatrol(S) : p); }
  let reinf = 0; while (S.roster.length < 3) { recruit('trooper'); reinf++; }
  S.deploy = S.deploy.filter(id => fById(id)); saveGame();
  $('endTitle').textContent = win ? 'ПОБЕДА РЕСПУБЛИКИ' : result === 'retreat' ? 'ОТСТУПЛЕНИЕ' : 'ОТРЯД УНИЧТОЖЕН';
  $('endTitle').style.color = win ? 'var(--holo)' : '#ff8a7a';
  const lost = clonesU.filter(u => !u.alive).length;
  $('endStats').innerHTML = `<div class="eOp">${esc(op.title)} · ${PLANETS[op.biome]}</div>
    ${win && op.win ? `<p class="eStory">${esc(op.win)}</p>` : !win ? '<p class="eStory">Операция не выполнена. Её можно повторить с корабля.</p>' : ''}
    <div class="eGrid"><div class="eRew">
      ${base ? `<div><span>Награда штаба</span><b>${crd(base)}</b></div>` : ''}<div><span>Трофеи: дроидов ${kills} × ${crd(10)}</span><b>${crd(trophy)}</b></div>
      ${clean ? `<div><span>Без потерь</span><b>${crd(clean)}</b></div>` : ''}<div class="sum"><span>Итого</span><b>+${crd(total)}</b></div>
      <div class="dim">Ходов: ${turn} · потери: ${lost} из ${clonesU.length}${used ? ' · гранат израсходовано: ' + used : ''}</div></div>
    <div class="eSq">${lines.join('')}${reinf ? `<div class="fr promo"><b>Пополнение</b><span>Штаб прислал бойцов: ${reinf}</span></div>` : ''}</div></div>`;
  $('bRetry').style.display = win ? 'none' : '';
}
function toHub(t) {
  $('endScr').classList.remove('show'); $('startScr').classList.remove('show'); $('fade').classList.remove('on');
  document.body.classList.remove('playing', 'cine'); cam.cine = null; phase = 'hub'; busy = false; Music.setIntensity(0.08);
  if (t) tab = t; Hub.frame('panel'); Hub.setPlanet((STORY[S.story] || S.patrols[0]).biome); renderHub(); $('hubScr').classList.add('show');
}

// ---------- кнопки корабля
$('hubPanel').addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b || b.disabled || !b.dataset.a) return;
  Snd.init(); const a = b.dataset.a, v = b.dataset.v, f = fById(selF);
  if (a === 'op') { openBrief(v); return; }
  if (a === 'tab') { tab = v; Snd.fx.click(); renderHub(); return; }
  if (a === 'sel') { selF = +v; Snd.fx.select(); refreshPanel(); return; }
  if (a === 'up' && f) { const lv = f.up[v], c = UPGRADES[v].cost[lv]; if (c !== undefined && buy(c)) { f.up[v]++; toast(`${UPGRADES[v].name}: ${UPGRADES[v].eff}`); } }
  else if (a === 'paint' && f) { f.paint = v; Snd.fx.click(); }
  else if (a === 'dep' && f) { toggleDeploy(f.id); Snd.fx.click(); }
  else if (a === 'fire' && f) { confirmBox(`Уволить «${f.call}»? Боец покинет отряд навсегда.`, () => { S.roster = S.roster.filter(x => x !== f); selF = null; saveGame(); refreshPanel(); }); return; }
  else if (a === 'hire') { const C = CLASSES[v]; if (S.roster.length < ROSTER_MAX && buy(C.price)) { const nf = recruit(v); selF = nf.id; toast(`${C.name} «${nf.call}» прибыл на борт`); tab = 'squad'; saveGame(); renderHub(); return; } }
  else if (a === 'nade') { const n = +v; if (S.nades + n <= NADE_MAX && buy(NADE_PRICE * n)) S.nades += n; }
  else if (a === 'wpn') { const lv = S.weapons[v] || 0; if (lv < WPN_COST.length && buy(WPN_COST[lv])) { S.weapons[v] = lv + 1; toast(`${CLASSES[v].weapon}: уровень ${lv + 1}`); } }
  else if (a === 'res') { const r = RESEARCH.find(x => x.id === v); if (r && !S.research[v] && buy(r.cost)) { S.research[v] = true; toast(`Изучено: ${r.name}`); } }
  saveGame(); refreshPanel();
});
// при наведении на операцию планета за кораблём меняется на планету высадки
$('hubPanel').addEventListener('pointerover', e => { const b = e.target.closest('.op'); if (b && b.dataset.bio) Hub.setPlanet(b.dataset.bio); });
function toggleDeploy(id) {
  const dep = deployList().map(f => f.id), i = dep.indexOf(id);
  if (i >= 0) { if (dep.length > 1) dep.splice(i, 1); else { toast('В высадке нужен хотя бы один боец'); return; } }
  else { if (dep.length >= deploySlots()) { toast(`Мест в высадке: ${deploySlots()}. Изучите «Десантный модуль»`); return; } dep.push(id); }
  S.deploy = dep; saveGame();
}
$('briefBody').addEventListener('click', e => { const b = e.target.closest('[data-a="bdep"]'); if (!b) return; toggleDeploy(+b.dataset.v); Snd.fx.click(); renderBrief(); });
on('bLaunch', launch);
on('bBack', () => { $('briefScr').classList.remove('show'); Hub.frame('panel'); refreshPanel(); $('hubScr').classList.add('show'); Snd.fx.click(); });
for (const b of document.querySelectorAll('#hubTabs button')) b.addEventListener('click', () => { Snd.init(); tab = b.dataset.v; Snd.fx.click(); renderHub(); });
on('hMus', () => { Snd.setMus(!Snd.musOn); hubTop(); });
on('hSfx', () => { Snd.setSfx(!Snd.sfxOn); hubTop(); });
on('hExit', () => { $('hubScr').classList.remove('show'); Hub.frame('title'); titleScreen(); });
let confirmCb = null;
function confirmBox(text, cb) { $('confirmText').textContent = text; confirmCb = cb; $('confirmScr').classList.add('show'); }
on('cYes', () => { $('confirmScr').classList.remove('show'); const cb = confirmCb; confirmCb = null; if (cb) cb(); });
on('cNo', () => { $('confirmScr').classList.remove('show'); confirmCb = null; });

// ---------- титульный экран и пролог
function titleScreen() {
  const has = !!S; $('bPlay').innerHTML = has ? '▶ ПРОДОЛЖИТЬ' : '▶ НОВАЯ КАМПАНИЯ'; $('bNew').style.display = has ? '' : 'none';
  $('startStat').textContent = has ? `Кредиты: ${crd(S.credits)} · операция ${Math.min(S.story + 1, STORY.length)} из ${STORY.length} · бойцов: ${S.roster.length}` : '';
  $('startScr').classList.add('show');
}
function begin() {
  Snd.init(); Music.start(); Music.setIntensity(0.08); goFullscreen(); $('startScr').classList.remove('show');
  if (S) { toHub(); return; }
  S = newSave(); saveGame();
  $('prologText').innerHTML = PROLOGUE.map((p, i) => `<p style="animation-delay:${0.3 + i * 0.9}s">${esc(p)}</p>`).join('');
  $('prologScr').classList.add('show');
}
on('bPlay', begin);
on('bNew', () => confirmBox('Начать новую кампанию? Весь прогресс, бойцы и кредиты будут потеряны.', () => { S = null; store(SAVE_KEY, ''); begin(); }));
on('bProlog', () => { $('prologScr').classList.remove('show'); toHub('ops'); });
on('bAgain', () => toHub('ops'));
on('bRetry', () => { const id = cur && cur.op.id; toHub('ops'); if (id && findOp(id)) openBrief(id); });
addEventListener('keydown', e => {
  if (phase !== 'hub') return;
  if (e.code === 'Escape') { if ($('confirmScr').classList.contains('show')) $('cNo').click(); else if ($('briefScr').classList.contains('show')) $('bBack').click(); }
  else if ((e.code === 'Enter' || e.code === 'Space') && $('startScr').classList.contains('show')) { e.preventDefault(); begin(); }
});

const Campaign = { missionEnd, biome: () => (cur ? cur.op.biome : biomeId) };

// =====================================================================
//  ЗАПУСК: модели → поле боя под экраном загрузки → корабль на орбите и титульный экран
// =====================================================================
loadCharacters().then(() => {
  warmBattle();
  S = loadSave();
  Hub.build(); Hub.resize(innerWidth, innerHeight); Hub.frame('title');
  if (S) Hub.setMods(S.research);
  phase = 'hub'; Hub.update(0); Hub.warm();
  $('loading').remove(); last = performance.now(); requestAnimationFrame(frame);
  titleScreen();
});
