'use strict';
/* Скелетная модель человека в профиль. Углы конечностей отсчитываются от вертикали вниз,
   «+» — вперёд по направлению взгляда. Начало координат — земля под ногами. */
(function () {
  const RIG = window.RIG = {};
  const sin = Math.sin, cos = Math.cos, PI = Math.PI, TAU = PI * 2, max = Math.max;
  const L = { th: 15, sh: 15.5, tor: 21, up: 12, fo: 11.5 };
  const OUT = '#0a0806';
  const eo = t => 1 - (1 - t) * (1 - t), ei = t => t * t, es = t => t * t * (3 - 2 * t);
  const mix = (a, b, t) => a + (b - a) * t;

  function shade(c, k) {
    const n = parseInt(c.slice(1), 16);
    return 'rgb(' + (((n >> 16) & 255) * k | 0) + ',' + (((n >> 8) & 255) * k | 0) + ',' + ((n & 255) * k | 0) + ')';
  }
  RIG.style = function (o) {
    const s = Object.assign({ skin: '#c99d78', hair: '#2a2119', top: '#4b5340', top2: '#5f6850', pants: '#2e3238', boots: '#1a1714', sleeve: null, pack: null,
      cap: null, beard: false, hairStyle: 0, zombie: false, short: false, blood: 0 }, o);
    s.sleeve = s.sleeve || s.top;
    s.f = {}; for (const k of ['skin', 'top', 'pants', 'boots', 'sleeve', 'pack', 'hair']) if (s[k]) s.f[k] = shade(s[k], 0.66);
    return s;
  };
  RIG.white = RIG.style({ skin: '#f4ece2', hair: '#f4ece2', top: '#f4ece2', top2: '#f4ece2', pants: '#f4ece2', boots: '#f4ece2', pack: null });
  RIG.white.white = true;

  /* ---------- Позы ---------- */
  // o: { mv 0..1.3, ph — фаза шага, act, t — прогресс действия 0..1, time, seed, zombie, two, alt }
  RIG.pose = function (o) {
    const mv = o.mv || 0, ph = o.ph || 0, t = o.t || 0, tm = o.time || 0, sd = o.seed || 0, s = sin(ph), c = cos(ph);
    const P = {
      lean: 0.04 + 0.12 * mv, head: 0,
      lN: [0.52 * s * mv, 0.08 + 0.95 * max(0, c) * mv], lF: [-0.52 * s * mv, 0.08 + 0.95 * max(0, -c) * mv],
      aN: [-0.5 * s * mv + 0.07, 0.3 + 0.35 * mv], aF: [0.5 * s * mv + 0.07, 0.3 + 0.35 * mv],
      tool: 0.95, rot: 0, lie: 0
    };
    if (mv < 0.6) { const b = sin(tm * 1.7 + sd) * 0.035 * (1 - mv); P.aN[0] += b; P.aF[0] -= b; P.lean += b * 0.4; P.head = sin(tm * 0.5 + sd) * 0.06; }
    if (o.zombie) {
      P.lean = 0.3 + sin(ph * 0.5) * 0.05; P.head = 0.4 + sin(tm * 1.3 + sd) * 0.12;
      P.lN = [P.lN[0] * 0.7, P.lN[1] * 0.8 + 0.12];
      const w = sin(tm * 2.1 + sd) * 0.13;
      P.aN = [1.2 + w, 0.12]; P.aF = [1.05 - w, 0.2];
    }
    const A = o.act;
    if (A === 'swing') {
      const a0 = P.aN[0], b0 = P.aN[1], l0 = P.lean;
      let a, b, l, tl;
      if (t < 0.38) { const k = eo(t / 0.38); a = mix(a0, -2.5, k); b = mix(b0, 1.3, k); l = mix(l0, -0.12, k); tl = mix(0.95, 0.6, k); }
      else if (t < 0.52) { const k = ei((t - 0.38) / 0.14); a = mix(-2.5, 1.3, k); b = mix(1.3, 0.12, k); l = mix(-0.12, 0.34, k); tl = mix(0.6, 0.05, k); }
      else { const k = es((t - 0.52) / 0.48); a = mix(1.3, a0, k); b = mix(0.12, b0, k); l = mix(0.34, l0, k); tl = mix(0.05, 0.95, k); }
      P.aN = [a, b]; P.lean = l; P.tool = tl;
      if (o.two) P.aF = [a + 0.14, b + 0.18];
      if (o.mv < 0.3) { P.lN = [0.38, 0.32]; P.lF = [-0.34, 0.2]; }
    } else if (A === 'punch') {
      const arm = o.alt ? 'aF' : 'aN', a0 = P[arm][0], b0 = P[arm][1];
      let a, b, l;
      if (t < 0.3) { const k = eo(t / 0.3); a = mix(a0, 0.1, k); b = mix(b0, 2.1, k); l = mix(P.lean, 0.02, k); }
      else if (t < 0.45) { const k = ei((t - 0.3) / 0.15); a = mix(0.1, 1.5, k); b = mix(2.1, 0.05, k); l = mix(0.02, 0.3, k); }
      else { const k = es((t - 0.45) / 0.55); a = mix(1.5, a0, k); b = mix(0.05, b0, k); l = mix(0.3, P.lean, k); }
      P[arm] = [a, b]; P.lean = l;
      const other = o.alt ? 'aN' : 'aF'; P[other] = [0.4, 1.9];
      if (o.mv < 0.3) { P.lN = [0.3, 0.3]; P.lF = [-0.3, 0.22]; }
    } else if (A === 'search') {
      P.lN = [1.15, 2.25]; P.lF = [0.2, 1.75]; P.lean = 0.55 + sin(tm * 2) * 0.04; P.head = 0.25;
      P.aN = [1.0 + 0.3 * sin(tm * 9), 0.55]; P.aF = [0.8 + 0.3 * sin(tm * 9 + 2), 0.7];
    } else if (A === 'hammer') {
      const hp = (tm * 1.7 + sd) % 1, a = hp < 0.65 ? mix(1.15, -0.45, eo(hp / 0.65)) : mix(-0.45, 1.15, ei((hp - 0.65) / 0.35));
      P.lean = 0.22; P.aN = [a, 1.05]; P.aF = [1.0, 0.55]; P.tool = 0.25; P.head = 0.2;
    } else if (A === 'valve') {
      const w = sin(tm * 2.6 + sd);
      P.lean = 0.12; P.aN = [1.45 + 0.25 * w, 0.35 + 0.3 * w]; P.aF = [1.35 - 0.25 * w, 0.4 - 0.3 * w]; P.head = 0.05;
      P.lN = [0.22, 0.2]; P.lF = [-0.22, 0.15];
    } else if (A === 'type') {
      P.lean = 0.2; P.head = 0.18 + sin(tm * 0.7 + sd) * 0.05;
      P.aN = [0.75 + 0.07 * sin(tm * 11 + sd), 1.0]; P.aF = [0.68 + 0.07 * sin(tm * 13 + sd + 1), 1.05];
    } else if (A === 'plant') {
      P.lN = [0.95, 1.75]; P.lF = [0.25, 0.55]; P.lean = 0.45; P.head = 0.2;
      P.aN = [1.05 + 0.18 * sin(tm * 1.6 + sd), 0.35]; P.aF = [0.6, 0.65]; P.tool = 0.6;
    } else if (A === 'climb') {
      const w = sin(ph);
      P.aN = [2.75 + 0.3 * w, -0.45]; P.aF = [2.75 - 0.3 * w, -0.45]; P.lean = 0;
      P.lN = [0.55 + 0.45 * w, 1.3 + 0.3 * w]; P.lF = [0.55 - 0.45 * w, 1.3 - 0.3 * w]; P.head = -0.2;
    } else if (A === 'roll') {
      P.lN = [1.7, 2.6]; P.lF = [1.5, 2.5]; P.aN = [1.3, 1.6]; P.aF = [1.2, 1.6]; P.lean = 0.95; P.head = 0.5; P.rot = t * TAU;
    } else if (A === 'hurt') {
      const k = 1 - t; P.lean -= 0.3 * k; P.head -= 0.3 * k; P.aN = [-0.5 * k + P.aN[0] * t, 0.9]; P.aF = [-0.6 * k + P.aF[0] * t, 0.9];
    } else if (A === 'lunge') {
      let l, a, b;
      if (t < 0.45) { const k = eo(t / 0.45); l = mix(P.lean, 0.0, k); a = mix(P.aN[0], 2.3, k); b = mix(P.aN[1], 0.5, k); }
      else if (t < 0.6) { const k = ei((t - 0.45) / 0.15); l = mix(0.0, 0.65, k); a = mix(2.3, 1.45, k); b = mix(0.5, 0.0, k); }
      else { const k = es((t - 0.6) / 0.4); l = mix(0.65, 0.3, k); a = mix(1.45, 1.2, k); b = mix(0.0, 0.12, k); }
      P.lean = l; P.aN = [a, b]; P.aF = [a - 0.12, b + 0.1]; P.head = 0.2;
      if (t > 0.45 && t < 0.7) { P.lN = [0.5, 0.3]; P.lF = [-0.4, 0.2]; }
    } else if (A === 'sleep' || A === 'dead') {
      P.lie = 1; P.lN = [0.05, 0.1]; P.lF = [0.15, 0.25]; P.aN = [0.15, 0.3]; P.aF = [0.3, 0.6]; P.lean = 0; P.head = A === 'dead' ? 0.4 : 0.1;
      if (A === 'sleep') P.lean = sin(tm * 1.2 + sd) * 0.02;
    } else if (A === 'sit') {
      P.lN = [1.5, 1.5]; P.lF = [1.4, 1.45]; P.lean = 0.08; P.aN = [0.5, 0.9]; P.aF = [0.45, 0.95];
    }
    const h = l => L.th * cos(l[0]) + L.sh * cos(l[0] - l[1]);
    P.hip = (A === 'sit' ? 16 : max(h(P.lN), h(P.lF))) + 2.5;
    return P;
  };

  /* ---------- Оружие и инструменты (вдоль +X от кисти, +Y — сторона лезвия) ---------- */
  RIG.tool = function (x, id) {
    x.lineCap = 'round'; x.lineJoin = 'round';
    const L2 = (a, b, c, d, w, col) => { x.strokeStyle = col; x.lineWidth = w; x.beginPath(); x.moveTo(a, b); x.lineTo(c, d); x.stroke(); };
    if (id === 'pipe') {
      L2(-6, 0, 31, 0, 5.4, OUT); L2(-6, 0, 31, 0, 3.6, '#7a8186'); L2(-5, -0.9, 30, -0.9, 1, '#b9c1c5');
      x.fillStyle = OUT; x.fillRect(26.5, -3.3, 6.5, 6.6); x.fillStyle = '#5c6266'; x.fillRect(27.3, -2.5, 5, 5);
      x.fillStyle = 'rgba(120,52,22,.7)'; x.fillRect(12, -1.8, 4, 3.6);
    } else if (id === 'machete') {
      L2(-6, 0, 5, 0, 5.4, OUT); L2(-6, 0, 5, 0, 3.8, '#2b1d14');
      x.fillStyle = OUT; x.beginPath(); x.moveTo(4, -3.4); x.lineTo(31, -4.6); x.lineTo(37, 0); x.lineTo(32, 4.2); x.lineTo(4, 3.2); x.closePath(); x.fill();
      x.fillStyle = U.lg(x, 0, -4, 0, 4, ['#d8dee2', '#9aa3a9', '#6c757b']); x.beginPath(); x.moveTo(5, -2.6); x.lineTo(30.5, -3.6); x.lineTo(35.6, 0); x.lineTo(31.4, 3.2); x.lineTo(5, 2.3); x.closePath(); x.fill();
      L2(6, 2.3, 31, 3, 0.8, '#f2f5f6'); x.fillStyle = 'rgba(110,50,30,.6)'; x.fillRect(18, -1, 5, 2.5);
    } else if (id === 'bat') {
      x.fillStyle = OUT; x.beginPath(); x.moveTo(-7, -2.4); x.lineTo(30, -4.6); x.arc(30, 0, 4.6, -PI / 2, PI / 2); x.lineTo(-7, 2.4); x.closePath(); x.fill();
      x.fillStyle = U.lg(x, 0, -4, 0, 4, ['#c49a62', '#9a7444', '#6e5030']); x.beginPath(); x.moveTo(-6, -1.5); x.lineTo(30, -3.6); x.arc(30, 0, 3.6, -PI / 2, PI / 2); x.lineTo(-6, 1.5); x.closePath(); x.fill();
      x.fillStyle = '#2a2420'; x.fillRect(-6, -1.6, 7, 3.2);
      x.strokeStyle = '#c9ccc8'; x.lineWidth = 0.9; for (let i = 0; i < 6; i++) { const px = 20 + i * 2.6, s = i % 2 ? 1 : -1; x.beginPath(); x.moveTo(px, s * 3.2); x.lineTo(px + 0.6, s * 7); x.stroke(); }
    } else if (id === 'axe') {
      L2(-8, 0, 33, 0, 5.4, OUT); L2(-8, 0, 33, 0, 3.6, '#a8322a'); L2(-7, -0.8, 32, -0.8, 0.9, '#d8685c'); L2(-8, 0, -1, 0, 3.6, '#262220');
      x.fillStyle = OUT; x.beginPath(); x.moveTo(25, -3.5); x.lineTo(34, -3.5); x.lineTo(37, 11.5); x.lineTo(23.5, 9.5); x.closePath(); x.fill();
      x.beginPath(); x.moveTo(27, -3); x.lineTo(32, -3); x.lineTo(30.5, -11); x.closePath(); x.fill();
      x.fillStyle = U.lg(x, 0, -3, 0, 11, ['#b5bcc1', '#7d868c']); x.beginPath(); x.moveTo(26, -2.6); x.lineTo(33.2, -2.6); x.lineTo(35.6, 10.4); x.lineTo(24.6, 8.7); x.closePath(); x.fill();
      x.fillStyle = '#7d868c'; x.beginPath(); x.moveTo(28, -2.6); x.lineTo(31.4, -2.6); x.lineTo(30.4, -9.4); x.closePath(); x.fill();
      L2(24.8, 8.6, 35.4, 10.2, 1, '#eef2f4');
    } else if (id === 'hammer') {
      L2(-4, 0, 15, 0, 4.4, OUT); L2(-4, 0, 15, 0, 2.8, '#8a6440');
      x.fillStyle = OUT; x.fillRect(12.5, -5.5, 6.5, 11); x.fillStyle = '#5d6468'; x.fillRect(13.3, -4.7, 4.9, 9.4); x.fillStyle = '#9aa2a6'; x.fillRect(13.3, -4.7, 4.9, 1.4);
    } else if (id === 'can') {
      x.fillStyle = OUT; U.rr(x, -1, -7, 14, 11, 3); x.fill(); x.fillStyle = '#4f7a52'; U.rr(x, 0, -6, 12, 9, 2.4); x.fill();
      L2(11, -1, 21, -7, 3.2, OUT); L2(11, -1, 21, -7, 1.8, '#4f7a52'); x.fillStyle = 'rgba(150,200,230,.7)'; x.fillRect(20, -6, 1.5, 1.5);
    }
  };

  /* ---------- Отрисовка ---------- */
  function strokes(x, segs) {
    x.lineCap = 'round'; x.lineJoin = 'round';
    for (const s of segs) { x.strokeStyle = OUT; x.lineWidth = s[4] + 3.4; x.beginPath(); x.moveTo(s[0], s[1]); x.lineTo(s[2], s[3]); x.stroke(); }
    for (const s of segs) { x.strokeStyle = s[5]; x.lineWidth = s[4]; x.beginPath(); x.moveTo(s[0], s[1]); x.lineTo(s[2], s[3]); x.stroke(); }
  }
  // st — стиль, P — поза, face ±1, tool — id предмета в руке
  RIG.draw = function (x, st, P, face, tool) {
    const W = st.white, f = st.f;
    x.save(); x.scale(face, 1);
    if (P.lie) { x.translate(-24, -7); x.rotate(PI / 2); x.translate(0, 0); }
    if (P.rot) { x.translate(0, -P.hip * 0.55); x.rotate(P.rot); x.translate(0, P.hip * 0.55); }
    const hx = 0, hy = -P.hip, sl = sin(P.lean), cl = cos(P.lean);
    const shx = hx + sl * L.tor, shy = hy - cl * L.tor;
    const leg = l => { const kx = hx + sin(l[0]) * L.th, ky = hy + cos(l[0]) * L.th, a2 = l[0] - l[1]; return [kx, ky, kx + sin(a2) * L.sh, ky + cos(a2) * L.sh, a2]; };
    const arm = a => { const sx = shx - sl * 2.8 - 0.5, sy = shy + cl * 2.8, ex = sx + sin(a[0]) * L.up, ey = sy + cos(a[0]) * L.up, a2 = a[0] + a[1]; return [sx, sy, ex, ey, ex + sin(a2) * L.fo, ey + cos(a2) * L.fo, a2]; };
    const boot = (p, col) => {
      const fx = p[2], fy = p[3], ta = (p[4]) * 0.25;
      x.save(); x.translate(fx, fy); x.rotate(-ta);
      x.fillStyle = OUT; x.beginPath(); x.moveTo(-3.6, -4.2); x.lineTo(2.6, -4.2); x.quadraticCurveTo(9, -2.6, 9.4, 1); x.lineTo(9.4, 3.6); x.lineTo(-3.8, 3.6); x.closePath(); x.fill();
      x.fillStyle = col; x.beginPath(); x.moveTo(-2.6, -3.2); x.lineTo(2.2, -3.2); x.quadraticCurveTo(8, -1.8, 8.2, 1.2); x.lineTo(8.2, 2.6); x.lineTo(-2.8, 2.6); x.closePath(); x.fill();
      if (!W) { x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(-2.8, 1.4, 11, 1.2); }
      x.restore();
    };
    const drawLeg = (l, far) => {
      const p = leg(l), pc = far ? f.pants : st.pants;
      strokes(x, [[hx, hy, p[0], p[1], 7, pc], [p[0], p[1], p[2], p[3] - 1.5, 5.8, pc]]);
      if (!W && !far) { x.strokeStyle = 'rgba(255,255,255,.08)'; x.lineWidth = 2; x.beginPath(); x.moveTo(hx - 1, hy); x.lineTo(p[0] - 1, p[1]); x.stroke(); }
      boot(p, far ? f.boots : st.boots);
    };
    const drawArm = (a, far, isTool) => {
      const p = arm(a), sc = far ? f.sleeve : st.sleeve, fc = st.short ? (far ? f.skin : st.skin) : sc;
      strokes(x, [[p[0], p[1], p[2], p[3], 5.6, sc], [p[2], p[3], p[4], p[5], 4.8, fc]]);
      if (isTool && tool) { x.save(); x.translate(p[4], p[5]); x.rotate(PI / 2 - (p[6] + P.tool)); RIG.tool(x, tool); x.restore(); }
      x.fillStyle = OUT; x.beginPath(); x.arc(p[4], p[5], 3.9, 0, TAU); x.fill();
      x.fillStyle = far ? f.skin : st.skin; x.beginPath(); x.arc(p[4], p[5], 2.5, 0, TAU); x.fill();
      return p;
    };
    // дальние конечности
    const twoHand = tool && (tool === 'axe' || tool === 'bat');
    drawArm(P.aF, true, false);
    drawLeg(P.lF, true);
    // рюкзак
    x.save(); x.translate(hx, hy); x.rotate(P.lean);
    if (st.pack) {
      x.fillStyle = OUT; U.rr(x, -14.6, -22, 10.6, 19, 3.6); x.fill();
      x.fillStyle = st.pack; U.rr(x, -13.6, -21, 8.6, 17, 3); x.fill();
      x.fillStyle = 'rgba(0,0,0,.28)'; x.fillRect(-13.6, -12, 8.6, 1.4); x.fillStyle = 'rgba(255,255,255,.1)'; x.fillRect(-12.6, -20, 1.6, 15);
      x.fillStyle = OUT; x.beginPath(); x.ellipse(-9.4, -23.4, 6.2, 3.2, 0, 0, TAU); x.fill(); x.fillStyle = W ? st.pack : '#5c6343'; x.beginPath(); x.ellipse(-9.4, -23.4, 5.2, 2.3, 0, 0, TAU); x.fill();
    }
    x.restore();
    drawLeg(P.lN, false);
    // торс
    x.save(); x.translate(hx, hy); x.rotate(P.lean);
    x.beginPath(); x.moveTo(-5.6, 1.5); x.lineTo(5, 1.5); x.quadraticCurveTo(7.4, -9, 6.6, -15); x.quadraticCurveTo(6.2, -21.4, 3, -22.8);
    x.lineTo(-4.2, -22.8); x.quadraticCurveTo(-7.8, -20, -7.2, -12); x.quadraticCurveTo(-7, -4, -5.6, 1.5); x.closePath();
    x.strokeStyle = OUT; x.lineWidth = 3.4; x.stroke();
    x.fillStyle = st.top; x.fill();
    if (!W) { x.save(); x.clip(); x.fillStyle = f.top; x.fillRect(-9, -26, 5.6, 30); x.fillStyle = st.top2; x.fillRect(2.6, -24, 6, 23); x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(4.6, -20, 1.2, 14); x.restore(); }
    if (!W) {
      x.fillStyle = st.pants; x.fillRect(-5.8, -2.4, 11, 3.8);
      x.fillStyle = '#1b1915'; x.fillRect(-6, -3.6, 11.6, 1.6); x.fillStyle = '#8a8270'; x.fillRect(3, -3.7, 2, 1.8);
      if (st.zombie) {
        x.fillStyle = 'rgba(96,14,10,.85)'; x.beginPath(); x.ellipse(2.5, -11, 3.6, 5, 0.3, 0, TAU); x.fill(); x.beginPath(); x.ellipse(-3, -17, 2.4, 2, 0, 0, TAU); x.fill();
        x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(-4, -8, 5, 1.2); x.fillRect(1, -20, 3, 1);
        x.fillStyle = OUT; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(-5 + i * 2.8, -2); x.lineTo(-3.6 + i * 2.8, 0.8); x.lineTo(-2.2 + i * 2.8, -2); x.fill(); }
      } else {
        x.strokeStyle = 'rgba(0,0,0,.45)'; x.lineWidth = 0.9; x.beginPath(); x.moveTo(4.4, -4); x.lineTo(5.6, -21); x.stroke();
        x.fillStyle = 'rgba(0,0,0,.22)'; x.fillRect(-1, -12, 5, 4); x.fillStyle = 'rgba(255,255,255,.07)'; x.fillRect(-1, -12, 5, 1);
        if (st.pack) { x.strokeStyle = '#1e1b16'; x.lineWidth = 1.8; x.beginPath(); x.moveTo(-3.5, -22.5); x.quadraticCurveTo(2, -16, 1.5, -7); x.stroke(); }
        if (st.scarf) { x.fillStyle = OUT; U.rr(x, -5.4, -25.2, 11, 5, 2.4); x.fill(); x.fillStyle = st.scarf; U.rr(x, -4.6, -24.4, 9.4, 3.4, 1.7); x.fill(); }
      }
    }
    x.restore();
    // голова
    const ha = P.lean * 0.6 + P.head, hcx = shx + sin(P.lean + P.head * 0.6) * 8.6 + 1, hcy = shy - cos(P.lean + P.head * 0.6) * 8.6;
    strokes(x, [[shx + 0.6, shy + 1.5, hcx - 0.8, hcy + 3.5, 4.4, st.skin]]);
    x.save(); x.translate(hcx, hcy); x.rotate(ha);
    x.fillStyle = OUT; x.beginPath(); x.arc(0, 0, 8.7, 0, TAU); x.fill();
    x.beginPath(); x.moveTo(5, 3); x.quadraticCurveTo(6.4, 6.8, 2.6, 8); x.lineTo(0, 6); x.fill();
    x.fillStyle = st.skin; x.beginPath(); x.arc(0, 0, 7, 0, TAU); x.fill();
    x.beginPath(); x.moveTo(4.6, 2.6); x.quadraticCurveTo(5.6, 6, 2.6, 6.8); x.lineTo(0.4, 5); x.fill();
    x.beginPath(); x.moveTo(6.4, -2); x.lineTo(8.7, 1.4); x.lineTo(6.4, 2.4); x.closePath(); x.fill();
    if (!W) {
      x.fillStyle = f.skin; x.beginPath(); x.arc(-0.6, 0.6, 7, 1.0, 3.9); x.closePath(); x.fill();
      x.fillStyle = f.skin; x.beginPath(); x.ellipse(-1.4, 0.6, 1.6, 2.3, 0, 0, TAU); x.fill();
      if (st.zombie) {
        x.fillStyle = 'rgba(30,10,10,.75)'; x.beginPath(); x.ellipse(3.8, -1.2, 2.1, 1.7, 0, 0, TAU); x.fill();
        x.fillStyle = '#e8e2b8'; x.beginPath(); x.arc(4.2, -1.1, 0.95, 0, TAU); x.fill();
        x.fillStyle = '#1a0a08'; x.beginPath(); x.moveTo(3, 3.8); x.lineTo(7, 3.4); x.lineTo(5.6, 6.2); x.closePath(); x.fill();
        x.fillStyle = 'rgba(110,16,12,.9)'; x.beginPath(); x.ellipse(4.6, 6.8, 2, 1.4, 0, 0, TAU); x.fill();
        if (st.hairStyle !== 2) { x.fillStyle = st.hair; x.beginPath(); x.arc(-0.6, -0.4, 7.4, PI * 1.02, PI * 1.62); x.lineTo(-1, -1); x.fill(); }
      } else {
        x.fillStyle = '#1a1410'; x.beginPath(); x.arc(3.9, -1.2, 0.95, 0, TAU); x.fill();
        x.strokeStyle = 'rgba(30,20,14,.7)'; x.lineWidth = 1.1; x.beginPath(); x.moveTo(2.6, -3.2); x.lineTo(5.6, -3.3); x.stroke();
        x.strokeStyle = 'rgba(90,40,30,.5)'; x.lineWidth = 0.9; x.beginPath(); x.moveTo(4, 3.6); x.lineTo(6, 3.4); x.stroke();
        if (st.beard) { x.fillStyle = st.hair; x.beginPath(); x.moveTo(-1.6, 2); x.quadraticCurveTo(0, 8.6, 3.4, 8); x.quadraticCurveTo(6.8, 6.8, 6.4, 3.8); x.lineTo(4.4, 4.6); x.lineTo(1.6, 3); x.closePath(); x.fill(); }
        x.fillStyle = st.hair;
        if (st.hairStyle === 1) { x.beginPath(); x.arc(-0.2, -0.6, 7.6, PI * 0.82, PI * 1.98); x.lineTo(-2, 3); x.quadraticCurveTo(-7, 9, -9.2, 10); x.quadraticCurveTo(-9, 2, -7.4, 0); x.fill(); }
        else if (st.hairStyle === 2) { x.globalAlpha = 0.55; x.beginPath(); x.arc(-0.4, -0.5, 7.2, PI * 0.95, PI * 1.92); x.lineTo(0, 0); x.fill(); x.globalAlpha = 1; }
        else { x.beginPath(); x.arc(-0.4, -0.6, 7.6, PI * 0.9, PI * 1.98); x.lineTo(1, -3); x.quadraticCurveTo(-3, -1.6, -5.6, 2.4); x.closePath(); x.fill(); }
        if (st.cap) {
          x.fillStyle = OUT; x.beginPath(); x.arc(0, -1.2, 8.3, PI * 1.02, PI * 1.98); x.closePath(); x.fill(); x.fillRect(2, -4.2, 10.2, 2.8);
          x.fillStyle = st.cap; x.beginPath(); x.arc(0, -1.4, 7.5, PI * 1.04, PI * 1.96); x.closePath(); x.fill(); x.fillRect(2.4, -3.6, 9.2, 1.8);
          x.fillStyle = 'rgba(255,255,255,.12)'; x.beginPath(); x.arc(-0.5, -2.4, 5.6, PI * 1.2, PI * 1.6); x.lineTo(-0.5, -2.4); x.fill();
        }
      }
    }
    x.restore();
    // ближняя рука с предметом
    const pN = drawArm(P.aN, false, true);
    if (twoHand) { x.fillStyle = OUT; const d = PI / 2 - (pN[6] + P.tool), hx2 = pN[4] + Math.cos(d) * 8, hy2 = pN[5] + Math.sin(d) * 8; x.beginPath(); x.arc(hx2, hy2, 3.2, 0, TAU); x.fill(); x.fillStyle = f.skin; x.beginPath(); x.arc(hx2, hy2, 2.3, 0, TAU); x.fill(); }
    x.restore();
  };

  // точка конца оружия — для следа удара
  RIG.tip = function (P, face, reach) {
    const sl = sin(P.lean), cl = cos(P.lean), shx = sl * L.tor, shy = -P.hip - cl * L.tor;
    const a = P.aN, sx = shx - sl * 2.8, sy = shy + cl * 2.8, ex = sx + sin(a[0]) * L.up, ey = sy + cos(a[0]) * L.up, a2 = a[0] + a[1];
    const hx = ex + sin(a2) * L.fo, hy = ey + cos(a2) * L.fo, d = a2 + P.tool;
    return [(hx + sin(d) * reach) * face, hy + cos(d) * reach];
  };
})();
