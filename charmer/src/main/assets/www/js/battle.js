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
    b = BT.b = { zone: o.zone, wild: !!o.wild, trainer: o.trainer ? D.TRAINERS[o.trainer] : null, tkey: o.trainer, npc: o.npc, q: [], cur: null, over: false, menu: false, t: 0, pops: [], heart: null,
      foeTeam: o.wild ? [G.mkGirl(o.wild.id, o.wild.lvl)] : D.TRAINERS[o.trainer].team.map(([id, l]) => G.mkGirl(id, l)), fi: 0, mi: S.party.findIndex(g => g.hp > 0) };
    b.foe = b.foeTeam[0];
    for (const g of b.foeTeam.concat(S.party)) { g.stg = { atk: 0, def: 0, spd: 0 }; g.st = null; g.stT = 0; }
    b.A = { me: side(), foe: side() }; b.A.me.slide = -1; b.A.foe.slide = 1;
    S.seen[b.foe.id] = true;
    G.mode = 'battle'; UI.battleOn(true); U.music('battle'); U.sfx('encounter');
    const fg = D.GIRLS[b.foe.id];
    push({ t: 'anim', k: 'intro', dur: 0.7 });
    if (b.wild) push(msg('Из травы выскакивает ' + (fg.kind === 'Неко' || fg.kind === 'Кицунэ' ? '' : '') + 'дикая ' + fg.kind.toLowerCase() + ' ' + fg.name + '!'));
    else { push(msg(b.trainer.n + ' вызывает тебя на бой!')); push(msg(b.trainer.n + ': «Вперёд, ' + nm(b.foe) + '!»')); }
    push(msg('Вперёд, ' + nm(me()) + '!'), { t: 'fn', f: () => { b.A.me.hpd = me().hp; } }, { t: 'fn', f: openMenu });
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
    items.push(msg((sideK === 'foe' && b.wild ? 'Дикая ' : '') + n + ': «' + sk.n + '!»'), { t: 'anim', k: sk.pw ? 'lunge' : 'cast', side: sideK, dur: 0.38 });
    if (R() > sk.acc) { items.push(msg('Мимо! ' + nm(Dd) + ' грациозно уворачивается.')); ins(...items); return; }
    const fx = sk.fx || {};
    if (sk.pw) {
      const L = A.lvl, eff = D.eff(sk.el, D.GIRLS[Dd.id].el), stab = sk.el === D.GIRLS[A.id].el ? 1.25 : 1, crit = R() < 0.07 ? 1.5 : 1;
      let dmg = Math.floor(((2 * L / 5 + 2) * sk.pw * stat(A, 'atk') / Math.max(1, stat(Dd, 'def'))) / 50 + 2);
      dmg = Math.max(1, Math.floor(dmg * eff * stab * crit * (0.85 + R() * 0.15)));
      const nh = Math.max(0, Dd.hp - dmg); Dd.hp = nh;
      items.push({ t: 'anim', k: 'hit', side: oth, dur: 0.4, dmg, eff }, { t: 'hp', side: oth, to: nh });
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
      items.push({ t: 'anim', k: 'caught', dur: 0.7 }, msg('Есть! ' + d.name + ' приручена!'), { t: 'fn', f: () => { b.over = true; const ng = G.addGirl(g.id, g.lvl, g.hp); ng.aff = 10; S.caught[g.id] = true; UI.say([{ girl: g.id, expr: 'happy', t: d.tame }], () => end('caught')); } });
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
    b = BT.b = null; UI.battleOn(false); G.mode = 'world'; U.music(WD.m.id === 'village' ? 'tavern' : 'world');
    if (res === 'lose') {
      S.money = Math.floor(S.money / 2); G.healAll();
      UI.fade(() => { WD.enter('village', 11, 6, 'down'); UI.say([{ who: 'Тётка Дуня', t: 'Очнулся, горе-Чаровник? Девиц твоих я выходила. А половину монет взяла за пироги. Ешь давай.' }]); });
    }
    if (wasT && res === 'win') { WD.trainerBeaten(wasT); if (isBoss) UI.say([{ girl: 'witch', expr: 'blush', t: D.TRAINERS.boss.after }, { who: '', t: '★ Глава 1 пройдена! Дурман развеян. Теперь собери всех десятерых героинь — твой «Девичник» ждёт.' }]); }
    G.save();
  }

  /* ---------- Цикл и отрисовка ---------- */
  BT.update = function (dt) {
    if (!b) return; b.t += dt;
    for (const k of ['me', 'foe']) { const a = b.A[k]; a.shake = Math.max(0, a.shake - dt * 3); a.flash = Math.max(0, a.flash - dt * 4); if (a.exprT > 0 && (a.exprT -= dt) <= 0) a.expr = null; }
    for (let i = b.pops.length - 1; i >= 0; i--) { const p = b.pops[i]; p.life -= dt; p.y -= dt * 40; if (p.life <= 0) b.pops.splice(i, 1); }
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
      if (c.k === 'hit') { a.shake = 1; a.flash = 1; a.expr = 'hurt'; a.exprT = 0.8; U.sfx(c.eff > 1 ? 'super' : c.eff < 1 ? 'weak' : 'hit'); const g = c.side === 'me' ? me() : foe(); b.pops.push({ side: c.side, t: '-' + c.dmg, life: 1, y: 0, c: c.eff > 1 ? '#ff3a4a' : '#fff' }); }
      if (c.k === 'lunge') { U.sfx('swing'); a.pose = 'attack'; a.expr = 'angry'; a.exprT = 0.6; }
      if (c.k === 'cast' || c.k === 'kiss') { a.pose = c.k === 'kiss' ? null : 'cast'; U.sfx(c.k === 'kiss' ? 'kiss' : 'select'); if (c.k === 'kiss') b.pops.push({ side: 'foe', t: '♥', life: 1, y: 0, c: '#ff4f7b' }); }
      if (c.k === 'heal') { U.sfx('heal'); a.expr = 'happy'; a.exprT = 1; }
      if (c.k === 'faint') U.sfx('faint');
      if (c.k === 'throw') { U.sfx('pop'); b.heart = { k: 0, sh: 0 }; }
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
  }
  function animEnd(c) {
    const a = c.side ? b.A[c.side] : null;
    if (c.k === 'lunge') { a.lunge = 0; a.pose = null; }
    if (c.k === 'cast' || c.k === 'kiss') a.pose = null;
    if (c.k === 'escape') { b.A.foe.scale = 1; b.heart = null; }
    if (c.k === 'caught') b.heart = null;
  }
  let bgC = null, bgKey = '';
  BT.render = function (x, V) {
    if (!b) return;
    const key = b.zone + V.w + 'x' + V.h; if (key !== bgKey) { bgKey = key; bgC = ART.battleBg(b.zone, V.w, V.h); }
    x.setTransform(1, 0, 0, 1, 0, 0); x.drawImage(bgC, 0, 0);
    const s = V.h / 300, t = G.time;
    const draw = (k, g, px, py, sc, flip) => {
      const a = b.A[k]; if (!g || a.alpha <= 0) return;
      x.save(); x.translate(px + a.slide * V.w * 0.6 + (a.shake ? Math.sin(t * 60) * a.shake * 6 : 0) + a.lunge * (flip ? -1 : 1) * 40 * s, py + a.faint * 40 * s); x.scale(sc * a.scale * (flip ? -1 : 1), sc * a.scale); x.globalAlpha = a.alpha;
      const hpk = g.hp / G.stats(g).hp;
      ART.girl(x, g.id, { t: t + (k === 'me' ? 3 : 0), expr: a.expr || (g.st === 'sleep' ? 'sleepy' : g.st === 'charm' ? 'blush' : hpk < 0.3 ? 'hurt' : k === 'foe' && b.wild ? 'smug' : 'normal'), pose: a.pose || (a.flash > 0.5 ? 'hurt' : 'idle'), bloom: g.bloom });
      x.restore(); x.globalAlpha = 1;
    };
    draw('foe', foe(), V.w * 0.72, V.h * 0.47, s * 0.56, true);
    draw('me', me(), V.w * 0.27, V.h * 0.66, s * 0.6, false);
    // сердечко-печать
    if (b.heart) {
      const k = b.heart.k, sx = V.w * 0.3, sy = V.h * 0.5, ex = V.w * 0.72, ey = V.h * 0.38, px = sx + (ex - sx) * k, py = sy + (ey - sy) * k - Math.sin(k * Math.PI) * V.h * 0.2;
      x.save(); x.translate(px, py); x.rotate(b.heart.sh + k * 6.28 * (k < 1 ? 1 : 0)); ART.heart(x, 0, 0, 14 * s, '#ff4f7b'); x.fillStyle = '#fff'; x.beginPath(); x.ellipse(-5 * s, -5 * s, 4 * s, 2.4 * s, -0.6, 0, 6.28); x.fill(); x.restore();
    }
    // всплывающие цифры
    x.font = 'italic 900 ' + Math.round(20 * s) + 'px sans-serif'; x.textAlign = 'center'; x.lineWidth = 4; x.strokeStyle = '#21121c';
    for (const p of b.pops) { const px = p.side === 'foe' ? V.w * 0.72 : V.w * 0.27, py = (p.side === 'foe' ? V.h * 0.2 : V.h * 0.32) + p.y; x.globalAlpha = Math.min(1, p.life * 2); x.strokeText(p.t, px, py); x.fillStyle = p.c; x.fillText(p.t, px, py); }
    x.globalAlpha = 1;
    box(x, V, foe(), b.A.foe, V.w * 0.03, V.h * 0.04, false, s);
    box(x, V, me(), b.A.me, V.w * 0.55, V.h * 0.5, true, s);
  };
  function box(x, V, g, a, px, py, mine, s) {
    if (!g || a.alpha <= 0) return;
    const w = V.w * 0.34, h = (mine ? 62 : 48) * s, d = D.GIRLS[g.id], mx = G.stats(g).hp, hp = a.hpd === null ? g.hp : a.hpd;
    x.save(); x.translate(px, py);
    x.fillStyle = '#21121c'; U.rr(x, 4 * s, 4 * s, w, h, 10 * s); x.fill();
    x.fillStyle = '#fff8f0'; U.rr(x, 0, 0, w, h, 10 * s); x.fill(); x.strokeStyle = '#21121c'; x.lineWidth = 3; x.stroke();
    x.fillStyle = D.EL[d.el].c; U.rr(x, 0, 0, 10 * s, h, 5 * s); x.fill();
    x.fillStyle = '#21121c'; x.textAlign = 'left'; x.font = 'italic 900 ' + Math.round(14 * s) + 'px sans-serif'; x.fillText(g.bloom ? d.bloom : d.name, 18 * s, 19 * s);
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
