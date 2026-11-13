'use strict';
/* Экран базы: объёмная диорама плацдарма — постройки, жители за своими делами, дым и огонь, грузы,
   день и ночь, стройка. Всё живое здесь — дешёвая 2D-графика поверх диорамы: частицы из пула,
   свечения из готовых спрайтов, без выделения памяти в кадре. */
(function (DW) {
  const U = DW.U, D = DW.D, ART = DW.ART, el = U.el;
  const S = {};
  const HW = 32, HH = 16, N = 10, EDGE = 34, GS = 1.5;
  const O = { hw: HW, hh: HH };
  const P = function (u, v, h) { return [(u - v) * HW, (u + v) * HH - (h || 0)]; };
  // то же без создания массива — для горячих циклов
  const PX = function (u, v) { return (u - v) * HW; };
  const PY = function (u, v, h) { return (u + v) * HH - h; };
  let hud = null, plate = null, plateKey = '';
  let people = [], buildAnim = {}, sel = null, lastT = 0, frameDt = 0.016;
  const cam = { x: 0, y: N * HH, z: 1 };
  const view = { w: 800, h: 400 };

  /* Места построек на участке (u, v — угол, w/d — размер в клетках) */
  const SLOT = {
    hq: { u: 4.0, v: 4.0, w: 2.3, d: 2.0, n: 'Штаб', desc: 'Сердце плацдарма: склад, рация, нары.' },
    tower: { u: 1.1, v: 1.1, w: 1.1, d: 1.1 },
    infirmary: { u: 6.9, v: 1.2, w: 2.0, d: 1.7 },
    workshop: { u: 1.2, v: 6.9, w: 1.9, d: 1.8 },
    farm: { u: 6.9, v: 6.8, w: 2.1, d: 1.9 },
    beacon: { u: 2.6, v: 3.8, w: 0.9, d: 0.9 },
    turret: { u: 8.5, v: 4.4, w: 0.8, d: 0.8 },
    radio: { u: 1.05, v: 4.1, w: 1.0, d: 1.0 },
    garage: { u: 7.95, v: 3.0, w: 1.45, d: 1.2 },
    ammo: { u: 1.3, v: 2.55, w: 1.1, d: 1.0 },
    walls: { u: 0.25, v: 0.25, w: 9.5, d: 9.5 }
  };
  const SLOT_KEYS = Object.keys(SLOT).filter(function (k) { return k !== 'walls'; });
  const TURRET2 = { u: 4.4, v: 8.5, w: 0.8, d: 0.8 };
  /* Точки, куда ходят жители */
  const WP = {
    hq: [5.6, 6.5], fire: [5.0, 7.6], fire2: [5.7, 7.9], workshop: [3.5, 7.7], farm: [7.0, 6.4], infirmary: [7.6, 3.3],
    tower: [2.6, 2.3], gate: [8.9, 5.0], crates: [3.6, 5.4], beacon: [3.0, 3.2]
  };
  const RING = [[3.4, 3.4], [6.9, 3.6], [6.9, 6.7], [3.4, 6.7]];

  /* Места занятий: костёр и места вокруг него, наковальня, грядка, койки раненых, площадка грузов */
  const FIRE = [5.2, 7.4];
  const SEATS = [[4.1, 7.29], [4.5, 7.31], [5.89, 7.7], [5.91, 8.1], [4.95, 6.75], [5.65, 6.85], [4.6, 7.95]];
  const SPOT = {
    smith: [3.12, 7.62], anvil: [3.4, 7.9],
    medic: [6.85, 2.2], cots: [[6.3, 2.45], [6.55, 2.9]], kit: [6.95, 2.75],
    bed: { u0: 6.35, u1: 6.85, v0: 7.6, v1: 8.6 }, farm: [[7.02, 7.8], [7.02, 8.25], [6.6, 8.78]],
    pad: { u0: 3.0, v0: 5.0, u1: 3.9, v1: 5.75 },
    dog: [5.5, 8.35],
    line: { u0: 1.45, u1: 3.0, v: 5.75, h: 22 }
  };
  // помост за дальними стенами: высота настила и концы обхода дозорных
  const CW = { h: 12, a: 0.27, b: 0.58 };
  const CWR = [[2.8, 0.42], [9.2, 0.42]], CWL = [[0.42, 2.8], [0.42, 9.2]];
  // часовой на вышке поворачивается: наружу, вдоль стен, изредка — внутрь лагеря
  const SENTRY_FACES = [-Math.PI * 0.75, -Math.PI / 2, -Math.PI * 0.75, Math.PI, -Math.PI * 0.75, Math.PI / 4];
  const TOWER_C = [1.65, 1.65];
  /* Точки на 3D-моделях (смещение от точки привязки модели в экранных точках мира) */
  const M3 = {
    tower: { fx: -1, fy: -93, rail: -101, lx: 14, ly: -104 },
    hq: { win: [[-38, -7.2, 6, 9, 0.5], [-5.2, -3.8, 6, 7, -0.5], [38.6, -22.2, 6, 8, -0.5]], door: [17, -9.7], pipe: [28, -36] },
    infirmary: { pipe: [22, -22], glow: [0, -18] },
    workshop: { pipe: [-19, -33], forge: [14, -6] },
    radio: { tip: [0.3, -69] },
    garage: { lamp: [2.4, -26] },
    gate: { lamps: [[-23.5, -49], [23.2, -34.2]] }
  };

  /* ---------- Качество графики ---------- */
  // низкая / средняя / высокая: доля частиц, предел пула, светлячки, вороны
  const QMUL = [0.5, 0.75, 1], QCAP = [50, 90, 120], QFLY = [0, 7, 14], QCROW = [2, 3, 4];
  let Q = 2, qMul = 1, capNow = 120;
  function readQuality() { Q = DW.gfxLevel ? DW.gfxLevel() : 2; qMul = QMUL[Q]; capNow = QCAP[Q]; }

  S.enter = function () {
    const st = DW.G.state;
    sel = null; buildAnim = {};
    plate = null;
    readQuality();
    clearParts();
    evening = false; seatBy.fill(null);
    initPeople(st);
    initCrows();
    S.resize(window.innerWidth, window.innerHeight);
    buildHud();
    S.refresh();
  };
  S.exit = function () { document.getElementById('ui').innerHTML = ''; hud = null; };
  S.resize = function (w, h) { view.w = w; view.h = h; cam.z = U.clamp(Math.min(w / 780, h / 520), 0.5, 1.8); cam.x = 0; cam.y = N * HH - 16; };
  S.select = function (k) { sel = k; focusSel(); S.refresh(); };
  function focusSel() {
    if (!sel || !SLOT[sel] || sel === 'walls') { cam.tx = null; return; }
    const s = SLOT[sel], c = P(s.u + s.w / 2, s.v + s.d / 2, 0);
    cam.tx = c[0] + view.w * 0.16 / cam.z; cam.ty = c[1] - 10;
  }
  S.pan = function (dx, dy) { cam.tx = null; cam.x = U.clamp(cam.x - dx / cam.z, -N * HW * 0.6, N * HW * 0.6); cam.y = U.clamp(cam.y - dy / cam.z, N * HH * 0.3, N * HH * 1.7); };
  S.zoomAt = function (f) { cam.z = U.clamp(cam.z * f, 0.5, 2.6); };
  S.back = function () { DW.Main.toWorld(); };
  S.idle = function () { return !Object.keys(buildAnim).length && (cam.tx === null || cam.tx === undefined); };
  S.update = function () { };

  /* ---------- Жители ---------- */
  const ROLE_PREF = { sentry: 'sniper', patrol: 'rifleman', medic: 'medic', smith: 'heavy' };
  let nGen = 0, evening = false;
  const seatBy = new Array(SEATS.length).fill(null);
  function initPeople(st) {
    people = []; nGen = 0;
    const atBase = st.squadAt === st.baseNode;
    const list = atBase ? st.roster.slice(0, 8) : [];
    list.forEach(function (s, i) { const p = mkPerson(s.look, s.weapon, '#c8691c', i, s.wounds > 0, s.name === 'Мальборо'); p.s3 = { kind: 'soldier', name: s.name, armorId: s.armor, weapon: s.weapon, id: s.id }; p.cls = s.cls; people.push(p); });
    if (!atBase || list.length < 3) {
      const n = atBase ? 1 : 3;
      for (let i = 0; i < n; i++) people.push(settler(i === 0 ? 'ppsh' : null));
    }
    assignRoles(true);
  }
  /* житель гарнизона (когда отряд в походе или людей не хватает на все дела) */
  function settler(weapon) {
    const i = nGen++;
    const p = mkPerson(ART.makeLook(900 + i * 37, { glasses: false }), weapon, ['#6a6a5a', '#5a4a3a', '#7a6a4a'][i % 3], 20 + i, false, false);
    p.s3 = { kind: 'soldier', name: '', armorId: 'robe', weapon: weapon || 'ppsh', id: 31 + i };
    return p;
  }
  /* Роли по постройкам: часовой на вышке, дозорный на стене, медик, кузнец, садовник; раненые отдыхают */
  function assignRoles(place) {
    const G = DW.G;
    const want = [];
    if (G.blv('tower')) want.push('sentry');
    if (G.blv('walls')) want.push('patrol');
    if (G.blv('infirmary')) want.push('medic');
    if (G.blv('workshop')) want.push('smith');
    if (G.blv('farm')) want.push('farmer');
    const old = people.map(function (p) { return p.role; });
    people.forEach(function (p) { p.role = p.wounded ? 'rest' : 'free'; });
    want.forEach(function (r) {
      const pref = ROLE_PREF[r];
      let p = pref ? people.find(function (q) { return q.role === 'free' && q.cls === pref; }) : null;
      if (!p) p = people.find(function (q) { return q.role === 'free'; });
      if (!p && people.length < 10) { p = settler(r === 'sentry' || r === 'patrol' ? 'ppsh' : null); people.push(p); }
      if (p) p.role = r;
    });
    // кто-то всегда бродит по лагерю днём и греется у костра вечером
    let free = people.filter(function (p) { return p.role === 'free'; }).length;
    while (free < 2 && people.length < 10) { people.push(settler(null)); free++; }
    // лишние бойцы — второй дозорный на левой стене
    if (G.blv('walls') && free >= 4) people.find(function (q) { return q.role === 'free'; }).role = 'patrol2';
    let cot = 0;
    people.forEach(function (p, i) {
      p.noGun = p.role === 'medic' || p.role === 'farmer' || p.role === 'smith' || p.role === 'rest';
      p.cot = null;
      if (p.role === 'rest' && G.blv('infirmary') && cot < SPOT.cots.length) p.cot = SPOT.cots[cot++];
      if (place || old[i] === undefined) placeRole(p);
      else if (old[i] !== p.role) { leaveSeat(p); p.onTower = false; p.h = 0; p.path = []; p.wait = 0; }
    });
    if (DW.S3) people.forEach(function (p) { const Q3 = DW.S3.setsFor(p.s3); if (Q3) { DW.S3.load(Q3.body); if (Q3.weapon) DW.S3.load(Q3.weapon); } });
  }
  /* сразу поставить жителя на его место (при входе на экран) */
  function placeRole(p) {
    p.path = []; p.h = 0; p.onTower = false; p.act = 'idle'; p.wait = Math.random() * 2;
    const at = function (a) { p.u = a[0]; p.v = a[1]; };
    switch (p.role) {
      case 'sentry': at(TOWER_C); p.onTower = true; p.fi = p.seed % SENTRY_FACES.length; p.face = SENTRY_FACES[p.fi]; break;
      case 'patrol': p.u = U.lerp(CWR[0][0], CWR[1][0], Math.random()); p.v = CWR[0][1]; p.h = CW.h; p.speed = 0.55; break;
      case 'patrol2': p.u = CWL[0][0]; p.v = U.lerp(CWL[0][1], CWL[1][1], Math.random()); p.h = CW.h; p.speed = 0.55; break;
      case 'medic': at(SPOT.medic); faceTo(p, SPOT.cots[0]); break;
      case 'smith': at(SPOT.smith); faceTo(p, SPOT.anvil); p.act = 'work'; p.wait = 3 + Math.random() * 3; break;
      case 'farmer': p.bi = 0; at(SPOT.farm[0]); p.face = Math.PI; p.act = 'farm'; p.wait = 3 + Math.random() * 4; break;
      case 'rest':
        if (p.cot) { at(p.cot); p.h = 4; p.act = 'sit'; p.face = -Math.PI * 0.25; p.wait = 1e9; }
        else if (takeSeat(p, true)) p.wait = 1e9;
        break;
      default: break;
    }
  }
  function faceTo(p, a) { p.face = Math.atan2(a[1] - p.v, a[0] - p.u); const sx = (a[0] - p.u) - (a[1] - p.v); if (Math.abs(sx) > 0.02) p.dir = sx > 0 ? 1 : -1; }
  function near(p, a, r) { return Math.abs(p.u - a[0]) + Math.abs(p.v - a[1]) < (r || 0.15); }
  /* дальний путь — по кольцевой тропе, ближний — напрямик */
  function go(p, a, dest) { p.path = route([p.u, p.v], a); p.dest = dest; }
  function walkTo(p, a, dest) { p.path = [a]; p.dest = dest; }
  /* место у костра: занять, освободить */
  function takeSeat(p, now) {
    for (let i = SEATS.length - 1; i >= 0; i--) {
      if (seatBy[i]) continue;
      seatBy[i] = p; p.seat = i;
      if (now) { p.u = SEATS[i][0]; p.v = SEATS[i][1]; p.act = 'sit'; faceTo(p, FIRE); p.path = []; }
      else go(p, SEATS[i], 'seat');
      return true;
    }
    return false;
  }
  function leaveSeat(p) { if (p.seat >= 0) { seatBy[p.seat] = null; p.seat = -1; } }
  /* вечер: свободные и садовник идут к костру, если сидеть некому — и кузнец */
  function toFire() {
    let n = 0;
    people.forEach(function (p) { if (p.seat < 0 && (p.role === 'free' || p.role === 'farmer') && takeSeat(p, false)) n++; });
    if (n < 2) people.forEach(function (p) { if (n < 2 && p.role === 'smith' && p.seat < 0 && takeSeat(p, false)) n++; });
  }
  function fromFire() {
    people.forEach(function (p) { if (p.seat >= 0 && p.role !== 'rest') { leaveSeat(p); p.act = 'idle'; p.wait = Math.random() * 2.5; } });
  }
  function mkPerson(look, weapon, body, i, wounded, cig) {
    const w = wpList();
    const start = WP[w[i % w.length]] || WP.hq;
    return { look: look, weapon: weapon, body: body, u: start[0] + (Math.random() - 0.5) * 0.4, v: start[1] + (Math.random() - 0.5) * 0.4, h: 0, path: [], wait: Math.random() * 3, act: 'idle', wounded: wounded, cig: cig, dir: 1, seed: i, role: 'free', seat: -1, speed: 0.85, fi: 0, bi: 0, prevI: -1 };
  }
  function wpList() {
    const G = DW.G;
    const l = ['hq', 'fire', 'fire2', 'crates', 'gate'];
    ['workshop', 'farm', 'infirmary', 'tower', 'beacon'].forEach(function (k) { if (G.blv(k)) l.push(k); });
    return l;
  }
  function ringIdx(p) { let b = 0, bd = 1e9; RING.forEach(function (r, i) { const d = Math.hypot(r[0] - p[0], r[1] - p[1]); if (d < bd) { bd = d; b = i; } }); return b; }
  function route(from, to) {
    const a = ringIdx(from), b = ringIdx(to);
    const path = [];
    if (a !== b) {
      let i = a; const step = ((b - a + 4) % 4) <= 2 ? 1 : -1;
      path.push(RING[i]);
      while (i !== b) { i = (i + step + 4) % 4; path.push(RING[i]); }
    }
    path.push(to);
    return path;
  }
  function stepPeople(dt) {
    // сумерки и рассвет (с запасом, чтобы не дёргались на границе)
    if (!evening && nightK > 0.3) { evening = true; toFire(); }
    else if (evening && nightK < 0.12) { evening = false; fromFire(); }
    for (let i = 0; i < people.length; i++) {
      const p = people[i];
      if (p.path.length) { walk(p, dt); continue; }
      p.wait -= dt;
      if (p.wait > 0) continue;
      think(p);
    }
  }
  function walk(p, dt) {
    const tg = p.path[0];
    const dx = tg[0] - p.u, dy = tg[1] - p.v, d = Math.hypot(dx, dy);
    const sp = (p.speed || 0.85) * dt;
    const sx = (dx - dy);
    if (Math.abs(sx) > 0.02) p.dir = sx > 0 ? 1 : -1;
    if (d > 0.001) p.face = Math.atan2(dy, dx);
    if (d <= sp) { p.u = tg[0]; p.v = tg[1]; p.path.shift(); if (!p.path.length) arrive(p); }
    else { p.u += dx / d * sp; p.v += dy / d * sp; }
  }
  /* дошёл: чем заняться на месте */
  function arrive(p) {
    p.act = 'idle'; p.wait = 3 + Math.random() * 6;
    if (p.dest === 'seat') { p.act = 'sit'; p.wait = 4; faceTo(p, FIRE); return; }
    switch (p.role) {
      case 'sentry': if (p.dest === 'climb') { p.onTower = true; p.u = TOWER_C[0]; p.v = TOWER_C[1]; p.wait = 1; } break;
      case 'patrol': case 'patrol2':
        if (p.dest === 'wall') { p.act = 'scan'; p.wait = 2.5 + Math.random() * 3; p.face = p.role === 'patrol' ? -Math.PI / 2 : Math.PI; }
        else { p.h = CW.h; p.wait = 0.5; }
        break;
      case 'smith': p.act = 'work'; p.wait = 4 + Math.random() * 3; faceTo(p, SPOT.anvil); break;
      case 'farmer': p.act = 'farm'; p.wait = 5 + Math.random() * 4; p.water = Math.random() < 0.5; p.face = p.bi === 2 ? -Math.PI / 2 : Math.PI; break;
      case 'medic':
        if (p.dest === 'heal' && p.patient) { p.act = 'heal'; p.wait = 6 + Math.random() * 3; faceTo(p, [p.patient.u, p.patient.v]); }
        else { p.act = 'idle'; p.wait = 3 + Math.random() * 4; faceTo(p, SPOT.cots[1]); }
        break;
      case 'rest': if (p.cot) { p.h = 4; p.act = 'sit'; p.face = -Math.PI * 0.25; p.wait = 1e9; } break;
      default: break;
    }
  }
  /* постоял: что дальше */
  function think(p) {
    if (p.seat >= 0) { if (near(p, SEATS[p.seat])) { p.act = 'sit'; p.wait = 5; faceTo(p, FIRE); } else go(p, SEATS[p.seat], 'seat'); return; }
    switch (p.role) {
      case 'sentry':
        if (!p.onTower) { go(p, WP.tower, 'climb'); return; }
        p.fi = (p.fi + 1) % SENTRY_FACES.length; p.face = SENTRY_FACES[p.fi];
        p.act = Math.random() < 0.35 ? 'scan' : 'idle'; p.wait = 3 + Math.random() * 4;
        return;
      case 'patrol': case 'patrol2': {
        const L = p.role === 'patrol' ? CWR : CWL;
        if (p.h !== CW.h) { go(p, L[0], 'climb'); return; }
        const da = Math.abs(p.u - L[0][0]) + Math.abs(p.v - L[0][1]), db = Math.abs(p.u - L[1][0]) + Math.abs(p.v - L[1][1]);
        walkTo(p, da < db ? L[1] : L[0], 'wall');
        return;
      }
      case 'smith':
        if (!near(p, SPOT.smith)) { go(p, SPOT.smith, 'work'); return; }
        if (p.act === 'work') { p.act = 'idle'; p.wait = 1.5 + Math.random() * 2; } else { p.act = 'work'; p.wait = 4 + Math.random() * 4; }
        faceTo(p, SPOT.anvil);
        return;
      case 'farmer': {
        const far = !near(p, SPOT.farm[p.bi], 0.6);
        p.bi = (p.bi + 1) % SPOT.farm.length;
        if (far) go(p, SPOT.farm[p.bi], 'bed'); else walkTo(p, SPOT.farm[p.bi], 'bed');
        return;
      }
      case 'medic': {
        if (p.dest === 'heal' || !near(p, SPOT.medic, 0.6)) { p.patient = null; if (near(p, SPOT.medic, 1.2)) walkTo(p, SPOT.medic, 'door'); else go(p, SPOT.medic, 'door'); return; }
        const pt = pickPatient();
        if (pt && Math.random() < 0.8) { p.patient = pt; walkTo(p, [pt.u + 0.32, pt.v + 0.08], 'heal'); return; }
        p.act = Math.random() < 0.4 ? 'scan' : 'idle'; p.wait = 3 + Math.random() * 3;
        return;
      }
      case 'rest':
        if (p.cot && !near(p, p.cot)) { p.h = 0; go(p, p.cot, 'cot'); return; }
        if (!p.cot && takeSeat(p, false)) return;
        p.act = 'sit'; p.wait = 10;
        return;
      default: {
        // свободный житель бродит по лагерю
        const k = U.pick(wpList()), tg = WP[k];
        go(p, [tg[0] + (Math.random() - 0.5) * 0.5, tg[1] + (Math.random() - 0.5) * 0.5], k);
      }
    }
  }
  /* раненый на койке, к которому подойдёт медик (случайный из лежащих) */
  function pickPatient() {
    let r = null, n = 0;
    for (let i = 0; i < people.length; i++) {
      const q = people[i];
      if (q.role === 'rest' && q.cot && !q.path.length && near(q, q.cot) && Math.random() * ++n < 1) r = q;
    }
    return r;
  }
  /* житель 3D-моделью: ходит, сидит у костра, куёт, лечит, копается в грядке, оглядывается */
  const SPR_K = 0.72;
  function person3d(g, p, x, y, t, k) {
    const S3 = DW.S3;
    if (!S3 || !p.s3) return false;
    const Sx = p.sets || (p.sets = S3.setsFor(p.s3));
    if (!Sx || !S3.ready(Sx.body)) return false;
    const d = S3.dir8(p.face === undefined ? (p.dir > 0 ? Math.PI / 4 * 7 : Math.PI / 4 * 3) : p.face);
    const b = Sx.body;
    let anim = 'idle', i = 0, gun = !p.noGun;
    const act = p.path.length ? 'walk' : p.act;
    if (act === 'walk') { anim = 'walk'; i = Math.floor(t / (p.speed < 0.7 ? 110 : 85) + p.seed * 3) % S3.count(b, 'walk'); }
    else if (act === 'sit') anim = 'hunker';
    else if (act === 'work') { anim = 'melee'; i = Math.floor(t / 260) % S3.count(b, 'melee'); gun = false; }
    else if (act === 'heal' || act === 'farm') { anim = 'heal'; i = Math.floor(t / 450 + p.seed) % Math.max(1, S3.count(b, 'heal')); gun = false; }
    else if (act === 'scan' && S3.avail(b, 'idle2')) { anim = 'idle2'; i = Math.floor(t / 420 + p.seed) % S3.count(b, 'idle2'); }
    else i = Math.floor(t / 520 + p.seed) % Math.max(1, S3.count(b, 'idle'));
    if (!S3.count(b, anim)) { anim = 'idle'; i = 0; }
    p.ai = anim === 'melee' ? i : -1;
    // слои кадра переиспользуются — без новых массивов в каждом кадре
    if (!p.L1) { p.L0 = [b, anim, i, d]; p.L1 = [p.L0]; p.L2 = [p.L0, [Sx.weapon, anim, i, d]]; }
    p.L0[1] = anim; p.L0[2] = i; p.L0[3] = d;
    let L = p.L1;
    if (gun && Sx.weapon && S3.ready(Sx.weapon)) { L = p.L2; const w = L[1]; w[1] = anim; w[2] = i; w[3] = d; }
    const f = S3.frame(L);
    if (!f) return false;
    k = k || SPR_K;
    g.drawImage(f.c, x - f.ox * k, y - f.oy * k, f.w * k, f.h * k);
    return true;
  }
  function drawPerson(g, p, t) {
    const x = PX(p.u, p.v), y = PY(p.u, p.v, p.h);
    g.fillStyle = 'rgba(0,0,0,0.3)'; ART.ell(g, x, y, 9, 4);
    const ok = person3d(g, p, x, y, t);
    if (!ok) {
      const sit = !p.path.length && p.act === 'sit';
      const busy = !p.path.length && (p.act === 'work' || p.act === 'heal' || p.act === 'farm');
      g.save(); g.translate(x, y);
      ART.human(g, { look: p.look, body: p.body, weapon: p.noGun ? null : p.weapon, dir: p.dir, aim: sit ? 0.6 : 0.35, walk: p.path.length ? t / 95 + p.seed : null, scale: 0.92, seed: p.seed, cig: p.cig, noShadow: true, pose: sit ? { crouch: 1, low: 0.7 } : (busy ? { low: Math.abs(Math.sin(t / 300)) * 0.8 } : null) }, t);
      g.restore();
    }
    // кузнец: искры на ударе молота
    if (p.role === 'smith' && !p.path.length && p.act === 'work') {
      const hit = ok ? (p.ai === 2 && p.prevI !== 2) : every('anvil2d', 1.3);
      p.prevI = p.ai;
      if (hit) sparks(SPOT.anvil[0], SPOT.anvil[1], 9, 7);
    }
    // садовник поливает грядку
    if (p.role === 'farmer' && !p.path.length && p.act === 'farm' && p.water && every('water', 9)) {
      const du = p.bi === 2 ? 0 : -0.3, dv = p.bi === 2 ? -0.3 : 0;
      spawn(PK.DROP, p.u + du + (Math.random() - 0.5) * 0.1, p.v + dv + (Math.random() - 0.5) * 0.1, 14, du * 0.4, dv * 0.4, 4, 520, 1, 0, 0.9, 70);
    }
  }
  /* часовой на вышке: виден по пояс из-за ограждения площадки */
  function drawSentry(g, p, t) {
    const T = towerG;
    if (!T.ok) return;
    g.save();
    g.beginPath(); g.rect(T.fx - 30, T.fy - 70, 60, 70 + T.rail - T.fy); g.clip();
    if (!person3d(g, p, T.fx, T.fy, t, 0.6)) {
      g.translate(T.fx, T.fy);
      ART.human(g, { look: p.look, body: p.body, weapon: p.weapon, dir: p.dir, aim: 0.35, scale: 0.7, seed: p.seed, noShadow: true }, t);
    }
    g.restore();
  }

  /* ---------- Плита-диорама с землёй ---------- */
  function buildPlate() {
    const st = DW.G.state;
    const key = st.baseNode + '|' + JSON.stringify(st.buildings);
    if (plate && plateKey === key) return;
    // постройки изменились — заново распределить дела
    if (plateKey && plateKey !== key && plateKey.split('|')[0] === String(st.baseNode)) { assignRoles(false); initCrows(); }
    plateKey = key;
    const T = N * 64;
    const top = ART.canvas(T, T), tg = top.getContext('2d');
    tg.fillStyle = '#6a5640'; tg.fillRect(0, 0, T, T);
    const r = U.srng(st.baseNode * 31 + 7);
    // утоптанные тропы
    tg.strokeStyle = 'rgba(150,128,96,0.55)'; tg.lineCap = 'round';
    const path = function (pts, w) { tg.lineWidth = w; tg.beginPath(); pts.forEach(function (p, i) { if (i) tg.lineTo(p[0] * 64, p[1] * 64); else tg.moveTo(p[0] * 64, p[1] * 64); }); tg.stroke(); };
    path([[9.9, 5.1], [7.2, 5.2], [6.4, 5.4]], 46);
    path(RING.concat([RING[0]]), 34);
    path([[5.2, 6.4], [5.2, 7.6]], 30);
    try { const pat = tg.createPattern(DW.TR.matTex('grain'), 'repeat'); tg.globalCompositeOperation = 'overlay'; tg.fillStyle = pat; tg.fillRect(0, 0, T, T); tg.globalCompositeOperation = 'source-over'; } catch (e) { /* ignore */ }
    for (let i = 0; i < 60; i++) {
      const x = r() * T, y = r() * T, R = 2 + r() * 4;
      tg.fillStyle = 'rgba(0,0,0,0.3)'; tg.beginPath(); tg.ellipse(x + R * 0.5, y + R * 0.2, R, R * 0.7, 0, 0, 7); tg.fill();
      tg.fillStyle = ['#8a8076', '#766e64', '#9a8a74'][i % 3]; tg.beginPath(); tg.ellipse(x, y, R, R * 0.75, r() * 3, 0, 7); tg.fill();
    }
    tg.strokeStyle = 'rgba(150,130,70,0.6)'; tg.lineWidth = 1.4;
    for (let i = 0; i < 70; i++) { const x = r() * T, y = r() * T; for (let k = 0; k < 4; k++) { tg.beginPath(); tg.moveTo(x + k * 2, y); tg.lineTo(x + k * 2 + (r() - 0.5) * 4, y - 5 - r() * 6); tg.stroke(); } }
    // кострище: выжженная земля и зола
    const fg = tg.createRadialGradient(FIRE[0] * 64, FIRE[1] * 64, 4, FIRE[0] * 64, FIRE[1] * 64, 46);
    fg.addColorStop(0, 'rgba(30,22,16,0.55)'); fg.addColorStop(1, 'rgba(30,22,16,0)');
    tg.fillStyle = fg; tg.fillRect(FIRE[0] * 64 - 46, FIRE[1] * 64 - 46, 92, 92);
    // затенение под постройками
    tg.fillStyle = 'rgba(0,0,0,0.25)';
    Object.keys(SLOT).forEach(function (k) {
      if (k === 'walls' || (k !== 'hq' && !DW.G.blv(k))) return;
      const s = SLOT[k]; tg.fillRect((s.u - 0.12) * 64, (s.v - 0.12) * 64, (s.w + 0.4) * 64, (s.d + 0.3) * 64);
    });
    const Wd = 2 * N * HW, Hd = 2 * N * HH;
    plate = ART.canvas(Wd * GS, (Hd + EDGE + 4) * GS);
    const g = plate.getContext('2d');
    g.setTransform(HW * GS / 64, HH * GS / 64, -HW * GS / 64, HH * GS / 64, N * HW * GS, 0);
    g.drawImage(top, 0, 0);
    g.setTransform(GS, 0, 0, GS, N * HW * GS, 0);
    const a = P(0, N), b = P(N, N), c = P(N, 0);
    const rr = U.srng(77);
    if (DW.TR.rockFace) { DW.TR.rockFace(g, a, b, EDGE, rr, 1, true); DW.TR.rockFace(g, b, c, EDGE, rr, 0.62, true); }
    g.strokeStyle = 'rgba(255,230,190,0.3)'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.stroke();
  }

  /* ---------- Частицы: постоянный пул, без выделения памяти в кадре ---------- */
  const PMAX = 120;
  const PK = { SMOKE: 0, DUST: 1, SPARK: 2, EMBER: 3, DROP: 4 };
  const pool = [];
  for (let i = 0; i < PMAX; i++) pool.push({ on: false, k: 0, u: 0, v: 0, h: 0, vu: 0, vv: 0, vh: 0, t0: 0, life: 1, s: 1, gr: 0, a: 1, grav: 0 });
  let pLive = 0, pNext = 0, nowT = 0;
  function clearParts() { for (let i = 0; i < PMAX; i++) pool[i].on = false; pLive = 0; }
  function spawn(k, u, v, h, vu, vv, vh, life, s, gr, a, grav) {
    if (pLive >= capNow) return null;
    for (let n = 0; n < PMAX; n++) {
      const p = pool[pNext]; pNext = (pNext + 1) % PMAX;
      if (p.on) continue;
      p.on = true; p.k = k; p.u = u; p.v = v; p.h = h; p.vu = vu; p.vv = vv; p.vh = vh;
      p.t0 = nowT; p.life = life; p.s = s; p.gr = gr; p.a = a; p.grav = grav || 0;
      pLive++;
      return p;
    }
    return null;
  }
  /* частица в экранной точке (x, y) над точкой привязки с глубиной uv = u + v */
  function spawnXY(k, x, y, uv, vu, vv, vh, life, s, gr, a) {
    const d = x / HW;
    return spawn(k, (uv + d) / 2, (uv - d) / 2, uv * HH - y, vu, vv, vh, life, s, gr, a, 0);
  }
  /* ровный поток частиц: rate штук в секунду, независимо от частоты кадров */
  const acc = { fire: 0, ember: 0, hq: 0, inf: 0, ws: 0, ws2d: 0, anvil2d: 0, dust: 0, water: 0 };
  function every(key, rate) {
    acc[key] += frameDt * rate * qMul;
    if (acc[key] < 1) return false;
    acc[key] = acc[key] > 2 ? 0 : acc[key] - 1;
    return true;
  }
  function smokeAt(u, v, h, a) { spawn(PK.SMOKE, u, v, h, 0.07 + Math.random() * 0.05, -0.03 + Math.random() * 0.02, 13 + Math.random() * 5, 3000 + Math.random() * 900, 2.4, 8, a || 0.32, 0); }
  function smokeXY(x, y, uv, a) { spawnXY(PK.SMOKE, x, y, uv, 0.07 + Math.random() * 0.05, -0.03 + Math.random() * 0.02, 13 + Math.random() * 5, 3000 + Math.random() * 900, 2, 7, a || 0.3); }
  function sparks(u, v, h, n) {
    n = Math.max(2, Math.round(n * qMul));
    for (let k = 0; k < n; k++) spawn(PK.SPARK, u, v, h, (Math.random() - 0.5) * 1.3, (Math.random() - 0.5) * 1.3, 30 + Math.random() * 35, 380 + Math.random() * 260, 1.4, 0, 1, 140);
  }
  const SMOKE_C = '150,140,130', DUST_C = '180,160,130';
  function drawParts(g, t, glowPass) {
    for (let i = 0; i < PMAX; i++) {
      const p = pool[i];
      if (!p.on) continue;
      const age = t - p.t0;
      if (age >= p.life || age < 0) { p.on = false; pLive--; continue; }
      const glow = p.k === PK.SPARK || p.k === PK.EMBER;
      if (glow !== glowPass) continue;
      const k = age / p.life, s = age / 1000;
      const u = p.u + p.vu * s, v = p.v + p.vv * s, h = p.h + p.vh * s - p.grav * s * s * 0.5;
      const x = (u - v) * HW, y = (u + v) * HH - h;
      if (p.k === PK.SMOKE || p.k === PK.DUST) {
        // мягкий клуб: быстро проявляется, растёт, тает
        const r = p.s + p.gr * k;
        g.globalAlpha = p.a * Math.min(1, k * 5) * (1 - k);
        g.drawImage(puffSpr(p.k === PK.SMOKE ? SMOKE_C : DUST_C), x - r + Math.sin(age / 500 + i) * k * 3, y - r, r * 2, r * 2);
      } else if (p.k === PK.DROP) {
        g.globalAlpha = p.a * (1 - k); g.fillStyle = '#9fd0ff'; g.fillRect(x - 0.5, y - 1, 1, 2);
      } else {
        // искры и угольки мерцают
        g.globalAlpha = (1 - k) * (p.k === PK.EMBER ? 0.6 + 0.4 * Math.sin(age / 40 + i) : 1);
        g.fillStyle = p.k === PK.EMBER ? '#ff9a3a' : '#ffd070';
        g.fillRect(x - p.s / 2, y - p.s / 2, p.s, p.s);
      }
    }
    g.globalAlpha = 1;
  }

  /* ---------- Готовые спрайты света и дыма (рисуются один раз) ---------- */
  const GLOW = {}, PUFF = {};
  function glowSpr(col) {
    let c = GLOW[col];
    if (c) return c;
    c = ART.canvas(64, 64); const x = c.getContext('2d');
    const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(' + col + ',1)'); gr.addColorStop(0.28, 'rgba(' + col + ',0.5)'); gr.addColorStop(0.6, 'rgba(' + col + ',0.16)'); gr.addColorStop(1, 'rgba(' + col + ',0)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    GLOW[col] = c; return c;
  }
  function puffSpr(col) {
    let c = PUFF[col];
    if (c) return c;
    c = ART.canvas(32, 32); const x = c.getContext('2d');
    const gr = x.createRadialGradient(13, 13, 1, 16, 16, 16);
    gr.addColorStop(0, 'rgba(' + col + ',0.95)'); gr.addColorStop(0.55, 'rgba(' + col + ',0.5)'); gr.addColorStop(1, 'rgba(' + col + ',0)');
    x.fillStyle = gr; x.fillRect(0, 0, 32, 32);
    PUFF[col] = c; return c;
  }
  /* луч прожектора: клин, светлеет к источнику, мягкие края */
  let coneC = null, pillarC = null;
  function coneSpr() {
    if (coneC) return coneC;
    const W = 256, H = 96, c = ART.canvas(W, H), x = c.getContext('2d');
    const gl = x.createLinearGradient(0, 0, W, 0);
    gl.addColorStop(0, 'rgba(255,250,225,1)'); gl.addColorStop(0.55, 'rgba(255,250,225,0.5)'); gl.addColorStop(1, 'rgba(255,250,225,0.18)');
    x.fillStyle = gl; x.beginPath(); x.moveTo(0, H / 2 - 3); x.lineTo(W, 2); x.lineTo(W, H - 2); x.lineTo(0, H / 2 + 3); x.closePath(); x.fill();
    x.globalCompositeOperation = 'destination-in';
    const gv = x.createLinearGradient(0, 0, 0, H);
    gv.addColorStop(0, 'rgba(0,0,0,0)'); gv.addColorStop(0.5, 'rgba(0,0,0,1)'); gv.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gv; x.fillRect(0, 0, W, H);
    coneC = c; return c;
  }
  /* столб света над грузом Института */
  function pillarSpr() {
    if (pillarC) return pillarC;
    const c = ART.canvas(12, 128), x = c.getContext('2d');
    const gv = x.createLinearGradient(0, 0, 0, 128);
    gv.addColorStop(0, 'rgba(120,220,255,0)'); gv.addColorStop(1, 'rgba(120,220,255,0.9)');
    x.fillStyle = gv; x.fillRect(0, 0, 12, 128);
    x.globalCompositeOperation = 'destination-in';
    const gh = x.createLinearGradient(0, 0, 12, 0);
    gh.addColorStop(0, 'rgba(0,0,0,0)'); gh.addColorStop(0.5, 'rgba(0,0,0,1)'); gh.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gh; x.fillRect(0, 0, 12, 128);
    pillarC = c; return c;
  }
  /* свечение: r — радиус, sq — сплющивание (0.5 — пятно на земле) */
  function glowAt(g, x, y, r, sq, col, a) {
    if (a <= 0.004) return;
    g.globalAlpha = a > 1 ? 1 : a;
    g.drawImage(glowSpr(col), x - r, y - r * sq, r * 2, r * 2 * sq);
  }
  /* живое мерцание окна; изредка кто-то проходит мимо и заслоняет свет */
  function flick(s, t) {
    const n = Math.sin(t * 0.0023 + s * 1.7) * 0.5 + Math.sin(t * 0.0061 + s * 4.3) * 0.3 + Math.sin(t * 0.017 + s * 2.1) * 0.2;
    const pass = Math.sin(t * 0.00041 + s * 5.9) > 0.94 ? 0.35 : 1;
    return (0.8 + n * 0.2) * pass;
  }
  function fireFl(t) { return 0.86 + Math.sin(t / 90) * 0.07 + Math.sin(t / 37 + 1.3) * 0.05 + Math.sin(t / 211) * 0.04; }
  /* окно-параллелограмм на грани (наклон s: +0.5 — грань влево-вниз, −0.5 — вправо-вниз) */
  function winQuad(g, x, y, w, h, s) {
    const e = w * s / 2;
    g.beginPath(); g.moveTo(x - w / 2, y - h / 2 - e); g.lineTo(x + w / 2, y - h / 2 + e); g.lineTo(x + w / 2, y + h / 2 + e); g.lineTo(x - w / 2, y + h / 2 - e); g.closePath(); g.fill();
  }

  /* ---------- Постройки ---------- */
  const box = function (g, u0, v0, u1, v1, h0, h1, c) { ART.box(g, u0, v0, u1, v1, h0, h1, c[0], c[1], c[2], O); };
  function faceL(g, u0, v1, h0) { ART.faceL(g, u0, v1, h0, O); }
  function faceR(g, u1, v0, h0) { ART.faceR(g, u1, v0, h0, O); }
  let nightK = 0;
  function windowLit(g, x, y, w, h) {
    g.fillStyle = '#1a1612'; g.fillRect(x, y, w, h);
    if (nightK > 0.05) { g.fillStyle = 'rgba(255,196,110,' + ((0.25 + nightK * 0.75) * flick(x * 3.1 + y * 1.7 + w, nowT)).toFixed(3) + ')'; g.fillRect(x + 0.02, y + 0.6, w - 0.04, h - 1.2); }
    else { g.fillStyle = 'rgba(150,180,200,0.25)'; g.fillRect(x + 0.02, y + h * 0.5, w * 0.5, h * 0.4); }
  }
  function drawHQ(g, t) {
    const s = SLOT.hq, u0 = s.u, v0 = s.v, u1 = s.u + s.w, v1 = s.v + s.d;
    const nb = countBuilt();
    const col = nb >= 4 ? ['#9a948a', '#7e786e', '#625e56'] : ['#8a6a46', '#6a4c2e', '#563c22'];
    box(g, u0, v0, u1, v1, 0, 34, col);
    g.save(); faceL(g, u0, v1, 0);
    g.fillStyle = '#2a1e14'; g.fillRect(0.9, 0, 0.42, 20); g.fillStyle = '#c9a14a'; g.fillRect(1.24, 9, 0.04, 2);
    windowLit(g, 0.2, 14, 0.45, 9); windowLit(g, 1.55, 14, 0.45, 9);
    g.fillStyle = 'rgba(0,0,0,0.18)'; for (let k = 0; k < 6; k++) g.fillRect(k * 0.4, 0, 0.02, 34);
    g.restore();
    g.save(); faceR(g, u1, v0, 0); windowLit(g, 0.3, 14, 0.45, 9); windowLit(g, 1.2, 14, 0.45, 9); g.restore();
    // мешки на крыше и антенна
    for (let k = 0; k < 5; k++) { const p = P(u0 + 0.2 + k * 0.42, v1 - 0.12, 36); g.fillStyle = '#a08b62'; ART.ell(g, p[0], p[1], 7, 3.6); g.fillStyle = 'rgba(255,240,210,0.25)'; ART.ell(g, p[0] - 1, p[1] - 1, 4, 1.6); }
    if (nb >= 4) {
      box(g, u0 + 0.3, v0 + 0.25, u1 - 0.6, v1 - 0.8, 34, 56, col);
      g.save(); faceL(g, u0 + 0.3, v1 - 0.8, 34); windowLit(g, 0.3, 8, 0.4, 8); windowLit(g, 0.9, 8, 0.4, 8); g.restore();
    }
    const ap = P(u0 + 0.5, v0 + 0.4, nb >= 4 ? 56 : 34);
    ART.line(g, ap[0], ap[1], ap[0], ap[1] - 30, 1.4, '#55606a');
    for (let k = 0; k < 3; k++) ART.line(g, ap[0] - 4 + k, ap[1] - 22 + k * 5, ap[0] + 4 - k, ap[1] - 22 + k * 5, 0.8, '#55606a');
    if (Math.sin(t / 400) > 0) { g.fillStyle = '#ff5a3a'; ART.circ(g, ap[0], ap[1] - 31, 1.6); }
    // печная труба: дымок из буржуйки
    const pu = u1 - 0.45, pv = v0 + 0.5, ph = nb >= 4 ? 34 : 34;
    box(g, pu, pv, pu + 0.14, pv + 0.14, ph, ph + 12, C_PIPE);
    if (every('hq', 1.6 + nightK)) smokeAt(pu + 0.07, pv + 0.07, ph + 13, 0.3);
    // флаг
    const fp = P(u1 - 0.2, v1 - 0.2, nb >= 4 ? 34 : 34);
    ART.line(g, fp[0], fp[1], fp[0], fp[1] - 42, 1.6, '#3a2a1a');
    g.fillStyle = '#e3a33b';
    g.beginPath(); g.moveTo(fp[0], fp[1] - 42);
    for (let i = 0; i <= 6; i++) g.lineTo(fp[0] + i * 3.2, fp[1] - 42 + Math.sin(t / 170 + i * 0.9) * 1.5);
    for (let i = 6; i >= 0; i--) g.lineTo(fp[0] + i * 3.2, fp[1] - 32 + Math.sin(t / 170 + i * 0.9) * 1.5);
    g.closePath(); g.fill();
  }
  function drawTower(g, t, st) {
    const s = SLOT.tower, cu = s.u + s.w / 2, cv = s.v + s.d / 2, H = 62;
    const legs = [[s.u, s.v], [s.u + s.w, s.v], [s.u + s.w, s.v + s.d], [s.u, s.v + s.d]];
    legs.forEach(function (l) { const a = P(l[0], l[1], 0), b = P(cu + (l[0] - cu) * 0.7, cv + (l[1] - cv) * 0.7, H); ART.line(g, a[0], a[1], b[0], b[1], 3, '#5a3e22'); ART.line(g, a[0] - 0.8, a[1], b[0] - 0.8, b[1], 1, 'rgba(255,220,180,0.25)'); });
    for (let k = 1; k < 4; k++) { const h = H * k / 4; const pa = P(s.u + 0.1, s.v + s.d - 0.1, h - 8), pb = P(s.u + s.w - 0.1, s.v + s.d - 0.1, h); ART.line(g, pa[0], pa[1], pb[0], pb[1], 1.4, '#4a321a'); }
    box(g, s.u - 0.1, s.v - 0.1, s.u + s.w + 0.1, s.v + s.d + 0.1, H, H + 5, ['#8a6a46', '#6a4c2e', '#563c22']);
    box(g, s.u - 0.1, s.v + s.d, s.u + s.w + 0.1, s.v + s.d + 0.1, H + 5, H + 13, ['#7a5a38', '#5e4424', '#4a3418']);
    const rt = P(cu, cv, H + 30), c1 = P(s.u - 0.2, s.v + s.d + 0.2, H + 18), c2 = P(s.u + s.w + 0.2, s.v + s.d + 0.2, H + 18), c3 = P(s.u + s.w + 0.2, s.v - 0.2, H + 18);
    ART.poly(g, [c1, c2, rt], '#7a3a26'); ART.poly(g, [c2, c3, rt], '#5a2a1a');
    [c1, c2, c3].forEach(function (c) { const b = [c[0], c[1] + 13]; ART.line(g, c[0], c[1], b[0], b[1], 1.2, '#4a321a'); });
    // тревога
    if (st.raid && Math.sin(t / 160) > 0) { const p = P(cu, cv, H + 31); g.fillStyle = '#ff3a2a'; ART.circ(g, p[0], p[1], 2.6); }
    // площадка часового и прожектор (для 2D-вышки)
    towerG.ok = true; towerG.fx = PX(cu, cv); towerG.fy = PY(cu, cv, H + 5); towerG.rail = PY(cu, s.v + s.d + 0.1, H + 13) - 2;
    towerG.lx = PX(s.u + s.w, s.v + s.d); towerG.ly = PY(s.u + s.w, s.v + s.d, H + 16);
  }
  function drawInfirmary(g, t) {
    const s = SLOT.infirmary, u0 = s.u, v0 = s.v, u1 = s.u + s.w, v1 = s.v + s.d, H = 30, vm = (v0 + v1) / 2;
    const a = P(u0, v1, 0), b = P(u1, v1, 0), c = P(u1, v0, 0), rA = P(u0, vm, H), rB = P(u1, vm, H);
    ART.poly(g, [a, b, rB, rA], '#d8d0bc');
    ART.poly(g, [b, c, rB], '#b0a890');
    g.strokeStyle = 'rgba(0,0,0,0.15)'; g.lineWidth = 0.8;
    for (let k = 1; k < 5; k++) { const p0 = P(u0 + (u1 - u0) * k / 5, v1, 0), p1 = P(u0 + (u1 - u0) * k / 5, vm, H); g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.stroke(); }
    ART.line(g, rA[0], rA[1], rB[0], rB[1], 1.6, '#8a8270');
    const cx = P(u1 - 0.02, (vm + v1) / 2 - 0.1, H * 0.42);
    g.fillStyle = '#c0302a'; g.fillRect(cx[0] - 2, cx[1] - 6, 4, 12); g.fillRect(cx[0] - 6, cx[1] - 2, 12, 4);
    if (nightK > 0.1) { const p = P(u1, (vm + v1) / 2, 6); g.fillStyle = 'rgba(255,220,150,' + (nightK * 0.8 * flick(7, t)).toFixed(3) + ')'; ART.poly(g, [[p[0] - 4, p[1]], [p[0] + 4, p[1] - 2], [p[0] + 4, p[1] - 12], [p[0] - 4, p[1] - 10]]); }
    // труба печки над палаткой
    const pp = P(u0 + 0.5, vm, H * 0.75);
    g.fillStyle = '#3a3632'; g.fillRect(pp[0] - 1.6, pp[1] - 14, 3.2, 14);
    if (every('inf', 1.2 + nightK)) smokeXY(pp[0], pp[1] - 15, u0 + 0.5 + vm, 0.26);
  }
  function drawWorkshop(g, t) {
    const s = SLOT.workshop, u0 = s.u, v0 = s.v, u1 = s.u + s.w, v1 = s.v + s.d;
    box(g, u0, v0, u1, v1, 0, 24, ['#6a5a48', '#7a5a3a', '#5a4028']);
    g.save(); faceL(g, u0, v1, 0); g.fillStyle = 'rgba(0,0,0,0.25)'; for (let k = 0; k < 10; k++) g.fillRect(k * 0.19, 0, 0.02, 24);
    g.fillStyle = '#1e1610'; g.fillRect(0.5, 0, 0.8, 16); g.fillStyle = 'rgba(255,150,60,' + (0.3 + Math.sin(t / 90) * 0.15).toFixed(3) + ')'; g.fillRect(0.55, 1, 0.7, 12); g.restore();
    // наклонная крыша из профлиста
    const a = P(u0 - 0.1, v1 + 0.1, 24), b = P(u1 + 0.1, v1 + 0.1, 24), c = P(u1 + 0.1, v0 - 0.1, 32), d = P(u0 - 0.1, v0 - 0.1, 32);
    ART.poly(g, [a, b, c, d], '#7a8288');
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 0.7;
    for (let k = 1; k < 9; k++) { const p0 = P(u0 + (u1 - u0) * k / 9, v1 + 0.1, 24), p1 = P(u0 + (u1 - u0) * k / 9, v0 - 0.1, 32); g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.stroke(); }
    g.fillStyle = 'rgba(150,70,30,0.35)'; ART.ell(g, (a[0] + c[0]) / 2, (a[1] + c[1]) / 2, 10, 4);
    box(g, u0 + 0.25, v0 + 0.25, u0 + 0.55, v0 + 0.55, 26, 46, ['#5a4a40', '#4a3a30', '#3a2a20']);
    if (every('ws2d', 2.2)) smokeAt(u0 + 0.4, v0 + 0.4, 48, 0.35);
  }
  function drawFarm(g, t) {
    const s = SLOT.farm, u0 = s.u, v0 = s.v, u1 = s.u + s.w, v1 = s.v + s.d, H = 22;
    // растения внутри
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
      const p = P(u0 + 0.3 + i * 0.45, v0 + 0.35 + j * 0.55, 0);
      g.fillStyle = '#3a5a2a'; ART.ell(g, p[0], p[1] - 3, 6, 4);
      g.fillStyle = '#6aa04a'; ART.ell(g, p[0] - 1, p[1] - 5, 4, 3);
    }
    // стеклянный короб
    g.fillStyle = 'rgba(170,220,200,0.22)';
    ART.poly(g, [P(u0, v1, 0), P(u1, v1, 0), P(u1, v1, H), P(u0, v1, H)]);
    ART.poly(g, [P(u1, v0, 0), P(u1, v1, 0), P(u1, v1, H), P(u1, v0, H)]);
    g.fillStyle = 'rgba(200,240,225,0.18)';
    ART.poly(g, [P(u0, v0, H), P(u1, v0, H), P(u1, v1, H), P(u0, v1, H)]);
    g.strokeStyle = '#4a5a50'; g.lineWidth = 1;
    for (let k = 0; k <= 4; k++) { const a = P(u0 + (u1 - u0) * k / 4, v1, 0), b = P(u0 + (u1 - u0) * k / 4, v1, H), c = P(u0 + (u1 - u0) * k / 4, v0, H); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.stroke(); }
    for (let k = 0; k <= 3; k++) { const a = P(u1, v0 + (v1 - v0) * k / 3, 0), b = P(u1, v0 + (v1 - v0) * k / 3, H), c = P(u0, v0 + (v1 - v0) * k / 3, H); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.stroke(); }
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 0.8;
    const gl = P(u0 + 0.3, v1, H * 0.8), gl2 = P(u0 + 0.8, v1, H * 0.3); g.beginPath(); g.moveTo(gl[0], gl[1]); g.lineTo(gl2[0], gl2[1]); g.stroke();
  }
  function drawBeacon(g, t) {
    const s = SLOT.beacon, cu = s.u + s.w / 2, cv = s.v + s.d / 2;
    box(g, s.u, s.v, s.u + s.w, s.v + s.d, 0, 6, ['#5a646b', '#454f56', '#363e44']);
    const a = P(cu, cv, 6), b = P(cu, cv, 54);
    ART.line(g, a[0] - 3, a[1], b[0], b[1], 1.4, '#55606a'); ART.line(g, a[0] + 3, a[1], b[0], b[1], 1.4, '#55606a');
    for (let k = 1; k < 6; k++) { const y = a[1] + (b[1] - a[1]) * k / 6, w = 3 * (1 - k / 6); ART.line(g, a[0] - w, y, a[0] + w, y + 3, 0.7, '#55606a'); }
    g.fillStyle = '#8a969e'; g.beginPath(); g.ellipse(b[0] + 4, b[1] + 6, 6, 3, -0.5, 0, 7); g.fill();
    const gl = 0.5 + Math.sin(t / (cargoPend ? 110 : 300)) * 0.4;
    g.fillStyle = 'rgba(111,216,255,' + gl.toFixed(3) + ')'; ART.circ(g, b[0], b[1], 2.4);
    g.strokeStyle = 'rgba(111,216,255,' + (gl * 0.5).toFixed(3) + ')'; g.lineWidth = 1;
    const k2 = (t / 1200) % 1; g.beginPath(); g.ellipse(a[0], a[1] + 2, 8 + k2 * 18, 4 + k2 * 9, 0, 0, 7); g.stroke();
  }
  function drawTurret(g, t, s) {
    const cu = s.u + s.w / 2, cv = s.v + s.d / 2;
    const S3 = DW.S3;
    if (S3 && S3.has('p_turret')) {
      S3.load('p_turret');
      // турель медленно поворачивается, осматривая подступы
      const f = S3.ready('p_turret') ? S3.frame([['p_turret', 'v', Math.floor(t / 1800 + s.u * 3) % 8, 0]]) : null;
      if (f) { const c = P(cu, cv, 0); g.drawImage(f.c, c[0] - f.ox, c[1] - f.oy, f.w, f.h); return; }
    }
    box(g, s.u, s.v, s.u + s.w, s.v + s.d, 0, 10, ['#5e6c74', '#46525a', '#38424a']);
    const p = P(cu, cv, 14), a = Math.sin(t / 2200 + s.u) * 0.9 + 0.3;
    g.fillStyle = '#3a4248'; ART.ell(g, p[0], p[1], 7, 4);
    ART.line(g, p[0], p[1] - 1, p[0] + Math.cos(a) * 16, p[1] - 1 + Math.sin(a) * 6, 3, '#2a3036');
    g.fillStyle = '#ff5a3a'; ART.circ(g, p[0], p[1] - 4, 1.2);
  }
  /* фонари на каменной стене — их ореолы рисуются ночью поверх затемнения */
  const lampXY = new Float32Array(96);
  let lampN = 0, palGr = null;
  function drawWalls(g, t, lv, front) {
    const lo = 0.25, hi = N - 0.25;
    const segs = front ? WSEG_F : WSEG_B;
    // общий градиент кольев частокола (в своих координатах, переиспользуется)
    if (lv < 2 && !palGr) { palGr = g.createLinearGradient(-3, 0, 3, 0); palGr.addColorStop(0, '#a07c52'); palGr.addColorStop(1, '#4e341c'); }
    for (let si = 0; si < segs.length; si++) {
      const sg = segs[si];
      const len = Math.hypot(sg[2] - sg[0], sg[3] - sg[1]);
      const n = Math.round(len / (lv >= 2 ? 0.5 : 0.24));
      for (let i = 0; i < n; i++) {
        const k0 = i / n, k1 = (i + 1) / n;
        const u0 = U.lerp(sg[0], sg[2], k0), v0 = U.lerp(sg[1], sg[3], k0), u1 = U.lerp(sg[0], sg[2], k1), v1 = U.lerp(sg[1], sg[3], k1);
        const um = (u0 + u1) / 2, vm = (v0 + v1) / 2;
        // ворота
        if (front && sg[4] === 'R' && vm > 4.4 && vm < 5.8) continue;
        if (lv >= 2) {
          const h = 18 + (i % 2 ? 4 : 0);
          box(g, Math.min(u0, u1) - (sg[4] === 'R' ? 0.12 : 0), Math.min(v0, v1) - (sg[4] === 'L' ? 0.12 : 0), Math.max(u0, u1) + (sg[4] === 'R' ? 0.12 : 0), Math.max(v0, v1) + (sg[4] === 'L' ? 0.12 : 0), 0, h, ['#9c968a', '#807a70', '#646058']);
          if (nightK > 0.2 && i % 6 === 3) {
            const x = PX(um, vm), y = PY(um, vm, h + 2);
            g.fillStyle = 'rgba(255,190,90,' + nightK.toFixed(3) + ')'; ART.circ(g, x, y, 1.8);
            if (lampN < 48) { lampXY[lampN * 2] = x; lampXY[lampN * 2 + 1] = y; lampN++; }
          }
        } else {
          const x = PX(um, vm), y = PY(um, vm, 0), h = 20 + ((i * 7) % 5);
          g.fillStyle = palGr;
          g.translate(x, 0);
          g.beginPath(); g.moveTo(-3, y); g.lineTo(-3, y - h); g.lineTo(0, y - h - 5); g.lineTo(3, y - h); g.lineTo(3, y); g.closePath(); g.fill();
          g.translate(-x, 0);
        }
      }
    }
    if (front && base3d(g, 'gate', hi, 5.1)) { gate3d = true; return; }
    if (front) {
      gate3d = false;
      const a = P(hi, 4.4, 0), b = P(hi, 5.8, 0);
      ART.line(g, a[0], a[1], a[0], a[1] - 32, 3, '#4a321a'); ART.line(g, b[0], b[1], b[0], b[1] - 32, 3, '#4a321a');
      ART.line(g, a[0], a[1] - 30, b[0], b[1] - 30, 2.4, '#5a3e22');
    }
    void lo;
  }
  const WSEG_B = [[0.25, 0.25, N - 0.25, 0.25, 'L'], [0.25, 0.25, 0.25, N - 0.25, 'R']];
  const WSEG_F = [[0.25, N - 0.25, N - 0.25, N - 0.25, 'L'], [N - 0.25, 0.25, N - 0.25, N - 0.25, 'R']];
  let gate3d = false;
  function drawSlot(g, k, t) {
    const s = SLOT[k];
    const a = P(s.u, s.v, 0), b = P(s.u + s.w, s.v, 0), c = P(s.u + s.w, s.v + s.d, 0), d = P(s.u, s.v + s.d, 0);
    g.setLineDash([4, 4]); g.lineDashOffset = -t / 80;
    g.strokeStyle = sel === k ? 'rgba(255,220,140,0.9)' : 'rgba(255,230,180,0.35)'; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.lineTo(d[0], d[1]); g.closePath(); g.stroke();
    g.setLineDash([]);
    [a, b, c, d].forEach(function (p) { ART.line(g, p[0], p[1], p[0], p[1] - 7, 1.6, '#6a4c2e'); });
    const m = P(s.u + s.w / 2, s.v + s.d / 2, 0);
    ART.line(g, m[0], m[1], m[0], m[1] - 18, 1.4, '#5a4a3a');
    g.fillStyle = '#7a5a38'; g.fillRect(m[0] - 7, m[1] - 26, 14, 9);
    g.fillStyle = '#ffd08a'; g.font = 'bold 9px sans-serif'; g.textAlign = 'center'; g.fillText('+', m[0], m[1] - 18.5);
  }
  /* 3D-постройки (модели Tripo, набор p_base): номер варианта по постройке */
  const BLD3D = { hq: 0, tower: 1, infirmary: 2, workshop: 3, farm: 4, beacon: 5, gate: 6, fire: 7, tank: 8, store: 9, radio: 10, garage: 11, ammo: 12 };
  function base3d(g, key, u, v) {
    const S3 = DW.S3;
    if (!S3 || !S3.has('p_base')) return null;
    S3.load('p_base');
    if (!S3.ready('p_base')) return null;
    const f = S3.frame([['p_base', 'v', BLD3D[key], 0]]);
    if (!f) return null;
    const c = P(u, v, 0);
    g.drawImage(f.c, c[0] - f.ox, c[1] - f.oy, f.w, f.h);
    return [c[0], c[1] - f.oy];   // верх модели — для огней
  }
  function drawBuilding3d(g, k, t, st) {
    if (BLD3D[k] === undefined) return false;
    const s = SLOT[k];
    const top = base3d(g, k, s.u + s.w / 2, s.v + s.d / 2);
    if (!top) return false;
    const ax = PX(s.u + s.w / 2, s.v + s.d / 2), ay = PY(s.u + s.w / 2, s.v + s.d / 2, 0), uv = s.u + s.w / 2 + s.v + s.d / 2;
    if (k === 'tower') {
      if (st.raid && Math.sin(t / 160) > 0) { g.fillStyle = '#ff3a2a'; ART.circ(g, top[0], top[1] + 4, 2.6); }
      const M = M3.tower;
      towerG.ok = true; towerG.fx = ax + M.fx; towerG.fy = ay + M.fy; towerG.rail = ay + M.rail; towerG.lx = ax + M.lx; towerG.ly = ay + M.ly;
      // прожектор на углу площадки
      g.fillStyle = '#2a2c2e'; ART.circ(g, towerG.lx, towerG.ly, 2.4);
      g.fillStyle = nightK > 0.05 ? '#fff6d8' : '#8a9096'; ART.circ(g, towerG.lx + 0.8, towerG.ly + 0.4, 1.3);
    }
    if (k === 'beacon') { const gl = 0.5 + Math.sin(t / (cargoPend ? 110 : 300)) * 0.4; g.fillStyle = 'rgba(111,216,255,' + gl.toFixed(3) + ')'; ART.circ(g, top[0], top[1] + 3, 2.6); }
    if (k === 'workshop') {
      const M = M3.workshop;
      // горн внутри мастерской: угли тлеют и днём
      g.globalCompositeOperation = 'lighter';
      glowAt(g, ax + M.forge[0], ay + M.forge[1], 12, 0.7, '255,120,40', 0.35 + Math.sin(t / 90) * 0.1);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      pipe(g, ax + M.pipe[0], ay + M.pipe[1], 12);
      if (every('ws', 2.2)) smokeXY(ax + M.pipe[0], ay + M.pipe[1] - 13, uv, 0.34);
    }
    if (k === 'infirmary') {
      const M = M3.infirmary;
      pipe(g, ax + M.pipe[0], ay + M.pipe[1], 10);
      if (every('inf', 1.2 + nightK)) smokeXY(ax + M.pipe[0], ay + M.pipe[1] - 11, uv, 0.26);
    }
    if (k === 'hq') {
      const M = M3.hq;
      // окна штаба: тёплый свет лампы, ореол — в ночном проходе
      if (nightK > 0.05) {
        g.fillStyle = '#ffc46e';
        for (let i = 0; i < M.win.length; i++) { const w = M.win[i]; g.globalAlpha = (0.3 + 0.7 * nightK) * flick(i + 1, t); winQuad(g, ax + w[0], ay + w[1], w[2], w[3], w[4]); }
        g.globalAlpha = 1;
      }
      pipe(g, ax + M.pipe[0], ay + M.pipe[1], 11);
      if (every('hq', 1.6 + nightK)) smokeXY(ax + M.pipe[0], ay + M.pipe[1] - 12, uv, 0.3);
      // флаг Плацдарма над штабом
      const fp = P(s.u + s.w - 0.25, s.v + s.d - 0.25, 0), fy = top[1] + 6;
      ART.line(g, fp[0], fp[1] - 6, fp[0], fy - 18, 1.6, '#3a2a1a');
      g.fillStyle = '#e3a33b'; g.beginPath(); g.moveTo(fp[0], fy - 18);
      for (let i = 0; i <= 6; i++) g.lineTo(fp[0] + i * 3.2, fy - 18 + Math.sin(t / 170 + i * 0.9) * 1.5);
      for (let i = 6; i >= 0; i--) g.lineTo(fp[0] + i * 3.2, fy - 8 + Math.sin(t / 170 + i * 0.9) * 1.5);
      g.closePath(); g.fill();
    }
    if (k === 'radio') {
      // огонёк на мачте радиовышки
      const M = M3.radio;
      if ((t / 700) % 2 < 1) { g.fillStyle = '#ff4a3a'; ART.circ(g, ax + M.tip[0], ay + M.tip[1], 1.4); }
    }
    return true;
  }
  /* жестяная печная труба на крыше 3D-модели */
  function pipe(g, x, y, h) {
    g.fillStyle = '#2e2a26'; g.fillRect(x - 1.8, y - h, 3.6, h);
    g.fillStyle = '#4a4440'; g.fillRect(x - 1.8, y - h, 1.2, h);
    g.fillStyle = '#1a1816'; ART.ell(g, x, y - h, 2.4, 1.1);
  }
  const towerG = { ok: false, fx: 0, fy: 0, rail: 0, lx: 0, ly: 0 };
  function drawBuilding(g, k, t, st) {
    const lv = DW.G.blv(k);
    if (k !== 'hq' && !lv) { drawSlot(g, k, t); return; }
    const ba = buildAnim[k];
    let prog = 1;
    if (ba) { prog = U.clamp((t - ba) / 2200, 0, 1); if (prog >= 1) delete buildAnim[k]; }
    const s = SLOT[k];
    const base = P(s.u + s.w / 2, s.v + s.d, 0);
    if (prog < 1) { g.save(); g.translate(base[0], base[1]); g.scale(1, Math.max(0.05, U.ease(prog))); g.translate(-base[0], -base[1]); }
    if (!drawBuilding3d(g, k, t, st)) switch (k) {
      case 'hq': drawHQ(g, t); break;
      case 'tower': drawTower(g, t, st); break;
      case 'infirmary': drawInfirmary(g, t); break;
      case 'workshop': drawWorkshop(g, t); break;
      case 'farm': drawFarm(g, t); break;
      case 'beacon': drawBeacon(g, t); break;
      case 'turret': drawTurret(g, t, SLOT.turret); if (lv >= 2) drawTurret(g, t, TURRET2); break;
      default: { const s2 = SLOT[k]; box(g, s2.u, s2.v, s2.u + s2.w, s2.v + s2.d, 0, 16, ['#7a6a52', '#5e5040', '#4a3e30']); break; }
    }
    if (prog < 1) {
      g.restore();
      if (k === 'tower') towerG.ok = false;   // пока строится — часовому стоять негде
      // леса
      const a = P(s.u - 0.1, s.v + s.d + 0.1, 0), b = P(s.u + s.w + 0.1, s.v + s.d + 0.1, 0), c = P(s.u + s.w + 0.1, s.v - 0.1, 0);
      const H = 40 * (1 - prog * 0.3);
      [a, b, c].forEach(function (p) { ART.line(g, p[0], p[1], p[0], p[1] - H, 1.6, '#8a6a46'); });
      for (let y = 10; y < H; y += 12) { ART.line(g, a[0], a[1] - y, b[0], b[1] - y, 1.2, '#7a5a38'); ART.line(g, b[0], b[1] - y, c[0], c[1] - y, 1.2, '#7a5a38'); }
      if (every('dust', 18)) spawn(PK.DUST, s.u + Math.random() * s.w, s.v + s.d, 2, (Math.random() - 0.5) * 0.4, 0.2, 8, 900, 4, 8, 0.45, 0);
    }
  }
  function countBuilt() { let n = 0; const b = DW.G.state.buildings; for (const k in b) if (b[k]) n++; return n; }
  let logGr = null;
  function drawCamp(g, t, st) {
    // костёр
    const f = P(FIRE[0], FIRE[1], 0);
    const fire3 = base3d(g, 'fire', FIRE[0], FIRE[1]);
    // ночью пламя выше и ярче
    const big = 1 + nightK * 0.35;
    if (fire3) {
      for (let k = 0; k < 3; k++) {
        const h = (9 + Math.sin(t / 90 + k * 2) * 3) * big;
        g.fillStyle = FLAME3[k];
        g.beginPath(); g.moveTo(f[0] - 4 + k * 2, f[1] - 3); g.quadraticCurveTo(f[0] - 2 + k * 2, f[1] - 3 - h, f[0] + Math.sin(t / 120 + k) * 1.6, f[1] - 6 - h + k * 2);
        g.quadraticCurveTo(f[0] + 3 - k, f[1] - 3 - h * 0.5, f[0] + 4 - k * 2, f[1] - 3); g.closePath(); g.fill();
      }
    }
    if (!fire3) {
    g.fillStyle = 'rgba(0,0,0,0.35)'; ART.ell(g, f[0], f[1] + 1, 12, 5);
    for (let k = 0; k < 7; k++) { const a = k / 7 * 6.28; g.fillStyle = '#6a625a'; ART.circ(g, f[0] + Math.cos(a) * 9, f[1] + Math.sin(a) * 4.5, 2.4); }
    ART.line(g, f[0] - 6, f[1] + 1, f[0] + 6, f[1] - 1, 2.6, '#4a3220'); ART.line(g, f[0] - 6, f[1] - 1, f[0] + 6, f[1] + 1, 2.6, '#3a2616');
    for (let k = 0; k < 3; k++) {
      const h = (11 + Math.sin(t / 90 + k * 2) * 3) * big;
      g.fillStyle = FLAME2[k];
      g.beginPath(); g.moveTo(f[0] - 5 + k * 2.4, f[1]); g.quadraticCurveTo(f[0] - 2 + k * 2, f[1] - h, f[0] + Math.sin(t / 120 + k) * 1.6, f[1] - h - 4 + k * 2);
      g.quadraticCurveTo(f[0] + 4 - k, f[1] - h * 0.5, f[0] + 5 - k * 2.4, f[1]); g.closePath(); g.fill();
    }
    }
    // дым и угольки
    if (every('fire', 3 + nightK * 2)) spawn(PK.SMOKE, FIRE[0] + (Math.random() - 0.5) * 0.1, FIRE[1], 16, 0.05 + Math.random() * 0.04, -0.03, 14 + Math.random() * 4, 2600 + Math.random() * 600, 2.5, 8, 0.3, 0);
    if (every('ember', 2.5 + nightK * 4)) spawn(PK.EMBER, FIRE[0] + (Math.random() - 0.5) * 0.12, FIRE[1] + (Math.random() - 0.5) * 0.12, 10, (Math.random() - 0.5) * 0.3 + 0.05, (Math.random() - 0.5) * 0.3, 26 + Math.random() * 16, 900 + Math.random() * 700, 1.3, 0, 1, 6);
    // брёвна-скамейки (градиент общий, в координатах бревна)
    if (!logGr) { logGr = g.createLinearGradient(0, -4, 0, 4); logGr.addColorStop(0, '#8a6a4a'); logGr.addColorStop(1, '#3a2a1a'); }
    for (let i = 0; i < 2; i++) {
      const b = LOGS[i], x = PX(b[0], b[1]), y = PY(b[0], b[1], 4);
      g.save(); g.translate(x, y); g.rotate(b[2]); g.fillStyle = logGr; g.fillRect(-11, -3.5, 22, 7); g.fillStyle = '#b08a5c'; ART.ell(g, 11, 0, 1.6, 3.5); g.restore();
    }
    // бочка с водой (если нет 3D-бака — он рисуется отдельно, по глубине)
    if (DW.S3 && DW.S3.ready('p_base')) return;
    const bp = P(6.6, 3.7, 0); g.fillStyle = '#3e5a6a'; g.fillRect(bp[0] - 5, bp[1] - 13, 10, 13); ART.ell(g, bp[0], bp[1], 5, 2.2); g.fillStyle = '#5a7a8a'; ART.ell(g, bp[0], bp[1] - 13, 5, 2.2);
    void st;
  }
  const LOGS = [[4.3, 7.3, 0.5], [5.9, 7.9, -0.5]];
  const FLAME3 = ['rgba(255,120,30,0.85)', 'rgba(255,190,60,0.85)', 'rgba(255,240,160,0.8)'], FLAME2 = ['rgba(255,120,30,0.9)', 'rgba(255,190,60,0.9)', 'rgba(255,240,160,0.85)'];

  /* ---------- Запасы у склада: по количеству ресурсов (только показ) ---------- */
  const SUP_MAT = [2.62, 0.92], SUP_AMMO = [2.62, 1.66], SUP_FOOD = [3.62, 1.02];
  const C_CRATE = ['#a07a48', '#86643a', '#5e4424'], C_AMMO = ['#5a6a3a', '#46542c', '#36421e'], C_PLANK = ['#8a6a46', '#6a4c2e', '#563c22'], C_BOARD = ['#b08a5a', '#8a6a42', '#6a4c2e'];
  const C_STEEL = ['#8e9ba4', '#6c7880', '#566068'], C_HOLO = ['#a8ecff', '#5ab8d8', '#3a98b8'], C_PAD = ['#6c6e6a', '#50524e', '#444642'], C_COT = ['#6e6c4c', '#55533a', '#45432e'];
  const C_KIT = ['#e8e2d4', '#c8c0b0', '#a8a090'], C_SOIL = ['#4a3a28', '#3a2c1e', '#2e2418'], C_PIPE = ['#3a3632', '#2a2622', '#22201c'];
  function drawSupplies(g, st, grp) {
    const r = st.res;
    if (grp === 0) {
      // стройматериалы: ящики и доски
      const nc = Math.min(8, Math.ceil((r.materials || 0) / 6));
      for (let i = 0; i < nc; i++) { const u = SUP_MAT[0] + (i % 3) * 0.31, v = SUP_MAT[1] + (Math.floor(i / 3) % 2) * 0.33, h0 = i >= 6 ? 12 : 0; box(g, u, v, u + 0.28, v + 0.28, h0, h0 + 12, C_CRATE); }
      if (nc >= 4) { box(g, SUP_MAT[0] - 0.05, SUP_MAT[1] + 0.7, SUP_MAT[0] + 0.95, SUP_MAT[1] + 0.82, 0, 3, C_BOARD); box(g, SUP_MAT[0], SUP_MAT[1] + 0.71, SUP_MAT[0] + 0.9, SUP_MAT[1] + 0.81, 3, 6, C_CRATE); }
    } else if (grp === 1) {
      // патроны: зелёные цинки, штабелем
      const na = Math.min(6, Math.ceil((r.ammo || 0) / 100));
      for (let i = 0; i < na; i++) { const u = SUP_AMMO[0] + (i % 3) * 0.3, v = SUP_AMMO[1], h0 = i >= 3 ? 7 : 0; box(g, u, v, u + 0.26, v + 0.18, h0, h0 + 7, C_AMMO); g.fillStyle = '#c9b04a'; const p = P(u + 0.13, v + 0.18, h0 + 4); g.fillRect(p[0] - 2, p[1] - 1, 4, 1.4); }
    } else {
      // провизия: мешки и банки
      const nf = Math.min(7, Math.ceil((r.food || 0) / 10));
      for (let i = 0; i < nf; i++) {
        const row = i < 4 ? 0 : 1, j = row ? i - 4 : i;
        const u = SUP_FOOD[0] + j * 0.24 + row * 0.12, v = SUP_FOOD[1] + row * 0.02, h0 = row * 7;
        const x = PX(u, v), y = PY(u, v, h0);
        // мешок с завязанной горловиной
        g.fillStyle = 'rgba(0,0,0,0.25)'; ART.ell(g, x + 1, y + 0.5, 5.5, 2.4);
        g.fillStyle = '#a08a62'; ART.ell(g, x, y - 4.5, 5, 5);
        g.fillStyle = '#b8a27a'; ART.ell(g, x - 0.8, y - 5.5, 3.8, 3.8);
        g.fillStyle = '#a08a62'; ART.poly(g, [[x - 2.4, y - 8.5], [x + 2.4, y - 8.5], [x + 1.4, y - 11], [x - 1.4, y - 11]]);
        g.fillStyle = '#6a5a3a'; g.fillRect(x - 1.8, y - 9.6, 3.6, 1.1);
      }
      if (nf >= 3) { for (let i = 0; i < 3; i++) { const x = PX(SUP_FOOD[0] - 0.25, SUP_FOOD[1] + 0.25 + i * 0.13), y = PY(SUP_FOOD[0] - 0.25, SUP_FOOD[1] + 0.25 + i * 0.13, 0); g.fillStyle = '#8a8e92'; g.fillRect(x - 2, y - 5, 4, 5); g.fillStyle = '#b0b4b8'; ART.ell(g, x, y - 5, 2, 0.9); g.fillStyle = '#a03a2a'; g.fillRect(x - 2, y - 3.5, 4, 1.5); } }
    }
  }

  /* ---------- Груз Института у маяка (только показ состояния заказов) ---------- */
  let cargoPend = 0, cargoHere = 0;
  function readCargo(st) {
    cargoPend = 0; cargoHere = 0;
    const o = st.orders || [];
    for (let i = 0; i < o.length; i++) if (o[i].drop === st.baseNode) cargoPend += o[i].items.length;
    const n = DW.G.node(st.baseNode);
    if (n && n.cargo) cargoHere = n.cargo.length;
  }
  const PAD_SPOTS = [[3.2, 5.18], [3.64, 5.22], [3.22, 5.56], [3.66, 5.56], [3.2, 5.18]];
  function drawCargoPad(g, t) {
    const B = SPOT.pad, cu = (B.u0 + B.u1) / 2, cv = (B.v0 + B.v1) / 2;
    // бетонная плита с жёлтой разметкой
    box(g, B.u0, B.v0, B.u1, B.v1, 0, 1.5, C_PAD);
    const cx = PX(cu, cv), cy = PY(cu, cv, 1.5);
    g.strokeStyle = 'rgba(230,196,80,0.6)'; g.lineWidth = 1.3;
    g.beginPath(); g.ellipse(cx, cy, 15, 7.5, 0, 0, 7); g.stroke();
    g.beginPath(); g.moveTo(cx - 6, cy); g.lineTo(cx + 6, cy); g.moveTo(cx, cy - 3); g.lineTo(cx, cy + 3); g.stroke();
    if (cargoHere) {
      // груз на месте: стальные контейнеры с голубой полосой
      const n = Math.min(5, cargoHere);
      for (let i = 0; i < n; i++) {
        const p = PAD_SPOTS[i], h0 = i === 4 ? 13 : 0;
        box(g, p[0] - 0.14, p[1] - 0.11, p[0] + 0.14, p[1] + 0.11, h0, h0 + 12, C_STEEL);
        const a = P(p[0] - 0.14, p[1] + 0.11, h0 + 6), b = P(p[0] + 0.14, p[1] + 0.11, h0 + 6);
        g.strokeStyle = 'rgba(111,216,255,' + (0.7 + Math.sin(t / 300 + i) * 0.3).toFixed(3) + ')'; g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
      }
    } else if (cargoPend) {
      // груз в пути: портал наводится — мерцают очертания контейнеров, по ним бежит луч
      const n = Math.min(4, Math.ceil(cargoPend / 2));
      const fl = 0.28 + Math.sin(t / 130) * 0.08 + (Math.sin(t / 47) > 0.85 ? 0.15 : 0);
      g.globalAlpha = fl;
      for (let i = 0; i < n; i++) { const p = PAD_SPOTS[i]; box(g, p[0] - 0.14, p[1] - 0.11, p[0] + 0.14, p[1] + 0.11, 0, 12, C_HOLO); }
      g.globalAlpha = 1;
      const sh = (t / 14) % 16, a = P(B.u0 + 0.05, B.v1 - 0.05, sh), b = P(B.u1 - 0.05, B.v1 - 0.05, sh), c = P(B.u1 - 0.05, B.v0 + 0.05, sh);
      g.strokeStyle = 'rgba(160,235,255,0.7)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.stroke();
      const k = (t / 900) % 1;
      g.strokeStyle = 'rgba(111,216,255,' + (0.6 * (1 - k)).toFixed(3) + ')'; g.lineWidth = 1.4;
      g.beginPath(); g.ellipse(cx, cy, 8 + k * 22, 4 + k * 11, 0, 0, 7); g.stroke();
    }
  }

  /* ---------- Бытовые мелочи: койки, наковальня, грядка, бельё, собака ---------- */
  function drawCot(g, c) {
    const u = c[0], v = c[1];
    // носилки на ножках: рама, брезент, скатка-подушка
    for (let i = 0; i < 4; i++) { const p = P(u + (i % 2 ? 0.12 : -0.12), v + (i < 2 ? -0.3 : 0.3), 0); ART.line(g, p[0], p[1], p[0], p[1] - 3, 1, '#3a3226'); }
    box(g, u - 0.13, v - 0.32, u + 0.13, v + 0.32, 3, 4.5, C_COT);
    const pl = P(u, v - 0.22, 5); g.fillStyle = '#c8c0a8'; ART.ell(g, pl[0], pl[1], 3.6, 1.8);
  }
  function drawKit(g) {
    const u = SPOT.kit[0], v = SPOT.kit[1];
    box(g, u - 0.09, v - 0.07, u + 0.09, v + 0.07, 0, 5, C_KIT);
    const p = P(u + 0.09, v, 2.5); g.fillStyle = '#c0302a'; g.fillRect(p[0] - 0.8, p[1] - 2, 1.6, 4); g.fillRect(p[0] - 2, p[1] - 0.8, 4, 1.6);
  }
  function drawAnvil(g, t) {
    const x = PX(SPOT.anvil[0], SPOT.anvil[1]), y = PY(SPOT.anvil[0], SPOT.anvil[1], 0);
    g.fillStyle = 'rgba(0,0,0,0.3)'; ART.ell(g, x, y, 7, 3);
    g.fillStyle = '#5a4030'; g.fillRect(x - 3, y - 6, 6, 6);           // колода
    g.fillStyle = '#2a2a2c'; g.fillRect(x - 6, y - 10, 11, 3.5);      // наковальня
    g.beginPath(); g.moveTo(x + 5, y - 10); g.lineTo(x + 8.5, y - 9); g.lineTo(x + 5, y - 6.5); g.fill();
    g.fillStyle = '#55575a'; g.fillRect(x - 6, y - 10, 11, 1);
    // раскалённая заготовка
    g.fillStyle = 'rgba(255,' + (150 + Math.round(Math.sin(t / 200) * 40)) + ',60,0.95)'; g.fillRect(x - 2, y - 11, 4, 1.4);
  }
  function drawBed(g, t) {
    const B = SPOT.bed;
    box(g, B.u0, B.v0, B.u1, B.v1, 0, 2, C_SOIL);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 4; j++) {
      const u = B.u0 + 0.14 + i * 0.22, v = B.v0 + 0.14 + j * 0.24, x = PX(u, v), y = PY(u, v, 2);
      const sw = Math.sin(t / 900 + i * 2 + j) * 0.6;
      g.fillStyle = '#3a5a2a'; ART.ell(g, x, y - 2, 4.2, 2.8);
      g.fillStyle = '#6aa04a'; ART.ell(g, x - 0.6 + sw, y - 3.6, 2.8, 2);
    }
    // лейка
    const lx = PX(B.u1 + 0.12, B.v1 - 0.05), ly = PY(B.u1 + 0.12, B.v1 - 0.05, 0);
    g.fillStyle = '#6a7a80'; g.fillRect(lx - 2.5, ly - 5, 5, 5); ART.line(g, lx + 2.5, ly - 3.5, lx + 6, ly - 6.5, 1, '#6a7a80');
  }
  const CLOTH = ['#d8d0bc', '#7a8a6a', '#c8691c', '#8a8a90', '#c8c0a8'];
  function drawLaundry(g, t) {
    const L = SPOT.line;
    const ax = PX(L.u0, L.v), ay = PY(L.u0, L.v, 0), bx = PX(L.u1, L.v), by = PY(L.u1, L.v, 0);
    ART.line(g, ax, ay, ax, ay - L.h, 1.6, '#4a321a'); ART.line(g, bx, by, bx, by - L.h, 1.6, '#4a321a');
    // верёвка провисает
    const mx = (ax + bx) / 2, my = (ay + by) / 2 - L.h + 5;
    g.strokeStyle = '#9a8a6a'; g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(ax, ay - L.h); g.quadraticCurveTo(mx, my, bx, by - L.h); g.stroke();
    const wind = 1.4 + Math.sin(t / 2300) * 0.8;
    for (let i = 0; i < 5; i++) {
      const f = 0.14 + i * 0.18, q = 1 - f;
      // точка на кривой Безье
      const x = q * q * ax + 2 * q * f * mx + f * f * bx, y = q * q * (ay - L.h) + 2 * q * f * my + f * f * (by - L.h);
      const w = i === 2 ? 9 : 7, h = i === 2 ? 12 : 9 + (i % 2) * 2, e = w * 0.25;
      const sw = Math.sin(t / 520 + i * 1.3) * 1.8 + wind;
      g.fillStyle = CLOTH[i];
      g.beginPath(); g.moveTo(x - w / 2, y - e); g.lineTo(x + w / 2, y + e); g.lineTo(x + w / 2 + sw, y + e + h); g.lineTo(x - w / 2 + sw * 0.8, y - e + h); g.closePath(); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.18)';
      g.beginPath(); g.moveTo(x + w / 2 - 2, y + e - 1); g.lineTo(x + w / 2, y + e); g.lineTo(x + w / 2 + sw, y + e + h); g.lineTo(x + w / 2 - 2 + sw, y + e + h - 1); g.closePath(); g.fill();
      g.fillStyle = '#5a4a3a'; g.fillRect(x - 0.6, y - 1.5, 1.2, 2);   // прищепка
    }
  }
  function drawDog(g, t) {
    const x = PX(SPOT.dog[0], SPOT.dog[1]), y = PY(SPOT.dog[0], SPOT.dog[1], 0);
    const sleep = nightK > 0.3;
    g.fillStyle = 'rgba(0,0,0,0.3)'; ART.ell(g, x, y, 10, 3.5);
    if (sleep) {
      // свернулась у огня, бока ходят от дыхания
      const br = 1 + Math.sin(t / 700) * 0.06;
      g.fillStyle = '#6a4a2e'; ART.ell(g, x, y - 3.5 * br, 8, 4 * br);
      g.fillStyle = '#7e5a38'; ART.ell(g, x - 1, y - 4.5 * br, 5, 2.4);
      g.fillStyle = '#5a3c24'; ART.ell(g, x - 6.5, y - 2.5, 3.6, 2.6);
      g.fillStyle = '#3a2616'; ART.ell(g, x - 7.5, y - 4.2, 1.4, 1.8, -0.5);
      ART.line(g, x + 7, y - 2, x + 3, y - 0.5, 2, '#5a3c24');
    } else {
      // сидит и виляет хвостом
      const tw = Math.sin(t / 110) * 3;
      ART.line(g, x + 5, y - 2.5, x + 9 + tw * 0.4, y - 5 - tw, 1.8, '#5a3c24');
      g.fillStyle = '#6a4a2e'; ART.ell(g, x + 2, y - 4, 5.5, 4);
      g.fillStyle = '#7e5a38'; ART.ell(g, x - 2, y - 8, 3.2, 4.5);
      ART.line(g, x - 3, y - 4, x - 3.4, y, 1.6, '#5a3c24'); ART.line(g, x - 0.6, y - 4, x - 0.8, y, 1.6, '#5a3c24');
      const hb = Math.sin(t / 1700) > 0.7 ? 1.2 : 0;   // поворачивает голову к огню
      g.fillStyle = '#6a4a2e'; ART.ell(g, x - 3.5 - hb, y - 12.5, 3, 2.6);
      g.fillStyle = '#5a3c24'; ART.ell(g, x - 6.5 - hb, y - 11.8, 2, 1.4);
      g.fillStyle = '#1a1410'; ART.circ(g, x - 8.3 - hb, y - 12, 0.8);
      g.fillStyle = '#3a2616'; ART.ell(g, x - 2.2 - hb, y - 14.5, 1.2, 2, 0.4);
    }
  }

  /* ---------- Помост и вороны на стенах ---------- */
  function drawCatwalks(g) {
    const h = CW.h;
    box(g, 2.5, CW.a, 9.5, CW.b, h - 2, h, C_PLANK);
    box(g, CW.a, 2.5, CW.b, 9.5, h - 2, h, C_PLANK);
    for (let u = 2.6; u < 9.5; u += 0.9) { const x = PX(u, CW.b - 0.04), y = PY(u, CW.b - 0.04, 0); ART.line(g, x, y, x, y - h + 2, 1.6, '#4a321a'); }
    for (let v = 2.6; v < 9.5; v += 0.9) { const x = PX(CW.b - 0.04, v), y = PY(CW.b - 0.04, v, 0); ART.line(g, x, y, x, y - h + 2, 1.6, '#4a321a'); }
  }
  const crows = [];
  function initCrows() {
    crows.length = 0;
    const lv = DW.G.blv('walls');
    if (!lv) return;
    const n = QCROW[Q];
    for (let i = 0; i < n; i++) { const c = { u: 0, v: 0, h: 0, st: 0, t0: 0, side: i % 2, dir: 1, seed: i * 1.7, fu: 0, fv: 0, fh: 0, wait: 0 }; perch(c, lv); crows.push(c); }
  }
  function perch(c, lv) {
    const k = 3 + Math.random() * 6;
    if (c.side === 0) { c.u = k; c.v = 0.19; } else { c.u = 0.19; c.v = k; }
    c.h = lv >= 2 ? 22 : 24; c.dir = Math.random() < 0.5 ? 1 : -1; c.st = 0;
  }
  function stepCrows(dt, t) {
    if (!crows.length) return;
    for (let i = 0; i < crows.length; i++) {
      const c = crows[i];
      if (c.st === 0) {
        // взлетают, когда рядом проходит дозорный, или просто так
        let scare = Math.random() < dt * 0.02;
        for (let j = 0; j < people.length && !scare; j++) {
          const p = people[j];
          if (p.role === 'patrol' && c.side === 0 && Math.abs(p.u - c.u) < 1.1 && p.h === CW.h) scare = true;
          if (p.role === 'patrol2' && c.side === 1 && Math.abs(p.v - c.v) < 1.1 && p.h === CW.h) scare = true;
        }
        if (scare) { c.st = 1; c.t0 = t; c.fu = c.u; c.fv = c.v; c.fh = c.h; }
      } else if (c.st === 1 && t - c.t0 > 3200) { c.st = 2; c.wait = 6 + Math.random() * 8; }
      else if (c.st === 2) { c.wait -= dt; if (c.wait <= 0) { perch(c, DW.G.blv('walls')); c.st = 3; c.t0 = t; } }
      else if (c.st === 3 && t - c.t0 > 2400) c.st = 0;
    }
  }
  /* ворона: сидит (клюёт, вертит головой) или летит, махая крыльями */
  function drawCrow(g, c, t, x, y, fly) {
    const d = c.dir;
    g.fillStyle = '#16141a';
    if (!fly) {
      const pk = Math.sin(t / 900 + c.seed * 3) > 0.75 ? 1.6 : 0;
      g.beginPath(); g.moveTo(x - 2.5 * d, y - 3); g.lineTo(x - 6.5 * d, y - 1.4); g.lineTo(x - 6 * d, y - 0.4); g.closePath(); g.fill();
      ART.ell(g, x, y - 3, 3.6, 2.3, -0.2 * d);
      ART.circ(g, x + 2.8 * d, y - 4.9 + pk, 1.6);
      g.fillStyle = '#3a3630'; g.beginPath(); g.moveTo(x + 4.2 * d, y - 5.3 + pk); g.lineTo(x + 6.2 * d, y - 4.7 + pk); g.lineTo(x + 4.2 * d, y - 4.3 + pk); g.closePath(); g.fill();
    } else {
      const w = Math.sin(t / 65 + c.seed * 5);
      ART.ell(g, x, y, 3.4, 1.8);
      ART.circ(g, x + 3 * d, y - 0.8, 1.4);
      g.beginPath(); g.moveTo(x - 1.5, y - 0.5); g.lineTo(x - 3 * d, y - 1 - w * 6); g.lineTo(x + 2, y - 0.5); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(x - 1, y); g.lineTo(x + 1 * d, y - 1 - w * 5); g.lineTo(x + 2.5, y); g.closePath(); g.fill();
    }
  }
  function drawCrows(g, t, flying) {
    for (let i = 0; i < crows.length; i++) {
      const c = crows[i];
      if (!flying && c.st === 0) drawCrow(g, c, t, PX(c.u, c.v), PY(c.u, c.v, c.h), false);
      if (flying && (c.st === 1 || c.st === 3)) {
        // улетают наружу и вверх; возвращаются тем же путём на новое место
        let k = (t - c.t0) / (c.st === 1 ? 3200 : 2400); k = k > 1 ? 1 : k;
        const out = c.st === 1 ? k : 1 - (1 - k) * (1 - k);
        const f = c.st === 1 ? out : 1 - out;
        const du = c.side === 0 ? f * 1.5 * c.dir : -f * 3.5, dv = c.side === 0 ? -f * 3.5 : f * 1.5 * c.dir;
        const bu = c.st === 1 ? c.fu : c.u, bv = c.st === 1 ? c.fv : c.v, bh = c.st === 1 ? c.fh : c.h;
        g.globalAlpha = 1 - f * 0.6;
        drawCrow(g, c, t, PX(bu + du, bv + dv), PY(bu + du, bv + dv, bh + f * 90), true);
        g.globalAlpha = 1;
      }
    }
  }

  /* ---------- Ночные огни: всё через готовые спрайты, режим сложения ---------- */
  function nightLights(g, t) {
    const G = DW.G, nk = nightK, d3 = DW.S3 && DW.S3.ready('p_base');
    const fl = fireFl(t);
    // костёр: дрожащее пятно света на земле и ореол пламени
    const fx = PX(FIRE[0], FIRE[1]), fy = PY(FIRE[0], FIRE[1], 0);
    glowAt(g, fx, fy, 118 * (0.94 + fl * 0.06), 0.55, '255,140,50', 0.75 * nk * fl);
    glowAt(g, fx, fy - 10, 30, 1, '255,200,110', 0.7 * nk * fl);
    // штаб: окна, дверь
    if (d3) {
      const s = SLOT.hq, ax = PX(s.u + s.w / 2, s.v + s.d / 2), ay = PY(s.u + s.w / 2, s.v + s.d / 2, 0), M = M3.hq;
      for (let i = 0; i < M.win.length; i++) { const w = M.win[i]; glowAt(g, ax + w[0], ay + w[1], 16, 1, '255,180,90', 0.5 * nk * flick(i + 1, t)); }
      glowAt(g, ax + M.door[0], ay + M.door[1] + 14, 26, 0.5, '255,180,90', 0.35 * nk * flick(9, t));
    } else glowAt(g, PX(5.1, 6.0), PY(5.1, 6.0, 16), 60, 1, '255,190,110', 0.35 * nk);
    if (G.blv('workshop')) {
      const s = SLOT.workshop, ax = PX(s.u + s.w / 2, s.v + s.d / 2), ay = PY(s.u + s.w / 2, s.v + s.d / 2, 0);
      if (d3) glowAt(g, ax + M3.workshop.forge[0], ay + M3.workshop.forge[1], 44, 0.7, '255,130,50', 0.55 * nk * (0.85 + Math.sin(t / 90) * 0.15));
      else glowAt(g, PX(2.1, 8.7), PY(2.1, 8.7, 8), 50, 1, '255,140,60', 0.4 * nk);
      glowAt(g, PX(SPOT.anvil[0], SPOT.anvil[1]), PY(SPOT.anvil[0], SPOT.anvil[1], 10), 14, 1, '255,160,70', 0.4 * nk);
    }
    if (G.blv('farm')) glowAt(g, PX(7.9, 7.7), PY(7.9, 7.7, 10), 70, 1, '170,255,200', 0.3 * nk);
    if (G.blv('beacon')) {
      const pul = cargoPend ? 0.75 + Math.sin(t / 110) * 0.25 : 1;
      if (d3) { const s = SLOT.beacon; glowAt(g, PX(s.u + s.w / 2, s.v + s.d / 2), PY(s.u + s.w / 2, s.v + s.d / 2, 0) - 96, 40, 1, '111,216,255', 0.6 * nk * pul); }
      else glowAt(g, PX(3.05, 4.25), PY(3.05, 4.25, 54), 40, 1, '111,216,255', 0.6 * nk * pul);
      if (cargoPend || cargoHere) { const B = SPOT.pad; glowAt(g, PX((B.u0 + B.u1) / 2, (B.v0 + B.v1) / 2), PY((B.u0 + B.u1) / 2, (B.v0 + B.v1) / 2, 0), 40, 0.5, '111,216,255', 0.45 * nk * pul); }
    }
    if (G.blv('infirmary')) {
      const s = SLOT.infirmary;
      if (d3) { const ax = PX(s.u + s.w / 2, s.v + s.d / 2), ay = PY(s.u + s.w / 2, s.v + s.d / 2, 0); glowAt(g, ax + M3.infirmary.glow[0], ay + M3.infirmary.glow[1], 46, 0.75, '255,215,150', 0.32 * nk * flick(4, t)); }
      else glowAt(g, PX(8.9, 2.3), PY(8.9, 2.3, 8), 40, 1, '255,220,150', 0.35 * nk);
      glowAt(g, PX(SPOT.medic[0], SPOT.medic[1]), PY(SPOT.medic[0], SPOT.medic[1], 0), 34, 0.5, '255,210,140', 0.3 * nk * flick(5, t));
    }
    if (d3 && G.blv('radio')) { const s = SLOT.radio; if ((t / 700) % 2 < 1) glowAt(g, PX(s.u + s.w / 2, s.v + s.d / 2) + M3.radio.tip[0], PY(s.u + s.w / 2, s.v + s.d / 2, 0) + M3.radio.tip[1], 10, 1, '255,80,60', 0.8 * nk); }
    if (d3 && G.blv('garage')) { const s = SLOT.garage; glowAt(g, PX(s.u + s.w / 2, s.v + s.d / 2) + M3.garage.lamp[0], PY(s.u + s.w / 2, s.v + s.d / 2, 0) + M3.garage.lamp[1], 26, 0.8, '255,200,120', 0.4 * nk * flick(6, t)); }
    if (gate3d) { const gx = PX(N - 0.25, 5.1), gy = PY(N - 0.25, 5.1, 0); for (let i = 0; i < 2; i++) { const l = M3.gate.lamps[i]; glowAt(g, gx + l[0], gy + l[1], 18, 1, '255,190,100', 0.55 * nk * flick(11 + i, t)); } }
    for (let i = 0; i < lampN; i++) glowAt(g, lampXY[i * 2], lampXY[i * 2 + 1], 13, 1, '255,190,90', 0.5 * nk * flick(20 + i, t));
    if (G.blv('tower') && towerG.ok) searchlight(g, t);
    g.globalAlpha = 1;
  }
  /* прожектор с вышки: мягкий конус, бродящий по лагерю, и пятно света на земле */
  function searchlight(g, t) {
    const th = Math.PI / 4 + Math.sin(t / 2900) * 0.95, r = 4.6 + Math.sin(t / 2100 + 1) * 2.2;
    const tu = TOWER_C[0] + Math.cos(th) * r, tv = TOWER_C[1] + Math.sin(th) * r;
    const sx = towerG.lx, sy = towerG.ly, tx = PX(tu, tv), ty = PY(tu, tv, 0);
    const dx = tx - sx, dy = ty - sy, len = Math.hypot(dx, dy);
    g.globalAlpha = 0.32 * nightK;
    g.save(); g.translate(sx, sy); g.rotate(Math.atan2(dy, dx)); g.drawImage(coneSpr(), 0, -24, len, 48); g.restore();
    glowAt(g, tx, ty, 52, 0.5, '255,250,225', 0.5 * nightK);
    glowAt(g, sx, sy, 10, 1, '255,250,225', 0.9 * nightK);
  }
  /* светлячки над теплицей и у костра */
  function fireflies(g, t) {
    const n = QFLY[Q];
    for (let i = 0; i < n; i++) {
      const s = i * 1.37, cu = i % 2 ? 7.6 : 5.9, cv = i % 2 ? 6.3 : 8.6;
      const u = cu + Math.sin(t * 0.00031 * (1 + (i % 3) * 0.3) + s) * 1.1;
      const v = cv + Math.cos(t * 0.00027 * (1 + (i % 4) * 0.25) + s * 2) * 0.8;
      const h = 12 + Math.sin(t * 0.0011 + s * 3) * 7;
      let a = Math.sin(t * 0.0021 + s * 5);
      if (a <= 0) continue;
      a = a * a * nightK;
      const x = PX(u, v), y = PY(u, v, h);
      glowAt(g, x, y, 6, 1, '200,255,120', a * 0.9);
      g.globalAlpha = a; g.fillStyle = '#efffc0'; g.fillRect(x - 0.7, y - 0.7, 1.4, 1.4);
    }
    g.globalAlpha = 1;
  }

  /* ---------- Порядок отрисовки по глубине (переиспользуемые записи) ---------- */
  const IT = { BLD: 0, CAMP: 1, STORE: 2, TANK: 3, MAN: 4, SENTRY: 5, SUP: 6, PAD: 7, LINE: 8, DOG: 9, COT: 10, ANVIL: 11, BED: 12, KIT: 13 };
  const itemPool = [], order = [];
  let itemN = 0;
  function addItem(d, kind, ref) {
    let it = itemPool[itemN];
    if (!it) { it = { d: 0, kind: 0, ref: null }; itemPool[itemN] = it; }
    it.d = d; it.kind = kind; it.ref = ref;
    order[itemN++] = it;
  }
  function sortItems() {
    // вставками: порядок от кадра к кадру почти не меняется
    for (let i = 1; i < itemN; i++) {
      const it = order[i];
      let j = i - 1;
      while (j >= 0 && order[j].d > it.d) { order[j + 1] = order[j]; j--; }
      order[j + 1] = it;
    }
  }
  function drawItem(g, it, t, st) {
    switch (it.kind) {
      case IT.BLD: drawBuilding(g, it.ref, t, st); break;
      case IT.CAMP: drawCamp(g, t, st); break;
      case IT.STORE: base3d(g, 'store', 4.7, 1.9); break;
      case IT.TANK: base3d(g, 'tank', 6.6, 3.7); break;
      case IT.MAN: drawPerson(g, it.ref, t); break;
      case IT.SENTRY: drawSentry(g, it.ref, t); break;
      case IT.SUP: drawSupplies(g, st, it.ref); break;
      case IT.PAD: drawCargoPad(g, t); break;
      case IT.LINE: drawLaundry(g, t); break;
      case IT.DOG: drawDog(g, t); break;
      case IT.COT: drawCot(g, it.ref); break;
      case IT.ANVIL: drawAnvil(g, t); break;
      case IT.BED: drawBed(g, t); break;
      case IT.KIT: drawKit(g); break;
    }
  }
  function collectItems(st) {
    const G = DW.G;
    itemN = 0;
    for (let i = 0; i < SLOT_KEYS.length; i++) { const k = SLOT_KEYS[i], s = SLOT[k]; addItem(s.u + s.w + s.v + s.d - 0.4, IT.BLD, k); }
    addItem(FIRE[0] + FIRE[1], IT.CAMP, null);
    // 3D: склад-навес и бак с водой
    addItem(4.7 + 1.9, IT.STORE, null);
    addItem(6.6 + 3.7, IT.TANK, null);
    addItem(SUP_MAT[0] + SUP_MAT[1] + 1.4, IT.SUP, 0);
    addItem(SUP_AMMO[0] + SUP_AMMO[1] + 0.8, IT.SUP, 1);
    addItem(SUP_FOOD[0] + SUP_FOOD[1] + 0.9, IT.SUP, 2);
    if (G.blv('beacon')) addItem(SPOT.pad.u1 + SPOT.pad.v1 - 0.4, IT.PAD, null);
    addItem(SPOT.line.u1 + SPOT.line.v, IT.LINE, null);
    addItem(SPOT.dog[0] + SPOT.dog[1], IT.DOG, null);
    if (G.blv('infirmary')) { for (let i = 0; i < SPOT.cots.length; i++) addItem(SPOT.cots[i][0] + SPOT.cots[i][1] + 0.2, IT.COT, SPOT.cots[i]); addItem(SPOT.kit[0] + SPOT.kit[1], IT.KIT, null); }
    if (G.blv('workshop')) addItem(SPOT.anvil[0] + SPOT.anvil[1], IT.ANVIL, null);
    if (G.blv('farm')) addItem(SPOT.bed.u1 + SPOT.bed.v1 - 0.3, IT.BED, null);
    const tw = SLOT.tower;
    for (let i = 0; i < people.length; i++) {
      const p = people[i];
      if (p.onTower) addItem(tw.u + tw.w + tw.v + tw.d - 0.38, IT.SENTRY, p);
      else addItem(p.u + p.v + (p.h ? 0 : 0.05) + (p.act === 'sit' && p.h ? 0.25 : 0), IT.MAN, p);
    }
  }

  /* ---------- Рендер ---------- */
  let bgG = null, bgKey = -1;
  S.render = function (g, W, H, dpr) {
    const st = DW.G.state;
    const t = performance.now();
    const dt = Math.min(0.05, (t - (lastT || t)) / 1000); lastT = t;
    frameDt = dt; nowT = t;
    readQuality();
    nightK = S.forceNight !== undefined ? S.forceNight : Math.max(0, Math.sin(t / 45000 * Math.PI * 2 - 1)) * 0.85;
    buildPlate();
    readCargo(st);
    stepPeople(dt);
    stepCrows(dt, t);
    if (cam.tx !== null && cam.tx !== undefined) { cam.x += (cam.tx - cam.x) * Math.min(1, dt * 5); cam.y += (cam.ty - cam.y) * Math.min(1, dt * 5); if (Math.abs(cam.tx - cam.x) < 0.5) cam.tx = null; }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bk = H * 2 + (nightK > 0.5 ? 1 : 0);
    if (bk !== bgKey) { bgKey = bk; bgG = g.createLinearGradient(0, 0, 0, H); bgG.addColorStop(0, nightK > 0.5 ? '#0c0e18' : '#1e1812'); bgG.addColorStop(1, '#070605'); }
    g.fillStyle = bgG; g.fillRect(0, 0, W, H);
    const z = cam.z;
    g.setTransform(dpr * z, 0, 0, dpr * z, dpr * (W / 2 - cam.x * z), dpr * (H / 2 - cam.y * z));
    g.imageSmoothingEnabled = true;
    g.drawImage(plate, -N * HW, 0, 2 * N * HW, 2 * N * HH + EDGE + 4);
    const wl = DW.G.blv('walls');
    lampN = 0; towerG.ok = false;
    if (wl) { drawWalls(g, t, wl, false); drawCatwalks(g); drawCrows(g, t, false); }
    // по глубине: постройки, лагерь, запасы, люди
    collectItems(st);
    sortItems();
    for (let i = 0; i < itemN; i++) drawItem(g, order[i], t, st);
    if (wl) drawWalls(g, t, wl, true);
    // дым, пыль, капли; летящие вороны
    drawParts(g, t, false);
    drawCrows(g, t, true);
    // ночь и огни
    if (nightK > 0.02) {
      g.save(); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = 'rgba(12,16,40,' + (nightK * 0.62).toFixed(3) + ')'; g.fillRect(0, 0, W, H);
      g.restore();
      g.globalCompositeOperation = 'lighter';
      nightLights(g, t);
      drawParts(g, t, true);
      fireflies(g, t);
      g.globalCompositeOperation = 'source-over';
    } else drawParts(g, t, true);
    g.globalAlpha = 1;
    // подсветка выбранной постройки
    if (sel && SLOT[sel]) {
      const s = SLOT[sel];
      const a = P(s.u - 0.1, s.v - 0.1, 0), b = P(s.u + s.w + 0.1, s.v - 0.1, 0), c = P(s.u + s.w + 0.1, s.v + s.d + 0.1, 0), d = P(s.u - 0.1, s.v + s.d + 0.1, 0);
      g.strokeStyle = 'rgba(255,220,140,' + (0.6 + Math.sin(t / 200) * 0.3) + ')'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.lineTo(d[0], d[1]); g.closePath(); g.stroke();
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.drawImage(DW.TR.vignette(W, H, 0.45), 0, 0, W, H);
  };

  /* ---------- Выбор постройки ---------- */
  S.tap = function (sx, sy) {
    if (DW.UI.hasModal()) return;
    const wx = (sx - view.w / 2) / cam.z + cam.x, wy = (sy - view.h / 2) / cam.z + cam.y;
    let best = null, bd = 1e9;
    Object.keys(SLOT).forEach(function (k) {
      if (k === 'walls') return;
      const s = SLOT[k];
      const c = P(s.u + s.w / 2, s.v + s.d / 2, 0);
      const hgt = { hq: 40, tower: 80, beacon: 50, infirmary: 26, workshop: 26, farm: 20, turret: 12 }[k] || 20;
      const rx = (s.w + s.d) * HW * 0.5, dy = wy - (c[1] - hgt * 0.5), dx = wx - c[0];
      const d = Math.abs(dx) / rx + Math.abs(dy) / ((s.w + s.d) * HH * 0.5 + hgt * 0.5);
      if (d < 1 && d < bd) { bd = d; best = k; }
    });
    if (!best) {
      // стены: тап у края участка
      const tu = (wx / HW + wy / HH) / 2, tv = (wy / HH - wx / HW) / 2;
      if (tu > 0 && tv > 0 && tu < N && tv < N && (tu < 0.9 || tv < 0.9 || tu > N - 0.9 || tv > N - 0.9)) best = 'walls';
    }
    sel = best;
    focusSel();
    DW.SFX.play('click');
    S.refresh();
  };

  /* ---------- Интерфейс ---------- */
  function buildHud() {
    const ui = document.getElementById('ui');
    ui.innerHTML = '';
    hud = {};
    hud.top = el('div', { class: 'wtop' });
    hud.panel = el('div', { class: 'wpanel hidden' });
    hud.bot = el('div', { class: 'wbot' });
    const btn = function (icon, label, fn) {
      return el('button', { class: 'wbtn', html: '<span class="ico">' + D.ICONS[icon] + '</span><span>' + label + '</span>', onclick: function () { DW.SFX.play('click'); fn(); } });
    };
    hud.bot.appendChild(btn('day', 'Карта', function () { DW.Main.toWorld(); }));
    hud.bot.appendChild(btn('base', 'Постройки', function () { DW.UI.base(function () { S.refresh(); }); }));
    hud.bot.appendChild(btn('squad', 'Отряд', function () { DW.UI.squad(function () { leaveAllSeats(); initPeople(DW.G.state); S.refresh(); }); }));
    hud.bot.appendChild(btn('portalbtn', 'Портал', function () { DW.UI.portal(function () { S.refresh(); }); }));
    ui.appendChild(hud.top); ui.appendChild(hud.panel); ui.appendChild(hud.bot);
  }
  function leaveAllSeats() { seatBy.fill(null); evening = false; }
  S.refresh = function () {
    if (!hud) return;
    const G = DW.G, st = G.state, n = G.node(st.baseNode), ic = D.icon;
    const prod = [];
    if (G.blv('farm')) prod.push('+5 ' + ic('food'));
    if (G.blv('workshop')) prod.push('+15 ' + ic('ammo'));
    if (G.blv('ammo')) prod.push('+20 ' + ic('ammo'));
    hud.top.innerHTML = '<div class="wday">' + ic('base') + '<b>' + n.name + '</b></div>' +
      '<div class="wres"><span class="r">Защита <b>' + G.defenseScore() + '</b></span>' +
      '<span class="r">' + ic('materials') + '<b>' + st.res.materials + '</b></span>' +
      '<span class="r gems">' + ic('gems') + '<b>' + st.res.gems + '</b></span>' +
      '<span class="r">' + ic('food') + '<b>' + st.res.food + '</b></span>' +
      '<span class="r">' + ic('ammo') + '<b>' + st.res.ammo + '</b></span></div>' +
      '<div class="wwarn">' + (st.raid ? '<span class="bad">Набег через ' + Math.max(0, st.raid.day - st.day) + ' дн.!</span> ' : '') + (prod.length ? 'В день: ' + prod.join(' ') : '') + '</div>';
    renderPanel();
  };
  function renderPanel() {
    const p = hud.panel;
    p.innerHTML = '';
    if (!sel) { p.classList.add('hidden'); return; }
    p.classList.remove('hidden');
    const G = DW.G;
    if (sel === 'hq') {
      p.appendChild(el('div', { class: 'pn-title', text: SLOT.hq.n }));
      p.appendChild(el('div', { class: 'pn-desc', html: SLOT.hq.desc + '<br><br>Построек: <b>' + countBuilt() + '</b>. Чем больше построек, тем солиднее штаб: с четырёх построек он становится двухэтажным, бетонным.' }));
      return;
    }
    const b = D.BUILDINGS[sel];
    const lv = G.blv(sel);
    const done = lv >= b.max, locked = b.tier && G.tier() < b.tier;
    const cost = b.cost[Math.min(lv, b.cost.length - 1)];
    const title = b.levels ? (lv ? b.levels[lv - 1] : b.n) : b.n;
    p.appendChild(el('div', { class: 'pn-art', html: '<img src="' + ART.buildingIcon(sel) + '" alt="">' }));
    p.appendChild(el('div', { class: 'pn-title', html: title + (b.max > 1 ? ' <small>' + lv + '/' + b.max + '</small>' : '') }));
    p.appendChild(el('div', { class: 'pn-sub', html: lv ? '<span class="good">Построено</span>' : '<span class="dim">Не построено</span>' }));
    p.appendChild(el('div', { class: 'pn-desc', text: b.desc }));
    const acts = el('div', { class: 'pn-acts' });
    if (done) acts.appendChild(el('div', { class: 'pn-note', text: 'Максимальный уровень.' }));
    else if (locked) acts.appendChild(el('div', { class: 'pn-note bad', text: 'Нужно доверие Института: ' + D.TIERS[b.tier].n }));
    else {
      const label = (b.levels && lv ? 'Улучшить: ' + b.levels[lv] : 'Построить') + ' · ' + G.costText(cost);
      const bt = el('button', { class: 'btn primary', html: label, onclick: function () {
        if (G.build(sel)) {
          buildAnim[sel] = performance.now(); plate = null;
          DW.SFX.play('build'); setTimeout(function () { DW.SFX.play('build'); }, 700); setTimeout(function () { DW.SFX.play('build'); }, 1400);
          DW.UI.toast('Строим: ' + (b.levels ? b.levels[lv] : b.n), 'good');
          G.save(); S.refresh();
        }
      } });
      if (!G.canAfford(cost)) bt.disabled = true;
      acts.appendChild(bt);
    }
    p.appendChild(acts);
  }

  DW.BaseS = S;
})(window.DW);
