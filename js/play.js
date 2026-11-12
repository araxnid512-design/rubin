'use strict';
// ===== Игровая логика: бой, скрытность, добыча, выживание, ИИ =====

function enterLoc(id) {
  loc = genLoc(id); mkPlayer(loc.spawn[0], loc.spawn[1]); pfield = null; flash = 1;
  mkFogSprite(loc.def.fog);
  toast(`${loc.name} · токсичность ×${loc.def.tox}`, loc.def.tox > 1.4 ? 'bad' : '');
  if (darkness() > .6) toast('Ночь: заражённые активнее, выходят ночные охотники', 'bad');
  hud();
}
function enterBunker() {
  loc = genBunker(); mkPlayer(loc.spawn[0], loc.spawn[1]); pfield = null; flash = 1;
  save(); hud();
}
function advanceClock(h) {
  G.clock += h;
  const prod = (k, id, rate) => { if (!modLv(k)) return; G.acc[k] += h * rate * modLv(k); const n = Math.floor(G.acc[k]); if (n > 0) { G.acc[k] -= n; add(G.storage, id, n); } };
  prod('water', 'dwater', .3); prod('garden', 'berries', .35);
  while (G.clock >= 24) {
    G.clock -= 24; G.day++;
    if (modLv('radio')) { newContracts(); toast(`День ${G.day}. По рации пришли новые задания`, 'gold'); } else toast(`День ${G.day}`);
  }
}

// ---------- бой ----------
function weapon() {
  const s = G.p.eq.weapon; if (!s) return FISTS;
  const w = ITEMS[s.id].w;
  if (w.ranged && count(G.p.inv, w.ammo) < 1) return {dmg: 6, cd: .5, rg: .95, empty: 1};
  return w;
}
function wear(slot, isEq) {
  if (!slot || slot.d == null || R() < .2 * pk('smith')) return;
  if (--slot.d <= 0) {
    toast(`${ITEMS[slot.id].n}: сломано!`, 'bad'); sfx(120, .2, 'sawtooth', .05, -60);
    if (isEq) G.p.eq.weapon = null; else { const i = G.p.inv.indexOf(slot); if (i >= 0) G.p.inv[i] = null; }
  }
}
function findTool(type) {
  const w = G.p.eq.weapon; let best = w && ITEMS[w.id].tool === type ? [w, true] : null;
  for (const s of G.p.inv) if (s && ITEMS[s.id].tool === type && (!best || ITEMS[s.id].pw > ITEMS[best[0].id].pw)) best = [s, false];
  return best;
}
function face(o) {
  const dx = o.x - P.x, dy = o.y - P.y, l = Math.hypot(dx, dy) || 1, s = dx - dy;
  P.dx = dx / l; P.dy = dy / l; if (Math.abs(s) > .01) P.fx = s > 0 ? 1 : -1;
}
function nearestEnemy(maxd) { let b = null, bd = maxd; for (const e of loc.en) { const d = dist(e, P); if (d < bd) { bd = d; b = e; } } return b; }
function inRange(e) { const w = weapon(); return dist(e, P) <= w.rg + e.r * .6 && (!w.ranged || lineClear(P.x, P.y, e.x, e.y, true)); }
function addNoise(n) {
  if (loc.bunker || n <= 0) return;
  loc.noise = Math.min(100, loc.noise + n);
  for (const o of loc.en) if (!o.aggro && dist(o, P) < 4 + n / 4) aggro(o, true);
}
function aggro(e, quiet) {
  if (e.aggro) return;
  e.aggro = true; e.alert = 1; e.lost = 0; e.bang = .9;
  if (!quiet && R() < .6) sfx(110 + R() * 40, .25, 'sawtooth', .03, -40);
  if (e.def.scream && !e.screamed) {
    e.screamed = true; sfx(900, .5, 'sawtooth', .05, 500);
    loc.fx.push({k: 'ring', x: e.x, y: e.y, t: 0, T: .7, c: '255,255,255'});
    toast('Крикун поднял тревогу!', 'bad'); addNoise(45);
  }
  for (const o of loc.en) if (!o.aggro && dist(o, e) < 3.5) { o.aggro = true; o.alert = 1; }
}
function attack(e) {
  const w = weapon(), stealth = !e.aggro;
  P.cd = w.cd; P.atk = .22; face(e); P.gather = null;
  let dmg = w.dmg * rnd(.88, 1.12);
  if (w.ranged) {
    dmg *= 1 + .15 * pk('marks');
    remove(G.p.inv, w.ammo, 1);
    loc.fx.push({k: 'tracer', x: P.x, y: P.y, x2: e.x, y2: e.y, t: 0, T: w.noise ? .08 : .14, arrow: !w.noise});
    if (w.noise) { sfx(w.splash ? 90 : 160, .18, 'sawtooth', .09, -60); shake = Math.max(shake, w.splash ? 5 : 2.5); loc.fx.push({k: 'flash', x: P.x, y: P.y, t: 0, T: .07}); addNoise(w.noise); }
    else sfx(700, .1, 'triangle', .04, -400);
  } else {
    dmg *= 1 + .15 * pk('brute');
    sfx(220, .06, 'triangle', .05, -100);
    if (w.empty && !P.warnAmmo) { P.warnAmmo = 1; toast('Нет боеприпасов — бьёте прикладом', 'bad'); }
  }
  if (stealth) { dmg *= 3 + .5 * pk('ghost'); floatText(e.x, e.y, 56 * e.def.sz, 'ИЗ ТЕНИ!', '#b0a0ff', 1); sfx(880, .12, 'sine', .05, 300); }
  if (!w.ranged || w.splash) { // удар задевает соседних врагов
    for (const o of loc.en.slice()) {
      if (o === e) continue;
      const near = w.splash ? dist(o, e) < 1.6 : dist(o, P) <= w.rg + o.r && (o.x - P.x) * P.dx + (o.y - P.y) * P.dy > .3 * dist(o, P);
      if (near) hitEnemy(o, dmg * .55);
    }
  }
  if (!w.ranged) { const d = dist(e, P) || 1; move(e, (e.x - P.x) / d * .25, (e.y - P.y) / d * .25); }
  hitEnemy(e, dmg, stealth);
  if (!w.empty) wear(G.p.eq.weapon, true);
}
function hitEnemy(e, d, crit) {
  if (e.dead) return;
  e.hp -= d; e.hit = .15; e.stun = .16; aggro(e, true);
  floatText(e.x, e.y, 40 * e.def.sz, '' + Math.round(d), crit ? '#c0b0ff' : '#ffd070', crit);
  burst(e.x, e.y, 20 * e.def.sz, '#6a9030', crit ? 9 : 4);
  if (e.hp > 0) return;
  e.dead = true; loc.en.splice(loc.en.indexOf(e), 1); G.kills++;
  sfx(90, .25, 'sawtooth', .06, -50); hitstop = .045; shake = Math.max(shake, 3);
  const loot = []; for (const [id, p, a, b] of e.def.drop) if (R() < p || e.elite) loot.push([id, ri(a, b) + (e.elite ? 1 : 0)]);
  if (loot.length) dropBag(loot, e.x, e.y);
  loc.fx.push({k: 'corpse', x: e.x, y: e.y, e, t: 0, T: 9});
  burst(e.x, e.y, 18, '#5a8030', 10, 2.2);
  if (e.def.cloud) {
    loc.fx.push({k: 'cloud', x: e.x, y: e.y, t: 0, T: 1.2});
    if (dist(e, P) < 2.4) { G.p.filter = Math.max(0, G.p.filter - 20); toast('Токсичное облако разъело фильтр! −20', 'bad'); }
  }
  addXp(Math.round(e.def.xp * (e.elite ? 2.5 : 1)));
  for (const c of G.contracts) if (c.type === 'kill' && c.id === e.t && !c.done && c.prog < c.n) { c.prog++; if (c.prog === c.n) toast('Задание выполнено — сдайте его по рации', 'gold'); }
  if (e.def.boss) toast('Альфа-мутант повержен!', 'gold');
}
function hurt(d, e) {
  if (P.inv > 0) { floatText(P.x, P.y, 44, 'уклонение', '#a0e0ff'); return; }
  const a = G.p.eq.armor; if (a) d *= 1 - ITEMS[a.id].armor;
  G.p.hp -= d; P.hurt = .25; shake = Math.max(shake, 5); P.gather = null;
  sfx(140, .12, 'square', .06, -70);
  floatText(P.x, P.y, 44, '-' + Math.round(d), '#ff5050');
  burst(P.x, P.y, 22, '#b02020', 5);
  if (e && e.def.bl && R() < e.def.bl && G.p.bleed <= 0) { G.p.bleed = 16; toast('Кровотечение! Нужен бинт', 'bad'); }
}
function die(why) { G.p.hp = 0; sfx(200, .8, 'sawtooth', .07, -170); openPanel('dead', null, why); }
function respawn() {
  const p = G.p;
  p.inv.fill(null); p.hp = maxHp() * .7; p.bleed = 0; p.hunger = Math.max(p.hunger, 45); p.thirst = Math.max(p.thirst, 45);
  if (p.filter < 30) { p.filter = 30; p.fcap = Math.max(p.fcap, 35); }
  closePanel(true); advanceClock(6); enterBunker();
  toast('Вы очнулись в бункере. Содержимое рюкзака потеряно.', 'bad');
}

// ---------- взаимодействие ----------
const inExit = () => !loc.bunker && (P.x < 2 || P.y < 2 || P.x >= loc.N - 2 || P.y >= loc.N - 2);
function nearestNode(maxd, ok) {
  let b = null, bd = maxd;
  for (const n of loc.nodes) { if (ok && !ok(n)) continue; const d = Math.hypot(n.x + .5 - P.x, n.y + .5 - P.y); if (d < bd) { bd = d; b = n; } }
  return b;
}
function doUse() {
  if (ui.panel) { if (ui.panel !== 'dead' && ui.panel !== 'title') closePanel(); return; }
  if (inExit()) { openPanel('map'); return; }
  const usable = n => n.k === 'mod' || !NODES[n.k].tool || findTool(NODES[n.k].tool);
  const n = nearestNode(1.7, usable) || nearestNode(12, usable) || nearestNode(1.7);
  if (n) { P.auto = {t: 'node', n}; P.af = null; }
}
function interact(n) {
  face({x: n.x + .5, y: n.y + .5});
  if (n.k === 'mod') return modAction(n.mod);
  const d = NODES[n.k];
  if (d.tool && !findTool(d.tool)) { toast(`Нужен инструмент: ${d.tool === 'axe' ? 'топор 🪓' : 'кирка ⛏️'}`, 'bad'); return; }
  if (!P.gather || P.gather.n !== n) P.gather = {n, t: .18};
}
function gatherHit(n) {
  const d = NODES[n.k], nx = n.x + .5, ny = n.y + .5;
  P.atk = .22; n.sh = .25; face({x: nx, y: ny});
  const got = {}; let full = false;
  const take = (id, c, dur) => { const r = add(G.p.inv, id, c, dur); if (c - r > 0) got[id] = (got[id] || 0) + c - r; return r; };
  if (n.k === 'bag') {
    const left = [];
    for (const [id, c, dur] of n.loot) { const r = take(id, c, dur); if (r > 0) left.push([id, r, dur]); }
    if (left.length) { n.loot = left; full = true; } else removeNode(n);
    P.gather = null; sfx(520, .07, 'triangle', .05, 200);
  } else {
    let pw = 1;
    if (d.tool) { const t = findTool(d.tool); if (!t) { P.gather = null; return; } pw = ITEMS[t[0].id].pw; wear(t[0], t[1]); }
    n.hp -= pw;
    const hitsLeft = Math.ceil(Math.max(0, n.hp) / pw), k = n.hp <= 0 ? n.units.length : Math.ceil(n.units.length / (hitsLeft + 1));
    const ids = n.units.splice(0, k);
    if (ids.length && !d.table && n.k !== 'ruby' && R() < .15 * pk('scav')) ids.push(ids[0]);
    const over = [];
    for (const id of ids) if (take(id, 1)) over.push([id, 1]);
    if (over.length) { dropBag(over, P.x, P.y); full = true; }
    burst(nx, ny, 18, d.c, n.hp <= 0 ? 12 : 5, 1.8, 70);
    sfx(d.tool === 'pick' ? 300 + R() * 80 : d.tool === 'axe' ? 150 + R() * 40 : 420, .06, d.tool ? 'square' : 'triangle', .04, d.tool ? -60 : 150);
    if (d.tool) shake = Math.max(shake, 1.2);
    if (n.hp <= 0) {
      removeNode(n); P.gather = null; addXp(1 + d.hp);
      if (n.k === 'cache') {
        const b = (loc.def.bps || []).find(b => !G.bp[b]);
        if (b) { G.bp[b] = 1; toast(`Найден чертёж: ${BPS[b]}!`, 'gold'); sfx(660, .4, 'triangle', .06, 600); burst(nx, ny, 24, '#ffe080', 20, 2.5); }
        else toast('Тайник вскрыт. Все чертежи отсюда у вас уже есть.');
      }
    } else P.gather.t = d.tool ? .5 : .38;
  }
  let row = 0; for (const id in got) floatText(P.x, P.y, 50 + 14 * row++, `+${got[id]} ${ITEMS[id].i}`, '#d8f0a0');
  if (full && !(P.fullT > time)) { P.fullT = time + 2; toast('Рюкзак полон — лишнее осталось на земле', 'bad'); }
}
function modAction(id) {
  if (!modLv(id)) return openPanel('main', 'build', id);
  if (id === 'hatch') return openPanel('map');
  if (id === 'storage') return openPanel('main', 'inv');
  if (id === 'radio') return openPanel('main', 'quests');
  if (id === 'bed') {
    const p = G.p, night = darkness() > .3, h = night ? ((7 - G.clock + 24) % 24 || 1) : 3;
    p.hp = modLv('med') ? maxHp() : Math.min(maxHp(), p.hp + maxHp() * (night ? .6 : .25)); p.bleed = 0;
    p.hunger = Math.max(5, p.hunger - h * 2); p.thirst = Math.max(5, p.thirst - h * 2.5);
    advanceClock(h); flash = 1.4; save();
    return toast(night ? 'Вы проспали до утра. Силы восстановлены.' : 'Вы вздремнули три часа.');
  }
  if (STATIONS[id]) return openPanel('main', 'craft', id);
  openPanel('main', 'build', id);
}
function useItem(i) {
  const s = G.p.inv[i]; if (!s) return;
  const it = ITEMS[s.id], p = G.p;
  if (it.eat) {
    const e = it.eat, heal = e.hp > 0 && !e.hunger && !e.thirst;
    if (heal && p.hp >= maxHp() && p.bleed <= 0) return toast('Здоровье полное');
    if (e.hunger) p.hunger = Math.min(100, p.hunger + e.hunger);
    if (e.thirst) p.thirst = Math.min(100, p.thirst + e.thirst);
    if (e.hp) p.hp = clamp(p.hp + e.hp, 1, maxHp());
    if (heal) { p.bleed = 0; if (P) burst(P.x, P.y, 26, '#70e080', 8, 1, 40); }
    sfx(400, .1, 'sine', .05, 150);
    if (--s.n <= 0) p.inv[i] = null;
  } else if (it.filt) {
    p.filter = it.filt; p.fcap = it.filt; if (--s.n <= 0) p.inv[i] = null;
    toast(`Установлен: ${it.n}`); sfx(300, .12, 'sine', .05, 200);
  } else if (it.w) { p.inv[i] = p.eq.weapon; p.eq.weapon = s; P.warnAmmo = 0; sfx(260, .05, 'triangle'); }
  else if (it.armor) { p.inv[i] = p.eq.armor; p.eq.armor = s; sfx(260, .05, 'triangle'); }
}
function quick(kind) {
  if (kind === 'filter') { if (!swapFilter()) toast('Нет запасных фильтров', 'bad'); return; }
  const inv = G.p.inv; let best = -1, bv = 0;
  inv.forEach((s, i) => {
    if (!s) return; const e = ITEMS[s.id].eat; if (!e) return;
    let v = 0;
    if (kind === 'eat') v = e.hunger || 0;
    else if (kind === 'drink') v = (e.thirst || 0) >= 15 ? e.thirst + (e.hp < 0 ? -30 : 0) + 31 : 0;
    else if (!e.hunger && !e.thirst) v = G.p.hp < maxHp() * .45 ? e.hp : 200 - e.hp;
    if (v > bv) { bv = v; best = i; }
  });
  if (best < 0) return toast(kind === 'eat' ? 'Нет еды' : kind === 'drink' ? 'Нет воды' : 'Нет медикаментов', 'bad');
  useItem(best);
}
function swapFilter() {
  for (const id of ['filter', 'filter2', 'filter0']) {
    const i = G.p.inv.findIndex(s => s && s.id === id);
    if (i >= 0) { useItem(i); return true; }
  }
  return false;
}
function inputVec() {
  const ix = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + joy.x;
  const iy = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0) + joy.y;
  const il = Math.hypot(ix, iy); if (il < .15) return null;
  const wx = ix + iy, wy = iy - ix, l = Math.hypot(wx, wy) || 1, k = Math.min(1, il);
  return [wx / l * k, wy / l * k];
}
function doDash() {
  if (ui.panel || !P || P.dash > 0) return;
  const cost = 28 - 4 * pk('swift');
  if (P.st < cost) { sfx(120, .08, 'square', .03); return; }
  const v = inputVec(); let dx = P.dx, dy = P.dy;
  if (v) { const l = Math.hypot(v[0], v[1]); dx = v[0] / l; dy = v[1] / l; }
  P.st -= cost; P.stWait = .7; P.dash = .2; P.inv = .32; P.ddx = dx; P.ddy = dy; P.auto = null; P.gather = null; P.sneak = false;
  const s = dx - dy; if (Math.abs(s) > .1) P.fx = s > 0 ? 1 : -1;
  burst(P.x, P.y, 4, '#c8c0a0', 8, 1.2, 25); sfx(300, .12, 'sine', .04, 400);
}
function toggleSneak() { if (ui.panel || !P || loc.bunker) return; P.sneak = !P.sneak; sfx(P.sneak ? 200 : 320, .06, 'sine', .03); }

function spawnEdge(t, hot) {
  const N = loc.N;
  for (let i = 0; i < 40; i++) {
    const a = ri(2, N - 3), side = ri(0, 3), x = side === 0 ? 2 : side === 1 ? N - 3 : a, y = side === 2 ? 2 : side === 3 ? N - 3 : a;
    if (loc.solid[y * N + x] || Math.hypot(x - P.x, y - P.y) < 9) continue;
    const e = spawnEnemy(loc, t, x + .5, y + .5); if (hot) { e.aggro = true; e.alert = 1; } return e;
  }
}
function horde() {
  loc.noise = 0;
  const n = 4 + loc.def.danger;
  for (let i = 0; i < n; i++) spawnEdge(R() < .55 ? 'runner' : 'zombie', true);
  toast('ОРДА! Шум привлёк заражённых со всей округи', 'bad'); sfx(70, 1, 'sawtooth', .08, 60); shake = 8;
}

// ---------- обновление ----------
function update(dt) {
  time += dt; loc.t += dt;
  const p = G.p, b = loc.bunker, camel = 1 - .15 * pk('camel');
  advanceClock(dt / 15);
  // выживание
  p.hunger = Math.max(0, p.hunger - dt * (b ? .05 : .11) * camel);
  p.thirst = Math.max(0, p.thirst - dt * (b ? .07 : .15) * camel);
  if (p.hunger <= 0) p.hp -= .8 * dt;
  if (p.thirst <= 0) p.hp -= 1.2 * dt;
  if (p.bleed > 0) { p.bleed -= dt; p.hp -= 1.2 * dt; if (R() < dt * 6) loc.fx.push({k: 'p', x: P.x, y: P.y, h: 18, vx: 0, vy: 0, vh: 0, c: '#b02020', s: 2.5, t: 0, T: .5}); }
  else if (p.hunger > 40 && p.thirst > 40 && p.hp < maxHp()) p.hp = Math.min(maxHp(), p.hp + dt * (b ? 1.2 : .35));
  if (!b) {
    const a = p.eq.armor, sv = a && ITEMS[a.id].save || 0, tox = loc.def.tox;
    if (p.filter > 0) {
      p.filter -= dt * (100 / 160) * tox * (1 - sv) * (1 - .12 * pk('lungs'));
      if (p.filter <= 0) { p.filter = 0; if (!swapFilter()) toast('Фильтр закончился! Вы дышите отравой!', 'bad'); }
    } else if (!swapFilter()) {
      p.hp -= 2.5 * tox * dt;
      if ((P.cough -= dt) <= 0) { P.cough = 1.6; sfx(180, .1, 'sawtooth', .04, -80); floatText(P.x, P.y, 46, 'кхе-кхе…', '#b8e060'); }
    }
    loc.noise = Math.max(0, loc.noise - dt * 3);
    if (loc.noise >= 100) horde();
    const dk = darkness();
    if (dk > .5 && (loc.spawnT -= dt) <= 0 && loc.en.length < loc.base + 6) { loc.spawnT = 24; spawnEdge(R() < .6 ? 'stalker' : 'zombie', R() < .5); }
    for (const f of loc.fog) { f.x += f.vx * dt; f.y += f.vy * dt; const N = loc.N; if (f.x < -4) f.x = N + 4; if (f.x > N + 4) f.x = -4; if (f.y < -4) f.y = N + 4; if (f.y > N + 4) f.y = -4; }
  }
  if (p.hp <= 0) return die(p.bleed > 0 ? 'Вы истекли кровью' : p.filter <= 0 && !b ? 'Вы задохнулись без фильтра' : p.thirst <= 0 ? 'Вы умерли от жажды' : p.hunger <= 0 ? 'Вы умерли от голода' : 'Вас разорвали заражённые');

  updPlayer(dt);
  if (!b) updEnemies(dt);
  for (const n of loc.nodes) if (n.sh > 0) n.sh = Math.max(0, n.sh - dt);
  for (let i = loc.fx.length - 1; i >= 0; i--) {
    const f = loc.fx[i]; f.t += dt;
    if (f.k === 'p') { f.x += f.vx * dt; f.y += f.vy * dt; f.h += f.vh * dt; f.vh -= 220 * dt; if (f.h < 0) { f.h = 0; f.vh *= -.3; f.vx *= .5; f.vy *= .5; } }
    if (f.t >= f.T) loc.fx.splice(i, 1);
  }
  for (let i = loc.txt.length - 1; i >= 0; i--) { const t = loc.txt[i]; t.t += dt; if (t.t > 1) loc.txt.splice(i, 1); }
  shake = Math.max(0, shake - dt * 20);
}

function updPlayer(dt) {
  P.cd -= dt; P.atk = Math.max(0, P.atk - dt); P.hurt = Math.max(0, P.hurt - dt); P.inv = Math.max(0, P.inv - dt);
  if ((P.stWait -= dt) <= 0) P.st = Math.min(100, P.st + 24 * dt);
  if (P.dash > 0) { // рывок
    P.dash -= dt; move(P, P.ddx * 11 * dt, P.ddy * 11 * dt);
    if (R() < .7) loc.fx.push({k: 'ghost', x: P.x, y: P.y, fx: P.fx, t: 0, T: .22});
    return;
  }
  const v = inputVec();
  let mx = 0, my = 0, manual = false;
  if (v) { mx = v[0]; my = v[1]; manual = true; P.auto = null; P.gather = null; }
  else if (P.auto) {
    const a = P.auto; let tx, ty, go = false;
    if (a.t === 'enemy') {
      if (a.e.dead) P.auto = null;
      else { tx = a.e.x; ty = a.e.y; if (inRange(a.e)) { face(a.e); if (P.cd <= 0) attack(a.e); } else go = true; }
    } else if (a.t === 'node') {
      tx = a.n.x + .5; ty = a.n.y + .5;
      if (a.n.gone) P.auto = null;
      else if (Math.hypot(tx - P.x, ty - P.y) < 1.3) { P.auto = null; interact(a.n); }
      else go = true;
    } else { tx = a.x; ty = a.y; if (Math.hypot(tx - P.x, ty - P.y) < .15) P.auto = null; else go = true; }
    if (go) {
      if ((P.aft -= dt) <= 0 || !P.af) { P.af = mkField(tx | 0, ty | 0); P.aft = .3; }
      [mx, my] = steer(P, tx, ty, P.af);
    }
  }
  if (mx || my) {
    const base = 3.2 * (1 + .06 * pk('swift')) * (P.sneak ? .5 : 1) * (G.p.hunger <= 0 || G.p.thirst <= 0 ? .8 : 1);
    const sp = base * dt, ox = P.x, oy = P.y;
    move(P, mx * sp, my * sp);
    const l = Math.hypot(mx, my); P.dx = mx / l; P.dy = my / l;
    const s = mx - my; if (Math.abs(s) > .1) P.fx = s > 0 ? 1 : -1;
    P.walk += dt * (P.sneak ? 6 : 11);
    if (!P.sneak && (P.step -= dt) <= 0) { P.step = .28; loc.fx.push({k: 'p', x: P.x, y: P.y, h: 1, vx: rnd(-.3, .3), vy: rnd(-.3, .3), vh: 14, c: '#c8c0a055', s: 2.5, t: 0, T: .35}); }
    if (!manual && Math.hypot(P.x - ox, P.y - oy) < sp * .2) { if ((P.stuck += dt) > .5) { P.auto = null; P.stuck = 0; } } else P.stuck = 0;
  } else P.walk = 0;
  if ((keys.Space || atkHeld) && !loc.bunker) {
    const e = nearestEnemy(9);
    if (e && inRange(e)) { face(e); if (P.cd <= 0) attack(e); }
    else if (e && !manual) { if (!P.auto || P.auto.t !== 'enemy') { P.auto = {t: 'enemy', e}; P.af = null; } }
    else if (!e && P.cd <= 0) { P.cd = .45; P.atk = .22; sfx(200, .05, 'triangle', .03, -80); }
  }
  if (P.gather) {
    const g = P.gather;
    if (g.n.gone) P.gather = null;
    else if ((g.t -= dt) <= 0) gatherHit(g.n);
  }
}

function updEnemies(dt) {
  if ((pft -= dt) <= 0 || !pfield) { pfield = mkField(P.x | 0, P.y | 0, 26); pft = .25; }
  const en = loc.en, dk = darkness();
  for (const e of en) {
    const d = dist(e, P), df = e.def;
    e.cd -= dt; e.hit = Math.max(0, e.hit - dt); e.atk = Math.max(0, e.atk - dt); e.bang = Math.max(0, (e.bang || 0) - dt);
    if (!e.aggro) { // обнаружение игрока
      let rr = df.ag * (1 + .2 * dk) * (P.sneak ? .45 * (1 - .15 * pk('ghost')) : 1 - .07 * pk('ghost'));
      if ((P.x - e.x) * e.fdx + (P.y - e.y) * e.fdy < 0) rr *= .55; // со спины
      if (d < rr && (d < 2.5 || lineClear(e.x, e.y, P.x, P.y, true))) e.alert += dt * (.8 + 2.2 * (1 - d / rr));
      else e.alert = Math.max(0, e.alert - dt * .4);
      if (e.alert >= 1 || d < .75) aggro(e);
    } else if (d > 15) { if ((e.lost += dt) > 4) { e.aggro = false; e.alert = 0; } } else e.lost = 0;
    if (e.stun > 0) { e.stun -= dt; continue; }
    let mx = 0, my = 0, sp = df.sp * (df.boss && e.hp < e.mhp / 2 ? 1.35 : 1) * (1 + .12 * dk);
    if (e.aggro) {
      const l = d || 1; e.fdx = (P.x - e.x) / l; e.fdy = (P.y - e.y) / l;
      const s = e.fdx - e.fdy; if (Math.abs(s) > .05) e.fx = s > 0 ? 1 : -1;
      if (df.spit) {
        if (d < df.rg && e.cd <= 0 && lineClear(e.x, e.y, P.x, P.y, true)) {
          e.cd = df.cd; e.atk = .3;
          loc.proj.push({x: e.x, y: e.y, vx: e.fdx * 6.5, vy: e.fdy * 6.5, life: 1.4, dmg: df.dmg, e});
          sfx(500, .15, 'sine', .04, -300);
        }
        if (d > 5) [mx, my] = steer(e, P.x, P.y, pfield);
        else if (d < 2.8) { mx = -e.fdx; my = -e.fdy; }
      } else if (e.wind > 0) {
        if ((e.wind -= dt) <= 0) { e.cd = df.cd; if (d < df.rg + .4) hurt(df.dmg * (e.elite ? 1.3 : 1), e); }
      } else if (d <= df.rg && e.cd <= 0) { e.wind = .38; e.atk = .38; }
      else if (d > df.rg * .8) [mx, my] = steer(e, P.x, P.y, pfield);
    } else {
      if ((e.wt -= dt) <= 0) { e.wt = rnd(1.5, 4.5); if (R() < .6) { const a = R() * 6.28; e.wx = Math.cos(a); e.wy = Math.sin(a); } else e.wx = e.wy = 0; }
      mx = e.wx; my = e.wy; sp *= .3;
      if (mx || my) { e.fdx = mx; e.fdy = my; const s = mx - my; if (Math.abs(s) > .1) e.fx = s > 0 ? 1 : -1; }
    }
    if (mx || my) { if (!move(e, mx * sp * dt, my * sp * dt) && !e.aggro) e.wt = 0; e.walk += dt * sp * 4; }
  }
  for (let i = 0; i < en.length; i++) for (let j = i + 1; j < en.length; j++) {
    const a = en[i], b = en[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), m = a.r + b.r;
    if (d < m && d > .001) { const k = (m - d) / d * .5; move(a, -dx * k, -dy * k); move(b, dx * k, dy * k); }
  }
  for (const e of en) { const d = dist(e, P), m = e.r + P.r; if (d < m && d > .001) move(e, (e.x - P.x) / d * (m - d), (e.y - P.y) / d * (m - d)); }
  for (let i = loc.proj.length - 1; i >= 0; i--) {
    const p = loc.proj[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
    const N = loc.N, out = p.x < 0 || p.y < 0 || p.x >= N || p.y >= N;
    if (!out && Math.hypot(p.x - P.x, p.y - P.y) < .4) { hurt(p.dmg, p.e); burst(p.x, p.y, 20, '#a0e040', 6); loc.proj.splice(i, 1); }
    else if (out || p.life <= 0 || loc.solid[(p.y | 0) * N + (p.x | 0)] === 1) { if (!out) burst(p.x, p.y, 16, '#a0e040', 5); loc.proj.splice(i, 1); }
  }
}
