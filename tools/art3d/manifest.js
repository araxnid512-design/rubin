// Что запекать: тела людей и существ, слои оружия, реквизит. Отсутствующие исходники пропускаются.
const S = '/art3d/src/';
const DW = S + 'dw/';
const CLIPS = S + 'player.glb'; // клипы с винтовкой (герой «Стикса», скелет Mixamo)

// Набор движений человека с оружием (кадров на направление; направлений 8)
const MK = (m) => S + 'dw/m_krut_' + m + '.glb'; // движения по тексту Tripo (на скелете Крута)
const HUMAN = [
  // mode — хват: carry (переноска, ствол вперёд-вниз), aim (приклад в плече), hand / left (в кисти), sling (за спиной)
  { key: 'idle', clip: 'IdleRifle', n: 3, loop: true, fps: 2, mode: 'carry' },
  { key: 'walk', clip: 'WalkRifle', n: 12, loop: true, mode: 'carry' },
  { key: 'run', clip: 'RunRifle', n: 10, loop: true, mode: 'carry' },
  { key: 'aim', clip: 'AimRifle', n: 1, t0: 0.5, mode: 'aim' },
  { key: 'shoot', clip: 'ShootRifle', n: 2, t0: 0, t1: 0.1, mode: 'aim', recoilFirst: [0.05, 5] },
  { key: 'reload', clip: 'ReloadRifle', n: 5, mode: 'carry', freeL: true },
  { key: 'hit', clip: 'HitRifle', n: 2, t0: 0.01, t1: 0.09, mode: 'carry' },
  { key: 'die', clip: 'Death', n: 5, mode: 'hand', drop: [0.15, 0.7] },   // ствол выпадает из руки на землю
  { key: 'melee', clip: 'Melee', n: 3, mode: 'hand' },
  { key: 'crouch', clip: 'IdleRifle', n: 1, crouch: 0.4, mode: 'carry' },
  { key: 'crouchAim', clip: 'AimRifle', n: 1, t0: 0.5, crouch: 0.4, mode: 'aim' },
  { key: 'hunker', clip: 'IdleRifle', n: 1, crouch: 0.62, mode: 'carry' },
  // из-за полного укрытия: выглянуть, очередь, назад; с колена за низким; дозор с колена; пригнуться под огнём
  { key: 'peek', clip: '*', src: MK('peek'), n: 4, mode: 'aim' },
  { key: 'kneel', clip: '*', src: MK('kneel'), n: 3, mode: 'aim' },
  { key: 'watch', clip: '*', src: MK('watch'), n: 2, loop: true, mode: 'aim' },
  { key: 'duck', clip: '*', src: MK('duck'), n: 2, loop: true, mode: 'carry' },
  // перелезть через низкое и залезть на уступ (оружие в правой руке), бросок гранаты (в левой), перевязка (за спиной)
  { key: 'vault', clip: '*', src: MK('vault'), n: 3, mode: 'hand' },
  { key: 'climb', clip: '*', src: MK('climb'), n: 3, mode: 'hand' },
  { key: 'throw', clip: '*', src: MK('throw'), n: 3, mode: 'left' },
  { key: 'heal', clip: '*', src: MK('heal'), n: 2, loop: true, mode: 'sling' },
  // этап 3: попадание, скольжение в укрытие, спиной к стене, крадущийся шаг, бросок с колена (основной атлас)
  { key: 'hit2', clip: '*', src: MK('hit2'), n: 2, t0: 0.15, t1: 0.9, mode: 'carry' },
  { key: 'slide', clip: '*', src: MK('slide'), n: 3, t0: 0.7, mode: 'carry' },
  { key: 'wall', clip: '*', src: MK('wall'), n: 2, loop: true, t0: 2.2, t1: 2.96, yaw: 117, mode: 'carry' },   // конечная поза (в начале клипа боец разворачивается)
  { key: 'sneak', clip: '*', src: MK('sneak'), n: 6, loop: true, mode: 'carry' },
  { key: 'throwk', clip: '*', src: MK('throwk'), n: 3, mode: 'left' },
  // редкие — в отдельном атласе (bx_ / wx_), грузится по надобности: две гибели, ликование, паника, осмотр оружия, удар бандита
  { key: 'die2', clip: '*', src: MK('die2'), n: 6, t0: 0.5, t1: 2.3, mode: 'hand', drop: [0.15, 0.7], wide: true, x: true },
  { key: 'die3', clip: '*', src: MK('die3'), n: 4, mode: 'hand', drop: [0.15, 0.7], wide: true, x: true },
  { key: 'cheer', clip: '*', src: MK('cheer'), n: 2, loop: true, mode: 'hand', x: true },
  { key: 'panic', clip: '*', src: MK('panic'), n: 2, loop: true, mode: 'sling', x: true },
  { key: 'idle2', clip: '*', src: MK('idle2'), n: 3, mode: 'carry', x: true },
  { key: 'punch', clip: '*', src: MK('punch'), n: 3, t0: 0.15, t1: 0.85, mode: 'sling', x: true }   // стойка → удар (0,5 с) → назад
];
// Крупная фигура (экран отряда): стойка с оружием
const FIGURE = [{ key: 'pose', clip: 'IdleRifle', n: 1, t0: 0.4, mode: 'carry' }];
const W = (id, file, len, grip, fore, gy, fy, my) => ({ id, src: file, len, grip, fore, gy, fy, my });
// Оружие игры → модель (ствол к −Z), длина, хват (доли от приклада), высоты точек (доли высоты)
const WEAPONS = [
  // ППШ-41 — модель Tripo по фото (диск развёрнут поперёк: tools/three3d/fixppsh.mjs); правая рука — на шейке приклада
  // за спуском, левая — у диска; если файла нет — прежняя модель
  require('fs').existsSync(require('path').join(__dirname, '..', '..', 'art3d/src/h/w_ppsh41_fix.glb')) ? W('ppsh', '/art3d/src/h/w_ppsh41_fix.glb', 0.84, 0.4, 0.56, 0.55, 0.62, 0.82) : W('ppsh', DW + 'w_ppsh2.glb', 0.84, 0.33, 0.58, 0.55, 0.72, 0.85),
  W('ak', S + 'w_ak47.glb', 0.88, 0.36, 0.58, 0.55, 0.72, 0.85),
  W('shotgun', S + 'w_spas12.glb', 1.0, 0.3, 0.6, 0.5, 0.62, 0.85),
  W('sniper', S + 'w_svd.glb', 1.22, 0.32, 0.55, 0.5, 0.7, 0.85),
  W('lmg', S + 'w_rpk.glb', 1.04, 0.33, 0.52, 0.55, 0.72, 0.85),
  W('ak2', S + 'w_ak107.glb', 0.94, 0.36, 0.6, 0.55, 0.72, 0.85),
  Object.assign(W('hsniper', DW + 'w_ksvk.glb', 1.35, 0.42, 0.6, 0.45, 0.6, 0.75), { flip: true }),
  W('hlmg', DW + 'w_kord.glb', 1.6, 0.3, 0.5, 0.5, 0.65, 0.8),
  Object.assign(W('rpg', DW + 'w_rpg.glb', 1.0, 0.42, 0.62, 0.35, 0.55, 0.6), { free: true, adj: { aim: { p: [0.04, 0.12, -0.38], r: [0, 0, 0] } } }) // труба на плече (свой хват)
];
// запасные модели, пока новых нет
const WEAPON_FALLBACK = { ppsh: DW + 'w_ppsh.glb', hsniper: S + 'w_awm.glb', hlmg: S + 'w_pkt.glb' };

// новые модели этапа «3D-бой» (Tripo p8, art3d/src/h — из ветки tripo-status): если файл есть — вместо старого
const fsM = require('fs'), pathM = require('path');
const HNEW = { mur1: 'raider', mur2: 'thug' };
const newOf = (id) => { const f = '/art3d/src/h/h_' + (HNEW[id] || id) + '_a.glb'; return fsM.existsSync(pathM.join(__dirname, '..', '..', f)) ? f : null; };
const B = (id, src, opt) => Object.assign({ id, src: newOf(id) || src }, opt || {});
const BODIES = [
  B('krut', DW + 'c_krut_a.glb'),
  B('marlboro', DW + 'c_marlboro_a.glb', { h: 1.76 }),
  B('pris1', DW + 'c_pris1_a.glb', { h: 1.78 }),
  B('pris2', DW + 'c_pris2_a.glb', { h: 1.84 }),
  B('vest', DW + 'c_vest_a.glb'),
  B('heavy', DW + 'c_heavy_a.glb', { h: 1.86 }),
  B('exo', DW + 'c_exo_a.glb', { h: 1.9 }),
  B('mur1', S + 'mur_1.glb'),
  B('mur2', S + 'mur_2.glb'),
  B('marksman', DW + 'c_marksman_a.glb'),
  B('boss', DW + 'c_boss_a.glb', { h: 1.9 }),
  B('bandit3', DW + 'c_bandit3_a.glb'),
  B('bandit4', DW + 'c_bandit4_a.glb'),
  B('bandit5', DW + 'c_bandit5_a.glb', { h: 1.88 }),
  // новобранцы-заключённые (разные внешности)
  B('pris3', DW + 'c_pris3_a.glb', { h: 1.76 }),
  B('pris4', DW + 'c_pris4_a.glb', { h: 1.8 }),
  B('pris5', DW + 'c_pris5_a.glb', { h: 1.82 }),
  B('pris6', DW + 'c_pris6_a.glb', { h: 1.79 })
];
// у файлов без «_a» (модели без движений Tripo) — скелет в основном файле
const BODY_FALLBACK = {};

const C = (key, clip, n, o) => Object.assign({ key, clip, n }, o || {});
// четвероногие Tripo: в файле только ход — атака, попадание, гибель, рык и дыхание собираются из позы хода (fx)
const QUAD = [C('walk', 'walk', 8, { loop: true }), C('idle', 'walk', 3, { loop: true, t0: 0.1, t1: 0.1, fx: 'breathe' }),
  C('atk', 'walk', 4, { t0: 0.3, t1: 1.1, fx: 'lunge' }), C('hit', 'walk', 2, { t0: 0.2, t1: 0.25, fx: 'recoil' }),
  C('die', 'walk', 5, { t0: 0.1, t1: 0.1, fx: 'fall' }), C('roar', 'walk', 2, { t0: 0.6, t1: 0.65, fx: 'roar' })];
const CREATURES = [
  { id: 'brute', src: DW + 'm_brute_a.glb', more: DW + 'm_brute_b.glb', h: 2.3, box: [1.4, 2.5], anims: [C('idle', 'idle', 4, { loop: true, fps: 2 }), C('walk', 'walk', 8, { loop: true }), C('run', 'run', 6, { loop: true }), C('atk', '*', 5, { src: DW + 'm_brute_smash.glb' }), C('slash', 'slash', 4), C('hit', 'hit_to_body_01', 2, { t1: 0.4 }), C('die', 'fall', 6), C('roar', 'angry_01', 4)] },
  { id: 'spitter', src: DW + 'm_spitter_a.glb', more: DW + 'm_spitter_b.glb', h: 1.6, anims: [C('idle', 'idle', 4, { loop: true, fps: 2 }), C('walk', 'walk', 8, { loop: true }), C('run', 'run', 6, { loop: true }), C('atk', '*', 4, { src: DW + 'm_spitter_spit.glb' }), C('hit', 'hit_to_body_01', 2, { t1: 0.4 }), C('die', 'fall', 6)] },
  { id: 'guardian', src: DW + 'm_guardian_a.glb', h: 1.95, anims: [C('idle', 'idle', 4, { loop: true, fps: 2 }), C('walk', 'walk', 8, { loop: true }), C('atk', 'shoot', 3), C('hit', 'hit_to_body_01', 2, { t1: 0.4 }), C('die', 'fall', 6)] },
  { id: 'scav', src: DW + 'm_scav_a.glb', h: 1.0, quad: true, box: [1.2, 1.2], anims: QUAD },
  { id: 'scav2', src: DW + 'm_scav2_a.glb', h: 1.0, quad: true, box: [1.2, 1.2], anims: QUAD },
  { id: 'alpha', src: DW + 'm_alpha_a.glb', h: 1.6, quad: true, box: [1.6, 1.8], anims: QUAD },
  { id: 'queen', src: DW + 'm_queen_a.glb', h: 1.9, quad: true, yaw: -90, box: [2.0, 2.8], anims: QUAD }
];

// Реквизит: тип клетки игры → модели (варианты), длина по большей стороне в клетках, предел высоты (м)
const P = (src, len, hMax, yaw, k) => ({ src, len, hMax, yaw: yaw || 0, k });
const PROPS = [
  { id: 'obj3', type: 3, variants: [P(DW + 'e_boulder.glb', 0.95, 1.15), P(DW + 'e_boulder.glb', 0.95, 1.15, 60), P(DW + 'e_boulder.glb', 0.95, 1.15, 300)] },
  { id: 'obj4', type: 4, variants: [P(S + 'env/e_crate.glb', 0.8, 0.7), P(S + 'env/e_chest.glb', 0.85, 0.6, 30), P(S + 'env/e_ammo.glb', 0.8, 0.75, 90)] },
  { id: 'obj5', type: 5, variants: [Object.assign(P(DW + 'e_deadtree.glb', 0, 3.2), { h: 2.7 }), Object.assign(P(DW + 'e_deadtree.glb', 0, 3.0, 140), { h: 2.4 }), Object.assign(P(DW + 'e_deadtree.glb', 0, 3.0, 250), { h: 2.9 })] },
  { id: 'obj7', type: 7, variants: [P(S + 'env/e_vaz_burned.glb', 1.45, 1.0, 20), P(S + 'env/e_vaz_crashed.glb', 1.45, 1.0, -60), P(S + 'env/e_volga.glb', 1.5, 1.0, 110)] },
  { id: 'obj8', type: 8, variants: [Object.assign(P(DW + 'e_rubble.glb', 1.05, 1.2), { sy: 1.7 }), Object.assign(P(DW + 'e_rubble.glb', 1.0, 1.2, 120), { sy: 1.6 }), P(S + 'env/e_block.glb', 0.9, 0.9, 30)] },
  { id: 'obj9', type: 9, variants: [P(S + 'env/e_barrel.glb', 0.45, 0.95), P(S + 'env/e_hazard.glb', 0.45, 0.95), P(S + 'env/e_barrel.glb', 0.45, 0.95, 90)] },
  { id: 'obj10', type: 10, variants: [P(DW + 'e_tent.glb', 1.15, 1.6), P(DW + 'e_tent.glb', 1.15, 1.6, 90), P(DW + 'e_tent.glb', 1.1, 1.6, 200)].map((v) => Object.assign(v, { sy: 1.4 })) },
  { id: 'obj12', type: 12, variants: [P(DW + 'e_generator.glb', 0.85, 1.0), P(S + 'env/e_lathe.glb', 0.85, 0.9, 30), P(DW + 'e_generator.glb', 0.85, 1.0, 120)] },
  { id: 'obj15', type: 15, variants: [P(DW + 'e_portal.glb', 1.35, 3.0, -45)] },
  { id: 'obj16', type: 16, variants: [P(DW + 'e_chitin.glb', 0.85, 1.0), P(DW + 'e_chitin.glb', 0.8, 0.95, 120), P(DW + 'e_chitin.glb', 0.85, 1.0, 240)] },
  { id: 'obj18', type: 18, variants: [P(DW + 'e_container.glb', 1.2, 1.25, 0), P(S + 'env/e_dumpster.glb', 1.0, 1.0, 20), P(DW + 'e_container.glb', 1.2, 1.25, 90)].map((v) => v.src.indexOf('container') > 0 ? Object.assign(v, { sy: 1.35 }) : v) },
  { id: 'obj19', type: 19, variants: [P(DW + 'e_log.glb', 1.35, 0.8), P(DW + 'e_log.glb', 1.3, 0.8, 90), P(S + 'env/e_woodpile.glb', 0.9, 0.6, 30)] },
  { id: 'obj20', type: 20, variants: [P(DW + 'e_crystal.glb', 0.8, 1.2), P(DW + 'e_crystal.glb', 0.75, 1.1, 120), P(DW + 'e_crystal.glb', 0.8, 1.15, 240)] },
  // мебель в домах: низкое укрытие (столы, кровати, диваны, комоды, сундуки, нары) и шкафы — полное
  { id: 'obj21', type: 21, variants: [P(S + 'env/e_table.glb', 0.85, 0.62, 30), P(S + 'env/e_bed.glb', 0.95, 0.55, -60), P(S + 'env/e_sofa.glb', 0.95, 0.6, 120),
    P(S + 'env/e_drawers.glb', 0.75, 0.75, 45), P(S + 'env/e_chest.glb', 0.75, 0.55, -45), P(S + 'env/e_bunk.glb', 0.95, 0.85, 30), P(S + 'env/e_bench.glb', 0.9, 0.5, -30),
    P(S + 'env/e_nightstand.glb', 0.6, 0.6, 45), P(S + 'env/e_tv.glb', 0.6, 0.65, 60), P(S + 'env/e_chair.glb', 0.55, 0.75, 20)] },
  { id: 'obj22', type: 22, variants: [P(S + 'env/e_wardrobe.glb', 0.8, 1.45, 45), P(S + 'env/e_fridge.glb', 0.7, 1.4, -45), P(S + 'env/e_buffet.glb', 0.85, 1.4, 45),
    P(S + 'env/e_pech.glb', 0.85, 1.45, -45), P(S + 'env/e_burzhuyka.glb', 0.65, 1.2, 30)] },
  // техника на 2–3 клетки: модель × 4 поворота (вдоль x передом к +x / −x, вдоль y к +y / −y); вариант = модель·4 + поворот
  { id: 'veh', variants: [['e_vaz_burned', 2], ['e_volga', 2], ['e_niva', 2], ['e_uaz', 2], ['e_paz', 3], ['e_ural', 3], ['e_btr80', 3]]
    .reduce((a, m) => a.concat([0, 180, -90, 90].map((yaw) => P(S + 'env/' + m[0] + '.glb', m[1] * 0.95, 2.4, yaw))), []) },
  // турель — по направлениям (8 вариантов поворота)
  { id: 'turret', variants: [0, 1, 2, 3, 4, 5, 6, 7].map((d) => P(DW + 'e_turret.glb', 0.8, 1.1, -d * 45)) }, // ствол — ось +X модели
  // украшения карты: машины, покрышки, мусор (тип клетки не занят — рисуются как декор)
  { id: 'decor', variants: [P(S + 'env/e_tire.glb', 0.5, 0.3), P(S + 'env/e_trashbags.glb', 0.6, 0.5), P(S + 'env/e_pipes.glb', 0.9, 0.5), P(S + 'env/e_vaz2107.glb', 1.5, 1.0, 30), P(S + 'env/e_uaz.glb', 1.5, 1.2, -30), P(S + 'env/e_ural.glb', 2.2, 1.9, 60), P(S + 'env/e_btr80.glb', 2.3, 1.6, -20), P(S + 'env/e_paz.glb', 2.4, 1.9, 40), P(S + 'env/e_well.glb', 0.9, 1.6), P(S + 'env/e_sandbags.glb', 0.9, 0.6)] }
  ,
  // рамы окон и дверей в проёмах домов: окно вдоль x / вдоль y, дверь вдоль x / вдоль y (render_battle: openAt)
  { id: 'open', variants: [P(DW + 'd_window.glb', 0.95, 1.05, 0), P(DW + 'd_window.glb', 0.95, 1.05, 90), P(DW + 'd_door.glb', 0.95, 2.05, 0), P(DW + 'd_door.glb', 0.95, 2.05, 90)] },
  // уличные детали: фонарь, сетчатый забор, бетонный блок (render_battle: PROP3D / p_obj6)
  { id: 'street', variants: [P(DW + 'e_lamp.glb', 0.6, 2.4), P(DW + 'e_wirefence.glb', 1.0, 1.25, 0), P(DW + 'e_wirefence.glb', 1.0, 1.25, 90), P(DW + 'e_barrier.glb', 0.95, 0.6, 0), P(DW + 'e_barrier.glb', 0.95, 0.6, 90)] },
  { id: 'obj6', type: 6, variants: [P(S + 'env/e_sandbags.glb', 0.95, 0.55), P(S + 'env/e_sandbags.glb', 0.95, 0.55, 90), P(DW + 'e_barrier.glb', 0.95, 0.6, 45), P(S + 'env/e_sandbags.glb', 0.95, 0.55, 45)] }
  ,
  // база-диорама: постройки по номерам (basescene BLD3D): штаб, вышка, лазарет, мастерская, теплица, маяк, ворота, костёр, бак, склад.
  // На базе люди в масштабе 0,72 — высоты построек тоже уменьшены
  { id: 'base', variants: [P(DW + 'b_barracks.glb', 2.55, 2.6), P(DW + 'b_tower.glb', 1.2, 4.2), P(DW + 'b_infirmary.glb', 2.0, 2.0), P(DW + 'b_workshop.glb', 1.9, 2.0),
    P(DW + 'b_greenhouse.glb', 2.1, 1.7), P(DW + 'b_beacon.glb', 0.9, 3.2), P(DW + 'b_gate.glb', 1.7, 2.3, 90), P(DW + 'b_campfire.glb', 0.75, 0.6),
    P(DW + 'b_watertank.glb', 0.8, 1.8), P(DW + 'b_storage.glb', 1.3, 1.4),
    // этап 3: радиовышка, гараж, склад боеприпасов
    P(DW + 'b_radio.glb', 1.0, 3.0), P(DW + 'b_garage.glb', 1.45, 1.5), P(DW + 'b_ammo.glb', 1.1, 1.1)] }
];

module.exports = { CLIPS, HUMAN, FIGURE, WEAPONS, WEAPON_FALLBACK, BODIES, BODY_FALLBACK, CREATURES, PROPS };
