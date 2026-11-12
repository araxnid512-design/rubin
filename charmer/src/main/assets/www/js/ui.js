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
      const L = live[i]; if (!L.cv.isConnected) { live.splice(i, 1); continue; } if (L.cv.offsetParent === null) continue;
      const x = L.cv.getContext('2d'), w = L.cv.width, h = L.cv.height;
      x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, w, h);
      const k = L.o.k || h / 262; x.translate(w / 2, L.o.y ? h * L.o.y : h - 6); x.scale(k, k);
      ART.girl(x, L.id, { t: t + (L.o.ph || 0), expr: L.o.expr || 'normal', pose: L.o.pose, bloom: L.o.bloom, outfit: L.o.outfit, talk: L.o.talk, st: L.o });
    }
    if (vn.bg) {
      const c = $('vn'), w = c.width, h = c.height, x = c.getContext('2d');
      ART.vnBg(x, vn.bg, w, h, t);
      if (vn.id && vn.bg !== 'black') { x.save(); const k = h / 142; x.translate(w * (vn.x || 0.5), h * 1.56 + Math.sin(t * 1.4) * 2); x.scale(k, k); ART.girl(x, vn.id, { t, expr: vn.expr || 'normal', bloom: vn.bloom, outfit: vn.wear || vn.outfit, talk: vn.talk, st: vn }); x.restore(); }
    }
  };
  const vn = { bg: null, id: null, expr: null, wear: null };
  UI.openPanel = (title, html) => open(title, html);
  UI.livePic = (w, h, id, o) => pic(mkCanvas(w, h), id, o);
  function vnSet(bg) {
    vn.bg = bg; const c = $('vn'); c.classList.toggle('on', !!bg); $('dlg').classList.toggle('vn', !!bg);
    if (!bg) vn.wear = null;
    if (bg) { const k = Math.min(devicePixelRatio || 1, 2) * 0.6; c.width = innerWidth * k; c.height = innerHeight * k; } else vn.id = null;
  }
  UI.textSpeed = 48;
  UI.titlePic = (c, id, ex) => pic(c, id, { expr: ex, k: c.height / 256, ph: id.length });
  function mkCanvas(w, h, cls) { const c = document.createElement('canvas'); c.width = w; c.height = h; if (cls) c.className = cls; return c; }

  /* ---------- Подсказки и переходы ---------- */
  let zoneT = 0;
  UI.zone = function (n) { $('zone').textContent = n; $('zone').classList.add('on'); zoneT = 2.6; };
  UI.fade = function (cb) { const f = $('fade'); f.classList.add('on'); G.lock = true; setTimeout(() => { cb(); setTimeout(() => { f.classList.remove('on'); G.lock = false; }, 80); }, 260); };

  /* ---------- Диалоги: два портрета, выбор ответа ---------- */
  let dq = null, dcb = null, typed = 0, full = '', asking = null, last = -1;
  const slots = [{ el: $('dlg-pic'), id: null, o: null }, { el: $('dlg-pic2'), id: null, o: null }];
  UI.dialogOpen = () => !!dq;
  let replay = false, voice = null, spT = 0, curGirl = false;
  UI.say = function (lines, cb, opt) {
    dq = (window.ST ? ST.norm(lines) : lines.slice()); dcb = cb || null; asking = null; last = -1; replay = !!(opt && opt.replay); if (window.ST) ST.replay = replay;
    for (const s of slots) { s.id = null; s.o = null; s.el.innerHTML = ''; }
    $('dlg').className = 'on'; nextLine();
  };
  const gName = id => { const g = G.S.party.concat(G.S.box).find(q => q.id === id); return g ? nm(g) : D.GIRLS[id].name; };
  function slotFor(id) {
    let i = slots.findIndex(s => s.id === id);
    if (i < 0) {
      i = slots.findIndex(s => !s.id); if (i < 0) i = last === 0 ? 1 : 0;
      const s = slots[i], g = G.S.party.concat(G.S.box).find(q => q.id === id);
      s.id = id; s.o = { expr: 'normal', k: 2.95, y: 2.6, bloom: g && g.bloom, ph: i * 1.7, outfit: g && g.outfit };
      s.el.innerHTML = ''; s.el.appendChild(pic(mkCanvas(220, 220), id, s.o));
    }
    return i;
  }
  function paint(active) {
    const d = $('dlg'); d.classList.toggle('p1', !!slots[0].id); d.classList.toggle('p2', !!slots[1].id);
    slots.forEach((s, i) => { s.el.classList.toggle('talk', i === active); s.el.classList.toggle('dim', !!s.id && i !== active); });
    $('dlg-who').classList.toggle('r', active === 1);
  }
  function nextLine() {
    let L = dq.shift();
    U.shutUp && U.shutUp();
    while (L && (L.fn || L.next || L.bg !== undefined || L.music || L.wear !== undefined)) {
      if (L.next) { dq = ST.norm(L.next() || []).concat(dq); L = dq.shift(); continue; }
      if (L.fn) { if (!replay) L.fn(); }
      else { if (L.wear !== undefined) vn.wear = L.wear; if (L.bg !== undefined) vnSet(L.bg); if (L.music) U.music(L.music); }
      L = dq && dq.shift();
    }
    if (!dq) return;
    if (!L) { $('dlg').className = ''; vnSet(null); if (G.mode === 'world' && window.FX) U.music(FX.mapMusic()); const c = dcb; dq = null; dcb = null; asking = null; replay = false; if (window.ST) ST.replay = false; if (c) c(); return; }
    const who = $('dlg-who'), ch = $('dlg-ch'); ch.innerHTML = ''; asking = null; who.className = '';
    if (L.ask) {
      asking = L.ask; paint(-1); who.textContent = 'Ты'; who.classList.add('me');
      full = L.t || 'Что ответишь?';
      L.ask.forEach((o, k) => { const e = document.createElement('button'); e.innerHTML = '<i>' + (k + 1) + '</i>' + o.t; e.onclick = ev => { ev.stopPropagation(); choose(k); }; ch.appendChild(e); });
      $('dlg').classList.add('ask');
    } else {
      $('dlg').classList.remove('ask');
      if (L.girl) { const i = slotFor(L.girl); slots[i].o.expr = L.expr || 'normal'; last = i; paint(i); who.textContent = gName(L.girl); if (vn.bg) { vn.id = L.girl; vn.expr = L.expr; const gg = G.S.party.concat(G.S.box).find(q => q.id === L.girl); vn.bloom = gg && gg.bloom; vn.outfit = gg && gg.outfit; } }
      else if (L.me !== undefined) { paint(-1); who.textContent = 'Ты'; who.classList.add('me'); }
      else { paint(-1); who.textContent = L.who || ''; if (!L.who) who.classList.add('nar'); }
      full = L.me !== undefined ? L.me : L.t;
    }
    who.style.display = who.textContent ? '' : 'none'; curGirl = !!(L.girl && !L.ask);
    voice = window.FX ? (L.girl ? FX.VOICE[L.girl] : L.me !== undefined || L.ask ? FX.VOICE.me : L.who ? FX.VOICE.npc : null) : null;
    if (L.girl && !L.ask && U.emote) { const gi = L.girl, tx = L.t; clearTimeout(spT); if (U.ttsOn && U.soundOn && U.hasVox(gi, tx)) { U.say(gi, tx); voice = null; } else { U.emote(gi, L.expr || 'normal'); spT = setTimeout(() => { if (dq && full === tx && U.say(gi, tx)) voice = null; }, 280); } }
    $('dlg-t').classList.toggle('nar', !L.girl && !L.who && L.me === undefined && !L.ask);
    typed = 0; $('dlg-t').textContent = '';
  }
  function choose(k) {
    if (!asking || !asking[k]) return; const o = asking[k]; asking = null;
    U.sfx(o.a && Object.values(o.a).some(v => v > 0) ? 'kiss' : 'select');
    if (window.ST && !replay) ST.aff(o.a);
    dq.unshift(...o.r); nextLine();
  }
  UI.choose = choose;
  $('dlg').addEventListener('click', () => { U.audioInit(); if (!dq) return; if (typed < full.length) { typed = full.length; $('dlg-t').textContent = full; } else if (!asking) { U.sfx('blip'); nextLine(); } });

  /* ---------- Всплывашки, главы, задание ---------- */
  UI.toast = function (t, cls) {
    const e = document.createElement('div'); e.className = 'toast ' + (cls || ''); e.textContent = t; const box = $('toasts'); box.appendChild(e); while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => e.classList.add('out'), 2200); setTimeout(() => e.remove(), 2700);
  };
  let questT = 0;

  /* ---------- Боевые сообщения ---------- */
  let bfull = '', btyped = 0, bdoneT = 0, btap = false;
  UI.bmsg = function (t) { bfull = t; btyped = 0; bdoneT = 0; btap = false; $('bmsg').textContent = ''; };
  UI.bmsgDone = function () { if (btyped < bfull.length) return false; return btap || bdoneT > 0.55 + bfull.length * 0.006; };
  $('bmsg').addEventListener('click', () => { if (btyped < bfull.length) { btyped = bfull.length; $('bmsg').textContent = bfull; } else btap = true; });
  UI.tick = function (dt) {
    { const sp = !!dq && curGirl && (typed < full.length || (U.voxPlaying && U.voxPlaying())); slots.forEach((s, i) => { if (s.o) s.o.talk = sp && i === last; }); vn.talk = sp; }
    if (dq && typed < full.length) { const p0 = typed | 0; typed = Math.min(full.length, typed + dt * UI.textSpeed); $('dlg-t').textContent = full.slice(0, typed | 0); if ((typed | 0) !== p0 && (typed | 0) % 3 === 0) { if (voice) U.voice(voice[0], voice[1]); else U.sfx('blip'); } }
    if (btyped < bfull.length) { btyped = Math.min(bfull.length, btyped + dt * 60); $('bmsg').textContent = bfull.slice(0, btyped | 0); } else bdoneT += dt;
    if (zoneT > 0 && (zoneT -= dt) <= 0) $('zone').classList.remove('on');
    $('money').textContent = G.S ? G.S.money : 0;
    if ((questT -= dt) <= 0 && G.S && window.ST) { questT = 0.5; $('quest-t').textContent = ST.quest(); }
  };

  /* ---------- Окна ---------- */
  const modal = $('modal'), mb = $('m-body');
  let onClose = null;
  function open(title, html, opts) { opts = opts || {}; $('m-title').textContent = title; const keep = modal.classList.contains('hide') ? 0 : (opts.keep ? mb.scrollTop : 0); mb.innerHTML = html; mb.scrollTop = keep; modal.classList.remove('hide'); modal.classList.toggle('noclose', !!opts.forced); onClose = opts.onClose || null; U.sfx('select'); return mb; }
  UI.close = function () { modal.classList.add('hide'); const c = onClose; onClose = null; if (c) c(); };
  UI.modalOpen = () => !modal.classList.contains('hide');
  modal.addEventListener('click', e => { if ((e.target === modal || e.target.closest('[data-x]')) && !modal.classList.contains('noclose')) UI.close(); });

  // выбор стартовой героини
  UI.chooseStarter = function (cb) {
    const b = open('Выбери напарницу', '<p class="sub">Дед оставил три печати. В каждой — по девице. Выбирай сердцем (и стихией).</p><div class="starters"></div>', { forced: true });
    const wrap = b.querySelector('.starters');
    for (const id of D.STARTERS) {
      const g = D.GIRLS[id], card = document.createElement('div'); card.className = 'scard';
      card.appendChild(pic(mkCanvas(200, 240), id, { expr: 'happy', k: 0.92, ph: id.length }));
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
    const tabs = [['party', 'Отряд'], ['bag', 'Сумка'], ['dex', 'Девичник'], ['album', 'Альбом'], ['opt', 'Ещё']];
    const b = open('Меню', '<div class="tabs">' + tabs.map(t => '<button data-tab="' + t[0] + '"' + (t[0] === (tab || 'party') ? ' class="on"' : '') + '>' + t[1] + '</button>').join('') + '</div><div id="tab"></div>');
    b.querySelectorAll('[data-tab]').forEach(el => el.onclick = () => UI.openMenu(el.dataset.tab));
    ({ party: tabParty, bag: tabBag, dex: tabDex, album: tabAlbum, opt: tabOpt })[tab || 'party']($('tab'));
  };
  function tabParty(el) {
    const S = G.S; if (!S.party.length) { el.innerHTML = '<p class="sub">Отряд пуст. Загляни к Бабе Нюре.</p>'; return; }
    el.innerHTML = '<div class="plist"></div>'; const w = el.firstChild;
    S.party.forEach((g, i) => { const row = document.createElement('button'); row.className = 'prow'; row.innerHTML = '<img src="' + ART.thumb[g.id] + '"><div><b>' + nm(g) + ' <small>ур. ' + g.lvl + '</small></b>' + hpBar(g) + '</div><span class="hearts">' + (FX.sulky(g) ? '💢' : '') + hearts(g.aff) + '</span>' + (i === 0 ? '<span class="lead">первая</span>' : ''); row.onclick = () => girlCard(i); w.appendChild(row); });
  }
  function girlCard(i, box) {
    const S = G.S, g = box ? S.box[i] : S.party[i], d = D.GIRLS[g.id], st = G.stats(g), know = S.know || {};
    const love = know[g.id + '+'], hate = know[g.id + '-'];
    const b = open(nm(g), '<div class="gcard"><div class="gpic"></div><div class="ginfo"><small>' + d.kind + ' ' + elTag(d.el) + ' · ур. ' + g.lvl + (FX.sulky(g) ? ' <em class="sulk">💢 обижена</em>' : '') + (S.endings && S.endings[g.id] ? ' <em class="endb">★ концовка</em>' : '') + '</small>' + hpBar(g) +
      '<div class="stats"><span>Атака <b>' + st.atk + '</b></span><span>Защита <b>' + st.def + '</b></span><span>Скорость <b>' + st.spd + '</b></span></div>' +
      '<div class="aff"><span class="hearts">' + hearts(g.aff) + '</span> Привязанность ' + g.aff + '/100 · свиданий ' + (g.dates || 0) + '/3</div>' +
      '<div class="skl">' + d.skills.map(s => '<span class="' + (g.lvl >= s[1] ? '' : 'lock') + '" style="border-color:' + D.EL[D.SK[s[0]].el].c + '">' + D.SK[s[0]].n + (g.lvl >= s[1] ? '' : ' · ур.' + s[1]) + '</span>').join('') +
      '<span class="' + (g.aff >= 75 ? 'heart' : 'lock') + '">' + D.SK['heart_' + g.id].n + (g.aff >= 75 ? '' : ' · ♥75') + '</span></div>' +
      '<p class="bio">' + d.bio + '</p><p class="taste">Любит: <b>' + (love ? D.ITEMS[love].n : '?') + '</b> · Не любит: <b>' + (hate ? D.ITEMS[hate].n : '?') + '</b></p><div class="acts"></div></div></div>');
    b.querySelector('.gpic').appendChild(pic(mkCanvas(240, 300), g.id, { expr: FX.sulky(g) ? 'angry' : g.aff >= 50 ? 'happy' : 'normal', k: 1.14, bloom: g.bloom, outfit: g.outfit }));
    const acts = b.querySelector('.acts'), btn = (t, f, cls) => { const e = document.createElement('button'); e.textContent = t; if (cls) e.className = cls; e.onclick = f; acts.appendChild(e); };
    btn('Поговорить', () => talk(g), 'go');
    btn('Вдвоём ♥', () => FX.together(g), 'rose');
    const di = ST.dateInfo(g);
    if (di.done) { if (FX.canEnd(g)) btn('★ Признание', () => { UI.close(); UI.say(FX.ending(g), () => G.save()); }, 'gold'); else btn('Признание: нужно ♥90', () => U.sfx('deny'), 'off'); }
    else if (di.ok) btn('Свидание ♥ ' + (di.n + 1) + '/3', () => { UI.close(); UI.say(ST.date(g), () => G.save()); }, 'rose');
    else btn(g.dated ? 'Свидание: отдохни' : 'Свидание: нужно ♥' + di.need, () => U.sfx('deny'), 'off');
    if (D.GIFTS.some(it => S.bag[it])) btn('Подарок…', () => giftMenu(g));
    const outs = ['base'].concat(Object.keys(S.outfits || {}));
    if (outs.length > 1) btn('Наряд: ' + D.OUTFITS[g.outfit || 'base'].n, () => { const k = outs[(outs.indexOf(g.outfit || 'base') + 1) % outs.length]; g.outfit = k === 'base' ? undefined : k; U.sfx('select'); girlCard(i, box); });
    const mg = window.MG && MG.forGirl(g.id); if (mg) btn('Игра: ' + MG.LIST[mg].n.split(' ')[0], () => FX.playMG(g));
    if (!box && i > 0) btn('Сделать первой', () => { S.party.splice(i, 1); S.party.unshift(g); WD.fol.path = []; U.sfx('select'); UI.openMenu('party'); });
    btn('Назад', () => box ? UI.close() : UI.openMenu('party'));
  }
  UI.cardOf = g => { const i = G.S.party.indexOf(g); if (i >= 0) girlCard(i, false); else girlCard(G.S.box.indexOf(g), true); };
  function giftMenu(g) {
    const S = G.S, know = S.know || {};
    const b = open('Подарок: ' + nm(g), '<div class="ilist">' + D.GIFTS.filter(it => S.bag[it]).map(it => '<div class="irow"><img src="' + ART.ICON[it] + '"><div><b>' + D.ITEMS[it].n + ' ×' + S.bag[it] + (know[g.id + '+'] === it ? ' <em class="lv">♥ любит</em>' : know[g.id + '-'] === it ? ' <em class="ht">✗ не любит</em>' : '') + '</b><p>' + D.ITEMS[it].d + '</p></div><button data-g="' + it + '">Подарить</button></div>').join('') + '</div>');
    b.querySelectorAll('[data-g]').forEach(e => e.onclick = () => { UI.close(); U.sfx('kiss'); UI.say(FX.gift(g, e.dataset.g), () => G.save()); });
  }
  function talk(g) {
    const d = D.GIRLS[g.id], tier = Math.min(3, Math.floor(g.aff / 25));
    UI.close();
    if (FX.sulky(g) && !g.talked) { g.talked = true; g.sulk = Math.max(0, g.sulk - 20); return UI.say([{ girl: g.id, expr: 'angry', t: U.pick(['Хм. Я с тобой не разговариваю.', 'Иди к своей любимице, раз она лучше.', 'Не смотри на меня так. Я обижена.'], Math.random) }, { me: 'Прости. Я правда ценю тебя.' }, { girl: g.id, expr: 'blush', t: 'Ну… ладно. Чуть-чуть простила. Подарок бы не помешал.' }], () => G.save()); }
    if (g.talked) return UI.say([{ girl: g.id, expr: 'blush', t: U.pick(['Мы же только что болтали! Иди уже, а то покраснею.', 'Ещё поговорить? Ты что, соскучился? …Я тоже.', 'Отдохни сначала в таверне, болтун.'], Math.random) }]);
    g.talked = true; g.aff = Math.min(100, g.aff + 4);
    const ex = ['normal', 'blush', 'happy', 'blush'][tier];
    UI.say([{ girl: g.id, expr: ex, t: d.talk[tier] }, { who: '', t: nm(g) + ': привязанность +4' + (tier < 3 && g.aff >= (tier + 1) * 25 ? '. Кажется, она стала относиться к тебе теплее!' : '') }], () => G.save());
  }
  function gift(g, it) { UI.close(); U.sfx('kiss'); UI.say(FX.gift(g, it), () => G.save()); }
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
    const S = G.S, n = D.ORDER.filter(id => S.caught[id]).length, n2 = D.SECRET.filter(id => S.caught[id]).length;
    const cell = id => { const g = D.GIRLS[id], seen = S.seen[id], c = S.caught[id]; return '<div class="dcell' + (c ? ' got' : '') + '"><img src="' + ART.thumb[id] + '" class="' + (seen ? '' : 'sil') + '"><b>' + (seen ? g.name : '???') + '</b><small>' + (seen ? g.kind : 'не встречена') + '</small>' + (c ? '<i class="hrt on"></i>' : '') + (S.endings && S.endings[id] ? '<i class="star">★</i>' : '') + '</div>'; };
    let h = '<p class="sub">Приручено ' + n + ' из 10. Встречено ' + D.ORDER.filter(id => S.seen[id]).length + '. Концовок: ' + Object.keys(S.endings || {}).length + '. Кубков: ' + (S.cups || 0) + '.</p><div class="dex">' + D.ORDER.map(cell).join('') + '</div>';
    if (S.flags.boss) h += '<h4>Тайные девы юга · ' + n2 + ' из 4</h4><div class="dex">' + D.SECRET.map(cell).join('') + '</div>';
    el.innerHTML = h;
  }
  function tabAlbum(el) {
    const list = FX.album(); let h = '<p class="sub">Открытые сцены можно пересмотреть. Выборы в повторах не влияют на привязанность.</p>', sec = '';
    for (const e of list) { if (e.sec !== sec) { if (sec) h += '</div>'; sec = e.sec; h += '<h4>' + sec + ' · ' + list.filter(q => q.sec === sec && q.open).length + '/' + list.filter(q => q.sec === sec).length + '</h4><div class="alb">'; } h += '<button class="' + (e.open ? '' : 'off') + '" data-k="' + e.k + '">' + (e.id ? '<img src="' + ART.thumb[e.id] + '">' : '') + (e.open ? e.n : '???') + '</button>'; }
    el.innerHTML = h + '</div>';
    el.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { if (b.classList.contains('off')) return U.sfx('deny'); UI.close(); FX.replay(b.dataset.k); });
  }
  const SPD = [['медленно', 26], ['обычно', 48], ['быстро', 95], ['мгновенно', 9999]];
  function tabOpt(el) {
    const sp = SPD.find(q => q[1] === UI.textSpeed) || SPD[1];
    let h = '<div class="menu"><button data-o="snd">Звук: ' + (U.soundOn ? 'вкл' : 'выкл') + '</button><button data-o="q">Графика: ' + (G.lowq ? 'экономная (быстрее)' : 'высокая') + '</button><button data-o="tts">Голос героинь: ' + (U.ttsOn ? 'вкл' : 'выкл') + '</button><button data-o="spd">Скорость текста: ' + sp[0] + '</button><button data-o="save">Сохранить игру</button></div><h4>Слоты сохранения</h4><div class="slots">';
    for (let k = 1; k <= 3; k++) { const i = G.slotInfo(k); h += '<div class="slot' + (G.slot === k ? ' cur' : '') + '"><b>Слот ' + k + (G.slot === k ? ' · текущий' : '') + '</b><small>' + (i || 'пусто') + '</small><div><button data-sv="' + k + '">Записать</button><button data-ld="' + k + '"' + (i ? '' : ' class="off"') + '>Загрузить</button></div></div>'; }
    h += '</div><div class="menu"><button data-o="new" class="danger">Новая игра</button></div><p class="sub">Игра для взрослых: флирт и шутки, без откровенных сцен. Все героини — совершеннолетние чудища.</p>';
    el.innerHTML = h;
    el.querySelectorAll('[data-o]').forEach(b => b.onclick = () => {
      const o = b.dataset.o;
      if (o === 'snd') { U.soundOn = !U.soundOn; G.saveCfg(); UI.openMenu('opt'); }
      else if (o === 'tts') { U.ttsOn = !U.ttsOn; if (!U.ttsOn) U.shutUp(); else { const l0 = G.S.party[0]; if (l0) U.say(l0.id, D.GIRLS[l0.id].tame); } G.saveCfg(); UI.openMenu('opt'); }
      else if (o === 'q') { G.lowq = !G.lowq; G.saveCfg(); G.resize(); UI.openMenu('opt'); }
      else if (o === 'spd') { UI.textSpeed = SPD[(SPD.indexOf(sp) + 1) % SPD.length][1]; G.saveCfg(); UI.openMenu('opt'); }
      else if (o === 'save') { G.save(); b.textContent = 'Сохранено ✓'; U.sfx('select'); }
      else if (o === 'new') { if (b.dataset.s) { G.reset(); UI.close(); } else { b.dataset.s = 1; b.textContent = 'Точно? Нажми ещё раз'; } }
    });
    el.querySelectorAll('[data-sv]').forEach(b => b.onclick = () => { G.saveTo(+b.dataset.sv); U.sfx('select'); UI.openMenu('opt'); });
    el.querySelectorAll('[data-ld]').forEach(b => b.onclick = () => { if (b.classList.contains('off')) return U.sfx('deny'); UI.close(); G.loadFrom(+b.dataset.ld); });
  }

  /* ---------- Лавка и таверна ---------- */
  UI.openShop = function (tab) {
    const S = G.S; tab = tab || 'goods'; S.outfits = S.outfits || {}; S.furn = S.furn || {};
    const tabs = [['goods', 'Товары'], ['gifts', 'Подарки'], ['dress', 'Наряды'], ['furn', 'Мебель']];
    let h = '<div class="tabs">' + tabs.map(t => '<button data-st="' + t[0] + '"' + (t[0] === tab ? ' class="on"' : '') + '>' + t[1] + '</button>').join('') + '</div><p class="sub">' + D.NPC.shop + '</p><div class="ilist">';
    const row = (key, img, name, have, desc, price, owned) => '<div class="irow"><img src="' + img + '"><div><b>' + name + ' <small>' + have + '</small></b><p>' + desc + '</p></div><button data-buy="' + key + '"' + (owned ? ' class="off"' : S.money < price ? ' class="off"' : '') + '>' + (owned ? 'Есть ✓' : price + ' ₽') + '</button></div>';
    if (tab === 'goods') for (const id of D.SHOP) { const it = D.ITEMS[id]; h += row(id, ART.ICON[id], it.n, 'есть: ' + (S.bag[id] || 0), it.d, it.price); }
    if (tab === 'gifts') for (const id of D.GIFTS.filter(q => !D.SHOP.includes(q))) { const it = D.ITEMS[id]; h += row(id, ART.ICON[id], it.n, 'есть: ' + (S.bag[id] || 0), it.d, it.price); }
    if (tab === 'dress') for (const k in D.OUTFITS) { if (k === 'base' || D.OUTFITS[k].hidden) continue; const o = D.OUTFITS[k]; h += row('o_' + k, ART.ICON.dress, o.n, '', o.d + ' Надеть можно любой героине в её карточке.', o.price, S.outfits[k]); }
    if (tab === 'furn') for (const k in D.FURN) { const f = D.FURN[k]; h += row('f_' + k, ART.ICON['f_' + k], f.n, '', f.d + ' Нравится: ' + f.love.map(id => D.GIRLS[id].name).join(', ') + '.', f.price, S.furn[k]); }
    const b = open('Лавка · у тебя ' + S.money + ' ₽', h + '</div>');
    b.querySelectorAll('[data-st]').forEach(e => e.onclick = () => UI.openShop(e.dataset.st));
    b.querySelectorAll('[data-buy]').forEach(el => el.onclick = () => {
      const k = el.dataset.buy;
      if (k.startsWith('o_')) { const o = D.OUTFITS[k.slice(2)]; if (S.outfits[k.slice(2)] || S.money < o.price) return U.sfx('deny'); S.money -= o.price; S.outfits[k.slice(2)] = 1; U.sfx('caught'); UI.toast('Новый наряд: ' + o.n, 'up'); return UI.openShop(tab); }
      if (k.startsWith('f_')) { const f = D.FURN[k.slice(2)]; if (S.furn[k.slice(2)] || S.money < f.price) return U.sfx('deny'); S.money -= f.price; U.sfx('caught'); UI.close(); return UI.say(FX.buyFurn(k.slice(2)), () => G.save()); }
      const it = D.ITEMS[k]; if (S.money < it.price) return U.sfx('deny'); S.money -= it.price; S.bag[k] = (S.bag[k] || 0) + 1; U.sfx('select'); UI.openShop(tab);
    });
  };
  UI.openTavern = function () {
    const S = G.S, b = open('Таверна «Пьяный гусь»', '<p class="sub">' + D.NPC.tavern + '</p><div class="menu">' + (S.flags.boss && !S.flags.party ? '<button data-t="ev" data-k="party" class="gold">★ Праздник!</button>' : S.flags.party && !S.flags.allten && D.ORDER.every(id => S.caught[id]) ? '<button data-t="ev" data-k="ten" class="gold">★ Все десять в сборе!</button>' : '') + (S.flags.boss && !S.flags.tourDay && S.party.length ? '<button data-t="tour" class="gold">🏆 Турнир (3 боя подряд)</button>' : '') + '<button data-t="rest" class="go">Отдохнуть (вылечить всех)</button><button data-t="sit"' + (S.party.length < 2 ? ' class="off"' : '') + '>Посиделки с девицами</button><button data-t="box">Запас героинь (' + S.box.length + ')</button><button data-x>Уйти</button></div>');
    U.music('tavern');
    b.querySelector('[data-t=rest]').onclick = () => {
      G.healAll(); for (const g of S.party.concat(S.box)) { g.talked = false; g.dated = false; g.mgDone = false; g.pets = 0; g.nightDone = false; g.sulk = Math.max(0, (g.sulk || 0) - 15); }
      S.clock = 0.05; S.flags.tourDay = false; S.flags.homeEv = false; S.flags.bathEv = false; for (const k in D.REMATCH) S.flags['r_' + k] = false; U.sfx('heal'); UI.close(); UI.fade(() => { });
      const l = S.party[0], night = ST.night();
      UI.say([{ who: 'Тётка Дуня', t: 'Спите, голубки. Утро вечера мудренее.' }].concat(night || (l ? [{ girl: l.id, expr: 'sleepy', t: U.pick(['Ммм… ты тёплый. Я тут полежу… на тебе… пять минуточек.', 'Спокойной ночи, Чаровник. Не храпи.', 'Если приснюсь — не просыпайся.'], Math.random) }] : [])), () => G.save());
    };
    const ev = b.querySelector('[data-t=ev]'); if (ev) ev.onclick = () => { UI.close(); UI.say(ev.dataset.k === 'party' ? ST.party() : ST.allTen(), () => G.save()); };
    const tr = b.querySelector('[data-t=tour]'); if (tr) tr.onclick = () => { if (!G.alive()) return U.sfx('deny'); UI.close(); FX.tourney(); };
    const sit = b.querySelector('[data-t=sit]'); if (sit) sit.onclick = () => { if (S.party.length < 2) return U.sfx('deny'); UI.close(); UI.say(['#Вы садитесь за длинный стол. Тётка Дуня приносит пироги. Девицы косятся друг на друга…'].concat(ST.banter(true)), () => G.save()); };
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
    for (const id of G.skillsOf(g)) { const used = D.SK[id].heart && BT.b.hu[g.uid]; const s = D.SK[id], e = document.createElement('button'), fe = BT.b ? D.eff(s.el, D.GIRLS[BT.b.foe.id].el) : 1; e.style.setProperty('--c', D.EL[s.el].c); e.innerHTML = '<b>' + s.n + '</b><small>' + D.EL[s.el].n + (s.pw ? ' · сила ' + s.pw : ' · ' + (s.d || 'эффект')) + (s.pw && fe > 1 ? ' · <em>эффективно!</em>' : '') + '</small>'; if (used) e.classList.add('off'); if (s.heart) e.classList.add('hs'); e.onclick = () => { if (used) return U.sfx('deny'); U.sfx('select'); BT.choose({ k: 'skill', id }); }; w.appendChild(e); }
    const pt = FX.duetPartner(g); if (pt && !BT.b.duet) { const e = document.createElement('button'); e.className = 'hs'; e.style.setProperty('--c', '#ff4f7b'); e.innerHTML = '<b>♥ Дуэт с ' + nm(pt) + '</b><small>совместный удар · раз за бой</small>'; e.onclick = () => { U.sfx('select'); BT.choose({ k: 'duet', pid: pt.uid }); }; w.appendChild(e); }
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
  // нажал на землю — герой идёт туда; нажал на девицу, жителя или дом — подойдёт и заговорит;
  // держишь палец — идёт за пальцем
  const keys = {}, tch = $('touch');
  UI.dir = function () {
    if (keys.ArrowUp || keys.KeyW) return 'up'; if (keys.ArrowDown || keys.KeyS) return 'down'; if (keys.ArrowLeft || keys.KeyA) return 'left'; if (keys.ArrowRight || keys.KeyD) return 'right';
    return null;
  };
  let pid = null, px0 = 0, py0 = 0, drag = false, holdT = 0;
  tch.addEventListener('pointerdown', e => { U.audioInit(); if (pid !== null) return; pid = e.pointerId; px0 = e.clientX; py0 = e.clientY; drag = false; try { tch.setPointerCapture(pid); } catch (_) { } clearTimeout(holdT); holdT = setTimeout(() => { if (pid !== null) { drag = true; WD.steer(px0, py0); } }, 280); });
  tch.addEventListener('pointermove', e => { if (e.pointerId !== pid) return; px0 = drag ? e.clientX : px0; if (!drag && Math.hypot(e.clientX - px0, e.clientY - py0) > 18) drag = true; if (drag) { px0 = e.clientX; py0 = e.clientY; WD.steer(e.clientX, e.clientY); } });
  const pup = e => { if (e.pointerId !== pid) return; pid = null; clearTimeout(holdT); if (drag) WD.steer(null); else WD.tap(e.clientX, e.clientY); drag = false; };
  tch.addEventListener('pointerup', pup); tch.addEventListener('pointercancel', e => { if (e.pointerId === pid) { pid = null; clearTimeout(holdT); WD.steer(null); drag = false; } });
  $('btn-map').addEventListener('click', () => { U.audioInit(); if (G.mode === 'world' && !UI.dialogOpen()) UI.openMap(); });
  /* ---------- Карта долины ---------- */
  UI.openMap = function () {
    const m = WD.m; if (!m.zone) return UI.toast('Здесь карта не нужна — ты внутри.', '');
    const b = open('Карта долины', '<p class="sub">Нажми на место — герой сам дойдёт туда. ♥ — девы, которых ты уже встречал.</p><div class="wmap"><canvas></canvas></div>');
    const cv = b.querySelector('canvas'), k = 8; cv.width = m.w * k; cv.height = m.h * k; const x = cv.getContext('2d'), S = G.S;
    const COL = { village: '#9ad86a', meadow: '#7ccc5a', forest: '#3e8a34', mountain: '#b8b4c4', beach: '#f2dca0', swamp: '#5a7a44' };
    for (let y = 0; y < m.h; y++) for (let xx = 0; xx < m.w; xx++) { const i = y * m.w + xx, t = m.tile[i]; x.fillStyle = t === 2 ? '#4ab0e8' : t === 1 ? '#e2c48a' : COL[m.zone[i]]; x.fillRect(xx * k, y * k, k, k); if (m.block[i] && t !== 2) { x.fillStyle = 'rgba(0,40,0,.22)'; x.fillRect(xx * k, y * k, k, k); } }
    x.textAlign = 'center'; x.font = 'italic 900 15px sans-serif'; x.lineWidth = 4; x.strokeStyle = '#fff8f0'; x.fillStyle = '#21121c';
    for (const [t, tx, ty] of [['Кривые Ложки', 21, 27], ['Медовый луг', 50, 42], ['Шептучий лес', 26, 6], ['Звонкие скалы', 76, 16], ['Солёный пляж', 40, 51], ['Болото', 78, 34]]) { x.strokeText(t, tx * k, ty * k); x.fillText(t, tx * k, ty * k); }
    for (const h of m.houses) { x.fillStyle = { tower: '#d83a9a', cave: '#5a5468', manor: '#8a5ad8' }[h.k] || '#d4523a'; x.fillRect(h.x * k, h.y * k, 4 * k, 4 * k); x.strokeStyle = '#21121c'; x.lineWidth = 2; x.strokeRect(h.x * k, h.y * k, 4 * k, 4 * k); }
    for (const g of m.gates) if (!S.flags[g.flag]) { x.fillStyle = '#ff4f7b'; x.fillRect(g.x * k - 2, g.y * k - 2, k + 4, k + 4); }
    for (const w of WD.wild || []) if (S.seen[w.id]) ART.heart(x, (w.px / 48 + 0.5) * k, (w.py / 48 + 0.5) * k, 7, '#ff4f7b');
    const q = [[11, 33], [40, 25], [59, 11], [83, 9], [83, 9], [17, 33]][ST.stage()];
    if (q) { x.fillStyle = '#ffd04a'; x.strokeStyle = '#21121c'; x.lineWidth = 2.5; x.beginPath(); for (let i = 0; i < 10; i++) { const a = i * 0.628 - 1.57, rr = i % 2 ? 6 : 14; x.lineTo(q[0] * k + Math.cos(a) * rr, q[1] * k + Math.sin(a) * rr); } x.closePath(); x.fill(); x.stroke(); }
    x.fillStyle = '#fff'; x.strokeStyle = '#21121c'; x.lineWidth = 3; x.beginPath(); x.arc((S.x + 0.5) * k, (S.y + 0.5) * k, 8, 0, 6.283); x.fill(); x.stroke(); x.fillStyle = '#3a8ad8'; x.beginPath(); x.arc((S.x + 0.5) * k, (S.y + 0.5) * k, 4.4, 0, 6.283); x.fill();
    cv.onclick = e => { const r = cv.getBoundingClientRect(), tx = Math.floor((e.clientX - r.left) / r.width * m.w), ty = Math.floor((e.clientY - r.top) / r.height * m.h); UI.close(); WD.goTile(tx, ty); };
  };
  $('btn-menu').addEventListener('click', () => { U.audioInit(); if (G.mode === 'world' && !UI.dialogOpen()) UI.openMenu(); });
  addEventListener('keydown', e => {
    keys[e.code] = 1; U.audioInit();
    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') { e.preventDefault(); if (UI.dialogOpen()) $('dlg').click(); else if (G.mode === 'battle') $('bmsg').click(); else G.actionA(); }
    if (e.code === 'KeyM' || e.code === 'Escape') G.onBack();
    if (UI.dialogOpen() && /^Digit[1-5]$/.test(e.code)) UI.choose(+e.code.slice(5) - 1);
  });
  addEventListener('keyup', e => { keys[e.code] = 0; });
  document.addEventListener('contextmenu', e => e.preventDefault());
})();
