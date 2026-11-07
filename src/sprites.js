'use strict';
// ---------- 2.5D-персонажи: воксельные модели, отрисованные в спрайты ----------
// Каждая фигура собирается из капсул в сетке вокселей, освещается и рисуется
// под углом камеры (вид сверху-сбоку) в 8 направлениях. Спрайты кешируются.

const VX = { W: 32, D: 34, H: 52, O: 16, OD: 17, E: (52 * Math.PI) / 180 };
VX.sE = Math.sin(VX.E); VX.cE = Math.cos(VX.E);
const VSCALE = 0.05; // доля клетки на один воксель
const VREACH = 23.4; // максимальный радиус модели в плане
const LIGHT = (() => { const v = [-0.45, -0.3, 0.84], l = Math.hypot(...v); return v.map(x => x / l); })();
const YAWS = Array.from({ length: 8 }, (_, d) => { const a = (d * Math.PI) / 4; return Math.atan2(-Math.cos(a), Math.sin(a)); });
function dirIdx(dx, dy) { return ((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8; }

// Индексы палитры
const C = { SKIN: 1, HAIR: 2, TOP: 3, TOP2: 4, PANTS: 5, BOOTS: 6, PACK: 7, METAL: 8, WOOD: 9, EYE: 10, BLOOD: 11, MOUTH: 12, BELT: 13, SKIN2: 14, STRIPE: 15 };
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

// ----- сетка -----
const vidx = (x, y, z) => (z * VX.D + y) * VX.W + x;
function vcap(g, a, b, r, c, sx = 1, sy = 1) {
  const pr = r * Math.max(sx, sy) + 1;
  const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0]) - pr + VX.O)), x1 = Math.min(VX.W - 1, Math.ceil(Math.max(a[0], b[0]) + pr + VX.O));
  const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1]) - pr + VX.OD)), y1 = Math.min(VX.D - 1, Math.ceil(Math.max(a[1], b[1]) + pr + VX.OD));
  const z0 = Math.max(0, Math.floor(Math.min(a[2], b[2]) - pr)), z1 = Math.min(VX.H - 1, Math.ceil(Math.max(a[2], b[2]) + pr));
  const ex = b[0] - a[0], ey = b[1] - a[1], ez = b[2] - a[2], L2 = ex * ex + ey * ey + ez * ez || 1e-6, r2 = r * r;
  for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const px = x - VX.O + 0.5, py = y - VX.OD + 0.5, pz = z + 0.5;
    let t = ((px - a[0]) * ex + (py - a[1]) * ey + (pz - a[2]) * ez) / L2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const dx = (px - a[0] - ex * t) / sx, dy = (py - a[1] - ey * t) / sy, dz = pz - a[2] - ez * t;
    if (dx * dx + dy * dy + dz * dz <= r2) g[vidx(x, y, z)] = c;
  }
}
function vbox(g, a, b, c) {
  for (let z = Math.max(0, Math.floor(Math.min(a[2], b[2]))); z <= Math.min(VX.H - 1, Math.ceil(Math.max(a[2], b[2]))); z++)
    for (let y = Math.max(0, Math.floor(Math.min(a[1], b[1]) + VX.OD)); y <= Math.min(VX.D - 1, Math.ceil(Math.max(a[1], b[1]) + VX.OD)); y++)
      for (let x = Math.max(0, Math.floor(Math.min(a[0], b[0]) + VX.O)); x <= Math.min(VX.W - 1, Math.ceil(Math.max(a[0], b[0]) + VX.O)); x++) {
        const px = x - VX.O + 0.5, py = y - VX.OD + 0.5, pz = z + 0.5;
        if (px >= Math.min(a[0], b[0]) && px <= Math.max(a[0], b[0]) && py >= Math.min(a[1], b[1]) && py <= Math.max(a[1], b[1]) && pz >= Math.min(a[2], b[2]) && pz <= Math.max(a[2], b[2])) g[vidx(x, y, z)] = c;
      }
}
function vset(g, p, c) {
  const x = Math.floor(p[0] + VX.O), y = Math.floor(p[1] + VX.OD), z = Math.floor(p[2]);
  if (x >= 0 && y >= 0 && z >= 0 && x < VX.W && y < VX.D && z < VX.H) g[vidx(x, y, z)] = c;
}

// ----- пропорции -----
const BODY = {
  man: { hipW: 2.1, legR: 1.75, thigh: 7.6, shin: 7.4, torso: 10, tR: 3.1, sx: 1.32, sy: 0.8, sh: 4.5, armR: 1.35, upper: 6, fore: 5.6, head: 3.0 },
  woman: { hipW: 2.0, legR: 1.65, thigh: 7.4, shin: 7.2, torso: 9.4, tR: 2.85, sx: 1.3, sy: 0.82, sh: 4.0, armR: 1.2, upper: 5.7, fore: 5.3, head: 2.9 },
  bulky: { hipW: 2.4, legR: 2.0, thigh: 7.6, shin: 7.4, torso: 10.4, tR: 3.5, sx: 1.33, sy: 0.84, sh: 5.1, armR: 1.6, upper: 6, fore: 5.6, head: 3.0 },
  runner: { hipW: 1.9, legR: 1.5, thigh: 7.8, shin: 7.6, torso: 9.8, tR: 2.7, sx: 1.3, sy: 0.8, sh: 4.0, armR: 1.15, upper: 6.2, fore: 5.8, head: 2.8 },
  brute: { hipW: 2.9, legR: 2.5, thigh: 8, shin: 7.6, torso: 11.2, tR: 4.4, sx: 1.32, sy: 0.9, sh: 6.3, armR: 2.1, upper: 6.6, fore: 6.4, head: 2.9 },
};

// ----- облик -----
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const SKINS = ['#d2a07c', '#b07c5c', '#e3b896', '#8c5d40', '#c4916c'];
const HAIRS = ['#2a1f17', '#5a3a22', '#1b1a18', '#a37a45', '#7d7366'];
function lookSurvivor(s) {
  const h = hashStr(s.name + s.id);
  const top = mixRgb(hexRgb(s.color), [60, 60, 48], 0.28);
  const old = s.trait === 'hunter' && s.name === 'Семёныч';
  const pal = [];
  pal[C.SKIN] = hexRgb(SKINS[h % SKINS.length]);
  pal[C.SKIN2] = mixRgb(pal[C.SKIN], [0, 0, 0], 0.2);
  pal[C.HAIR] = hexRgb(old ? '#8f8a80' : HAIRS[(h >>> 3) % HAIRS.length]);
  pal[C.TOP] = top;
  pal[C.TOP2] = mixRgb(top, [20, 20, 16], 0.45);
  pal[C.STRIPE] = mixRgb(hexRgb(s.color), [255, 255, 255], 0.25);
  pal[C.PANTS] = hexRgb(['#3d4452', '#4a4636', '#3a3a34', '#4b3f33'][(h >>> 5) % 4]);
  pal[C.BOOTS] = hexRgb('#2a241c');
  pal[C.PACK] = hexRgb(['#4d5a3c', '#5a4c38', '#3e4a52'][(h >>> 7) % 3]);
  pal[C.METAL] = hexRgb('#5b6066');
  pal[C.WOOD] = hexRgb('#7a5534');
  pal[C.EYE] = mixRgb(pal[C.SKIN], [30, 22, 16], 0.62);
  pal[C.BELT] = hexRgb('#2c2620');
  pal[C.BLOOD] = hexRgb('#6e1f18');
  pal[C.MOUTH] = hexRgb('#3a1c16');
  const body = s.g === 'f' ? BODY.woman : s.trait === 'strong' || s.trait === 'tough' ? BODY.bulky : BODY.man;
  return {
    kind: 'h', key: `h${s.id}${s.color}${s.melee}${s.ranged || ''}${s.g}`, pal, body,
    melee: s.melee, ranged: s.ranged, hair: (h >>> 9) % 3, female: s.g === 'f', beard: old || (s.g !== 'f' && (h >>> 11) % 4 === 0),
  };
}
const ZPAL = {
  walker: [['#5a5f6e', '#3a3a38'], ['#6e5a4a', '#33363b'], ['#4f5f4a', '#40372f']],
  runner: [['#7d2a22', '#2f3136'], ['#3f4f6a', '#2b2b2b'], ['#6a6a62', '#3a3328']],
  screamer: [['#8fa6b0', '#8fa6b0'], ['#b6aca0', '#57504a'], ['#8a6f86', '#3a3a38']],
  brute: [['#c66a2a', '#3a3f4a'], ['#4a5a3a', '#2f2f2f'], ['#5a5048', '#38342c']],
};
function lookZombie(z) {
  const v = z.id % 3, pz = ZPAL[z.type][v];
  const pal = [];
  const skin = hexRgb(['#8b977a', '#7f8c6c', '#949a80'][v]);
  pal[C.SKIN] = skin;
  pal[C.SKIN2] = mixRgb(skin, [70, 30, 30], 0.35);
  pal[C.HAIR] = hexRgb(['#2a2620', '#4a4034', '#1c1b18'][v]);
  pal[C.TOP] = hexRgb(pz[0]);
  pal[C.TOP2] = mixRgb(pal[C.TOP], [0, 0, 0], 0.35);
  pal[C.STRIPE] = hexRgb('#d8d4a0');
  pal[C.PANTS] = hexRgb(pz[1]);
  pal[C.BOOTS] = hexRgb('#2a2520');
  pal[C.PACK] = pal[C.TOP2];
  pal[C.METAL] = hexRgb('#5b6066');
  pal[C.WOOD] = hexRgb('#7a5534');
  pal[C.EYE] = hexRgb('#f2e7a2');
  pal[C.BLOOD] = hexRgb('#6a1a14');
  pal[C.MOUTH] = hexRgb('#2a0f0c');
  pal[C.BELT] = hexRgb('#2c2620');
  const body = { walker: BODY.man, runner: BODY.runner, screamer: BODY.woman, brute: BODY.brute }[z.type];
  return { kind: 'z', type: z.type, key: `z${z.type}${v}`, pal, body, hair: z.type === 'screamer' ? 2 : v === 2 ? 0 : 1, seed: v * 977 + 13 };
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
  if (fr === 'i1') { p.bob = -0.6; p.head = 4; }
  if (fr[0] === 'w') {
    const k = +fr[1], sw = [26, 0, -26, 0][k];
    p.legL = sw; p.legR = -sw;
    p.kneeL = sw < 0 ? 30 : 6; p.kneeR = sw > 0 ? 30 : 6;
    if (k % 2) { p.kneeL = k === 1 ? 32 : 6; p.kneeR = k === 3 ? 32 : 6; p.legL = k === 1 ? 14 : -4; p.legR = k === 3 ? 14 : -4; p.bob = 0.6; }
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
    const k = +fr[1], A = t === 'runner' ? 32 : t === 'brute' ? 16 : 20, sw = [A, 0, -A, 0][k];
    p.legL = sw; p.legR = -sw; p.kneeL = sw < 0 ? 26 : 10; p.kneeR = sw > 0 ? 26 : 10;
    if (k % 2) { p.bob = 0.5; p.legL = k === 1 ? 10 : -6; p.legR = k === 3 ? 10 : -6; p.kneeL = k === 1 ? 26 : 8; p.kneeR = k === 3 ? 26 : 8; }
    p.tilt = [0.7, 0, -0.7, 0][k];
    if (t === 'walker' || t === 'runner') { p.armL = { p: 82 + sw * 0.3, s: 8, e: 8 }; p.armR = { p: 70 - sw * 0.3, s: 10, e: 14 }; }
    else if (t === 'brute') { p.armL.p = 22 - sw; p.armR.p = 26 + sw; }
    else { p.armL.p = 12 - sw * 0.5; p.armR.p = 12 + sw * 0.5; }
  }
  if (fr === 'a0') { p.armL = { p: 128, s: 12, e: -8 }; p.armR = { p: 124, s: 14, e: -6 }; p.lean = 2; p.head -= 10; }
  if (fr === 'a1') { p.armL = { p: 86, s: 6, e: 0 }; p.armR = { p: 84, s: 6, e: 0 }; p.lean = 30; p.legL = 26; p.legR = -20; p.kneeR = 24; }
  if (fr === 'aim') return zombiePose(L, 'i0');
  return p;
}

// ----- сборка модели -----
function buildFigure(L, P) {
  const g = new Uint8Array(VX.W * VX.D * VX.H), B = L.body, zom = L.kind === 'z';
  const hipZ = B.thigh + B.shin + 1.6 + P.bob;
  const hip = [0, 0, hipZ];
  // ноги
  for (const side of [-1, 1]) {
    const a = side < 0 ? P.legR : P.legL, k = side < 0 ? P.kneeR : P.kneeL;
    const h = [side * B.hipW, 0, hipZ], kn = vadd(h, vdown(a, B.thigh)), an = vadd(kn, vdown(a - k, B.shin));
    an[2] = Math.max(1.2, an[2]);
    vcap(g, h, kn, B.legR, C.PANTS);
    vcap(g, kn, an, B.legR * 0.86, C.PANTS);
    const toe = [an[0], an[1] + 2.3, Math.max(0.9, an[2] - 0.3)];
    vcap(g, [an[0], an[1] - 0.5, Math.max(1, an[2] - 0.4)], toe, B.legR * 0.78, C.BOOTS);
  }
  // корпус
  const lean = P.lean, chest = vadd(vadd(hip, vup(lean, B.torso)), [P.tilt, 0, 0]);
  vcap(g, vadd(hip, [0, 0, -0.6]), vadd(hip, vup(lean, 2.2)), B.tR * 1.04, C.PANTS, B.sx, B.sy);
  vcap(g, vadd(hip, vup(lean, 2.4)), chest, B.tR, C.TOP, B.sx, B.sy);
  vcap(g, vadd(hip, vup(lean, 2.2)), vadd(hip, vup(lean, 2.9)), B.tR * 1.06, C.BELT, B.sx, B.sy);
  if (!zom) {
    // разгрузка: полоса и подсумки
    vcap(g, vadd(hip, vup(lean, 5.5)), vadd(hip, vup(lean, 6.3)), B.tR * 1.05, C.TOP2, B.sx, B.sy);
    vcap(g, vadd(chest, [B.tR * 0.6, B.tR * B.sy * 0.85, -4.2]), vadd(chest, [B.tR * 0.6, B.tR * B.sy * 0.85, -3]), 1, C.TOP2);
    // рюкзак
    const back = vadd(chest, [0, -B.tR * B.sy - 1.7, -2.5]);
    vcap(g, vadd(back, [0, 0, -4.2]), back, 2.5, C.PACK, 1.25, 0.75);
    vcap(g, vadd(back, [0, -0.6, 0.4]), vadd(back, [0, -0.6, 0.9]), 2.1, C.TOP2, 1.3, 0.7);
  } else if (L.type === 'brute') {
    // светоотражающие полосы рабочего жилета
    vcap(g, vadd(hip, vup(lean, 5.6)), vadd(hip, vup(lean, 6.4)), B.tR * 1.04, C.STRIPE, B.sx, B.sy);
  }
  // шея и голова
  const neck = vadd(chest, vup(lean, 1.1));
  const hc = vadd(neck, vup(lean + P.head, B.head + 0.7));
  vcap(g, chest, neck, 1.3, C.SKIN);
  if (L.hair !== 0 || zom) vcap(g, vadd(hc, [0, -0.6, 0.45]), vadd(hc, [0, -0.6, 0.45]), B.head + 0.35, C.HAIR);
  vcap(g, vadd(hc, [0, 0.35, -0.35]), vadd(hc, [0, 0.35, -0.35]), B.head, C.SKIN);
  if (L.hair === 2 || L.female) vcap(g, vadd(hc, [0, -2.6, 0.8]), vadd(hc, [0, -3.4, -3.6]), 1.25, C.HAIR);
  if (L.beard) vcap(g, vadd(hc, [0, B.head * 0.7, -1.4]), vadd(hc, [0, B.head * 0.55, -2.4]), 1.5, C.HAIR);
  const face = vadd(hc, vpitch([0, B.head * 0.93, 0], 0));
  const eyeZ = zom && L.type === 'screamer' ? 0.6 : 0.3;
  vset(g, vadd(face, [-1.25, 0.2, eyeZ]), C.EYE); vset(g, vadd(face, [1.05, 0.2, eyeZ]), C.EYE);
  if (zom) {
    if (L.type === 'screamer') vcap(g, vadd(face, [0, 0.3, -1.4]), vadd(face, [0, 0.3, -2.2]), 1.05, C.MOUTH);
    else { vset(g, vadd(face, [-0.4, 0.3, -1.2]), C.MOUTH); vset(g, vadd(face, [0.6, 0.3, -1.2]), C.MOUTH); }
  }
  // руки
  const hands = {};
  for (const side of [-1, 1]) {
    const A = side < 0 ? P.armR : P.armL;
    const sh = vadd(chest, [side * B.sh, 0, -1.3]);
    const el = vadd(sh, armDir(side, A.p, A.s, B.upper));
    const fd = armDir(side, A.p + A.e, A.s * 0.5, B.fore);
    const ha = vadd(el, fd);
    vcap(g, sh, el, B.armR, zom && L.type === 'screamer' ? C.SKIN : C.TOP);
    vcap(g, el, ha, B.armR * 0.88, zom ? C.SKIN : C.TOP);
    if (!zom) vcap(g, sh, sh, B.armR + 0.75, C.TOP2);
    vcap(g, ha, vadd(ha, vmul(vnorm(fd), 0.8)), B.armR * 0.85, zom ? C.SKIN2 : C.SKIN);
    hands[side] = { pos: ha, dir: vnorm(fd) };
  }
  if (!zom) drawWeapon(g, L, P, hands, chest, hip);
  if (zom) rot(g, L.seed);
  return g;
}
function drawWeapon(g, L, P, H, chest, hip) {
  const R = H[-1], Lh = H[1], long = L.ranged === 'shotgun' || L.ranged === 'rifle';
  // длинное оружие за спиной, когда в руках не оно
  if (long && P.hold === 'melee') {
    vcap(g, vadd(chest, [-3.2, -3.6, -6]), vadd(chest, [3.2, -3.6, 3.5]), 0.6, C.METAL);
  }
  if (L.ranged === 'pistol' && P.hold === 'melee') vbox(g, vadd(hip, [-3.6, -0.6, -1.2]), vadd(hip, [-2.4, 1.2, 0.8]), C.BELT);
  if (P.hold === 'gun' && L.ranged) {
    if (L.ranged === 'pistol') {
      const d = P.aim ? [0, 1, 0] : vnorm(vpitch(R.dir, 70)), s = vadd(R.pos, vmul(d, 0.6));
      vcap(g, s, vadd(s, vmul(d, 3.2)), 0.65, C.METAL);
      vcap(g, s, vadd(s, [0, -0.4, -1.4]), 0.55, C.BELT);
    } else {
      let a, b;
      if (P.aim) { a = vadd(chest, [-1.6, 0.6, -1.4]); b = vadd(a, [0.3, 12.5, 0.3]); }
      else { a = vadd(R.pos, [0, -2.6, -1.4]); b = vadd(Lh.pos, vmul(vnorm(vsub(Lh.pos, R.pos)), 5)); }
      const m = vadd(a, vmul(vsub(b, a), 0.38));
      vcap(g, a, m, 0.95, C.WOOD);
      vcap(g, m, b, L.ranged === 'shotgun' ? 0.75 : 0.55, C.METAL);
      if (L.ranged === 'rifle') vcap(g, vadd(m, [0, 0.4, 0.9]), vadd(m, [0, 2.6, 0.9]), 0.55, C.METAL);
    }
    return;
  }
  const d = vnorm(vpitch(R.dir, P.mw)), s = R.pos;
  switch (L.melee) {
    case 'bat': vcap(g, s, vadd(s, vmul(d, 4)), 0.6, C.WOOD); vcap(g, vadd(s, vmul(d, 4)), vadd(s, vmul(d, 8)), 0.95, C.WOOD); break;
    case 'axe': {
      const e = vadd(s, vmul(d, 7));
      vcap(g, s, e, 0.55, C.WOOD);
      const side = vnorm([d[1] || 0.01, -d[0], 0]);
      vcap(g, e, vadd(e, vmul(vsub(side, vmul(d, 0.2)), 2.4)), 1.0, C.METAL);
      break;
    }
    case 'crowbar': { const e = vadd(s, vmul(d, 7)); vcap(g, s, e, 0.45, C.METAL); vcap(g, e, vadd(e, [0, -1.2, -0.8]), 0.45, C.METAL); break; }
    default: vcap(g, s, vadd(s, vmul(d, 2.8)), 0.45, C.METAL);
  }
}
// Рваная одежда и кровь у зомби
function rot(g, seed) {
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c !== C.TOP && c !== C.PANTS && c !== C.SKIN) continue;
    const h = hash2(i, seed, 5);
    if (c === C.SKIN) { if (h < 0.12) g[i] = C.SKIN2; continue; }
    if (h < 0.06) g[i] = C.SKIN2; else if (h < 0.11) g[i] = C.BLOOD;
  }
}

// ----- поверхность и освещение -----
function surfaceOf(g) {
  const out = [], W = VX.W, D = VX.D, H = VX.H, WD = W * D;
  for (let z = 0; z < H; z++) for (let y = 0; y < D; y++) for (let x = 0; x < W; x++) {
    const i = (z * D + y) * W + x, c = g[i];
    if (!c) continue;
    const xm = x === 0 || !g[i - 1], xp = x === W - 1 || !g[i + 1];
    const ym = y === 0 || !g[i - W], yp = y === D - 1 || !g[i + W];
    const zm = z === 0 || !g[i - WD], zp = z === H - 1 || !g[i + WD];
    if (!(xm || xp || ym || yp || zm || zp)) continue;
    let nx = (xp ? 1 : 0) - (xm ? 1 : 0), ny = (yp ? 1 : 0) - (ym ? 1 : 0), nz = (zp ? 1 : 0) - (zm ? 0.4 : 0);
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    let occ = 0;
    for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy && !dz) continue;
      if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) === 3) continue;
      const X = x + dx, Y = y + dy, Z = z + dz;
      if (X < 0 || Y < 0 || Z < 0 || X >= W || Y >= D || Z >= H) continue;
      if (g[(Z * D + Y) * W + X]) occ++;
    }
    out.push(x - VX.O + 0.5, y - VX.OD + 0.5, z + 0.5, c, nx, ny, nz, zp ? 1 : 0, occ);
  }
  return new Float32Array(out);
}
function shadeF(nx, ny, nz) { const d = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]; return 0.5 + 0.55 * (d * 0.5 + 0.5); }
function renderFigure(surf, pal, dir, s) {
  const yaw = YAWS[dir], cy = Math.cos(yaw), sy = Math.sin(yaw), sE = VX.sE, cE = VX.cE;
  const Wp = Math.ceil(2 * VREACH * s) + 6, oy = Math.ceil((VREACH * sE + VX.H * cE) * s) + 4;
  const Hp = oy + Math.ceil(VREACH * sE * s) + 6, ox = Wp >> 1;
  const img = new ImageData(Wp, Hp), px = img.data, zb = new Float32Array(Wp * Hp).fill(-1e9);
  for (let k = 0; k < surf.length; k += 9) {
    const mx = surf[k], my = surf[k + 1], zc = surf[k + 2], c = surf[k + 3];
    const nx = surf[k + 4], ny = surf[k + 5], nz = surf[k + 6], top = surf[k + 7], occ = surf[k + 8];
    const xr = mx * cy - my * sy, yr = mx * sy + my * cy;
    const nxr = nx * cy - ny * sy, nyr = nx * sy + ny * cy, hl = Math.hypot(nxr, nyr);
    const ao = clamp(1.14 - occ * 0.02, 0.76, 1.06) * (0.8 + 0.2 * Math.min(1, zc / 8));
    const fT = (top ? shadeF(0, 0, 1) : shadeF(nxr, nyr, nz)) * ao;
    const fS = (hl > 0.05 ? shadeF(nxr / hl, nyr / hl, 0) : shadeF(0, 1, 0)) * ao * 0.97;
    const col = pal[c] || [255, 0, 255];
    const glow = c === C.EYE && pal[C.EYE][0] > 200;
    const t0 = (yr - 0.5) * sE - (zc + 0.5) * cE, t1 = t0 + sE, t2 = t1 + cE;
    const x0 = Math.max(0, Math.floor(ox + (xr - 0.56) * s)), x1 = Math.min(Wp, Math.ceil(ox + (xr + 0.56) * s));
    const y0 = Math.max(0, Math.floor(oy + t0 * s)), y1 = Math.round(oy + t1 * s), y2 = Math.min(Hp, Math.ceil(oy + t2 * s));
    const dT = yr * cE + (zc + 0.5) * sE, dF = (yr + 0.5) * cE + zc * sE;
    const rT = glow ? col[0] : col[0] * fT, gT = glow ? col[1] : col[1] * fT, bT = glow ? col[2] : col[2] * fT;
    const rS = glow ? col[0] : col[0] * fS, gS = glow ? col[1] : col[1] * fS, bS = glow ? col[2] : col[2] * fS;
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
  // контур
  const edge = [];
  for (let yy = 1; yy < Hp - 1; yy++) for (let xx = 1; xx < Wp - 1; xx++) {
    const q = yy * Wp + xx;
    if (px[q * 4 + 3]) continue;
    if (px[(q - 1) * 4 + 3] || px[(q + 1) * 4 + 3] || px[(q - Wp) * 4 + 3] || px[(q + Wp) * 4 + 3]) edge.push(q);
  }
  for (const q of edge) { px[q * 4] = 20; px[q * 4 + 1] = 17; px[q * 4 + 2] = 13; px[q * 4 + 3] = 215; }
  let bx0 = Wp, by0 = Hp, bx1 = 0, by1 = 0;
  for (let yy = 0; yy < Hp; yy++) for (let xx = 0; xx < Wp; xx++) if (px[(yy * Wp + xx) * 4 + 3]) {
    if (xx < bx0) bx0 = xx; if (xx > bx1) bx1 = xx; if (yy < by0) by0 = yy; if (yy > by1) by1 = yy;
  }
  if (bx1 < bx0) { bx0 = by0 = 0; bx1 = by1 = 1; }
  const w = bx1 - bx0 + 1, h = by1 - by0 + 1;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  cv.getContext('2d').putImageData(img, -bx0, -by0);
  return { cv, ax: ox - bx0, ay: oy - by0, w, h, top: 0 };
}

// ----- кеш и отрисовка -----
const Spr = {
  models: new Map(), sprites: new Map(), looks: new Map(),
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
  get(L, fr, dir, s) {
    const key = L.key + '|' + fr + '|' + dir + '|' + s;
    let sp = this.sprites.get(key);
    if (sp) return sp;
    if (this.sprites.size > 1400) this.sprites.clear();
    const mk = L.key + '|' + fr;
    let surf = this.models.get(mk);
    if (!surf) {
      if (this.models.size > 400) this.models.clear();
      const P = L.kind === 'z' ? zombiePose(L, fr) : humanPose(L, fr);
      surf = surfaceOf(buildFigure(L, P));
      this.models.set(mk, surf);
    }
    sp = renderFigure(surf, L.pal, dir, s);
    this.sprites.set(key, sp);
    return sp;
  },
  // Рисует фигуру стопами в (cx, fy); возвращает y макушки
  draw(c, L, fr, dir, cx, fy, ts, sMax = CFG.hq ? 4 : 3) {
    const s = clamp(Math.round(ts * VSCALE * (R.dpr || 1)), 1, sMax);
    const sp = this.get(L, fr, dir, s), k = (ts * VSCALE) / s;
    c.imageSmoothingEnabled = k < 1;
    c.drawImage(sp.cv, cx - sp.ax * k, fy - sp.ay * k, sp.w * k, sp.h * k);
    c.imageSmoothingEnabled = true;
    return fy - sp.ay * k;
  },
};
function frameOf(e, now) {
  const a = e.anim;
  if (a) {
    const p = clamp((now - a.t0) / a.d, 0, 0.999);
    if (a.k === 'mv') return 'w' + (((e.step || 0) * 2 + Math.floor(p * 2)) % 4);
    if (a.k === 'lg') return p < 0.45 ? 'a0' : 'a1';
  }
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
  Spr.draw(c, L, 'i0', 3, W * 0.5, fy, ts, 6);
  R.dpr = dprSave;
}
