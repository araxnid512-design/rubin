// Игровая логика тестовой локации «Посёлок».
// Новые механики добавляются только после сверки с LORE.md (см. CLAUDE.md).
(function () {
  const D = window.GameData;
  const W = window.World;
  const SAVE_KEY = 'styx-save-v1';

  const canvas = document.getElementById('game');
  let width = 0, height = 0;
  let last = performance.now();
  let saveTimer = 0;
  let state;

  // --- Состояние ---
  function newState() {
    const s = {
      player: { x: 55, y: 95, hp: D.PLAYER.hp, food: 80, water: 80, angle: -Math.PI / 2, hitFlash: 0 },
      inventory: new Array(D.INVENTORY_SLOTS).fill(null),
      weapon: { id: 'knife', dur: D.WEAPONS.knife.durability },
      searched: {},
      containerItems: {},
      rescued: false,
      time: 0,
      quests: {
        survivors: { title: 'Найти выживших', active: true, done: false, target: npc('survivor') },
        shop: { title: 'Проверить магазин', active: true, done: false, target: { x: 69, y: 24 } },
        bus: { title: 'Осмотреть автобус', active: true, done: false, target: { x: 56.6, y: 48 } },
        exit: { title: 'Выйти на дорогу к соседней зоне', active: false, done: false,
          target: { x: W.exit.x + 1.5, y: W.exit.y + 2.5 } },
      },
      drops: [],
      enemies: [],
      respawns: [],
      tracers: [],
      flashes: [],
      swing: 0,
      swingRange: 1,
      attackCd: 0,
      ui: null,
      over: false,
      kills: 0,
    };
    addItem(s, 'bandage', 2);
    addItem(s, 'water', 1);
    addItem(s, 'rusk', 2);
    return s;
  }

  function npc(id) {
    const n = W.npcs.find((k) => k.id === id);
    return { x: n.x, y: n.y };
  }

  function spawnAll() {
    state.enemies = W.spawns.map((sp, i) => makeEnemy(sp, i));
  }

  function makeEnemy(sp, index) {
    const T = D.ENEMIES[sp.type];
    return {
      kind: sp.type, type: T, spawn: index,
      x: sp.x, y: sp.y, hp: T.hp, angle: Math.random() * 6.28,
      state: 'idle', attackCd: 0, hitFlash: 0, seed: Math.random(),
      wander: { x: sp.x, y: sp.y, t: 0 },
    };
  }

  // --- Инвентарь ---
  function addItem(s, id, count, dur) {
    const def = D.ITEMS[id];
    if (def.kind === 'weapon') {
      for (let n = 0; n < count; n++) {
        const i = s.inventory.indexOf(null);
        if (i < 0) return count - n;
        s.inventory[i] = { id, count: 1, dur: dur != null ? dur : D.WEAPONS[id].durability };
      }
      return 0;
    }
    for (const slot of s.inventory) {
      if (!count) break;
      if (slot && slot.id === id && slot.count < def.stack) {
        const add = Math.min(count, def.stack - slot.count);
        slot.count += add;
        count -= add;
      }
    }
    while (count > 0) {
      const i = s.inventory.indexOf(null);
      if (i < 0) break;
      const add = Math.min(count, def.stack);
      s.inventory[i] = { id, count: add };
      count -= add;
    }
    return count;
  }

  function countItem(id) {
    return state.inventory.reduce((n, s) => n + (s && s.id === id ? s.count : 0), 0);
  }

  function removeItem(id, count) {
    for (let i = state.inventory.length - 1; i >= 0 && count > 0; i--) {
      const s = state.inventory[i];
      if (!s || s.id !== id) continue;
      const take = Math.min(count, s.count);
      s.count -= take;
      count -= take;
      if (s.count <= 0) state.inventory[i] = null;
    }
  }

  function useSlot(i) {
    const slot = state.inventory[i];
    if (!slot) return;
    const def = D.ITEMS[slot.id];
    const p = state.player;
    if (def.kind === 'weapon') {
      const prev = state.weapon;
      state.weapon = { id: slot.id, dur: slot.dur };
      state.inventory[i] = prev ? { id: prev.id, count: 1, dur: prev.dur } : null;
      toast(`В руках: ${def.name}`);
      return;
    }
    if (def.kind === 'material') return;
    if (def.heal) p.hp = Math.min(D.PLAYER.hp, p.hp + def.heal);
    if (def.food) p.food = Math.min(100, p.food + def.food);
    if (def.water) p.water = Math.min(100, p.water + def.water);
    slot.count -= 1;
    if (slot.count <= 0) state.inventory[i] = null;
    toast(`Использовано: ${def.name}`);
  }

  function unequip() {
    if (!state.weapon) return;
    const i = state.inventory.indexOf(null);
    if (i < 0) { toast('Рюкзак полон'); return; }
    state.inventory[i] = { id: state.weapon.id, count: 1, dur: state.weapon.dur };
    state.weapon = null;
  }

  function dropSlot(i) {
    const slot = state.inventory[i];
    if (!slot) return;
    const p = state.player;
    state.drops.push({ id: 'd' + Math.random(), name: 'Выброшенное', x: p.x, y: p.y + 0.6,
      items: [Object.assign({}, slot)] });
    state.inventory[i] = null;
  }

  // Ремонт: weapon — объект {id, dur} (в руках или в слоте).
  function repairCost(w) {
    return D.WEAPONS[w.id].repair || {};
  }

  function canRepair(w) {
    const cost = repairCost(w);
    return w.dur < D.WEAPONS[w.id].durability && Object.entries(cost).every(([id, n]) => countItem(id) >= n);
  }

  function repair(w) {
    if (!canRepair(w)) return false;
    for (const [id, n] of Object.entries(repairCost(w))) removeItem(id, n);
    w.dur = D.WEAPONS[w.id].durability;
    toast(`${D.ITEMS[w.id].name} отремонтирован`);
    return true;
  }

  // LORE: Живчик — споран, разведённый в воде.
  function craftZhivchik() {
    if (countItem('sporan') < 1 || countItem('water') < 1) return false;
    removeItem('sporan', 1);
    removeItem('water', 1);
    const left = addItem(state, 'zhivchik', 1);
    if (left) { addItem(state, 'sporan', 1); addItem(state, 'water', 1); toast('Рюкзак полон'); return false; }
    toast('Приготовлен живчик');
    return true;
  }

  function quickHeal() {
    const p = state.player;
    if (p.hp >= D.PLAYER.hp) { toast('Вы здоровы'); return; }
    const missing = D.PLAYER.hp - p.hp;
    const order = missing > 30 ? ['medkit', 'zhivchik', 'bandage'] : ['bandage', 'zhivchik', 'medkit'];
    for (const id of order) {
      const i = state.inventory.findIndex((s) => s && s.id === id);
      if (i >= 0) { useSlot(i); return; }
    }
    toast('Нечем лечиться');
  }

  function healCount() {
    return countItem('medkit') + countItem('bandage') + countItem('zhivchik');
  }

  // --- Добыча ---
  function rollLoot(table) {
    const out = [];
    for (const [id, chance, min, max] of D.LOOT[table]) {
      if (Math.random() < chance) {
        const n = min + Math.floor(Math.random() * (max - min + 1));
        if (D.ITEMS[id].kind === 'weapon') {
          const full = D.WEAPONS[id].durability;
          out.push({ id, count: 1, dur: Math.round(full * (0.35 + Math.random() * 0.5)) });
        } else {
          out.push({ id, count: n });
        }
      }
    }
    return out;
  }

  function rollSporans() {
    const total = D.SPORAN_ROLL.reduce((s, r) => s + r.weight, 0);
    let n = Math.random() * total;
    for (const r of D.SPORAN_ROLL) if ((n -= r.weight) < 0) return r.count;
    return 0;
  }

  function openContainer(c) {
    if (!state.containerItems[c.id]) state.containerItems[c.id] = rollLoot(c.table);
    state.searched[c.id] = true;
    if (c.quest) completeQuest(c.quest);
    state.ui = { type: 'loot', name: c.name, items: state.containerItems[c.id] };
    window.UI.openLoot(state.ui);
  }

  function openDrop(d) {
    state.ui = { type: 'loot', name: d.name, items: d.items, drop: d };
    window.UI.openLoot(state.ui);
  }

  function takeLoot(index) {
    const ui = state.ui;
    const it = ui.items[index];
    if (!it) return;
    const left = addItem(state, it.id, it.count, it.dur);
    if (left === it.count) { toast('Рюкзак полон'); return; }
    if (left > 0) it.count = left; else ui.items.splice(index, 1);
    cleanupDrop();
  }

  function takeAll() {
    const ui = state.ui;
    for (let i = ui.items.length - 1; i >= 0; i--) {
      const it = ui.items[i];
      const left = addItem(state, it.id, it.count, it.dur);
      if (left > 0) { it.count = left; toast('Рюкзак полон'); } else ui.items.splice(i, 1);
    }
    cleanupDrop();
  }

  function cleanupDrop() {
    const d = state.ui && state.ui.drop;
    if (d && d.items.length === 0) state.drops = state.drops.filter((x) => x !== d);
  }

  function closeUI() {
    state.ui = null;
    last = performance.now();
  }

  // --- Задания ---
  function completeQuest(id) {
    const q = state.quests[id];
    if (!q || q.done || !q.active) return;
    q.done = true;
    toast(`Задание выполнено: ${q.title}`);
    const base = ['survivors', 'shop', 'bus'];
    if (base.every((k) => state.quests[k].done) && !state.quests.exit.active) {
      state.quests.exit.active = true;
      toast('Новое задание: выйти на дорогу к соседней зоне');
    }
    if (id === 'exit') toast('Тестовая локация пройдена! Можно исследовать дальше.');
  }

  function talk(n) {
    if (state.rescued) { toast('Выживший: «Иди, я тут пережду до утра».'); return; }
    state.rescued = true;
    addItem(state, 'medkit', 1);
    completeQuest('survivors');
    toast('Выживший: «Ты тоже иммунный? Держи аптечку. Говорят, на стоянке в грузовике было оружие, но там бродит топтун».', 6);
  }

  // --- Взаимодействие ---
  function findInteract() {
    const p = state.player;
    let best = null, bestD = 1.1;
    for (const n of W.npcs) {
      const d = Math.hypot(n.x - p.x, n.y - p.y);
      if (d < 1.5 && d < bestD + 0.4) { best = { kind: 'npc', obj: n, label: 'Говорить' }; bestD = d; }
    }
    for (const d of state.drops) {
      const dist = Math.hypot(d.x - p.x, d.y - p.y);
      if (dist < bestD) { best = { kind: 'drop', obj: d, label: 'Обыскать' }; bestD = dist; }
    }
    for (const c of W.containers) {
      const dist = W.distToRect(p.x, p.y, c) - D.PLAYER.radius;
      if (dist < bestD) {
        const empty = state.searched[c.id] && state.containerItems[c.id].length === 0;
        best = { kind: 'container', obj: c, label: empty ? `${c.name} (пусто)` : c.name };
        bestD = dist;
      }
    }
    return best;
  }

  function interact() {
    if (state.ui || state.over) return;
    const t = findInteract();
    if (!t) return;
    if (t.kind === 'npc') talk(t.obj);
    else if (t.kind === 'drop') openDrop(t.obj);
    else openContainer(t.obj);
  }

  // --- Бой ---
  function weaponDef() {
    const w = state.weapon;
    return w && w.dur > 0 ? D.WEAPONS[w.id] : D.WEAPONS.fists;
  }

  function nearestTarget(range) {
    const p = state.player;
    let best = null, bestD = range;
    for (const e of state.enemies) {
      const d = Math.hypot(e.x - p.x, e.y - p.y) - e.type.radius;
      if (d < bestD && !W.blocked(p.x, p.y, e.x, e.y)) { best = e; bestD = d; }
    }
    return best;
  }

  function damage(e, amount) {
    e.hp -= amount;
    e.hitFlash = 0.12;
    if (e.state !== 'chase') e.state = 'chase';
  }

  function alertNoise(x, y, radius) {
    for (const e of state.enemies) {
      if (Math.hypot(e.x - x, e.y - y) < radius) e.state = 'chase';
    }
  }

  function attack() {
    const p = state.player;
    const wd = weaponDef();
    const target = nearestTarget(wd.type === 'ranged' ? wd.range : wd.range + 2.5);
    if (target) p.angle = Math.atan2(target.y - p.y, target.x - p.x);
    state.attackCd = wd.interval;

    if (wd.type === 'melee') {
      state.swing = 0.2;
      state.swingRange = wd.range + D.PLAYER.radius;
      for (const e of state.enemies) {
        const dx = e.x - p.x, dy = e.y - p.y;
        const d = Math.hypot(dx, dy) - e.type.radius - D.PLAYER.radius;
        let da = Math.atan2(dy, dx) - p.angle;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        if (d < wd.range && Math.abs(da) < 0.9) damage(e, wd.damage);
      }
      if (wd.noise) alertNoise(p.x, p.y, wd.noise);
    } else {
      const dist = target ? Math.hypot(target.x - p.x, target.y - p.y) : wd.range;
      const x2 = p.x + Math.cos(p.angle) * dist, y2 = p.y + Math.sin(p.angle) * dist;
      if (target) damage(target, wd.damage);
      state.tracers.push({ x1: p.x, y1: p.y, x2, y2, t: 0.08 });
      state.flashes.push({ x: p.x, y: p.y, t: 0.08 });
      alertNoise(p.x, p.y, wd.noise);
    }

    const w = state.weapon;
    if (w && w.dur > 0) {
      w.dur -= 1;
      if (w.dur <= 0) toast(`${D.ITEMS[w.id].name}: оружие сломалось! Почините в рюкзаке.`, 4);
    }
  }

  // --- Обновление ---
  function hour() {
    return (D.START_HOUR + state.time / D.DAY_SECONDS * 24) % 24;
  }

  function isNight() {
    return window.Render.darkness(hour()) > 0.4;
  }

  function updatePlayer(dt) {
    const p = state.player;
    const m = window.Input.move;
    const len = Math.hypot(m.x, m.y);
    if (len > 0.1) {
      W.move(p, m.x * D.PLAYER.speed * dt, m.y * D.PLAYER.speed * dt, D.PLAYER.radius);
      if (!window.Input.fire || state.attackCd <= 0) p.angle = Math.atan2(m.y, m.x);
    }
    p.food = Math.max(0, p.food - D.PLAYER.foodDecay * dt);
    p.water = Math.max(0, p.water - D.PLAYER.waterDecay * dt);
    if (p.food <= 0 || p.water <= 0) p.hp -= D.PLAYER.starveDamage * dt;
    p.hitFlash -= dt;

    state.attackCd -= dt;
    if (window.Input.fire && state.attackCd <= 0) attack();

    const q = state.quests.exit;
    const e = W.exit;
    if (q.active && !q.done && p.x > e.x && p.y > e.y && p.y < e.y + e.h) completeQuest('exit');
  }

  function updateEnemies(dt) {
    const p = state.player;
    const night = isNight();
    const inside = W.buildingAt(p.x, p.y);
    for (const e of state.enemies) {
      const T = e.type;
      e.hitFlash -= dt;
      e.attackCd -= dt;
      const dx = p.x - e.x, dy = p.y - e.y;
      const dist = Math.hypot(dx, dy);
      let detect = T.detect * (night ? 0.6 : 1) * (inside ? 0.7 : 1);
      if (e.state !== 'chase' && dist < detect && !W.blocked(e.x, e.y, p.x, p.y)) e.state = 'chase';
      if (e.state === 'chase' && dist > 26) e.state = 'idle';

      if (e.state === 'chase') {
        const reach = T.radius + D.PLAYER.radius + 0.25;
        if (dist > reach) {
          W.move(e, dx / dist * T.speed * dt, dy / dist * T.speed * dt, T.radius);
        } else if (e.attackCd <= 0) {
          p.hp -= T.damage;
          p.hitFlash = 0.15;
          e.attackCd = T.attackInterval;
        }
        e.angle = Math.atan2(dy, dx);
      } else {
        // Бродит около своей точки.
        const w = e.wander;
        w.t -= dt;
        if (w.t <= 0) {
          const sp = W.spawns[e.spawn];
          w.x = sp.x + (Math.random() - 0.5) * 8;
          w.y = sp.y + (Math.random() - 0.5) * 8;
          w.t = 3 + Math.random() * 4;
        }
        const wx = w.x - e.x, wy = w.y - e.y;
        const wd = Math.hypot(wx, wy);
        if (wd > 0.3) {
          const sp = Math.min(T.speed, 1.0);
          W.move(e, wx / wd * sp * dt, wy / wd * sp * dt, T.radius);
          e.angle = Math.atan2(wy, wx);
        }
      }
    }
    // Расталкивание.
    const es = state.enemies;
    for (let i = 0; i < es.length; i++) {
      for (let j = i + 1; j < es.length; j++) {
        const a = es[i], b = es[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1e-6;
        const min = a.type.radius + b.type.radius;
        if (d < min) {
          const push = (min - d) / 2;
          a.x -= dx / d * push; a.y -= dy / d * push;
          b.x += dx / d * push; b.y += dy / d * push;
        }
      }
    }
    // Гибель: у жёлтой стадии остаётся споровый мешок (LORE: Споран).
    for (const e of es) {
      if (e.hp > 0) continue;
      state.kills += 1;
      state.respawns.push({ spawn: e.spawn, t: 150 });
      if (e.type.sporans) {
        const n = rollSporans();
        state.drops.push({ id: 'd' + Math.random(), name: `${e.type.name}: споровый мешок`, x: e.x, y: e.y,
          items: n ? [{ id: 'sporan', count: n }] : [] });
        if (!n) toast('Споровый мешок пуст');
      }
    }
    state.enemies = es.filter((e) => e.hp > 0);
    state.drops = state.drops.filter((d) => d.items.length > 0);

    for (const r of state.respawns) {
      r.t -= dt;
      const sp = W.spawns[r.spawn];
      if (r.t <= 0 && Math.hypot(sp.x - p.x, sp.y - p.y) > 30) {
        state.enemies.push(makeEnemy(sp, r.spawn));
        r.done = true;
      }
    }
    state.respawns = state.respawns.filter((r) => !r.done);
  }

  function update(dt) {
    state.time += dt;
    updatePlayer(dt);
    updateEnemies(dt);
    state.swing -= dt;
    for (const t of state.tracers) t.t -= dt;
    for (const f of state.flashes) f.t -= dt;
    state.tracers = state.tracers.filter((t) => t.t > 0);
    state.flashes = state.flashes.filter((f) => f.t > 0);

    if (state.player.hp <= 0) {
      state.player.hp = 0;
      state.over = true;
      clearSave();
      window.UI.showGameOver(`Прожито ${formatDays()} · убито заражённых: ${state.kills}`);
    }

    saveTimer += dt;
    if (saveTimer > 20) { saveTimer = 0; save(); }
  }

  function formatDays() {
    const h = Math.floor(state.time / D.DAY_SECONDS * 24);
    return h < 24 ? `${h} ч` : `${Math.floor(h / 24)} дн ${h % 24} ч`;
  }

  // --- Сохранение (localStorage может быть недоступен — тогда просто без сохранений) ---
  function save() {
    if (!state || state.over) return;
    const data = {
      player: state.player, inventory: state.inventory, weapon: state.weapon,
      searched: state.searched, containerItems: state.containerItems, rescued: state.rescued,
      time: state.time, kills: state.kills,
      quests: Object.fromEntries(Object.entries(state.quests).map(([k, q]) => [k, { active: q.active, done: q.done }])),
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* нет хранилища */ }
  }

  function clearSave() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* нет хранилища */ }
  }

  function load() {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { data = null; }
    if (!data) return false;
    Object.assign(state.player, data.player);
    state.inventory = data.inventory;
    state.weapon = data.weapon;
    state.searched = data.searched || {};
    state.containerItems = data.containerItems || {};
    state.rescued = !!data.rescued;
    state.time = data.time || 0;
    state.kills = data.kills || 0;
    for (const [k, q] of Object.entries(data.quests || {})) Object.assign(state.quests[k], q);
    return true;
  }

  // --- Тосты ---
  function toast(text, seconds) {
    window.UI.toast(text, seconds || 2.5);
  }

  // --- Цикл ---
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    window.Render.resize(width, height, dpr);
  }

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!window.Platform.paused && !state.ui && !state.over) update(dt);
    state.hour = hour();
    state.weaponDef = weaponDef();
    window.Render.draw(state, now / 1000);
    window.Render.drawMinimap(state);
    window.UI.updateHud(state, findInteract());
    requestAnimationFrame(frame);
  }

  function start(fresh) {
    state = newState();
    if (fresh) clearSave(); else load();
    spawnAll();
    window.UI.hideGameOver();
    last = performance.now();
  }

  window.Game = {
    get state() { return state; },
    D, useSlot, unequip, dropSlot, repair, canRepair, repairCost, craftZhivchik, countItem,
    quickHeal, healCount, interact, takeLoot, takeAll, closeUI, newGame: () => start(true), save,
  };

  window.Render.init(canvas);
  window.Render.initMinimap(document.getElementById('minimap'));
  window.addEventListener('resize', resize);
  window.Platform.on('pause', save);
  window.Platform.on('resume', () => { last = performance.now(); });
  resize();
  start(false);
  requestAnimationFrame(frame);
})();
