'use strict';
// ---------- 2.5D-персонажи: детальные воксельные модели, отрисованные в спрайты ----------
// Фигура собирается из капсул в мелкой воксельной сетке (VRES вокселей на базовую единицу),
// получает сглаженные нормали, мягкое затенение и блики, затем рисуется под углом камеры
// сверху-сбоку в 8 направлениях. Модели и спрайты кешируются с ограничением по памяти.

const VRES = 2;
const VX = { W: 32, D: 40, H: 54, O: 16, OD: 20, E: (52 * Math.PI) / 180 };
VX.sE = Math.sin(VX.E); VX.cE = Math.cos(VX.E);
VX.GW = VX.W * VRES; VX.GD = VX.D * VRES; VX.GH = VX.H * VRES;
const VSCALE = 0.05;   // доля клетки на экране на одну базовую единицу
const VREACH = 25.6;   // радиус модели в плане (с учётом лежащих тел)
const LIGHT = (() => { const v = [-0.6, 0.1, 0.78], l = Math.hypot(...v); return v.map(x => x / l); })();
const HALFV = (() => { const v = [LIGHT[0], LIGHT[1] + VX.cE, LIGHT[2] + VX.sE], l = Math.hypot(...v); return v.map(x => x / l); })();
const YAWS = Array.from({ length: 8 }, (_, d) => { const a = (d * Math.PI) / 4; return Math.atan2(-Math.cos(a), Math.sin(a)); });
function dirIdx(dx, dy) { return ((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8; }

// Индексы палитры
const C = {
  SKIN: 1, HAIR: 2, TOP: 3, TOP2: 4, PANTS: 5, BOOTS: 6, PACK: 7, METAL: 8, WOOD: 9, EYE: 10, BLOOD: 11, MOUTH: 12,
  BELT: 13, SKIN2: 14, STRIPE: 15, SOLE: 16, BONE: 17, CAP: 18, VEST: 19, ROLL: 20, GLOVE: 21, SCLERA: 22, BLADE: 23, TAPE: 24, RED: 25, GLASS: 26,
};
// Свойства материалов: [сила блика, острота блика, шум ткани]
const MATP = [];
for (let i = 0; i < 32; i++) MATP[i] = [0, 1, 0.05];
MATP[C.SKIN] = [0.07, 10, 0.025]; MATP[C.SKIN2] = [0.05, 10, 0.05]; MATP[C.HAIR] = [0.08, 12, 0.12];
MATP[C.METAL] = [0.55, 22, 0.02]; MATP[C.BLADE] = [0.85, 30, 0.01]; MATP[C.EYE] = [0.5, 28, 0]; MATP[C.SCLERA] = [0.2, 16, 0];
MATP[C.BLOOD] = [0.35, 16, 0.1]; MATP[C.GLASS] = [0.9, 40, 0]; MATP[C.BOOTS] = [0.18, 12, 0.04]; MATP[C.SOLE] = [0, 1, 0.02];
MATP[C.WOOD] = [0.05, 6, 0.12]; MATP[C.STRIPE] = [0.35, 10, 0.02]; MATP[C.CAP] = [0.28, 14, 0.03]; MATP[C.BELT] = [0.12, 10, 0.04];
MATP[C.TAPE] = [0.05, 8, 0.08]; MATP[C.RED] = [0.3, 16, 0.03]; MATP[C.BONE] = [0.12, 10, 0.05]; MATP[C.MOUTH] = [0.15, 14, 0];
const hexRgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mixRgb = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

// ----- векторы -----
const sinD = a => Math.sin((a * Math.PI) / 180), cosD = a => Math.cos((a * Math.PI) / 180);
const vadd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const vmul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const vnorm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const vdown = (a, L) => [0, L * sinD(a), -L * cosD(a)];
const vup = (a, L) => [0, L * sinD(a), L * cosD(a)];
function vpitch(v, deg) {
  const a = Math.atan2(v[1], -v[2]) + (deg * Math.PI) / 180, m = Math.hypot(v[1], v[2]);
  return [v[0], m * Math.sin(a), -m * Math.cos(a)];
}
function armDir(side, p, s, L) { const cs = cosD(s); return [side * L * sinD(s), L * sinD(p) * cs, -L * cosD(p) * cs]; }
function hash3(x, y, z) {
  let h = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ----- сетка -----
const GRID = new Uint8Array(VX.GW * VX.GD * VX.GH), GRID2 = new Uint8Array(VX.GW * VX.GD * VX.GH);
const BB = [0, 0, 0, 0, 0, 0];
function bbReset() { BB[0] = BB[1] = BB[2] = 1e9; BB[3] = BB[4] = BB[5] = -1; }
const gidx = (x, y, z) => (z * VX.GD + y) * VX.GW + x;
// Капсула от a до b радиуса r (базовые единицы). only: не задан — красить всё; -1 — только занятые клетки; иначе — только этот цвет
function vcap(g, a, b, r, c, sx = 1, sy = 1, only) {
  const pr = r * Math.max(sx, sy) + 0.6, R2 = VRES;
  const x0 = Math.max(0, Math.floor((Math.min(a[0], b[0]) - pr + VX.O) * R2)), x1 = Math.min(VX.GW - 1, Math.ceil((Math.max(a[0], b[0]) + pr + VX.O) * R2));
  const y0 = Math.max(0, Math.floor((Math.min(a[1], b[1]) - pr + VX.OD) * R2)), y1 = Math.min(VX.GD - 1, Math.ceil((Math.max(a[1], b[1]) + pr + VX.OD) * R2));
  const z0 = Math.max(0, Math.floor((Math.min(a[2], b[2]) - pr) * R2)), z1 = Math.min(VX.GH - 1, Math.ceil((Math.max(a[2], b[2]) + pr) * R2));
  const ex = b[0] - a[0], ey = b[1] - a[1], ez = b[2] - a[2], L2 = ex * ex + ey * ey + ez * ez || 1e-6, r2 = r * r, inv = 1 / R2;
  for (let z = z0; z <= z1; z++) {
    const pz = (z + 0.5) * inv;
    for (let y = y0; y <= y1; y++) {
      const py = (y + 0.5) * inv - VX.OD;
      let i = gidx(x0, y, z);
      for (let x = x0; x <= x1; x++, i++) {
        const px = (x + 0.5) * inv - VX.O;
        let t = ((px - a[0]) * ex + (py - a[1]) * ey + (pz - a[2]) * ez) / L2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const dx = (px - a[0] - ex * t) / sx, dy = (py - a[1] - ey * t) / sy, dz = pz - a[2] - ez * t;
        if (dx * dx + dy * dy + dz * dz > r2) continue;
        if (only !== undefined && (only === -1 ? !g[i] : g[i] !== only)) continue;
        g[i] = c;
        if (c) {
          if (x < BB[0]) BB[0] = x; if (y < BB[1]) BB[1] = y; if (z < BB[2]) BB[2] = z;
          if (x > BB[3]) BB[3] = x; if (y > BB[4]) BB[4] = y; if (z > BB[5]) BB[5] = z;
        }
      }
    }
  }
}
function vbox(g, a, b, c, only) {
  const lo = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])], hi = [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])];
  const x0 = Math.max(0, Math.floor((lo[0] + VX.O) * VRES)), x1 = Math.min(VX.GW - 1, Math.ceil((hi[0] + VX.O) * VRES));
  const y0 = Math.max(0, Math.floor((lo[1] + VX.OD) * VRES)), y1 = Math.min(VX.GD - 1, Math.ceil((hi[1] + VX.OD) * VRES));
  const z0 = Math.max(0, Math.floor(lo[2] * VRES)), z1 = Math.min(VX.GH - 1, Math.ceil(hi[2] * VRES));
  for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const px = (x + 0.5) / VRES - VX.O, py = (y + 0.5) / VRES - VX.OD, pz = (z + 0.5) / VRES;
    if (px < lo[0] || px > hi[0] || py < lo[1] || py > hi[1] || pz < lo[2] || pz > hi[2]) continue;
    const i = gidx(x, y, z);
    if (only !== undefined && (only === -1 ? !g[i] : g[i] !== only)) continue;
    g[i] = c;
    if (c) {
      if (x < BB[0]) BB[0] = x; if (y < BB[1]) BB[1] = y; if (z < BB[2]) BB[2] = z;
      if (x > BB[3]) BB[3] = x; if (y > BB[4]) BB[4] = y; if (z > BB[5]) BB[5] = z;
    }
  }
}
const vdot = (g, p, c, r = 0.5, only) => vcap(g, p, p, r, c, 1, 1, only);

// ----- пропорции -----
const BODY = {
  man: { hipW: 2.1, legR: 1.75, thigh: 7.6, shin: 7.4, torso: 10, tR: 3.1, sx: 1.32, sy: 0.8, sh: 4.5, armR: 1.35, upper: 6, fore: 5.6, head: 3.0 },
  woman: { hipW: 2.05, legR: 1.65, thigh: 7.4, shin: 7.2, torso: 9.4, tR: 2.85, sx: 1.3, sy: 0.82, sh: 4.0, armR: 1.2, upper: 5.7, fore: 5.3, head: 2.9 },
  bulky: { hipW: 2.4, legR: 2.0, thigh: 7.6, shin: 7.4, torso: 10.4, tR: 3.5, sx: 1.33, sy: 0.84, sh: 5.1, armR: 1.6, upper: 6, fore: 5.6, head: 3.0 },
  runner: { hipW: 1.9, legR: 1.5, thigh: 7.8, shin: 7.6, torso: 9.8, tR: 2.7, sx: 1.3, sy: 0.8, sh: 4.0, armR: 1.15, upper: 6.2, fore: 5.8, head: 2.8 },
  brute: { hipW: 2.9, legR: 2.5, thigh: 8, shin: 7.6, torso: 11.2, tR: 4.4, sx: 1.32, sy: 0.9, sh: 6.3, armR: 2.1, upper: 6.6, fore: 6.4, head: 2.9 },
};

// ----- облик -----
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const SKINS = ['#d2a07c', '#b07c5c', '#e3b896', '#8c5d40', '#c4916c'];
const HAIRS = ['#2a1f17', '#5a3a22', '#1b1a18', '#a37a45', '#7d7366', '#6b2f1c'];
function basePal() {
  const pal = [];
  pal[C.METAL] = hexRgb('#5d6268'); pal[C.WOOD] = hexRgb('#7d5634'); pal[C.BELT] = hexRgb('#2c2620');
  pal[C.BLOOD] = hexRgb('#6e1a14'); pal[C.MOUTH] = hexRgb('#2e1210'); pal[C.SOLE] = hexRgb('#16130f');
  pal[C.BONE] = hexRgb('#d9d2bd'); pal[C.ROLL] = hexRgb('#5a6a48'); pal[C.GLOVE] = hexRgb('#2c2722');
  pal[C.SCLERA] = hexRgb('#e8e2d4'); pal[C.BLADE] = hexRgb('#c6ccd1'); pal[C.TAPE] = hexRgb('#1f1e1c');
  pal[C.RED] = hexRgb('#a8322a'); pal[C.GLASS] = hexRgb('#7fb6d6'); pal[C.STRIPE] = hexRgb('#e4e0b0');
  return pal;
}
function lookSurvivor(s) {
  const h = hashStr(s.name + s.id), fem = s.g === 'f';
  const top = mixRgb(hexRgb(s.color), [60, 60, 48], 0.28);
  const old = s.name === 'Семёныч';
  const pal = basePal();
  pal[C.SKIN] = hexRgb(SKINS[h % SKINS.length]);
  pal[C.SKIN2] = mixRgb(pal[C.SKIN], [60, 30, 20], 0.25);
  pal[C.HAIR] = hexRgb(old ? '#9a958a' : HAIRS[(h >>> 3) % HAIRS.length]);
  pal[C.TOP] = top;
  pal[C.TOP2] = mixRgb(top, [20, 20, 16], 0.45);
  pal[C.PANTS] = hexRgb(['#3d4452', '#4a4636', '#3a3a34', '#4b3f33'][(h >>> 5) % 4]);
  pal[C.BOOTS] = hexRgb(['#3a2c1e', '#2a241c', '#4a3a28'][(h >>> 9) % 3]);
  pal[C.PACK] = hexRgb(['#4d5a3c', '#5a4c38', '#3e4a52'][(h >>> 7) % 3]);
  pal[C.EYE] = hexRgb('#2a1e16');
  pal[C.CAP] = hexRgb(s.trait === 'hunter' ? '#5a5f3a' : ['#7a2f2a', '#2f3f5a', '#4a4a40', '#6a5a3a'][(h >>> 11) % 4]);
  pal[C.VEST] = hexRgb(s.trait === 'hunter' ? '#c8622a' : s.trait === 'tough' ? '#3a3f48' : '#3d4532');
  const hairStyle = old ? 5 : fem ? [2, 3, 1, 4][(h >>> 13) % 4] : [0, 1, 4, 5, 1][(h >>> 13) % 5];
  const body = fem ? BODY.woman : s.trait === 'strong' || s.trait === 'tough' ? BODY.bulky : BODY.man;
  return {
    kind: 'h', key: `h${s.id}${s.color}${s.melee}${s.ranged || ''}${s.g}`, pal, body, female: fem,
    melee: s.melee, ranged: s.ranged, hairStyle, beard: old || (!fem && (h >>> 15) % 4 === 0),
    vest: ['hunter', 'marksman', 'tough'].includes(s.trait), knee: ['quick', 'marksman', 'tough'].includes(s.trait),
    gloves: ['strong', 'mechanic', 'tough'].includes(s.trait) || (h >>> 17) % 3 === 0, rolled: s.trait === 'strong', pads: s.trait === 'tough' || s.trait === 'strong',
  };
}
const ZPAL = {
  walker: [['#5a5f6e', '#3a3a38'], ['#6e5a4a', '#33363b'], ['#4f5f4a', '#40372f']],
  runner: [['#7d2a22', '#2f3136'], ['#3f4f6a', '#2b2b2b'], ['#6a6a62', '#3a3328']],
  screamer: [['#8fa6b0', '#8fa6b0'], ['#b6aca0', '#57504a'], ['#8a6f86', '#3a3a38']],
  brute: [['#c66a2a', '#3a3f4a'], ['#4a5a3a', '#2f2f2f'], ['#5a5048', '#38342c']],
};
function lookZombie(z) {
  const v = z.id % 3, pz = ZPAL[z.type][v], pal = basePal();
  const skin = hexRgb(['#8b977a', '#7f8c6c', '#949a80'][v]);
  pal[C.SKIN] = skin;
  pal[C.SKIN2] = mixRgb(skin, [70, 30, 30], 0.38);
  pal[C.HAIR] = hexRgb(['#2a2620', '#4a4034', '#1c1b18'][v]);
  pal[C.TOP] = hexRgb(pz[0]);
  pal[C.TOP2] = mixRgb(pal[C.TOP], [0, 0, 0], 0.35);
  pal[C.PANTS] = hexRgb(pz[1]);
  pal[C.BOOTS] = hexRgb('#2a2520');
  pal[C.PACK] = pal[C.TOP2];
  pal[C.EYE] = hexRgb('#f2e7a2');
  pal[C.CAP] = hexRgb('#d9a62b');
  pal[C.VEST] = pal[C.TOP];
  const body = { walker: BODY.man, runner: BODY.runner, screamer: BODY.woman, brute: BODY.brute }[z.type];
  return {
    kind: 'z', type: z.type, key: `z${z.type}${v}`, pal, body, v, seed: v * 977 + 13, glow: true,
    hairStyle: z.type === 'screamer' ? 2 : 0, hood: z.type === 'runner' && v !== 2, hardhat: z.type === 'brute' && v === 0,
    ribs: z.type === 'walker' && v === 1, barefoot: z.type === 'walker' && v === 2 ? -1 : 0, gown: z.type === 'screamer' && v === 0,
  };
}

// ----- позы -----
function humanPose(L, fr) {
  const long = L.ranged === 'shotgun' || L.ranged === 'rifle', pistol = L.ranged === 'pistol';
  const p = {
    bob: 0, lean: 3, tilt: 0, head: 0, legL: 0, legR: 0, kneeL: 4, kneeR: 4,
    armL: { p: 8, s: 9, e: 16 }, armR: { p: 8, s: 9, e: 16 }, hold: L.ranged ? 'gun' : 'melee', mw: 75, aim: false,
  };
  if (long) { p.armR = { p: 22, s: 6, e: 72 }; p.armL = { p: 42, s: -10, e: 58 }; }
  else if (pistol) p.armR = { p: 16, s: 8, e: 40 };
  if (fr === 'i1') { p.bob = -0.5; p.head = 4; p.armL.p += 3; }
  if (fr[0] === 'w') {
    const ph = (+fr[1] * Math.PI) / 3, sw = 26 * Math.sin(ph);
    p.legL = sw; p.legR = -sw;
    p.kneeL = 6 + 32 * Math.max(0, Math.cos(ph)); p.kneeR = 6 + 32 * Math.max(0, -Math.cos(ph));
    p.bob = 0.7 * Math.abs(Math.cos(ph)) - 0.35;
    p.lean = 8;
    if (!long) { p.armL.p = 10 - sw * 0.9; if (!pistol) p.armR.p = 10 + sw * 0.9; }
  }
  if (fr === 'aim') {
    p.aim = true; p.lean = 4; p.legL = 14; p.legR = -10; p.kneeR = 14;
    if (long) { p.armR = { p: 58, s: 10, e: 62 }; p.armL = { p: 82, s: -26, e: 16 }; }
    else { p.armR = { p: 86, s: -8, e: 2 }; p.armL = { p: 78, s: -26, e: 16 }; }
  }
  if (fr === 'a0') { p.hold = 'melee'; p.armR = { p: 165, s: 22, e: 28 }; p.armL = { p: 30, s: 16, e: 30 }; p.lean = -5; p.legL = 14; p.legR = -12; p.mw = 10; }
  if (fr === 'a1') { p.hold = 'melee'; p.armR = { p: 68, s: 4, e: 6 }; p.armL = { p: -10, s: 18, e: 20 }; p.lean = 16; p.legL = 24; p.legR = -18; p.kneeR = 22; p.mw = 15; }
  if (fr === 'hit' || fr[0] === 'd') { p.lean = -14; p.head = -16; p.armL = { p: 35, s: 40, e: 30 }; p.armR = { p: 30, s: 38, e: 30 }; p.legL = 10; p.legR = -6; p.kneeL = 18; p.kneeR = 18; p.bob = -0.6; }
  return p;
}
function zombiePose(L, fr) {
  const t = L.type;
  const p = {
    bob: 0, lean: { walker: 16, runner: 24, brute: 10, screamer: 4 }[t], tilt: 0, head: { walker: 12, runner: 8, brute: 16, screamer: -22 }[t],
    legL: 0, legR: 0, kneeL: 10, kneeR: 8, armL: { p: 55, s: 10, e: 25 }, armR: { p: 32, s: 14, e: 22 },
  };
  if (t === 'screamer') { p.armL = { p: 10, s: 20, e: 8 }; p.armR = { p: 10, s: 20, e: 8 }; }
  if (t === 'brute') { p.armL = { p: 22, s: 20, e: 30 }; p.armR = { p: 26, s: 20, e: 34 }; }
  if (fr === 'i0') p.tilt = -0.6;
  if (fr === 'i1') { p.tilt = 0.7; p.bob = -0.5; p.armL.p += 10; p.head += 5; }
  if (fr[0] === 'w') {
    const ph = (+fr[1] * Math.PI) / 3, A = t === 'runner' ? 32 : t === 'brute' ? 16 : 20, sw = A * Math.sin(ph);
    p.legL = sw; p.legR = -sw * 0.8;
    p.kneeL = 8 + 26 * Math.max(0, Math.cos(ph)); p.kneeR = 8 + 18 * Math.max(0, -Math.cos(ph));
    p.bob = 0.6 * Math.abs(Math.cos(ph)) - 0.3;
    p.tilt = 0.7 * Math.sin(ph);
    if (t === 'walker' || t === 'runner') { p.armL = { p: 82 + sw * 0.3, s: 8, e: 8 }; p.armR = { p: 70 - sw * 0.3, s: 10, e: 14 }; }
    else if (t === 'brute') { p.armL.p = 22 - sw; p.armR.p = 26 + sw; }
    else { p.armL.p = 12 - sw * 0.5; p.armR.p = 12 + sw * 0.5; }
  }
  if (fr === 'a0') { p.armL = { p: 128, s: 12, e: -8 }; p.armR = { p: 124, s: 14, e: -6 }; p.lean = 2; p.head -= 10; }
  if (fr === 'a1') { p.armL = { p: 86, s: 6, e: 0 }; p.armR = { p: 84, s: 6, e: 0 }; p.lean = 30; p.legL = 26; p.legR = -20; p.kneeR = 24; }
  if (fr === 'hit' || fr[0] === 'd') { p.lean = -12; p.head = -20; p.armL = { p: 40, s: 36, e: 20 }; p.armR = { p: 36, s: 40, e: 24 }; p.kneeL = 20; p.kneeR = 16; p.bob = -0.8; }
  if (fr === 'aim') return zombiePose(L, 'i0');
  return p;
}

// ----- сборка модели -----
function buildFigure(L, P) {
  const g = GRID, B = L.body, zom = L.kind === 'z';
  g.fill(0); bbReset();
  const hipZ = B.thigh + B.shin + 1.6 + P.bob, hip = [0, 0, hipZ];
  const front = B.tR * B.sy;
  // ноги
  for (const side of [-1, 1]) {
    const a = side < 0 ? P.legR : P.legL, k = side < 0 ? P.kneeR : P.kneeL;
    const h = [side * B.hipW, 0, hipZ], kn = vadd(h, vdown(a, B.thigh)), an = vadd(kn, vdown(a - k, B.shin));
    an[2] = Math.max(1.4, an[2]);
    vcap(g, h, kn, B.legR, C.PANTS);
    vcap(g, kn, an, B.legR * 0.86, C.PANTS);
    if (!zom && L.knee) vdot(g, vadd(kn, vmul(vnorm(vadd(vdown(a, 1), vdown(a - k, 1))), 0)).map((v, i) => v + [0, B.legR * 0.7, 0][i]), C.TOP2, B.legR * 0.62);
    if (!zom) vcap(g, vadd(kn, vdown(a - k, B.shin * 0.55)), vadd(kn, vdown(a - k, B.shin * 0.62)), B.legR * 0.9, C.TOP2, 1, 1, C.PANTS);
    const bare = zom && L.barefoot === side;
    const bootC = bare ? C.SKIN2 : C.BOOTS;
    const heel = [an[0], an[1] - 0.6, Math.max(1.0, an[2] - 0.5)], toe = [an[0], an[1] + 2.5, Math.max(0.95, an[2] - 0.55)];
    vcap(g, heel, toe, B.legR * (bare ? 0.62 : 0.8), bootC);
    if (!bare) {
      vcap(g, vadd(an, [0, 0, 0.4]), vadd(an, [0, 0, 1.8]), B.legR * 0.88, bootC);
      vcap(g, [heel[0], heel[1] - 0.1, 0.42], [toe[0], toe[1] + 0.1, 0.42], B.legR * 0.84, C.SOLE);
    }
  }
  // корпус
  const lean = P.lean, chest = vadd(vadd(hip, vup(lean, B.torso)), [P.tilt, 0, 0]);
  const at = d => vadd(hip, vup(lean, d));
  vcap(g, vadd(hip, [0, 0, -0.6]), at(2.2), B.tR * 1.04, C.PANTS, B.sx, B.sy);
  if (L.gown) vcap(g, vadd(hip, [0, 0, -5]), chest, B.tR * 1.12, C.TOP, B.sx, B.sy);
  vcap(g, at(2.4), chest, B.tR, C.TOP, B.sx, B.sy);
  if (!L.gown) {
    vcap(g, at(2.2), at(2.9), B.tR * 1.06, C.BELT, B.sx, B.sy);
    vdot(g, vadd(at(2.55), [0.2, front * 1.06, 0]), C.METAL, 0.55);
  }
  if (!zom) {
    // молния, воротник, карманы
    vcap(g, vadd(at(3.2), [0.35, front, 0]), vadd(chest, [0.35, front * 0.95, -1.4]), 0.36, C.TOP2, 1, 1, C.TOP);
    vcap(g, vadd(chest, [-B.sh * 0.55, 0.25, -0.3]), vadd(chest, [B.sh * 0.55, 0.25, -0.3]), 1.05, C.TOP2, 1.2, 1);
    for (const sx of [-1, 1]) vbox(g, vadd(chest, [sx * 2.4 - 0.75, front * 0.8, -5]), vadd(chest, [sx * 2.4 + 0.75, front * 1.12, -3.4]), C.TOP2, -1);
    if (L.vest) {
      vcap(g, at(3.4), vadd(chest, [0, 0, -1.6]), B.tR * 1.09, C.VEST, B.sx, B.sy);
      for (let k = -1; k <= 1; k++) vbox(g, vadd(at(3.6), [k * 1.7 - 0.65, front * 1.02, 0]), vadd(at(3.6), [k * 1.7 + 0.65, front * 1.32, 1.9]), C.VEST);
      for (let k = -1; k <= 1; k++) vbox(g, vadd(at(5.3), [k * 1.7 - 0.65, front * 1.3, 0]), vadd(at(5.3), [k * 1.7 + 0.65, front * 1.36, 0.25]), C.TOP2, -1);
    }
    // рюкзак со скаткой и лямками
    const back = vadd(chest, [0, -front - 1.7, -2.5]);
    vcap(g, vadd(back, [0, 0, -4.4]), back, 2.5, C.PACK, 1.25, 0.75);
    vcap(g, vadd(back, [0, -0.6, 0.4]), vadd(back, [0, -0.6, 0.9]), 2.15, C.TOP2, 1.3, 0.7);
    vcap(g, vadd(back, [0, -0.9, -3.4]), vadd(back, [0, -0.9, -2.4]), 1.5, C.TOP2, 1.1, 0.7);
    vcap(g, vadd(back, [-2.6, 0.2, 1.7]), vadd(back, [2.6, 0.2, 1.7]), 1.1, C.ROLL);
    for (const sx of [-1, 1]) {
      const s0 = vadd(chest, [sx * 1.9, -front - 0.6, -2]), s1 = vadd(chest, [sx * 1.9, 0, 0.9]), s2 = vadd(chest, [sx * 1.7, front + 0.25, -4]);
      vcap(g, s0, s1, 0.48, C.PACK); vcap(g, s1, s2, 0.48, C.PACK);
    }
  } else {
    if (L.type === 'brute' && L.v === 0) {
      vcap(g, at(5.6), at(6.4), B.tR * 1.05, C.STRIPE, B.sx, B.sy, C.TOP);
      for (const sx of [-1, 1]) vcap(g, vadd(at(6.4), [sx * 2.2, front, 0]), vadd(chest, [sx * 2.2, front * 0.6, 0.2]), 0.55, C.STRIPE, 1, 1, C.TOP);
    }
    if (L.ribs) {
      vbox(g, vadd(chest, [-2.4, front * 0.7, -5.4]), vadd(chest, [0.4, front * 1.05, -1.6]), C.MOUTH, -1);
      for (let r = 0; r < 4; r++) vcap(g, vadd(chest, [-2.2, front * 0.98, -2 - r * 0.95]), vadd(chest, [0.2, front * 0.98, -2.2 - r * 0.95]), 0.32, C.BONE);
    }
    // раны
    for (let k = 0; k < 3; k++) {
      const hh = hash3(L.seed, k, 7), hv = hash3(L.seed, k, 11);
      const sp = vadd(chest, [(hh - 0.5) * 4.5, front * 0.95, -1.5 - hv * 6]);
      vdot(g, sp, C.BLOOD, 0.8 + hv * 0.5, -1);
      vdot(g, vadd(sp, [0, 0.2, 0]), C.MOUTH, 0.42, -1);
    }
  }
  // шея и голова
  const neck = vadd(chest, vup(lean, 1.1));
  const hc = vadd(neck, vup(lean + P.head, B.head + 0.7));
  const fwd = vnorm(vup(lean + P.head + 90, 1)), upv = vnorm(vup(lean + P.head, 1));
  const onHead = (x, f, u) => [hc[0] + x, hc[1] + fwd[1] * f + upv[1] * u, hc[2] + fwd[2] * f + upv[2] * u];
  vcap(g, chest, neck, 1.3, C.SKIN);
  if (L.hood) {
    vdot(g, onHead(0, -0.9, 0.2), C.TOP, B.head + 0.95);
    vdot(g, onHead(0, B.head * 0.85, -0.3), 0, B.head * 0.92);
  }
  const hs = L.hairStyle;
  if (zom || hs !== undefined) vdot(g, onHead(0, -0.45, 0.5), C.HAIR, B.head + (hs === 1 ? 0.45 : 0.25));
  if (zom) for (let k = 0; k < 5; k++) vdot(g, onHead((hash3(L.seed, k, 3) - 0.5) * 4, (hash3(L.seed, k, 5) - 0.5) * 3, B.head * 0.9), 0, 0.9);
  if (hs === 4 || L.hardhat) {
    vdot(g, onHead(0, -0.2, 0.75), C.CAP, B.head + (L.hardhat ? 0.7 : 0.5));
    if (L.hardhat) vcap(g, onHead(0, -0.2, 0.2), onHead(0, -0.2, 0.45), B.head + 1.25, C.CAP);
    else vcap(g, onHead(0, -0.2, 0.15), onHead(0, -0.2, 0.55), B.head + 0.62, C.TOP2);
  }
  if (hs === 5) {
    vdot(g, onHead(0, -0.25, 0.7), C.CAP, B.head + 0.45);
    vbox(g, onHead(-1.7, B.head * 0.6, 1.25), onHead(1.7, B.head + 1.7, 1.75), C.CAP);
  }
  // череп, челюсть, уши, нос
  vdot(g, onHead(0, 0.35, -0.35), C.SKIN, B.head);
  vcap(g, onHead(0, 0.9, -1.5), onHead(0, 1.15, -2.0), B.head * 0.66, C.SKIN);
  for (const sx of [-1, 1]) vdot(g, onHead(sx * B.head * 0.98, 0.1, -0.35), C.SKIN, 0.6);
  vcap(g, onHead(0, B.head * 1.02, -0.5), onHead(0, B.head * 1.2, -1.05), 0.45, C.SKIN);
  if (hs === 1) vcap(g, onHead(-1.8, B.head * 0.82, 1.55), onHead(1.4, B.head * 0.92, 1.35), 0.75, C.HAIR);
  if (hs === 2 || (L.female && hs !== 3)) {
    vcap(g, onHead(0, -2.1, 0.6), onHead(0, -2.5, -4.6), 2.0, C.HAIR, 1.25, 1);
    for (const sx of [-1, 1]) vcap(g, onHead(sx * (B.head * 0.92), 0.2, 0.6), onHead(sx * (B.head * 0.95), 0.4, -3.4), 0.75, C.HAIR);
  }
  if (hs === 3) vcap(g, onHead(0, -3.1, 0.9), onHead(0, -4.3, -3.4), 1.05, C.HAIR);
  if (L.beard) {
    vcap(g, onHead(-1.65, B.head * 0.7, -1.4), onHead(1.65, B.head * 0.7, -1.4), 1.0, C.HAIR);
    vcap(g, onHead(0, B.head * 0.85, -2.1), onHead(0, B.head * 0.8, -2.7), 1.05, C.HAIR);
  }
  // глаза, брови, рот
  for (const sx of [-1, 1]) {
    const e = onHead(sx * 1.08, B.head * 0.9, 0.15);
    if (zom) { vdot(g, e, C.MOUTH, 0.62); vdot(g, onHead(sx * 1.08, B.head * 0.98, 0.15), C.EYE, 0.38); }
    else {
      vdot(g, e, C.SCLERA, 0.45);
      vdot(g, onHead(sx * 1.0, B.head * 1.04, 0.15), C.EYE, 0.3);
      vcap(g, onHead(sx * 1.08 - 0.55, B.head * 0.98, 0.95), onHead(sx * 1.08 + 0.55, B.head * 0.98, 0.9), 0.28, L.beard || hs !== undefined ? C.HAIR : C.SKIN2);
    }
  }
  if (zom && L.type === 'screamer') { vcap(g, onHead(0, B.head * 0.98, -1.3), onHead(0, B.head * 0.98, -2.5), 1.0, C.MOUTH); vdot(g, onHead(-0.5, B.head * 1.05, -1.0), C.BONE, 0.3); vdot(g, onHead(0.5, B.head * 1.05, -1.0), C.BONE, 0.3); }
  else if (zom) { vcap(g, onHead(-0.75, B.head * 0.98, -1.75), onHead(0.75, B.head * 0.98, -1.75), 0.48, C.MOUTH); vdot(g, onHead(-0.3, B.head * 1.04, -1.45), C.BONE, 0.26); vdot(g, onHead(0.35, B.head * 1.04, -1.45), C.BONE, 0.26); }
  else vcap(g, onHead(-0.6, B.head * 1.02, -1.55), onHead(0.6, B.head * 1.02, -1.55), 0.24, C.MOUTH, 1, 1, -1);
  // руки
  const hands = {};
  for (const side of [-1, 1]) {
    const A = side < 0 ? P.armR : P.armL;
    const sh = vadd(chest, [side * B.sh, 0, -1.3]);
    const el = vadd(sh, armDir(side, A.p, A.s, B.upper));
    const fd = armDir(side, A.p + A.e, A.s * 0.5, B.fore), fdn = vnorm(fd);
    const ha = vadd(el, fd);
    const sleeve = zom && L.type === 'screamer' && !L.gown ? C.SKIN : C.TOP;
    vcap(g, sh, el, B.armR, sleeve);
    vcap(g, el, ha, B.armR * 0.88, zom || L.rolled ? C.SKIN : C.TOP);
    if (!zom && !L.rolled) vcap(g, vadd(ha, vmul(fdn, -0.7)), vadd(ha, vmul(fdn, -0.15)), B.armR * 0.96, C.TOP2);
    if (L.rolled) vcap(g, vadd(el, vmul(fdn, 0.2)), vadd(el, vmul(fdn, 1.2)), B.armR * 1.02, C.TOP2);
    if (!zom && L.pads) vdot(g, sh, C.TOP2, B.armR + 0.75);
    const handC = zom ? C.SKIN2 : L.gloves ? C.GLOVE : C.SKIN;
    vcap(g, ha, vadd(ha, vmul(fdn, zom ? 1.9 : 1.1)), B.armR * 0.82, handC);
    vdot(g, vadd(vadd(ha, vmul(fdn, 0.45)), [-side * 0.75, 0.35, 0]), handC, 0.45);
    hands[side] = { pos: ha, dir: fdn };
  }
  if (!zom) drawWeapon(g, L, P, hands, chest, hip);
  if (zom) rot(g, L.seed);
  return g;
}
function drawWeapon(g, L, P, H, chest, hip) {
  const R = H[-1], Lh = H[1], long = L.ranged === 'shotgun' || L.ranged === 'rifle';
  if (long && P.hold === 'melee') {
    vcap(g, vadd(chest, [-3.2, -3.9, -6.2]), vadd(chest, [-0.6, -3.9, -2.2]), 0.75, C.WOOD);
    vcap(g, vadd(chest, [-0.6, -3.9, -2.2]), vadd(chest, [3.3, -3.9, 3.6]), 0.5, C.METAL);
  }
  if (L.ranged === 'pistol' && P.hold === 'melee') {
    vbox(g, vadd(hip, [-3.7, -0.6, -1.6]), vadd(hip, [-2.6, 1.1, 0.6]), C.BELT);
    vdot(g, vadd(hip, [-3.1, -0.3, 1.0]), C.METAL, 0.5);
  }
  if (P.hold === 'gun' && L.ranged) {
    if (L.ranged === 'pistol') {
      const d = P.aim ? [0, 1, 0] : vnorm(vpitch(R.dir, 70)), s0 = vadd(R.pos, vmul(d, 0.4));
      vcap(g, s0, vadd(s0, vmul(d, 3.1)), 0.52, C.METAL);
      vdot(g, vadd(s0, vmul(d, 3.25)), C.MOUTH, 0.3);
      vcap(g, s0, vadd(s0, [0, -0.5, -1.6]), 0.48, C.BELT);
    } else {
      let a, b;
      if (P.aim) { a = vadd(chest, [-1.6, 0.6, -1.4]); b = vadd(a, [0.3, 12.5, 0.3]); }
      else { a = vadd(R.pos, [0, -2.6, -1.4]); b = vadd(Lh.pos, vmul(vnorm(vsub(Lh.pos, R.pos)), 5)); }
      const d = vnorm(vsub(b, a)), m1 = vadd(a, vmul(vsub(b, a), 0.32)), m2 = vadd(a, vmul(vsub(b, a), 0.55));
      const up = [0, 0, 1], side = vnorm([d[1] || 0.01, -d[0], 0]);
      vcap(g, a, m1, L.ranged === 'shotgun' ? 0.95 : 0.85, C.WOOD);
      vcap(g, m1, m2, 0.68, C.METAL);
      if (L.ranged === 'shotgun') {
        for (const sx of [-0.36, 0.36]) vcap(g, vadd(m2, vmul(side, sx)), vadd(b, vmul(side, sx)), 0.38, C.METAL);
        vcap(g, vadd(m2, [0, 0, -0.5]), vadd(vadd(m2, vmul(d, 2.6)), [0, 0, -0.55]), 0.55, C.WOOD);
      } else {
        vcap(g, m2, b, 0.36, C.METAL);
        const sc0 = vadd(vadd(m1, vmul(up, 1.0)), vmul(d, -0.3)), sc1 = vadd(sc0, vmul(d, 3.2));
        vcap(g, sc0, sc1, 0.45, C.METAL);
        vdot(g, sc1, C.GLASS, 0.36);
        vcap(g, vadd(m1, vmul(d, 1.1)), vadd(vadd(m1, vmul(d, 1.4)), [0, 0, -1.7]), 0.45, C.METAL);
      }
    }
    return;
  }
  const d = vnorm(vpitch(R.dir, P.mw)), s0 = R.pos, side = vnorm([d[1] || 0.01, -d[0], 0]);
  switch (L.melee) {
    case 'bat':
      vcap(g, vadd(s0, vmul(d, -0.7)), vadd(s0, vmul(d, 1.4)), 0.5, C.TAPE);
      vcap(g, vadd(s0, vmul(d, 1.4)), vadd(s0, vmul(d, 4.6)), 0.62, C.WOOD);
      vcap(g, vadd(s0, vmul(d, 4.6)), vadd(s0, vmul(d, 8)), 0.98, C.WOOD);
      vdot(g, vadd(s0, vmul(d, -0.8)), C.WOOD, 0.62);
      break;
    case 'axe': {
      const e = vadd(s0, vmul(d, 7));
      vcap(g, vadd(s0, vmul(d, -0.5)), e, 0.46, C.WOOD);
      vcap(g, vadd(e, vmul(side, -0.6)), vadd(e, vmul(side, 2.1)), 0.95, C.RED, 1, 1);
      vcap(g, vadd(vadd(e, vmul(side, 2.3)), vmul(d, -0.9)), vadd(vadd(e, vmul(side, 2.3)), vmul(d, 0.9)), 0.42, C.BLADE);
      break;
    }
    case 'crowbar': {
      const e = vadd(s0, vmul(d, 7));
      vcap(g, vadd(s0, vmul(d, -0.6)), e, 0.42, C.RED);
      vcap(g, e, vadd(e, [0, -1.2, -0.9]), 0.42, C.RED);
      vcap(g, vadd(s0, vmul(d, -0.6)), vadd(s0, vmul(d, -1.3)), 0.32, C.METAL);
      break;
    }
    default:
      vcap(g, vadd(s0, vmul(d, -0.3)), vadd(s0, vmul(d, 0.9)), 0.42, C.BELT);
      vcap(g, vadd(s0, vmul(d, 0.9)), vadd(s0, vmul(d, 3.3)), 0.3, C.BLADE);
  }
}
// Рваная одежда, пятна и вены у зомби
function rot(g, seed) {
  for (let z = BB[2]; z <= BB[5]; z++) for (let y = BB[1]; y <= BB[4]; y++) {
    let i = gidx(BB[0], y, z);
    for (let x = BB[0]; x <= BB[3]; x++, i++) {
      const c = g[i];
      if (c !== C.TOP && c !== C.PANTS && c !== C.SKIN) continue;
      const h = hash3(x, y + seed, z);
      if (c === C.SKIN) { if (h < 0.1) g[i] = C.SKIN2; continue; }
      if (h < 0.05) g[i] = C.SKIN2; else if (h < 0.09) g[i] = C.BLOOD;
    }
  }
}
// Падение: поворот готовой модели назад вокруг таза
function fallGrid(src, dst, deg, hipZ, dropZ) {
  dst.fill(0);
  const a = (deg * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
  const sb = BB.slice();
  bbReset();
  for (let z = 0; z < VX.GH; z++) {
    const qz = (z + 0.5) / VRES + dropZ - hipZ;
    for (let y = 0; y < VX.GD; y++) {
      const qy = (y + 0.5) / VRES - VX.OD;
      const py = qy * ca - qz * sa, pz = qy * sa + qz * ca + hipZ;
      const sy = Math.floor((py + VX.OD) * VRES), sz = Math.floor(pz * VRES);
      if (sy < sb[1] || sy > sb[4] || sz < sb[2] || sz > sb[5]) continue;
      for (let x = sb[0]; x <= sb[3]; x++) {
        const c = src[gidx(x, sy, sz)];
        if (!c) continue;
        dst[gidx(x, y, z)] = c;
        if (x < BB[0]) BB[0] = x; if (y < BB[1]) BB[1] = y; if (z < BB[2]) BB[2] = z;
        if (x > BB[3]) BB[3] = x; if (y > BB[4]) BB[4] = y; if (z > BB[5]) BB[5] = z;
      }
    }
  }
  return dst;
}

// ----- поверхность: сглаженные нормали и затенение -----
const NB = [];
for (let dz = -2; dz <= 2; dz++) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
  const d2 = dx * dx + dy * dy + dz * dz;
  if (d2 && d2 <= 5) NB.push([dx, dy, dz, 1 / Math.sqrt(d2)]);
}
function surfaceOf(g) {
  const W = VX.GW, D = VX.GD, H = VX.GH, WD = W * D, out = [];
  if (BB[3] < 0) return new Uint8Array(0);
  for (let z = BB[2]; z <= BB[5]; z++) for (let y = BB[1]; y <= BB[4]; y++) for (let x = BB[0]; x <= BB[3]; x++) {
    const i = (z * D + y) * W + x, c = g[i];
    if (!c) continue;
    const xm = x === 0 || !g[i - 1], xp = x === W - 1 || !g[i + 1];
    const ym = y === 0 || !g[i - W], yp = y === D - 1 || !g[i + W];
    const zm = z === 0 || !g[i - WD], zp = z === H - 1 || !g[i + WD];
    if (!(xm || xp || ym || yp || zm || zp)) continue;
    let nx = 0, ny = 0, nz = 0, empty = 0;
    for (let k = 0; k < NB.length; k++) {
      const o = NB[k], X = x + o[0], Y = y + o[1], Z = z + o[2];
      if (X >= 0 && Y >= 0 && Z >= 0 && X < W && Y < D && Z < H && g[(Z * D + Y) * W + X]) continue;
      nx += o[0] * o[3]; ny += o[1] * o[3]; nz += o[2] * o[3]; empty++;
    }
    let l = Math.hypot(nx, ny, nz);
    if (l < 0.01) { nx = (xp ? 1 : 0) - (xm ? 1 : 0); ny = (yp ? 1 : 0) - (ym ? 1 : 0); nz = (zp ? 1 : 0) - (zm ? 1 : 0); l = Math.hypot(nx, ny, nz) || 1; }
    out.push(x, y, z, c, Math.round((nx / l) * 127 + 128), Math.round((ny / l) * 127 + 128), Math.round((nz / l) * 127 + 128), zp ? 1 : 0, Math.round((empty / NB.length) * 255));
  }
  return Uint8Array.from(out);
}
function renderFigure(surf, L, dir, s) {
  const pal = L.pal, yaw = YAWS[dir], cy = Math.cos(yaw), sy = Math.sin(yaw), sE = VX.sE, cE = VX.cE, inv = 1 / VRES, h = 0.5 * inv;
  const Wp = Math.ceil(2 * VREACH * s) + 8, oy = Math.ceil((VREACH * sE + VX.H * cE) * s) + 6;
  const Hp = oy + Math.ceil(VREACH * sE * s) + 8, ox = Wp >> 1;
  const img = new ImageData(Wp, Hp), px = img.data, zb = new Float32Array(Wp * Hp).fill(-1e9);
  const LX = LIGHT[0], LY = LIGHT[1], LZ = LIGHT[2], HX = HALFV[0], HY = HALFV[1], HZ = HALFV[2];
  const shade = (ax, ay, az, ao, mp) => {
    const d = ax * LX + ay * LY + az * LZ, fv = ay * VX.cE + az * VX.sE;
    const f = Math.min(1.25, (0.44 + 0.14 * az + 0.62 * Math.max(0, d) + 0.2 * Math.max(0, fv)) * ao);
    const sp = mp[0] ? mp[0] * Math.pow(Math.max(0, ax * HX + ay * HY + az * HZ), mp[1]) * 255 : 0;
    return [f, sp];
  };
  for (let k = 0; k < surf.length; k += 9) {
    const gx = surf[k], gy = surf[k + 1], gz = surf[k + 2], c = surf[k + 3];
    const nx = (surf[k + 4] - 128) / 127, ny = (surf[k + 5] - 128) / 127, nz = (surf[k + 6] - 128) / 127;
    const top = surf[k + 7], open = surf[k + 8] / 255;
    const mx = (gx + 0.5) * inv - VX.O, my = (gy + 0.5) * inv - VX.OD, zc = (gz + 0.5) * inv;
    const xr = mx * cy - my * sy, yr = mx * sy + my * cy;
    const nxr = nx * cy - ny * sy, nyr = nx * sy + ny * cy;
    const mp = MATP[c], col = pal[c] || [255, 0, 255];
    const ao = (0.6 + 0.5 * open) * (0.8 + 0.2 * Math.min(1, zc / 8)) * (1 + (hash3(gx, gy, gz) - 0.5) * mp[2] * 2);
    let tx = nxr, ty = nyr, tz = nz;
    if (top) { tz += 0.4; const l = Math.hypot(tx, ty, tz); tx /= l; ty /= l; tz /= l; }
    let sx = nxr, sy2 = nyr, sz = nz * 0.75;
    const ls = Math.hypot(sx, sy2, sz);
    if (ls < 0.05) { sx = 0; sy2 = 1; sz = 0; } else { sx /= ls; sy2 /= ls; sz /= ls; }
    const glow = c === C.EYE && L.glow;
    const [fT, spT] = glow ? [1.25, 40] : shade(tx, ty, tz, ao, mp);
    const [fS, spS] = glow ? [1.15, 30] : shade(sx, sy2, sz, ao * 0.97, mp);
    const rT = col[0] * fT + spT, gT = col[1] * fT + spT, bT = col[2] * fT + spT;
    const rS = col[0] * fS + spS, gS = col[1] * fS + spS, bS = col[2] * fS + spS;
    const t0 = (yr - h) * sE - (zc + h) * cE, t1 = t0 + 2 * h * sE, t2 = t1 + 2 * h * cE;
    const x0 = Math.max(0, Math.floor(ox + (xr - h * 1.12) * s)), x1 = Math.min(Wp, Math.ceil(ox + (xr + h * 1.12) * s));
    const y0 = Math.max(0, Math.floor(oy + t0 * s)), y1 = Math.round(oy + t1 * s), y2 = Math.min(Hp, Math.ceil(oy + t2 * s));
    const dT = yr * cE + (zc + h) * sE, dF = (yr + h) * cE + zc * sE;
    for (let yy = y0; yy < y2; yy++) {
      const isT = yy < y1, d = isT ? dT : dF;
      for (let xx = x0; xx < x1; xx++) {
        const q = yy * Wp + xx;
        if (d <= zb[q]) continue;
        zb[q] = d;
        const o = q * 4;
        px[o] = isT ? rT : rS; px[o + 1] = isT ? gT : gS; px[o + 2] = isT ? bT : bS; px[o + 3] = 255;
      }
    }
  }
  // линии на стыках частей тела (перепад глубины) и контур
  const dark = new Uint8Array(Wp * Hp), thr = 1.3;
  for (let yy = 0; yy < Hp - 1; yy++) for (let xx = 0; xx < Wp - 1; xx++) {
    const q = yy * Wp + xx;
    if (!px[q * 4 + 3]) continue;
    for (const n of [q + 1, q + Wp]) {
      if (!px[n * 4 + 3]) continue;
      const dd = zb[q] - zb[n];
      if (dd > thr) dark[n] = 1; else if (dd < -thr) dark[q] = 1;
    }
  }
  for (let q = 0; q < dark.length; q++) if (dark[q]) { const o = q * 4; px[o] *= 0.62; px[o + 1] *= 0.62; px[o + 2] *= 0.62; }
  const edge = [];
  for (let yy = 1; yy < Hp - 1; yy++) for (let xx = 1; xx < Wp - 1; xx++) {
    const q = yy * Wp + xx;
    if (px[q * 4 + 3]) continue;
    const nb = px[(q - 1) * 4 + 3] ? q - 1 : px[(q + 1) * 4 + 3] ? q + 1 : px[(q - Wp) * 4 + 3] ? q - Wp : px[(q + Wp) * 4 + 3] ? q + Wp : -1;
    if (nb >= 0) edge.push(q, nb);
  }
  for (let k = 0; k < edge.length; k += 2) {
    const o = edge[k] * 4, n = edge[k + 1] * 4;
    px[o] = px[n] * 0.22 + 6; px[o + 1] = px[n + 1] * 0.22 + 5; px[o + 2] = px[n + 2] * 0.22 + 4; px[o + 3] = 230;
  }
  let bx0 = Wp, by0 = Hp, bx1 = 0, by1 = 0;
  for (let yy = 0; yy < Hp; yy++) for (let xx = 0; xx < Wp; xx++) if (px[(yy * Wp + xx) * 4 + 3]) {
    if (xx < bx0) bx0 = xx; if (xx > bx1) bx1 = xx; if (yy < by0) by0 = yy; if (yy > by1) by1 = yy;
  }
  if (bx1 < bx0) { bx0 = by0 = 0; bx1 = by1 = 1; }
  const w = bx1 - bx0 + 1, hgt = by1 - by0 + 1;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = hgt;
  cv.getContext('2d').putImageData(img, -bx0, -by0);
  return { cv, ax: ox - bx0, ay: oy - by0, w, h: hgt, bytes: w * hgt * 4 };
}

// ----- кеш, фоновая подготовка и отрисовка -----
const GFX_SMAX = [3, 5, 8], GFX_BUDGET = [16e6, 36e6, 64e6];
const Spr = {
  models: new Map(), mBytes: 0, sprites: new Map(), sBytes: 0, looks: new Map(), queue: [], pumping: false,
  look(e, kind) {
    if (kind === 'z') {
      const k = 'z' + e.type + (e.id % 3);
      let L = this.looks.get(k);
      if (!L) { L = lookZombie(e); this.looks.set(k, L); }
      return L;
    }
    const id = e.sid ?? e.id, k = `h${id}${e.color}${e.melee}${e.ranged || ''}${e.g}`;
    let L = this.looks.get(k);
    if (!L) { L = lookSurvivor({ id, name: e.name, g: e.g, color: e.color, trait: e.trait, melee: e.melee, ranged: e.ranged }); this.looks.set(k, L); }
    return L;
  },
  model(L, fr) {
    const mk = L.key + '|' + fr;
    let surf = this.models.get(mk);
    if (surf) return surf;
    const P = L.kind === 'z' ? zombiePose(L, fr) : humanPose(L, fr);
    let g = buildFigure(L, P);
    if (fr === 'd1' || fr === 'd2') {
      const hipZ = L.body.thigh + L.body.shin + 1.6 + P.bob;
      g = fr === 'd1' ? fallGrid(g, GRID2, 48, hipZ, -(hipZ - 4) * 0.45) : fallGrid(g, GRID2, 88, hipZ, -(hipZ - 3.2));
    }
    surf = surfaceOf(g);
    this.models.set(mk, surf);
    this.mBytes += surf.length;
    while (this.mBytes > 24e6 && this.models.size > 1) { const [k0, v0] = this.models.entries().next().value; this.models.delete(k0); this.mBytes -= v0.length; }
    return surf;
  },
  get(L, fr, dir, s) {
    const key = L.key + '|' + fr + '|' + dir + '|' + s;
    let sp = this.sprites.get(key);
    if (sp) { this.sprites.delete(key); this.sprites.set(key, sp); return sp; }
    sp = renderFigure(this.model(L, fr), L, dir, s);
    this.sprites.set(key, sp);
    this.sBytes += sp.bytes;
    const budget = GFX_BUDGET[CFG.gfx ?? 2];
    while (this.sBytes > budget && this.sprites.size > 1) { const [k0, v0] = this.sprites.entries().next().value; this.sprites.delete(k0); this.sBytes -= v0.bytes; }
    return sp;
  },
  // Заранее собрать модели кадров в фоне, чтобы первый шаг не подтормаживал
  warm(L, frames) {
    for (const fr of frames) if (!this.models.has(L.key + '|' + fr)) this.queue.push([L, fr]);
    if (!this.pumping) this.pump();
  },
  pump() {
    this.pumping = true;
    const t0 = performance.now();
    while (this.queue.length && performance.now() - t0 < 7) { const [L, fr] = this.queue.shift(); this.model(L, fr); }
    if (this.queue.length) setTimeout(() => this.pump(), 40); else this.pumping = false;
  },
  // Рисует фигуру стопами в (cx, fy); возвращает y макушки
  draw(c, L, fr, dir, cx, fy, ts, sMax) {
    const max = sMax || GFX_SMAX[CFG.gfx ?? 2];
    const s = clamp(Math.round(ts * VSCALE * (R.dpr || 1)), 1, max);
    const sp = this.get(L, fr, dir, s), k = (ts * VSCALE) / s;
    c.imageSmoothingEnabled = k < 1;
    c.drawImage(sp.cv, cx - sp.ax * k, fy - sp.ay * k, sp.w * k, sp.h * k);
    c.imageSmoothingEnabled = true;
    return fy - sp.ay * k;
  },
};
const WARM_FRAMES = ['w0', 'w1', 'w2', 'w3', 'w4', 'w5', 'aim', 'a0', 'a1', 'hit'];
function frameOf(e, now) {
  const a = e.anim;
  if (a) {
    const p = clamp((now - a.t0) / a.d, 0, 0.999);
    if (a.k === 'mv') return 'w' + (((e.step || 0) * 3 + Math.floor(p * 3)) % 6);
    if (a.k === 'lg') return p < 0.45 ? 'a0' : 'a1';
  }
  if (e.hitT && now - e.hitT < 260) return 'hit';
  if (e.aimT && now < e.aimT) return 'aim';
  if (!CFG.hq) return 'i0';
  return Math.floor(now / 650 + (e.id || 0) * 0.37) % 2 ? 'i1' : 'i0';
}
// Портрет выжившего для карточек
function drawPortrait(cv, s) {
  const dpr = Math.min(3, window.devicePixelRatio || 1), W = cv.clientWidth || 44, H = cv.clientHeight || 52;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  const c = cv.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, W, H);
  const L = Spr.look(s, 'h'), ts = H * 1.55;
  const fy = H + 17 * VX.cE * ts * VSCALE * 0.95;
  const dprSave = R.dpr; R.dpr = dpr;
  Spr.draw(c, L, 'i0', 3, W * 0.5, fy, ts, 8);
  R.dpr = dprSave;
}
