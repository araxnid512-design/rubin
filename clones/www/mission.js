'use strict';
/* global THREE */
// =====================================================================
//  ЗАДАНИЯ И ТАКТИКА: типы операций (зачистка, спасение, диверсия, взлом, оборона), таймер ходов,
//  зона эвакуации, подкрепления дроидов на десантном корабле, патроны, способности классов.
//  Подключается после game.js; кампания задаёт MISSION перед высадкой.
// =====================================================================
const MTYPES = {
  elim: { name: 'Зачистка', goal: 'Уничтожить всех дроидов' },
  rescue: { name: 'Спасение', goal: 'Освободить пленного и эвакуировать его' },
  sabotage: { name: 'Диверсия', goal: 'Заложить заряды и отступить' },
  hack: { name: 'Перехват', goal: 'Взломать терминал и уйти с данными' },
  defend: { name: 'Оборона', goal: 'Удержать маяк до прибытия канонерки' },
};
// { type, turns, charges, waves: [{ turn, types }], seed } — по умолчанию обычная зачистка
let MISSION = { type: 'elim' };

// клетки, где могут стоять цели: подальше от точки высадки, вне аванпоста и обломков
const OBJ_SPOTS = [[21, 9], [9, 14], [27, 13], [13, 5], [5, 12], [22, 25], [24, 16], [20, 4]];
const EVAC = { x: 4, z: 27, r: 1.8 };
const BEACON = [11, 24];
const DROP_SPOTS = [[24, 9], [27, 16], [16, 5], [20, 21], [9, 9], [27, 26]];

const Mission = (() => {
  let M = null, group = null;
  const glow = glowTex();
  const spr = (col, s, op = 1) => { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: col, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false })); m.scale.setScalar(s); return m; };

  function reset() {
    const m = MISSION || { type: 'elim' }, R = rng((m.seed || 7) * 31 + 5);
    const spots = OBJ_SPOTS.slice().sort(() => R() - 0.5);
    M = { type: m.type || 'elim', turns: m.turns || 0, waves: (m.waves || []).map(w => Object.assign({ done: false }, w)), objs: [], vip: null,
      evacOpen: false, evacuated: 0, beaconHp: 3, detonate: false, warned: {}, dropAt: null, R };
    if (M.type === 'sabotage') for (let i = 0; i < (m.charges || 2); i++) M.objs.push({ kind: 'charge', x: spots[i][0], z: spots[i][1], done: false });
    if (M.type === 'hack') M.objs.push({ kind: 'terminal', x: spots[0][0], z: spots[0][1], done: false });
    if (M.type === 'rescue') M.vipAt = spots[0];
    if (M.type === 'defend') M.objs.push({ kind: 'beacon', x: BEACON[0], z: BEACON[1], done: false });
  }
  reset();
  const needsEvac = () => M.type === 'rescue' || M.type === 'sabotage' || M.type === 'hack';
  const objectiveDone = () => M.type === 'rescue' ? !!(M.vip && !M.vip.captive) : M.objs.length ? M.objs.every(o => o.done) : true;

  // ---------- карта
  function reserved() { const t = M.objs.map(o => [o.x, o.z]); if (M.vipAt) t.push(M.vipAt); if (needsEvac()) t.push([EVAC.x, EVAC.z]); return t; }
  function mark(set) { for (const o of M.objs) set(o.x, o.z, FULL, K.OBJ); }
  // соседняя клетка каждого объекта должна быть достижима
  function mustReach() { const t = []; for (const o of M.objs) t.push([o.x + 1, o.z]); if (M.vipAt) t.push(M.vipAt); return t; }
  const near = (u, x, z) => Math.max(Math.abs(u.x - x), Math.abs(u.z - z)) <= 1;
  const inEvac = u => Math.hypot(u.x - EVAC.x, u.z - EVAC.z) <= EVAC.r;

  // ---------- объекты на поле
  function clear() {
    if (group) { world.remove(group); group.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    group = new THREE.Group(); world.add(group);
  }
  clear();
  const mm = (c, o = {}) => mat(c, o);
  // голографический значок над целью: виден сквозь туман войны
  function holo(text, col) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    g.strokeStyle = col; g.lineWidth = 7; g.fillStyle = 'rgba(5,14,24,.75)';
    g.beginPath(); g.moveTo(64, 8); g.lineTo(116, 56); g.lineTo(64, 104); g.lineTo(12, 56); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = col; g.font = 'bold 50px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 64, 60);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
    s.scale.setScalar(0.75); s.renderOrder = 9; return s;
  }
  function buildObj(o) {
    const g = new THREE.Group(); g.position.set(o.x + 0.5, 0, o.z + 0.5); group.add(g);
    if (o.kind === 'charge') { // генератор щита сепаратистов
      g.add(at(mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.3, 16), mm(0x3a3d44, { metalness: 0.6, roughness: 0.4 })), 0, 0.15, 0));
      g.add(at(mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.9, 12), mm(0x8c7a58, { metalness: 0.5, roughness: 0.45 })), 0, 0.75, 0));
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 10), new THREE.MeshBasicMaterial({ color: 0xff5040 })); core.position.y = 1.3; g.add(core);
      for (let i = 0; i < 3; i++) g.add(at(mesh(new THREE.BoxGeometry(0.06, 0.7, 0.06), mm(0x2a2c31, { metalness: 0.7 })), Math.cos(i * 2.1) * 0.3, 1.15, Math.sin(i * 2.1) * 0.3, Math.sin(i * 2.1) * 0.3, 0, -Math.cos(i * 2.1) * 0.3));
      const halo = spr(0xff5040, 1.2, 0.7); halo.position.y = 1.3; g.add(halo);
      o.core = core; o.halo = halo;
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.05), new THREE.MeshBasicMaterial({ color: 0x40ff70 })); led.position.set(0, 0.55, 0.3); led.visible = false; g.add(led); o.led = led;
    } else if (o.kind === 'terminal') { // пульт связи
      g.add(at(mesh(new THREE.BoxGeometry(0.8, 0.9, 0.5), mm(0x4a4f58, { metalness: 0.55, roughness: 0.4 })), 0, 0.45, 0));
      g.add(at(mesh(new THREE.BoxGeometry(0.86, 0.08, 0.56), mm(0x2c3036, { metalness: 0.6 })), 0, 0.92, 0));
      const c = document.createElement('canvas'); c.width = 64; c.height = 40; const x = c.getContext('2d'); x.fillStyle = '#081420'; x.fillRect(0, 0, 64, 40);
      x.fillStyle = '#ff6a50'; for (let i = 0; i < 6; i++) x.fillRect(4, 4 + i * 6, 10 + (i * 37) % 46, 3);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.36), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c) })); scr.position.set(0, 0.62, 0.26); g.add(scr); o.screen = scr;
      const ant = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 6), mm(0x2a2c31)); ant.position.set(0.3, 1.4, 0); g.add(ant);
      const tip = spr(0xff5040, 0.5); tip.position.set(0.3, 1.86, 0); g.add(tip); o.halo = tip;
      const prj = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.6, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0x6fd0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      prj.position.set(0, 1.35, 0); prj.rotation.x = Math.PI; g.add(prj); o.proj = prj;
    } else if (o.kind === 'beacon') { // маяк Республики
      g.add(at(mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.25, 8), mm(0xe8ecf0, { metalness: 0.3, roughness: 0.4 })), 0, 0.12, 0));
      g.add(at(mesh(new THREE.CylinderGeometry(0.07, 0.1, 2.0, 8), mm(0xd8dde2, { metalness: 0.4 })), 0, 1.2, 0));
      g.add(at(mesh(new THREE.BoxGeometry(0.5, 0.08, 0.08), mm(0xc8302a)), 0, 1.6, 0));
      const lamp = spr(0x6fd0ff, 1.4); lamp.position.y = 2.25; g.add(lamp); o.halo = lamp;
      const ring = new THREE.Mesh(new THREE.RingGeometry(2.35, 2.5, 48), new THREE.MeshBasicMaterial({ color: 0x6fd0ff, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; ring.renderOrder = 3; g.add(ring); o.ring = ring;
    }
    const icon = holo(o.kind === 'charge' ? '✸' : o.kind === 'terminal' ? '⌁' : '⚑', o.kind === 'beacon' ? '#6fd0ff' : '#ffc65a');
    icon.position.y = o.kind === 'beacon' ? 2.9 : 2.1; g.add(icon); o.icon = icon; o.g = g;
  }
  let evacG = null;
  function buildEvac() {
    evacG = new THREE.Group(); evacG.position.set(EVAC.x + 0.5, 0, EVAC.z + 0.5); group.add(evacG);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(EVAC.r + 0.4, 40), new THREE.MeshBasicMaterial({ color: 0x40ff90, transparent: true, opacity: 0.12, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.04; disc.renderOrder = 3; evacG.add(disc);
    const ring = new THREE.Mesh(new THREE.RingGeometry(EVAC.r + 0.25, EVAC.r + 0.4, 48), new THREE.MeshBasicMaterial({ color: 0x40ff90, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; ring.renderOrder = 3; evacG.add(ring);
    const icon = holo('⇪', '#40ff90'); icon.position.y = 2.2; evacG.add(icon);
    evacG.userData.ring = ring; evacG.visible = false;
  }
  function spawn() {
    for (const o of M.objs) buildObj(o);
    if (needsEvac()) buildEvac();
    if (M.type === 'rescue') {
      const [x, z] = M.vipAt;
      M.vip = makeUnit('clone', 'pilot', x, z, { call: MISSION.vip || 'Ворон', num: 'CT-7710', paint: '#e2b53b', captive: true, vip: true, mk: 0, ammo: 3, maxAmmo: 3 });
      M.vip.rig.root.visible = true; units.push(M.vip);
      // силовая клетка
      const cage = new THREE.Group(); cage.position.set(x + 0.5, 0, z + 0.5); group.add(cage);
      const f = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.5, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xff5a40, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      f.position.y = 0.75; cage.add(f);
      for (let i = 0; i < 4; i++) cage.add(at(mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.6, 6), mm(0x3a3d44, { metalness: 0.6 })), Math.cos(i * Math.PI / 2 + 0.78) * 0.58, 0.8, Math.sin(i * Math.PI / 2 + 0.78) * 0.58));
      const icon = holo('!', '#ffc65a'); icon.position.y = 2.1; cage.add(icon);
      M.cage = cage; M.cageField = f;
    }
  }

  // ---------- десантный корабль сепаратистов
  function dropship() {
    const g = new THREE.Group(), hull = mm(0x8e7d5c, { metalness: 0.55, roughness: 0.45 }), dark = mm(0x3b3a38, { metalness: 0.6, roughness: 0.4 });
    const body = mesh(new THREE.CapsuleGeometry(0.55, 2.2, 4, 12), hull); body.rotation.z = Math.PI / 2; g.add(body);
    g.add(at(mesh(new THREE.SphereGeometry(0.62, 16, 10), hull), 1.4, 0.05, 0));
    g.add(at(mesh(new THREE.BoxGeometry(0.5, 0.18, 0.5), mm(0x1a1c20, { metalness: 0.8, roughness: 0.2 })), 1.75, 0.18, 0));
    for (const s of [-1, 1]) {
      g.add(at(mesh(new THREE.BoxGeometry(1.8, 0.1, 1.3), hull), -0.2, 0.1, s * 1.0, 0, 0, s * 0.08));
      g.add(at(mesh(new THREE.CylinderGeometry(0.28, 0.32, 1.4, 12), dark), -0.3, -0.05, s * 1.55, 0, 0, Math.PI / 2));
      const e = spr(0xff7040, 1.1); e.position.set(-1.05, -0.05, s * 1.55); g.add(e);
      const l = spr(0xff3020, 0.5); l.position.set(0.4, 0.2, s * 1.65); g.add(l);
    }
    g.add(at(mesh(new THREE.BoxGeometry(0.9, 0.7, 0.08), hull), -1.1, 0.5, 0, 0, 0, -0.4));
    for (let i = 0; i < 3; i++) { const j = spr(0xffa060, 0.9, 0.85); j.position.set(-0.6 + i * 0.6, -0.6, 0); g.add(j); }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return g;
  }
  function pickDrop() {
    const cs = clones(); let best = null;
    for (const [x0, z0] of DROP_SPOTS) {
      const free = []; for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) { const x = x0 + dx, z = z0 + dz; if (inb(x, z) && cell(x, z) === FLOOR && !unitAt(x, z)) free.push([x, z]); }
      if (free.length < 4) continue;
      const dmin = cs.length ? Math.min(...cs.map(c => Math.hypot(c.x - x0, c.z - z0))) : 20;
      if (dmin < 7) continue;
      const sc = -Math.abs(dmin - 11) + M.R() * 3; if (!best || sc > best.sc) best = { x: x0, z: z0, free, sc };
    }
    return best;
  }
  let dropRing = null;
  function showDropMarker(d) {
    if (!dropRing) { dropRing = new THREE.Mesh(new THREE.RingGeometry(1.6, 1.85, 40), new THREE.MeshBasicMaterial({ color: 0xff4a3a, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide })); dropRing.rotation.x = -Math.PI / 2; dropRing.renderOrder = 3; }
    group.add(dropRing); dropRing.position.set(d.x + 0.5, 0.06, d.z + 0.5); dropRing.visible = true;
  }
  async function landWave(w) {
    const d = M.dropAt || pickDrop(); M.dropAt = null; if (dropRing) dropRing.visible = false; if (!d) return;
    const ship = dropship(); ship.position.set(d.x + 0.5 - 14, 16, d.z + 0.5 - 6); ship.rotation.y = 0.4; group.add(ship);
    const seen = !!vis[id(d.x, d.z)];
    banner('ПОДКРЕПЛЕНИЕ ДРОИДОВ', 'alert'); Snd.fx.alert();
    focus(d.x + 0.5, d.z + 0.5);
    const p0 = ship.position.clone(), p1 = new THREE.Vector3(d.x + 0.5, 2.2, d.z + 0.5);
    await tween(1.6, k => { const e = easeOut(k); ship.position.lerpVectors(p0, p1, e); ship.position.y = lerp(p0.y, p1.y, e) + Math.sin(k * Math.PI) * 1.5; ship.rotation.z = (1 - e) * 0.25; });
    for (let i = 0; i < 10; i++) FX.puff(d.x + 0.5 + rand(-1.5, 1.5), 0.2, d.z + 0.5 + rand(-1.5, 1.5), { color: 0xb09a7a, life: 1.6, s0: 0.4, s1: 1.8, vy: 0.4, a: 0.5 });
    cam.shake = Math.max(cam.shake, 0.2); Snd.fx.vault();
    const pod = PODS.length, tiles = d.free.sort(() => M.R() - 0.5).slice(0, w.types.length);
    PODS.push({ tiles, types: w.types }); podsActive.push(true);
    for (let i = 0; i < tiles.length; i++) {
      const [x, z] = tiles[i], u = makeUnit('droid', w.types[i], x, z, { pod, home: [x, z] });
      units.push(u); u.rig.root.visible = seen || !!vis[id(x, z)]; u.visible = !!vis[id(x, z)];
      if (u.rig.root.visible) { const r = u.rig.root; r.position.y = 1.5; tween(0.35, k => { r.position.y = 1.5 * (1 - k * k); }); }
      await wait(0.12);
    }
    await wait(0.4);
    await tween(1.2, k => { ship.position.y = 2.2 + k * k * 18; ship.position.x = d.x + 0.5 + k * k * 10; });
    group.remove(ship); ship.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    updateVisibility(); refreshUI();
  }

  // ---------- ходы
  function beforeTurn() {
    if (!M.turns) return false;
    if (turn > M.turns) {
      if (M.type === 'defend') { banner('КАНОНЕРКА ПРИБЫЛА', 'rep'); gameOver(true); }
      else { banner('ВРЕМЯ ВЫШЛО', 'sep'); gameOver(false); }
      return true;
    }
    return false;
  }
  function turnStarted() {
    for (const u of units) { if (u.team === 'droid') u.suppressed = false; else { u.suppressing = null; if (u.cd) for (const k in u.cd) u.cd[k] = Math.max(0, u.cd[k] - 1); } }
    if (M.vip && M.vip.captive) M.vip.ap = 0;
    // предупреждение о подкреплении за ход до высадки
    const w = M.waves.find(w => !w.done && w.turn === turn);
    if (w && !M.warned[w.turn]) { M.warned[w.turn] = true; M.dropAt = pickDrop(); if (M.dropAt) { showDropMarker(M.dropAt); setTimeout(() => { if (phase === 'player') { banner('ДЕСАНТ ДРОИДОВ В КОНЦЕ ХОДА', 'alert'); Snd.fx.alert(); } }, 1900); } }
    if (M.turns && M.turns - turn <= 2 && M.type !== 'defend') setTimeout(() => { if (phase === 'player') hint(`До провала задания: ${M.turns - turn + 1} ход(а)`); setTimeout(() => hint(''), 2500); }, 2000);
  }
  async function afterEnemy() {
    // заряды срабатывают в конце хода противника
    if (M.detonate) {
      M.detonate = false;
      for (const o of M.objs) {
        focus(o.x + 0.5, o.z + 0.5); await wait(0.45);
        await blast(o.x, o.z, { radius: 1.6, dmg: [4, 6], power: 1.6, cloneDmg: 1 });
        o.g.visible = false; o.done = true; grid[id(o.x, o.z)] = FLOOR; kind[id(o.x, o.z)] = K.NONE;
        for (let i = 0; i < 6; i++) FX.puff(o.x + 0.5, 0.6, o.z + 0.5, { color: 0x2b2725, life: 3, s0: 0.5, s1: 2.4, vy: 0.8, a: 0.6 });
      }
      buildBlobs(); updateVisibility();
      banner('ЦЕЛИ УНИЧТОЖЕНЫ', 'rep'); openEvac(); await wait(1);
      if (phase === 'over') return;
    }
    for (const w of M.waves) if (!w.done && w.turn === turn) { w.done = true; await landWave(w); }
    if (M.type === 'defend') {
      const o = M.objs[0], inZone = u => Math.hypot(u.x - o.x, u.z - o.z) <= 2.5;
      if (droids().some(inZone) && !clones().some(inZone)) {
        M.beaconHp--; focus(o.x + 0.5, o.z + 0.5); FX.spark(o.x + 0.5, 1.5, o.z + 0.5, 0x8fd8ff, 30, 3); Snd.fx.impact();
        banner(M.beaconHp > 0 ? `МАЯК ПОВРЕЖДЁН · ${M.beaconHp}/3` : 'МАЯК УНИЧТОЖЕН', 'sep'); await wait(1);
        if (M.beaconHp <= 0) gameOver(false);
      }
    }
  }
  function openEvac() {
    if (M.evacOpen || !needsEvac()) return; M.evacOpen = true;
    if (evacG) evacG.visible = true;
    setTimeout(() => { if (phase === 'player' || phase === 'enemy') { banner('ЗОНА ЭВАКУАЦИИ ОТКРЫТА', 'rep'); Snd.fx.roger(); } }, 300);
  }
  function check() {
    const alive = clones(), vipDead = M.vip && !M.vip.alive;
    if (vipDead) return 'lose';
    if (!alive.length) return M.evacuated && objectiveDone() && (M.type !== 'rescue' || M.vip.evac) ? 'win' : 'lose';
    const noDroids = !droids().length && M.waves.every(w => w.done);
    if (M.type === 'elim') return noDroids ? 'win' : null;
    if (M.type === 'defend') return noDroids ? 'win' : null;
    if (objectiveDone() && noDroids) return 'win';
    return null;
  }

  // ---------- действия: освободить, заложить заряд, взлом, эвакуация
  function action(u) {
    if (!u || !u.alive || u.ap <= 0) return null;
    if (M.vip && M.vip.captive && near(u, M.vip.x, M.vip.z)) return { kind: 'free', label: 'Освободить' };
    for (const o of M.objs) if (!o.done && !o.planted && near(u, o.x, o.z)) { if (o.kind === 'charge') return { kind: 'plant', o, label: 'Заряд' }; if (o.kind === 'terminal') return { kind: 'hack', o, label: 'Взлом' }; }
    if (M.evacOpen && inEvac(u)) return { kind: 'evac', label: 'Эвакуация' };
    return null;
  }
  async function use() {
    const u = selected, a = action(u); if (!a || busy || phase !== 'player') return;
    busy = true; hideTarget(); hint(''); refreshUI(); Snd.init();
    if (a.kind === 'free') {
      const v = M.vip; u.ap -= 1; await turnTo(u, faceTo(u, v.x + 0.5, v.z + 0.5)); u.state = 'aim'; Snd.fx.overwatch();
      await tween(0.8, k => { M.cageField.material.opacity = 0.22 * (1 - k); M.cageField.scale.set(1 + k * 0.4, 1 - k, 1 + k * 0.4); });
      M.cage.visible = false; u.state = 'idle'; v.captive = false; v.ap = 0;
      popText(v, 'СВОБОДЕН', 'crit'); banner('ПЛЕННЫЙ ОСВОБОЖДЁН', 'rep'); Snd.fx.roger(); openEvac(); buildSquadUI();
    } else if (a.kind === 'plant') {
      const o = a.o; u.ap -= 1; await turnTo(u, faceTo(u, o.x + 0.5, o.z + 0.5)); u.state = 'hunker'; Snd.fx.throwNade(); await wait(0.7); u.state = 'idle';
      o.planted = true; o.led.visible = true; o.icon.visible = false; popText(u, 'ЗАРЯД УСТАНОВЛЕН', 'crit');
      if (M.objs.every(x => x.planted)) { M.detonate = true; banner('ВСЕ ЗАРЯДЫ НА МЕСТЕ', 'rep'); hint('Взрыв — в конце хода противника. Отойдите от зарядов'); setTimeout(() => hint(''), 3500); }
    } else if (a.kind === 'hack') {
      const o = a.o; u.ap -= 1; await turnTo(u, faceTo(u, o.x + 0.5, o.z + 0.5)); u.state = 'aim'; Snd.fx.overwatch();
      await tween(1.2, k => { o.proj.material.opacity = Math.sin(k * Math.PI) * 0.45; o.proj.rotation.y = k * 6; o.screen.material.color.setRGB(1 - k * 0.6, 1, 1); });
      u.state = 'idle'; o.done = true; o.icon.visible = false; o.halo.material.color.set(0x40ff90); popText(u, 'ДАННЫЕ ПОЛУЧЕНЫ', 'crit'); banner('ПЕРЕХВАТ ЗАВЕРШЁН', 'rep'); openEvac();
    } else if (a.kind === 'evac') {
      u.ap = 0; u.overwatch = false; const r = u.rig.root, y0 = r.position.y; Snd.fx.vault();
      for (let i = 0; i < 5; i++) FX.puff(r.position.x + rand(-0.4, 0.4), 0.2, r.position.z + rand(-0.4, 0.4), { color: 0x7affb0, life: 1.4, s0: 0.3, s1: 1.2, vy: 1.2, a: 0.4 });
      await tween(1.1, k => { r.position.y = y0 + k * k * 7; });
      r.visible = false; u.evac = true; u.x = -50 - M.evacuated; u.z = -50; M.evacuated++;
      if (selected === u) selected = null; buildSquadUI(); updateVisibility();
    }
    busy = false; refreshUI(); checkEnd(); if (phase === 'player') afterAction();
  }

  // ---------- патроны и перезарядка
  function tryReload() {
    const u = selected; if (!u || busy || phase !== 'player' || u.ap <= 0 || !u.maxAmmo) return false;
    if (u.ammo > 0 && targetsFor(u).length) return false; // есть патроны и цели — обычный огонь
    if (u.ammo >= u.maxAmmo) return false;
    reload(u); return true;
  }
  async function reload(u) {
    busy = true; hideTarget(); refreshUI(); u.ap -= 1; u.state = 'reload'; u.reloadK = 0;
    Snd.fx.click(); await tween(0.9, k => { u.reloadK = k; if (Math.abs(k - 0.55) < 0.02) Snd.fx.click(); });
    u.state = 'idle'; u.ammo = u.maxAmmo; popText(u, 'ПЕРЕЗАРЯДКА', 'miss'); Snd.fx.overwatch();
    busy = false; refreshUI(); afterAction();
  }

  // ---------- способности классов
  const ABIL = {
    rally: { label: 'Клич', cd: 3, hint: 'Боевой клич: +15 меткости клонам рядом до конца хода' },
    medkit: { label: 'Медпакет', hint: 'Лечит себя или раненого соседа' },
    suppress: { label: 'Подавить', cd: 2, hint: 'Подавление: −30 меткости цели; если двинется — выстрел по ней' },
    aimed: { label: 'Прицельно', cd: 2, hint: 'Прицельный выстрел: +20 меткости, +2 урона; нужны 2 очка' },
  };
  const CLASS_ABIL = { commander: 'rally', trooper: 'medkit', heavy: 'suppress', sniper: 'aimed' };
  function abilOf(u) { return u && u.team === 'clone' ? CLASS_ABIL[u.type] : null; }
  function medTarget(u) {
    const cs = clones().filter(c => c === u || Math.max(Math.abs(c.x - u.x), Math.abs(c.z - u.z)) <= 1).filter(c => c.hp < c.maxHp);
    return cs.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0] || null;
  }
  function abilState(u) {
    const id = abilOf(u); if (!id) return null; const A = ABIL[id], cd = (u.cd && u.cd[id]) || 0;
    let ok = u.ap > 0 && !cd, why = cd ? `перезарядка ${cd}` : '';
    if (id === 'medkit') { ok = ok && u.medkits > 0 && !!medTarget(u); why = !u.medkits ? 'пусто' : ''; }
    if (id === 'aimed') ok = ok && u.ap >= 2 && u.ammo > 0 && targetsFor(u).length > 0;
    if (id === 'suppress') ok = ok && u.ammo > 0 && targetsFor(u).length > 0;
    return { id, A, ok, cd, why, count: id === 'medkit' ? u.medkits : cd || '' };
  }
  async function abil() {
    const u = selected, st = abilState(u); if (!st || !st.ok || busy || phase !== 'player') { if (st) { Snd.fx.deny(); hint(st.A.hint + (st.why ? ` (${st.why})` : '')); setTimeout(() => hint(''), 2200); } return; }
    Snd.init(); u.cd = u.cd || {};
    if (st.id === 'aimed' || st.id === 'suppress') { enterTarget(null); if (ui.mode === 'target') { ui.abil = st.id; u.aimBonus = st.id === 'aimed' ? 20 : 0; showTarget(); hint(st.A.hint); } return; }
    busy = true; refreshUI();
    if (st.id === 'rally') {
      u.ap -= 1; u.cd.rally = u.rallyCd || ABIL.rally.cd; u.state = 'aim'; Snd.fx.roger(); banner('БОЕВОЙ КЛИЧ', 'rep');
      for (const c of clones()) if (u.rallyAll || Math.hypot(c.x - u.x, c.z - u.z) <= 6) { c.rallied = turn; popText(c, '+15', 'crit'); FX.flash(c.rig.root.position.x, 1.1, c.rig.root.position.z, 0x6fd0ff, 0.8, 0.3); }
      await wait(0.7); u.state = 'idle';
    } else if (st.id === 'medkit') {
      const t = medTarget(u); u.ap -= 1; u.medkits--; if (t !== u) await turnTo(u, faceTo(u, t.x + 0.5, t.z + 0.5)); u.state = 'hunker';
      Snd.fx.hunker(); await wait(0.6); const h = Math.min(t.maxHp - t.hp, 3 + (u.medBonus || 0)); t.hp += h;
      popText(t, '+' + h, 'crit'); FX.flash(t.rig.root.position.x, 0.9, t.rig.root.position.z, 0x40ff90, 0.9, 0.35); u.state = 'idle';
    }
    busy = false; refreshUI(); afterAction();
  }
  async function fireAbility(u, t) {
    const id = ui.abil; ui.abil = null; u.cd = u.cd || {};
    if (id === 'aimed') { u.ap = 0; ui.mode = 'move'; u.dmgBonus = 2; u.cd.aimed = ABIL.aimed.cd; await shoot(u, t); u.dmgBonus = 0; u.aimBonus = 0; afterAction(); return; }
    // подавление: очередь по укрытию цели без попаданий, цель прижата к земле
    u.aimBonus = 0; u.ap = 0; ui.mode = 'move'; hideTarget(); busy = true; refreshUI(); u.cd.suppress = ABIL.suppress.cd; if (u.ammo > 0) u.ammo--;
    u.state = 'aim'; await turnTo(u, faceTo(u, t.x + 0.5, t.z + 0.5)); focus((u.x + t.x) / 2 + 0.5, (u.z + t.z) / 2 + 0.5);
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Vector3(); u.rig.muzzle.getWorldPosition(m);
      const e = new THREE.Vector3(t.x + 0.5 + rand(-0.8, 0.8), rand(0.1, 0.9), t.z + 0.5 + rand(-0.8, 0.8));
      Snd.fx.blaster('clone'); FX.muzzle(m, TEAMCOL.clone); recoil(u); FX.bolt(m, e, 'clone', 45).then(() => FX.spark(e.x, e.y, e.z, 0xffc070, 6, 2)); await wait(0.11);
    }
    t.suppressed = true; u.suppressing = t; t.flinch = 1; popText(t, 'ПОДАВЛЕН', 'crit');
    await wait(0.5); u.state = 'idle'; busy = false; refreshUI(); afterAction();
  }

  // ---------- модификаторы правил
  function aimMod(s, t, d) {
    let a = s.aimBonus || 0;
    if (s.rallied === turn && s.team === 'clone') a += 15;
    if (s.suppressed) a -= 30;
    if (s.closeAim && d <= 4) a += s.closeAim;
    if (t.type === 'tx' || s.type === 'tx') a += 0;
    if (s.team === 'droid' && droids().some(o => o.type === 'tx' && o !== s && Math.hypot(o.x - s.x, o.z - s.z) <= 6)) a += 10; // командир сепаратистов воодушевляет своих
    return a;
  }
  function absorb(t, dmg) {
    if (!t.shield) return dmg;
    const a = Math.min(t.shield, dmg); t.shield -= a; Snd.fx.impact();
    if (t.rig.shieldMesh) { const m = t.rig.shieldMesh.material; m.opacity = 0.65; if (!t.shield) t.rig.shieldMesh.visible = false; }
    return dmg - a;
  }
  // отшатывание от попадания: шаг назад от стрелка и обратно
  function stagger(t, dir) {
    const r = t.rig.root, p0 = r.position.clone(), d = dir.clone().multiplyScalar(0.16);
    t.staggerSide = Math.random() < 0.5 ? -1 : 1;
    tween(0.42, k => { const e = Math.sin(Math.min(1, k * 1.6) * Math.PI) * (1 - k * 0.3); r.position.set(p0.x + d.x * e, p0.y, p0.z + d.z * e); });
  }
  function aiBias(d, x, z) {
    if (M.type === 'defend' && M.objs[0]) return -Math.hypot(x - M.objs[0].x, z - M.objs[0].z) * 1.6;
    return 0;
  }

  // ---------- интерфейс
  function objText() {
    const T = MTYPES[M.type], left = M.turns ? Math.max(0, M.turns - turn + 1) : 0;
    let goal = T.goal;
    if (M.type === 'elim') goal = `Дроидов осталось: ${droids().length}`;
    if (M.type === 'sabotage') goal = M.detonate ? 'Взрыв в конце хода противника' : M.evacOpen ? 'Отступить в зону эвакуации' : `Заряды: ${M.objs.filter(o => o.planted).length}/${M.objs.length}`;
    if (M.type === 'hack') goal = M.evacOpen ? 'Уйти с данными в зону эвакуации' : 'Взломать терминал';
    if (M.type === 'rescue') goal = M.vip && !M.vip.captive ? 'Эвакуировать пилота' : 'Освободить пленного пилота';
    if (M.type === 'defend') goal = `Удержать маяк · ${M.beaconHp}/3`;
    const timer = M.turns ? ` · <b class="${left <= 2 ? 'warnT' : ''}">${M.type === 'defend' ? 'канонерка через' : 'осталось'} ${left} ход.</b>` : '';
    const wave = M.waves.find(w => !w.done && w.turn >= turn);
    return `${goal}${timer}${wave && wave.turn - turn <= 1 ? ' · <b class="warnT">десант!</b>' : ''}`;
  }
  function setCnt(btn, v) { let c = btn.querySelector('.cnt'); if (!c) { c = document.createElement('b'); c.className = 'cnt'; btn.appendChild(c); } c.textContent = v === '' || v === undefined ? '' : v; }
  function uiHook(u, can) {
    const live = u && u.alive && phase === 'player' && !busy;
    const a = live ? action(u) : null, bu = $('aUse');
    bu.style.display = a ? '' : 'none'; if (a) bu.querySelector('.lbl').textContent = a.label;
    bu.classList.toggle('primary', !!a && a.kind !== 'evac'); bu.classList.toggle('evacB', !!a && a.kind === 'evac');
    const st = live ? abilState(u) : null, ba = $('aAbil');
    ba.style.display = st ? '' : 'none';
    if (st) { ba.querySelector('.lbl').textContent = st.A.label; ba.disabled = !st.ok; setCnt(ba, st.count); ba.classList.toggle('on', ui.abil === st.id); }
    // огонь ↔ перезарядка
    const bs = $('aShoot'), rel = live && u.maxAmmo && u.ap > 0 && (u.ammo === 0 || (!targetsFor(u).length && u.ammo < u.maxAmmo));
    bs.querySelector('.lbl').textContent = rel ? 'Перезарядка' : 'Огонь'; bs.classList.toggle('reload', !!rel);
    if (rel) bs.disabled = false;
    setCnt(bs, u && u.maxAmmo ? u.ammo : '');
  }
  $('aUse').addEventListener('click', () => { Snd.init(); use(); });
  $('aAbil').addEventListener('click', () => { abil(); });

  // ---------- анимация объектов
  let t = 0;
  function update(dt) {
    t += dt;
    for (const o of M.objs) {
      if (o.icon) o.icon.position.y = (o.kind === 'beacon' ? 2.9 : 2.1) + Math.sin(t * 2 + o.x) * 0.08;
      if (o.kind === 'charge' && o.core) { const p = 1 + Math.sin(t * 4 + o.x) * 0.12; o.core.scale.setScalar(p); o.halo.material.opacity = 0.5 + Math.sin(t * 4 + o.x) * 0.25; if (o.planted) o.led.visible = (t * 3 % 1) < 0.5; }
      if (o.kind === 'beacon') { o.halo.material.opacity = 0.6 + Math.sin(t * 3) * 0.35; o.ring.rotation.z += dt * 0.3; o.ring.material.color.set(M.beaconHp >= 3 ? 0x6fd0ff : M.beaconHp === 2 ? 0xffc65a : 0xff5a40); }
      if (o.kind === 'terminal' && !o.done) o.halo.material.opacity = (t * 1.5 % 1) < 0.5 ? 1 : 0.2;
    }
    if (M.cage && M.cage.visible) M.cageField.material.opacity = 0.18 + Math.sin(t * 5) * 0.06;
    if (evacG && evacG.visible) {
      evacG.userData.ring.material.opacity = 0.55 + Math.sin(t * 4) * 0.3;
      if ((t * 2.5 % 1) < dt * 2.5) FX.puff(EVAC.x + 0.5 + rand(-0.15, 0.15), 0.3, EVAC.z + 0.5 + rand(-0.15, 0.15), { color: 0x5aff9a, life: 2.6, s0: 0.25, s1: 1.4, vy: 1.4, a: 0.35 });
    }
    if (dropRing && dropRing.visible) { dropRing.material.opacity = 0.5 + Math.sin(t * 6) * 0.35; dropRing.rotation.z += dt; }
    for (const u of units) if (u.rig.shieldMesh && u.alive && u.shield) { const m = u.rig.shieldMesh.material; m.opacity = Math.max(0.16, m.opacity - dt * 1.2); }
  }

  return {
    reset, clear, spawn, reserved, mark, mustReach, beforeTurn, turnStarted, afterEnemy, check, afterMove: () => {}, update,
    aimMod, absorb, stagger, aiBias, objText, ui: uiHook, tryReload, fireAbility, abilState,
    get state() { return M; },
  };
})();
