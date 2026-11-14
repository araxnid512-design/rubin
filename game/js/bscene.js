'use strict';
/* Сцена тактического боя: ввод и интерфейс */
(function (DW) {
  const U = DW.U, D = DW.D, el = U.el;
  const BS = {};
  let B = null, sel = null, mode = 'idle', kindA = null;
  let reachC = null, preview = null, targets = [], tIdx = 0, aoe = null, allies = [];
  let busy = false;
  let hud = null;
  const ic = function (n) { return D.icon(n); };
  function BT() { return DW.BT; }

  BS.enter = function (battle) {
    B = battle; busy = false; mode = 'idle'; sel = null; preview = null; finishing = false;
    if (DW.pickRenderer) DW.pickRenderer();
    DW.TR.init(B);
    buildHud();
    window.removeEventListener('resize', onResize); window.addEventListener('resize', onResize);
    selectNext(true);
    BS.refresh();
    const st = DW.G.state;
    if (!st.flags.tutBattle) {
      st.flags.tutBattle = true;
      DW.UI.modal({
        title: 'Бой', cls: 'small', body: '<div class="ptext">' +
          '• Нажмите на бойца, чтобы выбрать его. У каждого <b>2 очка действия</b>.<br>' +
          '• Нажмите клетку в <span style="color:#6ebeff">синей</span> зоне (1 ОД) или <span style="color:#ffcd50">жёлтой</span> (2 ОД), затем <b>ещё раз</b> — для перемещения.<br>' +
          '• Щиты у клетки — укрытие: половинное или полное. Стойте за укрытиями!<br>' +
          '• <b>Огонь</b> завершает ход бойца. <b>Дозор</b> — стрелять по первому, кто шевельнётся.<br>' +
          '• Двигайте карту пальцем, масштаб — двумя пальцами.</div>',
        buttons: [{ text: 'К бою', cls: 'primary' }]
      });
    } else {
      banner('Ваш ход');
    }
    if (B.turn === 1 && (B.tod !== 'day' || B.weather !== 'clear')) setTimeout(function () { DW.UI.toast(BT().condText(B), B.sightMod ? 'alert' : ''); }, 1650);
    // обучение: первый бой за Порталом — подсказки по шагам
    if (!st.flags.tut51 && st.stats.missions === 0 && B.kind === 'normal' && B.turn === 1) { B.tut = 0; setTimeout(function () { tut('start'); }, 900); }
    else if (B.tut !== undefined && B.tut !== null) setTimeout(function () { tutShow(B.tut); }, 900);
    const B0 = B;
    if (B.turn === 1 && B.concealed) setTimeout(function () { if (B !== B0 || !B.concealed) return; DW.UI.toast('Отряд скрыт. Оранжевые клетки — зона, где враг заметит бойца. Первый выстрел — из засады.', ''); }, 3200);
  };
  BS.exit = function () { window.removeEventListener('resize', onResize); document.getElementById('ui').innerHTML = ''; DW.TR.overlay = null; hud = null; if (DW.R3 && DW.R3.show) DW.R3.show(false); };
  BS.update = function (dt) { DW.TR.update(dt); };
  BS.render = function (g, w, h, dpr) { DW.TR.render(g, w, h, dpr); };
  BS.pan = function (dx, dy) { DW.TR.pan(dx, dy); };
  BS.zoomAt = function (f, x, y) { DW.TR.zoomAt(f, x, y); };
  BS.back = function () {
    if (mode !== 'idle') { cancelMode(); return; }
    if (!busy) openMenu();
  };
  BS.isBusy = function () { return busy; };
  BS.idle = function () { return !DW.TR.isAnimating(); };

  /* ---------- Интерфейс ---------- */
  function buildHud() {
    const ui = document.getElementById('ui');
    ui.innerHTML = '';
    hud = {};
    hud.tl = el('div', { class: 'b-tl' });
    hud.obj = el('div', { class: 'b-obj' });
    hud.squad = el('div', { class: 'b-squad' });
    hud.tl.appendChild(hud.obj); hud.tl.appendChild(hud.squad);
    hud.tr = el('div', { class: 'b-tr' });
    hud.res = el('div', { class: 'b-res' });
    hud.menuBtn = el('button', { class: 'ibtn', html: D.ICONS.menu, onclick: function () { if (!busy) openMenu(); } });
    hud.tr.appendChild(hud.res);
    // 3D: поворот поля на 90°
    if (DW.TR.is3d) {
      hud.tr.appendChild(el('button', { class: 'ibtn rot', title: 'Повернуть', text: '⟲', onclick: function () { DW.SFX.play('click'); DW.TR.rotate(-1); } }));
      hud.tr.appendChild(el('button', { class: 'ibtn rot', title: 'Повернуть', text: '⟳', onclick: function () { DW.SFX.play('click'); DW.TR.rotate(1); } }));
    }
    hud.tr.appendChild(hud.menuBtn);
    hud.bot = el('div', { class: 'b-bot' });
    hud.actions = el('div', { class: 'b-actions' });
    hud.right = el('div', { class: 'b-right' });
    hud.next = el('button', { class: 'abtn', html: '<span class="ico">' + D.ICONS.next + '</span><span>След.</span>', onclick: function () { if (!busy) { DW.SFX.play('click'); selectNext(false); BS.refresh(); } } });
    hud.end = el('button', { class: 'abtn endturn', html: '<span class="ico">' + D.ICONS.endturn + '</span><span>Конец хода</span>', onclick: function () { if (!busy) endTurn(); } });
    hud.right.appendChild(hud.next); hud.right.appendChild(hud.end);
    hud.bot.appendChild(hud.actions); hud.bot.appendChild(hud.right);
    hud.unit = el('div', { class: 'b-sel' });
    hud.panel = el('div', { class: 'b-panel hidden' });
    hud.banner = el('div', { class: 'b-banner' });
    hud.hint = el('div', { class: 'b-hint' });
    ui.appendChild(hud.tl); ui.appendChild(hud.tr); ui.appendChild(hud.bot); ui.appendChild(hud.unit); ui.appendChild(hud.panel); ui.appendChild(hud.banner); ui.appendChild(hud.hint);
  }
  function rosterOf(u) { return DW.G.state.roster.find(function (s) { return s.id === u.sid; }); }
  function renderSquad() {
    hud.squad.innerHTML = '';
    B.units.forEach(function (u) {
      if (u.kind !== 'soldier') return;
      const s = rosterOf(u);
      const it = el('div', {
        class: 'sq' + (u === sel ? ' on' : '') + (!u.alive ? ' dead' : '') + (u.evac ? ' evac' : '') + (u.alive && !u.evac && u.ap <= 0 ? ' spent' : ''),
        onclick: function () { if (!busy && u.alive && !u.evac && B.phase === 'player' && mode === 'idle') { DW.SFX.play('click'); select(u); } }
      });
      it.appendChild(el('img', { src: s ? DW.ART.portrait(s, u.hp <= u.maxHp * 0.35 ? 2 : (u.hp < u.maxHp * 0.75 ? 1 : 0)) : '', alt: '' }));
      const info = el('div', { class: 'sq-i' });
      const pct = Math.round(u.hp / u.maxHp * 100);
      info.innerHTML = '<div class="sq-hp' + (pct <= 34 ? ' low' : '') + '"><i style="width:' + pct + '%"></i></div>' +
        '<div class="sq-ap">' + (u.alive && !u.evac ? pips(u.ap, Math.max(2, u.ap), 'ap') : (u.evac ? '<span class="good">эвак.</span>' : (u.stable ? '<span class="good">спасён</span>' : (u.down > 0 ? '<span class="bad">кровь ' + (u.down - 1) + ' х.</span>' : '<span class="bad">погиб</span>')))) +
        (u.overwatch ? '<b class="ow">👁</b>' : '') + '</div>';
      it.appendChild(info);
      hud.squad.appendChild(it);
    });
  }
  function banner(text, stay) {
    if (!hud) return;
    hud.banner.textContent = text;
    hud.banner.className = 'b-banner show';
    clearTimeout(banner.t);
    if (!stay) banner.t = setTimeout(function () { if (hud) hud.banner.className = 'b-banner'; }, 1300);
  }
  function hideBanner() { if (hud) hud.banner.className = 'b-banner'; }
  function hint(text) { if (hud) { hud.hint.innerHTML = text || ''; hud.hint.style.display = text ? '' : 'none'; } }

  function pips(n, max, cls) {
    let s = '<span class="pips ' + (cls || '') + '">';
    for (let i = 0; i < max; i++) s += '<i class="' + (i < n ? 'on' : '') + '"></i>';
    return s + '</span>';
  }
  function healTargets(u) {
    return BT().soldiers().filter(function (a) { return a.hp < a.maxHp && Math.max(Math.abs(a.x - u.x), Math.abs(a.y - u.y)) <= 1; });
  }
  const SHORT = { 'Подавление': 'Подавить', 'Прицельный выстрел': 'Прицел', 'Полевая медицина': 'Лечить', 'Двойной выстрел': 'Дуплет', 'Эвакуация': 'Эвак.', 'За отвагу': 'Отвага' };
  function actionList(u) {
    const st = DW.G.state;
    const W = D.WEAPONS[u.weapon];
    const tg = BT().targetsFor(u);
    const list = [];
    const canFire = u.ap >= 1 && u.clip > 0 && st.res.ammo > 0;
    list.push({ id: 'shoot', icon: 'shoot', label: 'Огонь', on: canFire && tg.length > 0, note: !u.clip ? 'пусто' : (st.res.ammo <= 0 ? 'нет патр.' : '') });
    // совместные действия: залп с соседом по одной цели, прикрытие товарища
    const vp = BT().volleyPartner(u);
    if (vp && tg.length) list.push({ id: 'volley', icon: 'volley', label: 'Залп', on: canFire && BT().volleyTargets(u, vp).length > 0 });
    if (BT().guardTargets(u).length) list.push({ id: 'guard', icon: 'guard', label: 'Прикрыть', on: u.ap >= 1 && u.clip > 0 });
    const ab = D.CLASSES[u.cls].ab, A = D.ABIL[ab], cd = u.cd[ab] || 0;
    let on = false;
    if (u.ap >= 1 && !cd) {
      if (ab === 'order') on = BT().soldiers().some(function (a) { return a !== u && a.ap < 3 && BT().canSee(u, a); });
      else if (ab === 'suppress') on = canFire && tg.length > 0;
      else if (ab === 'rush') on = true;
      else if (ab === 'aimed' || ab === 'double') on = u.ap >= 2 && canFire && tg.length > 0;
    }
    if (ab === 'heal') on = u.ap >= 1 && u.charges.heal > 0 && healTargets(u).length > 0;
    if (ab === 'mine') {
      // сапёр: мины, потом — растяжки из гранат
      const trip = !(u.charges.mine > 0);
      on = u.ap >= 1 && BT().canMine(u) && BT().mineSpots(u).length > 0;
      list.push({ id: 'ability', icon: 'mine', label: trip ? 'Растяжка' : A.n, on: on, count: trip ? st.res.grenades : u.charges.mine, ab: ab });
    } else list.push({ id: 'ability', icon: ab, label: A.n, on: on, cd: cd, count: ab === 'heal' ? u.charges.heal : null, ab: ab });
    if (BT().defuseSpots(u).length) list.push({ id: 'defuse', icon: 'defuse', label: 'Разминир.', on: u.ap >= 1 });
    if (BT().breachSpots(u).length) list.push({ id: 'breach', icon: 'tnt', label: 'Подрыв', on: u.ap >= 1, count: u.charges.tnt });
    // пулемёт на крыше УАЗа — боец рядом с машиной
    if (BT().uazGunner(u) && tg.length) list.push({ id: 'uazmg', icon: 'uazmg', label: 'Турель', on: u.ap >= 1 && st.res.ammo > 0, count: B.uazBelt });
    list.push({ id: 'overwatch', icon: 'overwatch', label: 'Дозор', on: canFire });
    list.push({ id: 'reload', icon: 'reload', label: 'Перезар.', on: u.ap >= 1 && u.clip < W.clip });
    // расходники, которых нет, — без кнопки: меньше кнопок в ряду на телефоне
    if (st.res.grenades > 0) list.push({ id: 'grenade', icon: 'throwg', label: 'Граната', on: u.ap >= 1, count: st.res.grenades });
    if (u.cls === 'heavy' && st.res.rockets > 0) list.push({ id: 'rocket', icon: 'rpg', label: 'РПГ', on: u.ap >= 1, count: st.res.rockets });
    if (st.res.meds > 0) list.push({ id: 'medkit', icon: 'medkit', label: 'Аптечка', on: u.ap >= 1 && healTargets(u).length > 0, count: st.res.meds });
    const mt = BT().meleeTargets(u);
    if (mt.length) list.push({ id: 'butt', icon: 'butt', label: 'Приклад', on: u.ap >= 1 });
    const dn = BT().downedNear(u);
    if (dn.length) list.push({ id: 'stabilize', icon: 'medkit', label: 'Спасти', on: u.ap >= 1 && (st.res.meds > 0 || (u.cls === 'medic' && u.charges && u.charges.heal > 0)), note: st.res.meds > 0 || (u.cls === 'medic' && u.charges && u.charges.heal > 0) ? '' : 'нет аптечек' });
    if (B.kind === 'defense' && BT().repairSpot && BT().repairSpot(u)) list.push({ id: 'repair', icon: 'materials', label: 'Чинить', on: u.ap >= 1 && st.res.materials >= 2, note: st.res.materials >= 2 ? '' : 'нет мат.' });
    list.push({ id: 'crouch', icon: u.crouch ? 'stand' : 'crouch', label: u.crouch ? 'Встать' : 'Присесть', on: true });
    list.push({ id: 'hunker', icon: 'hunker', label: 'Залечь', on: u.ap >= 1 });
    if (B.evac.length) list.push({ id: 'evac', icon: 'evac', label: 'Эвакуация', on: u.ap >= 1 && BT().isEvacTile(u.x, u.y) });
    return list;
  }

  BS.refresh = function () {
    if (!hud || !B) return;
    const st = DW.G.state;
    hud.obj.innerHTML = '<b>Ход ' + B.turn + '</b> · ' + B.objective + '<div class="cond">' + BT().condText(B) + '</div>' +
      (B.concealed ? '<div class="cond conceal">Отряд скрыт · засада: +15 к меткости</div>' : '') +
      (B.reinf ? '<div class="cond reinf">Подкрепление врага на подходе!</div>' : '') +
      (B.kind === 'defense' ? '<div class="cond">Удар ' + (DW.G.DIRN[B.dir] || 'с востока') + (B.searchlight ? ' · прожектор вышки светит туда' : '') + (B.relief ? ' · отряд на УАЗе будет на ' + B.relief.turn + '-м ходу' : '') +
        (B.mines && Object.keys(B.mines).length ? ' · мин: ' + Object.keys(B.mines).length : '') + '</div>' : '');
    if (B.dark) {
      // фонари: видно дальше, но и вас видно издалека
      const lb = document.createElement('button');
      lb.className = 'btn sm lightbtn' + (B.lights ? ' on' : '');
      lb.textContent = 'Фонари: ' + (B.lights ? 'вкл (обзор +2, заметны)' : 'выкл (скрытно)');
      lb.onclick = function (e) { e.stopPropagation(); if (B.phase !== 'player' || busy) return; BT().toggleLights(); dzKey = ''; BS.refresh(); };
      hud.obj.appendChild(lb);
    }
    hud.res.innerHTML = '<span>' + ic('ammo') + st.res.ammo + '</span><span>' + ic('grenades') + st.res.grenades + '</span><span>' + ic('meds') + st.res.meds + '</span>' +
      (st.res.rockets ? '<span>' + ic('rockets') + st.res.rockets + '</span>' : '') + '<span class="gemc">' + ic('gems') + (B.loot.gems || 0) + '</span>';
    renderSquad();
    if (B.tut !== undefined && B.tut !== null && B.tut < 3 && B.units.some(function (e) { return e.side === 'e' && e.alive && e.seen; })) tut('contact');
    if (sel && sel.alive && !sel.evac && B.phase === 'player') {
      const W = D.WEAPONS[sel.weapon];
      const c = D.CLASSES[sel.cls];
      hud.unit.innerHTML = '<b style="color:' + c.color + '">' + sel.name + '</b> <small>' + c.n + ' · ' + D.RANKS[sel.rank || 0].n + '</small>' +
        '<span class="sep"></span>' + DW.UI.hpBar(sel.hp, sel.maxHp) +
        '<span class="sep"></span><span class="dim">ОД</span>' + pips(sel.ap, Math.max(2, sel.ap), 'ap') +
        '<span class="sep"></span><img class="wico" src="' + DW.ART.weaponIcon(sel.weapon) + '" alt="" title="' + W.n + '"><span class="dim">' + (W.s || W.n) + '</span>' + pips(sel.clip, W.clip, 'clip');
      hud.unit.style.display = '';
    } else hud.unit.style.display = 'none';
    // действия
    hud.actions.innerHTML = '';
    if (sel && sel.alive && !sel.evac && B.phase === 'player') {
      const short = window.innerHeight <= 430;   // телефон: короткие подписи, чтобы влезали в узкие кнопки
      actionList(sel).forEach(function (a) {
        const b = el('button', {
          class: 'abtn' + (a.on ? '' : ' off') + (a.id === 'ability' ? ' abil' : ''), title: a.label,
          html: '<span class="ico">' + (D.ICONS[a.icon] || '') + '</span><span>' + (short && SHORT[a.label] || a.label) + '</span>' +
            (a.cd ? '<em class="cd">' + a.cd + '</em>' : '') + (a.count !== null && a.count !== undefined ? '<em class="cnt">' + a.count + '</em>' : '') +
            (a.note ? '<em class="note">' + a.note + '</em>' : ''),
          onclick: function () { if (!busy && a.on) { DW.SFX.play('click'); doAction(a); } else if (!busy) explainOff(a); }
        });
        hud.actions.appendChild(b);
      });
    }
    layoutBottom();
    hud.end.disabled = busy || B.phase !== 'player';
    hud.next.disabled = busy || B.phase !== 'player';
    hud.menuBtn.disabled = busy;
    if (!busy && sel && sel.alive && sel.ap > 0 && mode === 'idle') {
      reachC = BT().reach(sel, (sel.ap >= 2 ? 2 : 1) * sel.mob);
    } else if (mode === 'idle') reachC = null;
    refreshOverlay();
    refreshPanel();
    if (!busy && mode === 'idle') {
      if (preview) hint('Нажмите ещё раз, чтобы идти (' + preview.cost + ' ОД)');
      else if (sel && sel.ap > 0) hint('');
      else hint('');
    }
  };
  /* нижняя панель на телефоне: кнопки в одну строку правее портретов отряда (не налезают на них), ширина кнопок —
     по месту; полоска выбранного бойца и подсказка — над кнопками, по центру ряда */
  function layoutBottom() {
    if (!hud || !hud.actions) return;
    const vh = window.innerHeight;
    const sr = hud.squad.getBoundingClientRect();
    const btnH = vh <= 430 ? 50 : 54;
    const padL = sr.height > 0 && sr.bottom > vh - btnH - 12 ? Math.ceil(sr.right) + 6 : 0;
    hud.bot.style.paddingLeft = padL ? padL + 'px' : '';
    const kids = hud.actions.children, n = kids.length;
    const base = vh <= 430 ? 52 : 58;
    if (n) {
      const avail = hud.actions.clientWidth;
      const w = Math.max(36, Math.min(base, Math.floor((avail - (n - 1) * 4) / n)));
      hud.actions.classList.toggle('tight', w < base - 5);
      for (let i = 0; i < n; i++) kids[i].style.width = w + 'px';
    }
    const ar = hud.actions.getBoundingClientRect();
    if (ar.width > 0) {
      hud.unit.style.left = Math.round(ar.left + ar.width / 2) + 'px';
      hud.unit.style.maxWidth = Math.round(ar.width) + 'px';
      hud.unit.style.bottom = Math.round(vh - ar.top + 6) + 'px';
      hud.hint.style.left = hud.unit.style.left;
      hud.hint.style.bottom = Math.round(vh - ar.top + 38) + 'px';
    }
  }
  function onResize() { if (hud) setTimeout(layoutBottom, 60); }
  function explainOff(a) {
    const msg = {
      shoot: 'Нет целей в поле зрения, пустая обойма или кончились патроны.',
      ability: a.cd ? 'Способность перезаряжается: ' + a.cd + ' ход.' : D.ABIL[a.ab] ? D.ABIL[a.ab].desc : '',
      overwatch: 'Нужен хотя бы 1 ОД и патроны в обойме.',
      reload: 'Обойма полна.',
      grenade: 'Гранат нет.',
      rocket: 'Ракет нет. Закажите через Портал.',
      medkit: 'Нет аптечек или раненых рядом.',
      evac: 'Эвакуироваться можно только из зелёной зоны.',
      hunker: ''
    }[a.id];
    if (msg) DW.UI.toast(msg);
  }

  let owzSrc = null, owzC = null, dzKey = '', dzC = null;
  // зона обнаружения при скрытности (пересчёт, только когда враги сдвинулись)
  function detectZone() {
    if (!B.concealed) return null;
    let k = '';
    B.units.forEach(function (e) { if (e.side === 'e' && e.alive && !e.active && e.seen) k += e.id + ':' + e.x + ',' + e.y + ';'; });
    if (k !== dzKey) { dzKey = k; dzC = BT().detectZone(); }
    return dzC;
  }
  // метки мин: свои (зелёные) и замеченные вражеские (красные)
  function minesMarks() {
    const out = [];
    for (const k in (B.mines || {})) out.push([+k % B.w, (+k / B.w) | 0, 1]);
    for (const k in (B.eminesSeen || {})) if (B.emines && B.emines[k]) out.push([+k % B.w, (+k / B.w) | 0, 0]);
    return out.length ? out : null;
  }
  function refreshOverlay() {
    if (!B) return;
    const st = sel && sel.alive ? sel : null;
    DW.TR.overlay = {
      sel: st,
      reach: mode === 'idle' && !busy && st && st.ap > 0 ? reachC : null,
      m1: st ? st.mob : 0, m2: st ? (st.ap >= 2 ? st.mob * 2 : st.mob) : 0,
      path: preview ? preview.path : null, pathDash: preview && preview.cost > 1,
      shields: preview ? preview.shields : null, seeMarks: preview ? preview.marks : null,
      targets: mode === 'target' ? targets : null, target: mode === 'target' && targets[tIdx] ? targets[tIdx].u : null,
      aoe: mode === 'throw' ? aoe : null, allies: mode === 'ally' ? allies : null,
      owz: mode === 'idle' && !busy && st && st.ap > 0 && reachC ? (owzSrc === reachC ? owzC : (owzSrc = reachC, owzC = BT().owZone(reachC))) : null,
      dz: detectZone(),
      mines: minesMarks()
    };
  }
  function refreshPanel() {
    const p = hud.panel;
    if (mode === 'idle' || busy) { p.className = 'b-panel hidden'; return; }
    p.className = 'b-panel';
    p.innerHTML = '';
    if (mode === 'target') {
      const t = targets[tIdx];
      if (!t) { cancelMode(); return; }
      const info = shotInfo(kindA, sel, t.u);
      const W = D.WEAPONS[kindA === 'uazmg' ? 'lmg' : sel.weapon];
      const lbl = { shoot: 'Огонь', aimed: 'Прицельный', double: 'Двойной ×2', suppress: 'Подавить', uazmg: 'Очередь', volley: 'Залп' }[kindA];
      p.appendChild(el('div', { class: 't-head', html: '<img src="' + DW.ART.enemyPortrait(t.u.type, t.u) + '" alt=""><div class="t-name">' + t.u.name + '<small>ОЗ ' + t.u.hp + '/' + t.u.maxHp + (t.u.armor ? ' · броня ' + t.u.armor : '') + '</small></div>' }));
      if (kindA === 'suppress') {
        p.appendChild(el('div', { class: 't-hit', html: 'Цель получит <b>−40</b> к меткости в свой ход.' }));
      } else {
        p.appendChild(el('div', { class: 't-hit', html: '<b class="big">' + info.hit + '%</b> попадание<br>крит ' + info.crit + '% · урон ' + W.dmg[0] + '–' + W.dmg[1] +
          (info.flanked ? ' · <span class="acc">фланг!</span>' : (info.cover === 0 ? ' · <span class="acc">без укрытия</span>' : '')) }));
        p.appendChild(el('div', { class: 't-parts', html: info.parts.map(function (x) { return x[0] + ' <b>' + (x[1] > 0 && x[0] !== 'Меткость' ? '+' : '') + x[1] + '</b>'; }).join(' · ') }));
      }
      const row = el('div', { class: 't-btns' });
      if (targets.length > 1) row.appendChild(el('button', { class: 'btn sm', text: '◀', onclick: function () { tIdx = (tIdx + targets.length - 1) % targets.length; focusTarget(); } }));
      row.appendChild(el('button', { class: 'btn primary fire', text: lbl, onclick: confirmFire }));
      if (targets.length > 1) row.appendChild(el('button', { class: 'btn sm', text: '▶', onclick: function () { tIdx = (tIdx + 1) % targets.length; focusTarget(); } }));
      row.appendChild(el('button', { class: 'btn sm', html: D.ICONS.close, onclick: cancelMode }));
      p.appendChild(row);
    } else if (mode === 'throw') {
      const rk = kindA === 'rocket', sap = kindA === 'mine' || kindA === 'breach';
      const trip = kindA === 'mine' && !(sel.charges.mine > 0);
      p.appendChild(el('div', { class: 't-name', text: sap ? (kindA === 'mine' ? (trip ? 'Растяжка (тратит гранату)' : 'Мина') : 'Подрыв стены') : (rk ? 'Выстрел из РПГ' : 'Граната') }));
      p.appendChild(el('div', { class: 't-hit', html: sap ? (kindA === 'mine' ? 'Враг, наступивший на клетку, подорвётся: урон 3–5 вокруг. Враг о ней не знает. 1 ОД.' : 'Заряд пробивает стену или укрытие насквозь — новый проход. Завершает ход.') + '<br>Выберите клетку рядом с бойцом.' :
        (rk ? 'Урон 5–8, радиус 2, разрушает укрытия.' : 'Урон 3–5, радиус 1.5, разрушает лёгкие укрытия.') + '<br>Выберите клетку (дальность ' + aoe.range + ').' }));
      const row = el('div', { class: 't-btns' });
      const go = el('button', { class: 'btn primary fire', text: sap ? (kindA === 'mine' ? 'Поставить' : 'Взорвать') : (rk ? 'Пуск!' : 'Бросить'), onclick: confirmThrow });
      if (aoe.x === undefined) go.disabled = true;
      row.appendChild(go);
      row.appendChild(el('button', { class: 'btn sm', html: D.ICONS.close, onclick: cancelMode }));
      p.appendChild(row);
    } else if (mode === 'ally') {
      const txt = { order: 'Приказ: выберите бойца (+1 ОД)', heal: 'Полевая медицина: выберите бойца (+5 ОЗ)', medkit: 'Аптечка: выберите бойца (+4 ОЗ)' }[kindA];
      p.appendChild(el('div', { class: 't-name', text: txt }));
      const row = el('div', { class: 't-btns' });
      allies.forEach(function (a) { row.appendChild(el('button', { class: 'btn sm', text: a.name, onclick: function () { applyAlly(a); } })); });
      row.appendChild(el('button', { class: 'btn sm', html: D.ICONS.close, onclick: cancelMode }));
      p.appendChild(row);
    }
  }
  function shotInfo(kind, u, t) {
    if (kind === 'uazmg') return BT().uazShotInfo(u, t);
    const o = kind === 'aimed' ? { aimBonus: 20, critBonus: 25, aimLabel: 'Прицел' } : (kind === 'double' ? { aimBonus: -15, aimLabel: 'Двойной' } : (kind === 'volley' ? { aimBonus: 10, aimLabel: 'Совместный залп' } : {}));
    return BT().shotInfo(u, t, o);
  }

  /* ---------- Выбор ---------- */
  /* ---------- Обучение (первый бой) ---------- */
  const TUT = [
    'Первый день за Порталом. Крут: «Не толпимся. По одному». <b>Нажмите на бойца</b> — на поле или на портрет слева.',
    'Синие клетки — шаг (1 ОД), жёлтые — бросок (2 ОД). Значок щита у клетки — укрытие. <b>Нажмите клетку у укрытия</b>, затем ещё раз — идти.',
    'Так. «<b>Присесть</b>» — по вам труднее попасть, «<b>Залечь</b>» — ещё труднее, но ход кончен. Подведите остальных к укрытиям и ищите врага.',
    'Контакт! Выберите бойца и нажмите «<b>Огонь</b>» — увидите шанс попадания. Враг без укрытия с вашей стороны — шанс крита больше.',
    'Кто не стрелял — в «<b>Дозор</b>»: выстрелит по первому, кто шевельнётся. Двое рядом могут дать «<b>Залп</b>», а «<b>Прикрыть</b>» защитит товарища.',
    'Все сходили — «<b>Конец хода</b>». Противник ходит после вас; кнопка «Быстрее» ускорит его ход.',
    'Дальше — сами. Берегите людей: погибшие не возвращаются. Раненого можно спасти аптечкой за три хода.'
  ];
  const TUT_AT = { start: 0, select: 1, move: 2, contact: 3, shoot: 4, ow: 5, end: 6 };
  function tut(key) {
    if (!B || B.tut === undefined || B.tut === null) return;
    const i = TUT_AT[key];
    if (i === undefined || (i <= B.tut && key !== 'start')) return;
    B.tut = i; tutShow(i);
    if (i === TUT.length - 1) { DW.G.state.flags.tut51 = true; setTimeout(function () { if (B && B.tut === i) { B.tut = null; tutShow(null); } }, 9000); }
  }
  function tutShow(i) {
    if (!hud) return;
    if (!hud.tut) {
      hud.tut = el('div', { class: 'b-tut' });
      document.getElementById('ui').appendChild(hud.tut);
    }
    if (i === null || i === undefined) { hud.tut.style.display = 'none'; return; }
    hud.tut.style.display = '';
    hud.tut.innerHTML = '<div class="tt">' + TUT[i] + '</div>';
    const sk = el('button', { class: 'btn sm ghost', text: i === TUT.length - 1 ? 'Понятно' : 'Пропустить обучение', onclick: function (e) { e.stopPropagation(); DW.G.state.flags.tut51 = true; B.tut = null; tutShow(null); } });
    hud.tut.appendChild(sk);
  }
  function select(u, noFocus) {
    sel = u; mode = 'idle'; preview = null;
    if (u && u.kind === 'soldier') tut('select');
    if (!noFocus) DW.TR.focusOn(u.x, u.y, false);
    BS.refresh();
  }
  function selectNext(first) {
    const list = BT().soldiers();
    if (!list.length) { sel = null; return; }
    const withAp = list.filter(function (u) { return u.ap > 0; });
    const pool = withAp.length ? withAp : list;
    let i = sel ? pool.indexOf(sel) : -1;
    const next = pool[(i + 1) % pool.length];
    if (first) select(pool[0], false);
    else select(next, false);
  }
  function cancelMode() { mode = 'idle'; targets = []; aoe = null; allies = []; BS.refresh(); }

  /* ---------- Ввод ---------- */
  BS.tap = function (sx, sy) {
    if (busy || !B || B.phase !== 'player' || B.over || DW.UI.hasModal()) return;
    const t = DW.TR.screenToTile(sx, sy);
    let tx = t[0], ty = t[1];
    const picked = DW.TR.pickUnit(sx, sy);
    if (picked && (mode !== 'throw')) { tx = picked.x; ty = picked.y; }
    if (!BT().inb(tx, ty)) return;
    const u = BT().unitAt(tx, ty);
    if (mode === 'target') {
      if (u && u.side === 'e') {
        const i = targets.findIndex(function (x) { return x.u === u; });
        if (i >= 0) { if (i === tIdx) confirmFire(); else { tIdx = i; DW.SFX.play('click'); focusTarget(); } }
        return;
      }
      if (u && u.kind === 'soldier') { cancelMode(); select(u); }
      return;
    }
    if (mode === 'throw') {
      if (aoe.spots && !aoe.spots.some(function (q) { return q[0] === tx && q[1] === ty; })) { DW.UI.toast(kindA === 'mine' ? 'Сюда мину не поставить' : 'Нужна стена или укрытие рядом'); return; }
      if (U.dist(sel.x, sel.y, tx, ty) <= aoe.range + 0.01) {
        if (aoe.x === tx && aoe.y === ty) confirmThrow();
        else { aoe.x = tx; aoe.y = ty; DW.SFX.play('click'); refreshOverlay(); refreshPanel(); }
      }
      return;
    }
    if (mode === 'ally') {
      if (u && allies.indexOf(u) >= 0) applyAlly(u);
      return;
    }
    if (u && u.kind === 'soldier') { DW.SFX.play('click'); select(u); return; }
    if (u && u.side === 'e' && u.seen && sel) {
      if (BT().targetsFor(sel).indexOf(u) >= 0 && sel.ap >= 1 && sel.clip > 0) startTarget('shoot', u);
      else DW.UI.toast(sel.ap < 1 ? 'У бойца нет ОД' : (sel.clip <= 0 ? 'Перезарядитесь' : 'Цель не видна этому бойцу'));
      return;
    }
    if (sel && sel.ap > 0 && reachC) {
      const i = BT().idx(tx, ty);
      const c = reachC.cost[i];
      const maxC = sel.ap >= 2 ? sel.mob * 2 : sel.mob;
      if (c !== Infinity && c > 0 && c <= maxC + 0.01 && BT().canEnd(reachC, tx, ty)) {
        if (preview && preview.x === tx && preview.y === ty) doMove();
        else setPreview(tx, ty);
        return;
      }
    }
    if (preview) { preview = null; BS.refresh(); }
  };
  function setPreview(tx, ty) {
    const path = BT().pathTo(reachC, tx, ty);
    const c = reachC.cost[BT().idx(tx, ty)];
    const shields = [];
    BT().DIR4.forEach(function (d) {
      const o = BT().objAt(tx + d[0], ty + d[1]);
      if (o && D.OBJ[o].cover) shields.push({ dx: d[0], dy: d[1], c: D.OBJ[o].cover });
    });
    const marks = [];
    BT().enemies().forEach(function (e) {
      if (!e.seen) return;
      if (BT().canSeeFrom(tx, ty, e.x, e.y, sel.sight)) marks.push({ u: e, flank: !BT().coverAt(e.x, e.y, tx, ty).cover });
    });
    preview = { x: tx, y: ty, path: path, cost: c <= sel.mob + 0.01 ? 1 : 2, shields: shields, marks: marks };
    DW.SFX.play('click');
    BS.refresh();
  }

  /* ---------- Действия ---------- */
  async function run(fn) {
    if (busy) return;
    busy = true;
    mode = 'idle'; targets = []; aoe = null; allies = []; preview = null;
    hint('');
    BS.refresh();
    try { await fn(); } catch (e) { console.error(e); }
    busy = false;
    if (!B) return;
    BT().updateVision();
    if (BT().checkEnd()) { finish(); return; }
    if (!sel || !sel.alive || sel.evac || sel.ap <= 0) {
      const others = BT().soldiers().filter(function (u) { return u.ap > 0; });
      if (others.length) select(others[0], false);
    }
    BS.refresh();
    if (!BT().soldiers().some(function (u) { return u.ap > 0; })) {
      await U.sleep(500);
      if (!busy && B && !B.over && B.phase === 'player' && !BT().soldiers().some(function (u) { return u.ap > 0; })) endTurn();
    }
  }
  function doMove() {
    const p = preview;
    const path = BT().pathTo(reachC, p.x, p.y);
    const cost = p.cost;
    const u = sel;
    run(async function () {
      u.ap -= cost;
      await BT().move(u, path);
      tut('move');
    });
  }
  function doAction(a) {
    const u = sel;
    switch (a.id) {
      case 'shoot': startTarget('shoot'); break;
      case 'volley': startTarget('volley'); break;
      case 'repair': run(async function () { BT().doRepair(u); await U.sleep(400); }); break;
      case 'guard': startAlly('guard'); break;
      case 'overwatch': run(async function () { BT().doOverwatch(u); tut('ow'); }); break;
      case 'reload': run(async function () { BT().doReload(u); await U.sleep(900); }); break;
      case 'hunker': run(async function () { BT().doHunker(u); }); break;
      case 'crouch': run(async function () { BT().doCrouch(u); await U.sleep(250); }); break;
      case 'butt': run(async function () { const ts = BT().meleeTargets(u).sort(function (a, b) { return a.hp - b.hp; }); if (ts.length) await BT().doButt(u, ts[0]); }); break;
      case 'stabilize': run(async function () { const ds = BT().downedNear(u); if (ds.length) { BT().doStabilize(u, ds[0]); await U.sleep(700); } }); break;
      case 'grenade': startThrow('grenade'); break;
      case 'rocket': startThrow('rocket'); break;
      case 'medkit': startAlly('medkit'); break;
      case 'evac': run(async function () { BT().doEvac(u); await U.sleep(300); }); break;
      case 'defuse': run(async function () { BT().doDefuse(u); await U.sleep(800); }); break;
      case 'breach': startThrow('breach'); break;
      case 'uazmg': startTarget('uazmg'); break;
      case 'ability':
        switch (a.ab) {
          case 'order': startAlly('order'); break;
          case 'suppress': startTarget('suppress'); break;
          case 'rush': run(async function () { BT().doRush(u); }); break;
          case 'aimed': startTarget('aimed'); break;
          case 'double': startTarget('double'); break;
          case 'heal': startAlly('heal'); break;
          case 'mine': startThrow('mine'); break;
          default: break;
        }
        break;
      default: break;
    }
  }
  function startTarget(kind, pre) {
    const tg = kind === 'volley' ? BT().volleyTargets(sel, BT().volleyPartner(sel)) : BT().targetsFor(sel);
    if (!tg.length) { DW.UI.toast('Нет целей в поле зрения'); return; }
    mode = 'target'; kindA = kind; preview = null;
    targets = tg.map(function (u) { return { u: u, hit: shotInfo(kind, sel, u).hit }; }).sort(function (a, b) { return b.hit - a.hit; });
    tIdx = 0;
    if (pre) { const i = targets.findIndex(function (x) { return x.u === pre; }); if (i >= 0) tIdx = i; }
    hint('');
    focusTarget();
  }
  function focusTarget() {
    const t = targets[tIdx];
    if (t) DW.TR.focusOn(t.u.x, t.u.y, false);
    refreshOverlay(); refreshPanel();
  }
  function confirmFire() {
    const t = targets[tIdx];
    if (!t) return;
    const u = sel, k = kindA;
    run(async function () {
      tut('shoot');
      if (k === 'suppress') await BT().doSuppress(u, t.u);
      else if (k === 'volley') { const p = BT().volleyPartner(u); if (p) await BT().doVolley(u, p, t.u); else await BT().doShoot(u, t.u, 'shoot'); }
      else if (k === 'uazmg') await BT().doUazMg(u, t.u);
      else await BT().doShoot(u, t.u, k);
    });
  }
  function startThrow(kind) {
    mode = 'throw'; kindA = kind; preview = null;
    if (kind === 'mine' || kind === 'breach') {
      // сапёр: только соседние клетки из списка
      const sp = kind === 'mine' ? BT().mineSpots(sel) : BT().breachSpots(sel);
      aoe = { range: 1.5, r: 0.45, spots: sp };
      if (sp.length === 1) { aoe.x = sp[0][0]; aoe.y = sp[0][1]; }
      hint(kind === 'mine' ? 'Выберите соседнюю клетку для мины' : 'Выберите стену или укрытие рядом');
    } else {
      aoe = { range: kind === 'rocket' ? 10 : 7, r: kind === 'rocket' ? 2.2 : 1.5 };
      hint('Выберите клетку для ' + (kind === 'rocket' ? 'выстрела' : 'броска'));
    }
    refreshOverlay(); refreshPanel();
  }
  function confirmThrow() {
    if (!aoe || aoe.x === undefined) return;
    const u = sel, x = aoe.x, y = aoe.y, k = kindA;
    if (k === 'mine') { run(async function () { BT().doMine(u, x, y); await U.sleep(600); }); return; }
    if (k === 'breach') { run(async function () { await BT().doBreach(u, x, y); }); return; }
    run(async function () { await BT().doThrow(u, x, y, k); });
  }
  function startAlly(kind) {
    let list;
    if (kind === 'order') list = BT().soldiers().filter(function (a) { return a !== sel && a.ap < 3 && BT().canSee(sel, a); });
    else if (kind === 'guard') list = BT().guardTargets(sel);
    else list = healTargets(sel);
    if (!list.length) { DW.UI.toast(kind === 'order' ? 'Нет бойцов в поле зрения' : 'Рядом нет раненых'); return; }
    if (list.length === 1 && kind !== 'order') { kindA = kind; applyAlly(list[0]); return; }
    mode = 'ally'; kindA = kind; allies = list; preview = null;
    hint('Выберите бойца');
    refreshOverlay(); refreshPanel();
  }
  function applyAlly(a) {
    const u = sel, k = kindA;
    run(async function () {
      if (k === 'order') BT().doOrder(u, a);
      else if (k === 'guard') BT().doGuard(u, a);
      else if (k === 'heal') BT().doFieldHeal(u, a);
      else BT().doMedkit(u, a);
      await U.sleep(250);
    });
  }

  async function endTurn() {
    if (busy || !B || B.phase !== 'player') return;
    busy = true; mode = 'idle'; preview = null; targets = []; aoe = null; allies = [];
    hint('');
    DW.TR.overlay = null;
    BS.refresh();
    tut('end');
    banner('Ход противника', true);
    // ход противника короче по умолчанию; «Быстрее» — ещё втрое
    DW.turbo = 1.35;
    const fast = el('button', { class: 'btn sm skipturn', html: '⏩ Быстрее' });
    fast.onclick = function (e) { e.stopPropagation(); DW.turbo = 4; fast.innerHTML = '⏩ Ускорено'; fast.disabled = true; };
    if (hud && hud.banner && hud.banner.parentNode) hud.banner.parentNode.appendChild(fast);
    try { await BT().endPlayerTurn(); } catch (e) { console.error(e); }
    DW.turbo = 1;
    if (fast.parentNode) fast.parentNode.removeChild(fast);
    hideBanner();
    busy = false;
    if (!B) return;
    if (B.over) { finish(); return; }
    DW.G.state.battle = B;
    DW.G.save();
    banner('Ваш ход');
    sel = null;
    selectNext(true);
    BS.refresh();
  }
  BS.endTurn = endTurn;
  BS._finish = function () { return finish(); };
  BS.isFinishing = function () { return finishing; };

  let finishing = false;
  async function finish() {
    if (!B || finishing) return;
    finishing = true;
    busy = true;
    BS.refresh();
    hint('');
    const res = B.over;
    banner(res === 'victory' ? 'Победа!' : (res === 'evac' ? 'Отход' : 'Отряд погиб'), true);
    DW.SFX.play(res === 'victory' ? 'portal' : 'death');
    if (DW.Music) { DW.Music.sting(res === 'victory' ? 'victory' : 'defeat'); DW.Music.set(res === 'victory' ? 'world' : 'cine'); }
    await U.sleep(1300);
    const battle = B;
    const sum = DW.G.applyBattle(battle);
    DW.BT.clear();
    B = null;
    await DW.UI.results(sum);
    DW.Main.afterBattle(sum);
  }

  function openMenu() {
    const body = el('div', { class: 'menubox' });
    body.appendChild(DW.UI.settingsRow());
    const defense = B.kind === 'defense';
    DW.UI.modal({
      title: 'Меню боя', cls: 'small', body: body,
      buttons: [
        { text: 'Как играть', close: false, onClick: function () { DW.UI.help(); } },
        { text: defense ? 'Оставить базу' : 'Отступить', cls: 'danger', onClick: async function () {
          const ok = await DW.UI.confirm('Отступление', defense
            ? 'Отряд бросит базу. Нападающие разграбят припасы и постройки. Бойцы получат ранения при отходе.'
            : 'Все бойцы покинут бой. Те, кто не в зелёной зоне эвакуации, получат ранения при отходе (до −4 ОЗ). Трофеи с врагов будут потеряны.', 'Отступить');
          if (ok && B && !busy) { BT().retreatAll(); finish(); }
        } },
        { text: 'Продолжить', cls: 'primary' }
      ]
    });
  }

  DW.BS = BS;
})(window.DW);
