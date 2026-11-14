'use strict';
/* Сцена глобальной карты: интерфейс и стратегические действия */
(function (DW) {
  const U = DW.U, D = DW.D, el = U.el;
  const WS = {};
  let hud = null;
  let busy = false;
  const ic = function (n) { return D.icon(n); };

  WS.enter = function () {
    DW.WR.init();
    DW.WR.sel = DW.G.state.squadAt;
    buildHud();
    WS.refresh();
    // новые главы хроники — когда на карте нет окон
    if (DW.Story) setTimeout(function () { if (DW.Main.scene() === WS && !DW.UI.hasModal() && !busy && !(DW.Cine && DW.Cine.active())) DW.Story.run(); }, 900);
  };
  WS.exit = function () { document.getElementById('ui').innerHTML = ''; hud = null; };
  WS.update = function (dt) { DW.WR.update(dt); };
  WS.render = function (g, w, h, dpr) { DW.WR.render(g, w, h, dpr); };
  WS.pan = function (dx, dy) { DW.WR.pan(dx, dy); };
  WS.zoomAt = function (f, x, y) { DW.WR.zoomAt(f, x, y); };
  WS.tap = function (x, y) {
    if (busy || DW.UI.hasModal()) return;
    const n = DW.WR.hitNode(x, y);
    if (n) { DW.WR.sel = n.id; DW.SFX.play('click'); WS.refresh(); }
  };
  WS.back = function () { if (!busy) openMenu(); };
  WS.idle = function () { return DW.WR.idle(); };

  function buildHud() {
    const ui = document.getElementById('ui');
    ui.innerHTML = '';
    hud = {};
    hud.top = el('div', { class: 'wtop' });
    hud.panel = el('div', { class: 'wpanel' });
    hud.bot = el('div', { class: 'wbot' });
    const btn = function (icon, label, fn, cls) {
      return el('button', { class: 'wbtn ' + (cls || ''), html: '<span class="ico">' + D.ICONS[icon] + '</span><span>' + label + '</span>', onclick: function () { if (busy) return; DW.SFX.play('click'); fn(); } });
    };
    hud.bot.appendChild(btn('squad', 'Отряд', function () { DW.UI.squad(WS.refresh); }));
    hud.bot.appendChild(btn('base', 'База', function () { if (DW.G.state.baseNode !== null) DW.Main.setScene(DW.BaseS); else DW.UI.base(WS.refresh); }));
    hud.bot.appendChild(btn('portalbtn', 'Портал', function () { DW.UI.portal(afterPortal); }, 'portal'));
    hud.bot.appendChild(btn('journal', 'Журнал', function () { DW.UI.journal(); }));
    hud.bot.appendChild(btn('wait', 'Ждать день', function () { waitDay(); }));
    hud.bot.appendChild(btn('menu', 'Меню', function () { openMenu(); }));
    ui.appendChild(hud.top); ui.appendChild(hud.panel); ui.appendChild(hud.bot);
  }
  function afterPortal() {
    WS.refresh();
    if (DW.G.state.over) DW.Main.ending(DW.G.state.over);
    else if (DW.G.state.milestone) DW.Main.milestone();
  }

  let storyT = 0;
  WS.refresh = function () {
    if (!hud) return;
    if (DW.Story && performance.now() - storyT > 1500) { storyT = performance.now(); setTimeout(async function () {
      if (!hud || busy || DW.UI.hasModal() || (DW.Cine && DW.Cine.active())) return;
      await DW.Story.run();
      // сюжетные задания: открылось новое — показать, где
      const nq = DW.G.checkQuests ? DW.G.checkQuests() : [];
      for (let i = 0; i < nq.length; i++) { DW.G.save(); WS.refresh(); await DW.UI.alert('Задание: ' + nq[i].q.t, '<div class="ptext">' + nq[i].q.text + '<br><br>Где: <b>' + nq[i].node.name + '</b> — отмечено на карте ★.</div>', 'portal'); }
    }, 400); }
    const G = DW.G, st = G.state, r = st.res;
    const warn = [];
    if (st.raid) warn.push('<span class="bad">Набег через ' + Math.max(0, st.raid.day - st.day) + ' дн.</span>');
    if (st.hungry) warn.push('<span class="bad">Голод!</span>');
    if (st.orders.length) warn.push('<span class="acc">Груз в пути</span>');
    const wk = G.weather ? G.weather() : 'clear';
    if (wk !== 'clear') warn.push('<span class="bad">' + G.WEATHER[wk].n + '</span>');
    st.world.nodes.forEach(function (x) { if (x.drillThreat) warn.push('<span class="bad">Бур в «' + x.name + '» под ударом!</span>'); });
    hud.top.innerHTML =
      '<div class="wday">' + ic('day') + '<b>День ' + st.day + '</b></div>' +
      '<div class="wres">' +
      '<span class="r gems" title="Драгоценности">' + ic('gems') + '<b>' + r.gems + '</b></span>' +
      '<span class="r" title="Провизия">' + ic('food') + '<b' + (r.food < st.roster.length * 2 ? ' class="bad"' : '') + '>' + r.food + '</b><small>−' + st.roster.length + '</small></span>' +
      '<span class="r" title="Патроны">' + ic('ammo') + '<b' + (r.ammo < 60 ? ' class="bad"' : '') + '>' + r.ammo + '</b></span>' +
      '<span class="r" title="Аптечки">' + ic('meds') + '<b>' + r.meds + '</b></span>' +
      '<span class="r" title="Гранаты">' + ic('grenades') + '<b>' + r.grenades + '</b></span>' +
      (r.rockets ? '<span class="r" title="Ракеты">' + ic('rockets') + '<b>' + r.rockets + '</b></span>' : '') +
      '<span class="r" title="Стройматериалы">' + ic('materials') + '<b>' + r.materials + '</b></span>' +
      '</div><div class="wwarn">' + warn.join(' ') + '</div>';
    renderPanel();
    hud.bot.querySelectorAll('button').forEach(function (b) { b.disabled = busy; });
  };

  function renderPanel() {
    const G = DW.G, st = G.state;
    const p = hud.panel;
    p.innerHTML = '';
    const id = DW.WR.sel;
    if (id === null || id === undefined) { p.classList.add('hidden'); return; }
    p.classList.remove('hidden');
    const n = G.node(id);
    const T = D.nodeInfo(n);
    const here = n.id === st.squadAt;
    let status;
    if (n.id === st.baseNode) status = '<span class="good">Ваша база</span>';
    else if (n.cleared) status = '<span class="good">Зачищено</span>';
    else if (G.truceNode(n)) status = '<span class="good">Перемирие</span> ' + DW.UI.skulls(n.diff);
    else status = '<span class="bad">Враги</span> ' + DW.UI.skulls(n.diff);
    const extra = [];
    if (n.beacon) extra.push(n.type === 'landing' ? 'Портал: сюда приходят грузы' : 'Маяк: сюда можно заказывать грузы');
    if (n.outpost) extra.push('Бур: +' + (3 + (n.cart ? 2 : 0)) + ' ' + ic('gems') + ' в день' + (n.cart ? ' (с вагонеткой)' : ''));
    if (n.drillThreat) extra.push('<span class="bad">На бур идут мутанты! Осталось ' + Math.max(0, n.drillThreat - st.day) + ' дн.</span>');
    if (n.scouted && !n.cleared) extra.push('<span class="acc">Разведано: враги известны</span>');
    if (st.caravan && st.caravan.at === n.id) extra.push('<span class="acc">Здесь караван торговцев</span>');
    G.roamersAt(n.id).forEach(function (r) { extra.push('<span class="bad">Здесь ' + G.roamWho(r) + '</span> (бродит по округе)'); });
    if (G.raidOnPath(n.id)) extra.push('<span class="bad">Через эту локацию идёт набег на базу</span> — можно встретить его здесь.');
    if (n.type === 'camp' && !n.cleared && G.FACS[n.fac || 'raider']) {
      const f = n.fac || 'raider', fs = G.facStatus(f);
      extra.push(G.FACS[f] + ': <b class="' + (fs === 'вражда' ? 'bad' : (fs === 'перемирие' ? 'good' : 'acc')) + '">' + fs + '</b> (' + G.rep(f) + ')' + (G.truce(f) ? ' · ещё ' + (st.truce[f] - st.day) + ' дн. · можно пройти через лагерь' : ''));
    }
    (n.pows || []).forEach(function (pw) { extra.push('<span class="bad">Здесь держат в плену «' + pw.s.name + '»</span> — осталось ' + Math.max(0, pw.until - st.day) + ' дн.'); });
    if (n.cargo && n.cargo.length) extra.push('<span class="acc">Здесь лежит груз (' + n.cargo.length + ' поз.)</span>');
    if (n.type === 'ruins' && n.cleared) extra.push('Осталось обысков: ' + n.searches);
    const artType = n.id === st.baseNode ? null : n.type;
    p.appendChild(el('div', { class: 'pn-art', html: '<img src="' + (artType ? DW.ART.landmarkURL(artType) : DW.ART.landmark('base', { key: JSON.stringify(st.buildings), b: st.buildings }).toDataURL()) + '" alt="">' }));
    p.appendChild(el('div', { class: 'pn-title', html: n.name }));
    p.appendChild(el('div', { class: 'pn-sub', html: '<span style="color:' + T.color + '">' + T.n + '</span> · ' + status }));
    p.appendChild(el('div', { class: 'pn-desc', html: T.desc }));
    if (extra.length) p.appendChild(el('div', { class: 'pn-extra', html: extra.join('<br>') }));
    const acts = el('div', { class: 'pn-acts' });
    const add = function (label, fn, cls, dis) {
      const b = el('button', { class: 'btn ' + (cls || ''), html: label, onclick: function () { if (busy) return; DW.SFX.play('click'); fn(); } });
      if (dis || busy) b.disabled = true;
      acts.appendChild(b);
    };
    const canTalk = n.type === 'camp' && !n.cleared && n.known && G.FACS[n.fac || 'raider'];
    if (here) {
      p.appendChild(el('div', { class: 'pn-here', text: 'Отряд здесь' }));
      if (canTalk) add('Переговоры', function () { talks(n); }, G.truceNode(n) ? 'primary' : '');
      G.roamersAt(n.id).forEach(function (r) { add('Атаковать: ' + G.roamWho(r), function () { roamFight({ id: r.id, kind: r.kind, str: r.str, at: n.id }); }, 'primary'); });
      if (G.raidOnPath(n.id)) add('Ждать набег здесь (1 день)', function () { waitDay('Отряд встал на пути набега.'); }, 'primary');
      if (!n.cleared) add('Атаковать', function () { WS.attack(n, 'normal'); }, G.truceNode(n) ? '' : 'primary');
      else {
        if (n.id === st.baseNode) add('Отдых (1 день)', function () { waitDay('Отряд отдыхает на базе.'); }, 'primary');
        if (n.type === 'ruins') add('Обыскать (1 день)', function () { search(n); }, '', n.searches <= 0);
        if (n.type === 'vein') add('Добывать кристаллы (1 день)', function () { mine(n); }, 'primary');
        if (n.type === 'vein' && !n.outpost) add('Поставить бур · 12 ' + ic('materials'), function () { outpost(n); }, '', st.baseNode === null || st.res.materials < 12);
        if (n.outpost && !n.cart) add('Вагонетка (+2 ' + ic('gems') + ') · 8 ' + ic('materials'), function () { if (!G.pay({ materials: 8 })) return; n.cart = true; DW.SFX.play('build'); DW.UI.toast('Вагонетка пущена: бур даёт больше', 'good'); G.save(); WS.refresh(); }, '', st.res.materials < 8);
        if (n.drillThreat) add('Защитить бур (бой)', function () { WS.attack(n, 'ambush'); }, 'primary');
        if (st.caravan && st.caravan.at === n.id) add('Караван', function () { caravanMeet(true); }, 'primary');
        if (n.type === 'site' && st.baseNode === null) add('Основать базу', function () { foundBase(n); }, 'primary');
        if (!n.beacon) add('Поставить маяк · 8 ' + ic('materials') + ' 10 ' + ic('gems'), function () { beacon(n); }, '', !G.canAfford({ materials: 8, gems: 10 }));
        if (n.type === 'vein' && n.outpost && st.baseNode === null) void 0;
      }
      if (n.type === 'vein' && !n.outpost && st.baseNode === null && n.cleared) p.appendChild(el('div', { class: 'pn-note', text: 'Бур можно поставить после основания базы.' }));
    } else {
      const path = G.findPath(st.squadAt, n.id);
      if (canTalk && path && path.length === 1) add('Переговоры (гонец)', function () { talks(n); });
      // разведка: соседняя (или через одну зачищенную) неразведанная локация — один боец уходит на день
      if (!n.cleared && !n.scouted && path && path.length <= 2) add('Разведать (1 день)', function () { scout(n); }, '', st.roster.filter(function (s) { return !s.injury; }).length < 2);
      if (path && path.length) {
        add('Выдвинуться · ' + path.length + ' ' + U.plural(path.length, 'день', 'дня', 'дней'), function () { travel(n.id); }, 'primary');
        const need = path.length * st.roster.length;
        if (st.res.food < need) p.appendChild(el('div', { class: 'pn-note bad', html: 'Провизии не хватит на дорогу (' + need + ' ' + ic('food') + ').' }));
      } else {
        p.appendChild(el('div', { class: 'pn-note', text: 'Нет пути: сначала зачистите локации по дороге или подойдите ближе.' }));
      }
    }
    p.appendChild(acts);
  }

  /* ---------- Смена дня ---------- */
  async function passDay() {
    const G = DW.G, st = G.state;
    const r = G.advanceDay();
    DW.WR.nightPass();
    WS.refresh();
    await U.sleep(900);
    let moved = false;
    const drops = (r.drops || []).filter(function (id, i, a) { return a.indexOf(id) === i && G.node(id).known; });
    for (let i = 0; i < drops.length; i++) {
      const n = G.node(drops[i]);
      DW.WR.focus(n.x, n.y); moved = true;
      DW.WR.dropFx(n.id); DW.SFX.play('portal');
      await U.sleep(1500);
    }
    if (r.raidNew && st.raid) {
      const src = G.node(st.raid.from);
      DW.WR.focus(src.x, src.y); moved = true;
      DW.WR.raidAlarm(); DW.SFX.play('alert');
      await U.sleep(1700);
    }
    for (let i = 0; i < r.notes.length; i++) await DW.UI.alert(r.notes[i].title, r.notes[i].text, r.notes[i].kind);
    if (moved) { const sq = G.node(st.squadAt); DW.WR.focus(sq.x, sq.y); }
    if (r.event) await runEvent(r.event);
    // караван пришёл туда, где стоит отряд
    if (st.caravan && st.caravan.at === st.squadAt && !st.caravan.met) { await caravanMeet(); if (DW.Main.scene() !== DW.WS) return 'battle'; }
    WS.refresh();
    // стая или набег вышли на отряд
    if (r.roam) { G.save(); if (await roamFight(r.roam)) return 'battle'; }
    if (G.state.over) { G.save(); DW.Main.ending(G.state.over); return 'over'; }
    if (G.state.milestone) await DW.Main.milestone();
    if (r.defense) { G.save(); await startDefense(r.defense); return 'battle'; }
    G.save();
    return 'ok';
  }
  WS.passDay = passDay;
  async function runEvent(e) {
    const st = DW.G.state;
    const opts = e.ev.choices.map(function (c) { return { text: c.t, disabled: c.cond ? !c.cond(st) : false }; });
    let i = await DW.UI.choice(e.ev.title, e.text, opts);
    if (i < 0) i = e.ev.choices.length - 1;
    const txt = e.ev.choices[i].run(st, e.ctx);
    WS.refresh();
    if (txt) await DW.UI.alert(e.ev.title, txt);
  }
  async function startDefense(raid) {
    const G = DW.G, st = G.state;
    const base = G.node(st.baseNode);
    if (raid.relief) {
      // отряд далеко: примчаться на УАЗе (бой с 3-го хода, до того держат ополченцы) или довериться стенам
      const i = await DW.UI.choice('Набег на базу!', 'По рации: ' + G.raidWho(raid.kind) + ' штурмуют «' + base.name + '». Отряд на УАЗе успеет к третьему ходу боя — до того базу держат ополченцы.', [{ text: 'Мчать на УАЗе' }, { text: 'Положиться на укрепления' }]);
      if (i !== 0) { const n = G.autoResolveRaid(raid); await DW.UI.alert(n.title, n.text, n.kind); G.save(); WS.refresh(); return; }
    }
    const txt = { beast: 'Стая мутантов идёт на штурм.', clan: 'Клан пришёл толпой — их много, и они идут в лоб.', sobr: 'Группа СОБР штурмует базу: щиты, светошумовые, слаженный огонь.' }[raid.kind] || 'Банда пришла за вашими припасами.';
    const ids = await DW.UI.briefing(base, 'defense', txt);
    DW.Main.startBattle({ nodeId: st.baseNode, type: base.type, diff: Math.min(5, 1 + Math.floor(st.day / 8)), kind: 'defense', raid: raid, squad: ids || st.roster.slice(0, G.squadMax()).map(function (s) { return s.id; }) });
  }

  async function waitDay(msg) {
    busy = true; WS.refresh();
    if (msg) DW.UI.toast(msg);
    const r = await passDay();
    busy = false;
    if (r === 'ok') WS.refresh();
  }

  async function travel(to) {
    const G = DW.G, st = G.state;
    const path = G.findPath(st.squadAt, to);
    if (!path || !path.length) return;
    busy = true; WS.refresh();
    for (let k = 0; k < path.length; k++) {
      const nid = path[k];
      await DW.WR.animateMove(st.squadAt, nid);
      st.prevNode = st.squadAt; st.squadAt = nid;
      const node = G.node(nid);
      node.visited = true;
      G.revealAround(nid);
      if (st.baseNode !== null && G.blv('tower')) G.revealAround(st.baseNode, 2);
      DW.WR.sel = nid;
      WS.refresh();
      // УАЗ на ходу: на длинном пути каждый второй переход — без ночёвки
      if (!(G.uazOk() && k % 2 === 0 && k < path.length - 1)) {
        const r = await passDay();
        if (r !== 'ok') { busy = false; return; }
      }
      const cg = G.collectCargo(nid);
      if (cg) { WS.refresh(); await DW.UI.alert(cg.title, cg.text, 'portal'); }
      // непогода в пути
      const wk = G.weather();
      if (wk === 'storm' && Math.random() < 0.3) { const s = U.pick(st.roster); s.wounds = Math.min(G.maxHp(s) - 1, s.wounds + 2); await DW.UI.alert('Пыльная буря', '«' + s.name + '» в буре сорвался с осыпи и поранился (−2 ОЗ).', 'bad'); }
      if (wk === 'acid') { st.roster.forEach(function (s) { s.wounds = Math.min(G.maxHp(s) - 1, s.wounds + 1); }); DW.UI.toast('Кислотный дождь: −1 ОЗ всем в пути', 'alert'); }
      if (st.caravan && st.caravan.at === nid && !st.caravan.met) { busy = false; WS.refresh(); await caravanMeet(); if (DW.Main.scene() !== DW.WS) return; busy = true; }
      // на дороге — кочующая стая или банда: можно напасть первыми
      const rm = G.roamersAt(nid).find(function (x) { return !(x.kind !== 'beast' && G.truce(x.kind)); });
      if (rm) {
        busy = false; WS.refresh();
        const i = await DW.UI.choice('На дороге', 'В «' + node.name + '» — ' + G.roamWho(rm) + '. Они вас пока не заметили.', [{ text: 'Напасть первыми' }, { text: 'Обойти стороной' }]);
        if (i === 0 && await roamFight({ id: rm.id, kind: rm.kind, str: rm.str, at: nid })) return;
        busy = true;
      }
      if (!node.cleared && !G.truceNode(node)) {
        busy = false; WS.refresh();
        await WS.attack(node, 'normal');
        return;
      }
    }
    busy = false;
    G.save();
    WS.refresh();
  }

  WS.attack = async function (node, kind) {
    const G = DW.G, st = G.state;
    // напасть на лагерь, с которым перемирие, — сорвать его
    if (kind === 'normal' && G.truceNode(node)) {
      const ok = await DW.UI.confirm('Сорвать перемирие?', 'С ' + G.FAC_GEN[node.fac || 'raider'] + ' перемирие. Нападение его сорвёт, отношения испортятся надолго.', 'Напасть');
      if (!ok) return;
      G.repAdd(node.fac || 'raider', -3, 'нападение на «' + node.name + '»');
    }
    const ids = await DW.UI.briefing(node, kind);
    if (!ids && node.cleared) { G.save(); WS.refresh(); return; }   // откупились — локация ваша
    if (!ids) {
      if (kind === 'normal' && st.squadAt === node.id && st.prevNode !== null && st.prevNode !== node.id && G.node(st.prevNode).cleared) {
        busy = true;
        await DW.WR.animateMove(st.squadAt, st.prevNode);
        st.squadAt = st.prevNode;
        DW.WR.sel = st.squadAt;
        busy = false;
      }
      G.save(); WS.refresh();
      return;
    }
    DW.Main.startBattle({ nodeId: node.id, type: node.type, diff: kind === 'ambush' ? Math.max(1, node.diff - 1) : node.diff, kind: kind, squad: ids });
  };

  async function search(n) {
    const G = DW.G, st = G.state;
    busy = true; WS.refresh();
    n.searches--;
    const r = await passDay();
    if (r !== 'ok') { busy = false; return; }
    const tk = G.uazHas('trunk') ? 1.3 : 1;   // багажник УАЗа
    const m = Math.round(U.rand(2, 5) * tk), f = Math.round(U.rand(0, 5) * tk), g = U.rand(0, 3) + (n.diff > 2 ? 2 : 0);
    st.res.materials += m; st.res.food += f; st.res.gems += g;
    G.log('Обыск в «' + n.name + '»: +' + m + ' мат., +' + f + ' еды, +' + g + ' драг.');
    await DW.UI.alert('Обыск: ' + n.name, 'Найдено: +' + m + ' ' + ic('materials') + (f ? ', +' + f + ' ' + ic('food') : '') + (g ? ', +' + g + ' ' + ic('gems') : '') + '.' + (n.searches ? '' : ' Больше здесь искать нечего.'));
    busy = false;
    WS.refresh();
    if (Math.random() < (G.blv('radio') ? 0.09 : 0.18)) {
      await DW.UI.alert('Засада!', 'Пока отряд копался в развалинах, его окружили.', 'bad');
      await WS.attack(n, 'ambush');
      return;
    }
    G.save();
  }
  async function mine(n) {
    const G = DW.G, st = G.state;
    busy = true; WS.refresh();
    const r = await passDay();
    if (r !== 'ok') { busy = false; return; }
    const g = U.rand(6, 12) + n.diff * 2;
    st.res.gems += g;
    G.log('Добыча в «' + n.name + '»: +' + g + ' драгоценностей.');
    await DW.UI.alert('Добыча', 'Отряд весь день долбил кристаллы: +' + g + ' ' + ic('gems') + '.');
    busy = false;
    WS.refresh();
    if (Math.random() < (DW.G.blv('radio') ? 0.11 : 0.22)) {
      await DW.UI.alert('Мутанты!', 'Звон кирок привлёк мутантов.', 'bad');
      await WS.attack(n, 'ambush');
      return;
    }
    G.save();
  }
  async function scout(n) {
    const G = DW.G;
    busy = true; WS.refresh();
    const r = G.scout(n);
    if (!r) { busy = false; WS.refresh(); return; }
    const d = await passDay();
    if (d !== 'ok') { busy = false; return; }
    busy = false;
    await DW.UI.alert('Разведка: ' + n.name, '«' + r.s.name + '» вернулся к ночи' + (r.hurt ? ', слегка поранившись' : '') + '. Враги в «' + n.name + '» теперь известны — состав виден перед боем.');
    G.save(); WS.refresh();
  }
  /* встреча с караваном: торговать, ограбить или пропустить */
  async function caravanMeet(force) {
    const G = DW.G, st = G.state, c = st.caravan;
    if (!c || c.at !== st.squadAt || (c.met && !force)) return;
    c.met = true;
    const i = await DW.UI.choice('Караван торговцев', 'На дороге — караван: телеги, навьюченные мутанты-тяжеловозы, охрана с автоматами. Старший машет: торговать будем?', [{ text: 'Торговать' }, { text: 'Ограбить (бой с охраной)' }, { text: 'Пропустить' }]);
    if (i === 0) { await DW.UI.trade(c); WS.refresh(); }
    else if (i === 1) {
      const node = G.node(st.squadAt);
      const ids = await DW.UI.briefing(node, 'caravan');
      if (ids) DW.Main.startBattle({ nodeId: node.id, type: 'camp', diff: node.diff, kind: 'caravan', squad: ids });
    }
  }
  WS.caravanMeet = caravanMeet;
  /* бой на дороге: кочующая стая/банда (R.id) или набег на марше (R.raid) */
  async function roamFight(R) {
    const G = DW.G, st = G.state, node = G.node(st.squadAt);
    st.roamFight = { id: R.id || null, kind: R.kind, str: R.str, raid: !!R.raid, ambush: !!R.ambush, diff: U.clamp(1 + Math.floor((R.str || 3) / 3), 1, 5) };
    if (R.ambush) await DW.UI.alert('Стая вышла на отряд!', 'В «' + node.name + '» на отряд наткнулась ' + G.roamWho(R) + '. Отходить поздно.', 'bad');
    else if (R.raid) await DW.UI.alert('Набег на марше', G.raidWho(R.kind) + ' идут к базе и выходят прямо на отряд в «' + node.name + '». Разбейте их здесь — и набега не будет.', 'bad');
    const ids = await DW.UI.briefing(node, 'roam');
    if (!ids) {
      st.roamFight = null;
      // уйти от стаи, что сама вышла на отряд, — с потерей части груза
      if (R.ambush) { const lost = Math.min(st.res.food, U.rand(3, 8)); st.res.food -= lost; DW.UI.toast('Отряд ушёл, бросив часть провизии (−' + lost + ')', 'alert'); }
      G.save(); WS.refresh();
      return false;
    }
    DW.Main.startBattle({ nodeId: node.id, type: node.type, diff: st.roamFight.diff, kind: 'roam', squad: ids });
    return true;
  }
  WS.roamFight = roamFight;
  /* переговоры с группировкой: перемирие, подарки, торговля и наёмники (при перемирии) */
  async function talks(n) {
    const G = DW.G, st = G.state, f = n.fac || 'raider';
    const who = { raider: 'Главарь банды', clan: 'Старший клана', sobr: 'Командир блокпоста' }[f];
    for (let guard = 0; guard < 20; guard++) {
      const tr = G.truce(f), r = G.rep(f), c = G.truceCost(f), M = G.MERC[f];
      const gifted = (st.giftDay || {})[f] === st.day;
      const head = who + ' «' + n.name + '». Отношения: <b>' + G.facStatus(f) + '</b> (' + r + ').' +
        (tr ? ' Перемирие ещё ' + (st.truce[f] - st.day) + ' дн.' : (r < -2 ? ' <span class="bad">С вами не станут говорить о мире, пока не задобрите.</span>' : ''));
      const opts = [], acts = [];
      if (!tr) { opts.push({ text: 'Перемирие на 15 дней · ' + c + ' кристаллов', disabled: r < -2 || st.res.gems < c }); acts.push('truce'); }
      const rc = G.ransomCost(f), hostile = G.facStatus(f) === 'вражда';
      (n.pows || []).forEach(function (pw, k) { opts.push({ text: 'Выкупить «' + pw.s.name + '» · ' + rc + ' кристаллов' + (hostile ? ' (при вражде не отдают)' : ''), disabled: hostile || st.res.gems < rc }); acts.push('pow' + k); });
      opts.push({ text: 'Подарок: 8 провизии (отношения +1)', disabled: gifted || st.res.food < 8 }); acts.push('food');
      opts.push({ text: 'Подарок: 40 патронов (отношения +1)', disabled: gifted || st.res.ammo < 40 }); acts.push('ammo');
      if (tr) {
        opts.push({ text: 'Торговать' }); acts.push('trade');
        opts.push({ text: 'Нанять бойца на 10 дней · ' + M.cost + ' кристаллов (' + D.CLASSES[M.cls].n.toLowerCase() + ', ' + (D.WEAPONS[M.w].s || D.WEAPONS[M.w].n) + ')', disabled: st.res.gems < M.cost }); acts.push('merc');
      }
      opts.push({ text: 'Уйти' }); acts.push('leave');
      const i = await DW.UI.choice('Переговоры', head, opts);
      const a = acts[i];
      if (i < 0 || !a || a === 'leave') break;
      if (a === 'truce' && G.makeTruce(f)) { DW.SFX.play('portal'); await DW.UI.alert('Перемирие', 'Ударили по рукам: 15 дней ' + G.FACS[f].toLowerCase() + ' не нападают на колонию. Через их лагерь можно ходить, у них можно торговать и нанимать бойцов.', 'good'); }
      if (a.indexOf('pow') === 0) { const pw = n.pows[+a.slice(3)]; const s = pw && G.ransom(n, pw); if (s) { DW.SFX.play('portal'); await DW.UI.alert('Выкуп', '«' + s.name + '» отпустили. Он избит и измотан — пару дней отлежится, но жив.', 'good'); } }
      if (a === 'food' && G.gift(f, 'food', 8)) DW.UI.toast('Подарок принят: отношения +1', 'good');
      if (a === 'ammo' && G.gift(f, 'ammo', 40)) DW.UI.toast('Подарок принят: отношения +1', 'good');
      if (a === 'trade') {
        const goods = G.caravanGoods();
        // у каждой группировки — своё подешевле
        goods.forEach(function (g) { if ((f === 'raider' && g.res === 'ammo') || (f === 'clan' && g.res === 'food') || (f === 'sobr' && (g.res === 'meds' || g.res === 'grenades'))) g.price = Math.max(2, g.price - 3); });
        await DW.UI.trade({ goods: goods, intro: who + ' показывает, что есть на обмен. Берут драгоценности и стройматериалы.' });
      }
      if (a === 'merc') { const s = G.hireMerc(f); if (s) { DW.SFX.play('portal'); await DW.UI.alert('Наёмник', '«' + s.name + '» (' + D.CLASSES[s.cls].n.toLowerCase() + ') с вами до ' + s.merc.until + '-го дня.', 'good'); } }
      G.save(); WS.refresh();
    }
    G.save(); WS.refresh();
  }
  function outpost(n) {
    const G = DW.G;
    if (!G.pay({ materials: 12 })) return;
    n.outpost = true;
    G.log('В «' + n.name + '» поставлен бур.');
    DW.SFX.play('build');
    DW.UI.toast('Бур установлен: +3 драгоценности в день', 'good');
    G.save(); WS.refresh();
  }
  function beacon(n) {
    const G = DW.G;
    if (!G.pay({ materials: 8, gems: 10 })) return;
    n.beacon = true;
    if (n.id === G.state.baseNode) G.state.buildings.beacon = 1;
    G.log('В «' + n.name + '» поставлен маяк портала.');
    DW.SFX.play('portal');
    DW.UI.toast('Маяк установлен: сюда можно заказывать грузы', 'good');
    G.save(); WS.refresh();
  }
  async function foundBase(n) {
    const G = DW.G;
    const ok = await DW.UI.confirm('Основать базу', 'Основать базу в «' + n.name + '»? Базу нельзя перенести. Здесь отряд будет лечиться быстрее, можно строить укрепления и производство. Но на базу будут нападать.', 'Основать');
    if (!ok) return;
    G.foundBase(n.id);
    DW.SFX.play('build');
    G.save(); WS.refresh();
    DW.Main.setScene(DW.BaseS);
  }

  function openMenu() {
    const body = el('div', { class: 'menubox' });
    body.appendChild(DW.UI.settingsRow());
    DW.UI.modal({
      title: 'Меню', cls: 'small', body: body,
      buttons: [
        { text: 'Как играть', close: false, onClick: function () { DW.UI.help(); } },
        { text: 'Сохранить и выйти', onClick: function () { DW.G.save(); DW.Main.toMenu(); } },
        { text: 'Продолжить', cls: 'primary' }
      ]
    });
  }

  DW.WS = WS;
})(window.DW);
