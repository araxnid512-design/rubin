'use strict';
/* DOM-интерфейс: окна, уведомления, экраны отряда/базы/портала/журнала */
(function (DW) {
  const U = DW.U, D = DW.D;
  const el = U.el;
  const UI = {};
  const stack = [];

  function layer() { return document.getElementById('modal-layer'); }
  function ic(name, cls) { return D.icon(name, cls); }
  UI.ic = ic;

  /* ---------- Окна ---------- */
  UI.modal = function (o) {
    const back = el('div', { class: 'modal-back' });
    const box = el('div', { class: 'modal ' + (o.cls || '') });
    const head = el('div', { class: 'mhead' }, [el('div', { class: 'mtitle', html: o.title || '' })]);
    const h = { el: box, closed: false, closable: o.closable !== false };
    if (h.closable) {
      head.appendChild(el('button', { class: 'mclose', html: D.ICONS.close, onclick: function () { h.close(); } }));
    }
    box.appendChild(head);
    const body = el('div', { class: 'mbody' });
    if (typeof o.body === 'string') body.innerHTML = o.body;
    else if (o.body) body.appendChild(o.body);
    box.appendChild(body);
    h.body = body;
    if (o.buttons && o.buttons.length) {
      const foot = el('div', { class: 'mfoot' });
      o.buttons.forEach(function (b) {
        const btn = el('button', { class: 'btn ' + (b.cls || ''), html: b.text });
        if (b.disabled) btn.disabled = true;
        btn.addEventListener('click', function () {
          DW.SFX.play('click');
          if (b.onClick) b.onClick(h);
          if (b.close !== false) h.close();
        });
        foot.appendChild(btn);
      });
      box.appendChild(foot);
      h.foot = foot;
    }
    back.appendChild(box);
    if (h.closable && o.backdropClose !== false) {
      back.addEventListener('click', function (e) { if (e.target === back) h.close(); });
    }
    h.back = back;
    h.close = function () {
      if (h.closed) return;
      h.closed = true;
      const i = stack.indexOf(h);
      if (i >= 0) stack.splice(i, 1);
      if (back.parentNode) back.parentNode.removeChild(back);
      if (o.onClose) o.onClose();
    };
    layer().appendChild(back);
    stack.push(h);
    return h;
  };
  UI.closeTop = function () {
    const h = stack[stack.length - 1];
    if (!h) return false;
    if (h.closable) h.close();
    return true;
  };
  UI.hasModal = function () { return stack.length > 0; };
  UI.closeAll = function () { while (stack.length) { const h = stack[stack.length - 1]; h.closable = true; h.close(); } };

  UI.alert = function (title, html, kind) {
    return new Promise(function (res) {
      UI.modal({
        title: title, cls: 'small ' + (kind ? 'k-' + kind : ''), body: '<div class="ptext">' + html + '</div>',
        buttons: [{ text: 'Ясно', cls: 'primary' }], onClose: res
      });
    });
  };
  UI.confirm = function (title, html, yes, no) {
    return new Promise(function (res) {
      let r = false;
      UI.modal({
        title: title, cls: 'small', body: '<div class="ptext">' + html + '</div>',
        buttons: [{ text: no || 'Отмена' }, { text: yes || 'Да', cls: 'primary', onClick: function () { r = true; } }],
        onClose: function () { res(r); }
      });
    });
  };
  UI.choice = function (title, html, options) {
    return new Promise(function (res) {
      let r = -1;
      UI.modal({
        title: title, cls: 'small', closable: false, body: '<div class="ptext">' + html + '</div>',
        buttons: options.map(function (o, i) {
          return { text: o.text, cls: i === 0 ? 'primary' : '', disabled: o.disabled, onClick: function () { r = i; } };
        }),
        onClose: function () { res(r); }
      });
    });
  };
  UI.toast = function (text, kind) {
    const l = document.getElementById('toast-layer');
    const t = el('div', { class: 'toast ' + (kind || ''), html: text });
    l.appendChild(t);
    while (l.children.length > 3) l.removeChild(l.firstChild);
    setTimeout(function () { t.classList.add('out'); }, 2200);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2700);
  };

  /* ---------- Вспомогательное ---------- */
  function hpBar(hp, max) {
    const pct = Math.round(hp / max * 100);
    const cls = pct <= 34 ? 'low' : (pct < 100 ? 'mid' : '');
    return '<div class="hpbar ' + cls + '"><i style="width:' + pct + '%"></i><span>' + hp + '/' + max + '</span></div>';
  }
  UI.hpBar = hpBar;
  function skulls(n) { let s = ''; for (let i = 0; i < n; i++) s += '<i class="skull"></i>'; return '<span class="skulls">' + s + '</span>'; }
  UI.skulls = skulls;

  /* ---------- Отряд ---------- */
  function rankBadge(r) { let h = '<span class="rankb">'; for (let i = 0; i < r; i++) h += '<i></i>'; return h + '</span>'; }
  UI.rankBadge = rankBadge;
  function statRow(label, val, max, suffix) {
    return '<div class="stat"><span>' + label + '</span><div class="sbar"><i style="width:' + Math.min(100, Math.round(val / max * 100)) + '%"></i></div><b>' + val + (suffix || '') + '</b></div>';
  }
  UI.squad = function (onChange) {
    const G = DW.G, st = G.state;
    let selId = st.roster.length ? st.roster[0].id : null;
    const wrap = el('div', { class: 'squad' });
    const list = el('div', { class: 'slist' });
    const det = el('div', { class: 'sdet' });
    wrap.appendChild(list); wrap.appendChild(det);
    function render() {
      list.innerHTML = '';
      st.roster.forEach(function (s) {
        const c = D.CLASSES[s.cls];
        const card = el('div', { class: 'scard' + (s.id === selId ? ' sel' : ''), onclick: function () { selId = s.id; DW.SFX.play('click'); render(); } });
        card.appendChild(el('img', { class: 'ava', src: DW.ART.portrait(s), style: 'border-color:' + c.color }));
        const sc = el('div', { class: 'sc' });
        sc.innerHTML = '<div class="sname">' + s.name + rankBadge(G.rank(s)) + '</div>' + hpBar(G.hp(s), G.maxHp(s)) +
          '<div class="sline">' + c.n + ' · ' + (D.WEAPONS[s.weapon].s || D.WEAPONS[s.weapon].n) + (s.wounds > 0 ? ' · <span class="bad">ранен</span>' : '') + '</div>';
        card.appendChild(sc);
        list.appendChild(card);
      });
      det.innerHTML = '';
      const s = st.roster.find(function (x) { return x.id === selId; });
      if (!s) return;
      const c = D.CLASSES[s.cls], ab = D.ABIL[c.ab];
      const rk = G.rank(s);
      const next = D.RANKS[rk + 1];
      const top = el('div', { class: 'dtop' });
      top.appendChild(el('img', { class: 'ava', src: DW.ART.portrait(s), style: 'border-color:' + c.color }));
      top.appendChild(el('img', { class: 'fig', src: DW.ART.figureURL(s), alt: '' }));
      const info = el('div', { class: 'dinfo' });
      const TRt = D.TRAITS[s.trait];
      info.innerHTML = '<div class="dhead">' + s.name + ' <button class="btn sm ren">✎</button></div>' +
        '<div><span class="tag" style="border-color:' + c.color + ';color:' + c.color + '">' + c.n + '</span><span class="tag">' + D.RANKS[rk].n + rankBadge(rk) + '</span>' +
        (TRt ? '<span class="tag trait" title="' + TRt.d + '">' + TRt.n + '</span>' : '') + '</div>' +
        (TRt ? '<div class="small dim">' + TRt.n + ': ' + TRt.d + '</div>' : '') +
        ((s.perks || []).length ? '<div class="small">Навыки: ' + s.perks.map(function (p) { return '<b class="acc">' + D.PERKS[p].n + '</b>'; }).join(', ') + '</div>' : '') +
        '<div class="small dim">Опыт ' + s.xp + (next ? ' / ' + next.xp : '') + ' · убийств ' + s.kills + ' · заданий ' + s.missions + '</div>' +
        (next ? '<div class="pbar"><i style="width:' + Math.round((s.xp - D.RANKS[rk].xp) / (next.xp - D.RANKS[rk].xp) * 100) + '%;background:linear-gradient(90deg,#a8661a,#e8a83e)"></i></div>' : '') +
        hpBar(G.hp(s), G.maxHp(s));
      top.appendChild(info);
      det.appendChild(top);
      const rb = info.querySelector('.ren');
      if (rb) rb.onclick = function () { UI.rename(s, function () { render(); if (onChange) onChange(); }); };
      det.appendChild(el('div', { class: 'stats', html:
        statRow('Меткость', G.aim(s), 100) + statRow('Подвижность', G.mob(s), 8) +
        statRow('Здоровье', G.maxHp(s), 20) + statRow('Броня', D.ARMORS[s.armor].armor, 3) }));
      det.appendChild(el('div', { class: 'abil', html: D.icon(c.ab) + '<div><b>' + ab.n + '.</b> ' + ab.desc + '</div>' }));
      if (s.wounds > 0) det.appendChild(el('div', { class: 'note', html: 'Ранен: восстановится за ~' + Math.ceil(s.wounds / (st.baseNode !== null && st.squadAt === st.baseNode ? (G.blv('infirmary') ? 4 : 2) : 1)) + ' дн.' }));
      const wl = el('div', { class: 'equip' });
      wl.appendChild(el('div', { class: 'elabel', text: 'Оружие' }));
      const wrow = el('div', { class: 'erow' });
      D.PLAYER_WEAPONS.forEach(function (w) {
        const have = st.stock.weapons[w] || 0;
        if (w !== s.weapon && !have) return;
        const W = D.WEAPONS[w];
        const b = el('button', {
          class: 'chip' + (w === s.weapon ? ' on' : ''),
          html: '<img src="' + DW.ART.weaponIcon(w) + '" alt=""><span class="ct"><span>' + W.n + (w !== s.weapon ? ' <small>×' + have + '</small>' : '') + '</span><em>урон ' + W.dmg[0] + '–' + W.dmg[1] + ' · обойма ' + W.clip + ' · крит ' + W.crit + '%</em></span>',
          onclick: function () {
            if (w === s.weapon) return;
            st.stock.weapons[w]--;
            st.stock.weapons[s.weapon] = (st.stock.weapons[s.weapon] || 0) + 1;
            s.weapon = w; DW.SFX.play('reload'); render(); if (onChange) onChange();
          }
        });
        wrow.appendChild(b);
      });
      wl.appendChild(wrow);
      wl.appendChild(el('div', { class: 'edesc', text: D.WEAPONS[s.weapon].desc }));
      det.appendChild(wl);
      const al = el('div', { class: 'equip' });
      al.appendChild(el('div', { class: 'elabel', text: 'Броня' }));
      const arow = el('div', { class: 'erow' });
      D.PLAYER_ARMORS.forEach(function (a) {
        const have = a === 'robe' ? 1 : (st.stock.armors[a] || 0);
        if (a !== s.armor && !have) return;
        const A = D.ARMORS[a];
        const b = el('button', {
          class: 'chip' + (a === s.armor ? ' on' : ''),
          html: '<img src="' + DW.ART.armorIcon(a) + '" alt=""><span class="ct"><span>' + A.n + (a !== s.armor && a !== 'robe' ? ' <small>×' + have + '</small>' : '') + '</span><em>' + A.desc + '</em></span>',
          onclick: function () {
            if (a === s.armor) return;
            if (a !== 'robe') st.stock.armors[a]--;
            if (s.armor !== 'robe') st.stock.armors[s.armor] = (st.stock.armors[s.armor] || 0) + 1;
            s.armor = a;
            s.wounds = Math.min(s.wounds, G.maxHp(s) - 1);
            DW.SFX.play('reload'); render(); if (onChange) onChange();
          }
        });
        arow.appendChild(b);
      });
      al.appendChild(arow);
      det.appendChild(al);
    }
    render();
    UI.modal({ title: D.icon('squad') + ' Отряд — ' + st.roster.length + ' ' + U.plural(st.roster.length, 'боец', 'бойца', 'бойцов'), cls: 'wide', body: wrap, onClose: onChange });
  };

  /* ---------- База ---------- */
  UI.base = function (onChange) {
    const G = DW.G, st = G.state;
    const body = el('div', { class: 'basebox' });
    let h = null;
    function render() {
      body.innerHTML = '';
      if (st.baseNode === null) {
        body.innerHTML = '<div class="ptext">База ещё не основана.<br><br>Найдите локацию типа <b style="color:#7fb069">«Укрытие»</b>, зачистите её и нажмите «Основать базу». ' +
          'На базе раненые лечатся быстрее, можно строить укрепления, мастерскую, теплицу и маяк портала.</div>';
        return;
      }
      const n = G.node(st.baseNode);
      const prod = [];
      if (G.blv('farm')) prod.push('+5 ' + ic('food'));
      if (G.blv('workshop')) prod.push('+15 ' + ic('ammo') + ' (−1 ' + ic('materials') + ')');
      let og = 0; st.world.nodes.forEach(function (x) { if (x.outpost) og += 3; });
      if (og) prod.push('+' + og + ' ' + ic('gems') + ' (буры)');
      body.appendChild(el('div', { class: 'bhead', html: '<img src="' + DW.ART.landmark('base', { key: JSON.stringify(st.buildings), b: st.buildings }).toDataURL() + '" alt="">' +
        '<div class="ptext"><div class="pn-title">' + n.name + '</div>Ваш плацдарм в мёртвом мире. Стройте укрепления и производство — и держите оборону.</div>' }));
      body.appendChild(el('div', { class: 'binfo', html:
        '<b>' + n.name + '</b> · защита базы: <b>' + G.defenseScore() + '</b>' +
        (st.raid ? ' · <span class="bad">набег через ' + Math.max(0, st.raid.day - st.day) + ' дн.!</span>' : '') +
        '<br>В день: ' + (prod.length ? prod.join(', ') : 'ничего') + ' · расход еды: −' + st.roster.length + ' ' + ic('food') }));
      const grid = el('div', { class: 'bgrid' });
      Object.keys(D.BUILDINGS).forEach(function (id) {
        const b = D.BUILDINGS[id];
        const lv = G.blv(id);
        const done = lv >= b.max;
        const locked = b.tier && G.tier() < b.tier;
        const cost = b.cost[Math.min(lv, b.cost.length - 1)];
        const title = b.levels ? (lv ? b.levels[lv - 1] : b.n) : b.n;
        const card = el('div', { class: 'bcard' + (lv ? ' built' : '') });
        card.innerHTML = '<img src="' + DW.ART.buildingIcon(id) + '" alt=""><div class="bt">' + title + (b.max > 1 ? ' <small>' + lv + '/' + b.max + '</small>' : '') + '</div><div class="bd">' + b.desc + '</div>';
        let btn;
        if (done) btn = el('div', { class: 'bdone', text: 'Построено' });
        else if (locked) btn = el('div', { class: 'block', text: 'Нужно доверие: ' + D.TIERS[b.tier].n });
        else {
          const label = (b.levels && lv ? 'Улучшить: ' + b.levels[lv] : 'Построить') + ' · ' + G.costText(cost);
          btn = el('button', { class: 'btn sm', html: label, onclick: function () {
            if (G.build(id)) { DW.SFX.play('build'); UI.toast('Построено: ' + (b.levels ? b.levels[lv] : b.n), 'good'); G.save(); render(); if (onChange) onChange(); }
          } });
          if (!G.canAfford(cost)) btn.disabled = true;
        }
        card.appendChild(btn);
        grid.appendChild(card);
      });
      body.appendChild(grid);
    }
    render();
    h = UI.modal({ title: 'База', cls: 'wide', body: body, onClose: onChange });
    return h;
  };

  /* ---------- Портал ---------- */
  UI.portal = function (onChange) {
    const G = DW.G, st = G.state;
    const cart = {};
    const drops = st.world.nodes.filter(function (n) { return n.beacon; });
    let drop = (st.baseNode !== null && G.node(st.baseNode).beacon) ? st.baseNode : (G.node(st.squadAt).beacon ? st.squadAt : st.world.landing);
    const body = el('div', { class: 'portal' });
    let h = null;
    function total() { let s = 0; for (const k in cart) s += G.catalogItem(k).price * cart[k]; return s; }
    function render() {
      body.innerHTML = '';
      const tier = G.tier();
      const nextT = D.TIERS[tier + 1];
      const prog = nextT ? Math.round((st.delivered - D.TIERS[tier].need) / (nextT.need - D.TIERS[tier].need) * 100) : 100;
      body.appendChild(el('div', { class: 'phead', html:
        '<div>Доверие Института: <b class="acc">' + D.TIERS[tier].n + '</b>' + (nextT ? ' · до «' + nextT.n + '»: ' + (nextT.need - st.delivered) + ' ' + ic('gems') : '') + '</div>' +
        '<div class="pbar"><i style="width:' + prog + '%"></i></div>' +
        '<div class="small dim">Сдано всего: ' + st.delivered + ' / ' + D.GOAL + ' — за ' + D.GOAL + ' Институт обещает колонии вольную.</div>' }));
      const grid = el('div', { class: 'pgrid' });
      D.CATALOG.forEach(function (c) {
        const locked = c.tier > tier;
        const q = cart[c.id] || 0;
        const item = el('div', { class: 'pitem' + (locked ? ' locked' : '') + (q ? ' in' : '') });
        const pic = c.give.weapon ? '<img src="' + DW.ART.weaponIcon(c.give.weapon) + '" alt="">' : (c.give.armor ? '<img src="' + DW.ART.armorIcon(c.give.armor) + '" alt="">' : ic(c.icon));
        item.innerHTML = '<div class="pi-ic">' + pic + '</div><div class="pi-t">' + c.n + ' <small>' + c.q + '</small><br><b>' + c.price + '</b> ' + ic('gems') +
          (locked ? ' <span class="lock">' + D.TIERS[c.tier].n + '</span>' : '') + '</div>';
        if (!locked) {
          const ctr = el('div', { class: 'pi-q' });
          ctr.appendChild(el('button', { class: 'qb', text: '−', onclick: function () { if (cart[c.id]) { cart[c.id]--; if (!cart[c.id]) delete cart[c.id]; render(); } } }));
          ctr.appendChild(el('span', { text: String(q) }));
          ctr.appendChild(el('button', { class: 'qb', text: '+', onclick: function () { cart[c.id] = (cart[c.id] || 0) + 1; render(); } }));
          item.appendChild(ctr);
        }
        grid.appendChild(item);
      });
      body.appendChild(grid);
      const dsel = el('div', { class: 'drops' });
      dsel.appendChild(el('span', { class: 'dim', text: 'Доставка (завтра): ' }));
      drops.forEach(function (n) {
        dsel.appendChild(el('button', { class: 'chip sm' + (n.id === drop ? ' on' : ''), text: n.name + (n.id === st.baseNode ? ' (база)' : ''), onclick: function () { drop = n.id; render(); } }));
      });
      body.appendChild(dsel);
      if (st.orders.length) {
        body.appendChild(el('div', { class: 'small dim', html: 'В пути: ' + st.orders.map(function (o) { return o.items.length + ' поз. → «' + G.node(o.drop).name + '»'; }).join('; ') }));
      }
      const tot = total();
      if (h && h.foot) {
        const ob = h.foot.querySelector('.order');
        ob.innerHTML = 'Отправить ' + tot + ' ' + ic('gems');
        ob.disabled = !tot || tot > st.res.gems;
        h.foot.querySelector('.have').innerHTML = 'У вас: <b>' + st.res.gems + '</b> ' + ic('gems');
        h.foot.querySelector('.donate').disabled = st.res.gems < 10;
      }
    }
    h = UI.modal({
      title: ic('portal') + ' Портал — заказ у Института', cls: 'wide', body: body, onClose: onChange,
      buttons: [
        { text: '', cls: 'ghost have', close: false },
        { text: 'Сдать 10 ' + ic('gems'), cls: 'donate', close: false, onClick: function () {
          const r = G.donate(10);
          if (r) { DW.SFX.play('portal'); if (r.tierUp) UI.toast('Новый уровень доверия: ' + D.TIERS[G.tier()].n, 'good'); G.save(); render(); if (G.checkGoal()) { h.close(); } }
        } },
        { text: 'Отправить', cls: 'primary order', close: false, onClick: function () {
          const r = G.placeOrder(cart, drop);
          if (!r) return;
          for (const k in cart) delete cart[k];
          DW.SFX.play('portal');
          UI.toast('Драгоценности ушли в Портал. Груз прибудет завтра в «' + G.node(drop).name + '».', 'good');
          if (r.tierUp) setTimeout(function () { UI.toast('Новый уровень доверия: ' + D.TIERS[G.tier()].n + '! Открыты новые товары.', 'good'); }, 600);
          G.save(); render();
          if (G.checkGoal()) h.close();
        } }
      ]
    });
    render();
    return h;
  };

  /* ---------- Журнал ---------- */
  UI.journal = function () {
    const G = DW.G, st = G.state;
    let lairs = 0;
    st.world.nodes.forEach(function (n) { if (n.type === 'lair' && n.cleared) lairs++; });
    const b = el('div', { class: 'journal' });
    b.innerHTML =
      '<div class="jgoals"><div class="jg"><b>Вольная</b>: сдать Институту ' + D.GOAL + ' ' + ic('gems') + ' — <b>' + st.delivered + '</b>/' + D.GOAL +
      '<div class="pbar"><i style="width:' + Math.min(100, st.delivered / D.GOAL * 100) + '%"></i></div></div>' +
      '<div class="jg"><b>Гнездо</b>: уничтожить Матку. Путь открывается после разгрома двух логов — <b>' + lairs + '</b>/2</div></div>' +
      '<div class="jstats">День ' + st.day + ' · миссий: ' + st.stats.missions + ' (побед ' + st.stats.won + ') · убито врагов: ' + st.stats.kills +
      ' · логов: ' + st.stats.lairs + ' · лагерей: ' + st.stats.camps + '</div>' +
      (st.memorial.length ? '<div class="jmem"><b>Погибшие:</b> ' + st.memorial.map(function (m) {
        const fake = { id: m.id || m.name, name: m.name, cls: m.cls || 'rifleman', armor: m.armor || 'robe', look: m.look };
        return '<span class="m"><img class="ava" src="' + DW.ART.portrait(fake) + '" alt="">' + m.name + ' <small>д.' + m.day + ', убийств ' + m.kills + '</small></span>';
      }).join('') + '</div>' : '') +
      '<div class="jlog">' + st.log.map(function (l) { return '<div><span>День ' + l.day + '</span> ' + l.text + '</div>'; }).join('') + '</div>';
    UI.modal({ title: 'Журнал', cls: 'wide', body: b });
  };

  /* ---------- Брифинг ---------- */
  UI.briefing = function (node, kind, extra) {
    const G = DW.G, st = G.state;
    return new Promise(function (res) {
      const chosen = {};
      const sorted = st.roster.slice().sort(function (a, b) { return G.hp(b) / G.maxHp(b) - G.hp(a) / G.maxHp(a); });
      sorted.slice(0, 6).forEach(function (s) { chosen[s.id] = 1; });
      const T = D.NODE_TYPES[node.type];
      const intel = {
        landing: 'мутанты', ruins: 'мутанты или бандиты', vein: 'мутанты', camp: 'бандиты' + (node.diff >= 3 ? ' и главарь' : ''),
        lair: 'стая мутантов и вожак', site: 'мутанты или бандиты', vault: 'механические стражи', nest: 'Матка и её выводок'
      }[node.type];
      let lairs = 0;
      st.world.nodes.forEach(function (n) { if (n.type === 'lair' && n.cleared) lairs++; });
      const locked = node.type === 'nest' && lairs < 2 && kind !== 'defense';
      const body = el('div', { class: 'brief' });
      let result = null;
      let h = null;
      function render() {
        body.innerHTML = '';
        if (kind === 'defense') {
          body.appendChild(el('div', { class: 'ptext', html: '<b class="bad">Нападение на базу!</b> ' + (extra || '') + ' Займите позиции за укреплениями и отбейте три волны. Отступление — потеря части припасов и построек.' }));
        } else {
          const types = {
            landing: ['scav', 'spitter'], ruins: ['scav', 'raider', 'thug'], vein: ['scav', 'spitter', 'brute'], camp: ['raider', 'thug', 'marksman', 'boss'],
            lair: ['scav', 'spitter', 'brute'], site: ['raider', 'scav', 'marksman'], vault: ['guardian', 'scav'], nest: ['queen', 'brute', 'spitter']
          }[node.type] || [];
          const shown = types.filter(function (t) { return !(t === 'boss' && node.diff < 3) && !(t === 'brute' && node.diff < 3 && node.type !== 'nest') && !(t === 'marksman' && node.diff < 3); });
          body.appendChild(el('div', { class: 'bhead', html: '<img src="' + DW.ART.landmarkURL(node.type) + '" alt=""><div class="ptext"><b>' + T.n + '</b>' + (D.MAP_NAMES[node.map] ? ' — ' + D.MAP_NAMES[node.map].toLowerCase() : '') + ' · опасность ' + skulls(node.diff) + '<br>' + T.desc +
            '<br>Разведка: <b>' + intel + '</b>.' + (kind === 'ambush' ? ' <b class="bad">Засада!</b>' : '') +
            '<div class="intel">' + shown.map(function (t) { return '<img class="ava" title="' + D.ENEMIES[t].n + '" src="' + DW.ART.enemyPortrait(t) + '" alt="">'; }).join('') + '</div>' +
            (locked ? '<b class="bad">Гнездо слишком сильно. Сначала уничтожьте два логова мутантов (' + lairs + '/2).</b>' : '') + '</div>' }));
        }
        const cnt = Object.keys(chosen).length;
        body.appendChild(el('div', { class: 'blabel', html: 'Бойцы на задание: <b>' + cnt + '</b>/6' }));
        const grid = el('div', { class: 'bsel' });
        st.roster.forEach(function (s) {
          const on = !!chosen[s.id];
          const c = D.CLASSES[s.cls];
          const card = el('div', { class: 'bpick' + (on ? ' on' : ''), onclick: function () {
            if (chosen[s.id]) delete chosen[s.id];
            else if (Object.keys(chosen).length < 6) chosen[s.id] = 1;
            render();
          } });
          card.appendChild(el('img', { class: 'ava', src: DW.ART.portrait(s), style: 'border-color:' + c.color }));
          const sc = el('div', { class: 'sc' });
          sc.innerHTML = '<div class="sname">' + s.name + rankBadge(G.rank(s)) + '</div>' + hpBar(G.hp(s), G.maxHp(s)) +
            '<div class="sline">' + c.n + ' · ' + (D.WEAPONS[s.weapon].s || '') + '</div>';
          card.appendChild(sc);
          grid.appendChild(card);
        });
        body.appendChild(grid);
        if (h && h.foot) {
          const go = h.foot.querySelector('.go');
          if (go) go.disabled = !cnt || locked;
        }
      }
      const buttons = [];
      if (kind !== 'defense') buttons.push({ text: 'Отступить', onClick: function () { result = null; } });
      buttons.push({ text: 'В бой!', cls: 'primary go', onClick: function () { result = Object.keys(chosen); } });
      h = UI.modal({
        title: (kind === 'defense' ? 'Оборона базы' : node.name), cls: 'wide', body: body, closable: kind !== 'defense',
        buttons: buttons, onClose: function () { res(result); }
      });
      render();
    });
  };

  /* ---------- Итоги боя ---------- */
  UI.results = function (sum) {
    return new Promise(function (res) {
      const title = sum.result === 'victory' ? 'Победа' : (sum.result === 'evac' ? 'Отступление' : 'Поражение');
      const b = el('div', { class: 'results' });
      const loot = [];
      for (const k in sum.loot) loot.push('+' + sum.loot[k] + ' ' + ic(k));
      sum.items.forEach(function (i) { loot.push(i); });
      let html = '<div class="ptext">' + (sum.text || '') + '</div>';
      html += '<div class="rloot">' + (loot.length ? 'Добыча: ' + loot.join(' · ') : 'Добычи нет.') + '</div>';
      const scarred = sum.scarred || [];
      const cards = sum.soldiers.map(function (s) {
        const sc = scarred.indexOf(s.name) >= 0;
        return '<div class="rs' + (s.promo ? ' promo' : '') + '"><img class="ava" src="' + DW.ART.portrait(s.ref) + '" alt=""><div class="sc"><b>' + s.name + (s.promo ? ' <span class="acc">▲ ' + s.promo + '</span>' : '') + '</b>' + hpBar(s.hp, s.maxHp) +
          '<small>' + (s.saved ? '<span class="acc">спасён после тяжёлого ранения</span> · ' : '') + 'убийств: ' + s.kills + ' · опыт +' + s.xp + (sc ? ' · <span class="bad">новый шрам</span>' : '') + '</small></div></div>';
      }).concat((sum.deadRefs || []).map(function (r) {
        return '<div class="rs kia"><img class="ava" src="' + DW.ART.portrait(r) + '" alt=""><div class="sc"><b>' + r.name + '</b><span class="bad">Погиб</span></div></div>';
      }));
      if (cards.length) html += '<div class="rsol">' + cards.join('') + '</div>';
      b.innerHTML = html;
      (sum.perkChoices || []).forEach(function (pc) {
        if (!pc.opts.length) return;
        const box = el('div', { class: 'perkc' });
        box.appendChild(el('div', { class: 'pk-t', html: '<b class="acc">' + pc.s.name + '</b> повышен — выберите навык:' }));
        const row = el('div', { class: 'pk-r' });
        pc.opts.forEach(function (k) {
          const bt = el('button', { class: 'btn sm', html: '<b>' + D.PERKS[k].n + '</b><br><small>' + D.PERKS[k].d + '</small>', onclick: function () {
            if (pc.done) return;
            pc.done = true; pc.s.perks = pc.s.perks || []; pc.s.perks.push(k);
            row.querySelectorAll('button').forEach(function (x) { x.disabled = true; });
            bt.classList.add('primary');
            DW.SFX.play('build'); DW.G.save();
          } });
          row.appendChild(bt);
        });
        box.appendChild(row);
        b.appendChild(box);
      });
      UI.modal({ title: title, cls: 'wide k-' + (sum.result === 'victory' ? 'good' : 'bad'), body: b, closable: false, buttons: [{ text: 'Продолжить', cls: 'primary' }], onClose: function () {
        (sum.perkChoices || []).forEach(function (pc) { if (!pc.done && pc.opts.length) { pc.done = true; pc.s.perks = pc.s.perks || []; pc.s.perks.push(pc.opts[0]); } });
        DW.G.save(); res();
      } });
    });
  };

  /* ---------- Переименование бойца ---------- */
  UI.rename = function (s, done) {
    const body = el('div', { class: 'renbox' });
    const inp = el('input', { class: 'reninp', type: 'text', maxlength: '16', value: s.name });
    body.appendChild(el('div', { class: 'small dim', text: 'Кличка бойца (до 16 знаков):' }));
    body.appendChild(inp);
    UI.modal({ title: 'Переименовать', cls: 'small', body: body, buttons: [
      { text: 'Отмена' },
      { text: 'Сохранить', cls: 'primary', onClick: function () {
        const v = (inp.value || '').replace(/[<>&"]/g, '').trim().slice(0, 16);
        if (v) { DW.G.log('«' + s.name + '» теперь зовут «' + v + '».'); s.name = v; DW.G.save(); }
        if (done) done();
      } }
    ] });
    setTimeout(function () { try { inp.focus(); inp.select(); } catch (e) { /* ignore */ } }, 50);
  };

  /* ---------- Справка ---------- */
  UI.help = function () {
    const html =
      '<h3>Цель</h3><p>Мёртвый мир, переживший войну, стал тюрьмой без решёток. Вас, заключённых, выбросили туда через Портал в один конец. Институт ждёт ценности — драгоценные кристаллы. Сдайте ' + D.GOAL + ' драгоценностей — и колония получит вольную. Или уничтожьте Матку в Гнезде.</p>' +
      '<h3>Карта мира</h3><p>Нажмите на локацию, чтобы увидеть её и выдвинуться. Переход занимает 1 день, каждый день отряд съедает по 1 провизии на бойца. ' +
      'Враждебные локации (красное кольцо) нужно зачистить в бою. Зачищенные руины можно обыскивать, а на жилах — добывать кристаллы.</p>' +
      '<h3>Портал</h3><p>Тратьте драгоценности на заказы: патроны, еду, оружие, броню, новых бойцов. Груз приходит на следующий день в точку высадки или на маяк. ' +
      'Чем больше сдано, тем выше доверие Института и лучше товары.</p>' +
      '<h3>База</h3><p>Зачистите «Укрытие» и основайте базу. Стройте укрепления, лазарет, мастерскую, теплицу, маяк портала. На базу нападают — будьте рядом или укрепляйтесь.</p>' +
      '<h3>Бой</h3><p>У бойца 2 очка действия (ОД). Синяя зона — перемещение за 1 ОД, жёлтая — за 2. Нажмите клетку, затем ещё раз для подтверждения. ' +
      'Выстрел завершает ход бойца. Щиты у клетки показывают укрытие: половинное (−20 к попаданию по вам) и полное (−40). Обходите врага с фланга — без укрытия он уязвим и получает криты.</p>' +
      '<p><b>Дозор</b> — боец выстрелит по первому двинувшемуся врагу. <b>Залечь</b> — +20 к защите. Гранаты разрушают укрытия. ' +
      'Патроны общие: каждый выстрел тратит запас отряда. В зелёной зоне можно эвакуироваться.</p>' +
      '<p>Управление: перетаскивание — сдвиг карты, два пальца — масштаб.</p>';
    UI.modal({ title: 'Как играть', cls: 'wide', body: el('div', { class: 'help', html: html }) });
  };

  /* ---------- Настройки ---------- */
  UI.settingsRow = function () {
    const box = el('div', { class: 'setrow' });
    function render() {
      box.innerHTML = '';
      box.appendChild(el('button', { class: 'btn', text: 'Звук: ' + (DW.settings.sound ? 'вкл' : 'выкл'), onclick: function () {
        DW.settings.sound = !DW.settings.sound; DW.saveSettings(); render();
      } }));
      box.appendChild(el('button', { class: 'btn', text: 'Скорость боя: ×' + DW.settings.speed, onclick: function () {
        DW.settings.speed = DW.settings.speed >= 3 ? 1 : DW.settings.speed + 1; DW.saveSettings(); render();
      } }));
      box.appendChild(el('button', { class: 'btn', text: 'Кинокамера: ' + (DW.settings.cine !== false ? 'вкл' : 'выкл'), onclick: function () {
        DW.settings.cine = DW.settings.cine === false; DW.saveSettings(); render();
      } }));
      const GN = { auto: 'авто', low: 'низкая', mid: 'средняя', high: 'высокая' };
      const cur = DW.settings.gfx || 'auto';
      box.appendChild(el('button', { class: 'btn', text: 'Графика: ' + GN[cur] + (cur === 'auto' ? ' (' + ['низк.', 'средн.', 'выс.'][DW.gfxLevel()] + ')' : ''), onclick: function () {
        const order = ['auto', 'low', 'mid', 'high'];
        DW.settings.gfx = order[(order.indexOf(cur) + 1) % order.length]; DW.saveSettings();
        if (DW.TR.applyQuality) DW.TR.applyQuality();
        if (DW.Main.applyGfx) DW.Main.applyGfx();
        render();
      } }));
      box.appendChild(el('button', { class: 'btn', text: 'Счётчик FPS: ' + (DW.settings.fps ? 'вкл' : 'выкл'), onclick: function () {
        DW.settings.fps = !DW.settings.fps; DW.saveSettings(); render();
      } }));
    }
    render();
    return box;
  };

  DW.UI = UI;
})(window.DW);
