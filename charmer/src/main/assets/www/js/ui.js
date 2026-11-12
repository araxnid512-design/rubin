'use strict';
/* Интерфейс: диалоги, меню, лавка, таверна, боевые кнопки, управление */
(function () {
  const $ = id => document.getElementById(id), UI = window.UI = {};
  const nm = g => (g.bloom ? D.GIRLS[g.id].bloom : D.GIRLS[g.id].name);
  const hearts = a => { let h = ''; for (let i = 0; i < 4; i++) h += '<i class="hrt' + (a >= (i + 1) * 25 ? ' on' : '') + '"></i>'; return h; };
  const elTag = el => '<span class="el" style="background:' + D.EL[el].c + '">' + D.EL[el].n + '</span>';

  /* ---------- Живые портреты ---------- */
  const live = [];
  function pic(cv, id, o) { live.push({ cv, id, o: o || {} }); return cv; }
  UI.drawLive = function (t) {
    for (let i = live.length - 1; i >= 0; i--) {
      const L = live[i]; if (!L.cv.isConnected) { live.splice(i, 1); continue; }
      const x = L.cv.getContext('2d'), w = L.cv.width, h = L.cv.height;
      x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, w, h);
      const k = L.o.k || h / 230; x.translate(w / 2, L.o.y ? h * L.o.y : h - 6); x.scale(k, k);
      ART.girl(x, L.id, { t: t + (L.o.ph || 0), expr: L.o.expr || 'normal', pose: L.o.pose, bloom: L.o.bloom });
    }
  };
  UI.titlePic = (c, id, ex) => pic(c, id, { expr: ex, k: c.height / 232, ph: id.length });
  function mkCanvas(w, h, cls) { const c = document.createElement('canvas'); c.width = w; c.height = h; if (cls) c.className = cls; return c; }

  /* ---------- Подсказки и переходы ---------- */
  let zoneT = 0;
  UI.zone = function (n) { $('zone').textContent = n; $('zone').classList.add('on'); zoneT = 2.6; };
  UI.fade = function (cb) { const f = $('fade'); f.classList.add('on'); G.lock = true; setTimeout(() => { cb(); setTimeout(() => { f.classList.remove('on'); G.lock = false; }, 80); }, 260); };

  /* ---------- Диалоги ---------- */
  let dq = null, dcb = null, typed = 0, full = '';
  UI.dialogOpen = () => !!dq;
  UI.say = function (lines, cb) { dq = lines.slice(); dcb = cb || null; nextLine(); $('dlg').classList.add('on'); };
  function nextLine() {
    const L = dq.shift(); if (!L) { $('dlg').classList.remove('on'); const c = dcb; dq = null; dcb = null; if (c) c(); return; }
    const box = $('dlg-pic'); box.innerHTML = '';
    if (L.girl) { const g = G.S.party.find(q => q.id === L.girl); box.appendChild(pic(mkCanvas(220, 220), L.girl, { expr: L.expr || 'normal', k: 1.9, y: 1.42, bloom: g && g.bloom })); $('dlg').classList.add('pic'); $('dlg-who').textContent = g ? nm(g) : D.GIRLS[L.girl].name; }
    else { $('dlg').classList.remove('pic'); $('dlg-who').textContent = L.who || ''; }
    $('dlg-who').style.display = $('dlg-who').textContent ? '' : 'none';
    full = L.t; typed = 0; $('dlg-t').textContent = '';
  }
  $('dlg').addEventListener('click', () => { U.audioInit(); if (typed < full.length) { typed = full.length; $('dlg-t').textContent = full; } else { U.sfx('blip'); nextLine(); } });

  /* ---------- Боевые сообщения ---------- */
  let bfull = '', btyped = 0, bdoneT = 0, btap = false;
  UI.bmsg = function (t) { bfull = t; btyped = 0; bdoneT = 0; btap = false; $('bmsg').textContent = ''; };
  UI.bmsgDone = function () { if (btyped < bfull.length) return false; return btap || bdoneT > 0.95 + bfull.length * 0.008; };
  $('bmsg').addEventListener('click', () => { if (btyped < bfull.length) { btyped = bfull.length; $('bmsg').textContent = bfull; } else btap = true; });
  UI.tick = function (dt) {
    if (dq && typed < full.length) { typed = Math.min(full.length, typed + dt * 48); $('dlg-t').textContent = full.slice(0, typed | 0); if ((typed | 0) % 3 === 0) U.sfx('blip'); }
    if (btyped < bfull.length) { btyped = Math.min(bfull.length, btyped + dt * 60); $('bmsg').textContent = bfull.slice(0, btyped | 0); } else bdoneT += dt;
    if (zoneT > 0 && (zoneT -= dt) <= 0) $('zone').classList.remove('on');
    $('money').textContent = G.S ? G.S.money : 0;
  };

  /* ---------- Окна ---------- */
  const modal = $('modal'), mb = $('m-body');
  let onClose = null;
  function open(title, html, opts) { opts = opts || {}; $('m-title').textContent = title; mb.innerHTML = html; modal.classList.remove('hide'); modal.classList.toggle('noclose', !!opts.forced); onClose = opts.onClose || null; U.sfx('select'); return mb; }
  UI.close = function () { modal.classList.add('hide'); const c = onClose; onClose = null; if (c) c(); };
  UI.modalOpen = () => !modal.classList.contains('hide');
  modal.addEventListener('click', e => { if ((e.target === modal || e.target.closest('[data-x]')) && !modal.classList.contains('noclose')) UI.close(); });

  // выбор стартовой героини
  UI.chooseStarter = function (cb) {
    const b = open('Выбери напарницу', '<p class="sub">Дед оставил три печати. В каждой — по девице. Выбирай сердцем (и стихией).</p><div class="starters"></div>', { forced: true });
    const wrap = b.querySelector('.starters');
    for (const id of D.STARTERS) {
      const g = D.GIRLS[id], card = document.createElement('div'); card.className = 'scard';
      card.appendChild(pic(mkCanvas(200, 240), id, { expr: 'happy', k: 1.05, ph: id.length }));
      card.insertAdjacentHTML('beforeend', '<b>' + g.name + '</b><small>' + g.kind + ' ' + elTag(g.el) + '</small><p>' + g.bio + '</p><button class="go">Выбрать</button>');
      card.querySelector('button').onclick = () => { modal.classList.remove('noclose'); UI.close(); U.sfx('caught'); cb(id); };
      wrap.appendChild(card);
    }
  };
  // выбор героини из отряда
  UI.chooseGirl = function (title, filter, cb, forced) {
    const S = G.S, b = open(title, '<div class="plist"></div>', { forced });
    const w = b.querySelector('.plist');
    S.party.forEach((g, i) => {
      const ok = filter(g, i), row = document.createElement('button'); row.className = 'prow' + (ok ? '' : ' off');
      row.innerHTML = '<img src="' + ART.thumb[g.id] + '"><div><b>' + nm(g) + ' <small>ур. ' + g.lvl + '</small></b>' + hpBar(g) + '</div>' + elTag(D.GIRLS[g.id].el);
      row.onclick = () => { if (!ok) return U.sfx('deny'); modal.classList.remove('noclose'); UI.close(); cb(i); };
      w.appendChild(row);
    });
  };
  function hpBar(g) { const mx = G.stats(g).hp, k = g.hp / mx; return '<div class="hpb"><i style="width:' + (k * 100).toFixed(1) + '%;background:' + (k > 0.5 ? '#3ad06a' : k > 0.2 ? '#f0c030' : '#f04a4a') + '"></i><span>' + g.hp + '/' + mx + '</span></div>'; }

  /* ---------- Главное меню ---------- */
  UI.openMenu = function (tab) {
    const tabs = [['party', 'Отряд'], ['bag', 'Сумка'], ['dex', 'Девичник'], ['opt', 'Ещё']];
    const b = open('Меню', '<div class="tabs">' + tabs.map(t => '<button data-tab="' + t[0] + '"' + (t[0] === (tab || 'party') ? ' class="on"' : '') + '>' + t[1] + '</button>').join('') + '</div><div id="tab"></div>');
    b.querySelectorAll('[data-tab]').forEach(el => el.onclick = () => UI.openMenu(el.dataset.tab));
    ({ party: tabParty, bag: tabBag, dex: tabDex, opt: tabOpt })[tab || 'party']($('tab'));
  };
  function tabParty(el) {
    const S = G.S; if (!S.party.length) { el.innerHTML = '<p class="sub">Отряд пуст. Загляни к Бабе Нюре.</p>'; return; }
    el.innerHTML = '<div class="plist"></div>'; const w = el.firstChild;
    S.party.forEach((g, i) => { const row = document.createElement('button'); row.className = 'prow'; row.innerHTML = '<img src="' + ART.thumb[g.id] + '"><div><b>' + nm(g) + ' <small>ур. ' + g.lvl + '</small></b>' + hpBar(g) + '</div><span class="hearts">' + hearts(g.aff) + '</span>' + (i === 0 ? '<span class="lead">первая</span>' : ''); row.onclick = () => girlCard(i); w.appendChild(row); });
  }
  function girlCard(i, box) {
    const S = G.S, g = box ? S.box[i] : S.party[i], d = D.GIRLS[g.id], st = G.stats(g), tier = Math.min(3, Math.floor(g.aff / 25));
    const b = open(nm(g), '<div class="gcard"><div class="gpic"></div><div class="ginfo"><small>' + d.kind + ' ' + elTag(d.el) + ' · ур. ' + g.lvl + '</small>' + hpBar(g) +
      '<div class="stats"><span>Атака <b>' + st.atk + '</b></span><span>Защита <b>' + st.def + '</b></span><span>Скорость <b>' + st.spd + '</b></span></div>' +
      '<div class="aff"><span class="hearts">' + hearts(g.aff) + '</span> Привязанность ' + g.aff + '/100</div>' +
      '<div class="skl">' + d.skills.map(s => '<span class="' + (g.lvl >= s[1] ? '' : 'lock') + '" style="border-color:' + D.EL[D.SK[s[0]].el].c + '">' + D.SK[s[0]].n + (g.lvl >= s[1] ? '' : ' · ур.' + s[1]) + '</span>').join('') + '</div>' +
      '<p class="bio">' + d.bio + '</p><div class="acts"></div></div></div>');
    b.querySelector('.gpic').appendChild(pic(mkCanvas(240, 300), g.id, { expr: g.aff >= 50 ? 'happy' : 'normal', k: 1.25, bloom: g.bloom }));
    const acts = b.querySelector('.acts'), btn = (t, f, cls) => { const e = document.createElement('button'); e.textContent = t; if (cls) e.className = cls; e.onclick = f; acts.appendChild(e); };
    if (!box) {
      btn('Поговорить', () => talk(g), 'go');
      for (const it of ['pie', 'candy']) if (S.bag[it]) btn('Подарить: ' + D.ITEMS[it].n + ' (' + S.bag[it] + ')', () => gift(g, it));
      if (i > 0) btn('Сделать первой', () => { S.party.splice(i, 1); S.party.unshift(g); WD.fol.path = []; U.sfx('select'); UI.openMenu('party'); });
    }
    btn('Назад', () => UI.openMenu('party'));
  }
  function talk(g) {
    const d = D.GIRLS[g.id], tier = Math.min(3, Math.floor(g.aff / 25));
    UI.close();
    if (g.talked) return UI.say([{ girl: g.id, expr: 'blush', t: U.pick(['Мы же только что болтали! Иди уже, а то покраснею.', 'Ещё поговорить? Ты что, соскучился? …Я тоже.', 'Отдохни сначала в таверне, болтун.'], Math.random) }]);
    g.talked = true; g.aff = Math.min(100, g.aff + 4);
    const ex = ['normal', 'blush', 'happy', 'blush'][tier];
    UI.say([{ girl: g.id, expr: ex, t: d.talk[tier] }, { who: '', t: nm(g) + ': привязанность +4' + (tier < 3 && g.aff >= (tier + 1) * 25 ? '. Кажется, она стала относиться к тебе теплее!' : '') }], () => G.save());
  }
  function gift(g, it) {
    const S = G.S; S.bag[it]--; const was = g.aff; g.aff = Math.min(100, g.aff + D.ITEMS[it].gift);
    UI.close(); U.sfx('kiss');
    const fox = S.party.find(q => q.id === 'fox' && q !== g);
    const lines = [{ girl: g.id, expr: 'happy', t: it === 'candy' ? 'Леденец-сердечко?! Это… это намёк? *хрустит и краснеет*' : 'Пирожок! Мне?! Ты лучший! *ест, жмурясь от счастья*' }];
    if (fox && it === 'pie' && Math.random() < 0.3) lines.push({ girl: 'fox', expr: 'smug', t: 'А мне? Ладно, я половину уже откусила, пока ты не смотрел.' });
    lines.push({ who: '', t: nm(g) + ': привязанность ' + was + ' → ' + g.aff });
    UI.say(lines, () => G.save());
  }
  function tabBag(el) {
    const S = G.S; let h = '<div class="ilist">';
    for (const id in D.ITEMS) { const n = S.bag[id] || 0; if (!n) continue; const it = D.ITEMS[id]; h += '<div class="irow"><img src="' + ART.ICON[id] + '"><div><b>' + it.n + ' ×' + n + '</b><p>' + it.d + '</p></div>' + (it.heal || it.revive || it.gift ? '<button data-use="' + id + '">' + (it.gift ? 'Подарить' : 'Применить') + '</button>' : '') + '</div>'; }
    if (h === '<div class="ilist">') h += '<p class="sub">Сумка пуста. Только крошки от пирожков.</p>';
    el.innerHTML = h + '</div>';
    el.querySelectorAll('[data-use]').forEach(b => b.onclick = () => {
      const id = b.dataset.use, it = D.ITEMS[id];
      UI.chooseGirl(it.gift ? 'Кому подарить?' : 'На кого?', g => it.revive ? g.hp <= 0 : it.gift ? true : g.hp > 0 && g.hp < G.stats(g).hp, i => {
        const g = S.party[i];
        if (it.gift) return gift(g, id);
        S.bag[id]--; if (it.revive) g.hp = Math.floor(G.stats(g).hp * it.revive); else g.hp = Math.min(G.stats(g).hp, g.hp + it.heal);
        U.sfx('heal'); UI.openMenu('bag');
      });
    });
  }
  function tabDex(el) {
    const S = G.S, n = D.ORDER.filter(id => S.caught[id]).length;
    let h = '<p class="sub">Приручено ' + n + ' из 10. Встречено ' + D.ORDER.filter(id => S.seen[id]).length + '.</p><div class="dex">';
    for (const id of D.ORDER) { const g = D.GIRLS[id], seen = S.seen[id], c = S.caught[id]; h += '<div class="dcell' + (c ? ' got' : '') + '"><img src="' + ART.thumb[id] + '" class="' + (seen ? '' : 'sil') + '"><b>' + (seen ? g.name : '???') + '</b><small>' + (seen ? g.kind : 'не встречена') + '</small>' + (c ? '<i class="hrt on"></i>' : '') + '</div>'; }
    el.innerHTML = h + '</div>';
  }
  function tabOpt(el) {
    el.innerHTML = '<div class="menu"><button data-o="snd">Звук: ' + (U.soundOn ? 'вкл' : 'выкл') + '</button><button data-o="save">Сохранить игру</button><button data-o="new" class="danger">Новая игра</button></div><p class="sub">Игра для взрослых: флирт и шутки, без откровенных сцен. Все героини — совершеннолетние чудища.</p>';
    el.querySelectorAll('[data-o]').forEach(b => b.onclick = () => {
      const o = b.dataset.o;
      if (o === 'snd') { U.soundOn = !U.soundOn; G.saveCfg(); UI.openMenu('opt'); }
      else if (o === 'save') { G.save(); b.textContent = 'Сохранено ✓'; U.sfx('select'); }
      else if (o === 'new') { if (b.dataset.s) { G.reset(); UI.close(); } else { b.dataset.s = 1; b.textContent = 'Точно? Нажми ещё раз'; } }
    });
  }

  /* ---------- Лавка и таверна ---------- */
  UI.openShop = function () {
    const S = G.S;
    let h = '<p class="sub">' + D.NPC.shop + '</p><div class="ilist">';
    for (const id of D.SHOP) { const it = D.ITEMS[id]; h += '<div class="irow"><img src="' + ART.ICON[id] + '"><div><b>' + it.n + ' <small>есть: ' + (S.bag[id] || 0) + '</small></b><p>' + it.d + '</p></div><button data-buy="' + id + '"' + (S.money < it.price ? ' class="off"' : '') + '>' + it.price + ' ₽</button></div>'; }
    const b = open('Лавка · у тебя ' + S.money + ' ₽', h + '</div>');
    b.querySelectorAll('[data-buy]').forEach(el => el.onclick = () => { const it = D.ITEMS[el.dataset.buy]; if (S.money < it.price) return U.sfx('deny'); S.money -= it.price; S.bag[el.dataset.buy] = (S.bag[el.dataset.buy] || 0) + 1; U.sfx('select'); UI.openShop(); });
  };
  UI.openTavern = function () {
    const S = G.S, b = open('Таверна «Пьяный гусь»', '<p class="sub">' + D.NPC.tavern + '</p><div class="menu"><button data-t="rest" class="go">Отдохнуть (вылечить всех)</button><button data-t="box">Запас героинь (' + S.box.length + ')</button><button data-x>Уйти</button></div>');
    U.music('tavern');
    b.querySelector('[data-t=rest]').onclick = () => { G.healAll(); for (const g of S.party) g.talked = false; U.sfx('heal'); UI.close(); UI.fade(() => { }); const l = S.party[0]; UI.say([{ who: 'Тётка Дуня', t: 'Спите, голубки. Утро вечера мудренее.' }].concat(l ? [{ girl: l.id, expr: 'sleepy', t: U.pick(['Ммм… ты тёплый. Я тут полежу… на тебе… пять минуточек.', 'Спокойной ночи, Чаровник. Не храпи.', 'Если приснюсь — не просыпайся.'], Math.random) }] : []), () => G.save()); };
    b.querySelector('[data-t=box]').onclick = () => boxView();
  };
  function boxView() {
    const S = G.S;
    let h = '<h4>Отряд (' + S.party.length + '/6) — нажми, чтобы отправить в запас</h4><div class="plist" id="bp"></div><h4>Запас — нажми, чтобы взять в отряд</h4><div class="plist" id="bb"></div>';
    const b = open('Запас героинь', h);
    const row = (g, cb) => { const r = document.createElement('button'); r.className = 'prow'; r.innerHTML = '<img src="' + ART.thumb[g.id] + '"><div><b>' + nm(g) + ' <small>ур. ' + g.lvl + '</small></b>' + hpBar(g) + '</div><span class="hearts">' + hearts(g.aff) + '</span>'; r.onclick = cb; return r; };
    S.party.forEach((g, i) => b.querySelector('#bp').appendChild(row(g, () => { if (S.party.length <= 1) return U.sfx('deny'); S.box.push(S.party.splice(i, 1)[0]); WD.fol.path = []; boxView(); })));
    S.box.forEach((g, i) => b.querySelector('#bb').appendChild(row(g, () => { if (S.party.length >= 6) return U.sfx('deny'); S.party.push(S.box.splice(i, 1)[0]); boxView(); })));
    if (!S.box.length) b.querySelector('#bb').innerHTML = '<p class="sub">Пусто. Седьмая и следующие героини попадут сюда.</p>';
  }

  /* ---------- Бой ---------- */
  UI.battleOn = function (on) { document.body.classList.toggle('battle', on); if (!on) UI.battleMenuHide(); $('bmsg').textContent = ''; };
  UI.battleMenuHide = function () { $('bmenu').classList.remove('on'); $('bskills').classList.remove('on'); };
  UI.battleMenu = function (g, b) {
    const S = G.S; $('bmenu').classList.add('on'); $('bskills').classList.remove('on');
    $('b-seal').innerHTML = 'Печать <small>×' + (S.bag.seal || 0) + '</small>'; $('b-seal').classList.toggle('off', !b.wild);
    $('b-run').classList.toggle('off', !b.wild);
    UI.bmsg('Что сделает ' + nm(g) + '?');
  };
  function skills() {
    const g = G.S.party[BT.b.mi], w = $('bskills'); w.innerHTML = '';
    for (const id of G.skillsOf(g)) { const s = D.SK[id], e = document.createElement('button'), fe = BT.b ? D.eff(s.el, D.GIRLS[BT.b.foe.id].el) : 1; e.style.setProperty('--c', D.EL[s.el].c); e.innerHTML = '<b>' + s.n + '</b><small>' + D.EL[s.el].n + (s.pw ? ' · сила ' + s.pw : ' · ' + (s.d || 'эффект')) + (s.pw && fe > 1 ? ' · <em>эффективно!</em>' : '') + '</small>'; e.onclick = () => { U.sfx('select'); BT.choose({ k: 'skill', id }); }; w.appendChild(e); }
    const bk = document.createElement('button'); bk.className = 'back'; bk.textContent = '← Назад'; bk.onclick = () => { $('bskills').classList.remove('on'); $('bmenu').classList.add('on'); }; w.appendChild(bk);
    $('bmenu').classList.remove('on'); w.classList.add('on');
  }
  $('b-atk').onclick = () => { U.sfx('select'); skills(); };
  $('b-compl').onclick = () => { U.sfx('select'); BT.choose({ k: 'compl' }); };
  $('b-seal').onclick = () => { if (!BT.b.wild) return U.sfx('deny'); BT.choose({ k: 'seal' }); };
  $('b-run').onclick = () => { BT.choose({ k: 'run' }); };
  $('b-team').onclick = () => { const b = BT.b; UI.chooseGirl('Кого выпустить?', (g, i) => g.hp > 0 && i !== b.mi, i => BT.choose({ k: 'switch', idx: i })); };
  $('b-bag').onclick = () => {
    const S = G.S, list = ['potion', 'elixir', 'revive'].filter(id => S.bag[id]);
    if (!list.length) { UI.bmsg('В сумке нет зелий. Только крошки.'); return U.sfx('deny'); }
    const b = open('Сумка', '<div class="ilist">' + list.map(id => '<div class="irow"><img src="' + ART.ICON[id] + '"><div><b>' + D.ITEMS[id].n + ' ×' + S.bag[id] + '</b><p>' + D.ITEMS[id].d + '</p></div><button data-bu="' + id + '">Взять</button></div>').join('') + '</div>');
    b.querySelectorAll('[data-bu]').forEach(el => el.onclick = () => { const id = el.dataset.bu; UI.close(); if (id === 'revive') UI.chooseGirl('Кого поднять?', g => g.hp <= 0, i => BT.choose({ k: 'item', id, target: i })); else BT.choose({ k: 'item', id }); });
  };

  /* ---------- Управление ---------- */
  const joy = $('joy'), knob = $('knob'); let jid = null, jx = 0, jy = 0, jdir = null;
  const keys = {};
  UI.dir = function () {
    if (jdir) return jdir;
    if (keys.ArrowUp || keys.KeyW) return 'up'; if (keys.ArrowDown || keys.KeyS) return 'down'; if (keys.ArrowLeft || keys.KeyA) return 'left'; if (keys.ArrowRight || keys.KeyD) return 'right';
    return null;
  };
  $('touch').addEventListener('pointerdown', e => { U.audioInit(); if (jid !== null || e.clientX > innerWidth * 0.55) return; jid = e.pointerId; jx = e.clientX; jy = e.clientY; joy.style.left = (jx - joy.offsetWidth / 2) + 'px'; joy.style.top = (jy - joy.offsetHeight / 2) + 'px'; joy.classList.add('on'); try { $('touch').setPointerCapture(jid); } catch (_) { } });
  $('touch').addEventListener('pointermove', e => {
    if (e.pointerId !== jid) return; let dx = e.clientX - jx, dy = e.clientY - jy; const R = joy.offsetWidth / 2, l = Math.hypot(dx, dy);
    if (l > R) { dx *= R / l; dy *= R / l; } knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    jdir = l < R * 0.3 ? null : Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  });
  const jup = e => { if (e.pointerId !== jid) return; jid = null; jdir = null; knob.style.transform = ''; joy.classList.remove('on'); };
  $('touch').addEventListener('pointerup', jup); $('touch').addEventListener('pointercancel', jup);
  $('btn-a').addEventListener('click', () => { U.audioInit(); G.actionA(); });
  $('btn-menu').addEventListener('click', () => { U.audioInit(); if (G.mode === 'world' && !UI.dialogOpen()) UI.openMenu(); });
  addEventListener('keydown', e => {
    keys[e.code] = 1; U.audioInit();
    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') { e.preventDefault(); if (UI.dialogOpen()) $('dlg').click(); else if (G.mode === 'battle') $('bmsg').click(); else G.actionA(); }
    if (e.code === 'KeyM' || e.code === 'Escape') G.onBack();
  });
  addEventListener('keyup', e => { keys[e.code] = 0; });
  document.addEventListener('contextmenu', e => e.preventDefault());
})();
