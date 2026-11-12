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
    DW.TR.init(B);
    buildHud();
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
  };
  BS.exit = function () { document.getElementById('ui').innerHTML = ''; DW.TR.overlay = null; hud = null; };
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
    hud.tr.appendChild(hud.res); hud.tr.appendChild(hud.menuBtn);
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
      it.appendChild(el('img', { src: s ? DW.ART.portrait(s) : '', alt: '' }));
      const info = el('div', { class: 'sq-i' });
      const pct = Math.round(u.hp / u.maxHp * 100);
      info.innerHTML = '<div class="sq-hp' + (pct <= 34 ? ' low' : '') + '"><i style="width:' + pct + '%"></i></div>' +
        '<div class="sq-ap">' + (u.alive && !u.evac ? pips(u.ap, Math.max(2, u.ap), 'ap') : (u.evac ? '<span class="good">эвак.</span>' : '<span class="bad">погиб</span>')) +
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
  function actionList(u) {
    const st = DW.G.state;
    const W = D.WEAPONS[u.weapon];
    const tg = BT().targetsFor(u);
    const list = [];
    const canFire = u.ap >= 1 && u.clip > 0 && st.res.ammo > 0;
    list.push({ id: 'shoot', icon: 'shoot', label: 'Огонь', on: canFire && tg.length > 0, note: !u.clip ? 'пусто' : (st.res.ammo <= 0 ? 'нет патр.' : '') });
    const ab = D.CLASSES[u.cls].ab, A = D.ABIL[ab], cd = u.cd[ab] || 0;
    let on = false;
    if (u.ap >= 1 && !cd) {
      if (ab === 'order') on = BT().soldiers().some(function (a) { return a !== u && a.ap < 3 && BT().canSee(u, a); });
      else if (ab === 'suppress') on = canFire && tg.length > 0;
      else if (ab === 'rush') on = true;
      else if (ab === 'aimed' || ab === 'double') on = u.ap >= 2 && canFire && tg.length > 0;
    }
    if (ab === 'heal') on = u.ap >= 1 && u.charges.heal > 0 && healTargets(u).length > 0;
    list.push({ id: 'ability', icon: ab, label: A.n, on: on, cd: cd, count: ab === 'heal' ? u.charges.heal : null, ab: ab });
    list.push({ id: 'overwatch', icon: 'overwatch', label: 'Дозор', on: canFire });
    list.push({ id: 'reload', icon: 'reload', label: 'Перезар.', on: u.ap >= 1 && u.clip < W.clip });
    list.push({ id: 'grenade', icon: 'throwg', label: 'Граната', on: u.ap >= 1 && st.res.grenades > 0, count: st.res.grenades });
    if (u.cls === 'heavy') list.push({ id: 'rocket', icon: 'rpg', label: 'РПГ', on: u.ap >= 1 && st.res.rockets > 0, count: st.res.rockets });
    list.push({ id: 'medkit', icon: 'medkit', label: 'Аптечка', on: u.ap >= 1 && st.res.meds > 0 && healTargets(u).length > 0, count: st.res.meds });
    const mt = BT().meleeTargets(u);
    if (mt.length) list.push({ id: 'butt', icon: 'butt', label: 'Приклад', on: u.ap >= 1 });
    const dn = BT().downedNear(u);
    if (dn.length) list.push({ id: 'stabilize', icon: 'medkit', label: 'Спасти', on: u.ap >= 1 && (st.res.meds > 0 || (u.cls === 'medic' && u.charges && u.charges.heal > 0)), note: st.res.meds > 0 || (u.cls === 'medic' && u.charges && u.charges.heal > 0) ? '' : 'нет аптечек' });
    list.push({ id: 'hunker', icon: 'hunker', label: 'Залечь', on: u.ap >= 1 });
    if (B.evac.length) list.push({ id: 'evac', icon: 'evac', label: 'Эвакуация', on: u.ap >= 1 && BT().isEvacTile(u.x, u.y) });
    return list;
  }

  BS.refresh = function () {
    if (!hud || !B) return;
    const st = DW.G.state;
    hud.obj.innerHTML = '<b>Ход ' + B.turn + '</b> · ' + B.objective + '<div class="cond">' + BT().condText(B) + '</div>';
    hud.res.innerHTML = '<span>' + ic('ammo') + st.res.ammo + '</span><span>' + ic('grenades') + st.res.grenades + '</span><span>' + ic('meds') + st.res.meds + '</span>' +
      (st.res.rockets ? '<span>' + ic('rockets') + st.res.rockets + '</span>' : '') + '<span class="gemc">' + ic('gems') + (B.loot.gems || 0) + '</span>';
    renderSquad();
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
      actionList(sel).forEach(function (a) {
        const b = el('button', {
          class: 'abtn' + (a.on ? '' : ' off') + (a.id === 'ability' ? ' abil' : ''),
          html: '<span class="ico">' + (D.ICONS[a.icon] || '') + '</span><span>' + a.label + '</span>' +
            (a.cd ? '<em class="cd">' + a.cd + '</em>' : '') + (a.count !== null && a.count !== undefined ? '<em class="cnt">' + a.count + '</em>' : '') +
            (a.note ? '<em class="note">' + a.note + '</em>' : ''),
          onclick: function () { if (!busy && a.on) { DW.SFX.play('click'); doAction(a); } else if (!busy) explainOff(a); }
        });
        hud.actions.appendChild(b);
      });
    }
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

  let owzSrc = null, owzC = null;
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
      owz: mode === 'idle' && !busy && st && st.ap > 0 && reachC ? (owzSrc === reachC ? owzC : (owzSrc = reachC, owzC = BT().owZone(reachC))) : null
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
      const W = D.WEAPONS[sel.weapon];
      const lbl = { shoot: 'Огонь', aimed: 'Прицельный', double: 'Двойной ×2', suppress: 'Подавить' }[kindA];
      p.appendChild(el('div', { class: 't-head', html: '<img src="' + DW.ART.enemyPortrait(t.u.type) + '" alt=""><div class="t-name">' + t.u.name + '<small>ОЗ ' + t.u.hp + '/' + t.u.maxHp + (t.u.armor ? ' · броня ' + t.u.armor : '') + '</small></div>' }));
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
      const rk = kindA === 'rocket';
      p.appendChild(el('div', { class: 't-name', text: rk ? 'Выстрел из РПГ' : 'Граната' }));
      p.appendChild(el('div', { class: 't-hit', html: (rk ? 'Урон 5–8, радиус 2, разрушает укрытия.' : 'Урон 3–5, радиус 1.5, разрушает лёгкие укрытия.') + '<br>Выберите клетку (дальность ' + aoe.range + ').' }));
      const row = el('div', { class: 't-btns' });
      const go = el('button', { class: 'btn primary fire', text: rk ? 'Пуск!' : 'Бросить', onclick: confirmThrow });
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
    const o = kind === 'aimed' ? { aimBonus: 20, critBonus: 25, aimLabel: 'Прицел' } : (kind === 'double' ? { aimBonus: -15, aimLabel: 'Двойной' } : {});
    return BT().shotInfo(u, t, o);
  }

  /* ---------- Выбор ---------- */
  function select(u, noFocus) {
    sel = u; mode = 'idle'; preview = null;
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
    });
  }
  function doAction(a) {
    const u = sel;
    switch (a.id) {
      case 'shoot': startTarget('shoot'); break;
      case 'overwatch': run(async function () { BT().doOverwatch(u); }); break;
      case 'reload': run(async function () { BT().doReload(u); await U.sleep(900); }); break;
      case 'hunker': run(async function () { BT().doHunker(u); }); break;
      case 'butt': run(async function () { const ts = BT().meleeTargets(u).sort(function (a, b) { return a.hp - b.hp; }); if (ts.length) await BT().doButt(u, ts[0]); }); break;
      case 'stabilize': run(async function () { const ds = BT().downedNear(u); if (ds.length) { BT().doStabilize(u, ds[0]); await U.sleep(700); } }); break;
      case 'grenade': startThrow('grenade'); break;
      case 'rocket': startThrow('rocket'); break;
      case 'medkit': startAlly('medkit'); break;
      case 'evac': run(async function () { BT().doEvac(u); await U.sleep(300); }); break;
      case 'ability':
        switch (a.ab) {
          case 'order': startAlly('order'); break;
          case 'suppress': startTarget('suppress'); break;
          case 'rush': run(async function () { BT().doRush(u); }); break;
          case 'aimed': startTarget('aimed'); break;
          case 'double': startTarget('double'); break;
          case 'heal': startAlly('heal'); break;
          default: break;
        }
        break;
      default: break;
    }
  }
  function startTarget(kind, pre) {
    const tg = BT().targetsFor(sel);
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
      if (k === 'suppress') await BT().doSuppress(u, t.u);
      else await BT().doShoot(u, t.u, k);
    });
  }
  function startThrow(kind) {
    mode = 'throw'; kindA = kind; preview = null;
    aoe = { range: kind === 'rocket' ? 10 : 7, r: kind === 'rocket' ? 2.2 : 1.5 };
    hint('Выберите клетку для ' + (kind === 'rocket' ? 'выстрела' : 'броска'));
    refreshOverlay(); refreshPanel();
  }
  function confirmThrow() {
    if (!aoe || aoe.x === undefined) return;
    const u = sel, x = aoe.x, y = aoe.y, k = kindA;
    run(async function () { await BT().doThrow(u, x, y, k); });
  }
  function startAlly(kind) {
    let list;
    if (kind === 'order') list = BT().soldiers().filter(function (a) { return a !== sel && a.ap < 3 && BT().canSee(sel, a); });
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
    banner('Ход противника', true);
    try { await BT().endPlayerTurn(); } catch (e) { console.error(e); }
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
