'use strict';
/* Экран базы: объёмная диорама плацдарма — постройки, жители, день и ночь, стройка */
(function (DW) {
  const U = DW.U, D = DW.D, ART = DW.ART, el = U.el;
  const S = {};
  const HW = 32, HH = 16, N = 10, EDGE = 34, GS = 1.5;
  const O = { hw: HW, hh: HH };
  const P = function (u, v, h) { return [(u - v) * HW, (u + v) * HH - (h || 0)]; };
  let hud = null, plate = null, plateKey = '';
  let people = [], parts = [], buildAnim = {}, sel = null, lastT = 0;
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
    walls: { u: 0.25, v: 0.25, w: 9.5, d: 9.5 }
  };
  const TURRET2 = { u: 4.4, v: 8.5, w: 0.8, d: 0.8 };
  /* Точки, куда ходят жители */
  const WP = {
    hq: [5.6, 6.5], fire: [5.0, 7.6], fire2: [5.7, 7.9], workshop: [3.5, 7.7], farm: [7.0, 6.4], infirmary: [7.6, 3.3],
    tower: [2.6, 2.3], gate: [8.9, 5.0], crates: [3.6, 5.4], beacon: [3.0, 3.2]
  };
  const RING = [[3.4, 3.4], [6.9, 3.6], [6.9, 6.7], [3.4, 6.7]];

  S.enter = function () {
    const st = DW.G.state;
    sel = null; parts = []; buildAnim = {};
    plate = null;
    initPeople(st);
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
  function initPeople(st) {
    people = [];
    const atBase = st.squadAt === st.baseNode;
    const list = atBase ? st.roster.slice(0, 8) : [];
    list.forEach(function (s, i) { people.push(mkPerson(s.look, s.weapon, '#c8691c', i, s.wounds > 0, s.name === 'Мальборо')); });
    if (!atBase || list.length < 3) {
      const n = atBase ? 1 : 3;
      for (let i = 0; i < n; i++) people.push(mkPerson(ART.makeLook(900 + i * 37, { glasses: false }), i === 0 ? 'ppsh' : null, ['#6a6a5a', '#5a4a3a', '#7a6a4a'][i], 20 + i, false, false));
    }
  }
  function mkPerson(look, weapon, body, i, wounded, cig) {
    const w = wpList();
    const start = WP[w[i % w.length]] || WP.hq;
    return { look: look, weapon: weapon, body: body, u: start[0] + (Math.random() - 0.5) * 0.4, v: start[1] + (Math.random() - 0.5) * 0.4, path: [], wait: Math.random() * 3, act: 'stand', wounded: wounded, cig: cig, dir: 1, seed: i };
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
    const st = DW.G.state;
    people.forEach(function (p) {
      if (p.path.length) {
        const tg = p.path[0];
        const dx = tg[0] - p.u, dy = tg[1] - p.v, d = Math.hypot(dx, dy);
        const sp = 0.85 * dt;
        if (d <= sp) { p.u = tg[0]; p.v = tg[1]; p.path.shift(); if (!p.path.length) { p.wait = 3 + Math.random() * 6; } }
        else { p.u += dx / d * sp; p.v += dy / d * sp; }
        const sx = (dx - dy);
        if (Math.abs(sx) > 0.02) p.dir = sx > 0 ? 1 : -1;
        p.act = 'walk';
        return;
      }
      p.wait -= dt;
      if (p.wait > 0) return;
      const l = wpList();
      let k = U.pick(l);
      if (p.wounded && DW.G.blv('infirmary') && Math.random() < 0.7) k = 'infirmary';
      const tg = WP[k];
      const jit = [tg[0] + (Math.random() - 0.5) * 0.5, tg[1] + (Math.random() - 0.5) * 0.5];
      p.path = route([p.u, p.v], jit);
      p.dest = k;
      void st;
    });
  }

  /* ---------- Плита-диорама с землёй ---------- */
  function buildPlate() {
    const st = DW.G.state;
    const key = st.baseNode + '|' + JSON.stringify(st.buildings);
    if (plate && plateKey === key) return;
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

  /* ---------- Постройки ---------- */
  const box = function (g, u0, v0, u1, v1, h0, h1, c) { ART.box(g, u0, v0, u1, v1, h0, h1, c[0], c[1], c[2], O); };
  function faceL(g, u0, v1, h0) { ART.faceL(g, u0, v1, h0, O); }
  function faceR(g, u1, v0, h0) { ART.faceR(g, u1, v0, h0, O); }
  function night() { return nightK; }
  let nightK = 0;
  function windowLit(g, x, y, w, h) {
    g.fillStyle = '#1a1612'; g.fillRect(x, y, w, h);
    if (nightK > 0.05) { g.fillStyle = 'rgba(255,196,110,' + (0.25 + nightK * 0.75) + ')'; g.fillRect(x + 0.02, y + 0.6, w - 0.04, h - 1.2); }
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
  }
  function drawInfirmary(g) {
    const s = SLOT.infirmary, u0 = s.u, v0 = s.v, u1 = s.u + s.w, v1 = s.v + s.d, H = 30, vm = (v0 + v1) / 2;
    const a = P(u0, v1, 0), b = P(u1, v1, 0), c = P(u1, v0, 0), rA = P(u0, vm, H), rB = P(u1, vm, H);
    ART.poly(g, [a, b, rB, rA], '#d8d0bc');
    ART.poly(g, [b, c, rB], '#b0a890');
    g.strokeStyle = 'rgba(0,0,0,0.15)'; g.lineWidth = 0.8;
    for (let k = 1; k < 5; k++) { const p0 = P(u0 + (u1 - u0) * k / 5, v1, 0), p1 = P(u0 + (u1 - u0) * k / 5, vm, H); g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.stroke(); }
    ART.line(g, rA[0], rA[1], rB[0], rB[1], 1.6, '#8a8270');
    const cx = P(u1 - 0.02, (vm + v1) / 2 - 0.1, H * 0.42);
    g.fillStyle = '#c0302a'; g.fillRect(cx[0] - 2, cx[1] - 6, 4, 12); g.fillRect(cx[0] - 6, cx[1] - 2, 12, 4);
    if (nightK > 0.1) { const p = P(u1, (vm + v1) / 2, 6); g.fillStyle = 'rgba(255,220,150,' + nightK * 0.8 + ')'; ART.poly(g, [[p[0] - 4, p[1]], [p[0] + 4, p[1] - 2], [p[0] + 4, p[1] - 12], [p[0] - 4, p[1] - 10]]); }
  }
  function drawWorkshop(g, t) {
    const s = SLOT.workshop, u0 = s.u, v0 = s.v, u1 = s.u + s.w, v1 = s.v + s.d;
    box(g, u0, v0, u1, v1, 0, 24, ['#6a5a48', '#7a5a3a', '#5a4028']);
    g.save(); faceL(g, u0, v1, 0); g.fillStyle = 'rgba(0,0,0,0.25)'; for (let k = 0; k < 10; k++) g.fillRect(k * 0.19, 0, 0.02, 24);
    g.fillStyle = '#1e1610'; g.fillRect(0.5, 0, 0.8, 16); g.fillStyle = 'rgba(255,150,60,' + (0.3 + Math.sin(t / 90) * 0.15) + ')'; g.fillRect(0.55, 1, 0.7, 12); g.restore();
    // наклонная крыша из профлиста
    const a = P(u0 - 0.1, v1 + 0.1, 24), b = P(u1 + 0.1, v1 + 0.1, 24), c = P(u1 + 0.1, v0 - 0.1, 32), d = P(u0 - 0.1, v0 - 0.1, 32);
    ART.poly(g, [a, b, c, d], '#7a8288');
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 0.7;
    for (let k = 1; k < 9; k++) { const p0 = P(u0 + (u1 - u0) * k / 9, v1 + 0.1, 24), p1 = P(u0 + (u1 - u0) * k / 9, v0 - 0.1, 32); g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.stroke(); }
    g.fillStyle = 'rgba(150,70,30,0.35)'; ART.ell(g, (a[0] + c[0]) / 2, (a[1] + c[1]) / 2, 10, 4);
    const ch = P(u0 + 0.4, v0 + 0.4, 30);
    box(g, u0 + 0.25, v0 + 0.25, u0 + 0.55, v0 + 0.55, 26, 46, ['#5a4a40', '#4a3a30', '#3a2a20']);
    if (Math.random() < 0.25) parts.push({ u: u0 + 0.4, v: v0 + 0.4, h: 48, vu: 0.08 + Math.random() * 0.05, vv: -0.02, vh: 12 + Math.random() * 6, t0: t, life: 3500, size: 3, grow: 9, col: '150,140,130', a: 0.35 });
    void ch;
    // наковальня и искры
    const an = P(u1 + 0.35, v1 - 0.3, 0);
    g.fillStyle = '#2a2a2c'; g.fillRect(an[0] - 5, an[1] - 8, 10, 3); g.fillRect(an[0] - 2, an[1] - 5, 4, 5);
    if (Math.random() < 0.06) for (let k = 0; k < 6; k++) parts.push({ u: u1 + 0.35, v: v1 - 0.3, h: 9, vu: (Math.random() - 0.5) * 1.2, vv: (Math.random() - 0.5) * 1.2, vh: 30 + Math.random() * 30, grav: 120, t0: t, life: 500, size: 1.3, col: '255,200,90', a: 1, spark: true });
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
    const gl = 0.5 + Math.sin(t / 300) * 0.4;
    g.fillStyle = 'rgba(111,216,255,' + gl + ')'; ART.circ(g, b[0], b[1], 2.4);
    g.strokeStyle = 'rgba(111,216,255,' + (gl * 0.5) + ')'; g.lineWidth = 1;
    const k2 = (t / 1200) % 1; g.beginPath(); g.ellipse(a[0], a[1] + 2, 8 + k2 * 18, 4 + k2 * 9, 0, 0, 7); g.stroke();
  }
  function drawTurret(g, t, s) {
    const cu = s.u + s.w / 2, cv = s.v + s.d / 2;
    box(g, s.u, s.v, s.u + s.w, s.v + s.d, 0, 10, ['#5e6c74', '#46525a', '#38424a']);
    const p = P(cu, cv, 14), a = Math.sin(t / 2200 + s.u) * 0.9 + 0.3;
    g.fillStyle = '#3a4248'; ART.ell(g, p[0], p[1], 7, 4);
    ART.line(g, p[0], p[1] - 1, p[0] + Math.cos(a) * 16, p[1] - 1 + Math.sin(a) * 6, 3, '#2a3036');
    g.fillStyle = '#ff5a3a'; ART.circ(g, p[0], p[1] - 4, 1.2);
  }
  function drawWalls(g, t, lv, front) {
    const lo = 0.25, hi = N - 0.25;
    const segs = front ? [[lo, hi, hi, hi, 'L'], [hi, lo, hi, hi, 'R']] : [[lo, lo, hi, lo, 'L'], [lo, lo, lo, hi, 'R']];
    segs.forEach(function (sg) {
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
          if (nightK > 0.2 && i % 6 === 3) { const p = P(um, vm, h + 2); g.fillStyle = 'rgba(255,190,90,' + nightK + ')'; ART.circ(g, p[0], p[1], 1.8); }
        } else {
          const p = P(um, vm, 0), h = 20 + ((i * 7) % 5);
          const gr = g.createLinearGradient(p[0] - 3, 0, p[0] + 3, 0); gr.addColorStop(0, '#a07c52'); gr.addColorStop(1, '#4e341c');
          g.fillStyle = gr;
          g.beginPath(); g.moveTo(p[0] - 3, p[1]); g.lineTo(p[0] - 3, p[1] - h); g.lineTo(p[0], p[1] - h - 5); g.lineTo(p[0] + 3, p[1] - h); g.lineTo(p[0] + 3, p[1]); g.closePath(); g.fill();
        }
      }
    });
    if (front) {
      const a = P(hi, 4.4, 0), b = P(hi, 5.8, 0);
      ART.line(g, a[0], a[1], a[0], a[1] - 32, 3, '#4a321a'); ART.line(g, b[0], b[1], b[0], b[1] - 32, 3, '#4a321a');
      ART.line(g, a[0], a[1] - 30, b[0], b[1] - 30, 2.4, '#5a3e22');
    }
  }
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
  function drawBuilding(g, k, t, st) {
    const lv = DW.G.blv(k);
    if (k !== 'hq' && !lv) { drawSlot(g, k, t); return; }
    const ba = buildAnim[k];
    let prog = 1;
    if (ba) { prog = U.clamp((t - ba) / 2200, 0, 1); if (prog >= 1) delete buildAnim[k]; }
    const s = SLOT[k];
    const base = P(s.u + s.w / 2, s.v + s.d, 0);
    if (prog < 1) { g.save(); g.translate(base[0], base[1]); g.scale(1, Math.max(0.05, U.ease(prog))); g.translate(-base[0], -base[1]); }
    switch (k) {
      case 'hq': drawHQ(g, t); break;
      case 'tower': drawTower(g, t, st); break;
      case 'infirmary': drawInfirmary(g, t); break;
      case 'workshop': drawWorkshop(g, t); break;
      case 'farm': drawFarm(g, t); break;
      case 'beacon': drawBeacon(g, t); break;
      case 'turret': drawTurret(g, t, SLOT.turret); if (lv >= 2) drawTurret(g, t, TURRET2); break;
      default: break;
    }
    if (prog < 1) {
      g.restore();
      // леса
      const a = P(s.u - 0.1, s.v + s.d + 0.1, 0), b = P(s.u + s.w + 0.1, s.v + s.d + 0.1, 0), c = P(s.u + s.w + 0.1, s.v - 0.1, 0);
      const H = 40 * (1 - prog * 0.3);
      [a, b, c].forEach(function (p) { ART.line(g, p[0], p[1], p[0], p[1] - H, 1.6, '#8a6a46'); });
      for (let y = 10; y < H; y += 12) { ART.line(g, a[0], a[1] - y, b[0], b[1] - y, 1.2, '#7a5a38'); ART.line(g, b[0], b[1] - y, c[0], c[1] - y, 1.2, '#7a5a38'); }
      if (Math.random() < 0.3) parts.push({ u: s.u + Math.random() * s.w, v: s.v + s.d, h: 2, vu: (Math.random() - 0.5) * 0.4, vv: 0.2, vh: 8, t0: t, life: 900, size: 4, grow: 8, col: '180,160,130', a: 0.45 });
    }
  }
  function countBuilt() { let n = 0; const b = DW.G.state.buildings; for (const k in b) if (b[k]) n++; return n; }
  function drawCamp(g, t, st) {
    // костёр
    const f = P(5.2, 7.4, 0);
    g.fillStyle = 'rgba(0,0,0,0.35)'; ART.ell(g, f[0], f[1] + 1, 12, 5);
    for (let k = 0; k < 7; k++) { const a = k / 7 * 6.28; g.fillStyle = '#6a625a'; ART.circ(g, f[0] + Math.cos(a) * 9, f[1] + Math.sin(a) * 4.5, 2.4); }
    ART.line(g, f[0] - 6, f[1] + 1, f[0] + 6, f[1] - 1, 2.6, '#4a3220'); ART.line(g, f[0] - 6, f[1] - 1, f[0] + 6, f[1] + 1, 2.6, '#3a2616');
    for (let k = 0; k < 3; k++) {
      const h = 11 + Math.sin(t / 90 + k * 2) * 3;
      g.fillStyle = ['rgba(255,120,30,0.9)', 'rgba(255,190,60,0.9)', 'rgba(255,240,160,0.85)'][k];
      g.beginPath(); g.moveTo(f[0] - 5 + k * 2.4, f[1]); g.quadraticCurveTo(f[0] - 2 + k * 2, f[1] - h, f[0] + Math.sin(t / 120 + k) * 1.6, f[1] - h - 4 + k * 2);
      g.quadraticCurveTo(f[0] + 4 - k, f[1] - h * 0.5, f[0] + 5 - k * 2.4, f[1]); g.closePath(); g.fill();
    }
    if (Math.random() < 0.2) parts.push({ u: 5.2, v: 7.4, h: 16, vu: 0.05, vv: -0.03, vh: 14, t0: t, life: 2600, size: 2.5, grow: 7, col: '150,140,130', a: 0.3 });
    if (Math.random() < 0.15) parts.push({ u: 5.2, v: 7.4, h: 10, vu: (Math.random() - 0.5) * 0.3, vv: (Math.random() - 0.5) * 0.3, vh: 30, t0: t, life: 900, size: 1.1, col: '255,190,90', a: 1, spark: true });
    // брёвна-скамейки
    [[4.3, 7.3, 0.5], [5.9, 7.9, -0.5]].forEach(function (b) { const p = P(b[0], b[1], 4); g.save(); g.translate(p[0], p[1]); g.rotate(b[2]); const gr = g.createLinearGradient(0, -4, 0, 4); gr.addColorStop(0, '#8a6a4a'); gr.addColorStop(1, '#3a2a1a'); g.fillStyle = gr; g.fillRect(-11, -3.5, 22, 7); g.fillStyle = '#b08a5c'; ART.ell(g, 11, 0, 1.6, 3.5); g.restore(); });
    // склад: ящики по количеству материалов, патронные ящики
    const nc = Math.min(8, 1 + Math.floor(st.res.materials / 6));
    for (let i = 0; i < nc; i++) { const u = 3.0 + (i % 3) * 0.32, v = 5.0 + Math.floor(i / 3) * 0.34, h0 = i >= 6 ? 12 : 0; box(g, u, v, u + 0.28, v + 0.28, h0, h0 + 12, ['#a07a48', '#86643a', '#5e4424']); }
    const na = Math.min(4, 1 + Math.floor(st.res.ammo / 120));
    for (let i = 0; i < na; i++) { const u = 3.1 + i * 0.3, v = 6.05; box(g, u, v, u + 0.26, v + 0.18, 0, 7, ['#5a6a3a', '#46542c', '#36421e']); }
    // бочка с водой и бельё
    const bp = P(6.6, 3.7, 0); g.fillStyle = '#3e5a6a'; g.fillRect(bp[0] - 5, bp[1] - 13, 10, 13); ART.ell(g, bp[0], bp[1], 5, 2.2); g.fillStyle = '#5a7a8a'; ART.ell(g, bp[0], bp[1] - 13, 5, 2.2);
  }

  /* ---------- Рендер ---------- */
  S.render = function (g, W, H, dpr) {
    const st = DW.G.state;
    const t = performance.now();
    const dt = Math.min(0.05, (t - (lastT || t)) / 1000); lastT = t;
    stepPeople(dt);
    if (cam.tx !== null && cam.tx !== undefined) { cam.x += (cam.tx - cam.x) * Math.min(1, dt * 5); cam.y += (cam.ty - cam.y) * Math.min(1, dt * 5); if (Math.abs(cam.tx - cam.x) < 0.5) cam.tx = null; }
    buildPlate();
    nightK = S.forceNight !== undefined ? S.forceNight : Math.max(0, Math.sin(t / 45000 * Math.PI * 2 - 1)) * 0.85;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, nightK > 0.5 ? '#0c0e18' : '#1e1812'); bg.addColorStop(1, '#070605');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    const z = cam.z;
    g.setTransform(dpr * z, 0, 0, dpr * z, dpr * (W / 2 - cam.x * z), dpr * (H / 2 - cam.y * z));
    g.imageSmoothingEnabled = true;
    g.drawImage(plate, -N * HW, 0, 2 * N * HW, 2 * N * HH + EDGE + 4);
    const wl = DW.G.blv('walls');
    if (wl) drawWalls(g, t, wl, false);
    // по глубине: постройки, лагерь, люди
    const items = [];
    Object.keys(SLOT).forEach(function (k) { if (k === 'walls') return; const s = SLOT[k]; items.push({ d: s.u + s.w + s.v + s.d - 0.4, f: function () { drawBuilding(g, k, t, st); } }); });
    items.push({ d: 5.2 + 7.4, f: function () { drawCamp(g, t, st); } });
    people.forEach(function (p) {
      items.push({ d: p.u + p.v + 0.05, f: function () {
        const c = P(p.u, p.v, 0);
        g.fillStyle = 'rgba(0,0,0,0.3)'; ART.ell(g, c[0], c[1], 9, 4);
        const sit = !p.path.length && (p.dest === 'fire' || p.dest === 'fire2' || (p.dest === 'infirmary' && p.wounded));
        g.save(); g.translate(c[0], c[1]);
        ART.human(g, { look: p.look, body: p.body, weapon: p.weapon, dir: p.dir, aim: sit ? 0.6 : 0.35, walk: p.path.length ? t / 95 + p.seed : null, scale: 0.92, seed: p.seed, cig: p.cig, noShadow: true, pose: sit ? { crouch: 1, low: 0.7 } : (p.dest === 'workshop' && !p.path.length ? { low: Math.abs(Math.sin(t / 300)) * 0.8 } : null) }, t);
        g.restore();
      } });
    });
    items.sort(function (a, b) { return a.d - b.d; });
    items.forEach(function (it) { it.f(); });
    if (wl) drawWalls(g, t, wl, true);
    // частицы (дым, искры, пыль)
    parts = parts.filter(function (p) { return t - p.t0 < p.life; });
    parts.forEach(function (p) {
      const k = (t - p.t0) / p.life, s2 = (t - p.t0) / 1000;
      const h = p.h + p.vh * s2 - (p.grav || 0) * s2 * s2 * 0.5;
      const c = P(p.u + p.vu * s2, p.v + p.vv * s2, h);
      g.fillStyle = 'rgba(' + p.col + ',' + (p.a * (1 - k)) + ')';
      if (p.spark) g.fillRect(c[0], c[1], 1.6, 1.6);
      else { g.beginPath(); g.arc(c[0], c[1], p.size + (p.grow || 0) * k, 0, 7); g.fill(); }
    });
    if (parts.length > 260) parts.splice(0, parts.length - 260);
    // ночь и огни
    if (nightK > 0.02) {
      g.save(); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = 'rgba(12,16,40,' + (nightK * 0.62) + ')'; g.fillRect(0, 0, W, H);
      g.restore();
      g.globalCompositeOperation = 'lighter';
      const glow = function (u, v, h, r, col, a) { const c = P(u, v, h); const gr = g.createRadialGradient(c[0], c[1], 1, c[0], c[1], r); gr.addColorStop(0, 'rgba(' + col + ',' + a + ')'); gr.addColorStop(1, 'rgba(' + col + ',0)'); g.fillStyle = gr; g.beginPath(); g.arc(c[0], c[1], r, 0, 7); g.fill(); };
      const fl = 0.9 + Math.sin(t / 90) * 0.1;
      glow(5.2, 7.4, 8, 110, '255,150,60', 0.55 * nightK * fl);
      glow(5.1, 6.0, 16, 60, '255,190,110', 0.35 * nightK);
      if (DW.G.blv('workshop')) glow(2.1, 8.7, 8, 50, '255,140,60', 0.4 * nightK);
      if (DW.G.blv('farm')) glow(7.9, 7.7, 10, 70, '170,255,200', 0.3 * nightK);
      if (DW.G.blv('beacon')) glow(3.05, 4.25, 54, 40, '111,216,255', 0.6 * nightK);
      if (DW.G.blv('infirmary')) glow(8.9, 2.3, 8, 40, '255,220,150', 0.35 * nightK);
      if (DW.G.blv('tower')) {
        const a = t / 2600, s = SLOT.tower, top = P(s.u + 0.55, s.v + 0.55, 70);
        const ex = top[0] + Math.cos(a) * 260, ey = top[1] + 90 + Math.sin(a) * 120;
        const gr = g.createLinearGradient(top[0], top[1], ex, ey); gr.addColorStop(0, 'rgba(255,250,220,' + 0.35 * nightK + ')'); gr.addColorStop(1, 'rgba(255,250,220,0)');
        g.fillStyle = gr; g.beginPath(); g.moveTo(top[0], top[1]); g.lineTo(ex - 30, ey - 14); g.lineTo(ex + 30, ey + 14); g.closePath(); g.fill();
        const gc = g.createRadialGradient(ex, ey, 2, ex, ey, 46); gc.addColorStop(0, 'rgba(255,250,220,' + 0.3 * nightK + ')'); gc.addColorStop(1, 'rgba(255,250,220,0)');
        g.fillStyle = gc; g.beginPath(); g.ellipse(ex, ey, 46, 22, 0, 0, 7); g.fill();
      }
      g.globalCompositeOperation = 'source-over';
    }
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
    hud.bot.appendChild(btn('squad', 'Отряд', function () { DW.UI.squad(function () { initPeople(DW.G.state); S.refresh(); }); }));
    hud.bot.appendChild(btn('portalbtn', 'Портал', function () { DW.UI.portal(function () { S.refresh(); }); }));
    ui.appendChild(hud.top); ui.appendChild(hud.panel); ui.appendChild(hud.bot);
  }
  S.refresh = function () {
    if (!hud) return;
    const G = DW.G, st = G.state, n = G.node(st.baseNode), ic = D.icon;
    const prod = [];
    if (G.blv('farm')) prod.push('+5 ' + ic('food'));
    if (G.blv('workshop')) prod.push('+15 ' + ic('ammo'));
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
    else if (locked) acts.appendChild(el('div', { class: 'pn-note bad', text: 'Нужно доверие Конторы: ' + D.TIERS[b.tier].n }));
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
