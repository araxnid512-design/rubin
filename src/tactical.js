'use strict';
// ---------- Тактический бой: правила, ИИ зомби, ход вылазки ----------

const TAC = { m: null, sel: 0, reach: null, busy: false, pend: null, mode: null };
const TOD_NAME = ['День', 'Сумерки', 'Ночь'];
const STEP_MS = 120;
const WAVE_EVERY = 7;
const LURE_RANGE = 8;

function spd(ms) { return ms * [1.6, 1, 0.5, 0][CFG.speed ?? 1]; }
function timeOfDay(m) { return m.turn <= 14 ? 0 : m.turn <= 24 ? 1 : 2; }
function sightR(m) { return [9, 7, 5][timeOfDay(m)]; }
function liveUnits(m) { return m.units.filter(u => !u.dead && !u.evac); }
function unitAt(m, x, y) { return m.units.find(u => u.x === x && u.y === y && !u.dead && !u.evac); }
function zombieAt(m, x, y) { return m.zombies.find(z => z.x === x && z.y === y); }
function curUnit() { const m = TAC.m; return m && m.units.find(u => u.id === TAC.sel && !u.dead && !u.evac); }
function zVisible(m, z) { return !!m.vis[MI(m, z.x, z.y)]; }
function visibleZombies(m) { return m.zombies.filter(z => zVisible(m, z)); }
function inEvac(m, u) { return m.evac.includes(MI(m, u.x, u.y)); }
function carried(u) { let w = 0; for (const k in u.inv) w += u.inv[k] * RES[k].w; return Math.round(w * 10) / 10; }
function walkT(m, x, y) { if (!inb(m, x, y)) return false; const t = m.tiles[MI(m, x, y)]; return TP[t].walk && t !== T.DOOR; }
// Соседство с учётом углов стен
function adjOK(m, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  if (Math.max(Math.abs(dx), Math.abs(dy)) !== 1) return false;
  if (dx && dy) return walkT(m, ax + dx, ay) && walkT(m, ax, ay + dy);
  return true;
}

// ----- Видимость -----
function castRay(m, x0, y0, x1, y1, r) {
  const r2 = r * r + r;
  let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy, x = x0, y = y0, dens = 0;
  for (let g = 0; g < 64; g++) {
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
    if (!inb(m, x, y) || (x - x0) ** 2 + (y - y0) ** 2 > r2) break;
    const i = MI(m, x, y);
    m.vis[i] = 1; m.seen[i] = 1;
    const tp = TP[m.tiles[i]];
    if (tp.block) break;
    dens += tp.dens;
    if (dens >= 3) break;
  }
}
function computeVis(m) {
  m.vis.fill(0);
  const base = sightR(m);
  for (const u of liveUnits(m)) {
    const r = base + (u.trait === 'hunter' ? 2 : 0);
    const i0 = MI(m, u.x, u.y);
    m.vis[i0] = 1; m.seen[i0] = 1;
    for (let k = -r; k <= r; k++) {
      castRay(m, u.x, u.y, u.x + k, u.y - r, r); castRay(m, u.x, u.y, u.x + k, u.y + r, r);
      castRay(m, u.x, u.y, u.x - r, u.y + k, r); castRay(m, u.x, u.y, u.x + r, u.y + k, r);
    }
  }
  // стены вокруг видимого пола
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const i = y * m.w + x;
    if (m.vis[i] !== 1 || TP[m.tiles[i]].block) continue;
    for (const [dx, dy] of DIR8) {
      const nx = x + dx, ny = y + dy;
      if (!inb(m, nx, ny)) continue;
      const j = ny * m.w + nx;
      if (!m.vis[j] && TP[m.tiles[j]].block) { m.vis[j] = 2; m.seen[j] = 1; }
    }
  }
  R.dirty = true;
}
function losLine(m, x0, y0, x1, y1) {
  if (x0 === x1 && y0 === y1) return true;
  let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy, x = x0, y = y0, dens = 0;
  for (let g = 0; g < 128; g++) {
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
    if (x === x1 && y === y1) return true;
    const t = TP[m.tiles[MI(m, x, y)]];
    if (t.block) return false;
    dens += t.dens;
    if (dens >= 3) return false;
  }
  return false;
}
function los(m, a, b) { return losLine(m, a.x, a.y, b.x, b.y) || losLine(m, b.x, b.y, a.x, a.y); }

// ----- Пути бойцов (Дейкстра по ОД) -----
function reachFor(m, u) {
  const n = m.n, dist = new Int16Array(n).fill(-1), prev = new Int32Array(n).fill(-1), occ = new Uint8Array(n);
  for (const z of m.zombies) if (zVisible(m, z)) occ[MI(m, z.x, z.y)] = 1;
  for (const o of liveUnits(m)) if (o !== u) occ[MI(m, o.x, o.y)] = 1;
  const max = u.ap, buckets = [];
  for (let k = 0; k <= max + 2; k++) buckets.push([]);
  const s = MI(m, u.x, u.y);
  dist[s] = 0; buckets[0].push(s);
  for (let c = 0; c <= max; c++) {
    const b = buckets[c];
    for (let bi = 0; bi < b.length; bi++) {
      const i = b[bi];
      if (dist[i] !== c) continue;
      const x = i % m.w, y = (i / m.w) | 0;
      for (const [dx, dy] of DIR8) {
        const nx = x + dx, ny = y + dy;
        if (!inb(m, nx, ny)) continue;
        const j = ny * m.w + nx, t = m.tiles[j], tp = TP[t];
        if (!tp.walk || occ[j]) continue;
        if (dx && dy && (t === T.DOOR || !walkT(m, x + dx, y) || !walkT(m, x, y + dy))) continue;
        const nc = c + tp.cost;
        if (nc > max) continue;
        if (dist[j] === -1 || nc < dist[j]) { dist[j] = nc; prev[j] = i; buckets[nc].push(j); }
      }
    }
  }
  return { dist, prev, uid: u.id, ap: u.ap, x: u.x, y: u.y };
}
function pathTo(m, rf, j) {
  const s = MI(m, rf.x, rf.y), path = [];
  for (let i = j, g = 0; i !== s && g < 200; i = rf.prev[i], g++) { if (i < 0) return null; path.push(i); }
  return path.reverse();
}
function refreshReach() {
  const u = curUnit();
  TAC.reach = u && TAC.m.phase === 'player' ? reachFor(TAC.m, u) : null;
  R.dirty = true;
}

// ----- Пути зомби (BFS) -----
const ZB = { n: 0, q: null, prev: null, mark: null, stamp: 0 };
function zPath(m, z, tx, ty) {
  if (ZB.n !== m.n) { ZB.n = m.n; ZB.q = new Int32Array(m.n); ZB.prev = new Int32Array(m.n); ZB.mark = new Uint32Array(m.n); ZB.stamp = 0; }
  const { q, prev, mark } = ZB, st = ++ZB.stamp, s = MI(m, z.x, z.y);
  mark[s] = st; prev[s] = -1; q[0] = s;
  let qh = 0, qt = 1, found = -1;
  const goal = (x, y) => (x === tx && y === ty) || adjOK(m, x, y, tx, ty);
  while (qh < qt && qt < m.n) {
    const i = q[qh++], x = i % m.w, y = (i / m.w) | 0;
    if (i !== s && goal(x, y) && !m.uocc[i]) { found = i; break; }
    for (const [dx, dy] of DIR8) {
      const nx = x + dx, ny = y + dy;
      if (!inb(m, nx, ny)) continue;
      const j = ny * m.w + nx;
      if (mark[j] === st || !TP[m.tiles[j]].walk || m.uocc[j]) continue;
      if (dx && dy && (m.tiles[j] === T.DOOR || !walkT(m, x + dx, y) || !walkT(m, x, y + dy))) continue;
      mark[j] = st; prev[j] = i; q[qt++] = j;
    }
  }
  if (found < 0) return null;
  const path = [];
  for (let i = found; i !== s; i = prev[i]) path.push(i);
  return path.reverse();
}
// Обход, если путь занят другим зомби
function sideStep(m, z, tx, ty) {
  let best = -1, bd = edist(z.x, z.y, tx, ty) + 0.01;
  for (const [dx, dy] of DIR8) {
    const nx = z.x + dx, ny = z.y + dy;
    if (!walkT(m, nx, ny)) continue;
    if (dx && dy && (!walkT(m, z.x + dx, z.y) || !walkT(m, z.x, z.y + dy))) continue;
    const j = MI(m, nx, ny);
    if (m.zocc[j] || m.uocc[j]) continue;
    const d = edist(nx, ny, tx, ty);
    if (d < bd) { bd = d; best = j; }
  }
  return best;
}
function buildOcc(m) {
  m.zocc = new Uint8Array(m.n); m.uocc = new Uint8Array(m.n);
  for (const z of m.zombies) m.zocc[MI(m, z.x, z.y)] = 1;
  for (const u of liveUnits(m)) m.uocc[MI(m, u.x, u.y)] = 1;
}

// ----- Шум -----
function noise(m, x, y, r) {
  if (r <= 0) return;
  FX.ring(x, y, r);
  m.tp += r / 5;
  if (r >= 4) m.lastNoise = { x, y, turn: m.turn };
  for (const z of m.zombies) {
    if (z.state === 'chase') continue;
    if (edist(z.x, z.y, x, y) <= r) {
      z.state = 'investigate';
      z.tx = clamp(x + rint(-1, 1), 0, m.w - 1); z.ty = clamp(y + rint(-1, 1), 0, m.h - 1);
    }
  }
}

// ----- Зомби -----
function addZombie(m, x, y, type, state) {
  const z = { id: m.zid++, type, x, y, hp: ZT[type].hp, state, tx: x, ty: y, target: 0, screamed: false, f: rint(0, 7) };
  m.zombies.push(z);
  if (m.zocc) m.zocc[MI(m, x, y)] = 1;
  return z;
}
function perceive(m, z) {
  const t = ZT[z.type], tod = timeOfDay(m);
  let best = null, bd = 1e9;
  for (const u of liveUnits(m)) {
    const d = edist(z.x, z.y, u.x, u.y);
    let sr = t.sight - tod;
    if (u.trait === 'quiet') sr -= 2;
    if (TP[m.tiles[MI(m, u.x, u.y)]].hide) sr = Math.min(sr, 2.5);
    if ((d <= 1.5 || (d <= sr && los(m, z, u))) && d < bd) { bd = d; best = u; }
  }
  if (best) {
    const was = z.state;
    z.state = 'chase'; z.target = best.id; z.tx = best.x; z.ty = best.y;
    if (was !== 'chase' && zVisible(m, z) && chance(0.5)) Sfx.play('groan');
    return was !== 'chase';
  }
  if (z.state === 'chase') z.state = 'investigate';
  return false;
}
async function zMove(m, z, j) {
  const show = zVisible(m, z) || m.vis[j];
  m.zocc[MI(m, z.x, z.y)] = 0; m.zocc[j] = 1;
  await animTo(z, j % m.w, (j / m.w) | 0, show ? spd(STEP_MS * 0.75) : 0);
}
async function wander(m, z) {
  const opts = [];
  for (const [dx, dy] of DIR4) {
    const nx = z.x + dx, ny = z.y + dy;
    if (!walkT(m, nx, ny)) continue;
    const j = MI(m, nx, ny);
    if (!m.zocc[j] && !m.uocc[j]) opts.push(j);
  }
  if (opts.length) await zMove(m, z, pick(opts));
}
async function bashDoor(m, z, i) {
  const brute = z.type === 'brute';
  m.doorHP[i] = (m.doorHP[i] ?? 6) - (brute ? rint(4, 6) : rint(1, 3));
  z.ap -= 2;
  const x = i % m.w, y = (i / m.w) | 0, seen = m.vis[i];
  if (seen) { await lunge(z, x, y); Sfx.play('bash'); R.shake(3); }
  noise(m, x, y, 5);
  if (m.doorHP[i] <= 0) {
    m.tiles[i] = T.DOOR_BROKEN;
    if (seen) { FX.text(x, y, 'дверь выбита', '#e8a62b'); HUD.log('Зомби выломал дверь.'); }
    computeVis(m);
  } else if (seen) await sleep(spd(80));
}
async function zombieAttack(m, z, u) {
  const t = ZT[z.type];
  if (CFG.follow) R.ensureVisible(u.x, u.y);
  await lunge(z, u.x, u.y);
  if (rnd() < t.acc) {
    const d = rint(t.dmg[0], t.dmg[1]);
    u.hp -= d;
    FX.text(u.x, u.y, '−' + d, '#ff6a50');
    Sfx.play('hurt'); vibrate(70); R.shake(5);
    let msg = `${t.name} ранит: ${u.name} −${d}`;
    if (!u.bitten && u.hp > 0 && rnd() < t.bite * (u.trait === 'tough' ? 0.5 : 1)) {
      u.bitten = true;
      FX.text(u.x, u.y - 0.6, 'УКУС', '#a4d03c');
      msg += '. Укус! Нужны медикаменты.';
      vibrate([60, 60, 120]);
    }
    HUD.log(msg, 'bad');
    if (u.hp <= 0) killUnit(m, u);
  } else FX.text(u.x, u.y, 'увернулся', '#cfc6ae');
  await sleep(spd(180));
}
function killUnit(m, u) {
  u.dead = true; u.hp = 0; u.ow = null;
  if (m.uocc) m.uocc[MI(m, u.x, u.y)] = 0;
  m.decals.push({ x: u.x, y: u.y, k: 'blood', r: rnd() });
  HUD.log(`${u.name} ${gv(u, 'погиб', 'погибла')}.`, 'bad');
  Sfx.play('death'); vibrate(250);
  for (const z of m.zombies) if (z.target === u.id) { z.state = 'investigate'; z.tx = u.x; z.ty = u.y; }
  if (TAC.sel === u.id) { const n = liveUnits(m)[0]; TAC.sel = n ? n.id : 0; }
}
function damageZombie(m, z, d, u) {
  z.hp -= d;
  FX.text(z.x, z.y, '−' + d, '#ffd27a');
  if (z.hp <= 0) { killZombie(m, z, u); return true; }
  if (z.state !== 'chase') { z.state = 'chase'; z.target = u.id; z.tx = u.x; z.ty = u.y; }
  Sfx.play('melee');
  return false;
}
function killZombie(m, z, u) {
  m.zombies = m.zombies.filter(o => o !== z);
  if (m.zocc) m.zocc[MI(m, z.x, z.y)] = 0;
  m.decals.push({ x: z.x, y: z.y, k: 'corpse', r: rnd() });
  if (u) { u.kills++; m.kills++; }
  Sfx.play('zdie');
}
async function overwatchCheck(m, z) {
  let fired = false;
  for (const u of liveUnits(m)) {
    if (!u.ow || z.hp <= 0) continue;
    if (u.ow === 'gun' && u.ammo > 0 && zVisible(m, z) && edist(u.x, u.y, z.x, z.y) <= WEAP[u.ranged].range + 0.5 && los(m, u, z)) {
      u.ow = null; fired = true;
      FX.text(u.x, u.y, 'ЗАСАДА', '#e8a62b');
      await shootAt(m, u, z, true);
    } else if (u.ow === 'melee' && adjOK(m, u.x, u.y, z.x, z.y)) {
      u.ow = null; fired = true;
      FX.text(u.x, u.y, 'ВСТРЕЧНЫЙ', '#e8a62b');
      await lunge(u, z.x, z.y);
      const w = WEAP[u.melee];
      damageZombie(m, z, rint(w.dmg[0], w.dmg[1]) + u.meleeB, u);
      noise(m, u.x, u.y, w.noise);
      await sleep(spd(120));
    }
  }
  return fired;
}
async function zombieAct(m, z) {
  const t = ZT[z.type];
  z.ap = t.ap + (timeOfDay(m) === 2 && z.type !== 'brute' ? 1 : 0);
  perceive(m, z);
  if (t.scream && z.state === 'chase' && !z.screamed) { await scream(m, z); return; }
  if (z.state === 'idle') { if (chance(0.18)) await wander(m, z); return; }
  if (z.state === 'wander') { await wander(m, z); if (chance(0.2)) z.state = 'idle'; return; }
  let path = null, key = '';
  for (let guard = 0; z.ap > 0 && z.hp > 0 && guard < 30; guard++) {
    let tx, ty;
    if (z.state === 'chase') {
      const u = m.units.find(o => o.id === z.target && !o.dead && !o.evac);
      if (!u) { z.state = 'investigate'; continue; }
      if (adjOK(m, z.x, z.y, u.x, u.y)) { await zombieAttack(m, z, u); z.ap = 0; break; }
      tx = u.x; ty = u.y;
    } else if (z.state === 'investigate') {
      if (cheb(z.x, z.y, z.tx, z.ty) <= 1) { z.state = 'idle'; break; }
      tx = z.tx; ty = z.ty;
    } else break;
    const k = tx + ',' + ty;
    if (!path || !path.length || key !== k) { path = zPath(m, z, tx, ty); key = k; }
    let next;
    if (!path || !path.length) { next = sideStep(m, z, tx, ty); if (next < 0) { if (z.state === 'investigate') z.state = 'idle'; break; } path = null; }
    else next = path[0];
    if (m.tiles[next] === T.DOOR) { await bashDoor(m, z, next); continue; }
    if (m.zocc[next] || m.uocc[next]) { next = sideStep(m, z, tx, ty); path = null; if (next < 0) break; }
    else if (path) path.shift();
    await zMove(m, z, next);
    z.ap -= TP[m.tiles[next]].cost;
    await overwatchCheck(m, z);
    if (z.hp <= 0) break;
    if (perceive(m, z)) { path = null; if (t.scream && !z.screamed) { await scream(m, z); break; } }
  }
}
async function scream(m, z) {
  z.screamed = true;
  if (zVisible(m, z)) { R.ensureVisible(z.x, z.y); FX.text(z.x, z.y, 'КРИК!', '#e08fa0'); HUD.log('Крикун поднял тревогу. Сюда идут все, кто слышал.', 'bad'); }
  Sfx.play('scream');
  noise(m, z.x, z.y, 16);
  m.tp += 3;
  await sleep(spd(380));
}
function spawnWave(m) {
  const lu = liveUnits(m);
  if (!lu.length) return;
  const n = 2 + m.threat + Math.floor(S.day / 4) + (timeOfDay(m) === 2 ? 2 : 0);
  const recent = m.lastNoise && m.turn - m.lastNoise.turn <= 4;
  const tg = recent ? m.lastNoise : (() => { const u = pick(lu); return { x: u.x, y: u.y }; })();
  let made = 0;
  for (let k = 0; k < 300 && made < n; k++) {
    const i = pick(m.edge), x = i % m.w, y = (i / m.w) | 0;
    if (m.vis[i] || m.zocc[i] || m.uocc[i]) continue;
    if (lu.some(u => edist(u.x, u.y, x, y) < 10)) continue;
    const z = addZombie(m, x, y, pickZType(S.day, m.threat), 'investigate');
    z.tx = clamp(tg.x + rint(-4, 4), 0, m.w - 1); z.ty = clamp(tg.y + rint(-4, 4), 0, m.h - 1);
    made++;
  }
  HUD.log(`Угроза ${m.threat}: с окраин подтягиваются ещё ${made}.`, 'warn');
  HUD.flash();
  Sfx.play('alarm');
}

// ----- Действия бойцов -----
function canAct() { return TAC.m && TAC.m.phase === 'player' && !TAC.busy; }
async function act(fn) {
  if (!canAct()) return;
  TAC.busy = true; TAC.pend = null; HUD.hidePop(); HUD.refresh();
  try { await fn(); } catch (e) { console.error(e); }
  TAC.busy = false;
  afterAction();
}
function afterAction() {
  const m = TAC.m;
  if (!m) return;
  if (!liveUnits(m).length) { finishMission(); return; }
  if (!curUnit()) { const n = liveUnits(m)[0]; TAC.sel = n ? n.id : 0; }
  const cu = curUnit();
  if (CFG.autoNext && cu && cu.ap <= 0 && m.phase === 'player' && !TAC.busy) {
    const n = liveUnits(m).find(o => o.ap > 0);
    if (n) { selectUnit(n); return; }
  }
  refreshReach();
  HUD.refresh();
}
function doMove(u, j) {
  return act(async () => {
    const m = TAC.m, path = pathTo(m, TAC.reach, j);
    if (!path) return;
    const seen0 = new Set(visibleZombies(m).map(z => z.id));
    for (const i of path) {
      const x = i % m.w, y = (i / m.w) | 0;
      if (unitAt(m, x, y)) break;
      const z = zombieAt(m, x, y);
      if (z) { HUD.log(`${u.name}: путь преграждает ${ZT[z.type].name.toLowerCase()}!`, 'warn'); computeVis(m); break; }
      const cost = TP[m.tiles[i]].cost;
      if (u.ap < cost) break;
      if (m.tiles[i] === T.DOOR) { m.tiles[i] = T.DOOR_OPEN; Sfx.play('door'); }
      await animTo(u, x, y, spd(STEP_MS));
      u.ap -= cost; u.ow = null;
      computeVis(m);
      const spotted = visibleZombies(m).filter(o => !seen0.has(o.id));
      if (spotted.length) {
        FX.text(u.x, u.y, '!', '#e8a62b');
        HUD.log(`${u.name} замечает: ${spotted.map(o => ZT[o.type].name.toLowerCase()).join(', ')}.`, 'warn');
        break;
      }
    }
  });
}
function doMelee(u, z) {
  return act(async () => {
    const m = TAC.m, w = WEAP[u.melee];
    if (u.ap < w.ap || !adjOK(m, u.x, u.y, z.x, z.y)) return;
    u.ap -= w.ap; u.ow = null;
    const sneak = z.state === 'idle' || z.state === 'wander';
    await lunge(u, z.x, z.y);
    if (sneak && w.assassin) {
      FX.text(z.x, z.y, 'тихо', '#ece4cc');
      Sfx.play('stab');
      HUD.log(`${u.name} бесшумно снимает: ${ZT[z.type].name.toLowerCase()}.`);
      killZombie(m, z, u);
      noise(m, u.x, u.y, 1);
    } else {
      if (rnd() < (sneak ? 1 : 0.85)) {
        let d = rint(w.dmg[0], w.dmg[1]) + u.meleeB;
        if (sneak) { d *= 2; FX.text(u.x, u.y, 'со спины', '#ece4cc'); }
        if (damageZombie(m, z, d, u)) HUD.log(`${u.name} добивает: ${ZT[z.type].name.toLowerCase()}.`);
      } else FX.text(z.x, z.y, 'мимо', '#cfc6ae');
      noise(m, u.x, u.y, w.noise);
    }
    await sleep(spd(120));
  });
}
function shotChance(m, u, z, reaction) {
  const w = WEAP[u.ranged], d = edist(u.x, u.y, z.x, z.y);
  let p = w.acc + u.accB - Math.max(0, d - w.opt) * w.fall;
  if (TP[m.tiles[MI(m, z.x, z.y)]].hide) p -= 0.15;
  if (reaction) p -= 0.1;
  return clamp(p, 0.05, 0.95);
}
function canShoot(m, u, z) {
  const w = WEAP[u.ranged];
  return !!w && u.ammo > 0 && zVisible(m, z) && edist(u.x, u.y, z.x, z.y) <= w.range + 0.5 && los(m, u, z);
}
function silenced(u) { return WEAP[u.ranged] && WEAP[u.ranged].silenceable && S.build.workshop >= 2; }
async function shootAt(m, u, z, reaction) {
  const w = WEAP[u.ranged];
  if (!reaction) u.ap -= w.ap;
  u.ammo--;
  u.f = dirIdx(z.x - u.x, z.y - u.y);
  u.aimT = performance.now() + Math.max(200, spd(560));
  R.until = Math.max(R.until, u.aimT);
  R.dirty = true;
  await sleep(spd(130));
  const p = shotChance(m, u, z, reaction), d0 = edist(u.x, u.y, z.x, z.y);
  Sfx.play(silenced(u) ? 'silenced' : w.snd);
  FX.tracer(u.x, u.y, z.x, z.y);
  R.shake(w.noise > 15 ? 3 : 1);
  noise(m, u.x, u.y, silenced(u) ? 4 : w.noise);
  await sleep(spd(140));
  if (rnd() < p) {
    let d = rint(w.dmg[0], w.dmg[1]) + u.dmgB;
    if (w.close && d0 > 3) d = Math.round(d * 0.6);
    if (rnd() < 0.1) { d = Math.round(d * 1.5); FX.text(z.x, z.y - 0.5, 'в голову', '#ffd27a'); }
    if (damageZombie(m, z, d, u)) HUD.log(`${u.name}: ${ZT[z.type].name.toLowerCase()} готов.`);
  } else FX.text(z.x, z.y, 'промах', '#cfc6ae');
  await sleep(spd(160));
}
function doShoot(u, z) {
  return act(async () => {
    const m = TAC.m;
    if (!canShoot(m, u, z) || u.ap < WEAP[u.ranged].ap) return;
    u.ow = null;
    await shootAt(m, u, z, false);
  });
}
function doLure(u, x, y) {
  return act(async () => {
    const m = TAC.m;
    if (u.lures <= 0 || u.ap < 2) return;
    u.ap -= 2; u.lures--; u.ow = null;
    FX.arc(u.x, u.y, x, y);
    Sfx.play('throw');
    await sleep(spd(380));
    noise(m, x, y, 9);
    HUD.log(`${u.name} бросает бутылку. Зомби пойдут на звон.`);
  });
}
function doDoor(u, i) {
  return act(async () => {
    const m = TAC.m, t = m.tiles[i], x = i % m.w, y = (i / m.w) | 0;
    if (u.ap < 1 || cheb(u.x, u.y, x, y) !== 1) return;
    if (t === T.DOOR) m.tiles[i] = T.DOOR_OPEN;
    else if (t === T.DOOR_OPEN) { if (unitAt(m, x, y) || zombieAt(m, x, y)) return; m.tiles[i] = T.DOOR; }
    else return;
    u.ap -= 1;
    Sfx.play('door');
    computeVis(m);
  });
}
function doBandage(u, target) {
  return act(async () => {
    if (u.bandages <= 0 || u.ap < 2 || target.hp >= target.maxhp) return;
    const heal = 4 + (u.trait === 'medic' ? 3 : 0);
    const before = target.hp;
    target.hp = Math.min(target.maxhp, target.hp + heal);
    u.bandages--; u.ap -= 2; u.ow = null;
    FX.text(target.x, target.y, '+' + (target.hp - before), '#86c25d');
    Sfx.play('heal');
    await sleep(spd(200));
  });
}
function doOverwatch(u) {
  return act(async () => {
    if (u.ranged && u.ammo > 0 && u.ap >= WEAP[u.ranged].ap) u.ow = 'gun';
    else if (u.ap >= WEAP[u.melee].ap) u.ow = 'melee';
    else return;
    u.ap = 0;
    FX.text(u.x, u.y, 'засада', '#e8a62b');
    Sfx.play('click');
  });
}
function doEvac(u) {
  return act(async () => {
    const m = TAC.m;
    if (!inEvac(m, u) || u.ap < 1) return;
    u.evac = true; u.ow = null;
    Sfx.play('evac');
    HUD.log(`${u.name} в машине.`);
    if (!liveUnits(m).length) { finishMission(); return; }
    TAC.sel = liveUnits(m)[0].id;
    R.centerOn(liveUnits(m)[0].x, liveUnits(m)[0].y);
  });
}
function doSearch(u, i) {
  const m = TAC.m, c = m.cont[i], x = i % m.w, y = (i / m.w) | 0;
  if (!c || !canAct() || cheb(u.x, u.y, x, y) > 1) return;
  if (!c.s) {
    if (u.ap < 2) { HUD.log('Не хватает ОД: обыск стоит 2.', 'warn'); return; }
    u.ap -= 2; u.ow = null; c.s = 1;
    if (u.trait === 'mechanic' && chance(0.6)) c.loot.parts = (c.loot.parts || 0) + 1;
    Sfx.play('search');
    noise(m, x, y, 1);
    refreshReach();
  }
  HUD.openLoot(u, i);
}
function takeLoot(u, c, k, want) {
  if (k === 'ammo' && u.ranged) { const a = c.loot[k]; u.ammo += a; delete c.loot[k]; return a; }
  const free = u.cap - carried(u);
  const can = Math.min(want, c.loot[k], Math.floor((free + 1e-6) / RES[k].w));
  if (can <= 0) return 0;
  u.inv[k] = (u.inv[k] || 0) + can;
  c.loot[k] -= can;
  if (c.loot[k] <= 0) delete c.loot[k];
  return can;
}

// ----- Ход -----
async function endTurn() {
  if (!canAct()) return;
  const m = TAC.m;
  m.phase = 'enemy'; TAC.busy = true; TAC.pend = null; TAC.mode = null; TAC.reach = null;
  HUD.hidePop(); HUD.banner('Ход зомби'); HUD.refresh();
  buildOcc(m);
  const near = z => Math.min(...liveUnits(m).map(u => edist(u.x, u.y, z.x, z.y)));
  const order = m.zombies.slice().sort((a, b) => near(a) - near(b));
  try {
    for (const z of order) {
      if (z.hp <= 0 || !m.zombies.includes(z)) continue;
      await zombieAct(m, z);
      if (!liveUnits(m).length) break;
    }
  } catch (e) { console.error(e); }
  if (!liveUnits(m).length) { TAC.busy = false; HUD.banner(null); finishMission(); return; }
  const tod0 = timeOfDay(m);
  m.turn++;
  const tod = timeOfDay(m);
  if (tod !== tod0) HUD.log(tod === 1 ? 'Смеркается: обзор сократился.' : 'Наступила ночь. Зомби быстрее, вы видите хуже.', 'warn');
  if (m.turn - m.lastWave >= WAVE_EVERY || m.tp >= 10) { m.threat++; m.tp = 0; m.lastWave = m.turn; spawnWave(m); }
  for (const u of liveUnits(m)) { u.ap = u.maxap - (carried(u) > u.cap ? 2 : 0); u.ow = null; }
  m.phase = 'player'; TAC.busy = false;
  HUD.banner(null);
  computeVis(m);
  const u = curUnit() || liveUnits(m)[0];
  TAC.sel = u.id;
  afterAction();
  saveGame();
}
function nextUnit() {
  const m = TAC.m;
  if (!m) return;
  const lu = liveUnits(m);
  if (!lu.length) return;
  const k = lu.findIndex(u => u.id === TAC.sel);
  const order = lu.slice(k + 1).concat(lu.slice(0, k + 1));
  const n = order.find(u => u.ap > 0) || order[0];
  selectUnit(n);
}
function selectUnit(u) {
  TAC.sel = u.id; TAC.pend = null; TAC.mode = null;
  HUD.hidePop();
  refreshReach();
  R.centerOn(u.x, u.y);
  HUD.refresh();
}

// ----- Вылазка -----
function makeUnit(m, s, p) {
  const lvl = s.level || 1;
  const u = {
    id: m.uid++, sid: s.id, name: s.name, g: s.g, color: s.color, x: p.x, y: p.y,
    hp: s.hp, maxhp: s.maxhp, maxap: 10 + (s.trait === 'quick' ? 2 : 0), ap: 0,
    melee: s.melee, ranged: s.ranged, ammo: 0,
    lures: 1 + (S.build.workshop >= 1 ? 1 : 0), bandages: s.trait === 'medic' ? 3 : 1,
    inv: {}, cap: 10 + (s.trait === 'strong' ? 5 : 0), trait: s.trait,
    accB: (s.trait === 'marksman' ? 0.15 : 0) + 0.03 * (lvl - 1),
    meleeB: (s.trait === 'strong' ? 1 : 0) + (S.build.workshop >= 3 ? 1 : 0),
    dmgB: S.build.workshop >= 3 ? 1 : 0,
    ow: null, bitten: false, evac: false, dead: false, kills: 0,
  };
  u.ap = u.maxap;
  return u;
}
function startMission(loc, ids) {
  const L = LOCS[loc];
  const { m, reach } = genMap(loc, (Math.random() * 2 ** 31) | 0);
  Object.assign(m, { loc, turn: 1, threat: 0, tp: 0, lastWave: 1, lastNoise: null, phase: 'player', units: [], zombies: [], uid: 1, zid: 1, kills: 0 });
  m.seen = new Uint8Array(m.n); m.vis = new Uint8Array(m.n);
  S.res.fuel -= L.fuel;
  const squad = ids.map(id => S.survivors.find(s => s.id === id)).filter(Boolean);
  const spots = m.evac.slice().sort((a, b) => edist(a % m.w, (a / m.w) | 0, m.start.x, m.start.y) - edist(b % m.w, (b / m.w) | 0, m.start.x, m.start.y));
  const gunners = squad.filter(s => s.ranged).length;
  const per = gunners ? Math.min(14, Math.floor(S.res.ammo / gunners)) : 0;
  squad.forEach((s, k) => {
    const i = spots[k + 2] ?? spots[k];
    const u = makeUnit(m, s, { x: i % m.w, y: (i / m.w) | 0 });
    u.f = k % 2 ? 7 : 5;
    if (s.ranged) { u.ammo = per; S.res.ammo -= per; }
    s.away = true;
    m.units.push(u);
  });
  // зомби
  const count = L.zombies + Math.min(18, Math.floor((S.day - 1) * 1.2));
  const open = [];
  for (let i = 0; i < m.n; i++) if (reach[i] && TP[m.tiles[i]].walk && m.tiles[i] !== T.DOOR) open.push(i);
  for (let k = 0, placed = 0; k < 6000 && placed < count; k++) {
    const i = chance(0.5) && m.indoor.length ? pick(m.indoor) : pick(open);
    const x = i % m.w, y = (i / m.w) | 0;
    if (edist(x, y, m.start.x, m.start.y) < 16 || zombieAt(m, x, y)) continue;
    addZombie(m, x, y, pickZType(S.day, 0), chance(0.3) ? 'wander' : 'idle');
    placed++;
    // иногда — стая
    if (chance(0.25)) for (let g = 0; g < rint(1, 2); g++) {
      const nx = x + rint(-2, 2), ny = y + rint(-2, 2);
      if (walkT(m, nx, ny) && !zombieAt(m, nx, ny) && reach[MI(m, nx, ny)]) { addZombie(m, nx, ny, pickZType(S.day, 0), 'idle'); placed++; }
    }
  }
  S.mission = m;
  TAC.m = m; TAC.sel = m.units[0].id; TAC.pend = null; TAC.mode = null; TAC.busy = false;
  HUD.clearLog();
  computeVis(m);
  saveGame();
  Game.showTac(true);
  HUD.log(`${L.name}. Ищите добычу и возвращайтесь к машине. Шум привлекает зомби.`);
}
function resumeMission(m) {
  TAC.m = m; TAC.pend = null; TAC.mode = null; TAC.busy = false;
  m.phase = 'player';
  const u = liveUnits(m)[0];
  if (!u) { finishMission(); return; }
  if (!curUnit()) TAC.sel = u.id;
  computeVis(m);
  Game.showTac(true);
}
// Бросить вылазку: кто в зоне эвакуации — уезжает, остальные пропадают
function abandonMission() {
  const m = TAC.m;
  if (!m) return;
  for (const u of liveUnits(m)) { if (inEvac(m, u)) u.evac = true; else { u.lost = true; u.dead = true; } }
  finishMission();
}
function finishMission() {
  const m = TAC.m;
  if (!m || m.done) return;
  m.done = true;
  const rep = { loc: m.loc, got: {}, lines: [], kills: m.kills, turns: m.turn };
  for (const u of m.units) {
    const s = S.survivors.find(o => o.id === u.sid);
    if (!s) continue;
    s.away = false;
    if (u.dead) {
      S.survivors = S.survivors.filter(o => o !== s);
      rep.lines.push({ t: u.lost ? `${u.name} ${gv(u, 'остался', 'осталась')} на вылазке. Больше ${gv(u, 'его', 'её')} не видели.` : `${u.name} ${gv(u, 'погиб', 'погибла')}.`, c: 'bad' });
      continue;
    }
    s.hp = Math.max(1, u.hp);
    s.kills = (s.kills || 0) + u.kills;
    const lvl = Math.min(5, 1 + Math.floor(s.kills / 5));
    if (lvl > (s.level || 1)) { s.level = lvl; s.maxhp += 2; s.hp += 2; rep.lines.push({ t: `${u.name}: опыт растёт, уровень ${lvl}.`, c: 'good' }); }
    if (u.bitten && !s.infected) { s.infected = 3; rep.lines.push({ t: `${u.name} ${gv(u, 'укушен', 'укушена')}. До обращения 3 дня.`, c: 'bad' }); }
    for (const k in u.inv) rep.got[k] = (rep.got[k] || 0) + u.inv[k];
    if (u.ammo) rep.got.ammo = (rep.got.ammo || 0) + u.ammo;
  }
  for (const k in rep.got) S.res[k] = (S.res[k] || 0) + rep.got[k];
  S.mission = null;
  TAC.m = null; TAC.reach = null;
  Game.afterMission(rep);
}
