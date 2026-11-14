// Иконки оружия и брони — снимки 3D-моделей игры (как в бою): node tools/wicons/build.js
// Результат: game/js/wicons.js (DW.WICON: w_<оружие>, a_<броня> — картинки внутри файла, без «чужого» холста под file://)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await b.newPage({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.route('http://game.local/**', (route) => { const f = path.join(ROOT, 'game', decodeURIComponent(new URL(route.request().url()).pathname)); if (!fs.existsSync(f)) return route.fulfill({ status: 404, body: '' }); route.fulfill({ status: 200, body: fs.readFileSync(f) }); });
  await page.goto('http://game.local/index.html?nosplash');
  await page.waitForFunction(() => window.DW && DW.R3 && DW.R3.preview && DW.M3, null, { timeout: 60000 });
  const out = await page.evaluate(async () => {
    // обрезать прозрачные края, вписать в w×h с полями, webp
    const fit = (url, w, h, pad) => new Promise((res) => {
      const im = new Image();
      im.onload = () => {
        const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
        const g = c.getContext('2d'); g.drawImage(im, 0, 0);
        const d = g.getImageData(0, 0, c.width, c.height).data;
        let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
        for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        const o = document.createElement('canvas'); o.width = w; o.height = h;
        const og = o.getContext('2d');
        const bw = x1 - x0 + 1, bh = y1 - y0 + 1, k = Math.min((w - pad * 2) / bw, (h - pad * 2) / bh);
        og.shadowColor = 'rgba(0,0,0,0.55)'; og.shadowBlur = 8; og.shadowOffsetY = 4;
        og.imageSmoothingQuality = 'high';
        og.drawImage(c, x0, y0, bw, bh, (w - bw * k) / 2, (h - bh * k) / 2, bw * k, bh * k);
        res(o.toDataURL('image/webp', 0.9));
      };
      im.src = url;
    });
    const PV = DW.R3.preview, res = {};
    for (const id of Object.keys(DW.M3.weapons)) {
      const u = await PV.snap({ view: 'weapon', weapon: id, w: 720, h: 260 });
      if (u) res['w_' + id] = await fit(u, 360, 120, 6);
    }
    const ARM = { robe: 'krut', vest: 'vest', heavy: 'heavy', exo: 'exo' };
    for (const a in ARM) {
      if (!DW.M3.bodies[ARM[a]]) continue;
      const u = await PV.snap({ body: ARM[a], weapon: 'ak', view: 'torso', yaw: 0.3, w: 400, h: 400 });
      if (u) res['a_' + a] = await fit(u, 192, 192, 6);
    }
    /* ---------- Предметы Портала: снимки объёмных моделей (не рисунки) ---------- */
    const T = DW.R3.THREE, R3 = DW.R3;
    const M = (o) => new T.MeshStandardMaterial(o);
    const put = (grp, geo, mat, x, y, z, rx, ry, rz) => { const q = new T.Mesh(geo, mat); q.position.set(x || 0, y || 0, z || 0); q.rotation.set(rx || 0, ry || 0, rz || 0); grp.add(q); return q; };
    const ctex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 8; return t; };
    // UV ящика в метрах (текстура «тайлом» по k м), чтобы доски и бетон были в своём масштабе
    const boxM = (w, h, d, k) => { const g = new T.BoxGeometry(w, h, d); const uv = g.attributes.uv; const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]; for (let f = 0; f < 6; f++) for (let j = 0; j < 4; j++) { const i = f * 4 + j; uv.setXY(i, uv.getX(i) * dims[f][0] / k, uv.getY(i) * dims[f][1] / k); } return g; };
    const metal = (c, r) => M({ color: c, metalness: 0.85, roughness: r === undefined ? 0.35 : r });

    // граната Ф-1: чугунный корпус с дольками (6 поясов × 8), запал УЗРГМ: рычаг, кольцо с чекой
    function f1() {
      const g = new T.Group();
      const geo = new T.SphereGeometry(1, 72, 54), p = geo.attributes.position, v = new T.Vector3();
      const sm = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        const lat = Math.acos(Math.max(-1, Math.min(1, v.y))), lon = Math.atan2(v.z, v.x);
        const la0 = 0.42, la1 = Math.PI - 0.36;
        let r = 1;
        if (lat > la0 && lat < la1) {
          const a = Math.abs(Math.sin((lat - la0) / (la1 - la0) * Math.PI * 6)), b = Math.abs(Math.sin(lon * 4));
          r = 1 + 0.085 * sm(0.12, 0.45, Math.min(a, b));
        }
        v.multiplyScalar(r); p.setXYZ(i, v.x * 0.0275, v.y * 0.0275 * 1.22, v.z * 0.0275);
      }
      geo.computeVertexNormals();
      const body = M({ color: 0x485634, roughness: 0.62, metalness: 0.3 });
      put(g, geo, body);
      const top = 0.0275 * 1.22;
      const steel = metal(0x9c9a90, 0.32), dark = metal(0x3c3a36, 0.5);
      put(g, new T.CylinderGeometry(0.0098, 0.011, 0.008, 28), dark, 0, top + 0.002, 0);
      put(g, new T.CylinderGeometry(0.0082, 0.0086, 0.024, 28), steel, 0, top + 0.017, 0);
      put(g, new T.CylinderGeometry(0.0062, 0.0082, 0.006, 28), steel, 0, top + 0.031, 0);
      // рычаг: сверху над запалом и вниз вдоль корпуса
      const lev = metal(0x868478, 0.4);
      put(g, new T.BoxGeometry(0.02, 0.0022, 0.011), lev, 0.009, top + 0.034, 0);
      put(g, new T.BoxGeometry(0.0022, 0.05, 0.011), lev, 0.0195, top + 0.01, 0, 0, 0, -0.06);
      put(g, new T.BoxGeometry(0.0022, 0.03, 0.009), lev, 0.026, top - 0.028, 0, 0, 0, 0.32);
      // кольцо и чека
      put(g, new T.TorusGeometry(0.0115, 0.0013, 10, 40), steel, -0.021, top + 0.02, 0.004, 0, 0.35, 0);
      put(g, new T.CylinderGeometry(0.0009, 0.0009, 0.024, 8), steel, -0.008, top + 0.02, 0, 0, 0, Math.PI / 2);
      return g;
    }
    // две гранаты: одна стоит, вторая лежит
    function gren() { const g = new T.Group(); const a = f1(); a.position.set(-0.035, 0, 0); g.add(a); const b = f1(); b.rotation.set(0, 0.8, Math.PI / 2 - 0.15); b.position.set(0.045, -0.012, 0.03); g.add(b); return g; }

    // выстрел ПГ-7В: боевая часть с обтекателем, двигатель, стабилизатор с перьями
    function pg7() {
      const g = new T.Group();
      const L = (pts, seg) => new T.LatheGeometry(pts.map((q) => new T.Vector2(q[0], q[1])), seg || 40);
      const olive = M({ color: 0x55603a, roughness: 0.5, metalness: 0.35 }), black = M({ color: 0x1c1c1a, roughness: 0.5, metalness: 0.4 });
      put(g, L([[0, 0], [0.005, 0.002], [0.008, 0.012], [0.0105, 0.03]]), black);
      put(g, L([[0.0105, 0.03], [0.026, 0.11], [0.040, 0.20], [0.0425, 0.215], [0.0425, 0.31], [0.036, 0.335], [0.024, 0.36], [0.021, 0.372]]), olive);
      put(g, L([[0.021, 0.372], [0.0215, 0.38], [0.0215, 0.70], [0.019, 0.71], [0.0185, 0.82], [0.016, 0.83], [0, 0.832]]), M({ color: 0x5e6252, roughness: 0.45, metalness: 0.5 }));
      put(g, new T.CylinderGeometry(0.0225, 0.0225, 0.012, 30), metal(0x8a887c), 0, 0.5, 0);
      for (let k = 0; k < 4; k++) { const f = put(g, new T.BoxGeometry(0.002, 0.075, 0.03), metal(0x707064, 0.45), 0, 0.785, 0, 0, k * Math.PI / 2, 0); f.geometry.translate(0, 0, 0.033); }
      g.rotation.z = -Math.PI / 2;
      const h = new T.Group(); h.add(g); return h;
    }
    function rockets() { const g = new T.Group(); const a = pg7(); a.position.set(-0.4, 0, -0.05); g.add(a); const b = pg7(); b.position.set(-0.36, -0.01, 0.07); b.rotation.y = 0.12; g.add(b); return g; }

    // аптечка АИ-2: оранжевый пластик, надпись и крест; бинт
    function meds() {
      const g = new T.Group();
      const w = 0.09, h = 0.10, r = 0.008;
      const sh = new T.Shape(); sh.moveTo(-w / 2 + r, -h / 2); sh.lineTo(w / 2 - r, -h / 2); sh.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); sh.lineTo(w / 2, h / 2 - r); sh.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); sh.lineTo(-w / 2 + r, h / 2); sh.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); sh.lineTo(-w / 2, -h / 2 + r); sh.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
      const geo = new T.ExtrudeGeometry(sh, { depth: 0.016, bevelEnabled: true, bevelSize: 0.0025, bevelThickness: 0.003, bevelSegments: 3, curveSegments: 6 });
      const lab = ctex(256, 288, (c, W, H) => {
        c.fillStyle = '#e0641c'; c.fillRect(0, 0, W, H);
        c.fillStyle = 'rgba(255,255,255,0.08)'; for (let i = 0; i < 40; i++) c.fillRect(Math.random() * W, Math.random() * H, 3, 3);
        c.fillStyle = '#f2ece0'; c.beginPath(); c.arc(W / 2, H * 0.42, 70, 0, 7); c.fill();
        c.fillStyle = '#c4161c'; c.fillRect(W / 2 - 20, H * 0.42 - 54, 40, 108); c.fillRect(W / 2 - 54, H * 0.42 - 20, 108, 40);
        c.fillStyle = '#2a1a10'; c.font = 'bold 38px sans-serif'; c.textAlign = 'center'; c.fillText('АИ-2', W / 2, H * 0.86);
      });
      lab.repeat.set(1 / w, 1 / h); lab.offset.set(0.5, 0.5);
      const plast = M({ color: 0xe0641c, roughness: 0.42, metalness: 0.0 });
      const face = M({ map: lab, roughness: 0.42 });
      const box = put(g, geo, [face, plast], 0, 0.0095, 0, -Math.PI / 2, 0, 0.25);
      box.position.y = 0.003;
      const roll = M({ color: 0xece8de, roughness: 0.95 });
      put(g, new T.CylinderGeometry(0.024, 0.024, 0.07, 32), roll, 0.07, 0.024, 0.03, 0, 0.3, Math.PI / 2);
      put(g, new T.BoxGeometry(0.05, 0.0012, 0.07), roll, 0.105, 0.0006, 0.06, 0, 0.3, 0);
      return g;
    }
    // тушёнка: жестяные банки с бумажной этикеткой
    function food() {
      const g = new T.Group();
      const lab = ctex(512, 128, (c, W, H) => {
        c.fillStyle = '#c9a04a'; c.fillRect(0, 0, W, H);
        c.fillStyle = '#6a2a14'; c.fillRect(0, 10, W, 8); c.fillRect(0, H - 18, W, 8);
        c.fillStyle = '#4a1e0c'; c.font = 'bold 30px sans-serif'; c.textAlign = 'center';
        c.fillText('ГОВЯДИНА ТУШЁНАЯ', W * 0.3, H * 0.62); c.fillText('ГОСТ', W * 0.8, H * 0.62);
        c.fillStyle = 'rgba(60,30,10,0.18)'; for (let i = 0; i < 70; i++) c.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 6, 2);
      });
      const tin = metal(0x77746a, 0.42), side = M({ map: lab, roughness: 0.75 });
      const can = (x, y, z, ry) => { const q = put(g, new T.CylinderGeometry(0.05, 0.05, 0.06, 48, 1), [side, tin, tin], x, y + 0.03, z, 0, ry, 0); put(g, new T.TorusGeometry(0.0495, 0.0022, 6, 48), tin, x, y + 0.06, z, Math.PI / 2, 0, 0); put(g, new T.TorusGeometry(0.0495, 0.0022, 6, 48), tin, x, y, z, Math.PI / 2, 0, 0); return q; };
      can(-0.052, 0, 0, 0.4); can(0.052, 0, 0.01, 2.2); can(0, 0.062, 0.004, 1.3); can(0.03, 0, 0.1, 3.4);
      return g;
    }
    // стройматериалы: стопка досок, кирпичи, мешок цемента
    function mat() {
      const g = new T.Group();
      const pl = R3.pbr('wood', { color: 0xe0cdb0 }).clone();
      for (let L = 0; L < 3; L++) for (let k = 0; k < 4; k++) put(g, boxM(0.62, 0.028, 0.105, 1.0), pl, (Math.random() - 0.5) * 0.02, 0.014 + L * 0.03, -0.17 + k * 0.112 + (L % 2) * 0.01, 0, (Math.random() - 0.5) * 0.03, 0);
      const br = M({ color: 0x9a4c32, roughness: 0.92, normalMap: R3.tex('tex3d/concrete_n.jpg'), normalScale: new T.Vector2(0.6, 0.6) });
      for (let L = 0; L < 2; L++) for (let k = 0; k < 3; k++) put(g, boxM(0.25, 0.065, 0.12, 0.3), br, 0.47 + (L % 2) * 0.02, 0.0325 + L * 0.067, -0.13 + k * 0.125, 0, (Math.random() - 0.5) * 0.08, 0);
      put(g, boxM(0.25, 0.065, 0.12, 0.3), br, 0.47, 0.0325 + 2 * 0.067, -0.06, 0, 0.3, 0);
      // мешок цемента: бумажный, с надписью сверху
      const bag = new T.BoxGeometry(0.36, 0.085, 0.24, 6, 2, 6), bp = bag.attributes.position, bv = new T.Vector3();
      for (let i = 0; i < bp.count; i++) { bv.fromBufferAttribute(bp, i); const kx = 1 - Math.pow(Math.abs(bv.x) / 0.18, 4) * 0.12, kz = 1 - Math.pow(Math.abs(bv.z) / 0.12, 4) * 0.12; bp.setY(i, bv.y * (bv.y > 0 ? kx * kz : 1)); }
      bag.computeVertexNormals();
      const bt = ctex(256, 160, (c, W, H) => { c.fillStyle = '#c8b894'; c.fillRect(0, 0, W, H); c.fillStyle = 'rgba(90,70,40,0.25)'; for (let i = 0; i < 60; i++) c.fillRect(Math.random() * W, Math.random() * H, 3, 1); c.fillStyle = '#5a3a22'; c.font = 'bold 40px sans-serif'; c.textAlign = 'center'; c.fillText('ЦЕМЕНТ', W / 2, H * 0.48); c.font = 'bold 26px sans-serif'; c.fillText('М400 · 50 кг', W / 2, H * 0.78); });
      const bm = M({ color: 0xc8b894, roughness: 0.95 }), bf = M({ map: bt, roughness: 0.95 });
      put(g, bag, [bm, bm, bf, bm, bm, bm], 0.02, 0.135, -0.01, 0, 0.25, 0);
      return g;
    }
    // патроны: цинк/ящик из игры
    const ammoGl = await R3.loadGLB('models/e_ammo.glb');
    const ITEMS = { gren: gren(), rockets: rockets(), meds: meds(), food: food(), mat: mat(), ammo: ammoGl ? ammoGl.scene.clone(true) : null };
    await new Promise((r) => setTimeout(r, 2500));   // текстуры досок и бетона
    const SZ = { rockets: [360, 140], ammo: [192, 192] };
    for (const k in ITEMS) {
      if (!ITEMS[k]) continue;
      const sz = SZ[k] || [192, 192];
      const u = await PV.snap({ view: 'obj', obj: ITEMS[k], w: sz[0] * 2, h: sz[1] * 2, yaw: k === 'rockets' ? 0.35 : 0.65, pitch: k === 'rockets' ? 0.5 : 0.62 });
      if (u) res['i_' + k] = await fit(u, sz[0], sz[1], 6);
    }
    // модули: на автомате, само оружие темнее
    for (const md of ['stock', 'mag', 'scope', 'supp']) {
      const u = await PV.snap({ view: 'weapon', weapon: 'ak', mods: [md], dim: 0.85, ghost: 0.4, focus: true, w: 520, h: 340 });
      if (u) res['i_m_' + md] = await fit(u, 240, 156, 4);
    }
    return res;
  });
  const keys = Object.keys(out);
  const js = "'use strict';\n/* Иконки оружия и брони — снимки 3D-моделей; сгенерировано tools/wicons/build.js — не править руками */\nwindow.DW = window.DW || {};\nDW.WICON = {\n" +
    keys.map((k) => '  ' + k + ": '" + out[k] + "'").join(',\n') + '\n};\n';
  fs.writeFileSync(path.join(ROOT, 'game/js/wicons.js'), js);
  console.log(keys.join(' '), Math.round(js.length / 1024) + ' КБ', errs.slice(0, 3).join(' | '));
  await b.close();
})();
