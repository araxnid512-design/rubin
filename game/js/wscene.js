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
    const T = D.NODE_TYPES[n.type];
    const here = n.id === st.squadAt;
    let status;
    if (n.id === st.baseNode) status = '<span class="good">Ваша база</span>';
    else if (n.cleared) status = '<span class="good">Зачищено</span>';
    else status = '<span class="bad">Враги</span> ' + DW.UI.skulls(n.diff);
    const extra = [];
    if (n.beacon) extra.push(n.type === 'landing' ? 'Портал: сюда приходят грузы' : 'Маяк: сюда можно заказывать грузы');
    if (n.outpost) extra.push('Бур: +3 ' + ic('gems') + ' в день');
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
    if (here) {
      p.appendChild(el('div', { class: 'pn-here', text: 'Отряд здесь' }));
      if (!n.cleared) add('Атаковать', function () { WS.attack(n, 'normal'); }, 'primary');
      else {
        if (n.id === st.baseNode) add('Отдых (1 день)', function () { waitDay('Отряд отдыхает на базе.'); }, 'primary');
        if (n.type === 'ruins') add('Обыскать (1 день)', function () { search(n); }, '', n.searches <= 0);
        if (n.type === 'vein') add('Добывать кристаллы (1 день)', function () { mine(n); }, 'primary');
        if (n.type === 'vein' && !n.outpost) add('Поставить бур · 12 ' + ic('materials'), function () { outpost(n); }, '', st.baseNode === null || st.res.materials < 12);
        if (n.type === 'site' && st.baseNode === null) add('Основать базу', function () { foundBase(n); }, 'primary');
        if (!n.beacon) add('Поставить маяк · 8 ' + ic('materials') + ' 10 ' + ic('gems'), function () { beacon(n); }, '', !G.canAfford({ materials: 8, gems: 10 }));
        if (n.type === 'vein' && n.outpost && st.baseNode === null) void 0;
      }
      if (n.type === 'vein' && !n.outpost && st.baseNode === null && n.cleared) p.appendChild(el('div', { class: 'pn-note', text: 'Бур можно поставить после основания базы.' }));
    } else {
      const path = G.findPath(st.squadAt, n.id);
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
    WS.refresh();
    if (G.state.over) { G.save(); DW.Main.ending(G.state.over); return 'over'; }
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
    const txt = raid.kind === 'beast' ? 'Стая мутантов идёт на штурм.' : 'Банда пришла за вашими припасами.';
    const ids = await DW.UI.briefing(base, 'defense', txt);
    DW.Main.startBattle({ nodeId: st.baseNode, type: base.type, diff: Math.min(5, 1 + Math.floor(st.day / 8)), kind: 'defense', raid: raid, squad: ids || st.roster.slice(0, 6).map(function (s) { return s.id; }) });
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
      if (!node.cleared) {
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
    const m = U.rand(2, 5), f = U.rand(0, 5), g = U.rand(0, 3) + (n.diff > 2 ? 2 : 0);
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
