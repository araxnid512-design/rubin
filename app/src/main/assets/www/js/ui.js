'use strict';
/* Интерфейс: управление, HUD, окна */
(function () {
  const $ = id => document.getElementById(id), I = G.input, Inv = G.Inv;
  const ui = G.ui = {};
  let panel = null, selSlot = -1, chestRef = null, confirmNew = 0;

  /* ---------- Управление ---------- */
  const touch = $('touch'), joy = $('joy'), knob = $('joy-knob');
  let joyId = null, jx0 = 0, jy0 = 0, joyMoved = false, tap = null, joyHome = null;
  function joyRect() { joy.style.transform = ''; const r = joy.getBoundingClientRect(); joyHome = { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 }; }
  ui.layout = joyRect;
  function joyEnd() { joyId = null; I.mx = I.my = 0; joy.classList.remove('on'); joy.style.transform = ''; knob.style.transform = ''; }
  touch.addEventListener('pointerdown', e => {
    G.audioInit();
    if (G.build) tap = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
    if (joyId === null && e.clientX < innerWidth * 0.5) {
      joyId = e.pointerId; jx0 = e.clientX; jy0 = e.clientY; joyMoved = false;
      if (!joyHome) joyRect();
      if (!G.build) { joy.classList.add('on'); joy.style.transform = 'translate(' + (jx0 - joyHome.x) + 'px,' + (jy0 - joyHome.y) + 'px)'; }
      try { touch.setPointerCapture(e.pointerId); } catch (_) { }
    }
  });
  touch.addEventListener('pointermove', e => {
    if (e.pointerId !== joyId) return;
    let dx = e.clientX - jx0, dy = e.clientY - jy0; const R = joyHome.r, l = Math.hypot(dx, dy);
    if (l > 10 && !joyMoved) { joyMoved = true; joy.classList.add('on'); joy.style.transform = 'translate(' + (jx0 - joyHome.x) + 'px,' + (jy0 - joyHome.y) + 'px)'; }
    if (!joyMoved) return;
    if (l > R) { dx *= R / l; dy *= R / l; }
    I.mx = dx / R; I.my = dy / R;
    knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
  });
  function tUp(e) {
    if (tap && tap.id === e.pointerId) {
      if (G.build && e.type === 'pointerup' && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 14 && performance.now() - tap.t < 450) {
        const V = G.view; G.buildAt(G.cam.left + e.clientX * V.css / V.zoom, G.cam.top + e.clientY * V.css / V.zoom);
        refreshBuild();
      }
      tap = null;
    }
    if (e.pointerId === joyId) joyEnd();
  }
  touch.addEventListener('pointerup', tUp); touch.addEventListener('pointercancel', tUp);

  const act = $('btn-act');
  act.addEventListener('pointerdown', e => { G.audioInit(); I.act = true; I.actPressed = true; act.classList.add('on'); try { act.setPointerCapture(e.pointerId); } catch (_) { } e.preventDefault(); });
  const actUp = () => { I.act = false; act.classList.remove('on'); };
  act.addEventListener('pointerup', actUp); act.addEventListener('pointercancel', actUp);
  document.addEventListener('contextmenu', e => e.preventDefault());

  const keys = {};
  function keyMove() {
    I.mx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    I.my = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
  }
  addEventListener('keydown', e => {
    if (e.repeat) return; keys[e.code] = 1; keyMove(); G.audioInit();
    if (e.code === 'Space' || e.code === 'KeyE') { I.act = true; I.actPressed = true; e.preventDefault(); }
    else if (e.code === 'KeyI' || e.code === 'Tab') { e.preventDefault(); panel ? ui.close() : ui.openInv(); }
    else if (e.code === 'KeyC') panel ? ui.close() : ui.openCraft();
    else if (e.code === 'KeyB') ui.toggleBuild();
    else if (e.code === 'KeyQ') toggleSneak();
    else if (e.code === 'KeyH') G.quickUse('heal');
    else if (e.code === 'KeyF') G.quickUse('food');
    else if (e.code === 'Escape') G.onBack();
  });
  addEventListener('keyup', e => { keys[e.code] = 0; keyMove(); if (e.code === 'Space' || e.code === 'KeyE') I.act = false; });

  const sneakBtn = $('btn-sneak');
  function toggleSneak() { const p = G.p; if (p.dead) return; p.sneak = !p.sneak; sneakBtn.classList.toggle('on', p.sneak); G.sfx('ui'); }
  sneakBtn.addEventListener('click', toggleSneak);
  const qHeal = $('q-heal'), qFood = $('q-food');
  qHeal.addEventListener('click', () => { G.audioInit(); G.quickUse('heal'); });
  qFood.addEventListener('click', () => { G.audioInit(); G.quickUse('food'); });
  function refreshQuick() {
    const inv = G.p.inv; let heal = 0, food = 0, fi = 'canned';
    for (const s of inv) { if (!s) continue; const it = G.ITEMS[s.id]; if (it.hp > 0 && !it.food) heal += s.n; else if (it.food || it.water) { food += s.n; fi = s.id; } }
    qHeal.firstChild.src = G.ICON.bandage; qHeal.lastChild.textContent = heal || ''; qHeal.classList.toggle('empty', !heal);
    qFood.firstChild.src = G.ICON[fi]; qFood.lastChild.textContent = food || ''; qFood.classList.toggle('empty', !food);
    $('sneak-ico').src = G.ICON.ui_sneak; sneakBtn.classList.toggle('on', !!G.p.sneak);
  }
  /* ---------- HUD ---------- */
  const bHp = $('b-hp'), bFood = $('b-food'), bWater = $('b-water'), tHp = $('t-hp'), lvlN = $('lvl-n'), xpRing = $('xp-ring');
  const questT = $('quest-t'), clock = $('clock'), actIco = $('act-ico'), fpsEl = $('fps'), hurtEl = $('hurt');
  const mm = $('minimap').getContext('2d');
  let acc = 1, lastIco = '', lastHurt = -1, lastClock = '', lastQuest = '';
  ui.showFps = true;
  ui.frame = function (dt, fps) {
    const p = G.p;
    const h = p.dead ? 0.9 : Math.max(p.hurt > 0 ? p.hurt * 2.4 : 0, p.hp < p.maxhp * 0.3 ? 0.35 + Math.sin(G.time * 5) * 0.12 : 0);
    const hq = Math.round(h * 20) / 20;
    if (hq !== lastHurt) { lastHurt = hq; hurtEl.style.opacity = hq; }
    if (panel === 'inv') {   // вращающаяся модель персонажа в рюкзаке
      const dc = $('doll'); if (dc) {
        const x = dc.getContext('2d'), t = performance.now() / 1000, ws = G.bestTool('weapon');
        x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, dc.width, dc.height); x.setTransform(3, 0, 0, 3, dc.width / 2, dc.height - 22);
        G.drawHuman(x, { face: Math.PI / 2 + Math.sin(t * 0.6) * 1.3, walk: 0, mv: 0, atk: 0, hurt: 0, x: 0, armor: p.armor }, 'p', ws >= 0 ? p.inv[ws].id : null, false);
      }
    }
    acc += dt;
    if (acc < 0.2) return; acc = 0;
    bHp.style.transform = 'scaleX(' + (p.hp / p.maxhp).toFixed(3) + ')';
    bFood.style.transform = 'scaleX(' + (p.food / 100).toFixed(3) + ')';
    bWater.style.transform = 'scaleX(' + (p.water / 100).toFixed(3) + ')';
    tHp.textContent = Math.ceil(p.hp) + ' / ' + p.maxhp;
    const ico = G.build ? 'ui_hand' : G.actIcon();
    if (ico !== lastIco) { lastIco = ico; actIco.src = G.ICON[ico]; }
    const hr = (6 + G.phase * 24) % 24, ck = 'День ' + G.day + ' · ' + String(hr | 0).padStart(2, '0') + ':' + String(((hr % 1) * 6 | 0) * 10).padStart(2, '0');
    if (ck !== lastClock) { lastClock = ck; clock.textContent = ck; }
    if (ui.showFps) fpsEl.textContent = fps + ' FPS';
    // мини-карта
    const s = 144 / G.WORLD;
    mm.drawImage(G.mapBase, 0, 0);
    if (G.night > 0.05) { mm.fillStyle = 'rgba(8,12,40,' + G.night * 0.5 + ')'; mm.fillRect(0, 0, 144, 144); }
    mm.fillStyle = '#e8c46a'; mm.fillRect((G.HOME.tx - 3) * 2, (G.HOME.ty - 3) * 2, 12, 10);
    mm.fillStyle = '#5a3a1e'; mm.fillRect((G.HOME.tx - 2) * 2, (G.HOME.ty - 2) * 2, 8, 6);
    mm.fillStyle = '#ff5a3a'; for (const m of G.mobs) if (m.t !== 'd' && !m.dead) mm.fillRect(m.x * s - 1.5, m.y * s - 1.5, 3, 3);
    mm.fillStyle = '#fff'; mm.beginPath(); mm.arc(p.x * s, p.y * s, 4.5, 0, 7); mm.fill();
    mm.fillStyle = '#d42a40'; mm.beginPath(); mm.arc(p.x * s, p.y * s, 3, 0, 7); mm.fill();
    if (G.uiDirty) {
      G.uiDirty = false; refreshQuick();
      lvlN.textContent = p.lvl;
      $('lvl').style.setProperty('--xp', Math.round(100 * p.xp / G.xpNeed(p.lvl)) + '%');
      const q = G.QUESTS[G.quest], qt = q ? q.t : 'Ты освоился. Исследуй пустошь!';
      if (qt !== lastQuest) { lastQuest = qt; questT.textContent = qt; }
      if (G.build) refreshBuild();
    }
  };

  /* ---------- Окна ---------- */
  const modal = $('modal');
  function open(name) {
    if (G.build) ui.toggleBuild();
    panel = name; modal.classList.remove('hide');
    for (const el of modal.querySelectorAll('.panel')) el.classList.toggle('show', el.id === 'p-' + name);
    G.paused = true; I.act = false; joyEnd(); G.sfx('ui');
  }
  ui.close = function () {
    if (panel === 'death') return;
    panel = null; modal.classList.add('hide'); G.paused = false; chestRef = null; G.uiDirty = true; G.save();
  };
  modal.addEventListener('click', e => { if (e.target === modal || e.target.hasAttribute('data-close')) ui.close(); });

  function slotHTML(s, i, sel, attr) {
    let h = '<div class="slot' + (sel ? ' sel' : '') + '" ' + attr + '="' + i + '">';
    if (s) {
      h += '<img src="' + G.ICON[s.id] + '">';
      if (s.n > 1) h += '<span>' + s.n + '</span>';
      if (s.d !== undefined) h += '<u><s style="width:' + Math.round(s.d / G.ITEMS[s.id].dur * 100) + '%"></s></u>';
    }
    return h + '</div>';
  }
  function gridHTML(inv, attr, sel) { let h = ''; for (let i = 0; i < inv.length; i++) h += slotHTML(inv[i], i, i === sel, attr); return h; }

  // --- рюкзак ---
  function renderInv() {
    const p = G.p;
    if (selSlot >= 0 && !p.inv[selSlot]) selSlot = -1;
    $('inv-grid').innerHTML = gridHTML(p.inv, 'data-i', selSlot);
    let h = '<div class="info"><canvas id="doll" width="216" height="264"></canvas>';
    if (selSlot >= 0) {
      const s = p.inv[selSlot], it = G.ITEMS[s.id], fx = [];
      if (it.food) fx.push('Сытость +' + it.food); if (it.water) fx.push('Вода +' + it.water);
      if (it.hp) fx.push('Здоровье ' + (it.hp > 0 ? '+' : '') + it.hp);
      if (it.dmg) fx.push('Урон ' + it.dmg); if (it.dur) fx.push('Прочность ' + s.d + '/' + it.dur);
      h += '<img src="' + G.ICON[s.id] + '"><h4>' + it.n + '</h4><p>' + it.d + '</p><p>' + fx.join(' · ') + '</p>';
    } else h += '<p>Выбери предмет. Инструменты берутся в руки автоматически: топор — для деревьев, кирка — для камня, оружие — для врагов.</p>';
    h += '</div><div class="eq">Броня: ' + (p.armor ? '<b>' + G.ITEMS[p.armor].n + '</b>' : 'нет') + '</div><div class="acts">';
    if (selSlot >= 0) {
      const it = G.ITEMS[p.inv[selSlot].id];
      if (it.food || it.water || it.hp) h += '<button class="go" data-a="use">Использовать</button>';
      if (it.armor) h += '<button class="go" data-a="use">Надеть</button>';
      h += '<button data-a="drop">Выбросить</button>';
    } else if (p.armor) h += '<button data-a="unarm">Снять броню</button>';
    $('inv-side').innerHTML = h + '</div>';
  }
  ui.openInv = function () { selSlot = -1; renderInv(); open('inv'); };
  $('p-inv').addEventListener('click', e => {
    const p = G.p, sl = e.target.closest('[data-i]'), b = e.target.closest('[data-a]');
    if (sl) { const i = +sl.dataset.i; selSlot = p.inv[i] ? i : -1; G.sfx('ui'); }
    else if (b) {
      const a = b.dataset.a;
      if (a === 'use') G.useItem(selSlot);
      else if (a === 'drop') { p.inv[selSlot] = null; selSlot = -1; G.sfx('ui'); }
      else if (a === 'unarm') { if (Inv.add(p.inv, p.armor, 1) === 0) p.armor = null; }
    } else return;
    renderInv();
  });

  // --- крафт ---
  function costHTML(cost) {
    let h = '';
    for (const id in cost) { const have = Inv.count(G.p.inv, id); h += '<i class="' + (have < cost[id] ? 'no' : '') + '">' + G.ITEMS[id].n + ' ' + have + '/' + cost[id] + '</i>'; }
    return h;
  }
  function renderCraft() {
    const p = G.p, near = { campfire: G.stationNear('campfire'), workbench: G.stationNear('workbench') };
    $('craft-st').textContent = 'Рядом: ' + (near.campfire || near.workbench ? [near.campfire && 'костёр', near.workbench && 'верстак'].filter(Boolean).join(', ') : 'нет станков');
    let h = '';
    G.RECIPES.forEach((r, i) => {
      const it = G.ITEMS[r.out], st = !r.st || near[r.st], ok = st && Inv.has(p.inv, r.cost);
      h += '<div class="rc' + (ok ? '' : ' off') + '"><img src="' + G.ICON[r.out] + '"><div class="mid"><b>' + it.n + '</b><div class="cost">' + costHTML(r.cost) + '</div>' +
        (r.st && !st ? '<div class="need">Нужен ' + G.STATION_NAME[r.st] + ' рядом</div>' : '') + '</div><button data-r="' + i + '">Создать</button></div>';
    });
    $('craft-list').innerHTML = h;
  }
  ui.openCraft = function () { renderCraft(); open('craft'); };
  $('craft-list').addEventListener('click', e => {
    const b = e.target.closest('[data-r]'); if (!b) return;
    const p = G.p, r = G.RECIPES[+b.dataset.r];
    if ((r.st && !G.stationNear(r.st)) || !Inv.has(p.inv, r.cost)) { G.sfx('deny'); return; }
    Inv.pay(p.inv, r.cost);
    if (Inv.add(p.inv, r.out, r.n) > 0) { for (const id in r.cost) Inv.add(p.inv, id, r.cost[id]); G.sfx('deny'); return; }
    G.sfx('craft'); G.addXp(5); renderCraft();
  });

  // --- сундук ---
  function renderChest() { $('chest-grid').innerHTML = gridHTML(chestRef.inv, 'data-c', -1); $('chest-inv').innerHTML = gridHTML(G.p.inv, 'data-i', -1); }
  function moveStack(from, i, to) {
    const s = from[i]; if (!s) return;
    const left = Inv.add(to, s.id, s.n, s.d);
    if (left <= 0) from[i] = null; else s.n = left;
    G.sfx(left === s.n ? 'deny' : 'ui');
  }
  ui.openChest = function (s) { chestRef = s; renderChest(); open('chest'); };
  $('p-chest').addEventListener('click', e => {
    const c = e.target.closest('[data-c]'), i = e.target.closest('[data-i]');
    if (c) moveStack(chestRef.inv, +c.dataset.c, G.p.inv); else if (i) moveStack(G.p.inv, +i.dataset.i, chestRef.inv); else return;
    renderChest();
  });

  // --- меню и смерть ---
  const QN = ['авто', 'высокая', 'средняя', 'низкая'];
  function renderMenu() {
    const m = $('p-menu');
    m.querySelector('[data-m=sound]').textContent = 'Звук: ' + (G.soundOn ? 'вкл' : 'выкл');
    m.querySelector('[data-m=quality]').textContent = 'Графика: ' + QN[G.qMode];
    m.querySelector('[data-m=fps]').textContent = 'Счётчик FPS: ' + (ui.showFps ? 'вкл' : 'выкл');
    m.querySelector('[data-m=new]').textContent = confirmNew ? 'Точно? Нажми ещё раз' : 'Новая игра';
  }
  ui.openMenu = function () { confirmNew = 0; renderMenu(); open('menu'); };
  modal.addEventListener('click', e => {
    const b = e.target.closest('[data-m]'); if (!b) return;
    const m = b.dataset.m;
    if (m === 'resume') return ui.close();
    if (m === 'sound') G.soundOn = !G.soundOn;
    else if (m === 'quality') G.setQuality((G.qMode + 1) % 4);
    else if (m === 'fps') { ui.showFps = !ui.showFps; fpsEl.textContent = ''; }
    else if (m === 'new') { if (confirmNew) { G.resetGame(); panel = null; modal.classList.add('hide'); G.paused = false; return; } confirmNew = 1; }
    else if (m === 'respawn') { G.respawn(); panel = null; modal.classList.add('hide'); G.paused = false; G.save(); return; }
    G.saveSettings(); renderMenu();
  });
  ui.showDeath = function () {
    $('death-t').textContent = 'Ты продержался ' + G.day + ' ' + (G.day === 1 ? 'день' : G.day < 5 ? 'дня' : 'дней') + '. Вещи останутся при тебе.';
    open('death');
  };

  /* ---------- Строительство ---------- */
  const blist = $('build-list'), bdemo = $('build-demo'), SHORT = { wood: 'дер', stone: 'кам', rope: 'вер', stick: 'пал' };
  function refreshBuild() {
    const b = G.build; if (!b) return;
    let h = '';
    G.BUILD.forEach((d, i) => {
      const ok = Inv.has(G.p.inv, d.cost), c = Object.keys(d.cost).map(id => d.cost[id] + ' ' + SHORT[id]).join(' · ');
      h += '<button class="bpiece' + (!b.demolish && b.def === d ? ' sel' : '') + (ok ? '' : ' no') + '" data-b="' + i + '"><img src="' + G.ICON[d.k] + '"><b>' + d.n + '</b><small>' + c + '</small></button>';
    });
    blist.innerHTML = h; bdemo.classList.toggle('sel', !!b.demolish);
    $('build-hint').textContent = b.demolish ? 'Нажми на постройку, чтобы снести её' : 'Нажми на клетку рядом с собой, чтобы построить';
  }
  ui.toggleBuild = function () {
    if (G.build) { G.build = null; document.body.classList.remove('building'); G.save(); }
    else { G.build = { def: G.BUILD[0], demolish: false, ht: 0, hx: 0, hy: 0, ok: false }; document.body.classList.add('building'); refreshBuild(); }
    I.act = false; G.sfx('ui');
  };
  blist.addEventListener('click', e => { const b = e.target.closest('[data-b]'); if (!b) return; G.build.def = G.BUILD[+b.dataset.b]; G.build.demolish = false; G.sfx('ui'); refreshBuild(); });
  bdemo.addEventListener('click', () => { G.build.demolish = !G.build.demolish; G.sfx('ui'); refreshBuild(); });
  $('build-close').addEventListener('click', ui.toggleBuild);

  $('btn-bag').addEventListener('click', ui.openInv);
  $('btn-craft').addEventListener('click', ui.openCraft);
  $('btn-build').addEventListener('click', ui.toggleBuild);
  $('btn-menu').addEventListener('click', ui.openMenu);

  // кнопка «назад» на Android
  G.onBack = function () {
    if (!$('title').classList.contains('hide')) return;
    if (panel) ui.close(); else if (G.build) ui.toggleBuild(); else ui.openMenu();
  };
  ui.isOpen = () => !!panel;
})();
