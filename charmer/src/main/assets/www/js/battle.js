'use strict';
/* Пошаговый бой: очередь событий, урон, статусы, приручение, опыт */
(function () {
  const BT = window.BT = {};
  let b = null;
  const R = () => Math.random();
  const nm = g => (g.bloom ? D.GIRLS[g.id].bloom : D.GIRLS[g.id].name);
  BT.active = () => !!b;

  /* ---------- Старт ---------- */
  BT.start = function (o) {
    const S = G.S;
    b = BT.b = { zone: o.zone, wild: !!o.wild, trainer: o.trainer ? D.TRAINERS[o.trainer] : null, tkey: o.trainer, npc: o.npc, q: [], cur: null, over: false, menu: false, t: 0, pops: [], heart: null, parts: [], bursts: [], amb: [], shake: 0, flashS: 0, introT: 0, hu: {}, duet: false, endured: {},
      foeTeam: o.wild ? [G.mkGirl(o.wild.id, o.wild.lvl)] : D.TRAINERS[o.trainer].team.map(([id, l]) => G.mkGirl(id, l)), fi: 0, mi: S.party.findIndex(g => g.hp > 0) };
    b.foe = b.foeTeam[0];
    for (const g of b.foeTeam.concat(S.party)) { g.stg = { atk: 0, def: 0, spd: 0 }; g.st = null; g.stT = 0; }
    b.A = { me: side(), foe: side() }; b.A.me.slide = -1; b.A.foe.slide = 1;
    S.seen[b.foe.id] = true;
    G.mode = 'battle'; UI.battleOn(true); U.music(o.trainer || (o.wild && D.GIRLS[o.wild.id].secret) ? 'boss' : 'battle'); U.sfx('encounter');
    const fg = D.GIRLS[b.foe.id];
    push({ t: 'anim', k: 'intro', dur: 0.7 });
    if (b.wild) push(msg('Из травы выскакивает ' + (fg.kind === 'Неко' || fg.kind === 'Кицунэ' ? '' : '') + 'дикая ' + fg.kind.toLowerCase() + ' ' + fg.name + '!'));
    else { push(msg(b.trainer.n + ' вызывает тебя на бой!')); push(msg(b.trainer.n + ': «Вперёд, ' + nm(b.foe) + '!»')); }
    push(msg('Вперёд, ' + nm(me()) + '!'), { t: 'fn', f: () => { b.A.me.hpd = me().hp; } });
    const ri = FX.battleIntro(me()); if (ri) push(msg(ri));
    if (FX.sulky(me())) push(msg(nm(me()) + ' дуется и демонстративно смотрит в сторону…'));
    push({ t: 'fn', f: openMenu });
  };
  function side() { return { slide: 0, lunge: 0, shake: 0, alpha: 1, scale: 1, expr: null, hpd: null, flash: 0, pose: null, faint: 0 }; }
  const me = () => G.S.party[b.mi], foe = () => b.foe;
  const msg = (t, wait) => ({ t: 'msg', s: t, wait: wait });
  function push(...items) { b.q.push(...items); }
  function ins(...items) { b.q.unshift(...items); }

  /* ---------- Показатели ---------- */
  const stage = v => v >= 0 ? (2 + v) / 2 : 2 / (2 - v);
  function stat(g, k) { let v = G.stats(g)[k] * stage(g.stg[k] || 0); if (k === 'atk' && g.st === 'burn') v *= 0.75; return v; }

  /* ---------- Выбор игрока ---------- */
  function openMenu() { if (b.over) return; b.menu = true; UI.battleMenu(me(), b); }
  BT.choose = function (a) {
    if (!b || !b.menu) return; b.menu = false; UI.battleMenuHide();
    const fa = aiPick(), first = a.k !== 'skill' || stat(me(), 'spd') * (me().st === 'stun' ? 0.5 : 1) >= stat(foe(), 'spd') * (foe().st === 'stun' ? 0.5 : 1);
    const mine = { t: 'fn', f: () => act('me', a) }, theirs = { t: 'fn', f: () => { if (!b.over && foe().hp > 0) doSkill('foe', fa); } };
    if (a.k === 'skill' && D.SK[a.id].heart) b.hu[me().uid] = true;
    if (a.k === 'duet') b.duet = true;
    if (a.k === 'run' && !b.wild) { push(msg('От соперника не сбегают! Позор.'), { t: 'fn', f: openMenu }); return; }
    if (first) push(mine, theirs); else push(theirs, mine);
    push({ t: 'fn', f: endTurn });
  };
  function aiPick() {
    const g = foe(), sk = G.skillsOf(g), hpk = g.hp / G.stats(g).hp, myEl = D.GIRLS[me().id].el;
    if (hpk < 0.35 && R() < 0.6) { const h = sk.find(s => D.SK[s].fx && D.SK[s].fx.heal); if (h) return h; }
    let best = sk[0], bv = -1; for (const s of sk) { const d = D.SK[s]; let v = d.pw ? d.pw * D.eff(d.el, myEl) * (d.el === D.GIRLS[g.id].el ? 1.25 : 1) : 35; v *= 0.6 + R() * 0.8; if (d.fx && d.fx.heal) v = 10; if (v > bv) { bv = v; best = s; } }
    return best;
  }

  /* ---------- Действия ---------- */
  function act(sideK, a) {
    if (b.over) return;
    if (a.k === 'skill') { if (me().hp > 0) doSkill('me', a.id); }
    else if (a.k === 'duet') duet(a.pid);
    else if (a.k === 'compl') compliment();
    else if (a.k === 'seal') seal();
    else if (a.k === 'item') useItem(a.id, a.target);
    else if (a.k === 'switch') switchTo(a.idx);
    else if (a.k === 'run') { if (R() < 0.8) { ins(msg('Ты сбежал. Героически и очень быстро.'), { t: 'fn', f: () => end('run') }); b.over = true; } else ins(msg('Не вышло сбежать! Она преградила путь.')); }
  }
  function canAct(sideK) {
    const g = sideK === 'me' ? me() : foe(), n = nm(g);
    if (g.st === 'sleep') { if (--g.stT <= 0) { g.st = null; ins(msg(n + ' просыпается и сладко потягивается.')); return true; } ins(msg(n + ' сладко спит… Хррр.')); return false; }
    if (g.st === 'freeze') { if (R() < 0.3) { g.st = null; ins(msg(n + ' оттаяла!')); return true; } ins(msg(n + ' заморожена и не может двинуться.')); return false; }
    if (g.st === 'stun' && R() < 0.3) { ins(msg(n + ' в оцепенении и пропускает ход!')); return false; }
    if (g.st === 'charm') { if (--g.stT <= 0) { g.st = null; } if (R() < 0.5) { ins(msg(n + ' смущённо мнётся и забывает атаковать.')); return false; } }
    return true;
  }
  function doSkill(sideK, skId) {
    if (b.over) return;
    const A = sideK === 'me' ? me() : foe(), Dd = sideK === 'me' ? foe() : me(), oth = sideK === 'me' ? 'foe' : 'me', sk = D.SK[skId], n = nm(A);
    if (A.hp <= 0) return;
    const items = [];
    if (!canAct(sideK)) return;
    if (sideK === 'me' && !sk.heart) {
      if (FX.sulky(A) && R() < 0.25) { ins(msg(n + ': «' + U.pick(D.SULK, R) + '»'), { t: 'expr', side: 'me', e: 'angry', dur: 1.2 }); return; }
      if (FX.distract(A)) { const rv = FX.rel(A).find(r => !r.friend); ins(msg(nm(rv.g) + ' что-то язвит из-за спины, и ' + n + ' отвлекается на перепалку!'), { t: 'expr', side: 'me', e: 'angry', dur: 1.2 }); return; }
    }
    const fxx = sk.fx || {}, tgt = sk.pw || !(fxx.heal || fxx.self) ? oth : sideK;
    items.push(msg((sideK === 'foe' && b.wild ? 'Дикая ' : '') + n + ': «' + sk.n + '!»'), { t: 'anim', k: sk.pw ? 'lunge' : 'cast', side: sideK, dur: 0.38 }, { t: 'anim', k: 'fx', elm: sk.el, from: sideK, to: tgt, self: tgt === sideK, dur: sk.el === 'thunder' || sk.el === 'light' ? 0.6 : 0.5 });
    if (R() > sk.acc) { items.push(msg('Мимо! ' + nm(Dd) + ' грациозно уворачивается.')); ins(...items); return; }
    const fx = sk.fx || {};
    if (sk.pw) {
      const L = A.lvl, eff = D.eff(sk.el, D.GIRLS[Dd.id].el), stab = sk.el === D.GIRLS[A.id].el ? 1.25 : 1, crit = R() < (sk.heart ? 0.3 : 0.07) ? 1.5 : 1, bst = sideK === 'me' ? FX.boost(A) : 1;
      let dmg = Math.floor(((2 * L / 5 + 2) * sk.pw * stat(A, 'atk') / Math.max(1, stat(Dd, 'def'))) / 50 + 2);
      dmg = Math.max(1, Math.floor(dmg * eff * stab * crit * bst * (0.85 + R() * 0.15)));
      let nh = Math.max(0, Dd.hp - dmg);
      if (nh <= 0 && oth === 'me' && Dd.aff >= 75 && Dd.hp > 1 && !b.endured[Dd.uid]) { b.endured[Dd.uid] = true; nh = 1; items.push({ t: 'fn', f: () => { } }); b.endMsg = nm(Dd) + ' стискивает зубы: «Я не упаду… не при нём!» Держится на 1 HP!'; }
      Dd.hp = nh;
      items.push({ t: 'anim', k: 'hit', side: oth, dur: 0.4, dmg, eff, crit: crit > 1 }, { t: 'hp', side: oth, to: nh });
      if (b.endMsg) { items.push({ t: 'expr', side: 'me', e: 'angry', dur: 1.5 }, msg(b.endMsg)); b.endMsg = null; }
      if (sk.heart) items.push({ t: 'sfx', s: 'kiss' }, msg('Сила любви! ' + n + ' вкладывает в удар всё сердце.'));
      if (crit > 1) items.push(msg('Точно в сердечко! Критический удар!'));
      if (eff > 1) items.push(msg('Очень эффективно! ' + nm(Dd) + ' такого не ожидала.'));
      else if (eff < 1) items.push(msg('Так себе эффект. ' + nm(Dd) + ' даже не обиделась.'));
      if (fx.drain && nh < Dd.hp + dmg) { const hl = Math.floor(dmg * fx.drain), mx = G.stats(A).hp; A.hp = Math.min(mx, A.hp + hl); items.push({ t: 'hp', side: sideK, to: A.hp }, msg(n + ' подкрепляется. Ням.')); }
      if (fx.st && nh > 0 && !Dd.st && R() < fx.ch) items.push(...applySt(Dd, fx.st));
      if (fx.foe && nh > 0) items.push(...changeStg(Dd, fx.foe, fx.v));
      if (fx.self) items.push(...changeStg(A, fx.self, fx.v));
      if (nh <= 0) items.push({ t: 'fn', f: () => fainted(oth) });
    } else {
      if (fx.heal) { const mx = G.stats(A).hp, hl = Math.floor(mx * fx.heal); A.hp = Math.min(mx, A.hp + hl); items.push({ t: 'anim', k: 'heal', side: sideK, dur: 0.5 }, { t: 'hp', side: sideK, to: A.hp }, msg(n + ' восстанавливает силы.')); }
      if (fx.self) items.push(...changeStg(A, fx.self, fx.v));
      if (fx.foe) items.push(...changeStg(Dd, fx.foe, fx.v));
      if (fx.st) { if (Dd.st) items.push(msg('Не сработало: ' + nm(Dd) + ' и так ' + D.ST[Dd.st].toLowerCase() + '.')); else items.push(...applySt(Dd, fx.st)); }
    }
    ins(...items);
  }
  function duet(pid) {
    const A = me(), P = G.S.party.find(g => g.uid === pid), Dd = foe();
    if (!P || P.hp <= 0 || A.hp <= 0 || b.over) return;
    const el = D.GIRLS[P.id].el, eff = D.eff(el, D.GIRLS[Dd.id].el), atk = (stat(A, 'atk') + G.stats(P).atk) / 2, L = Math.max(A.lvl, P.lvl);
    let dmg = Math.floor(((2 * L / 5 + 2) * 130 * atk / Math.max(1, stat(Dd, 'def'))) / 50 + 2); dmg = Math.max(1, Math.floor(dmg * eff * (0.9 + R() * 0.1)));
    const nh = Math.max(0, Dd.hp - dmg); Dd.hp = nh;
    const items = [msg(nm(A) + ' и ' + nm(P) + ': «Вместе — ради Чаровника!»'), { t: 'sfx', s: 'kiss' }, { t: 'anim', k: 'lunge', side: 'me', dur: 0.38 },
      { t: 'anim', k: 'fx', elm: D.GIRLS[A.id].el, from: 'me', to: 'foe', self: false, dur: 0.45 }, { t: 'anim', k: 'fx', elm: el, from: 'me', to: 'foe', self: false, dur: 0.45 },
      { t: 'anim', k: 'hit', side: 'foe', dur: 0.4, dmg, eff, crit: true }, { t: 'hp', side: 'foe', to: nh }, msg('Дуэт сердец! Мощный совместный удар!')];
    if (eff > 1) items.push(msg('Очень эффективно!'));
    if (nh <= 0) items.push({ t: 'fn', f: () => fainted('foe') });
    ins(...items);
  }
  function applySt(g, st) {
    g.st = st; g.stT = st === 'sleep' ? 1 + (R() * 3 | 0) : st === 'charm' ? 2 + (R() * 2 | 0) : 0;
    const t = { burn: ' обожглась! Ай-ай.', poison: ' отравлена. Фу-фу.', sleep: ' засыпает. Хррр…', freeze: ' замерзает в ледышку!', stun: ' оцепенела!', charm: ' смущена и краснеет!' }[st];
    return [msg(nm(g) + t)];
  }
  function changeStg(g, k, v) {
    const old = g.stg[k] || 0; g.stg[k] = U.clamp(old + v, -4, 4);
    if (g.stg[k] === old) return [msg(nm(g) + ': ' + D.STAT[k] + ' уже на пределе.')];
    return [msg(nm(g) + ': ' + D.STAT[k] + (v > 0 ? (v > 1 ? ' сильно растёт!' : ' растёт!') : (v < -1 ? ' сильно падает!' : ' падает!')))];
  }
  function compliment() {
    const g = foe(), d = D.GIRLS[g.id], line = U.pick(D.COMPL, R), q = R(), items = [msg('Ты: «' + line + '»'), { t: 'anim', k: 'kiss', side: 'me', dur: 0.4 }];
    if (b.trainer && R() < 0.4) items.push(msg(b.trainer.n + ': «Эй! Не флиртуй с моей девицей!»'));
    if (q < 0.5) { items.push({ t: 'expr', side: 'foe', e: 'blush', dur: 2 }, msg(nm(g) + ': «' + U.pick(d.ok, R) + '»')); if (!g.st) items.push(...applySt(g, 'charm')); else items.push(msg('Она краснеет ещё сильнее!')); }
    else if (q < 0.8) items.push({ t: 'expr', side: 'foe', e: 'smug', dur: 1.5 }, msg(nm(g) + ' ' + U.pick(D.COMPL_MEH, R)));
    else { items.push({ t: 'expr', side: 'foe', e: 'angry', dur: 1.5 }, msg(nm(g) + ': «' + U.pick(d.bad, R) + '»')); items.push(...changeStg(g, 'atk', 1)); }
    ins(...items);
  }
  function seal() {
    const S = G.S, g = foe(), d = D.GIRLS[g.id];
    if (!b.wild) { ins(msg('Чужих девиц не приручают! ' + b.trainer.n + ' возмущённо машет руками.')); return; }
    if (S.caught[g.id]) { ins(msg('У тебя уже есть ' + d.name + '. Вторая такая не уживётся — подерутся из-за тебя.')); return; }
    if (!S.bag.seal) { ins(msg('Печати кончились! Загляни в лавку.')); return; }
    S.bag.seal--;
    const mx = G.stats(g).hp, ch = Math.min(0.95, d.rate * (1.25 - 0.85 * g.hp / mx) * (g.st ? (g.st === 'charm' ? 1.7 : 1.35) : 1)), per = Math.pow(ch, 1 / 3);
    let shakes = 0; while (shakes < 3 && R() < per) shakes++;
    const items = [msg('Ты бросаешь печать-сердечко!'), { t: 'anim', k: 'throw', dur: 0.6 }];
    for (let i = 0; i < Math.min(shakes, 3); i++) items.push({ t: 'anim', k: 'shake', dur: 0.55 });
    if (shakes >= 3) {
      items.push({ t: 'anim', k: 'caught', dur: 0.7 }, msg('Есть! ' + d.name + ' приручена!'), { t: 'fn', f: () => { b.over = true; const ng = G.addGirl(g.id, g.lvl, g.hp); ng.aff = 10; S.caught[g.id] = true; UI.say([{ girl: g.id, expr: 'happy', t: d.tame }].concat(ST.caught(g.id)), () => end('caught')); } });
    } else {
      items.push({ t: 'anim', k: 'escape', dur: 0.4 }, msg(['Вырвалась! ' + d.name + ': «Ещё чего!»', 'Почти! Она выскочила, фыркнув.', d.name + ' вырывается и показывает язык.'][shakes] || 'Вырвалась!'));
    }
    ins(...items);
  }
  function useItem(id, ti) {
    const S = G.S, it = D.ITEMS[id], g = S.party[ti === undefined ? b.mi : ti]; if (!S.bag[id] || !g) return;
    S.bag[id]--;
    if (it.revive) { g.hp = Math.floor(G.stats(g).hp * it.revive); ins(msg(nm(g) + ' снова на ногах! «Я просто прилегла отдохнуть!»')); }
    else if (it.heal) { const mx = G.stats(g).hp; g.hp = Math.min(mx, g.hp + it.heal); ins({ t: 'anim', k: 'heal', side: 'me', dur: 0.5 }, { t: 'hp', side: 'me', to: me().hp }, msg(nm(g) + ' выпивает ' + it.n.toLowerCase() + '. Полегчало!')); }
  }
  function switchTo(idx) {
    const old = me(); b.mi = idx; old.stg = { atk: 0, def: 0, spd: 0 };
    ins(msg(nm(old) + ', отдохни!'), { t: 'anim', k: 'swapout', side: 'me', dur: 0.3 }, { t: 'fn', f: () => { b.A.me = side(); b.A.me.slide = -1; b.A.me.hpd = me().hp; } }, { t: 'anim', k: 'swapin', side: 'me', dur: 0.4 }, msg('Вперёд, ' + nm(me()) + '!'));
  }
  function endTurn() {
    if (b.over) return;
    const items = [];
    for (const k of ['me', 'foe']) {
      const g = k === 'me' ? me() : foe(); if (!g || g.hp <= 0) continue;
      if (g.st === 'burn' || g.st === 'poison') {
        const mx = G.stats(g).hp, dmg = Math.max(1, Math.floor(mx / (g.st === 'burn' ? 12 : 9))); g.hp = Math.max(0, g.hp - dmg);
        items.push({ t: 'anim', k: 'hit', side: k, dur: 0.3, dmg }, { t: 'hp', side: k, to: g.hp }, msg(nm(g) + (g.st === 'burn' ? ' печёт от ожога!' : ' страдает от яда!')));
        if (g.hp <= 0) items.push({ t: 'fn', f: () => fainted(k) });
      }
    }
    items.push({ t: 'fn', f: () => { if (!b.over && !b.waitSwitch) openMenu(); } });
    ins(...items);
  }
  function fainted(k) {
    if (b.over) return;
    const S = G.S;
    if (k === 'foe') {
      const g = foe(), items = [{ t: 'anim', k: 'faint', side: 'foe', dur: 0.6 }, msg(nm(g) + ' без сил!' + (b.wild ? ' Она убегает в кусты, обиженно сопя.' : ''))];
      const xp = Math.floor((15 + g.lvl * 14) * (b.wild ? 1 : 1.5));
      items.push(...giveXp(me(), xp));
      for (const o of S.party) if (o !== me() && o.hp > 0) giveXpQuiet(o, Math.floor(xp * 0.4));
      if (b.wild) { const mon = 8 + g.lvl * 4; S.money += mon; items.push(msg('Ты находишь в траве ' + mon + ' монет. Наверное, она обронила.'), { t: 'fn', f: () => { b.over = true; end('win'); } }); }
      else if (b.fi < b.foeTeam.length - 1) items.push({ t: 'fn', f: () => { b.fi++; b.foe = b.foeTeam[b.fi]; S.seen[b.foe.id] = true; b.A.foe = side(); b.A.foe.slide = 1; } }, { t: 'anim', k: 'intro', dur: 0.5 }, msg(b.trainer.n + ': «Вперёд, ' + nm(b.foe) + '!»'));
      else items.push({ t: 'fn', f: () => { b.over = true; S.money += b.trainer.prize; S.flags[b.tkey] = true; UI.say([{ who: b.trainer.n, t: b.trainer.lose }, { who: '', t: 'Ты получаешь ' + b.trainer.prize + ' монет. Все героини в отряде довольны: +5 привязанности.' }], () => { for (const o of S.party) o.aff = Math.min(100, o.aff + 5); end('win'); if (b === null) WD.trainerBeaten(BT.lastKey); }); } });
      ins(...items);
    } else {
      const g = me(); g.st = null;
      const items = [{ t: 'anim', k: 'faint', side: 'me', dur: 0.6 }, msg(nm(g) + ' без сил! «Прости… я подвела…»')];
      if (G.alive()) items.push({ t: 'fn', f: () => { b.waitSwitch = true; UI.chooseGirl('Кто выйдет вместо неё?', o => o.hp > 0, idx => { b.waitSwitch = false; b.mi = idx; b.A.me = side(); b.A.me.slide = -1; b.A.me.hpd = me().hp; ins({ t: 'anim', k: 'swapin', side: 'me', dur: 0.4 }, msg('Вперёд, ' + nm(me()) + '!'), { t: 'fn', f: openMenu }); }, true); } });
      else items.push(msg('Все героини без сил…'), { t: 'fn', f: () => { b.over = true; end('lose'); } });
      ins(...items);
    }
  }
  function giveXp(g, xp) {
    const items = [msg(nm(g) + ' получает ' + xp + ' опыта.')]; g.xp += xp;
    while (g.xp >= G.need(g.lvl) && g.lvl < 50) {
      g.xp -= G.need(g.lvl); const before = G.stats(g).hp; g.lvl++; g.hp += G.stats(g).hp - before;
      items.push({ t: 'sfx', s: 'levelup' }, msg(nm(g) + ' достигает ' + g.lvl + ' уровня!'));
      const ns = D.GIRLS[g.id].skills.find(s => s[1] === g.lvl); if (ns) items.push(msg(nm(g) + ' осваивает умение «' + D.SK[ns[0]].n + '»!'));
      if (g.lvl >= 15 && !g.bloom) { g.bloom = true; items.push({ t: 'anim', k: 'bloom', side: 'me', dur: 1 }, msg('Что это?! ' + D.GIRLS[g.id].name + ' расцветает!'), msg('Теперь она — ' + D.GIRLS[g.id].bloom + '! Все показатели выросли.')); }
    }
    return items;
  }
  function giveXpQuiet(g, xp) { g.xp += xp; while (g.xp >= G.need(g.lvl) && g.lvl < 50) { g.xp -= G.need(g.lvl); const bh = G.stats(g).hp; g.lvl++; g.hp += G.stats(g).hp - bh; if (g.lvl >= 15) g.bloom = true; } }
  function end(res) {
    const S = G.S; BT.lastKey = b.tkey;
    for (const g of S.party) { g.st = null; g.stg = null; }
    if (res === 'win' || res === 'caught') for (const g of S.party) if (g.hp > 0) g.aff = Math.min(100, g.aff + 2);
    const wasT = b.tkey, isBoss = b.trainer && b.trainer.boss;
    b = BT.b = null; UI.battleOn(false); G.mode = 'world'; if (res === 'win' || res === 'caught') U.fanfare(); U.music(FX.mapMusic());
    if (res === 'lose') {
      S.money = Math.floor(S.money / 2); G.healAll();
      UI.fade(() => { WD.enter('village', 11, 6, 'down'); UI.say([{ who: 'Тётка Дуня', t: 'Очнулся, горе-Чаровник? Девиц твоих я выходила. А половину монет взяла за пироги. Ешь давай.' }]); });
    }
    if (wasT && res === 'win') { WD.trainerBeaten(wasT); const L = ST.after(wasT); if (L.length) UI.say(L, () => G.save()); }
    G.save();
  }

  /* ---------- Цикл и отрисовка ---------- */
  BT.update = function (dt) {
    if (!b) return; b.t += dt;
    for (const k of ['me', 'foe']) { const a = b.A[k]; a.shake = Math.max(0, a.shake - dt * 3); a.flash = Math.max(0, a.flash - dt * 4); if (a.exprT > 0 && (a.exprT -= dt) <= 0) a.expr = null; }
    for (let i = b.pops.length - 1; i >= 0; i--) { const p = b.pops[i]; p.life -= dt; p.y -= dt * 40; if (p.life <= 0) b.pops.splice(i, 1); }
    b.introT += dt; if (b.shake > 0) b.shake -= dt; if (b.flashS > 0) b.flashS -= dt * 3;
    for (let i = b.parts.length - 1; i >= 0; i--) { const p = b.parts[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g || 0) * dt; p.vx *= 0.98; p.rot = (p.rot || 0) + (p.vr || 0) * dt; if (p.life <= 0) { b.parts[i] = b.parts[b.parts.length - 1]; b.parts.pop(); } }
    for (let i = b.bursts.length - 1; i >= 0; i--) { b.bursts[i].life -= dt; if (b.bursts[i].life <= 0) b.bursts.splice(i, 1); }
    if (UI.dialogOpen() || b.waitSwitch) return;
    let c = b.cur;
    if (!c) { c = b.cur = b.q.shift(); if (!c) return; c.el = 0; startItem(c); if (!b) return; }
    c.el += dt;
    if (c.t === 'msg') { if (UI.bmsgDone(c)) b.cur = null; }
    else if (c.t === 'anim') { animStep(c, dt); if (c.el >= c.dur) { animEnd(c); b.cur = null; } }
    else if (c.t === 'hp') { const a = b.A[c.side]; if (a.hpd === null) a.hpd = c.to; const d = c.to - a.hpd, sp = Math.max(8, Math.abs(d) * 3) * dt; if (Math.abs(d) <= sp) { a.hpd = c.to; b.cur = null; } else a.hpd += Math.sign(d) * sp; }
    else { b.cur = null; }
  };
  function startItem(c) {
    if (c.t === 'msg') UI.bmsg(c.s);
    else if (c.t === 'fn') c.f();
    else if (c.t === 'sfx') U.sfx(c.s);
    else if (c.t === 'expr') { const a = b.A[c.side]; a.expr = c.e; a.exprT = c.dur; }
    else if (c.t === 'anim') {
      const a = c.side ? b.A[c.side] : null;
      if (c.k === 'hit') { a.shake = 1; a.flash = 1; a.expr = 'hurt'; a.exprT = 0.8; b.shake = c.crit || c.eff > 1 ? 0.45 : 0.22; if (c.crit) b.bursts.push({ side: c.side, t: 'КРИТ!', life: 0.9, c: '#ffd43a' }); else if (c.eff > 1) b.bursts.push({ side: c.side, t: 'СУПЕР!', life: 0.9, c: '#ff8a3a' }); else if (c.eff < 1) b.bursts.push({ side: c.side, t: 'пфф…', life: 0.8, c: '#d8d0e0' }); U.sfx(c.eff > 1 ? 'super' : c.eff < 1 ? 'weak' : 'hit'); const g = c.side === 'me' ? me() : foe(); b.pops.push({ side: c.side, t: '-' + c.dmg, life: 1, y: 0, c: c.eff > 1 ? '#ff3a4a' : '#fff' }); }
      if (c.k === 'lunge') { U.sfx('swing'); a.pose = 'attack'; a.expr = 'angry'; a.exprT = 0.6; }
      if (c.k === 'cast' || c.k === 'kiss') { a.pose = c.k === 'kiss' ? null : 'cast'; U.sfx(c.k === 'kiss' ? 'kiss' : 'select'); if (c.k === 'kiss') b.pops.push({ side: 'foe', t: '♥', life: 1, y: 0, c: '#ff4f7b' }); }
      if (c.k === 'heal') { U.sfx('heal'); a.expr = 'happy'; a.exprT = 1; }
      if (c.k === 'faint') U.sfx('faint');
      if (c.k === 'throw') { U.sfx('pop'); b.heart = { k: 0, sh: 0 }; }
      if (c.k === 'fx') { U.sfx({ fire: 'swing', water: 'pop', thunder: 'super', light: 'heal', ice: 'shake' }[c.elm] || 'swing'); }
      if (c.k === 'shake') { U.sfx('shake'); }
      if (c.k === 'caught') U.sfx('caught');
      if (c.k === 'escape') { U.sfx('pop'); }
      if (c.k === 'bloom') { U.sfx('levelup'); a.expr = 'happy'; a.exprT = 1.5; }
    }
  }
  function animStep(c, dt) {
    const k = Math.min(1, c.el / c.dur), a = c.side ? b.A[c.side] : null;
    if (c.k === 'intro') { b.A.foe.slide = Math.max(0, 1 - k * 1.4); b.A.me.slide = Math.min(0, -1 + k * 1.4); }
    if (c.k === 'lunge') a.lunge = Math.sin(k * Math.PI);
    if (c.k === 'faint') { a.alpha = 1 - k; a.faint = k; }
    if (c.k === 'swapout') a.slide = -k;
    if (c.k === 'swapin') a.slide = -1 + k;
    if (c.k === 'throw') { b.heart.k = k; b.A.foe.scale = 1 - Math.max(0, k - 0.6) * 2.5; }
    if (c.k === 'shake') b.heart.sh = Math.sin(k * Math.PI * 4) * 0.4;
    if (c.k === 'escape') { b.A.foe.scale = k; b.heart = k < 0.5 ? b.heart : null; }
    if (c.k === 'fx') fxTrail(c, k);
  }
  function animEnd(c) {
    const a = c.side ? b.A[c.side] : null;
    if (c.k === 'lunge') { a.lunge = 0; a.pose = null; }
    if (c.k === 'cast' || c.k === 'kiss') a.pose = null;
    if (c.k === 'escape') { b.A.foe.scale = 1; b.heart = null; }
    if (c.k === 'caught') b.heart = null;
    if (c.k === 'fx') fxImpact(c);
  }
  let bgC = null, bgKey = '', VV = null;
  BT.render = function (x, V) {
    if (!b) return; VV = V;
    const key = b.zone + V.w + 'x' + V.h; if (key !== bgKey) { bgKey = key; bgC = ART.battleBg(b.zone, V.w, V.h); }
    const sh = b.shake > 0 ? b.shake * 26 : 0, shx = (Math.random() - 0.5) * sh, shy = (Math.random() - 0.5) * sh;
    x.setTransform(1, 0, 0, 1, shx, shy); x.drawImage(bgC, -8, -8, V.w + 16, V.h + 16);
    const s = V.h / 300, t = G.time;
    bgAnim(x, V, s, t);
    const draw = (k, g, px, py, sc, flip) => {
      const a = b.A[k]; if (!g || a.alpha <= 0) return;
      x.save(); x.translate(px + a.slide * V.w * 0.6 + (a.shake ? Math.sin(t * 60) * a.shake * 6 : 0) + a.lunge * (flip ? -1 : 1) * 40 * s, py + a.faint * 40 * s); x.scale(sc * a.scale * (flip ? -1 : 1), sc * a.scale); x.globalAlpha = a.alpha;
      const hpk = g.hp / G.stats(g).hp;
      ART.girl(x, g.id, { t: t + (k === 'me' ? 3 : 0), expr: a.expr || (g.st === 'sleep' ? 'sleepy' : g.st === 'charm' ? 'blush' : hpk < 0.3 ? 'hurt' : k === 'foe' && b.wild ? 'smug' : 'normal'), pose: a.pose || (a.flash > 0.5 ? 'hurt' : 'idle'), bloom: g.bloom, outfit: k === 'me' ? g.outfit : undefined });
      x.restore(); x.globalAlpha = 1;
    };
    draw('foe', foe(), V.w * 0.72, V.h * 0.47, s * 0.56, true);
    draw('me', me(), V.w * 0.27, V.h * 0.66, s * 0.6, false);
    // сердечко-печать
    if (b.heart) {
      const k = b.heart.k, sx = V.w * 0.3, sy = V.h * 0.5, ex = V.w * 0.72, ey = V.h * 0.38, px = sx + (ex - sx) * k, py = sy + (ey - sy) * k - Math.sin(k * Math.PI) * V.h * 0.2;
      x.save(); x.translate(px, py); x.rotate(b.heart.sh + k * 6.28 * (k < 1 ? 1 : 0)); ART.heart(x, 0, 0, 14 * s, '#ff4f7b'); x.fillStyle = '#fff'; x.beginPath(); x.ellipse(-5 * s, -5 * s, 4 * s, 2.4 * s, -0.6, 0, 6.28); x.fill(); x.restore();
    }
    drawFx(x, V, s, t);
    // всплывающие цифры
    x.font = 'italic 900 ' + Math.round(20 * s) + 'px sans-serif'; x.textAlign = 'center'; x.lineWidth = 4; x.strokeStyle = '#21121c';
    for (const p of b.pops) { const px = p.side === 'foe' ? V.w * 0.72 : V.w * 0.27, py = (p.side === 'foe' ? V.h * 0.2 : V.h * 0.32) + p.y; x.globalAlpha = Math.min(1, p.life * 2); x.strokeText(p.t, px, py); x.fillStyle = p.c; x.fillText(p.t, px, py); }
    x.globalAlpha = 1;
    for (const p of b.bursts) { const c = ctr(p.side), k = Math.min(1, (0.9 - p.life) * 8), sz = 26 * s * (k < 1 ? k * 1.25 : 1); burstStar(x, c[0] + (p.side === 'foe' ? -20 : 20) * s, c[1] - 30 * s, sz, p.t, p.c, Math.min(1, p.life * 3)); }
    x.setTransform(1, 0, 0, 1, 0, 0);
    if (b.flashS > 0) { x.fillStyle = 'rgba(255,255,240,' + b.flashS * 0.5 + ')'; x.fillRect(0, 0, V.w, V.h); }
    box(x, V, foe(), b.A.foe, V.w * 0.03, V.h * 0.04, false, s);
    box(x, V, me(), b.A.me, V.w * 0.55, V.h * 0.5, true, s);
    // шторка при начале боя
    if (b.introT < 0.75) { const k = b.introT / 0.75, n = 10; x.fillStyle = '#21121c'; for (let i = 0; i < n; i++) { const hgt = V.h / n, off = k * k * V.w * 1.1 * (i % 2 ? 1 : -1); x.fillRect(off, i * hgt, V.w, hgt + 1); } x.fillStyle = 'rgba(255,255,255,' + Math.max(0, 0.8 - k * 3) + ')'; x.fillRect(0, 0, V.w, V.h); }
  };
  /* ---------- Эффекты стихий ---------- */
  const R2 = Math.random;
  function ctr(side) { const V = VV, s = V.h / 300; return side === 'foe' ? [V.w * 0.72, V.h * 0.47 - 230 * s * 0.56 * 0.5] : [V.w * 0.27, V.h * 0.66 - 230 * s * 0.6 * 0.5]; }
  function part(o) { if (b.parts.length < 260) b.parts.push(o); }
  const PAL = { fire: ['#ff5a1a', '#ffb02e', '#fff2a0'], water: ['#3aa0ff', '#8ad8ff', '#ffffff'], nature: ['#4cb03a', '#8ad860', '#ffd04a'], wind: ['#e8fff8', '#a8f0d8', '#ffffff'], poison: ['#b85ae0', '#e08aff', '#6a2a8a'],
    dark: ['#5a2a8a', '#a86ae8', '#2a1040'], light: ['#fff2a0', '#ffd43a', '#ffffff'], thunder: ['#fff04a', '#ffffff', '#ffd43a'], ice: ['#c8f0ff', '#ffffff', '#7fd2f4'], earth: ['#a8784a', '#7a5432', '#d8c8a8'], norm: ['#ffffff', '#ffe8f0', '#ffd43a'] };
  function pos(c, k) { const A = ctr(c.from), B = ctr(c.to); if (c.self) return [A[0], A[1] - Math.sin(k * Math.PI) * 20]; return [A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k - Math.sin(k * Math.PI) * VV.h * 0.12]; }
  function fxTrail(c, k) {
    if (!VV || c.elm === 'thunder' || c.elm === 'light' || c.elm === 'earth') return;
    const p = pos(c, k), col = PAL[c.elm];
    for (let i = 0; i < 2; i++) part({ x: p[0] + (R2() - 0.5) * 10, y: p[1] + (R2() - 0.5) * 10, vx: (R2() - 0.5) * 40, vy: (R2() - 0.5) * 40 - (c.elm === 'fire' ? 30 : 0), life: 0.4 + R2() * 0.3, max: 0.7, s: 2 + R2() * 3, c: U.pick(col, R2), k: c.elm === 'nature' ? 'leaf' : c.elm === 'ice' ? 'shard' : c.elm === 'poison' ? 'bubble' : 'dot', glow: c.elm === 'fire' || c.elm === 'dark' || c.elm === 'norm', vr: (R2() - 0.5) * 8 });
  }
  function fxImpact(c) {
    if (!VV) return;
    const s = VV.h / 300, B = ctr(c.to), col = PAL[c.elm], el = c.elm, n = c.self ? 14 : 22;
    if (el === 'thunder' || el === 'light') b.flashS = 1;
    for (let i = 0; i < n; i++) {
      const a = R2() * 6.283, v = (60 + R2() * 160) * s;
      if (c.self) { part({ x: B[0] + (R2() - 0.5) * 70 * s, y: B[1] + 40 * s, vx: (R2() - 0.5) * 20, vy: -(60 + R2() * 80) * s, life: 0.8 + R2() * 0.5, max: 1.3, s: 3 + R2() * 3, c: U.pick(col, R2), k: 'spark', glow: true }); continue; }
      const kind = { nature: 'leaf', ice: 'shard', poison: 'bubble', earth: 'rock', wind: 'streak', thunder: 'spark', light: 'spark', dark: 'spark' }[el] || 'dot';
      part({ x: B[0] + (R2() - 0.5) * 16, y: B[1] + (R2() - 0.5) * 16, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (el === 'poison' ? 60 : 0) * s, g: el === 'water' || el === 'earth' || el === 'ice' ? 420 * s : el === 'fire' ? -80 * s : 0, life: 0.5 + R2() * 0.4, max: 0.9, s: (2.5 + R2() * 3.5) * s, c: U.pick(col, R2), k: kind, glow: el === 'fire' || el === 'thunder' || el === 'light' || el === 'dark' || el === 'norm', vr: (R2() - 0.5) * 10, a });
    }
  }
  function drawFx(x, V, s, t) {
    const c = b.cur;
    if (c && c.t === 'anim' && c.k === 'fx') {
      const k = Math.min(1, c.el / c.dur), p = pos(c, k), el = c.elm, col = PAL[el], B = ctr(c.to);
      x.save();
      if (el === 'thunder') { if (k > 0.3) { x.strokeStyle = '#fff8a0'; x.lineWidth = 5 * s; x.lineJoin = 'round'; x.shadowColor = '#fff04a'; x.shadowBlur = 18 * s; x.beginPath(); let px = B[0] + (R2() - 0.5) * 30, py = 0; x.moveTo(px, py); while (py < B[1]) { py += 20 * s + R2() * 24 * s; px = B[0] + (R2() - 0.5) * 50 * s * (1 - py / B[1]); x.lineTo(px, Math.min(py, B[1])); } x.stroke(); x.lineWidth = 2 * s; x.strokeStyle = '#fff'; x.stroke(); } }
      else if (el === 'light') { const a = Math.sin(Math.min(1, k * 1.4) * Math.PI); x.globalCompositeOperation = 'lighter'; x.globalAlpha = a; const g = x.createLinearGradient(B[0] - 30 * s, 0, B[0] + 30 * s, 0); g.addColorStop(0, 'rgba(255,240,160,0)'); g.addColorStop(0.5, 'rgba(255,248,200,.9)'); g.addColorStop(1, 'rgba(255,240,160,0)'); x.fillStyle = g; x.fillRect(B[0] - 34 * s, 0, 68 * s, B[1] + 60 * s); }
      else if (el === 'earth') { if (k > 0.3) { const kk = Math.min(1, (k - 0.3) / 0.4), base = B[1] + 75 * s; for (let i = 0; i < 5; i++) { const rx = B[0] + (i - 2) * 22 * s, h = (30 + (i % 2) * 24) * s * kk; x.fillStyle = '#21121c'; x.beginPath(); x.moveTo(rx - 13 * s, base); x.lineTo(rx - 4 * s, base - h - 3); x.lineTo(rx + 6 * s, base - h * 0.8 - 3); x.lineTo(rx + 13 * s, base); x.fill(); x.fillStyle = i % 2 ? '#a8784a' : '#8a6038'; x.beginPath(); x.moveTo(rx - 11 * s, base); x.lineTo(rx - 4 * s, base - h); x.lineTo(rx + 5 * s, base - h * 0.8); x.lineTo(rx + 11 * s, base); x.fill(); } } }
      else {
        const r = 12 * s; x.translate(p[0], p[1]);
        if (el === 'fire' || el === 'dark' || el === 'water' || el === 'norm' || el === 'poison') { x.globalCompositeOperation = 'lighter'; x.globalAlpha = 0.8; x.drawImage(ART.glow, -r * 3, -r * 3, r * 6, r * 6); x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1; }
        if (el === 'fire') { x.fillStyle = '#ff5a1a'; x.beginPath(); x.arc(0, 0, r, 0, 6.283); x.fill(); x.fillStyle = '#ffd04a'; x.beginPath(); x.arc(-2, -2, r * 0.6, 0, 6.283); x.fill(); }
        else if (el === 'water') { x.fillStyle = '#3aa0ff'; x.strokeStyle = '#21121c'; x.lineWidth = 2; x.beginPath(); x.arc(0, 0, r, 0, 6.283); x.fill(); x.stroke(); x.fillStyle = '#fff'; x.beginPath(); x.ellipse(-r * 0.35, -r * 0.35, r * 0.3, r * 0.18, -0.6, 0, 6.283); x.fill(); }
        else if (el === 'dark') { x.fillStyle = '#2a1040'; x.beginPath(); x.arc(0, 0, r, 0, 6.283); x.fill(); x.strokeStyle = '#a86ae8'; x.lineWidth = 2.4; x.beginPath(); x.arc(0, 0, r * 0.8, t * 6, t * 6 + 4); x.stroke(); }
        else if (el === 'poison') { for (let i = 0; i < 4; i++) { x.fillStyle = col[i % 2]; x.strokeStyle = '#21121c'; x.lineWidth = 1.6; x.beginPath(); x.arc(Math.cos(i * 1.6 + t * 5) * r * 0.6, Math.sin(i * 1.6 + t * 5) * r * 0.6, r * 0.45, 0, 6.283); x.fill(); x.stroke(); } }
        else if (el === 'nature' || el === 'ice' || el === 'wind') { x.rotate(t * 10); for (let i = 0; i < 3; i++) { x.rotate(2.094); x.save(); x.translate(r * 0.9, 0); if (el === 'nature') { x.fillStyle = '#5cc04a'; x.strokeStyle = '#21121c'; x.lineWidth = 1.6; x.beginPath(); x.ellipse(0, 0, r * 0.6, r * 0.3, 0.5, 0, 6.283); x.fill(); x.stroke(); } else if (el === 'ice') { x.fillStyle = '#c8f0ff'; x.strokeStyle = '#3a8ab8'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(-r * 0.3, -r * 0.4); x.lineTo(r * 0.9, 0); x.lineTo(-r * 0.3, r * 0.4); x.closePath(); x.fill(); x.stroke(); } else { x.strokeStyle = 'rgba(240,255,250,.9)'; x.lineWidth = 3 * s; x.beginPath(); x.arc(0, 0, r * 0.8, 0, 2.4); x.stroke(); } x.restore(); } }
        else { x.fillStyle = '#fff'; x.strokeStyle = '#21121c'; x.lineWidth = 2; star(x, 0, 0, r, 5); x.fill(); x.stroke(); }
      }
      x.restore();
    }
    // частицы
    for (const p of b.parts) {
      const a = Math.min(1, p.life / (p.max || 1) * 2);
      x.globalAlpha = a;
      if (p.glow) { x.globalCompositeOperation = 'lighter'; x.drawImage(ART.glow, p.x - p.s * 2.5, p.y - p.s * 2.5, p.s * 5, p.s * 5); x.globalCompositeOperation = 'source-over'; }
      x.fillStyle = p.c; x.strokeStyle = '#21121c'; x.lineWidth = 1.2;
      if (p.k === 'leaf') { x.save(); x.translate(p.x, p.y); x.rotate(p.rot); x.beginPath(); x.ellipse(0, 0, p.s * 1.6, p.s * 0.8, 0, 0, 6.283); x.fill(); x.stroke(); x.restore(); }
      else if (p.k === 'shard' || p.k === 'rock') { x.save(); x.translate(p.x, p.y); x.rotate(p.rot); x.beginPath(); x.moveTo(-p.s, -p.s * 0.6); x.lineTo(p.s * 1.4, 0); x.lineTo(-p.s * 0.6, p.s * 0.8); x.closePath(); x.fill(); x.stroke(); x.restore(); }
      else if (p.k === 'bubble') { x.beginPath(); x.arc(p.x, p.y, p.s, 0, 6.283); x.globalAlpha = a * 0.6; x.fill(); x.globalAlpha = a; x.stroke(); }
      else if (p.k === 'streak') { x.strokeStyle = p.c; x.lineWidth = 2.4; x.beginPath(); x.moveTo(p.x, p.y); x.lineTo(p.x - p.vx * 0.06, p.y - p.vy * 0.06); x.stroke(); }
      else if (p.k === 'spark') { star(x, p.x, p.y, p.s * 1.4, 4); x.fill(); }
      else { x.beginPath(); x.arc(p.x, p.y, p.s, 0, 6.283); x.fill(); }
    }
    x.globalAlpha = 1;
  }
  function star(x, cx, cy, r, n) { x.beginPath(); for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * 6.283 - 1.571, rr = i % 2 ? r * 0.42 : r; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.closePath(); }
  function burstStar(x, px, py, sz, t, col, al) {
    x.save(); x.globalAlpha = al; x.translate(px, py); x.rotate(-0.12);
    x.beginPath(); for (let i = 0; i < 24; i++) { const a = i / 24 * 6.283, r = (i % 2 ? 0.62 : 1) * sz * (0.9 + ((i * 37) % 7) / 25); x.lineTo(Math.cos(a) * r * 1.5, Math.sin(a) * r); } x.closePath();
    x.fillStyle = col; x.fill(); x.lineWidth = 3; x.strokeStyle = '#21121c'; x.stroke();
    x.font = 'italic 900 ' + Math.round(sz * 0.62) + 'px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 4; x.strokeText(t, 0, 1); x.fillStyle = '#e8243a'; x.fillText(t, 0, 1);
    x.restore(); x.textBaseline = 'alphabetic';
  }
  // живой фон: облака и частицы локации
  function bgAnim(x, V, s, t) {
    if (b.zone !== 'tower') { x.fillStyle = 'rgba(255,255,255,.75)'; for (let i = 0; i < 3; i++) { const cx = ((i * 0.37 + t * 0.012 * (1 + i * 0.3)) % 1.3 - 0.15) * V.w, cy = V.h * (0.08 + i * 0.07); for (let k = 0; k < 4; k++) { x.beginPath(); x.arc(cx + k * 18 * s - 26 * s, cy + (k % 2) * 5 * s, (14 + (k % 3) * 4) * s, 0, 6.283); x.fill(); } } }
    const kind = { meadow: 'petal', forest: 'leaf', mountain: 'snow', tower: 'spark' }[b.zone] || 'petal', want = kind === 'snow' ? 50 : 18;
    while (b.amb.length < want) b.amb.push({ x: Math.random() * V.w, y: Math.random() * V.h, ph: Math.random() * 6, s: 0.6 + Math.random() * 0.8 });
    const dt = G.dt || 0.016;
    for (const p of b.amb) {
      p.ph += dt; p.y += (kind === 'snow' ? 40 : kind === 'spark' ? -14 : 22) * p.s * s * dt; p.x += (Math.sin(p.ph) * 20 + (kind === 'snow' ? 0 : 16)) * s * dt;
      if (p.y > V.h + 10) p.y = -10; if (p.y < -10) p.y = V.h + 10; if (p.x > V.w + 10) p.x = -10;
      if (kind === 'petal') { x.fillStyle = '#ffb0cc'; x.beginPath(); x.ellipse(p.x, p.y, 4 * s * p.s, 2.2 * s * p.s, p.ph * 2, 0, 6.283); x.fill(); }
      else if (kind === 'leaf') { x.fillStyle = p.s > 1 ? '#e8a830' : '#6ab040'; x.beginPath(); x.ellipse(p.x, p.y, 4.4 * s * p.s, 2.2 * s * p.s, p.ph * 1.6, 0, 6.283); x.fill(); }
      else if (kind === 'snow') { x.fillStyle = 'rgba(255,255,255,.9)'; x.beginPath(); x.arc(p.x, p.y, 1.8 * s * p.s, 0, 6.283); x.fill(); }
      else { x.globalCompositeOperation = 'lighter'; x.globalAlpha = 0.5 + 0.5 * Math.sin(p.ph * 3); x.drawImage(ART.glow, p.x - 8 * s, p.y - 8 * s, 16 * s, 16 * s); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; }
    }
  }
  function box(x, V, g, a, px, py, mine, s) {
    if (!g || a.alpha <= 0) return;
    const w = V.w * 0.34, h = (mine ? 62 : 48) * s, d = D.GIRLS[g.id], mx = G.stats(g).hp, hp = a.hpd === null ? g.hp : a.hpd;
    x.save(); x.translate(px, py);
    x.fillStyle = '#21121c'; U.rr(x, 4 * s, 4 * s, w, h, 10 * s); x.fill();
    x.fillStyle = '#fff8f0'; U.rr(x, 0, 0, w, h, 10 * s); x.fill(); x.strokeStyle = '#21121c'; x.lineWidth = 3; x.stroke();
    x.fillStyle = D.EL[d.el].c; U.rr(x, 0, 0, 10 * s, h, 5 * s); x.fill();
    x.fillStyle = '#21121c'; x.textAlign = 'left'; { const nmT = g.bloom ? d.bloom : d.name, room = w - 18 * s - (G.S.caught[g.id] && !mine ? 76 : 52) * s; let fs = 14 * s; x.font = 'italic 900 ' + Math.round(fs) + 'px sans-serif'; while (fs > 8 * s && x.measureText(nmT).width > room) { fs -= 0.5 * s; x.font = 'italic 900 ' + Math.round(fs) + 'px sans-serif'; } x.fillText(nmT, 18 * s, 19 * s); }
    x.font = '800 ' + Math.round(11 * s) + 'px sans-serif'; x.fillStyle = '#7a5a6a'; x.fillText(d.kind + ' · ' + D.EL[d.el].n, 18 * s, 33 * s);
    x.textAlign = 'right'; x.fillStyle = '#21121c'; x.font = '900 ' + Math.round(13 * s) + 'px sans-serif'; x.fillText('ур. ' + g.lvl, w - 10 * s, 19 * s);
    if (G.S.caught[g.id] && !mine) { ART.heart(x, w - 62 * s, 14 * s, 5 * s, '#ff4f7b'); }
    if (g.st) { x.fillStyle = '#e8243a'; U.rr(x, w - 90 * s, 24 * s, 80 * s, 13 * s, 6 * s); x.fill(); x.fillStyle = '#fff'; x.font = '900 ' + Math.round(9 * s) + 'px sans-serif'; x.textAlign = 'center'; x.fillText(D.ST[g.st].toUpperCase(), w - 50 * s, 34 * s); }
    const bw = w - 28 * s, k = Math.max(0, hp / mx);
    x.fillStyle = '#3a2a34'; U.rr(x, 18 * s, 40 * s, bw, 8 * s, 4 * s); x.fill();
    x.fillStyle = k > 0.5 ? '#3ad06a' : k > 0.2 ? '#f0c030' : '#f04a4a'; U.rr(x, 18 * s, 40 * s, Math.max(0.1, bw * k), 8 * s, 4 * s); x.fill();
    if (mine) {
      x.fillStyle = '#21121c'; x.textAlign = 'right'; x.font = '900 ' + Math.round(11 * s) + 'px sans-serif'; x.fillText(Math.ceil(hp) + ' / ' + mx, w - 10 * s, 60 * s);
      x.fillStyle = '#d8c8e0'; x.fillRect(18 * s, 52 * s, bw * 0.5, 4 * s); x.fillStyle = '#5a8aff'; x.fillRect(18 * s, 52 * s, bw * 0.5 * Math.min(1, g.xp / G.need(g.lvl)), 4 * s);
    }
    x.restore();
  }
})();
