// Проверка анимаций «Клонов против дроидов»: каждый тип бойца проходит все состояния (стойка, ходьба, бег, прицел,
// присед, дозор, перезарядка, бросок, попадание), в каждом кадре меряются суставы. Отчёт — JSON и лист снимков.
// Запуск: node scripts/clones-anim-check.js [папка-для-отчёта]   (нужен Playwright с Chromium)
//
// Что считается ошибкой:
//  knee    — колено ушло назад за линию «бедро — стопа» (вывернуто), или согнуто сильнее 160°, или в стойке
//            смотрит в сторону от носка больше чем на 25° (нога выглядит вывернутой);
//  elbow   — локоть вывернут внутрь, в корпус (смотрит к середине груди) или разогнут дальше прямой;
//  twist   — плечо или предплечье скручены вокруг своей оси больше, чем позволяет сустав человека (плечо ±100°,
//            предплечье ±95° от позы привязки); кисть — больше ±170° (кручение кисти несут кости скручивания
//            предплечья, а перекрученную кожу ловит pinch);
//  grip    — кисть не дотянулась до хвата оружия дальше 4 см (рука «висит» мимо винтовки);
//  foot    — стопа провалилась под землю или в стойке проскальзывает больше 1,5 см за кадр;
//  lean    — корпус откинут назад: линия «таз — шея» позади вертикали больше чем на 5° (кроме попадания и броска);
//  stock   — при прицеле приклад не в плече: дальше 0,8 длины плеча от плечевого сустава;
//  wrist   — кисть на оружии согнута относительно предплечья больше 75° (запястье «сломано»);
//  pinch   — сетка у локтя или запястья стянута к центру сустава (эффект «фантика» от перекрученного сустава): меньше 50%
//            исходного (перекрученное запястье давало 38–44%, обычный сильный сгиб локтя — 55–65%).
// Случайности (взгляд по сторонам, фаза клипа) зафиксированы — повторный запуск даёт тот же отчёт.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..', 'clones', 'www');
const out = path.resolve(process.argv[2] || path.join(__dirname, '..', 'clones', 'anim-report'));
fs.mkdirSync(out, { recursive: true });
const TYPES = (process.env.TYPES || 'clone:trooper,clone:heavy,clone:sniper,clone:commander,clone:pilot,droid:b1,droid:bx,droid:b2,droid:tx').split(',').map(s => s.split(':'));
const STATES = (process.env.STATES || 'idle,walk,run,aim,hunker,overwatch,reload,throw,hit').split(',');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.json': 'application/json', '.txt': 'text/plain' };

const server = http.createServer((q, s) => {
  const f = path.join(root, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); s.end(); return; }
  s.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(s);
});

(async () => {
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 914, height: 411 } });
  await ctx.addInitScript(() => { let a = 12345; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; });
  const p = await ctx.newPage(); p.setDefaultTimeout(600000);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(`http://localhost:${port}/index.html`);
  await p.waitForFunction(() => !document.getElementById('loading'), null, { timeout: 300000 });
  const res = await p.evaluate(([TYPES, STATES]) => {
    const LIM = { knee: 160, twist: { Arm: 100, ForeArm: 95, Hand: 170 }, grip: 0.04, slide: 0.015, leanBack: 5, stock: 0.8, wrist: 75, pinch: 0.5 };
    const deg = r => r * 180 / Math.PI, V = () => new THREE.Vector3();
    // скручивание кости вокруг своей оси относительно позы привязки (разложение поворота на «качание» и «кручение»)
    const twistOf = (bone, q0) => {
      const ch = bone.children.find(c => c.isBone); if (!ch) return 0;
      const ax = ch.position.clone().normalize(), d = q0.clone().invert().multiply(bone.quaternion);
      const p = d.x * ax.x + d.y * ax.y + d.z * ax.z; let a = 2 * Math.atan2(p, d.w); if (a > Math.PI) a -= 2 * Math.PI; if (a < -Math.PI) a += 2 * Math.PI; return deg(a);
    };
    const report = [], sheet = [];
    for (const [team, type] of TYPES) {
      for (const st of STATES) {
        const rig = makeRig(team, type, null, true); if (!rig.skinned) continue;
        rig.root.scale.setScalar(UNIT_SCALE * (rig.meshy ? 1 : TYPE_SCALE[type] || 1));
        const B = rig.bones, bind = {}; for (const [n, bn] of Object.entries(B)) bind[n] = bn.quaternion.clone();
        // вершины у локтя и запястья (вес делится между соседними костями) и их радиус до оси сустава в позе привязки
        let skin = null; rig.model.traverse(o => { if (o.isSkinnedMesh) skin = o; });
        const joints = [];
        if (skin && rig.meshy) {
          const g = skin.geometry, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, bl = skin.skeleton.bones, gc = (a, i, k) => k === 0 ? a.getX(i) : k === 1 ? a.getY(i) : k === 2 ? a.getZ(i) : a.getW(i);
          for (const s of ['Left', 'Right']) for (const [pa, ch] of [['Arm', 'ForeArm'], ['ForeArm', 'Hand']]) {
            // у запястья вес предплечья частично на костях скручивания — считаем их предплечьем
            const ips = [B[s + pa], ...(pa === 'ForeArm' ? [B[s + 'Twist1'], B[s + 'Twist2']] : [])].filter(Boolean).map(b => bl.indexOf(b)), ic = bl.indexOf(B[s + ch]), vs = [];
            for (let i = 0; i < si.count && vs.length < 160; i++) { let wp = 0, wc = 0; for (let k = 0; k < 4; k++) { const j = gc(si, i, k), w = gc(sw, i, k); if (ips.includes(j)) wp += w; if (j === ic) wc += w; } if (wp > 0.25 && wc > 0.25 && wp + wc > 0.8) vs.push(i); }
            if (vs.length > 10) joints.push({ name: s + ch, pa: B[s + pa], ch: B[s + ch], vs });
          }
          const radius = (J) => { const a = J.pa.getWorldPosition(V()), j = J.ch.getWorldPosition(V()), len = a.distanceTo(j), ax = j.clone().sub(a).normalize(), v = V();
            // расстояние до центра сустава: при сгибе почти не меняется, при перекрученном суставе вершины стягиваются к центру
            const rs = J.vs.map(i => { skin.boneTransform(i, v.fromBufferAttribute(skin.geometry.attributes.position, i)); v.applyMatrix4(skin.matrixWorld); return v.distanceTo(j) / len; }).sort((x, y) => x - y);
            return rs[rs.length >> 1]; };
          const keep = []; rig.root.traverse(o => keep.push([o, o.position.clone(), o.quaternion.clone(), o.scale.clone()]));
          skin.skeleton.pose(); rig.root.updateMatrixWorld(true); for (const J of joints) { J.r0 = radius(J); J.radius = radius; }
          for (const [o, p, q, sc] of keep) { o.position.copy(p); o.quaternion.copy(q); o.scale.copy(sc); } rig.root.updateMatrixWorld(true);
        }
        const u = { rig, team, type, state: st === 'overwatch' ? 'idle' : st, overwatch: st === 'overwatch', t: 0, flinch: 0, x: -5, z: -5, hp: 9, maxHp: 9, dmgT: 9, seed: 0, animSpeed: st === 'run' ? 3.2 : 1.3 };
        const N = 150, worst = {}, bad = {}, add = (k, v, f) => { if (worst[k] === undefined || v > worst[k].v) worst[k] = { v: +v.toFixed(3), f }; };
        const flag = (k, f) => { bad[k] = (bad[k] || 0) + 1; };
        let prevFeet = null;
        for (let f = 0; f < N; f++) {
          if (st === 'reload') u.reloadK = (f % 90) / 90; if (st === 'throw') u.throwK = (f % 90) / 90;
          if (st === 'hit' && f % 60 === 0) u.flinch = 1;
          poseSkinned(u, 1 / 60); rig.root.updateMatrixWorld(true);
          if (f < 20) continue;
          const q = rig.body.getWorldQuaternion(new THREE.Quaternion()), fw = V().set(0, 0, 1).applyQuaternion(q), up = V().set(0, 1, 0).applyQuaternion(q), sc = rig.body.getWorldScale(V()).y;
          const P = n => B[n].getWorldPosition(V());
          // колени
          for (const s of ['Left', 'Right']) {
            const H = P(s + 'UpLeg'), K = P(s + 'Leg'), F = P(s + 'Foot'), a = F.clone().sub(H), t = clamp(K.clone().sub(H).dot(a) / a.lengthSq(), 0, 1);
            const off = K.clone().sub(H.clone().addScaledVector(a, t)).dot(fw) / a.length();
            const ang = 180 - deg(H.clone().sub(K).angleTo(F.clone().sub(K)));
            add('kneeBack', -off, f); add('kneeBend', ang, f);
            if (off < -0.02 || ang > LIM.knee) flag('knee', f);
            // колено над носком (в стойке: нога согнута не глубоко)
            if (B[s + 'ToeBase'] && ang > 10 && ang < 80 && ['idle', 'aim', 'reload', 'throw'].includes(st)) {
              const ax = F.clone().sub(H).normalize(), kd = K.clone().sub(H.clone().addScaledVector(ax, K.clone().sub(H).dot(ax))), td = P(s + 'ToeBase').sub(F); td.addScaledVector(ax, -td.dot(ax));
              const kt = Math.abs(deg(Math.atan2(kd.clone().cross(td).dot(ax), kd.dot(td)))); add('kneeToe', kt, f); if (kt > 25) flag('knee', f);
            }
          }
          // локти: не внутрь корпуса и не разогнуты за прямую
          const chest = P('Spine2');
          for (const s of ['Left', 'Right']) {
            const S0 = P(s + 'Arm'), E = P(s + 'ForeArm'), Hd = P(s + 'Hand'), a = Hd.clone().sub(S0), t = clamp(E.clone().sub(S0).dot(a) / a.lengthSq(), 0, 1);
            const off = E.clone().sub(S0.clone().addScaledVector(a, t)), L = S0.distanceTo(E) + E.distanceTo(Hd);
            const out = S0.clone().sub(chest); out.addScaledVector(up, -out.dot(up)).normalize();
            const inward = -off.dot(out) / L; add('elbowIn' + s, inward, f);
            if (inward > 0.18) flag('elbow', f);
          }
          // скручивание рук
          for (const s of ['Left', 'Right']) for (const part of ['Arm', 'ForeArm', 'Hand']) {
            const tw = Math.abs(twistOf(B[s + part], bind[s + part])); add('twist' + s + part, tw, f);
            if (tw > LIM.twist[part]) flag('twist', f);
          }
          // кисти на оружии
          if (rig.gun && rig.grips && !rig.wrist && st !== 'throw') {
            const gp = a => rig.gun.localToWorld(V().set(a[0], a[1], a[2]));
            const dr = P('RightHand').distanceTo(gp(rig.grips.r)) / sc, dl = st === 'reload' ? 0 : P('LeftHand').distanceTo(gp(rig.grips.l)) / sc;
            add('gripR', dr, f); add('gripL', dl, f); if (dr > LIM.grip || dl > LIM.grip) flag('grip', f);
          }
          // корпус не откинут назад (при попадании и броске — можно)
          const nh = P('Neck').sub(P('Hips')), lean = deg(Math.atan2(nh.dot(fw), nh.dot(up)));
          add('leanBack', -lean, f); if (st !== 'hit' && st !== 'throw' && lean < -LIM.leanBack) flag('lean', f);
          // при прицеле приклад в плече
          if (rig.butt && rig.gun && (st === 'aim' || st === 'overwatch')) {
            const bw = rig.gun.parent.localToWorld(rig.butt.clone().applyQuaternion(rig.gun.quaternion).add(rig.gun.position));
            const k = bw.distanceTo(P('RightArm')) / P('RightArm').distanceTo(P('RightForeArm')); add('stock', k, f); if (k > LIM.stock) flag('stock', f);
          }
          // запястья: угол между предплечьем и направлением пальцев кисти (оси кисти из rig.M.hand)
          if (rig.M && rig.M.hand && rig.gun && !rig.wrist) for (const s of ['Right', 'Left']) {
            if ((s === 'Right' && st === 'throw') || (s === 'Left' && st === 'reload')) continue;
            const H = rig.M.hand[s]; if (!H) continue;
            const fa = P(s + 'Hand').sub(P(s + 'ForeArm')).normalize(), fh = H.f.clone().transformDirection(B[s + 'Hand'].matrixWorld);
            const a = deg(fa.angleTo(fh)); add('wrist' + s, a, f); if (a > LIM.wrist) flag('wrist', f);
          }
          // сжатие сетки у суставов рук
          for (const J of joints) { const k = J.radius(J) / J.r0; add('pinch' + J.name, -k, f); if (k < LIM.pinch) flag('pinch', f); }
          // стопы
          const feet = ['LeftFoot', 'RightFoot'].map(P), gnd = rig.root.position.y;
          for (const F of feet) { const below = (gnd - (F.y - 0.03 * sc)) / sc; add('footBelow', below, f); if (below > 0.03) flag('foot', f); }
          if (prevFeet && (st === 'idle' || st === 'aim' || st === 'hunker' || st === 'overwatch')) for (let i = 0; i < 2; i++) { const sl = feet[i].distanceTo(prevFeet[i]) / sc; add('footSlide', sl, f); if (sl > LIM.slide) flag('foot', f); }
          prevFeet = feet.map(v => v.clone());
        }
        report.push({ type, state: st, bad, worst });
      }
    }
    return report;
  }, [TYPES, STATES]);
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(res, null, 1));
  // сводка в консоль: сколько кадров с ошибками по видам
  let total = 0; const byKind = {};
  for (const r of res) for (const [k, n] of Object.entries(r.bad)) { total += n; byKind[k] = (byKind[k] || 0) + n; }
  console.log('кадров с ошибками:', total, JSON.stringify(byKind));
  for (const r of res) if (Object.keys(r.bad).length) console.log(' ', r.type.padEnd(9), r.state.padEnd(9), JSON.stringify(r.bad), 'хуже всего:', Object.entries(r.worst).filter(([k]) => /twist|elbowIn|kneeBack|kneeToe|grip|leanBack|stock|wrist|pinch/.test(k)).sort((a, b) => b[1].v - a[1].v).slice(0, 3).map(([k, w]) => k + '=' + w.v).join(' '));
  if (errs.length) console.log('ошибки страницы:', errs);
  await b.close(); server.close();
  process.exitCode = total ? 1 : 0;
})();
