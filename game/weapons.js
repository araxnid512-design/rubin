// 20 процедурных моделей оружия. Оружие — самостоятельный 3D-объект из частей:
//   body   — корпус; mag — отделяемый магазин/короб/обойма; bolt — затвор, кожух, цевьё помпы, крышка ПКМ;
//   barrel — откидные стволы (переломка) или барабан (РГ-6).
// Локальная система оружия: начало — точка хвата правой руки, ствол вдоль −Z, верх +Y.
// Также: профили хвата (анимации держания) для 7 классов оружия.
import { V3, M3, Xf, clamp } from '../engine/math.js';
import { MeshBuilder, darken, lighten } from '../engine/mesh.js';
import { weapon } from './items.js';

const v = (x, y, z) => new V3(x, y, z);
const C = {
  METAL: [0.17, 0.17, 0.18, 0.2], DARK: [0.1, 0.1, 0.11, 0.2], PARK: [0.2, 0.21, 0.19, 0.2], PLUM: [0.36, 0.17, 0.12, 1.0],
  WOOD: [0.46, 0.27, 0.13, 0.4], WOOD_L: [0.55, 0.35, 0.18, 0.4], POLY: [0.13, 0.13, 0.12, 1.0], GLASS: [0.2, 0.3, 0.4, 0.7], OLIVE: [0.27, 0.3, 0.22, 0.2],
};
const rx = (a) => M3.rx(a);
const bx = (mb, c, s, col, r = 0) => mb.addBox(new Xf(rx(r), c), s, col);
const tube = (mb, z0, z1, y, r, col, x = 0, sides = 8) => mb.addCyl(new Xf(rx(-Math.PI / 2), v(x, y, z0)), r, r, z0 - z1, sides, col);

function pistol(b, mg, bo, length, h, w, aps, col) {
  const top = 0.045;
  bx(b, v(0, top - h * 0.75, -length * 0.38), v(w * 0.95, h * 0.6, length * 0.78), darken(col, 0.2));
  bx(b, v(0, -0.015, 0.012), v(w + 0.004, 0.09, 0.04), aps ? C.POLY : C.PLUM, -0.22);
  bx(b, v(0, 0, -0.035), v(0.008, 0.008, 0.045), C.DARK);
  bx(b, v(0, -0.012, -0.055), v(0.008, 0.03, 0.008), C.DARK);
  if (aps) bx(b, v(0, 0, 0.05), v(0.012, 0.06, 0.03), C.DARK);
  bx(bo, v(0, top, -length * 0.42), v(w, h, length), col);
  bx(bo, v(0, top + h * 0.55, -length * 0.85), v(0.006, 0.01, 0.01), C.DARK);
  for (let i = 0; i < 5; i++) bx(bo, v(w / 2, top, 0.03 - i * 0.008), v(0.003, h * 0.7, 0.004), C.DARK);
  tube(b, -length * 0.9, -length * 0.95, top, 0.006, C.DARK);
  const mo = v(0, -0.03, 0.018), ml = aps ? 0.11 : 0.075;
  bx(mg, v(0, -ml / 2 + 0.03, 0), v(w - 0.008, ml, 0.03), C.DARK, -0.22);
  bx(mg, v(0, -ml + 0.03, -0.012), v(w + 0.004, 0.01, 0.036), C.DARK, -0.22);
  return { hold: 'pistol', fore: v(-0.028, -0.025, 0.005), stock: v(0, 0.02, 0.1), muzzle: v(0, top, -length * 0.95), magOrigin: mo, magPt: mo.add(v(0, -ml + 0.02, 0)), boltAxis: v(0, 0, 0.035), boltPt: v(0, top, 0.025) };
}

function ak(b, mg, bo, p) {
  const fore = p.fore || C.PLUM, thick = p.thick ? 0.008 : 0, short = !!p.short;
  bx(b, v(0, 0.055, -0.1), v(0.048 + thick, 0.07, 0.4), C.METAL);
  bx(b, v(0, 0.094, -0.08), v(0.042 + thick, 0.012, 0.34), C.DARK);
  bx(b, v(0, 0.068, -0.31), v(0.04, 0.03, 0.04), C.DARK);
  bx(b, v(0, -0.02, 0.025), v(0.034, 0.11, 0.045), fore === C.WOOD ? C.PLUM : fore, -0.28);
  bx(b, v(0, 0, -0.035), v(0.01, 0.01, 0.07), C.DARK);
  bx(b, v(0.026, 0.06, -0.05), v(0.004, 0.025, 0.14), C.DARK);
  const stock = p.stock || 'plum';
  if (stock === 'plum' || stock === 'wood' || stock === 'poly') {
    const sc = stock === 'wood' ? C.WOOD : stock === 'poly' ? C.POLY : C.PLUM;
    bx(b, v(0, 0.035, 0.22), v(0.042, 0.085, 0.24), sc, 0.07); bx(b, v(0, 0.025, 0.345), v(0.046, 0.12, 0.02), C.DARK);
  } else if (stock === 'rpk') { bx(b, v(0, 0.03, 0.22), v(0.042, 0.11, 0.24), C.PLUM, 0.12); bx(b, v(0, 0, 0.345), v(0.046, 0.15, 0.02), C.DARK); }
  else if (stock === 'fold') {
    b.beam(v(0.012, 0.07, 0.1), v(0.012, 0.045, 0.42), 0.012, 0.02, C.DARK); b.beam(v(-0.012, 0.03, 0.1), v(-0.012, 0, 0.42), 0.012, 0.02, C.DARK);
    bx(b, v(0, 0.025, 0.43), v(0.03, 0.1, 0.025), C.DARK);
  }
  const stockZ = stock === 'fold' ? 0.43 : 0.35, bl = p.barrel || 0.42, foreLen = short ? 0.13 : 0.2;
  bx(b, v(0, 0.05, -0.31 - foreLen / 2), v(0.054 + thick, 0.058, foreLen), fore);
  if (!short) bx(b, v(0, 0.098, -0.31 - foreLen / 2), v(0.036, 0.03, foreLen), fore);
  const bz0 = -0.31 - foreLen, bz1 = -0.3 - bl;
  tube(b, bz0 + 0.02, bz1, 0.055, 0.011 + thick / 2, C.METAL);
  if (!short) { bx(b, v(0, 0.085, bz0 - 0.02), v(0.03, 0.05, 0.04), C.DARK); bx(b, v(0, 0.095, bz1 + 0.07), v(0.016, 0.045, 0.02), C.DARK); }
  if (p.an94) { bx(b, v(0, 0.12, bz1 + 0.08), v(0.02, 0.06, 0.03), C.DARK); bx(b, v(0, 0.02, -0.4), v(0.045, 0.04, 0.2), C.POLY); }
  if (p.muzzle === 'brake') tube(b, bz1, bz1 - 0.07, 0.055, 0.016, C.DARK);
  else if (p.muzzle === 'slant') tube(b, bz1, bz1 - 0.03, 0.055, 0.014, C.DARK);
  else if (p.muzzle === 'cone') tube(b, bz1, bz1 - 0.07, 0.055, 0.021, C.DARK);
  if (p.bipod) { b.beam(v(0.012, 0.045, bz1 + 0.12), v(0.016, 0.035, bz1 + 0.4), 0.01, 0.01, C.DARK); b.beam(v(-0.012, 0.045, bz1 + 0.12), v(-0.016, 0.035, bz1 + 0.4), 0.01, 0.01, C.DARK); }
  bx(bo, v(0.028, 0.072, -0.05), v(0.008, 0.022, 0.14), lighten(C.METAL, 0.1));
  bx(bo, v(0.04, 0.072, 0), v(0.025, 0.014, 0.014), lighten(C.METAL, 0.15));
  const mo = v(0, 0.02, -0.17); let mcol = darken(C.PLUM, 0.15);
  switch (p.mag) {
    case '545': case '545slant': bx(mg, v(0, -0.035, 0), v(0.03, 0.09, 0.065), mcol, 0.18); bx(mg, v(0, -0.11, -0.03), v(0.03, 0.09, 0.065), mcol, 0.45); break;
    case '762': mcol = [0.25, 0.22, 0.2, 0.2]; bx(mg, v(0, -0.035, 0), v(0.032, 0.09, 0.07), mcol, 0.15); bx(mg, v(0, -0.115, -0.025), v(0.032, 0.09, 0.07), mcol, 0.42); break;
    case '545long': bx(mg, v(0, -0.045, 0), v(0.03, 0.11, 0.065), mcol, 0.18); bx(mg, v(0, -0.15, -0.045), v(0.03, 0.13, 0.065), mcol, 0.45); break;
    case 'box12': bx(mg, v(0, -0.07, -0.01), v(0.04, 0.15, 0.09), C.POLY, 0.1); break;
  }
  return { hold: 'rifle', fore: v(0, 0.035, -0.31 - foreLen * 0.55), stock: v(0, 0.04, stockZ), muzzle: v(0, 0.055, bz1 - 0.07), magOrigin: mo, magPt: mo.add(v(0, -0.08, -0.02)), boltAxis: v(0, 0, 0.11), boltPt: v(0.045, 0.072, 0) };
}

function bizon(b, mg, bo) {
  const info = ak(b, new MeshBuilder(), bo, { stock: 'fold', barrel: 0.24, mag: 'none', fore: C.POLY, muzzle: 'none', short: true });
  const mo = v(0, 0, -0.2);
  mg.addCyl(new Xf(rx(-Math.PI / 2), v(0, 0, 0.12)), 0.032, 0.032, 0.36, 10, C.POLY);
  bx(mg, v(0, 0.03, 0.05), v(0.02, 0.03, 0.1), C.DARK);
  return { ...info, magOrigin: mo, magPt: mo.add(v(0, -0.02, -0.12)), fore: v(0, -0.02, -0.33) };
}
function kedr(b, mg, bo) {
  bx(b, v(0, 0.05, -0.08), v(0.036, 0.06, 0.28), C.DARK); bx(b, v(0, -0.015, 0.015), v(0.03, 0.1, 0.04), C.POLY, -0.15);
  bx(b, v(0, 0, -0.04), v(0.008, 0.008, 0.05), C.DARK); tube(b, -0.22, -0.3, 0.05, 0.01, C.METAL);
  b.beam(v(0, 0.07, 0.06), v(0, 0.07, 0.3), 0.01, 0.01, C.DARK); b.beam(v(0, 0, 0.06), v(0, 0, 0.3), 0.01, 0.01, C.DARK);
  bx(b, v(0, 0.035, 0.3), v(0.025, 0.09, 0.015), C.DARK);
  bx(bo, v(0.022, 0.07, -0.02), v(0.012, 0.014, 0.03), lighten(C.METAL, 0.15));
  const mo = v(0, 0.02, -0.08); bx(mg, v(0, -0.07, 0), v(0.025, 0.16, 0.035), C.DARK, 0.05);
  return { hold: 'smg', fore: v(0, -0.04, -0.09), stock: v(0, 0.035, 0.3), muzzle: v(0, 0.05, -0.31), magOrigin: mo, magPt: mo.add(v(0, -0.12, 0)), boltAxis: v(0, 0, 0.05), boltPt: v(0.03, 0.07, -0.02) };
}
function val(b, mg, bo, vss) {
  bx(b, v(0, 0.055, -0.08), v(0.046, 0.068, 0.34), C.METAL); bx(b, v(0, -0.02, 0.025), v(0.034, 0.11, 0.045), vss ? C.WOOD : C.POLY, -0.28);
  bx(b, v(0, 0, -0.035), v(0.01, 0.01, 0.07), C.DARK);
  tube(b, -0.25, -0.62, 0.055, 0.024, C.PARK, 0, 10); bx(b, v(0, 0.05, -0.32), v(0.056, 0.05, 0.14), vss ? C.WOOD : C.POLY);
  if (vss) {
    b.beam(v(0, 0.07, 0.08), v(0, 0.06, 0.4), 0.04, 0.035, C.WOOD); b.beam(v(0, -0.06, 0.07), v(0, -0.03, 0.4), 0.04, 0.03, C.WOOD);
    bx(b, v(0, 0.015, 0.41), v(0.045, 0.15, 0.03), C.DARK); tube(b, -0.02, -0.24, 0.13, 0.016, C.DARK, -0.025); tube(b, -0.24, -0.27, 0.13, 0.02, C.GLASS, -0.025);
  } else {
    b.beam(v(0.015, 0.07, 0.1), v(0.015, 0.05, 0.4), 0.01, 0.018, C.DARK); b.beam(v(-0.015, 0.07, 0.1), v(-0.015, 0.05, 0.4), 0.01, 0.018, C.DARK);
    bx(b, v(0, 0.04, 0.41), v(0.04, 0.1, 0.02), C.POLY);
  }
  bx(bo, v(0.028, 0.07, -0.04), v(0.008, 0.02, 0.12), lighten(C.METAL, 0.1)); bx(bo, v(0.04, 0.07, 0.01), v(0.022, 0.014, 0.014), lighten(C.METAL, 0.15));
  const mo = v(0, 0.02, -0.16); bx(mg, v(0, -0.05, 0), v(0.032, vss ? 0.07 : 0.11, 0.07), C.DARK, 0.12);
  return { hold: vss ? 'sniper' : 'rifle', fore: v(0, 0.03, -0.32), stock: v(0, 0.04, 0.41), muzzle: v(0, 0.055, -0.62), magOrigin: mo, magPt: mo.add(v(0, -0.07, 0)), boltAxis: v(0, 0, 0.09), boltPt: v(0.045, 0.07, 0.01) };
}
function sks(b, mg, bo) {
  bx(b, v(0, 0.02, 0.1), v(0.045, 0.1, 0.5), C.WOOD, 0.06); bx(b, v(0, 0.045, -0.3), v(0.05, 0.05, 0.3), C.WOOD);
  bx(b, v(0, 0.07, -0.08), v(0.04, 0.05, 0.22), C.METAL); bx(b, v(0, -0.01, -0.15), v(0.035, 0.05, 0.1), C.METAL); bx(b, v(0, 0, 0.36), v(0.048, 0.13, 0.02), C.DARK);
  tube(b, -0.2, -0.78, 0.07, 0.011, C.METAL); tube(b, -0.2, -0.5, 0.095, 0.009, C.METAL);
  b.beam(v(0, 0.035, -0.47), v(0, 0.035, -0.75), 0.008, 0.012, lighten(C.METAL, 0.2));
  bx(bo, v(0, 0.09, -0.05), v(0.03, 0.02, 0.12), lighten(C.METAL, 0.1)); bx(bo, v(0.035, 0.09, 0), v(0.03, 0.012, 0.012), lighten(C.METAL, 0.15));
  const mo = v(0, 0.12, -0.06); bx(mg, v(0, 0.02, 0), v(0.012, 0.05, 0.06), [0.7, 0.55, 0.25, 0.2]);
  return { hold: 'rifle', fore: v(0, 0.02, -0.32), stock: v(0, 0.02, 0.36), muzzle: v(0, 0.07, -0.78), magOrigin: mo, magPt: mo.add(v(0, 0.04, 0)), boltAxis: v(0, 0, 0.1), boltPt: v(0.045, 0.09, 0), clip: true };
}
function svd(b, mg, bo) {
  bx(b, v(0, 0.055, -0.1), v(0.044, 0.065, 0.42), C.METAL);
  b.beam(v(0, 0.08, 0.1), v(0, 0.07, 0.44), 0.04, 0.035, C.WOOD); b.beam(v(0, -0.06, 0.08), v(0, -0.04, 0.44), 0.04, 0.03, C.WOOD); b.beam(v(0, -0.06, 0.08), v(0, 0.04, 0.02), 0.035, 0.035, C.WOOD);
  bx(b, v(0, 0.08, 0.32), v(0.045, 0.03, 0.12), darken(C.WOOD, 0.1)); bx(b, v(0, 0.015, 0.45), v(0.046, 0.15, 0.03), C.DARK);
  bx(b, v(0, 0.055, -0.45), v(0.05, 0.06, 0.28), C.WOOD); tube(b, -0.59, -1.0, 0.055, 0.011, C.METAL); tube(b, -1.0, -1.08, 0.055, 0.014, C.DARK);
  tube(b, 0.1, -0.14, 0.135, 0.017, C.DARK, -0.03); tube(b, -0.14, -0.18, 0.135, 0.022, C.GLASS, -0.03); bx(b, v(-0.015, 0.1, -0.02), v(0.02, 0.05, 0.06), C.DARK);
  bx(bo, v(0.028, 0.07, -0.05), v(0.008, 0.02, 0.12), lighten(C.METAL, 0.1)); bx(bo, v(0.04, 0.07, 0), v(0.022, 0.014, 0.014), lighten(C.METAL, 0.15));
  const mo = v(0, 0.02, -0.16); bx(mg, v(0, -0.04, 0), v(0.03, 0.08, 0.06), C.DARK, 0.15);
  return { hold: 'sniper', fore: v(0, 0.035, -0.4), stock: v(0, 0.03, 0.46), muzzle: v(0, 0.055, -1.08), magOrigin: mo, magPt: mo.add(v(0, -0.07, 0)), boltAxis: v(0, 0, 0.1), boltPt: v(0.045, 0.07, 0) };
}
function mosin(b, mg, bo) {
  bx(b, v(0, 0.02, 0.14), v(0.045, 0.1, 0.42), C.WOOD, 0.08); bx(b, v(0, 0.04, -0.4), v(0.048, 0.05, 0.62), C.WOOD);
  bx(b, v(0, 0.07, -0.04), v(0.036, 0.04, 0.2), C.METAL); bx(b, v(0, -0.005, -0.1), v(0.03, 0.05, 0.08), C.METAL); bx(b, v(0, 0, 0.36), v(0.048, 0.13, 0.02), C.DARK);
  tube(b, -0.12, -1.12, 0.065, 0.011, C.METAL); tube(b, 0.06, -0.18, 0.14, 0.016, C.DARK, -0.02); tube(b, -0.18, -0.22, 0.14, 0.02, C.GLASS, -0.02);
  bx(bo, v(0, 0.08, 0.02), v(0.025, 0.025, 0.12), lighten(C.METAL, 0.15)); bo.beam(v(0, 0.08, 0.06), v(0.07, 0.04, 0.06), 0.012, 0.012, lighten(C.METAL, 0.15));
  bo.addCyl(new Xf(new M3(), v(0.07, 0.025, 0.06)), 0.015, 0.015, 0.025, 6, lighten(C.METAL, 0.15));
  const mo = v(0, 0.12, -0.05); bx(mg, v(0, 0.02, 0), v(0.012, 0.05, 0.06), [0.7, 0.55, 0.25, 0.2]);
  return { hold: 'sniper', fore: v(0, 0.02, -0.38), stock: v(0, 0.02, 0.36), muzzle: v(0, 0.065, -1.12), magOrigin: mo, magPt: mo.add(v(0, 0.04, 0)), boltAxis: v(0, 0, 0.09), boltRot: v(0, 0, -1.2), boltCenter: v(0, 0.08, 0), boltPt: v(0.07, 0.04, 0.06), clip: true };
}
function toz(b, br) {
  bx(b, v(0, 0.05, -0.04), v(0.05, 0.07, 0.1), C.METAL); bx(b, v(0, 0.02, 0.18), v(0.045, 0.1, 0.34), C.WOOD_L, 0.12);
  bx(b, v(0, 0, 0.36), v(0.048, 0.14, 0.02), C.DARK); bx(b, v(0, 0, -0.035), v(0.01, 0.01, 0.06), C.DARK);
  tube(br, 0, -0.64, 0.045, 0.014, C.METAL); tube(br, 0, -0.64, 0.015, 0.014, C.METAL); bx(br, v(0, 0, -0.22), v(0.04, 0.04, 0.24), C.WOOD_L);
  return { hold: 'shotgun', fore: v(0, 0.02, -0.3), stock: v(0, 0.03, 0.37), muzzle: v(0, 0.06, -0.73), barrelPivot: v(0, 0.03, -0.09), barrelAxis: v(1, 0, 0), magPt: v(0, 0.06, -0.08), breakAction: true };
}
function ks23(b, bo) {
  bx(b, v(0, 0.055, -0.06), v(0.052, 0.08, 0.2), C.METAL); bx(b, v(0, -0.02, 0.025), v(0.034, 0.11, 0.045), C.POLY, -0.25);
  bx(b, v(0, 0.03, 0.22), v(0.045, 0.1, 0.3), C.WOOD, 0.08); bx(b, v(0, 0.01, 0.37), v(0.048, 0.14, 0.02), C.DARK);
  tube(b, -0.15, -0.72, 0.07, 0.019, C.METAL); tube(b, -0.15, -0.6, 0.03, 0.014, C.DARK);
  bx(bo, v(0, 0.035, -0.38), v(0.05, 0.05, 0.16), C.WOOD);
  return { hold: 'shotgun', fore: v(0, 0.02, -0.38), stock: v(0, 0.03, 0.37), muzzle: v(0, 0.07, -0.72), boltAxis: v(0, 0, 0.12), boltPt: v(0, 0.02, -0.38), magPt: v(0, 0, -0.06) };
}
function pkm(b, mg, bo) {
  bx(b, v(0, 0.06, -0.12), v(0.06, 0.085, 0.44), C.DARK); bx(b, v(0, -0.02, 0.03), v(0.035, 0.11, 0.045), C.PLUM, -0.25);
  b.beam(v(0, 0.07, 0.1), v(0, 0.06, 0.42), 0.035, 0.03, C.WOOD); b.beam(v(0, 0, 0.12), v(0, -0.02, 0.42), 0.035, 0.025, C.WOOD);
  bx(b, v(0, 0.03, 0.43), v(0.045, 0.13, 0.03), C.DARK); tube(b, -0.34, -0.94, 0.07, 0.016, C.METAL); tube(b, -0.34, -0.7, 0.035, 0.012, C.DARK);
  tube(b, -0.94, -1.01, 0.07, 0.02, C.DARK); bx(b, v(0, 0.04, -0.3), v(0.05, 0.05, 0.12), C.WOOD);
  b.beam(v(0.012, 0.04, -0.7), v(0.016, 0.03, -0.42), 0.01, 0.01, C.DARK); b.beam(v(-0.012, 0.04, -0.7), v(-0.016, 0.03, -0.42), 0.01, 0.01, C.DARK);
  b.beam(v(0, 0.12, -0.22), v(0, 0.15, -0.3), 0.02, 0.02, C.WOOD);
  bx(bo, v(0, 0, 0.12), v(0.058, 0.02, 0.24), C.METAL);
  const mo = v(0, 0, -0.12); bx(mg, v(0, -0.06, 0), v(0.09, 0.12, 0.13), C.OLIVE); bx(mg, v(0.05, 0.05, 0), v(0.05, 0.02, 0.04), [0.7, 0.5, 0.2, 0.2]);
  return { hold: 'mg', fore: v(0, 0, -0.3), stock: v(0, 0.03, 0.44), muzzle: v(0, 0.07, -1.01), magOrigin: mo, magPt: mo.add(v(0, -0.1, 0)), boltRot: v(-1.1, 0, 0), boltPivot: v(0, 0.11, -0.12), boltPt: v(0, 0.12, -0.05), cover: true };
}
function rg6(b, br) {
  bx(b, v(0, -0.02, 0.025), v(0.036, 0.11, 0.05), C.POLY, -0.2); bx(b, v(0, 0.07, 0), v(0.05, 0.05, 0.12), C.DARK);
  b.beam(v(0, 0.08, 0.06), v(0, 0.07, 0.42), 0.03, 0.03, C.DARK); b.beam(v(0, 0, 0.06), v(0, -0.02, 0.42), 0.02, 0.02, C.DARK);
  bx(b, v(0, 0.02, 0.43), v(0.05, 0.14, 0.04), C.POLY); tube(b, -0.36, -0.62, 0.1, 0.028, C.OLIVE, 0, 10);
  tube(b, -0.04, -0.06, 0.1, 0.09, C.DARK, 0, 10); tube(b, -0.3, -0.33, 0.1, 0.09, C.DARK, 0, 10);
  bx(b, v(0, -0.05, -0.45), v(0.035, 0.12, 0.04), C.POLY, 0.25); bx(b, v(-0.04, 0.2, -0.2), v(0.02, 0.05, 0.08), C.DARK);
  br.addCyl(new Xf(rx(-Math.PI / 2), v(0, 0, 0.12)), 0.085, 0.085, 0.24, 6, C.OLIVE, true, false);
  for (let i = 0; i < 6; i++) { const a = Math.PI * 2 * i / 6; br.addCyl(new Xf(rx(-Math.PI / 2), v(Math.cos(a) * 0.055, Math.sin(a) * 0.055, 0.125)), 0.022, 0.022, 0.01, 8, C.DARK); }
  return { hold: 'launcher', fore: v(0, -0.07, -0.45), stock: v(0, 0.03, 0.44), muzzle: v(0, 0.1, -0.62), barrelPivot: v(0, 0.1, -0.18), barrelAxis: v(0, 0, 1), magPt: v(0, 0.1, -0.06), drum: true };
}

const cache = {};
export function weaponModel(r, id) {
  if (cache[id]) return cache[id];
  const b = new MeshBuilder(), mg = new MeshBuilder(), bo = new MeshBuilder(), br = new MeshBuilder();
  let info;
  switch (id) {
    case 'pm': info = pistol(b, mg, bo, 0.16, 0.032, 0.028, false, C.METAL); break;
    case 'aps': info = pistol(b, mg, bo, 0.22, 0.036, 0.03, true, C.DARK); break;
    case 'tt': info = pistol(b, mg, bo, 0.19, 0.034, 0.028, false, [0.22, 0.22, 0.24, 0.2]); break;
    case 'aks74u': info = ak(b, mg, bo, { stock: 'fold', barrel: 0.2, mag: '545', fore: C.PLUM, muzzle: 'cone', short: true }); break;
    case 'ak74': info = ak(b, mg, bo, { stock: 'plum', barrel: 0.42, mag: '545', fore: C.PLUM, muzzle: 'brake' }); break;
    case 'akm': info = ak(b, mg, bo, { stock: 'wood', barrel: 0.4, mag: '762', fore: C.WOOD, muzzle: 'slant' }); break;
    case 'an94': info = ak(b, mg, bo, { stock: 'poly', barrel: 0.45, mag: '545slant', fore: C.POLY, muzzle: 'brake', an94: true }); break;
    case 'rpk74': info = ak(b, mg, bo, { stock: 'rpk', barrel: 0.62, mag: '545long', fore: C.PLUM, muzzle: 'brake', bipod: true }); break;
    case 'saiga': info = ak(b, mg, bo, { stock: 'fold', barrel: 0.36, mag: 'box12', fore: C.POLY, muzzle: 'none', thick: true }); break;
    case 'bizon': info = bizon(b, mg, bo); break;
    case 'kedr': info = kedr(b, mg, bo); break;
    case 'val': info = val(b, mg, bo, false); break;
    case 'vss': info = val(b, mg, bo, true); break;
    case 'sks': info = sks(b, mg, bo); break;
    case 'svd': info = svd(b, mg, bo); break;
    case 'mosin': info = mosin(b, mg, bo); break;
    case 'toz34': info = toz(b, br); break;
    case 'ks23': info = ks23(b, bo); break;
    case 'pkm': info = pkm(b, mg, bo); break;
    case 'rg6': info = rg6(b, br); break;
    default: info = pistol(b, mg, bo, 0.16, 0.032, 0.028, false, C.METAL);
  }
  const mk = (mb) => (mb.isEmpty() ? null : r.createMesh(mb.data()));
  const z = v();
  info = { fore: z, stock: z, muzzle: z, magOrigin: z, magPt: z, boltAxis: z, boltPt: z, barrelPivot: z, barrelAxis: v(1, 0, 0), ...info };
  info.mesh = { body: mk(b), mag: mk(mg), bolt: mk(bo), barrel: mk(br) };
  cache[id] = info;
  return info;
}

// ------------------------------------------------------------------ профили хвата
// Позиции — в системе грудной кости (м), направления — туда же.
// g — точка хвата правой руки, f — направление ствола, r — крен.
// Состояния: idle (01, 20), low — низкая готовность (02), carry — опущено (03), aim — прицел (04, 05), inspect — осмотр (18, 19).
export const HOLD = {
  pistol: { idle: { g: v(0.06, -0.34, -0.24), f: v(-0.1, -0.75, -0.65) }, low: { g: v(0.05, -0.16, -0.36), f: v(-0.05, -0.55, -0.83) }, carry: { g: v(0.2, -0.5, -0.06), f: v(0, -0.6, -0.8), oneHand: true },
    inspect: { g: v(0.02, -0.02, -0.36), f: v(-0.6, 0.35, -0.72), r: 1.2 }, aim: { mode: 'extended', reach: 0.5 }, twist: -0.18, heavy: 0, eyeDrop: 0 },
  smg: { idle: { g: v(0.15, -0.1, -0.22), f: v(-0.62, -0.18, -0.76) }, low: { g: v(0.15, -0.07, -0.26), f: v(-0.2, -0.48, -0.85) }, carry: { g: v(0.19, -0.24, -0.13), f: v(-0.12, -0.82, -0.55) },
    inspect: { g: v(0.05, 0, -0.32), f: v(-0.75, 0.12, -0.64), r: 1.0 }, aim: { mode: 'shoulder', anchor: v(0.15, 0.2, -0.05) }, twist: -0.5, heavy: 0, eyeDrop: 0 },
  rifle: { idle: { g: v(0.16, -0.1, -0.22), f: v(-0.62, -0.16, -0.77) }, low: { g: v(0.16, -0.08, -0.27), f: v(-0.18, -0.5, -0.85) }, carry: { g: v(0.2, -0.24, -0.14), f: v(-0.12, -0.82, -0.55) },
    inspect: { g: v(0.06, 0, -0.34), f: v(-0.75, 0.1, -0.65), r: 1.0 }, aim: { mode: 'shoulder', anchor: v(0.16, 0.19, -0.03) }, twist: -0.62, heavy: 0, eyeDrop: 0 },
  sniper: { idle: { g: v(0.16, -0.11, -0.22), f: v(-0.58, -0.22, -0.78) }, low: { g: v(0.16, -0.1, -0.25), f: v(-0.15, -0.6, -0.78) }, carry: { g: v(0.21, -0.26, -0.12), f: v(-0.1, -0.86, -0.5) },
    inspect: { g: v(0.06, 0.02, -0.34), f: v(-0.72, 0.12, -0.68), r: 0.9 }, aim: { mode: 'shoulder', anchor: v(0.15, 0.17, -0.02) }, twist: -0.7, heavy: 0, eyeDrop: 0.04 },
  shotgun: { idle: { g: v(0.16, -0.1, -0.22), f: v(-0.6, -0.18, -0.78) }, low: { g: v(0.16, -0.09, -0.26), f: v(-0.2, -0.5, -0.84) }, carry: { g: v(0.2, -0.24, -0.14), f: v(-0.12, -0.82, -0.55) },
    inspect: { g: v(0.06, 0, -0.34), f: v(-0.75, 0.15, -0.64), r: 0.8 }, aim: { mode: 'shoulder', anchor: v(0.16, 0.19, -0.03) }, twist: -0.6, heavy: 0, eyeDrop: 0 },
  mg: { idle: { g: v(0.18, -0.24, -0.2), f: v(-0.3, -0.3, -0.9) }, low: { g: v(0.18, -0.24, -0.24), f: v(-0.12, -0.25, -0.96) }, carry: { g: v(0.2, -0.3, -0.16), f: v(-0.1, -0.55, -0.83) },
    inspect: { g: v(0.1, -0.12, -0.3), f: v(-0.7, 0, -0.7), r: 0.6 }, aim: { mode: 'hip', anchor: v(0.17, -0.27, -0.32) }, twist: -0.32, heavy: 0.08, eyeDrop: 0 },
  launcher: { idle: { g: v(0.16, -0.18, -0.24), f: v(-0.35, -0.25, -0.9) }, low: { g: v(0.17, -0.14, -0.27), f: v(-0.15, -0.3, -0.94) }, carry: { g: v(0.2, -0.26, -0.18), f: v(-0.1, -0.6, -0.8) },
    inspect: { g: v(0.06, -0.04, -0.34), f: v(-0.72, 0.05, -0.7), r: 0.7 }, aim: { mode: 'shoulder', anchor: v(0.15, 0.15, -0.05) }, twist: -0.5, heavy: 0.06, eyeDrop: 0.06 },
};

// ------------------------------------------------------------------ оружие в руках: подвижные части
export class WeaponView {
  constructor(r, id) {
    this.id = id; this.info = weaponModel(r, id);
    const w = weapon(id); this.hold = w.hold; this.reloadKind = w.reload;
    this.boltT = 0; this.openT = 0; this.drum = 0; this.drumTarget = 0; this.kick = 0;
    this.magState = 0; this.magHand = new Xf();
    this.xf = new Xf(); this.visible = true;
  }
  pt(name) { return this.info[name]; }
  onFire() {
    if (['mag', 'pistol', 'box', 'clip'].includes(this.reloadKind) && this.info.mesh.bolt && this.id !== 'mosin') this.kick = 1;
    if (this.info.drum) this.drumTarget += Math.PI / 3;
  }
  update(dt) { this.kick = Math.max(0, this.kick - dt * 14); this.drum += (this.drumTarget - this.drum) * clamp(dt * 14, 0, 1); }
  // локальные трансформации частей (в системе оружия)
  partXf(part) {
    const i = this.info;
    if (part === 'mag') return this.magState === 0 ? new Xf(new M3(), i.magOrigin) : this.magState === 1 ? this.magHand : null;
    if (part === 'bolt') {
      const t = Math.max(this.boltT, this.kick * 0.9);
      if (i.boltPivot && i.boltRot) return new Xf(M3.rx(i.boltRot.x * this.openT), i.boltPivot);
      if (i.boltRot) {
        const c = i.boltCenter || v(), k = clamp(t * 2, 0, 1), b = M3.rz(-i.boltRot.z * k);
        return new Xf(new M3(), i.boltAxis.mul(clamp(t * 2 - 1, 0, 1)).add(c)).mul(new Xf(b, v())).mul(new Xf(new M3(), c.neg()));
      }
      return new Xf(new M3(), i.boltAxis.mul(t));
    }
    if (part === 'barrel') {
      if (i.drum) return new Xf(M3.axis(i.barrelAxis, this.drum), i.barrelPivot.add(v(0.09 * this.openT, 0, 0)));
      return new Xf(M3.axis(i.barrelAxis, -0.55 * this.openT), i.barrelPivot);
    }
    return new Xf();
  }
}
export const HOLD_CLASSES = Object.keys(HOLD);
