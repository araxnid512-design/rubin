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
      const p3 = DW.R3 && DW.R3.preview ? DW.R3.preview.figure(s) : null;
      const f3 = p3 ? null : (DW.S3 ? DW.S3.figure(s) : null);
      if (p3) top.appendChild(p3);
      else if (f3) { f3.className = 'fig'; top.appendChild(f3); }
      else top.appendChild(el('img', { class: 'fig', src: DW.ART.figureURL(s), alt: '' }));
      const info = el('div', { class: 'dinfo' });
      const TRt = D.TRAITS[s.trait];
      info.innerHTML = '<div class="dhead">' + s.name + ' <button class="btn sm ren">✎</button></div>' +
        '<div><span class="tag" style="border-color:' + c.color + ';color:' + c.color + '">' + c.n + '</span><span class="tag">' + D.RANKS[rk].n + rankBadge(rk) + '</span>' +
        (TRt ? '<span class="tag trait" title="' + TRt.d + '">' + TRt.n + '</span>' : '') +
        (s.trait2 && D.TRAITS[s.trait2] ? '<span class="tag trait" title="' + D.TRAITS[s.trait2].d + '">' + D.TRAITS[s.trait2].n + '</span>' : '') +
        (s.injury ? '<span class="tag" style="border-color:#c0504a;color:#e88a7a">ранен: ' + s.injury + ' дн.</span>' : '') + '</div>' +
        (s.trait2 && D.TRAITS[s.trait2] ? '<div class="small dim">' + D.TRAITS[s.trait2].n + ': ' + D.TRAITS[s.trait2].d + '</div>' : '') +
        (TRt ? '<div class="small dim">' + TRt.n + ': ' + TRt.d + '</div>' : '') +
        ((s.perks || []).length ? '<div class="small">Навыки: ' + s.perks.map(function (p) { return '<b class="acc">' + D.PERKS[p].n + '</b>'; }).join(', ') + '</div>' : '') +
        '<div class="small dim">Опыт ' + s.xp + (next ? ' / ' + next.xp : '') + ' · убийств ' + s.kills + ' · заданий ' + s.missions + '</div>' +
        (function () {
          const bl = [];
          for (const id in (s.bonds || {})) {
            const o = st.roster.find(function (x) { return String(x.id) === id; });
            if (o && s.bonds[id] >= 3) bl.push(o.name);
          }
          const rv = [];
          for (const id in (s.bonds || {})) { const o = st.roster.find(function (x) { return String(x.id) === id; }); if (o && s.bonds[id] <= -2) rv.push(o.name); }
          return (bl.length ? '<div class="small">Боевые товарищи: <b class="acc">' + bl.join(', ') + '</b> <span class="dim">(рядом +5 к меткости и −5 к попаданию по ним)</span></div>' : '') +
            (rv.length ? '<div class="small">Не ладит: <b style="color:#e88a7a">' + rv.join(', ') + '</b> <span class="dim">(рядом −5 к меткости)</span></div>' : '');
        })() +
        (function () {
          const md = s.medals || {}, ks = Object.keys(md).filter(function (k) { return D.MEDALS[k]; });
          return ks.length ? '<div class="small medals">' + ks.map(function (k) { const M = D.MEDALS[k]; return '<span class="medal" style="--mc:' + M.c + '" title="' + M.d + '">★ ' + M.n + (md[k] > 1 ? ' ×' + md[k] : '') + '</span>'; }).join(' ') + '</div>' : '';
        })() +
        ((s.drillAim || s.drillHp) ? '<div class="small dim">Тир: +' + (s.drillAim || 0) + ' к меткости, +' + (s.drillHp || 0) + ' ОЗ</div>' : '') +
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
      // модули на оружие: два слота
      st.stock.mods = st.stock.mods || {};
      s.mods = s.mods || [];
      const ml = el('div', { class: 'equip' });
      ml.appendChild(el('div', { class: 'elabel', text: 'Модули оружия' }));
      const mrow = el('div', { class: 'erow' });
      for (let k = 0; k < 2; k++) {
        const cur = s.mods[k];
        mrow.appendChild(el('button', { class: 'chip' + (cur ? ' on' : ''), html: '<span class="ct"><span>' + (cur ? D.MODS[cur].n : 'Пустой слот') + '</span><em>' + (cur ? D.MODS[cur].d : 'Модули — в грузах Института и тайниках') + '</em></span>', onclick: function () {
          const opts = Object.keys(D.MODS).filter(function (m) { return (st.stock.mods[m] || 0) > 0 && s.mods.indexOf(m) < 0; });
          const box = el('div', { class: 'erow' });
          const h = UI.modal({ title: 'Модуль — слот ' + (k + 1), body: box, buttons: [{ text: 'Закрыть' }] });
          if (cur) box.appendChild(el('button', { class: 'btn', text: 'Снять «' + D.MODS[cur].n + '»', onclick: function () { st.stock.mods[cur] = (st.stock.mods[cur] || 0) + 1; s.mods.splice(k, 1); h.close(); render(); } }));
          opts.forEach(function (m) {
            box.appendChild(el('button', { class: 'chip', html: '<span class="ct"><span>' + D.MODS[m].n + ' <small>×' + st.stock.mods[m] + '</small></span><em>' + D.MODS[m].d + '</em></span>', onclick: function () {
              st.stock.mods[m]--; if (cur) st.stock.mods[cur] = (st.stock.mods[cur] || 0) + 1;
              s.mods[k] = m; s.mods = s.mods.filter(Boolean); DW.SFX.play('reload'); h.close(); render();
            } }));
          });
          if (!opts.length && !cur) box.appendChild(el('div', { class: 'small dim', text: 'На складе нет модулей. Их можно заказать через Портал или найти в грузе Института.' }));
        } }));
      }
      ml.appendChild(mrow);
      det.appendChild(ml);
      // ветка навыков класса
      const tr = D.TREE && D.TREE[s.cls];
      if (tr) {
        const tl = el('div', { class: 'equip' });
        tl.appendChild(el('div', { class: 'elabel', text: 'Ветка навыков: ' + c.n.toLowerCase() }));
        tr.forEach(function (pair, lv) {
          const r = el('div', { class: 'tree-row' });
          r.appendChild(el('span', { class: 'tree-lv', text: D.RANKS[lv + 1] ? D.RANKS[lv + 1].n : String(lv + 2) }));
          pair.forEach(function (p) {
            const got = G.has(s, p), open = (s.perks || []).length > lv;
            r.appendChild(el('span', { class: 'tree-p' + (got ? ' got' : (open ? ' off' : '')), title: D.PERKS[p].d, html: '<b>' + D.PERKS[p].n + '</b><small>' + D.PERKS[p].d + '</small>' }));
          });
          tl.appendChild(r);
        });
        det.appendChild(tl);
      }
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
      if (G.blv('garage')) {
        const ok = G.uazOk();
        const ub = el('div', { class: 'binfo', html: '<b>УАЗ</b> · ' + (ok ? '<span class="good" style="color:#8fd07a">на ходу</span> — каждый второй переход по карте не тратит день, в бою стоит у высадки как укрытие.' : '<span class="bad">нужен ремонт</span> (' + G.costText(D.UAZ_REPAIR) + ').') });
        if (!ok) {
          const rb = el('button', { class: 'btn sm', html: 'Починить · ' + G.costText(D.UAZ_REPAIR), onclick: function () { if (G.repairUaz()) { DW.SFX.play('build'); UI.toast('УАЗ на ходу', 'good'); G.save(); render(); if (onChange) onChange(); } } });
          if (!G.canAfford(D.UAZ_REPAIR)) rb.disabled = true;
          ub.appendChild(document.createTextNode(' ')); ub.appendChild(rb);
        }
        body.appendChild(ub);
      }
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
        const have = c.once && st.gear && st.gear[c.once];
        const locked = c.tier > tier || have;
        const q = cart[c.id] || 0;
        const item = el('div', { class: 'pitem' + (locked ? ' locked' : '') + (q ? ' in' : '') });
        // картинки: оружие и броня — снимки моделей, предметы и модули — объёмные (DW.WICON i_*), люди — фото-лица
        const WI = DW.WICON || {};
        const faceI = c.give.recruit !== undefined && DW.FACE_IMG ? DW.FACE_IMG[D.FACE_NAMES.indexOf(c.give.recruit ? 'Батя' : 'Малой')] : null;
        const pic = c.give.weapon ? '<img src="' + DW.ART.weaponIcon(c.give.weapon) + '" alt="">' : (c.give.armor ? '<img src="' + DW.ART.armorIcon(c.give.armor) + '" alt="">' :
          (faceI ? '<img class="face" src="' + faceI + '" alt="">' : (WI['i_' + c.id] ? '<img src="' + WI['i_' + c.id] + '" alt="">' : ic(c.icon))));
        item.innerHTML = '<div class="pi-ic">' + pic + '</div><div class="pi-t">' + c.n + ' <small>' + c.q + '</small><br><b>' + c.price + '</b> ' + ic('gems') +
          (locked ? ' <span class="lock">' + (have ? 'уже есть' : D.TIERS[c.tier].n) + '</span>' : '') + '</div>';
        if (!locked) {
          const ctr = el('div', { class: 'pi-q' });
          ctr.appendChild(el('button', { class: 'qb', text: '−', onclick: function () { if (cart[c.id]) { cart[c.id]--; if (!cart[c.id]) delete cart[c.id]; render(); } } }));
          ctr.appendChild(el('span', { text: String(q) }));
          ctr.appendChild(el('button', { class: 'qb', text: '+', onclick: function () { if (c.once && cart[c.id]) return; cart[c.id] = (cart[c.id] || 0) + 1; render(); } }));
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

  /* ---------- Справочник врагов ---------- */
  UI.bestiary = function () {
    const st = DW.G.state, met = st.metEnemies || {}, kb = st.killsByType || {};
    const order = ['scav', 'spitter', 'brute', 'alpha', 'queen', 'raider', 'thug', 'marksman', 'boss', 'clan_blade', 'clan_obrez', 'clan_gun', 'clan_elder', 'sobr', 'sobr_shield', 'sobr_sniper', 'sobr_mg', 'sobr_cmd', 'guardian'];
    const wrap = el('div', { class: 'bestiary' });
    const known = order.filter(function (t) { return met[t]; }).length;
    wrap.appendChild(el('div', { class: 'small dim', html: 'Встречено: <b>' + known + '</b> из ' + order.length + ' · сведения появляются, когда отряд впервые видит врага.' }));
    order.forEach(function (t) {
      const E = D.ENEMIES[t], X = D.BESTIARY[t] || {};
      const card = el('div', { class: 'bcard' + (met[t] ? '' : ' unk') });
      if (!met[t]) {
        card.innerHTML = '<span class="ava unk">?</span><div class="bt"><b>Неизвестный враг</b><div class="small dim">Ещё не встречен.</div></div>';
      } else {
        const W = E.weapon && D.WEAPONS[E.weapon] ? D.WEAPONS[E.weapon].n : (E.melee ? (E.blade ? 'тесак' : 'когти и зубы') : '—');
        card.innerHTML = '<img class="ava" src="' + DW.ART.enemyPortrait(t) + '" alt=""><div class="bt"><b>' + E.n + '</b> <small class="dim">убито: ' + (kb[t] || 0) + '</small>' +
          '<div class="small">' + (X.d || '') + '</div>' +
          '<div class="bstats small">Здоровье <b>' + E.hp + '</b> · меткость <b>' + E.aim + '</b> · ход <b>' + E.mob + '</b> · броня <b>' + (E.armor || 0) + '</b> · оружие: ' + W + '</div>' +
          '<div class="small"><span class="good">＋ ' + (X.plus || []).join('; ') + '</span></div>' +
          '<div class="small"><span class="bad">− ' + (X.minus || []).join('; ') + '</span></div>' +
          (X.tip ? '<div class="small acc">Совет: ' + X.tip + '</div>' : '') + '</div>';
      }
      wrap.appendChild(card);
    });
    UI.modal({ title: 'Справочник врагов', cls: 'wide', body: wrap });
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
      (function () {
        const qs = (D.QUESTS || []).filter(function (q) { return st.quests && st.quests[q.id]; });
        if (!qs.length) return '';
        return '<div class="jg"><b>Задания</b>: ' + qs.map(function (q) { const it = st.quests[q.id]; return (it.done ? '<span class="dim">✔ ' + q.t + '</span>' : '<span class="acc">★ ' + q.t + '</span> — ' + G.node(it.node).name); }).join(' · ') + '</div>';
      })() +
      '<div class="jstats">День ' + st.day + ' · миссий: ' + st.stats.missions + ' (побед ' + st.stats.won + ') · убито врагов: ' + st.stats.kills +
      ' · логов: ' + st.stats.lairs + ' · лагерей: ' + st.stats.camps + '</div>' +
      (st.memorial.length ? '<div class="jmem"><b>Погибшие:</b> ' + st.memorial.map(function (m) {
        const fake = { id: m.id || m.name, name: m.name, cls: m.cls || 'rifleman', armor: m.armor || 'robe', look: m.look, face: m.face, rank: m.rank };
        return '<span class="m"><img class="ava" src="' + DW.ART.portrait(fake) + '" alt="">' + m.name + ' <small>д.' + m.day + ', убийств ' + m.kills + '</small></span>';
      }).join('') + '</div>' : '') +
      '<div class="jlog">' + st.log.map(function (l) { return '<div><span>День ' + l.day + '</span> ' + l.text + '</div>'; }).join('') + '</div>';
    b.insertBefore(el('button', { class: 'btn sm', text: 'Достижения и статистика', onclick: function () { UI.achievements(); } }), b.firstChild);
    b.insertBefore(el('button', { class: 'btn sm', text: 'Справочник врагов', onclick: function () { UI.bestiary(); } }), b.firstChild);
    if (DW.Story) b.insertBefore(el('button', { class: 'btn sm', text: 'Хроника (сюжет)', onclick: function () { DW.Story.open(); } }), b.firstChild);
    UI.modal({ title: 'Журнал', cls: 'wide', body: b });
  };

  /* ---------- Оборона базы: подготовка к набегу ---------- */
  UI.defensePrep = function (onChange) {
    const G = DW.G, st = G.state;
    const body = el('div', { class: 'portal prep' });
    function render() {
      const r = st.raid, P = st.defPrep || { mines: 0, wire: 0, bags: 0, posts: false };
      body.innerHTML = '';
      const info = r ? 'Набег через <b>' + Math.max(0, r.day - st.day) + ' дн.</b>: ' + G.raidWho(r.kind) + (r.night ? ', <b>ночью</b>' : '') +
        (G.blv('radio') ? '. Радиовышка: удар будет <b>' + G.DIRN[r.dir] + '</b>.' : '. Откуда ударят — неизвестно (нужна радиовышка).') +
        (r.night && G.blv('tower') ? ' Прожектор вышки осветит сектор удара.' : '')
        : 'Набега пока не ждут. Подготовиться можно заранее — всё, что поставите, пригодится в следующей обороне.';
      body.appendChild(el('div', { class: 'ptext', html: info + '<br>Ополчение базы: <b>' + (st.militia === undefined ? 2 : st.militia) + '</b> (в бою под вашим управлением, до 4). Закрытые ворота врагу придётся ломать; стены можно чинить в бою (2 ' + D.icon('materials') + ').' }));
      const grid = el('div', { class: 'pgrid' });
      [['mines', 'Мины', 'на подступах со стороны удара: взрываются под врагом'], ['wire', 'Колючка', 'останавливает врага и ранит'], ['bags', 'Мешки с песком', 'укрытия у стены со стороны удара']].forEach(function (q) {
        const it = el('div', { class: 'pitem' });
        it.innerHTML = '<div class="pi-t">' + q[1] + ' <small>' + (P[q[0]] || 0) + '/' + G.prepMax[q[0]] + '</small><br><b>' + G.prepCost[q[0]] + '</b> ' + D.icon('materials') + ' <small class="dim">' + q[2] + '</small></div>';
        const bt = el('button', { class: 'btn sm', text: '+', onclick: function () { if (G.prepAdd(q[0])) { DW.SFX.play('build'); G.save(); render(); if (onChange) onChange(); } } });
        bt.disabled = (P[q[0]] || 0) >= G.prepMax[q[0]] || st.res.materials < G.prepCost[q[0]];
        it.appendChild(bt); grid.appendChild(it);
      });
      const pt = el('div', { class: 'pitem' + (P.posts ? ' in' : '') });
      pt.innerHTML = '<div class="pi-t">Посты <br><small class="dim">бойцы заранее у стены со стороны удара</small></div>';
      pt.appendChild(el('button', { class: 'btn sm', text: P.posts ? 'Заняты' : 'Занять', onclick: function () { st.defPrep = st.defPrep || { mines: 0, wire: 0, bags: 0 }; st.defPrep.posts = !st.defPrep.posts; G.save(); render(); } }));
      grid.appendChild(pt);
      body.appendChild(grid);
      body.appendChild(el('div', { class: 'small dim', html: 'Стройматериалы: ' + D.icon('materials') + st.res.materials }));
    }
    render();
    UI.modal({ title: 'Оборона базы', cls: 'wide', body: body, onClose: onChange });
  };

  /* ---------- Караван: торговля ---------- */
  UI.trade = function (car) {
    const G = DW.G, st = G.state;
    return new Promise(function (resolve) {
      const body = el('div', { class: 'portal trade' });
      let h = null;
      function render() {
        body.innerHTML = '<div class="ptext">Торговцы с охраной. Берут драгоценности и стройматериалы, у них — провизия, патроны, аптечки и гранаты. Запасы каравана ограничены.</div>';
        const grid = el('div', { class: 'pgrid' });
        car.goods.forEach(function (g) {
          const it = el('div', { class: 'pitem' + (g.left ? '' : ' locked') });
          const WI = DW.WICON || {};
          const pic = WI['i_' + g.pic] ? '<img src="' + WI['i_' + g.pic] + '" alt="">' : D.icon(g.res);
          it.innerHTML = '<div class="pi-ic">' + pic + '</div><div class="pi-t">' + g.n + ' <small>×' + g.amt + '</small><br><b>' + g.price + '</b> ' + D.icon(g.pay) + ' <small class="dim">осталось ' + g.left + '</small></div>';
          const bt = el('button', { class: 'btn sm', text: g.sell ? 'Продать' : 'Купить', onclick: function () {
            if (!g.left) return;
            if (g.sell) { if ((st.res[g.res] || 0) < g.amt) return; st.res[g.res] -= g.amt; st.res[g.pay] += g.price; }
            else { if ((st.res[g.pay] || 0) < g.price) return; st.res[g.pay] -= g.price; st.res[g.res] = (st.res[g.res] || 0) + g.amt; }
            g.left--; DW.SFX.play('pickup'); render();
          } });
          bt.disabled = !g.left || (g.sell ? (st.res[g.res] || 0) < g.amt : (st.res[g.pay] || 0) < g.price);
          it.appendChild(bt);
          grid.appendChild(it);
        });
        body.appendChild(grid);
        body.appendChild(el('div', { class: 'small dim', html: 'У вас: ' + ['gems', 'materials', 'food', 'ammo', 'meds', 'grenades'].map(function (k) { return D.icon(k) + (st.res[k] || 0); }).join(' · ') }));
      }
      render();
      h = UI.modal({ title: 'Караван торговцев', cls: 'wide', body: body, onClose: function () { G.save(); resolve(); } });
      void h;
    });
  };

  /* ---------- Достижения и статистика ---------- */
  UI.achievements = function () {
    const G = DW.G, st = G.state, S = st.stats;
    const all = st.roster.map(function (s) { return { name: s.name, kills: s.kills, missions: s.missions, medals: Object.keys(s.medals || {}).reduce(function (a, k) { return a + s.medals[k]; }, 0), scars: (s.look && s.look.bscars) || 0, alive: true }; })
      .concat(st.memorial.map(function (m) { return { name: m.name, kills: m.kills, missions: 0, medals: 0, scars: 0, alive: false }; }));
    const top = function (key) { const l = all.slice().sort(function (a, b) { return b[key] - a[key]; }); return l.length && l[0][key] > 0 ? l[0] : null; };
    const shooter = top('kills'), tough = all.filter(function (a) { return a.alive; }).sort(function (a, b) { return (b.missions + b.scars * 2) - (a.missions + a.scars * 2); })[0], hero = top('medals');
    const b = el('div', { class: 'journal ach' });
    b.innerHTML = '<div class="jstats">' +
      '<div>Дней за Порталом: <b>' + st.day + '</b> · кристаллов сдано: <b>' + st.delivered + '</b> · боёв: <b>' + S.missions + '</b> (побед ' + S.won + ')</div>' +
      '<div>Убито врагов: <b>' + S.kills + '</b> · погибло своих: <b>' + (S.deaths || st.memorial.length) + '</b> · набегов отбито: <b>' + (S.raids || 0) + '</b> · боёв подряд без потерь: <b>' + (S.cleanRun || 0) + '</b></div>' +
      (S.longest ? '<div>Самый дальний смертельный выстрел: <b>' + S.longest + ' м</b></div>' : '') +
      (shooter ? '<div>Лучший стрелок: <b class="acc">' + shooter.name + '</b> — ' + shooter.kills + ' убитых' + (shooter.alive ? '' : ' (погиб)') + '</div>' : '') +
      (tough ? '<div>Самый живучий: <b class="acc">' + tough.name + '</b> — ' + tough.missions + ' заданий, шрамов ' + tough.scars + '</div>' : '') +
      (hero ? '<div>Больше всех медалей: <b class="acc">' + hero.name + '</b> — ' + hero.medals + '</div>' : '') +
      '</div><div class="achlist">' + (D.ACHIEVE || []).map(function (a) {
        const got = st.ach && st.ach[a.id];
        return '<div class="achi' + (got ? ' on' : '') + '"><b>' + (got ? '★ ' : '☆ ') + a.n + '</b><small>' + a.d + (got ? ' · день ' + got : '') + '</small></div>';
      }).join('') + '</div>';
    UI.modal({ title: 'Достижения и статистика', cls: 'wide', body: b });
  };

  /* ---------- Брифинг ---------- */
  UI.briefing = function (node, kind, extra) {
    const G = DW.G, st = G.state;
    return new Promise(function (res) {
      const chosen = {};
      const hurt = function (s) { return kind !== 'defense' && (s.injury || 0) > 0; };
      const sorted = st.roster.slice().sort(function (a, b) { return G.hp(b) / G.maxHp(b) - G.hp(a) / G.maxHp(a); });
      sorted.filter(function (s) { return !hurt(s); }).slice(0, 6).forEach(function (s) { chosen[s.id] = 1; });
      const T = D.nodeInfo(node);
      const intel = kind === 'caravan' ? 'охрана каравана — бандиты с автоматами' : {
        landing: 'мутанты', ruins: 'мутанты или бандиты', vein: 'мутанты', camp: node.fac === 'clan' ? 'клан — много бойцов и Старший' : (node.fac === 'sobr' ? 'группа СОБР: щиты, бронежилеты, светошумовые' : 'бандиты' + (node.diff >= 3 ? ' и главарь' : '')),
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
          if (node.type === 'camp' && node.fac === 'clan') types.splice(0, types.length, 'clan_elder', 'clan_blade', 'clan_obrez', 'clan_gun');
          if (node.type === 'camp' && node.fac === 'sobr') types.splice(0, types.length, 'sobr_cmd', 'sobr_shield', 'sobr', 'sobr_sniper');
          const shown = types.filter(function (t) { return !(t === 'boss' && node.diff < 3) && !(t === 'brute' && node.diff < 3 && node.type !== 'nest') && !(t === 'marksman' && node.diff < 3); });
          body.appendChild(el('div', { class: 'bhead', html: '<img src="' + DW.ART.landmarkURL(node.type) + '" alt=""><div class="ptext"><b>' + T.n + '</b>' + (D.MAP_NAMES[node.map] ? ' — ' + D.MAP_NAMES[node.map].toLowerCase() : '') + ' · опасность ' + skulls(node.diff) + '<br>' + T.desc +
            '<br>Разведка: <b>' + intel + '</b>.' + (kind === 'ambush' ? ' <b class="bad">Засада!</b>' : '') +
            (function () {
            // по окошку на каждого врага (план боя), невиданный вид — «?»
            const dif = kind === 'ambush' ? Math.max(1, node.diff - 1) : node.diff;
            const plan = DW.BT.planFor ? DW.BT.planFor(node, kind, dif) : null;
            let list = plan ? [].concat.apply([], plan.pods.map(function (p) { return p.types; })) : shown;
            const ord = {}; list.forEach(function (t, i) { if (ord[t] === undefined) ord[t] = i; });
            list = list.slice().sort(function (a, b) { return ord[a] - ord[b]; });
            const met = st.metEnemies || {};
            // разведчик побывал на месте — враги известны в лицо
            return (node.scouted ? '<div class="small acc">Разведчик видел их своими глазами.</div>' : '') + '<div class="intel">' + list.map(function (t) {
              if (!met[t] && !node.scouted) return '<span class="ava unk" title="Неизвестный враг">?</span>';
              return '<img class="ava" title="' + D.ENEMIES[t].n + '" src="' + DW.ART.enemyPortrait(t) + '" alt="">';
            }).join('') + '<span class="icnt">× ' + list.length + '</span></div>';
          })() +
            (function () {
              const q = DW.G.questOf ? DW.G.questOf(node) : null;
              return q && kind === 'normal' ? '<div class="quest"><b>★ Задание: ' + q.t + '</b><div class="small">' + q.text + '</div></div>' : '';
            })() +
            (locked ? '<b class="bad">Гнездо слишком сильно. Сначала уничтожьте два логова мутантов (' + lairs + '/2).</b>' : '') + '</div>' }));
        }
        // переговоры с главарём: откупиться — банда уходит, локация ваша (без боя и без добычи)
        const qt = DW.G.questOf ? DW.G.questOf(node) : null;
        if (qt && qt.talk && kind === 'normal') {
          const pay = el('button', { class: 'btn sm', html: 'Заплатить главарю 30 ' + ic('gems') + ' — банда уйдёт', onclick: function () {
            if (st.res.gems < 30) { UI.toast('Не хватает драгоценностей', 'bad'); return; }
            st.res.gems -= 30; node.cleared = true; node.quest = null; st.quests[qt.id].done = true; st.trust = (st.trust || 0) + 10;
            DW.G.log('Банда главаря ушла за плату.'); DW.G.save();
            UI.toast('Банда ушла. Лагерь ваш без боя (доверие +10).', 'good');
            if (h) h.close(); res(null);
          } });
          if (st.res.gems < 30) pay.disabled = true;
          body.appendChild(pay);
        }
        const cnt = Object.keys(chosen).length;
        body.appendChild(el('div', { class: 'blabel', html: 'Бойцы на задание: <b>' + cnt + '</b>/6' }));
        const grid = el('div', { class: 'bsel' });
        st.roster.forEach(function (s) {
          const on = !!chosen[s.id];
          const c = D.CLASSES[s.cls];
          const card = el('div', { class: 'bpick' + (on ? ' on' : '') + (hurt(s) ? ' hurt' : ''), onclick: function () {
            if (hurt(s)) { UI.toast('«' + s.name + '» ранен: ещё ' + s.injury + ' дн. вне строя', 'bad'); return; }
            if (chosen[s.id]) delete chosen[s.id];
            else if (Object.keys(chosen).length < 6) chosen[s.id] = 1;
            render();
          } });
          card.appendChild(el('img', { class: 'ava', src: DW.ART.portrait(s), style: 'border-color:' + c.color }));
          const sc = el('div', { class: 'sc' });
          sc.innerHTML = '<div class="sname">' + s.name + rankBadge(G.rank(s)) + '</div>' + hpBar(G.hp(s), G.maxHp(s)) +
            '<div class="sline">' + c.n + ' · ' + (D.WEAPONS[s.weapon].s || '') + (hurt(s) ? ' · <span class="bad">ранен, ' + s.injury + ' дн.</span>' : '') + '</div>';
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
      if (sum.bonds) html += '<div class="rloot">Стали боевыми товарищами: <b class="acc">' + sum.bonds.join('; ') + '</b> — рядом друг с другом +5 к меткости.</div>';
      if (sum.medals) html += '<div class="rloot">Медали: <b class="acc">' + sum.medals.join('; ') + '</b>.</div>';
      if (sum.ach && sum.ach.length) html += '<div class="rloot">Достижение: <b class="acc">' + sum.ach.map(function (a) { return '«' + a.n + '»'; }).join(', ') + '</b>.</div>';
      if (sum.quest) html += '<div class="rloot quest"><b>★ Задание «' + sum.quest.t + '» выполнено.</b> ' + sum.quest.text + '<br>Награда: ' + sum.quest.got.join(' · ') + '</div>';
      if (sum.uazLost) html += '<div class="rloot"><span class="bad">УАЗ подбит</span> — нужен ремонт в гараже (' + DW.G.costText(D.UAZ_REPAIR) + ').</div>';
      if (sum.injured) html += '<div class="rloot"><span class="bad">Вне строя после ранений:</span> ' + sum.injured.join(', ') + ' — на задания не идут, оборонять базу могут. В лазарете на базе заживает вдвое быстрее.</div>';
      if (sum.traits) html += '<div class="rloot">Ранение изменило характер: <b class="acc">' + sum.traits.join('; ') + '</b>.</div>';
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
        DW.settings.sound = !DW.settings.sound; DW.saveSettings(); if (DW.Music) DW.Music.refresh(); render();
      } }));
      box.appendChild(el('button', { class: 'btn', text: 'Музыка: ' + (DW.settings.music !== false ? 'вкл' : 'выкл'), onclick: function () {
        DW.SFX.unlock();
        DW.settings.music = DW.settings.music === false; DW.saveSettings(); if (DW.Music) DW.Music.refresh(); render();
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
      if (DW.R3 && DW.R3.supported && DW.R3.supported()) box.appendChild(el('button', { class: 'btn', text: 'Бой: ' + (DW.settings.r3d !== false ? '3D' : '2D'), onclick: function () {
        DW.settings.r3d = DW.settings.r3d === false; DW.saveSettings(); render(); DW.UI.toast('Вступит в силу со следующего боя', '');
      } }));
      box.appendChild(el('button', { class: 'btn', text: 'Заставка: ' + (DW.settings.splash !== false ? 'вкл' : 'выкл'), onclick: function () {
        DW.settings.splash = DW.settings.splash === false; DW.saveSettings(); render();
      } }));
      if (DW.WEd) box.appendChild(el('button', { class: 'btn', text: 'Мастерская оружия', onclick: function () { DW.SFX.unlock(); DW.WEd.open(); } }));
    }
    render();
    return box;
  };

  DW.UI = UI;
})(window.DW);
