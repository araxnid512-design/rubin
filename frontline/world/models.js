// Процедурные 3D-модели «Линии снабжения» (геометрические прототипы по референсам до замены на модели Tripo AI):
// 12 зданий по 4 категориям, кучи металлолома, деревья трёх биомов, камни, инструменты.
// Здание: начало координат — центр пятна застройки на земле, вход смотрит на +Z (юг) при угле 0.
import { V3, M3, Xf, RNG } from '../../engine/math.js';
import { MeshBuilder, MAT, darken, lighten } from '../../engine/mesh.js';

const v = (x, y, z) => new V3(x, y, z);
const I = () => new M3();
const C = {
  metal: [0.46, 0.5, 0.52, MAT.PAINT], metalD: [0.32, 0.35, 0.37, MAT.PAINT], rust: [0.5, 0.3, 0.18, MAT.RUST], roof: [0.38, 0.27, 0.2, MAT.RUST],
  brick: [0.56, 0.33, 0.24, MAT.BRICK], conc: [0.62, 0.6, 0.55, MAT.CONCRETE], concD: [0.46, 0.45, 0.42, MAT.CONCRETE], wood: [0.47, 0.33, 0.2, MAT.WOOD],
  olive: [0.36, 0.4, 0.27, MAT.PAINT], yellow: [0.86, 0.64, 0.14, MAT.PAINT], dark: [0.12, 0.13, 0.14, MAT.PAINT], glass: [0.25, 0.33, 0.38, MAT.GLASS],
  sand: [0.6, 0.53, 0.38, MAT.CLOTH], red: [0.6, 0.12, 0.1, MAT.PAINT], green: [0.25, 0.38, 0.22, MAT.PAINT],
};
const box = (mb, c, s, col, yaw = 0) => mb.addBox(new Xf(yaw ? M3.ry(yaw) : I(), c), s, col);
const cyl = (mb, base, r, h, col, sides = 10) => mb.addCyl(new Xf(I(), base), r, r, h, sides, col);

// двускатная крыша вдоль X (конёк по X)
function gable(mb, w, d, y, rise, col, over = 0.4) {
  const hx = w / 2 + over, hz = d / 2 + over;
  const a = v(-hx, y, hz), b = v(hx, y, hz), c = v(hx, y + rise, 0), e = v(-hx, y + rise, 0), f = v(-hx, y, -hz), g = v(hx, y, -hz);
  mb.quad(a, b, c, e, col); mb.quad(g, f, e, c, col);
  mb.quad(a, b, c, e, darken(col, 0.3), v(0, -1, 0).add(v(0, 0, 0))); // нижняя сторона свеса
  mb.tri(v(-w / 2, y, d / 2), v(-w / 2, y + rise, 0), v(-w / 2, y, -d / 2), darken(col, 0.1));
  mb.tri(v(w / 2, y, -d / 2), v(w / 2, y + rise, 0), v(w / 2, y, d / 2), darken(col, 0.1));
}
// пилообразная крыша завода
function sawtooth(mb, w, d, y, n, col, glass) {
  const step = w / n;
  for (let i = 0; i < n; i++) {
    const x0 = -w / 2 + i * step, x1 = x0 + step;
    mb.quad(v(x0, y, d / 2), v(x1, y + 2.2, d / 2), v(x1, y + 2.2, -d / 2), v(x0, y, -d / 2), col);
    mb.quad(v(x1, y, -d / 2), v(x1, y + 2.2, -d / 2), v(x1, y + 2.2, d / 2), v(x1, y, d / 2), glass);
    mb.tri(v(x0, y, d / 2), v(x1, y, d / 2), v(x1, y + 2.2, d / 2), darken(col, 0.15));
    mb.tri(v(x1, y, -d / 2), v(x0, y, -d / 2), v(x1, y + 2.2, -d / 2), darken(col, 0.15));
  }
}
function rollDoor(mb, x, z, w, h, col = C.metalD) { box(mb, v(x, h / 2, z), v(w, h, 0.12), col); for (let y = 0.4; y < h; y += 0.45) box(mb, v(x, y, z + 0.07), v(w, 0.05, 0.03), darken(col, 0.25)); box(mb, v(x, h + 0.25, z + 0.05), v(w + 0.4, 0.5, 0.25), C.dark); }
function windows(mb, x0, x1, y, z, n, face = 1) { for (let i = 0; i < n; i++) { const x = x0 + (x1 - x0) * (i + 0.5) / n; box(mb, v(x, y, z), v(1.2, 1.1, 0.12), C.glass); box(mb, v(x, y - 0.62, z + 0.08 * face), v(1.4, 0.12, 0.2), C.conc); } }
function crates(mb, x, z, rng, n = 3) { for (let i = 0; i < n; i++) box(mb, v(x + rng.range(-1, 1), 0.4 + (i % 2) * 0.8, z + rng.range(-0.8, 0.8)), v(1, 0.8, 0.8), [0.45, 0.36, 0.22, MAT.WOOD], rng.range(0, 0.5)); }
function barrels(mb, x, z, n, col = C.olive) { for (let i = 0; i < n; i++) cyl(mb, v(x + (i % 3) * 0.7, 0, z + Math.floor(i / 3) * 0.7), 0.3, 0.9, col, 8); }
function chimney(mb, x, z, h, r = 0.45) { cyl(mb, v(x, 0, z), r, h, C.brick, 8); cyl(mb, v(x, h, z), r + 0.12, 0.4, C.dark, 8); }
function crane(mb, w, h, z) { for (const x of [-w / 2, w / 2]) box(mb, v(x, h / 2, z), v(0.35, h, 0.35), C.yellow); box(mb, v(0, h, z), v(w + 0.6, 0.45, 0.5), C.yellow); box(mb, v(w * 0.15, h - 0.9, z), v(0.6, 0.6, 0.6), C.dark); }
function sandbags(mb, x0, z0, x1, z1, rows = 2) { const l = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(l / 0.6), yaw = Math.atan2(-(z1 - z0), x1 - x0); for (let r = 0; r < rows; r++) for (let i = 0; i < n; i++) { const t = (i + (r % 2) * 0.5) / n; if (t > 1) continue; box(mb, v(x0 + (x1 - x0) * t, 0.18 + r * 0.32, z0 + (z1 - z0) * t), v(0.62, 0.3, 0.38), C.sand, yaw); } }
function sign(mb, x, z, w, col) { box(mb, v(x, 0, z), v(0.1, 0.01, 0.1), col); box(mb, v(x, 1.2, z), v(0.12, 2.4, 0.12), C.dark); box(mb, v(x, 2.4, z), v(w, 0.7, 0.08), col); }
// стены по периметру с проёмом двери на южной стороне (для зданий со входом)
function walls(mb, cols, w, d, h, col, doorW = 2.2, doorX = 0, thick = 0.4) {
  const hw = w / 2, hd = d / 2;
  const seg = (x0, z0, x1, z1) => { const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, sx = Math.abs(x1 - x0) || thick, sz = Math.abs(z1 - z0) || thick; box(mb, v(cx, h / 2, cz), v(sx, h, sz), col); cols.push([new Xf(I(), v(cx, h / 2, cz)), v(sx, h, sz)]); };
  seg(-hw, -hd, hw, -hd); seg(-hw, -hd, -hw, hd); seg(hw, -hd, hw, hd);
  seg(-hw, hd, doorX - doorW / 2, hd); seg(doorX + doorW / 2, hd, hw, hd);
  box(mb, v(doorX, h - 0.35, hd), v(doorW, 0.7, thick), col);
}

// ===================================================================== 12 зданий
// Возвращает { shell, roof, cols, enterable, inside:[w,d] }
export function buildingModel(id, fw, fd) {
  const shell = new MeshBuilder(), roof = new MeshBuilder(), cols = [], rng = new RNG(id.length * 97 + fw * 13);
  const solid = (w, d, h, y = 0) => cols.push([new Xf(I(), v(0, y + h / 2, 0)), v(w, h, d)]);
  let enterable = false;
  box(shell, v(0, 0.08, 0), v(fw, 0.16, fd), C.concD); // бетонная площадка
  switch (id) {
    case 'vehicle_light_garage': { // малый гараж: одноэтажный, двускатная крыша, ворота
      const w = fw - 2, d = fd - 2.5, h = 3.6;
      box(shell, v(0, h / 2, -0.6), v(w, h, d), C.metal); gable(shell, w, d, h, 1.6, C.roof); shell.addBox(new Xf(I(), v(0, h, -0.6)), v(0.01, 0.01, 0.01), C.roof);
      rollDoor(shell, -1.5, d / 2 - 0.55, 3.4, 2.8); windows(shell, 1.8, w / 2, 2.2, d / 2 - 0.55, 1); chimney(shell, w / 2 - 1, -d / 2 + 0.2, 5.6, 0.3);
      crates(shell, w / 2 + 0.2, d / 2 + 0.6, rng, 2); barrels(shell, -w / 2 - 0.2, d / 2 - 0.2, 2);
      solid(w, d, h); break;
    }
    case 'vehicle_truck_workshop': { // грузовой автоцех: длинный цех, два проезда, жёлтая кран-балка
      const w = fw - 2, d = fd - 3, h = 5.2;
      box(shell, v(0, h / 2, -0.8), v(w, h, d), C.brick); gable(shell, w, d, h, 1.8, C.metalD);
      rollDoor(shell, -w / 4, d / 2 - 0.75, 4.2, 4); rollDoor(shell, w / 4, d / 2 - 0.75, 4.2, 4);
      crane(shell, 7, 6.5, fd / 2 - 0.6); chimney(shell, -w / 2 + 1.2, -d / 2, 8);
      barrels(shell, w / 2 - 1, fd / 2 - 0.4, 3, C.rust); solid(w, d, h); break;
    }
    case 'vehicle_armor_factory': { // бронетанковый завод: пилообразная крыша, трубы, кран
      const w = fw - 2, d = fd - 4, h = 6.5;
      box(shell, v(0, h / 2, -1), v(w, h, d), C.conc); sawtooth(roof, w, d, h, 5, C.metalD, C.glass);
      rollDoor(shell, -5, d / 2 - 1.05, 5.5, 5); rollDoor(shell, 5, d / 2 - 1.05, 5.5, 5);
      for (let i = 0; i < 3; i++) chimney(shell, -w / 2 + 2 + i * 2.2, -d / 2 - 1, 11 + i, 0.55);
      crane(shell, 10, 8, fd / 2 - 0.8); box(shell, v(w / 2 - 2.5, 1.2, fd / 2 - 1.2), v(3.5, 2.4, 2), C.olive);
      solid(w, d, h + 2); break;
    }
    case 'weapon_bench': { // оружейный верстак: навес на столбах, верстак, стойка
      const w = fw - 1.2, d = fd - 1.4;
      for (const [x, z] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) { box(shell, v(x, 1.4, z), v(0.2, 2.8, 0.2), C.wood); cols.push([new Xf(I(), v(x, 1.4, z)), v(0.3, 2.8, 0.3)]); }
      gable(roof, w, d, 2.8, 0.9, C.metal, 0.3);
      box(shell, v(0, 0.95, -d / 2 + 0.8), v(w - 1.2, 0.12, 1.1), C.wood); box(shell, v(0, 0.45, -d / 2 + 0.8), v(w - 1.4, 0.9, 0.9), darken(C.wood, 0.2));
      box(shell, v(-1, 1.1, -d / 2 + 0.7), v(0.8, 0.12, 0.2), C.dark); box(shell, v(1.2, 1.15, -d / 2 + 0.8), v(0.5, 0.25, 0.4), C.metalD);
      box(shell, v(w / 2 - 0.6, 1, 0.5), v(0.4, 2, 1.6), C.olive); crates(shell, -w / 2 + 0.8, d / 2 - 0.8, rng, 2);
      cols.push([new Xf(I(), v(0, 0.5, -d / 2 + 0.8)), v(w - 1.2, 1, 1.1)]); break;
    }
    case 'weapon_workshop': { // оружейная мастерская: кирпич, широкие ворота, вывеска
      const w = fw - 2, d = fd - 2.4, h = 4.2;
      box(shell, v(0, h / 2, -0.6), v(w, h, d), C.brick); box(roof, v(0, h + 0.2, -0.6), v(w + 0.6, 0.4, d + 0.6), C.metalD);
      rollDoor(shell, -2, d / 2 - 0.55, 4, 3.2); windows(shell, 1, w / 2, 2.4, d / 2 - 0.55, 2); box(shell, v(-2, 3.8, d / 2 - 0.35), v(4.5, 0.6, 0.1), C.olive);
      chimney(shell, w / 2 - 1, -d / 2 + 0.6, 6); crates(shell, w / 2 + 0.4, d / 2 + 0.3, rng, 3); solid(w, d, h); break;
    }
    case 'weapon_factory': { // оружейный завод: высокий корпус, пристройка, трубы
      const w = fw - 2, d = fd - 3, h = 6.4;
      box(shell, v(-2, h / 2, -0.8), v(w - 4, h, d), C.metalD); box(shell, v(w / 2 - 2, 2.2, -0.8), v(4, 4.4, d), C.brick);
      gable(roof, w - 4, d, h, 2, C.roof, 0.3); box(roof, v(w / 2 - 2, 4.6, -0.8), v(4.4, 0.4, d + 0.4), C.metalD);
      rollDoor(shell, -5, d / 2 - 0.75, 4.6, 4.2); windows(shell, -1, w / 2 - 4.5, 4.5, d / 2 - 0.75, 3);
      chimney(shell, -w / 2 + 1.5, -d / 2 - 0.5, 10, 0.6); chimney(shell, -w / 2 + 3.5, -d / 2 - 0.5, 9, 0.5);
      sign(shell, w / 2 - 1, fd / 2 - 0.3, 2.4, C.red); solid(w, d, h); break;
    }
    case 'ammo_bench': { // патронный верстак: навес с ящиками боеприпасов
      const w = fw - 1.2, d = fd - 1.4;
      for (const [x, z] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) { box(shell, v(x, 1.3, z), v(0.2, 2.6, 0.2), C.metal); cols.push([new Xf(I(), v(x, 1.3, z)), v(0.3, 2.6, 0.3)]); }
      box(roof, v(0, 2.7, 0), v(w + 0.6, 0.15, d + 0.6), C.olive);
      box(shell, v(0, 0.9, -d / 2 + 0.8), v(w - 1.4, 0.1, 1), C.metalD); box(shell, v(0, 0.45, -d / 2 + 0.8), v(w - 1.6, 0.9, 0.8), C.metal);
      for (let i = 0; i < 6; i++) box(shell, v(-w / 2 + 1 + (i % 3) * 0.75, 0.25 + Math.floor(i / 3) * 0.5, d / 2 - 0.9), v(0.65, 0.45, 0.45), C.olive);
      cols.push([new Xf(I(), v(0, 0.5, -d / 2 + 0.8)), v(w - 1.4, 1, 1)]); break;
    }
    case 'ammo_workshop': { // патронный цех: корпус с цистернами и трубопроводом
      const w = fw - 3, d = fd - 2.4, h = 4.4;
      box(shell, v(-1, h / 2, -0.6), v(w, h, d), C.conc); gable(roof, w, d, h, 1.4, C.metalD);
      rollDoor(shell, -2.5, d / 2 - 0.55, 3.6, 3); windows(shell, 0, w / 2 - 1, 2.6, d / 2 - 0.55, 2);
      for (const z of [-2, 1.2]) { cyl(shell, v(fw / 2 - 1.2, 0, z), 0.9, 4.2, C.metal, 12); cyl(shell, v(fw / 2 - 1.2, 4.2, z), 0.95, 0.2, C.dark, 12); }
      box(shell, v(fw / 2 - 2.3, 3.6, -0.4), v(1.6, 0.25, 0.25), C.rust); solid(fw - 1, d, h); break;
    }
    case 'ammo_factory': { // завод боеприпасов: цех, силосы, транспортёр
      const w = fw - 6, d = fd - 3, h = 6;
      box(shell, v(-3, h / 2, -0.8), v(w, h, d), C.brick); sawtooth(roof, w, d, h, 4, C.roof, C.glass); roof.addBox(new Xf(I(), v(-3, h, -0.8)), v(0.01, 0.01, 0.01), C.roof);
      rollDoor(shell, -6, d / 2 - 0.75, 4.4, 4); rollDoor(shell, 0, d / 2 - 0.75, 4.4, 4);
      for (let i = 0; i < 3; i++) { cyl(shell, v(fw / 2 - 2, 0, -fd / 2 + 3 + i * 4.5), 1.6, 8.5, C.metal, 14); shell.addCyl(new Xf(I(), v(fw / 2 - 2, 8.5, -fd / 2 + 3 + i * 4.5)), 1.6, 0.3, 1.2, 14, C.metalD); }
      shell.beam(v(fw / 2 - 2, 7.5, -fd / 2 + 3), v(w / 2 - 3, 5, -fd / 2 + 3), 0.6, 0.6, C.yellow); chimney(shell, -w / 2 - 2, -d / 2, 11, 0.6);
      solid(fw - 1, d, h + 2); break;
    }
    case 'military_barracks': { // казарма: длинный корпус, окна, крыльцо, флаг
      const w = fw - 2, d = fd - 3, h = 3.4;
      box(shell, v(0, h / 2, -0.8), v(w, h, d), C.olive); gable(roof, w, d, h, 1.5, C.green);
      box(shell, v(0, 1.05, d / 2 - 0.75), v(1.6, 2.1, 0.14), C.wood); box(shell, v(0, 0.12, d / 2 + 0.3), v(3, 0.25, 1.6), C.conc);
      windows(shell, -w / 2, -1.2, 2, d / 2 - 0.75, 3); windows(shell, 1.2, w / 2, 2, d / 2 - 0.75, 3);
      box(shell, v(w / 2 + 0.8, 3.2, d / 2), v(0.1, 6.4, 0.1), C.dark); box(shell, v(w / 2 + 1.5, 5.9, d / 2), v(1.4, 0.9, 0.04), C.red);
      sandbags(shell, -w / 2, fd / 2 - 0.2, -2, fd / 2 - 0.2); solid(w, d, h); break;
    }
    case 'military_headquarters': { // штаб: двухэтажный, вход, антенны; внутри — тактический стол
      const w = fw - 2, d = fd - 2, h = 3.4; enterable = true;
      walls(shell, cols, w, d, h, C.conc, 2.4);
      box(shell, v(0, h + 0.15, 0), v(w, 0.3, d), C.concD); // перекрытие (видно, когда крыша скрыта)
      box(roof, v(0, h + 0.3 + 1.6, -1), v(w - 4, 3.2, d - 4), C.conc); box(roof, v(0, h + 3.3, -1), v(w - 3.6, 0.3, d - 3.6), C.dark);
      windows(roof, -w / 2 + 2.5, w / 2 - 2.5, h + 2, d / 2 - 2.05, 4); box(roof, v(0, h + 0.3, 0), v(w + 0.6, 0.3, d + 0.6), C.concD);
      shell.cylBetween(v(w / 2 - 2, h + 3.4, -d / 2 + 2.5), v(w / 2 - 2, h + 11, -d / 2 + 2.5), 0.08, 0.04, 6, C.dark);
      box(shell, v(-w / 2 + 2, h + 3.8, -d / 2 + 2.5), v(1.6, 0.9, 1.6), C.metalD);
      windows(shell, -w / 2 + 1, -2, 1.8, d / 2 + 0.05, 2); windows(shell, 2, w / 2 - 1, 1.8, d / 2 + 0.05, 2);
      // тактический стол с картой
      box(shell, v(0, 0.5, -1.2), v(3.4, 1, 2.2), C.wood); box(shell, v(0, 1.02, -1.2), v(3.2, 0.04, 2), [0.42, 0.5, 0.36, MAT.CLOTH]);
      cols.push([new Xf(I(), v(0, 0.5, -1.2)), v(3.4, 1, 2.2)]);
      for (const x of [-w / 2 + 1, w / 2 - 1]) box(shell, v(x, 1, -d / 2 + 1.2), v(1.2, 2, 0.6), C.metalD);
      sandbags(shell, -4, fd / 2 - 0.1, -1.6, fd / 2 - 0.1); sandbags(shell, 1.6, fd / 2 - 0.1, 4, fd / 2 - 0.1); break;
    }
    case 'military_bunker': { // бункер: низкий бетон, бойницы, мешки; крыша — отдельный объект, скрывается внутри
      const w = fw - 1.6, d = fd - 1.6, h = 2.7; enterable = true;
      walls(shell, cols, w, d, h, C.concD, 1.8, 0, 0.6);
      for (const x of [-w / 4, w / 4]) { box(shell, v(x, 1.8, -d / 2 - 0.05), v(1.6, 0.35, 0.7), C.dark); box(shell, v(x, 1.8, d / 2 + 0.05), v(1.6, 0.35, 0.7), C.dark); }
      box(shell, v(-w / 2 + 1.3, 0.5, -d / 2 + 1), v(1.6, 1, 0.8), C.olive); box(shell, v(w / 2 - 1.1, 0.4, 0), v(0.8, 0.8, 2.4), C.wood);
      cyl(shell, v(0, 0, -1), 0.25, h, C.concD, 8); cols.push([new Xf(I(), v(0, h / 2, -1)), v(0.5, h, 0.5)]);
      box(roof, v(0, h + 0.35, 0), v(w + 0.8, 0.7, d + 0.8), C.concD); box(roof, v(0, h + 0.95, 0), v(w - 1, 0.5, d - 1), [0.35, 0.4, 0.26, MAT.FOLIAGE]);
      sandbags(shell, -w / 2 - 0.6, fd / 2 + 0.2, -1.4, fd / 2 + 0.2, 3); sandbags(shell, 1.4, fd / 2 + 0.2, w / 2 + 0.6, fd / 2 + 0.2, 3); break;
    }
  }
  return { shell, roof: roof.isEmpty() ? null : roof, cols, enterable };
}

// ===================================================================== металлолом: составная куча (трубы, листы, бочки, колесо)
export function scrapPile(seed) {
  const mb = new MeshBuilder(), rng = new RNG(seed * 31 + 7), R = [C.rust, [0.42, 0.26, 0.16, MAT.RUST], [0.36, 0.33, 0.3, MAT.RUST], [0.3, 0.22, 0.16, MAT.RUST]];
  mb.addBlob(v(0, 0.2, 0), v(1.5, 0.45, 1.3), [0.33, 0.27, 0.2, MAT.RUST], rng, 0.3, true);
  for (let i = 0; i < 4; i++) { const a = rng.range(0, 6.28), l = rng.range(1.4, 2.6); mb.cylBetween(v(Math.cos(a) * 0.6, rng.range(0.3, 0.8), Math.sin(a) * 0.6), v(Math.cos(a) * 0.6 + Math.cos(a + 1.3) * l, rng.range(0.2, 1), Math.sin(a) * 0.6 + Math.sin(a + 1.3) * l), 0.09, 0.09, 6, R[i % 4]); }
  for (let i = 0; i < 4; i++) mb.addBox(new Xf(M3.ry(rng.range(0, 3)).mul(M3.rx(rng.range(-0.6, 0.6))), v(rng.range(-0.9, 0.9), rng.range(0.4, 0.9), rng.range(-0.8, 0.8))), v(rng.range(0.8, 1.6), 0.05, rng.range(0.6, 1.1)), R[(i + 1) % 4]);
  if (rng.f() < 0.6) mb.addCyl(new Xf(M3.rz(rng.range(1.2, 1.6)), v(rng.range(-1, 1), 0.3, rng.range(-1, 1))), 0.3, 0.3, 0.9, 8, R[2]);
  if (rng.f() < 0.5) mb.addCyl(new Xf(M3.rx(1.57), v(rng.range(-0.8, 0.8), 0.5, rng.range(-0.6, 0.6))), 0.45, 0.45, 0.25, 10, [0.1, 0.1, 0.1, MAT.RUBBER]);
  return mb;
}

// ===================================================================== растительность и камни (координаты мира, высота y)
export function pine(mb, x, y, z, h, rng, dark = false) {
  const g = dark ? [0.13, 0.22, 0.14, MAT.FOLIAGE] : [0.16, 0.3, 0.15, MAT.FOLIAGE];
  mb.addCyl(new Xf(I(), v(x, y - 0.2, z)), 0.16 * h / 8, 0.1, h * 0.35, 6, [0.33, 0.22, 0.14, MAT.WOOD]);
  for (let i = 0; i < 3; i++) { const yy = y + h * (0.22 + i * 0.22), r = h * (0.28 - i * 0.07); mb.addCyl(new Xf(M3.ry(rng.f() * 3), v(x, yy, z)), r, 0.05, h * 0.38, 7, i === 1 ? darken(g, 0.1) : g, true, false); }
}
export function birch(mb, x, y, z, h, rng) {
  mb.addCyl(new Xf(I(), v(x, y - 0.2, z)), 0.13, 0.08, h * 0.75, 6, [0.85, 0.84, 0.8, MAT.WOOD]);
  for (let i = 0; i < 2; i++) mb.addBlob(v(x + rng.range(-0.6, 0.6), y + h * (0.62 + i * 0.18), z + rng.range(-0.6, 0.6)), v(h * 0.2, h * 0.24, h * 0.2), [0.34, 0.5, 0.2, MAT.FOLIAGE], rng, 0.25);
}
export function deadTree(mb, x, y, z, h, rng) {
  const tc = [0.26, 0.22, 0.18, MAT.WOOD];
  mb.addCyl(new Xf(I(), v(x, y - 0.2, z)), 0.18, 0.08, h, 6, tc);
  for (let i = 0; i < 4; i++) { const a = rng.range(0, 6.28), yy = y + h * rng.range(0.4, 0.85); mb.cylBetween(v(x, yy, z), v(x + Math.cos(a) * h * 0.3, yy + h * 0.2, z + Math.sin(a) * h * 0.3), 0.06, 0.02, 4, tc); }
}
export function bush(mb, x, y, z, s, rng, col = [0.28, 0.4, 0.17, MAT.FOLIAGE]) { mb.addBlob(v(x, y + s * 0.35, z), v(s, s * 0.6, s), col, rng, 0.3, true); }
export function rock(mb, x, y, z, s, rng, col = [0.48, 0.47, 0.44, MAT.CONCRETE]) { mb.addBlob(v(x, y + s * 0.25, z), v(s * rng.range(0.8, 1.3), s * rng.range(0.45, 0.8), s * rng.range(0.8, 1.2)), col, rng, 0.32, true); }

// ===================================================================== инструменты в руке
export function hammerMesh() { const mb = new MeshBuilder(); mb.addBox(new Xf(I(), v(0, -0.18, 0)), v(0.035, 0.42, 0.035), C.wood); mb.addBox(new Xf(I(), v(0, -0.4, 0)), v(0.07, 0.08, 0.2), C.dark); return mb; }
export function wrenchMesh() { const mb = new MeshBuilder(); mb.addBox(new Xf(I(), v(0, -0.17, 0)), v(0.03, 0.36, 0.06), C.metal); mb.addBox(new Xf(I(), v(0, -0.37, 0)), v(0.035, 0.08, 0.13), C.metal); return mb; }

// раскраска фракции противника: оливковые и жёлтые поверхности → ржаво-красные и тёмно-серые (тот же меш, другая краска)
export function enemyTint(mb) {
  const c = mb.c;
  for (let i = 0; i < c.length; i += 4) {
    const r = c[i], g = c[i + 1], b = c[i + 2], lum = 0.3 * r + 0.59 * g + 0.11 * b;
    if (g > r * 1.02 && g > b * 1.12) { c[i] = Math.min(1, lum * 1.3); c[i + 1] = lum * 0.6; c[i + 2] = lum * 0.5; }
    else if (r > 0.6 && g > 0.45 && b < 0.3) { c[i] = 0.6; c[i + 1] = 0.2; c[i + 2] = 0.14; }
  }
  return mb;
}
