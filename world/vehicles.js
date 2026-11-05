// Процедурные модели 9 машин по фото-референсам (references/tripo/models/veh_*.jpg).
// Вперёд — −Z, земля — y = 0. Башня — отдельный меш (поворачивается к цели), её ось — turretAt, дуло — muzzle (в системе башни).
import { V3, M3, Xf } from '../engine/math.js';
import { MeshBuilder, MAT } from '../engine/mesh.js';

const v = (x = 0, y = 0, z = 0) => new V3(x, y, z);
const PI = Math.PI;
const PAL = {
  friendly: { body: [0.34, 0.37, 0.24, MAT.PAINT], dark: [0.24, 0.26, 0.18, MAT.PAINT], cloth: [0.46, 0.45, 0.3, MAT.CLOTH], mark: [0.85, 0.82, 0.7, MAT.PAINT] },
  enemy: { body: [0.3, 0.3, 0.31, MAT.PAINT], dark: [0.2, 0.2, 0.21, MAT.PAINT], cloth: [0.42, 0.22, 0.17, MAT.CLOTH], mark: [0.62, 0.18, 0.13, MAT.PAINT] },
};
const RUB = [0.08, 0.08, 0.08, MAT.RUBBER], HUB = [0.3, 0.3, 0.29, MAT.RUST], GLASS = [0.2, 0.27, 0.3, MAT.GLASS], LAMP = [0.95, 0.9, 0.7, MAT.LAMP];
const STEEL = [0.36, 0.36, 0.35, MAT.RUST], YEL = [0.8, 0.63, 0.13, MAT.PAINT], BLK = [0.12, 0.12, 0.12, MAT.PAINT], RED = [0.7, 0.14, 0.1, MAT.LAMP];

const B = (mb, x, y, z, sx, sy, sz, col, rx = 0) => mb.addBox(new Xf(rx ? M3.rx(rx) : new M3(), v(x, y, z)), v(sx, sy, sz), col);
function wheel(mb, x, y, z, r, w, hubK = 0.55) {
  const s = Math.sign(x) || 1;
  mb.addCyl(new Xf(M3.rz(PI / 2), v(x + w / 2, y, z)), r, r, w, 14, RUB);
  mb.addCyl(new Xf(M3.rz(PI / 2), v(x + s * 0.02 + w / 2, y, z)), r * hubK, r * hubK, w + 0.04, 8, HUB);
}
function axle(mb, z, r, w, half, y = r) { wheel(mb, -half, y, z, r, w); wheel(mb, half, y, z, r, w); }
function lights(mb, z, y, half) { for (const s of [-1, 1]) mb.addCyl(new Xf(M3.rx(-PI / 2), v(s * half, y, z)), 0.11, 0.11, 0.06, 10, LAMP); }
// гусеница: лента + катки + ведущие колёса
function track(mb, x, len, h, w, col) {
  B(mb, x, h * 0.55, 0, w, h * 0.7, len, RUB);
  for (let i = 0; i < 5; i++) { const z = -len / 2 + 0.55 + i * (len - 1.1) / 4; mb.addCyl(new Xf(M3.rz(PI / 2), v(x + w / 2 + 0.03, h * 0.42, z)), h * 0.34, h * 0.34, w + 0.06, 10, STEEL); }
  for (const z of [-len / 2 + 0.25, len / 2 - 0.25]) mb.addCyl(new Xf(M3.rz(PI / 2), v(x + w / 2 + 0.04, h * 0.62, z)), h * 0.3, h * 0.3, w + 0.08, 10, col);
}

export function vehicleModel(id, faction = 'friendly') {
  const P = PAL[faction] || PAL.friendly, body = new MeshBuilder(), tur = new MeshBuilder();
  let turretAt = null, muzzle = null;
  switch (id) {
    case 'veh_motorcycle': {
      wheel(body, 0.06, 0.33, -0.72, 0.33, 0.12, 0.35); wheel(body, 0.06, 0.33, 0.72, 0.33, 0.12, 0.35);
      body.cylBetween(v(0, 0.36, -0.72), v(0, 1.02, -0.45), 0.03, 0.03, 6, STEEL); body.cylBetween(v(-0.36, 1.05, -0.42), v(0.36, 1.05, -0.42), 0.02, 0.02, 6, BLK);
      B(body, 0, 0.62, 0, 0.22, 0.24, 1.0, STEEL); B(body, 0, 0.86, -0.16, 0.3, 0.2, 0.5, P.body); B(body, 0, 0.84, 0.32, 0.26, 0.1, 0.55, BLK);
      B(body, 0, 0.42, 0.05, 0.28, 0.26, 0.4, STEEL); B(body, 0.25, 0.62, 0.62, 0.16, 0.28, 0.4, P.cloth); B(body, -0.25, 0.62, 0.62, 0.16, 0.28, 0.4, P.cloth);
      B(body, 0, 0.78, -0.86, 0.36, 0.06, 0.3, P.body); body.addCyl(new Xf(M3.rx(-PI / 2), v(0, 0.98, -0.56)), 0.08, 0.08, 0.06, 10, LAMP);
      B(body, 0, 0.9, -0.17, 0.02, 0.12, 0.12, P.mark); break;
    }
    case 'veh_light_car': {
      axle(body, -1.35, 0.36, 0.24, 0.78); axle(body, 1.3, 0.36, 0.24, 0.78);
      B(body, 0, 0.62, 0, 1.62, 0.5, 4.1, P.body); B(body, 0, 0.92, -1.35, 1.2, 0.24, 1.3, P.body);
      for (const s of [-1, 1]) { B(body, s * 0.8, 0.64, -1.35, 0.36, 0.42, 0.95, P.dark); B(body, s * 0.8, 0.64, 1.32, 0.36, 0.42, 0.95, P.dark); }
      B(body, 0, 1.18, 0.25, 1.48, 0.54, 2.0, P.body); B(body, 0, 1.18, 0.25, 1.52, 0.36, 1.7, GLASS); B(body, 0, 1.47, 0.25, 1.4, 0.06, 1.85, P.body);
      B(body, 0, 0.6, -2.08, 0.9, 0.34, 0.1, STEEL); B(body, 0, 0.38, -2.12, 1.6, 0.1, 0.12, STEEL); B(body, 0, 0.38, 2.08, 1.6, 0.1, 0.12, STEEL);
      lights(body, -2.06, 0.82, 0.6); B(body, 0, 1.0, 0.25, 0.03, 0.25, 0.25, P.mark); break;
    }
    case 'veh_utility_car': {
      axle(body, -1.4, 0.44, 0.3, 0.86); axle(body, 1.35, 0.44, 0.3, 0.86);
      B(body, 0, 0.78, 0, 1.75, 0.42, 4.3, P.dark); B(body, 0, 1.08, -1.55, 1.7, 0.5, 1.2, P.body); B(body, 0, 1.0, -2.2, 1.2, 0.5, 0.14, STEEL);
      B(body, 0, 1.55, -0.55, 1.7, 1.0, 1.1, P.body); B(body, 0, 1.68, -0.55, 1.74, 0.42, 0.9, GLASS); B(body, 0, 1.68, -1.12, 1.4, 0.4, 0.04, GLASS);
      for (const s of [-1, 1]) B(body, s * 0.85, 1.3, 1.0, 0.08, 0.6, 2.2, P.body); B(body, 0, 1.3, 2.1, 1.75, 0.6, 0.08, P.body); B(body, 0, 1.02, 1.0, 1.7, 0.06, 2.2, P.dark);
      for (const s of [-1, 1]) { B(body, s * 0.9, 0.95, -1.4, 0.3, 0.2, 1.0, P.body); B(body, s * 0.9, 0.95, 1.35, 0.3, 0.2, 1.0, P.body); }
      lights(body, -2.28, 1.1, 0.62); B(body, 0.88, 1.5, -0.55, 0.03, 0.3, 0.3, P.mark); break;
    }
    case 'veh_cargo_truck': case 'veh_fuel_tanker': {
      const tank = id === 'veh_fuel_tanker';
      axle(body, -2.4, 0.52, 0.34, 1.0); axle(body, 1.2, 0.52, 0.34, 1.0); axle(body, 2.5, 0.52, 0.34, 1.0);
      B(body, 0, 0.82, 0, 1.3, 0.3, 7.0, P.dark); B(body, 0, 1.25, -2.85, 2.0, 0.7, 1.4, P.body); B(body, 0, 1.0, -3.6, 1.6, 0.6, 0.12, STEEL);
      B(body, 0, 2.05, -2.2, 2.2, 1.2, 1.5, P.body); B(body, 0, 2.2, -2.2, 2.24, 0.5, 1.2, GLASS); B(body, 0, 2.2, -2.96, 1.9, 0.48, 0.04, GLASS);
      for (const s of [-1, 1]) { B(body, s * 1.05, 1.15, -2.4, 0.3, 0.2, 1.2, P.body); B(body, s * 1.1, 1.1, 1.85, 0.25, 0.2, 2.6, P.body); }
      lights(body, -3.58, 1.25, 0.75);
      if (tank) {
        body.addCyl(new Xf(M3.rx(PI / 2), v(0, 2.05, -1.3)), 1.05, 1.05, 4.6, 16, P.body);
        for (const z of [-0.6, 1.2, 2.8]) body.addCyl(new Xf(M3.rx(PI / 2), v(0, 2.05, z - 0.05)), 1.09, 1.09, 0.1, 16, P.dark);
        body.addCyl(new Xf(new M3(), v(0, 3.0, 1.0)), 0.25, 0.25, 0.2, 10, STEEL); B(body, 0, 3.15, 1.0, 1.2, 0.05, 2.6, STEEL);
        B(body, 1.08, 2.05, 1.0, 0.02, 0.18, 3.6, P.mark);
      } else {
        B(body, 0, 1.15, 1.0, 2.3, 0.12, 4.6, P.dark);
        for (const s of [-1, 1]) B(body, s * 1.12, 1.55, 1.0, 0.08, 0.7, 4.6, P.body); B(body, 0, 1.55, 3.28, 2.3, 0.7, 0.08, P.body);
        B(body, 0, 2.55, 1.0, 2.36, 1.3, 4.5, P.cloth); body.addCyl(new Xf(M3.rx(PI / 2), v(0, 3.15, -1.25)), 1.18, 1.18, 4.5, 12, P.cloth);
        B(body, 1.19, 2.3, 1.0, 0.02, 0.4, 0.7, P.mark);
      }
      break;
    }
    case 'veh_scrap_harvester': {
      axle(body, -1.9, 0.62, 0.4, 1.15); axle(body, 0.9, 0.62, 0.4, 1.15); axle(body, 2.3, 0.62, 0.4, 1.15);
      B(body, 0, 1.0, 0.2, 2.2, 0.5, 6.0, P.dark); B(body, 0, 1.55, -1.6, 2.3, 0.9, 1.8, YEL);
      B(body, -0.5, 2.5, -1.7, 1.3, 1.1, 1.3, YEL); B(body, -0.5, 2.6, -1.7, 1.34, 0.6, 1.0, GLASS);
      B(body, 0, 1.95, 1.4, 2.6, 1.4, 3.0, YEL); B(body, 0, 2.62, 1.4, 2.4, 0.1, 2.8, [0.35, 0.3, 0.25, MAT.RUST]);
      for (let i = 0; i < 6; i++) B(body, -0.8 + (i % 3) * 0.8, 2.75, 0.5 + Math.floor(i / 3) * 1.6, 0.5, 0.3, 0.6, [0.42, 0.36, 0.3, MAT.RUST]);
      for (let i = 0; i < 6; i++) B(body, -1.32 + i * 0.53, 0.62, -3.35, 0.12, 0.7, 0.6, BLK); B(body, 0, 0.7, -3.25, 3.0, 0.15, 0.9, YEL, -0.5);
      body.cylBetween(v(0.6, 2.2, -0.9), v(0.9, 4.2, -1.8), 0.14, 0.12, 8, YEL); body.cylBetween(v(0.9, 4.2, -1.8), v(0.9, 2.6, -3.4), 0.12, 0.1, 8, YEL);
      for (const a of [-0.5, 0.5]) body.cylBetween(v(0.9, 2.6, -3.4), v(0.9 + a, 1.9, -3.7), 0.06, 0.04, 6, BLK);
      lights(body, -2.52, 1.6, 0.85); break;
    }
    case 'veh_armored_scout': {
      axle(body, -1.55, 0.55, 0.36, 1.0); axle(body, 1.5, 0.55, 0.36, 1.0);
      B(body, 0, 1.15, 0, 2.0, 0.9, 4.6, P.body); B(body, 0, 1.5, -1.95, 1.8, 0.5, 0.9, P.body, 0.45); B(body, 0, 1.5, 1.95, 1.8, 0.5, 0.9, P.body, -0.45);
      B(body, 0, 1.78, -0.2, 1.7, 0.5, 2.4, P.body); B(body, 0, 1.82, -1.42, 1.0, 0.12, 0.05, BLK);
      for (const s of [-1, 1]) { B(body, s * 1.03, 1.0, -1.55, 0.2, 0.25, 1.3, P.dark); B(body, s * 1.03, 1.0, 1.5, 0.2, 0.25, 1.3, P.dark); B(body, s * 1.01, 1.3, 0, 0.02, 0.3, 0.4, P.mark); }
      lights(body, -2.3, 1.25, 0.7);
      turretAt = v(0, 2.03, 0.1);
      tur.addCyl(new Xf(new M3(), v(0, 0, 0)), 0.55, 0.48, 0.42, 10, P.body); B(tur, 0, 0.3, 0.05, 0.5, 0.28, 0.5, P.dark);
      tur.cylBetween(v(0, 0.48, -0.1), v(0, 0.52, -1.2), 0.045, 0.04, 6, BLK); B(tur, 0, 0.45, -0.25, 0.22, 0.2, 0.4, BLK);
      muzzle = v(0, 0.52, -1.25); break;
    }
    case 'veh_light_tank': {
      for (const s of [-1, 1]) track(body, s * 1.12, 5.4, 1.0, 0.5, P.dark);
      B(body, 0, 1.05, 0, 1.8, 0.8, 5.0, P.body); B(body, 0, 1.25, -2.5, 1.8, 0.5, 0.6, P.body, 0.6); B(body, 0, 1.52, 0.3, 2.7, 0.08, 4.4, P.dark);
      B(body, 0, 1.6, 1.9, 1.4, 0.2, 1.2, P.dark); for (const s of [-1, 1]) B(body, s * 0.6, 1.4, -2.25, 0.25, 0.2, 0.15, LAMP);
      turretAt = v(0, 1.56, -0.1);
      tur.addCyl(new Xf(new M3(), v(0, 0, 0.1)), 0.9, 0.8, 0.72, 12, P.body); B(tur, 0, 0.36, 0.55, 1.1, 0.5, 0.8, P.body);
      tur.addCyl(new Xf(new M3(), v(0.2, 0.72, 0.25)), 0.3, 0.3, 0.22, 10, P.dark);
      B(tur, 0, 0.36, -0.82, 0.52, 0.4, 0.3, P.dark); tur.cylBetween(v(0, 0.38, -0.9), v(0, 0.38, -2.4), 0.07, 0.06, 8, STEEL); tur.cylBetween(v(0, 0.38, -2.4), v(0, 0.38, -2.55), 0.09, 0.09, 8, STEEL);
      B(tur, 0.91, 0.36, 0.1, 0.02, 0.3, 0.5, P.mark); muzzle = v(0, 0.38, -2.6); break;
    }
    case 'veh_apc': {
      for (const s of [-1, 1]) track(body, s * 1.12, 6.2, 1.0, 0.5, P.dark);
      B(body, 0, 1.25, 0.2, 2.2, 1.2, 5.8, P.body); B(body, 0, 1.3, -2.9, 2.0, 0.9, 0.8, P.body, 0.5);
      for (const s of [-1, 1]) B(body, s * 1.08, 2.08, 0.8, 0.12, 0.5, 4.2, P.body); B(body, 0, 2.08, 2.9, 2.2, 0.5, 0.12, P.body);
      B(body, 0, 1.9, -1.55, 1.9, 0.5, 1.4, P.body); B(body, 0, 2.0, -2.0, 1.4, 0.1, 0.05, BLK); B(body, 0, 1.88, 1.3, 2.0, 0.06, 3.0, P.dark);
      for (let i = 0; i < 4; i++) B(body, (i % 2 ? 0.55 : -0.55), 2.0, 0.6 + Math.floor(i / 2) * 1.2, 0.4, 0.2, 0.9, P.cloth);
      B(body, 1.15, 1.6, 0.6, 0.02, 0.35, 0.5, P.mark); lights(body, -3.32, 1.4, 0.75);
      turretAt = v(0, 2.15, -1.2);
      tur.addCyl(new Xf(new M3(), v(0, 0, 0)), 0.32, 0.32, 0.25, 10, P.dark); B(tur, 0, 0.42, 0.05, 0.6, 0.45, 0.05, P.body);
      tur.cylBetween(v(0, 0.45, -0.05), v(0, 0.5, -1.2), 0.045, 0.04, 6, BLK); B(tur, 0, 0.42, -0.25, 0.2, 0.18, 0.4, BLK);
      muzzle = v(0, 0.5, -1.25); break;
    }
    default: B(body, 0, 0.8, 0, 2, 1.2, 4, P.body);
  }
  return { body, turret: tur.isEmpty() ? null : tur, turretAt, muzzle };
}
