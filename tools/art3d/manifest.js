// Что запекать: тела людей и существ, слои оружия, реквизит. Отсутствующие исходники пропускаются.
const S = '/art3d/src/';
const DW = S + 'dw/';
const CLIPS = S + 'player.glb'; // клипы с винтовкой (герой «Стикса», скелет Mixamo)

// Набор движений человека с оружием (кадров на направление; направлений 8)
const HUMAN = [
  { key: 'idle', clip: 'IdleRifle', n: 4, loop: true, fps: 2 },
  { key: 'walk', clip: 'WalkRifle', n: 8, loop: true },
  { key: 'run', clip: 'RunRifle', n: 6, loop: true },
  { key: 'aim', clip: 'AimRifle', n: 1, t0: 0.5 },
  { key: 'shoot', clip: 'ShootRifle', n: 2, t0: 0, t1: 0.1 },
  { key: 'reload', clip: 'ReloadRifle', n: 6, noIK: true },
  { key: 'hit', clip: 'HitRifle', n: 2, t0: 0.05, t1: 0.3 },
  { key: 'die', clip: 'Death', n: 6, noIK: true },
  { key: 'melee', clip: 'Melee', n: 4, noIK: true },
  { key: 'crouch', clip: 'IdleRifle', n: 1, crouch: 0.4 },
  { key: 'crouchAim', clip: 'AimRifle', n: 1, t0: 0.5, crouch: 0.4 },
  { key: 'hunker', clip: 'IdleRifle', n: 1, crouch: 0.62 }
];
// Крупная фигура (экран отряда): стойка с оружием
const FIGURE = [{ key: 'pose', clip: 'IdleRifle', n: 1, t0: 0.4 }];
const W = (id, file, len, grip, fore, gy, fy, my) => ({ id, src: file, len, grip, fore, gy, fy, my });
// Оружие игры → модель (ствол к −Z), длина, хват (доли от приклада), высоты точек (доли высоты)
const WEAPONS = [
  W('ppsh', DW + 'w_ppsh2.glb', 0.84, 0.36, 0.58, 0.55, 0.72, 0.85),
  W('ak', S + 'w_ak47.glb', 0.88, 0.36, 0.58, 0.55, 0.72, 0.85),
  W('shotgun', S + 'w_spas12.glb', 1.0, 0.3, 0.6, 0.5, 0.62, 0.85),
  W('sniper', S + 'w_svd.glb', 1.22, 0.32, 0.55, 0.5, 0.7, 0.85),
  W('lmg', S + 'w_rpk.glb', 1.04, 0.33, 0.52, 0.55, 0.72, 0.85),
  W('ak2', S + 'w_ak107.glb', 0.94, 0.36, 0.6, 0.55, 0.72, 0.85),
  Object.assign(W('hsniper', DW + 'w_ksvk.glb', 1.35, 0.42, 0.6, 0.45, 0.6, 0.75), { flip: true }),
  W('hlmg', DW + 'w_kord.glb', 1.6, 0.3, 0.5, 0.5, 0.65, 0.8),
  W('rpg', DW + 'w_rpg.glb', 1.0, 0.42, 0.62, 0.35, 0.55, 0.6)
];
// запасные модели, пока новых нет
const WEAPON_FALLBACK = { ppsh: DW + 'w_ppsh.glb', hsniper: S + 'w_awm.glb', hlmg: S + 'w_pkt.glb' };

const B = (id, src, opt) => Object.assign({ id, src }, opt || {});
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
  B('boss', DW + 'c_boss_a.glb', { h: 1.9 })
];
// у файлов без «_a» (модели без движений Tripo) — скелет в основном файле
const BODY_FALLBACK = {};

const C = (key, clip, n, o) => Object.assign({ key, clip, n }, o || {});
const CREATURES = [
  { id: 'brute', src: DW + 'm_brute_a.glb', more: DW + 'm_brute_b.glb', h: 2.3, box: [1.4, 2.5], anims: [C('idle', 'idle', 4, { loop: true, fps: 2 }), C('walk', 'walk', 8, { loop: true }), C('run', 'run', 6, { loop: true }), C('atk', 'slash', 5), C('hit', 'hit_to_body_01', 2, { t1: 0.4 }), C('die', 'fall', 6), C('roar', 'angry_01', 4)] },
  { id: 'spitter', src: DW + 'm_spitter_a.glb', more: DW + 'm_spitter_b.glb', h: 1.6, anims: [C('idle', 'idle', 4, { loop: true, fps: 2 }), C('walk', 'walk', 8, { loop: true }), C('run', 'run', 6, { loop: true }), C('atk', 'shoot', 4), C('hit', 'hit_to_body_01', 2, { t1: 0.4 }), C('die', 'fall', 6)] },
  { id: 'guardian', src: DW + 'm_guardian_a.glb', h: 1.95, anims: [C('idle', 'idle', 4, { loop: true, fps: 2 }), C('walk', 'walk', 8, { loop: true }), C('atk', 'shoot', 3), C('hit', 'hit_to_body_01', 2, { t1: 0.4 }), C('die', 'fall', 6)] },
  { id: 'scav', src: DW + 'm_scav_a.glb', h: 1.0, quad: true, box: [1.2, 1.2], anims: [C('walk', 'walk', 8, { loop: true }), C('idle', 'walk', 1)] },
  { id: 'queen', src: DW + 'm_queen_a.glb', h: 1.9, quad: true, box: [2.0, 2.8], anims: [C('walk', 'walk', 8, { loop: true }), C('idle', 'walk', 1)] }
];

// Реквизит: тип клетки игры → модели (варианты), длина по большей стороне в клетках, предел высоты (м)
const P = (src, len, hMax, yaw, k) => ({ src, len, hMax, yaw: yaw || 0, k });
const PROPS = [
  { id: 'obj3', type: 3, variants: [P(DW + 'e_boulder.glb', 0.95, 1.15), P(DW + 'e_boulder.glb', 0.85, 1.0, 120), P(DW + 'e_boulder.glb', 0.9, 1.1, 230)] },
  { id: 'obj4', type: 4, variants: [P(S + 'env/e_crate.glb', 0.8, 0.7), P(S + 'env/e_chest.glb', 0.85, 0.6, 30), P(S + 'env/e_ammo.glb', 0.8, 0.75, 90)] },
  { id: 'obj5', type: 5, variants: [P(DW + 'e_deadtree.glb', 1.1, 3.2), P(DW + 'e_deadtree.glb', 1.0, 2.9, 140), P(DW + 'e_deadtree.glb', 1.05, 3.0, 250)] },
  { id: 'obj7', type: 7, variants: [P(S + 'env/e_vaz_burned.glb', 1.45, 1.0, 20), P(S + 'env/e_vaz_crashed.glb', 1.45, 1.0, -60), P(S + 'env/e_volga.glb', 1.5, 1.0, 110)] },
  { id: 'obj8', type: 8, variants: [P(DW + 'e_rubble.glb', 1.0, 0.95), P(DW + 'e_rubble.glb', 0.95, 0.9, 120), P(S + 'env/e_block.glb', 0.9, 0.9, 30)] },
  { id: 'obj9', type: 9, variants: [P(S + 'env/e_barrel.glb', 0.45, 0.95), P(S + 'env/e_hazard.glb', 0.45, 0.95), P(S + 'env/e_barrel.glb', 0.45, 0.95, 90)] },
  { id: 'obj10', type: 10, variants: [P(DW + 'e_tent.glb', 1.0, 1.4), P(DW + 'e_tent.glb', 1.0, 1.4, 90), P(DW + 'e_tent.glb', 0.95, 1.35, 200)] },
  { id: 'obj12', type: 12, variants: [P(DW + 'e_generator.glb', 0.85, 1.0), P(S + 'env/e_lathe.glb', 0.85, 0.9, 30), P(DW + 'e_generator.glb', 0.85, 1.0, 120)] },
  { id: 'obj15', type: 15, variants: [P(DW + 'e_portal.glb', 1.1, 3.0, 45)] },
  { id: 'obj16', type: 16, variants: [P(DW + 'e_chitin.glb', 0.85, 1.0), P(DW + 'e_chitin.glb', 0.8, 0.95, 120), P(DW + 'e_chitin.glb', 0.85, 1.0, 240)] },
  { id: 'obj18', type: 18, variants: [P(DW + 'e_container.glb', 1.15, 1.25, 45), P(S + 'env/e_dumpster.glb', 1.0, 1.0, 45), P(DW + 'e_container.glb', 1.15, 1.25, -45)] },
  { id: 'obj19', type: 19, variants: [P(DW + 'e_log.glb', 1.15, 0.5), P(DW + 'e_log.glb', 1.1, 0.5, 90), P(S + 'env/e_woodpile.glb', 0.9, 0.6, 30)] },
  { id: 'obj20', type: 20, variants: [P(DW + 'e_crystal.glb', 0.8, 1.2), P(DW + 'e_crystal.glb', 0.75, 1.1, 120), P(DW + 'e_crystal.glb', 0.8, 1.15, 240)] },
  // мебель в домах: низкое укрытие (столы, кровати, диваны, комоды, сундуки, нары) и шкафы — полное
  { id: 'obj21', type: 21, variants: [P(S + 'env/e_table.glb', 0.85, 0.62, 30), P(S + 'env/e_bed.glb', 0.95, 0.55, -60), P(S + 'env/e_sofa.glb', 0.95, 0.6, 120),
    P(S + 'env/e_drawers.glb', 0.75, 0.75, 45), P(S + 'env/e_chest.glb', 0.75, 0.55, -45), P(S + 'env/e_bunk.glb', 0.95, 0.85, 30), P(S + 'env/e_bench.glb', 0.9, 0.5, -30),
    P(S + 'env/e_nightstand.glb', 0.6, 0.6, 45), P(S + 'env/e_tv.glb', 0.6, 0.65, 60), P(S + 'env/e_chair.glb', 0.55, 0.75, 20)] },
  { id: 'obj22', type: 22, variants: [P(S + 'env/e_wardrobe.glb', 0.8, 1.45, 45), P(S + 'env/e_fridge.glb', 0.7, 1.4, -45), P(S + 'env/e_buffet.glb', 0.85, 1.4, 45),
    P(S + 'env/e_pech.glb', 0.85, 1.45, -45), P(S + 'env/e_burzhuyka.glb', 0.65, 1.2, 30)] },
  // турель — по направлениям (8 вариантов поворота)
  { id: 'turret', variants: [0, 1, 2, 3, 4, 5, 6, 7].map((d) => P(DW + 'e_turret.glb', 0.8, 1.1, 90 - d * 45)) },
  // украшения карты: машины, покрышки, мусор (тип клетки не занят — рисуются как декор)
  { id: 'decor', variants: [P(S + 'env/e_tire.glb', 0.5, 0.3), P(S + 'env/e_trashbags.glb', 0.6, 0.5), P(S + 'env/e_pipes.glb', 0.9, 0.5), P(S + 'env/e_vaz2107.glb', 1.5, 1.0, 30), P(S + 'env/e_uaz.glb', 1.5, 1.2, -30), P(S + 'env/e_ural.glb', 2.2, 1.9, 60), P(S + 'env/e_btr80.glb', 2.3, 1.6, -20), P(S + 'env/e_paz.glb', 2.4, 1.9, 40), P(S + 'env/e_well.glb', 0.9, 1.6), P(S + 'env/e_sandbags.glb', 0.9, 0.6)] }
];

module.exports = { CLIPS, HUMAN, FIGURE, WEAPONS, WEAPON_FALLBACK, BODIES, BODY_FALLBACK, CREATURES, PROPS };
