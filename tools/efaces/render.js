// node monfaces.js — портреты (голова крупно) всех врагов и мутантов с 3D-моделей игры
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const OUT = '/tmp/claude-0/-home-user-rubin/71d162be-1aec-5bd8-ae17-e46cc11f6da8/scratchpad/mon/';
const LIST0 = [
  ['scav', 'c'], ['scav2', 'c'], ['alpha', 'c'], ['queen', 'c'], ['brute', 'c'], ['spitter', 'c'], ['guardian', 'c'],
  ['mur1', 'h'], ['bandit3', 'h'], ['bandit4', 'h'], ['mur2', 'h'], ['bandit5', 'h'], ['marksman', 'h'], ['boss', 'h']
];
const LIST = process.env.ONLY ? LIST0.filter(q => process.env.ONLY.split(',').includes(q[0])) : LIST0;
const DM = +(process.env.DM || 1), YAW = process.env.YAW !== undefined ? +process.env.YAW : 0.42, SUF = process.env.SUF || '';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await b.newPage({ viewport: { width: 700, height: 700 }, deviceScaleFactor: 1 });
  const errs = []; page.on('pageerror', (e) => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
  await page.route('http://game.local/**', (route) => { const f = path.join('/home/user/rubin/game', decodeURIComponent(new URL(route.request().url()).pathname)); if (!fs.existsSync(f)) return route.fulfill({ status: 404, body: '' }); route.fulfill({ status: 200, body: fs.readFileSync(f) }); });
  await page.goto('http://game.local/index.html?nosplash');
  await page.waitForFunction(() => window.DW && DW.R3 && DW.R3.units && DW.R3.units._lib && DW.M3, null, { timeout: 60000 });
  for (const [id, kind] of LIST) {
    const url = await page.evaluate(async ([id, kind, DM, YAW]) => {
      const R3 = DW.R3, T = R3.THREE, M3 = DW.M3, L = R3.units._lib;
      const c = document.createElement('canvas'); c.width = c.height = 640;
      const rd = new T.WebGLRenderer({ canvas: c, antialias: true, alpha: true, preserveDrawingBuffer: true });
      rd.setClearColor(0, 0); rd.outputColorSpace = T.SRGBColorSpace; rd.toneMapping = T.ACESFilmicToneMapping; rd.toneMappingExposure = 1.15;
      const sc = new T.Scene();
      sc.add(new T.HemisphereLight(0xfff0e0, 0x302820, 1.1));
      const key = new T.DirectionalLight(0xffe8d0, 2.6); key.position.set(-1.5, 2, 2.5); sc.add(key);
      const rim = new T.DirectionalLight(0xbfd4ff, 1.6); rim.position.set(2, 1.5, -2); sc.add(rim);
      const fill = new T.DirectionalLight(0xffffff, 0.6); fill.position.set(2, 0.5, 2); sc.add(fill);
      let body, H;
      const plain = (o) => { if (!o.isMesh) return; const one = (m) => { const q = m.clone(); q.onBeforeCompile = function () {}; return q; }; o.material = Array.isArray(o.material) ? o.material.map(one) : one(o.material); };
      if (kind === 'h') {
        const bi = M3.bodies[id]; H = bi.h || 1.8;
        const gl = await R3.loadGLB('models/' + bi.f + '.glb');
        body = L.makeBody(gl, H, true); L.retargetSetup(body);
        const P = L.samplePose('idle', 0.3, null); if (P) L.applyPose(body, P);
      } else {
        const ci = M3.creatures[id]; H = ci.h;
        const gl = await R3.loadGLB('models/' + ci.f + '.glb');
        const a = ci.anims.find(q => q.key === 'idle') || ci.anims[0];
        const lc = (a.clip || 'idle').toLowerCase();
        const clip = gl.animations.find(q => q.name.toLowerCase() === lc) || gl.animations.find(q => q.name.toLowerCase().indexOf(lc) >= 0) || gl.animations[0];
        body = L.makeBody(gl, H, false, ci.yaw || 0, clip);
        const mx = new T.AnimationMixer(body.root); if (clip) { mx.clipAction(clip).play(); mx.setTime(a.t0 || 0.1); }
      }
      body.holder.traverse(plain);
      sc.add(body.holder); body.holder.updateMatrixWorld(true);
      // голова: у людей — кость Head, у мутантов — конец цепочки «Head_N»
      let heads = []; body.root.traverse(o => { if (o.isBone && /head/i.test(o.name) && !/twist|neck/i.test(o.name)) heads.push(o); });
      heads.sort((p, q) => p.name.localeCompare(q.name));
      const hb = body.B.Head && kind === 'h' ? body.B.Head : (heads.length ? heads[heads.length - 1] : body.B.Head);
      const hp = hb.getWorldPosition(new T.Vector3());
      const box = new T.Box3().setFromObject(body.holder, true), sz = box.getSize(new T.Vector3());
      let tgt, d;
      if (kind === 'h') { tgt = hp.clone().add(new T.Vector3(0, 0.07, 0)); d = 0.95; }
      else {
        // морда: от основания головы к её концу, немного вперёд
        const h0 = heads.length ? heads[0].getWorldPosition(new T.Vector3()) : hp.clone();
        tgt = hp.clone().lerp(h0, 0.35);
        d = Math.max(0.7, Math.min(2.2, Math.max(sz.x, sz.y, sz.z) * 0.42));
        if (id === 'queen') { const ctr = box.getCenter(new T.Vector3()); tgt = new T.Vector3(ctr.x - sz.x * 0.09, box.min.y + sz.y * 0.86, box.max.z - sz.z * 0.28); d = sz.y * 0.58; }
        else if (id === 'brute' || id === 'spitter' || id === 'guardian') { tgt = hp.clone().add(new T.Vector3(0, 0.08, 0)); d = id === 'brute' ? 1.25 : 1.0; }
      }
      const yaw = YAW; d *= DM;
      const cam = new T.PerspectiveCamera(26, 1, 0.02, 50);
      cam.position.set(tgt.x + Math.sin(yaw) * d, tgt.y + d * 0.08, tgt.z + Math.cos(yaw) * d); cam.lookAt(tgt);
      rd.render(sc, cam);
      const u = c.toDataURL('image/png'); rd.dispose();
      return u;
    }, [id, kind, DM, YAW]);
    fs.writeFileSync(OUT + id + SUF + '.png', Buffer.from(url.split(',')[1], 'base64'));
    console.log('ok', id);
  }
  console.log('errs', errs.slice(0, 4).join(' | '));
  await b.close();
})();
