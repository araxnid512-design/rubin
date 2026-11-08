'use strict';
// ---------- Люди из группировок: ИИ, засады, пленные, восставшие мёртвые ----------
// Враги-люди живут в том же списке m.zombies (так их видно, можно бить и стрелять),
// но ходят по своему ИИ: стреляют из-за укрытий, отступают раненными, дерутся с мёртвыми.

const isFlock = z => ZT[z.type] && ZT[z.type].fac === 'flock';
const hostilesOf = m => m.zombies.filter(z => isHuman(z) && z.hp > 0);

function addHostile(m, x, y, type, state = 'guard') {
  const z = addZombie(m, x, y, type, state);
  z.ammo = ZT[type].ammo || 0;
  m.hseen = m.hseen || {}; m.hseen[ZT[type].fac] = 1;
  z.home = MI(m, x, y);
  return z;
}

// Расставить отряд группировки по постам карты
function spawnHostiles(m, L, reach, n, fac) {
  const F = FACTIONS[fac];
  const free = i => reach[i] && TP[m.tiles[i]].walk && m.tiles[i] !== T.DOOR && !zombieAt(m, i % m.w, (i / m.w) | 0) && edist(i % m.w, (i / m.w) | 0, m.start.x, m.start.y) >= 13;
  let spots = (m.guard || []).filter(free);
  if (spots.length < n) for (const i of m.indoor) if (free(i)) spots.push(i);
  if (spots.length < n) for (let i = 0; i < m.n; i++) if (free(i) && chance(0.05)) spots.push(i);
  spots = shuffle(spots.slice());
  const made = [];
  for (const i of spots) {
    if (made.length >= n) break;
    const x = i % m.w, y = (i / m.w) | 0;
    if (zombieAt(m, x, y) || made.some(o => cheb(o.x, o.y, x, y) < 2)) continue;
    made.push(addHostile(m, x, y, pick(F.types), 'guard'));
  }
  return made;
}

// Засада Вольницы: выходят с края карты, где их не видно
function spawnAmbush(m) {
  const a = m.ambush, lu = liveUnits(m);
  if (!a || !lu.length) return;
  m.ambush = null;
  const F = FACTIONS[a.fac], tg = pick(lu);
  let made = 0;
  for (let k = 0; k < 400 && made < a.n; k++) {
    const i = pick(m.edge), x = i % m.w, y = (i / m.w) | 0;
    if (m.vis[i] || m.zocc[i] || m.uocc[i]) continue;
    if (lu.some(u => edist(u.x, u.y, x, y) < 11)) continue;
    const h = addHostile(m, x, y, pick(F.types), 'investigate');
    h.tx = tg.x; h.ty = tg.y;
    made++;
  }
  if (made) { HUD.log(`${F.name}: на вас вышли ${made} ${made > 4 ? 'человек' : 'человека'}. Засада!`, 'bad'); HUD.flash(); Sfx.play('alarm'); }
}

// ----- укрытие -----
// Клетка рядом с целью со стороны стрелка, которая закрывает её по пояс
function coverOf(m, sx, sy, t) {
  const dx = Math.sign(sx - t.x), dy = Math.sign(sy - t.y);
  const cells = dx && dy ? [[dx, dy], [dx, 0], [0, dy]] : [[dx, dy]];
  for (const [ax, ay] of cells) {
    const x = t.x + ax, y = t.y + ay;
    if (!inb(m, x, y)) continue;
    const tt = m.tiles[MI(m, x, y)], tp = TP[tt];
    if (tt === T.SANDBAG || tt === T.BLOCK || tt === T.BLOCKH || tt === T.WALL || tt === T.BRICK || tt === T.WWALL || tp.furn) return tt === T.SANDBAG || tp.wall ? 0.35 : 0.25;
    if (tt === T.FENCE && m.meta[MI(m, x, y)] !== 1) return 0.15;
  }
  return 0;
}

// ----- восприятие -----
function perceiveH(m, h) {
  const t = ZT[h.type], tod = timeOfDay(m);
  let best = null, bs = 1e9;
  for (const u of liveUnits(m)) {
    const d = edist(h.x, h.y, u.x, u.y);
    let sr = t.sight - tod;
    if (u.trait === 'quiet') sr -= 2;
    if (TP[m.tiles[MI(m, u.x, u.y)]].hide) sr = Math.min(sr, 3.5);
    if ((d <= 1.5 || (d <= sr && los(m, h, u))) && d < bs) { bs = d; best = u; }
  }
  if (!isFlock(h)) for (const z of m.zombies) {
    if (isHuman(z) || z.hp <= 0) continue;
    const d = edist(h.x, h.y, z.x, z.y);
    if (d > 7 || d + 2.5 >= bs) continue;
    if (d <= 1.5 || los(m, h, z)) { bs = d + 2.5; best = z; }
  }
  if (best) {
    const was = h.state;
    h.state = 'chase'; h.tx = best.x; h.ty = best.y;
    if (best.type) { h.tz = best.id; h.target = 0; } else { h.target = best.id; h.tz = 0; }
    if (was !== 'chase' && !best.type && m.vis[MI(m, h.x, h.y)]) {
      FX.text(h.x, h.y, '!', ZT[h.type].body);
      HUD.log(`${ZT[h.type].name} замечает ${best.name}.`, 'warn');
    }
    return best;
  }
  if (h.state === 'chase') h.state = 'investigate';
  return null;
}

// ----- урон людям-бойцам игрока -----
function hurtUnit(m, u, d, src, how) {
  u.hp -= d;
  u.hitT = performance.now(); R.until = Math.max(R.until, u.hitT + 280);
  FX.blood(u.x, u.y);
  FX.text(u.x, u.y, '−' + d, '#ff6a50');
  knock(u, src.x, src.y, 0.16);
  Sfx.play('hurt', { x: u.x, y: u.y }); vibrate(70); R.shake(4);
  HUD.log(`${ZT[src.type].name} ${how}: ${u.name} −${d}`, 'bad');
  if (u.hp <= 0) killUnit(m, u);
}

async function hShoot(m, h, tg, w) {
  h.ammo--; h.ap -= w.ap; h.shots = (h.shots || 0) + 1;
  h.f = dirIdx(tg.x - h.x, tg.y - h.y);
  const show = m.vis[MI(m, h.x, h.y)] || m.vis[MI(m, tg.x, tg.y)];
  if (show && CFG.follow) R.ensureVisible(h.x, h.y);
  h.aimT = performance.now() + Math.max(200, spd(560));
  R.until = Math.max(R.until, h.aimT); R.dirty = true;
  await sleep(show ? spd(220) : 0);
  FX.flash(h.x, h.y, h.f);
  Sfx.play(w.snd, { x: h.x, y: h.y, fall: 40 });
  knock(h, tg.x, tg.y, 0.05, 140);
  FX.tracer(h.x, h.y, tg.x, tg.y);
  if (show) R.shake(w.noise > 15 ? 3 : 1);
  noise(m, h.x, h.y, w.noise);
  await sleep(show ? spd(140) : 0);
  const t = ZT[h.type], d0 = edist(h.x, h.y, tg.x, tg.y);
  let p = t.acc - Math.max(0, d0 - w.opt) * w.fall - coverOf(m, h.x, h.y, tg);
  if (TP[m.tiles[MI(m, tg.x, tg.y)]].hide) p -= 0.15;
  if (rnd() < clamp(p, 0.08, 0.9)) {
    let d = Math.max(1, Math.round(rint(w.dmg[0], w.dmg[1]) * 0.7));
    if (w.close && d0 > 3) d = Math.max(1, Math.round(d * 0.6));
    if (tg.type) damageZombie(m, tg, d, h, rnd() < 0.15);
    else hurtUnit(m, tg, d, h, 'стреляет');
  } else if (show) FX.text(tg.x, tg.y, 'мимо', '#cfc6ae');
  await sleep(show ? spd(200) : 0);
}

async function hMelee(m, h, tg) {
  const t = ZT[h.type], w = WEAP[t.melee || 'knife'];
  h.ap -= w.ap;
  const show = m.vis[MI(m, h.x, h.y)] || m.vis[MI(m, tg.x, tg.y)];
  if (show && CFG.follow) R.ensureVisible(h.x, h.y);
  if (show) { Sfx.play('whoosh', { x: h.x, y: h.y }); await swing(h, tg.x, tg.y, 520); }
  if (rnd() < t.acc + 0.1) {
    const d = rint(t.dmg[0], t.dmg[1]);
    Sfx.play(MELEE_SND[t.melee] || 'hit_bat', { x: tg.x, y: tg.y });
    if (tg.type) damageZombie(m, tg, d, h, true);
    else hurtUnit(m, tg, d, h, 'бьёт');
  } else if (show) FX.text(tg.x, tg.y, 'увернулся', '#cfc6ae');
  noise(m, h.x, h.y, w.noise);
  await sleep(show ? spd(220) : 0);
}

// Отойти от угрозы: клетка, где дальше всего от неё и есть укрытие
async function hRetreat(m, h, tg) {
  for (let s = 0; s < 4 && h.ap > 0; s++) {
    let best = -1, bs = -1e9;
    for (const [dx, dy] of DIR8) {
      const nx = h.x + dx, ny = h.y + dy;
      if (!walkT(m, nx, ny) || !adjOK(m, h.x, h.y, nx, ny)) continue;
      const j = MI(m, nx, ny);
      if (m.zocc[j] || m.uocc[j]) continue;
      const sc = edist(nx, ny, tg.x, tg.y) + coverOf(m, tg.x, tg.y, { x: nx, y: ny }) * 4;
      if (sc > bs) { bs = sc; best = j; }
    }
    if (best < 0 || bs <= edist(h.x, h.y, tg.x, tg.y)) break;
    await zMove(m, h, best);
    h.ap -= TP[m.tiles[best]].cost;
    await overwatchCheck(m, h);
    if (h.hp <= 0) return;
  }
}

function targetOf(m, h) {
  if (h.state !== 'chase') return null;
  if (h.tz) return m.zombies.find(o => o.id === h.tz && o.hp > 0) || null;
  return m.units.find(o => o.id === h.target && !o.dead && !o.evac) || null;
}

async function humanAct(m, h) {
  const t = ZT[h.type];
  h.ap = t.ap; h.shots = 0;
  const w = t.ranged ? WEAP[t.ranged] : null;
  let path = null, key = '';
  for (let g = 0; g < 16 && h.ap > 0 && h.hp > 0; g++) {
    perceiveH(m, h);
    const tg = targetOf(m, h);
    if (!tg) {
      if (h.state === 'investigate') {
        if (cheb(h.x, h.y, h.tx, h.ty) <= 1) { h.state = 'guard'; h.home = MI(m, h.x, h.y); break; }
        const k = h.tx + ',' + h.ty;
        if (!path || !path.length || key !== k) { path = zPath(m, h, h.tx, h.ty); key = k; }
        if (!path || !path.length) { h.state = 'guard'; break; }
        if (!(await hStep(m, h, path.shift()))) break;
        continue;
      }
      if (h.state === 'guard' && chance(0.2)) {
        const hx = h.home % m.w, hy = (h.home / m.w) | 0, opts = [];
        for (const [dx, dy] of DIR4) { const nx = h.x + dx, ny = h.y + dy; if (walkT(m, nx, ny) && cheb(nx, ny, hx, hy) <= 3 && !m.zocc[MI(m, nx, ny)] && !m.uocc[MI(m, nx, ny)]) opts.push(MI(m, nx, ny)); }
        if (opts.length) await hStep(m, h, pick(opts));
      }
      break;
    }
    path = null;
    const d = edist(h.x, h.y, tg.x, tg.y);
    if (h.hp <= t.hp * 0.3 && !h.fled && d <= 5 && !tg.type) { h.fled = true; if (m.vis[MI(m, h.x, h.y)]) FX.text(h.x, h.y, 'отходит', '#cfc6ae'); await hRetreat(m, h, tg); continue; }
    const adj = adjOK(m, h.x, h.y, tg.x, tg.y);
    if (w && h.ammo > 0 && !h.shots && h.ap >= w.ap && d <= w.range + 0.5 && los(m, h, tg) && !(adj && t.melee && !w.close)) { await hShoot(m, h, tg, w); continue; }
    if (adj) { if (h.ap >= WEAP[t.melee || 'knife'].ap) { await hMelee(m, h, tg); continue; } break; }
    // стрелок, уже стрелявший, не лезет врукопашную, а ищет укрытие
    if (w && h.shots) { if (!coverOf(m, tg.x, tg.y, h)) await hRetreat(m, h, tg); break; }
    const pth = zPath(m, h, tg.x, tg.y);
    if (!pth || !pth.length) { const s = sideStep(m, h, tg.x, tg.y); if (s < 0 || !(await hStep(m, h, s))) break; continue; }
    if (!(await hStep(m, h, pth[0]))) break;
  }
}
// Шаг человека: двери открывает, а не ломает
async function hStep(m, h, j) {
  if (j == null || j < 0) return false;
  if (m.tiles[j] === T.DOOR) {
    if (h.ap < 1) return false;
    m.tiles[j] = T.DOOR_OPEN; h.ap -= 1;
    const x = j % m.w, y = (j / m.w) | 0;
    Sfx.play('door', { x, y, vol: m.vis[j] ? 1 : 0.5 });
    if (m.vis[j]) computeVis(m);
    return true;
  }
  if (m.zocc[j] || m.uocc[j]) return false;
  const cost = TP[m.tiles[j]].cost;
  if (h.ap < cost) return false;
  await zMove(m, h, j);
  h.ap -= cost;
  await overwatchCheck(m, h);
  return h.hp > 0;
}

// ----- мёртвые встают -----
function riseCorpses(m) {
  for (const d of m.decals) {
    if (!d.rise || m.turn < d.rise) continue;
    const i = MI(m, d.x, d.y);
    if (m.zocc[i] || m.uocc[i]) continue;
    d.rise = 0; d.gone = true;
    const z = addZombie(m, d.x, d.y, 'walker', 'investigate');
    z.rf = d.k === 'ucorpse' ? { c: d.u.color, g: d.u.g, n: d.u.name } : { t: d.zt };
    z.f = d.f;
    const lu = liveUnits(m);
    if (lu.length) { const u = pick(lu); z.tx = u.x; z.ty = u.y; }
    if (m.vis[i]) {
      FX.text(d.x, d.y, 'ВСТАЁТ', '#a4d03c');
      HUD.log(d.k === 'ucorpse' ? `${d.u.name} поднимается. Это уже не ${gv(d.u, 'он', 'она')}.` : `Убитый ${ZT[d.zt].name.toLowerCase()} поднимается мертвецом.`, 'bad');
      Sfx.play('groan', { x: d.x, y: d.y });
      R.ensureVisible(d.x, d.y);
    }
  }
  m.decals = m.decals.filter(d => !d.gone);
}
function doFinish(u, d) {
  return act(async () => {
    const m = TAC.m;
    if (u.ap < 1 || cheb(u.x, u.y, d.x, d.y) > 1 || !d.rise) return;
    u.ap -= 1;
    Sfx.play('whoosh', { x: u.x, y: u.y, dur: 0.12 });
    await swing(u, d.x, d.y);
    Sfx.play('stab', { x: d.x, y: d.y });
    FX.blood(d.x, d.y, 6);
    d.rise = 0;
    FX.text(d.x, d.y, 'добит', '#ece4cc');
    noise(m, u.x, u.y, 1);
    await sleep(spd(200));
  });
}

// ----- пленные -----
function captiveAt(m, x, y) { return (m.captives || []).find(c => !c.freed && c.x === x && c.y === y); }
function doFree(u, c) {
  return act(async () => {
    const m = TAC.m;
    if (u.ap < 2 || cheb(u.x, u.y, c.x, c.y) > 1 || c.freed) return;
    u.ap -= 2;
    c.freed = true;
    const i = MI(m, c.x, c.y);
    m.tiles[i] = m.ground[i];
    const used = new Set(S.survivors.map(s => s.name));
    let name = c.name;
    if (used.has(name)) { const pool = NAMES.filter(n => !used.has(n[0]) && n[1] === c.g); if (pool.length) name = pick(pool)[0]; }
    const hp = rint(11, 14);
    const s = { id: S.nid++, name, g: c.g, trait: pick(Object.keys(TRAITS)), melee: 'knife', ranged: null, hp: Math.ceil(hp * 0.6), maxhp: hp, color: c.color, kills: 0, level: 1, infected: 0, away: true, freed: true };
    S.survivors.push(s);
    const nu = makeUnit(m, s, { x: c.x, y: c.y });
    nu.f = dirIdx(u.x - c.x, u.y - c.y); nu.ap = 0; nu.lures = 0;
    m.units.push(nu);
    Sfx.play('pickup', { x: c.x, y: c.y });
    FX.text(c.x, c.y, 'свобод' + (c.g === 'f' ? 'на' : 'ен'), '#86c25d');
    HUD.log(`${u.name} освобождает пленного: ${name}. Довезите ${gv(s, 'его', 'её')} до машины — и в группе прибавится.`, 'good');
    Spr.warm(Spr.look(nu, 'h'), WARM_FRAMES);
    computeVis(m);
    await sleep(spd(240));
  });
}

// ----- тела врагов: что было при себе -----
function dropBody(m, z) {
  const t = ZT[z.type], i = MI(m, z.x, z.y);
  const loot = {};
  if (t.ranged && z.ammo > 0) loot.ammo = z.ammo;
  if (chance(0.35)) loot.food = rint(1, 2);
  if (chance(0.3)) loot.water = 1;
  if (chance(0.22)) loot.meds = 1;
  if (t.fac === 'garrison' && chance(0.5)) loot.ammo = (loot.ammo || 0) + rint(3, 8);
  if (!Object.keys(loot).length) return;
  const ct = m.cont[i];
  if (ct) { for (const k in loot) ct.loot[k] = (ct.loot[k] || 0) + loot[k]; ct.s = 1; }
  else m.cont[i] = { k: 'body', loot, s: 1 };
}

// ----- перед вылазкой: кто будет на карте -----
function setupHostiles(m, L, reach) {
  const day = S.day;
  if (L.faction && L.hostiles) {
    const st = S.fac && S.fac[L.faction];
    let n = L.hostiles + Math.floor(day / 7);
    if (st && st.beaten) n = Math.max(1, Math.round(n * 0.4));
    spawnHostiles(m, L, reach, n, L.faction);
  }
  // Засады Вольницы на дорогах — со 4-го дня
  if (!L.faction && day >= 4 && chance(0.12 + Math.min(0.13, day * 0.006))) {
    m.ambush = { turn: rint(4, 9), n: rint(2, 3) + Math.floor(day / 10), fac: 'raiders' };
  }
  // Паства иногда гонит толпу через чужую вылазку
  if (!L.faction && day >= 6 && chance(0.08)) m.herd = { turn: rint(6, 11) };
}
function spawnHerd(m) {
  const lu = liveUnits(m);
  m.herd = null;
  if (!lu.length) return;
  const i0 = pick(m.edge.filter(i => !m.vis[i] && lu.every(u => edist(u.x, u.y, i % m.w, (i / m.w) | 0) > 14)));
  if (i0 == null) return;
  const x0 = i0 % m.w, y0 = (i0 / m.w) | 0, tg = pick(lu);
  const lead = addHostile(m, x0, y0, 'cultist', 'investigate');
  lead.tx = tg.x; lead.ty = tg.y;
  let made = 0;
  for (let k = 0; k < 200 && made < 8 + Math.floor(S.day / 3); k++) {
    const x = clamp(x0 + rint(-4, 4), 0, m.w - 1), y = clamp(y0 + rint(-4, 4), 0, m.h - 1), j = MI(m, x, y);
    if (!walkT(m, x, y) || m.zocc[j] || m.uocc[j]) continue;
    const z = addZombie(m, x, y, pickZType(S.day, m.threat), 'investigate');
    z.tx = clamp(tg.x + rint(-3, 3), 0, m.w - 1); z.ty = clamp(tg.y + rint(-3, 3), 0, m.h - 1);
    made++;
  }
  HUD.log('Вдалеке слышен колокольчик и шарканье сотен ног: Паства гонит толпу в вашу сторону.', 'bad');
  HUD.flash(); Sfx.play('alarm');
}
