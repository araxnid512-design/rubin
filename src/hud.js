'use strict';
// ---------- Интерфейс боя и управление касаниями ----------

const ZSTATE = { idle: 'стоит', wander: 'бродит', investigate: 'идёт на шум', chase: 'видит вас', guard: 'на посту' };
function canOverwatch(u) { return (u.ranged && u.ammo > 0 && u.ap >= WEAP[u.ranged].ap) || u.ap >= WEAP[u.melee].ap; }
function unitSub(u) { return `${u.hp}/${u.maxhp} здоровья · ${u.ap} ОД`; }

const HUD = {
  built: false,
  build() {
    const root = $('#scr-tac');
    root.innerHTML = `
      <div class="hud">
        <header class="hud-top">
          <button class="hbtn" id="tMenu" aria-label="Меню вылазки">${icon('menu')}</button>
          <div class="chip" id="tTurn"></div>
          <div class="chip" id="tTod"></div>
          <div class="chip threat" id="tThreat"></div>
          <div class="grow"></div>
          <button class="hbtn" id="tZoomOut" aria-label="Отдалить">${icon('zout')}</button>
          <button class="hbtn" id="tZoomIn" aria-label="Приблизить">${icon('zin')}</button>
          <button class="hbtn" id="tRot" aria-label="Повернуть камеру">${icon('rotate')}</button>
          <button class="hbtn" id="tMap" aria-label="Карта местности">${icon('map')}</button>
        </header>
        <aside class="squad" id="tSquad"></aside>
        <div class="mid"><div class="banner" id="tBanner" hidden></div></div>
        <aside class="acts">
          <button class="act" id="aNext">${icon('next')}<span>Следующий</span></button>
          <button class="act" id="aOw">${icon('eye')}<span>Засада</span></button>
          <button class="act" id="aBand">${icon('bandage')}<span>Перевязка</span></button>
          <button class="act" id="aLure">${icon('lure')}<span>Приманка</span></button>
          <button class="act" id="aEvac">${icon('exit')}<span>В машину</span></button>
          <button class="act end" id="aEnd"><span>Конец<br>хода</span></button>
        </aside>
        <div class="log" id="tLog" aria-live="polite"></div>
      </div>
      <div class="pop" id="tPop" hidden></div>
      <div class="sheet-bg" id="tLootBg" hidden><div class="sheet" id="tLoot" role="dialog" aria-label="Добыча"></div></div>
      <div class="sheet-bg" id="tMapBg" hidden>
        <div class="mapbox"><canvas id="tMini" aria-label="Карта местности, нажмите, чтобы перейти"></canvas>
          <div class="mapcap"><span>Нажмите на карту, чтобы перейти</span><button class="btn" id="tMapClose">Закрыть</button></div>
        </div>
      </div>`;
    $('#tMenu').onclick = () => { Sfx.play('click'); this.openMenu(); };
    $('#tMap').onclick = () => { Sfx.play('click'); this.openMap(); };
    const zoom = f => { const a = $('#app'); R.zoomAt(a.clientWidth / 2, a.clientHeight / 2, f); this.hidePop(); };
    $('#tZoomIn').onclick = () => zoom(1.25);
    $('#tZoomOut').onclick = () => zoom(0.8);
    $('#tRot').onclick = () => { Sfx.play('click'); R.rotate(1); this.hidePop(); TAC.pend = null; };
    $('#tMapClose').onclick = () => this.closeMap();
    $('#tMapBg').addEventListener('click', e => { if (e.target.id === 'tMapBg') this.closeMap(); });
    $('#tMini').addEventListener('click', e => this.mapClick(e));
    $('#tLootBg').addEventListener('click', e => { if (e.target.id === 'tLootBg') this.closeLoot(); });
    $('#aNext').onclick = () => { Sfx.play('click'); nextUnit(); };
    $('#aOw').onclick = () => { const u = curUnit(); if (u) doOverwatch(u); };
    $('#aBand').onclick = () => { const u = curUnit(); if (u) doBandage(u, u); };
    $('#aLure').onclick = () => {
      const u = curUnit();
      if (!u || !canAct()) return;
      Sfx.play('click');
      TAC.mode = TAC.mode === 'lure' ? null : 'lure'; TAC.pend = null; this.hidePop();
      if (TAC.mode) this.log('Нажмите на клетку в пределах 8 клеток, куда бросить бутылку.');
      R.dirty = true; this.refresh();
    };
    $('#aEvac').onclick = () => { const u = curUnit(); if (u) doEvac(u); };
    $('#aEnd').onclick = () => {
      Sfx.play('click');
      const m = TAC.m;
      if (!m || !canAct()) return;
      const left = liveUnits(m).filter(u => u.ap >= 3);
      if (CFG.confirmEnd && left.length && !this.endArmed) {
        this.endArmed = true;
        const b = $('#aEnd');
        b.classList.add('armed');
        b.innerHTML = `<span>Точно?<br>${left.length} с ОД</span>`;
        this.log(`Ещё есть очки действий: ${left.map(u => u.name).join(', ')}. Нажмите ещё раз, чтобы закончить ход.`, 'warn');
        clearTimeout(this.endT);
        this.endT = setTimeout(() => this.disarmEnd(), 2800);
        return;
      }
      this.disarmEnd();
      endTurn();
    };
    $('#tSquad').addEventListener('click', e => {
      const b = e.target.closest('.uc');
      if (!b || !TAC.m) return;
      const u = TAC.m.units.find(o => o.id === +b.dataset.id);
      if (u && !u.dead && !u.evac) { Sfx.play('click'); selectUnit(u); }
    });
    $('#tPop').addEventListener('click', e => {
      const b = e.target.closest('button[data-k]');
      if (!b || b.disabled) return;
      const it = this.popItems[+b.dataset.k];
      Sfx.play('click');
      this.hidePop();
      TAC.pend = null;
      if (it && it.fn) it.fn();
    });
    Input.attach($('#cv'));
    this.built = true;
  },
  refresh() {
    const m = TAC.m;
    if (!m || !this.built) return;
    const u = curUnit(), tod = timeOfDay(m), player = m.phase === 'player' && !TAC.busy;
    $('#tTurn').innerHTML = `Ход <b>${m.turn}</b>`;
    $('#tTod').innerHTML = `${icon(['sun', 'dusk', 'moon'][tod])}<span>${TOD_NAME[tod]}</span>`;
    $('#tTod').className = 'chip tod' + tod;
    const left = Math.max(1, WAVE_EVERY - (m.turn - m.lastWave));
    let pips = '';
    if (m.siege) {
      const sg = m.siege;
      for (let k = 0; k < sg.waves; k++) pips += `<i class="${k < sg.spawned ? 'on' : ''}"></i>`;
      const nx = sg.spawned < sg.waves ? sg.next + 3 - m.turn : 0;
      $('#tThreat').innerHTML = `<span class="lbl">Волны</span><span class="pips">${pips}</span><span class="wv">${icon('skull')}${m.zombies.length}</span>`;
      $('#tThreat').title = nx > 0 ? `Следующая волна через ${nx} ${plural(nx, 'ход', 'хода', 'ходов')}` : 'Это последняя волна: перебейте всех';
    } else {
      for (let k = 0; k < 5; k++) pips += `<i class="${k < m.threat ? 'on' : ''}"></i>`;
      $('#tThreat').innerHTML = `<span class="lbl">Угроза</span><span class="pips">${pips}</span><span class="wv">${icon('wave')}${left}</span>`;
      $('#tThreat').title = `Новая волна примерно через ${left} ${plural(left, 'ход', 'хода', 'ходов')} или раньше, если шуметь`;
    }
    $('#tSquad').innerHTML = m.units.map(o => {
      const st = o.dead ? 'dead' : o.evac ? 'evac' : '';
      const hp = Math.max(0, (o.hp / o.maxhp) * 100);
      const body = o.dead ? `<span>${icon('skull')}${gv(o, 'погиб', 'погибла')}</span>` : o.evac ? `<span>${icon('exit')}в машине</span>` :
        `<span title="Очки действий">${icon('ap')}${o.ap}</span>${o.ranged ? `<span title="Патроны">${icon('ammo')}${o.ammo}</span>` : ''}<span title="Груз">${carried(o)}/${o.cap}</span>`;
      return `<button class="uc ${o.id === TAC.sel ? 'sel' : ''} ${st}" data-id="${o.id}" style="--uc:${o.color}">
        <span class="uc-n"><b>${esc(o.name)}</b>${o.bitten ? '<i class="tag tox">укус</i>' : ''}${o.ow ? '<i class="tag amb">засада</i>' : ''}</span>
        <span class="bar"><i style="width:${hp}%"></i></span>
        <span class="uc-s">${body}</span>
      </button>`;
    }).join('');
    const set = (id, ok, extra) => { const b = $('#' + id); b.disabled = !ok; if (extra != null) b.classList.toggle('on', !!extra); };
    set('aNext', player && liveUnits(m).length > 0);
    set('aOw', player && u && canOverwatch(u));
    set('aBand', player && u && u.bandages > 0 && u.ap >= 2 && u.hp < u.maxhp);
    $('#aBand span').textContent = u ? `Перевязка ${u.bandages}` : 'Перевязка';
    set('aLure', player && u && u.lures > 0 && u.ap >= 2, TAC.mode === 'lure');
    $('#aLure span').textContent = u ? `Приманка ${u.lures}` : 'Приманка';
    set('aEvac', player && u && inEvac(m, u) && u.ap >= 1);
    $('#aEvac').hidden = !!m.siege;
    set('aEnd', player);
    $('#aEnd').classList.toggle('ready', player && liveUnits(m).every(o => o.ap < 2));
  },
  log(text, cls = '') {
    const box = $('#tLog');
    if (!box) return;
    const e = el(`<div class="ln ${cls}">${esc(text)}</div>`);
    box.appendChild(e);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => e.classList.add('old'), 6500);
    setTimeout(() => e.remove(), 8000);
  },
  endArmed: false, endT: 0,
  disarmEnd() {
    clearTimeout(this.endT);
    this.endArmed = false;
    const b = $('#aEnd');
    if (b) { b.classList.remove('armed'); b.innerHTML = '<span>Конец<br>хода</span>'; }
  },
  clearLog() { const box = $('#tLog'); if (box) box.innerHTML = ''; },
  banner(text) {
    const b = $('#tBanner');
    if (!b) return;
    b.hidden = !text;
    if (text) b.textContent = text;
  },
  flash() {
    const r = $('#scr-tac');
    r.classList.remove('flash'); void r.offsetWidth; r.classList.add('flash');
  },
  popItems: [],
  hidePop() { const p = $('#tPop'); if (p) p.hidden = true; },
  showPop(ax, ay, title, sub, items) {
    this.popItems = items;
    const p = $('#tPop');
    p.innerHTML = `<div class="pop-h"><b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</div>` +
      items.map((it, k) => `<button data-k="${k}" ${it.ok === false ? 'disabled' : ''}>${icon(it.ic)}<span class="pl">${esc(it.label)}${it.note ? `<small>${esc(it.note)}</small>` : ''}</span>${it.cost != null ? `<em>${it.cost}${typeof it.cost === 'number' ? ' ОД' : ''}</em>` : ''}</button>`).join('');
    p.hidden = false;
    const W = $('#app').clientWidth, H = $('#app').clientHeight, pw = p.offsetWidth, ph = p.offsetHeight;
    let x = ax + 18, y = ay - ph / 2;
    if (x + pw > W - 8) x = ax - pw - 18;
    x = clamp(x, 8, W - pw - 8); y = clamp(y, 8, H - ph - 8);
    p.style.left = x + 'px'; p.style.top = y + 'px';
  },
  tap(ax, ay) {
    if (R.mode === 'base') { Base.tapMap(ax, ay); return; }
    const m = TAC.m;
    if (!m || !canAct()) return;
    let t = R.toTile(ax, ay);
    const u = curUnit();
    if (!u) return;
    if (TAC.mode !== 'lure' && inb(m, t.x, t.y) && !unitAt(m, t.x, t.y) && !(zombieAt(m, t.x, t.y) && m.vis[MI(m, t.x, t.y)])) {
      const hz = R.pick(ax, ay, true);
      if (hz) t = { x: hz.x, y: hz.y };
    }
    if (!inb(m, t.x, t.y)) { this.hidePop(); TAC.pend = null; R.dirty = true; return; }
    const i = MI(m, t.x, t.y), pd = TAC.pend;
    if (pd && pd.i === i && pd.fn) { const fn = pd.fn; TAC.pend = null; this.hidePop(); fn(); return; }
    TAC.pend = null; this.hidePop(); R.dirty = true;
    if (!m.seen[i]) return;
    const ou = unitAt(m, t.x, t.y), z = zombieAt(m, t.x, t.y), zv = z && zVisible(m, z) ? z : null;
    const tile = m.tiles[i], rf = TAC.reach;

    if (TAC.mode === 'lure') {
      if (edist(u.x, u.y, t.x, t.y) <= LURE_RANGE && !TP[tile].block) { TAC.mode = null; doLure(u, t.x, t.y); }
      else this.log('Слишком далеко: бутылку можно бросить на 8 клеток.', 'warn');
      return;
    }
    if (ou) {
      if (ou !== u) {
        if (u.trait === 'medic' && cheb(u.x, u.y, ou.x, ou.y) === 1 && u.bandages > 0 && ou.hp < ou.maxhp) {
          this.showPop(ax, ay, ou.name, unitSub(ou), [
            { ic: 'bandage', label: 'Перевязать', cost: 2, ok: u.ap >= 2, fn: () => doBandage(u, ou) },
            { ic: 'next', label: 'Выбрать бойца', fn: () => selectUnit(ou) },
          ]);
          return;
        }
        Sfx.play('click');
        selectUnit(ou);
        return;
      }
      const items = [
        { ic: 'bandage', label: `Перевязка (осталось ${u.bandages})`, cost: 2, ok: u.bandages > 0 && u.ap >= 2 && u.hp < u.maxhp, fn: () => doBandage(u, u) },
        { ic: 'eye', label: 'Засада до хода зомби', cost: 'все ОД', ok: canOverwatch(u), fn: () => doOverwatch(u), note: u.ranged && u.ammo ? 'выстрел по первому, кто появится' : 'удар по первому, кто подойдёт' },
      ];
      if (inEvac(m, u)) items.push({ ic: 'exit', label: 'Сесть в машину', cost: 1, ok: u.ap >= 1, fn: () => doEvac(u) });
      this.showPop(ax, ay, u.name, `${TRAITS[u.trait].name} · ${unitSub(u)}`, items);
      return;
    }
    if (zv) {
      const w = WEAP[u.melee], adj = adjOK(m, u.x, u.y, zv.x, zv.y), sneak = isUnaware(zv), hum = isHuman(zv);
      const items = [{
        ic: 'melee', cost: w.ap, ok: adj && u.ap >= w.ap, fn: () => doMelee(u, zv),
        label: !adj ? `${w.name}: нужно подойти вплотную` : sneak && w.assassin ? `${w.name}: тихое убийство` : sneak ? `${w.name}: удар со спины ×2` : `${w.name}: удар 85%`,
      }];
      if (u.ranged) {
        const rw = WEAP[u.ranged], can = canShoot(m, u, zv);
        items.push({
          ic: 'target', cost: rw.ap, ok: can && u.ap >= rw.ap, fn: () => doShoot(u, zv),
          label: can ? `${rw.name}: ${Math.round(shotChance(m, u, zv) * 100)}%` : `${rw.name}: ${u.ammo ? 'не достать' : 'нет патронов'}`,
          note: silenced(u) ? 'с глушителем, почти тихо' : `громко: слышно за ${rw.noise} клеток`,
        });
      }
      const zt = ZT[zv.type], cov = hum && u.ranged ? coverOf(m, u.x, u.y, zv) : 0;
      if (cov && items[1]) items[1].note = `за укрытием: −${Math.round(cov * 100)}% к попаданию`;
      TAC.pend = { tx: zv.x, ty: zv.y, col: '#ff6a50' };
      const title = hum ? `${zt.name} · ${FACTIONS[zt.fac].name}` : zv.rf ? (zv.rf.n ? `${zv.rf.n}, мертвец` : 'Восставший') : zt.name;
      const mhp = zv.rf ? ZT.walker.hp : zt.hp;
      this.showPop(ax, ay, title, `${Math.max(0, zv.hp)}/${mhp} здоровья · ${hum && zv.state === 'chase' ? 'в бою' : ZSTATE[zv.state]}${hum && zt.ranged ? ` · патронов ${zv.ammo}` : ''}`, items);
      return;
    }
    // пленный у столба
    const cap = captiveAt(m, t.x, t.y);
    if (cap) {
      const adj = cheb(u.x, u.y, t.x, t.y) <= 1, items = [];
      if (adj) items.push({ ic: 'exit', label: 'Освободить', cost: 2, ok: u.ap >= 2, fn: () => doFree(u, cap), note: 'пойдёт с вами, оружия нет' });
      else {
        let best = -1, bd = 1e9;
        if (rf) for (const [dx, dy] of DIR8) { const nx = t.x + dx, ny = t.y + dy; if (!inb(m, nx, ny)) continue; const j = MI(m, nx, ny); if (rf.dist[j] > 0 && rf.dist[j] < bd) { bd = rf.dist[j]; best = j; } }
        if (best >= 0) { const go = () => doMove(u, best); TAC.pend = { i, path: pathTo(m, rf, best), fn: go }; items.push({ ic: 'walk', label: 'Подойти', cost: bd, fn: go }); }
      }
      this.showPop(ax, ay, `Пленный: ${cap.name}`, adj ? 'связан и избит, но живой' : 'нужно подойти вплотную', items);
      return;
    }
    // тело, которое скоро встанет
    const dc = m.decals.find(d => d.rise && d.x === t.x && d.y === t.y);
    if (dc && cheb(u.x, u.y, t.x, t.y) <= 1) {
      const ct0 = m.cont[i], left = dc.rise - m.turn;
      const items = [{ ic: 'melee', label: 'Добить, чтобы не встал', cost: 1, ok: u.ap >= 1, fn: () => doFinish(u, dc), note: 'удар в голову, почти тихо' }];
      if (ct0 && Object.keys(ct0.loot).length) items.push({ ic: 'search', label: 'Обыскать тело', cost: 0, fn: () => doSearch(u, i) });
      const nm = dc.k === 'ucorpse' ? dc.u.name : ZT[dc.zt].name;
      this.showPop(ax, ay, nm, left <= 1 ? 'встанет на следующем ходу' : `встанет через ${left} ${plural(left, 'ход', 'хода', 'ходов')}`, items);
      return;
    }
    const ct = m.cont[i];
    if (ct) {
      const name = CONT[ct.k].name;
      if (cheb(u.x, u.y, t.x, t.y) <= 1) {
        if (ct.s) { doSearch(u, i); return; }
        TAC.pend = { i, fn: () => doSearch(u, i), tx: t.x, ty: t.y, col: '#e8a62b' };
        this.showPop(ax, ay, name, 'ещё не обыскано', [{ ic: 'search', label: 'Обыскать', cost: 2, ok: u.ap >= 2, fn: () => doSearch(u, i) }]);
        return;
      }
      let best = -1, bd = 1e9;
      if (rf) for (const [dx, dy] of DIR8) {
        const nx = t.x + dx, ny = t.y + dy;
        if (!inb(m, nx, ny)) continue;
        const j = MI(m, nx, ny);
        if (rf.dist[j] > 0 && rf.dist[j] < bd) { bd = rf.dist[j]; best = j; }
      }
      if (best >= 0) {
        const go = () => doMove(u, best);
        TAC.pend = { i, path: pathTo(m, rf, best), fn: go };
        this.showPop(ax, ay, name, ct.s ? 'обыскано' : 'ещё не обыскано', [{ ic: 'walk', label: 'Подойти', cost: bd, fn: go }]);
      } else this.showPop(ax, ay, name, 'слишком далеко на этот ход', []);
      return;
    }
    if ((tile === T.DOOR || tile === T.DOOR_OPEN) && cheb(u.x, u.y, t.x, t.y) === 1) {
      const items = [{ ic: 'door', label: tile === T.DOOR ? 'Открыть' : 'Закрыть', cost: 1, ok: u.ap >= 1, fn: () => doDoor(u, i) }];
      if (rf && rf.dist[i] > 0) items.push({ ic: 'walk', label: 'Пройти', cost: rf.dist[i], fn: () => doMove(u, i) });
      if (tile === T.DOOR_OPEN) items[0].note = 'закрытая дверь задержит зомби';
      this.showPop(ax, ay, 'Дверь', tile === T.DOOR ? 'закрыта' : 'открыта', items);
      return;
    }
    if (rf && rf.dist[i] > 0) {
      const cost = rf.dist[i], go = () => doMove(u, i);
      if (!CFG.confirmMove) { go(); return; }
      TAC.pend = { i, path: pathTo(m, rf, i), fn: go };
      const items = [{ ic: 'walk', label: 'Идти сюда', cost, fn: go, note: 'или нажмите на клетку ещё раз' }];
      if (u.lures > 0 && edist(u.x, u.y, t.x, t.y) <= LURE_RANGE) items.push({ ic: 'lure', label: 'Бросить приманку сюда', cost: 2, ok: u.ap >= 2, fn: () => doLure(u, t.x, t.y) });
      this.showPop(ax, ay, TP[tile].name || 'Клетка', `после хода останется ${u.ap - cost} ОД`, items);
      return;
    }
    if (TP[tile].walk) {
      const items = [];
      if (u.lures > 0 && edist(u.x, u.y, t.x, t.y) <= LURE_RANGE) items.push({ ic: 'lure', label: 'Бросить приманку сюда', cost: 2, ok: u.ap >= 2, fn: () => doLure(u, t.x, t.y) });
      this.showPop(ax, ay, TP[tile].name || 'Клетка', u.ap ? 'не хватает очков действий' : 'у бойца закончились ОД', items);
    }
  },
  lootCtx: null,
  openLoot(u, i) {
    this.lootCtx = { u, i };
    this.renderLoot();
    $('#tLootBg').hidden = false;
    HUD.refresh();
  },
  renderLoot() {
    const { u, i } = this.lootCtx, c = TAC.m.cont[i];
    const keys = RES_ORDER.filter(k => c.loot[k]);
    const rows = keys.map(k => {
      const n = c.loot[k], toGun = k === 'ammo' && u.ranged;
      return `<div class="lr">${icon(k)}<span class="ln-n">${RES[k].name}${toGun ? '<small>сразу в оружие</small>' : ''}</span><b>×${n}</b><em>${toGun ? '' : (RES[k].w * n).toFixed(1) + ' кг'}</em><button class="btn sm" data-k="${k}">Взять</button></div>`;
    }).join('');
    $('#tLoot').innerHTML = `
      <div class="sh-h"><div><b>${esc(CONT[c.k].name)}</b><span>${esc(u.name)} несёт ${carried(u)} из ${u.cap} кг</span></div>
        <button class="hbtn" id="lClose" aria-label="Закрыть">${icon('close')}</button></div>
      <div class="sh-b">${rows || '<p class="empty">Пусто. Кто-то был здесь раньше.</p>'}</div>
      <div class="sh-f"><button class="btn" id="lDone">Закрыть</button>${keys.length ? '<button class="btn primary" id="lAll">Взять всё</button>' : ''}</div>`;
    $('#lClose').onclick = () => this.closeLoot();
    $('#lDone').onclick = () => this.closeLoot();
    if ($('#lAll')) $('#lAll').onclick = () => { this.take(null); };
    $$('#tLoot .lr button').forEach(b => { b.onclick = () => this.take(b.dataset.k); });
  },
  take(k) {
    const { u, i } = this.lootCtx, c = TAC.m.cont[i];
    const keys = k ? [k] : RES_ORDER.filter(x => c.loot[x]);
    let any = false, full = false;
    for (const key of keys) { const got = takeLoot(u, c, key, c.loot[key]); if (got) any = true; if (c.loot[key]) full = true; }
    if (any) Sfx.play('pickup');
    if (full) this.log(`${u.name}: больше не унести. Вес — ${carried(u)} из ${u.cap} кг.`, 'warn');
    this.renderLoot();
    this.refresh();
    R.dirty = true;
    if (!k && !Object.keys(c.loot).length) this.closeLoot();
  },
  closeLoot() { $('#tLootBg').hidden = true; this.lootCtx = null; R.dirty = true; },
  miniInfo: null,
  openMap() {
    const m = TAC.m;
    if (!m) return;
    const bg = $('#tMapBg'), cv = $('#tMini');
    bg.hidden = false;
    const W = $('#app').clientWidth, H = $('#app').clientHeight;
    const size = Math.floor(Math.min(W * 0.86, H * 0.78));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.style.width = size + 'px'; cv.style.height = size + 'px';
    cv.width = size * dpr; cv.height = size * dpr;
    this.miniInfo = drawMinimap(cv, m);
    this.miniInfo.dpr = dpr;
  },
  closeMap() { $('#tMapBg').hidden = true; },
  mapClick(e) {
    const m = TAC.m, inf = this.miniInfo;
    if (!m || !inf) return;
    const cv = $('#tMini'), r = cv.getBoundingClientRect();
    const p = toApp(e.clientX, e.clientY), q = toApp(r.left, r.top), q2 = toApp(r.right, r.bottom);
    const left = Math.min(q.x, q2.x), top = Math.min(q.y, q2.y);
    const x = Math.floor(((p.x - left) * inf.dpr - inf.ox) / inf.k), y = Math.floor(((p.y - top) * inf.dpr - inf.oy) / inf.k);
    if (inb(m, x, y)) { R.centerOn(x, y, true); this.closeMap(); }
  },
  openMenu() {
    if (TAC.m && TAC.m.siege) {
      Game.modal({
        title: 'Оборона на паузе',
        html: `<p>Ход ${TAC.m.turn}. Можно запереться в насосной и переждать: люди уцелеют, но нападающие растащат часть припасов.</p>`,
        buttons: [
          { label: CFG.music ? 'Музыка: выкл' : 'Музыка: вкл', fn: () => Game.toggleMusic() },
          { label: 'Настройки', fn: () => Game.openSettings() },
          { label: 'Запереться и переждать', cls: 'danger', fn: () => abandonMission() },
          { label: 'Продолжить', cls: 'primary' },
        ],
      });
      return;
    }
    Game.modal({
      title: 'Вылазка на паузе',
      html: `<p>Ход ${TAC.m.turn}. Если покинуть вылазку сейчас, уедут только те, кто стоит в зелёной зоне у машины. Остальные останутся на карте навсегда.</p>`,
      buttons: [
        { label: CFG.music ? 'Музыка: выкл' : 'Музыка: вкл', fn: () => Game.toggleMusic() },
        { label: 'Настройки', fn: () => Game.openSettings() },
        { label: 'Покинуть вылазку', cls: 'danger', fn: () => this.confirmAbandon() },
        { label: 'Продолжить', cls: 'primary' },
      ],
    });
  },
  confirmAbandon() {
    const m = TAC.m, left = liveUnits(m).filter(u => !inEvac(m, u));
    Game.modal({
      title: 'Покинуть вылазку?',
      html: left.length ? `<p>Останутся на карте: <b>${left.map(u => esc(u.name)).join(', ')}</b>. Их больше не будет в группе.</p>` : '<p>Все живые бойцы у машины и уедут вместе.</p>',
      buttons: [{ label: 'Отмена' }, { label: left.length ? 'Бросить их и уехать' : 'Уехать', cls: 'danger', fn: () => abandonMission() }],
    });
  },
};

// ----- Касания: тап, перетаскивание, щипок -----
const Input = {
  ptrs: new Map(), start: null, moved: false,
  attach(cv) {
    cv.addEventListener('pointerdown', e => this.down(e));
    cv.addEventListener('pointermove', e => this.move(e));
    cv.addEventListener('pointerup', e => this.up(e));
    cv.addEventListener('pointercancel', e => { this.ptrs.delete(e.pointerId); if (!this.ptrs.size) this.start = null; });
    cv.addEventListener('wheel', e => {
      if (R.mode !== 'tac' && R.mode !== 'base') return;
      e.preventDefault();
      const p = toApp(e.clientX, e.clientY);
      R.zoomAt(p.x, p.y, e.deltaY < 0 ? 1.15 : 1 / 1.15);
      HUD.hidePop();
    }, { passive: false });
  },
  mid() { const [a, b] = [...this.ptrs.values()]; return [(a.x + b.x) / 2, (a.y + b.y) / 2, Math.hypot(a.x - b.x, a.y - b.y)]; },
  down(e) {
    if (R.mode !== 'tac' && R.mode !== 'base') return;
    Sfx.init();
    try { e.target.setPointerCapture(e.pointerId); } catch (er) { /* старые браузеры */ }
    const p = toApp(e.clientX, e.clientY);
    this.ptrs.set(e.pointerId, p);
    if (this.ptrs.size === 1) { this.start = { x: p.x, y: p.y, t: performance.now() }; this.moved = false; R.panStart(p.x, p.y); }
    else if (this.ptrs.size === 2) { const [mx, my, d] = this.mid(); R.pinchStart(mx, my, d); this.moved = true; }
  },
  move(e) {
    if (!this.ptrs.has(e.pointerId)) return;
    const p = toApp(e.clientX, e.clientY);
    this.ptrs.set(e.pointerId, p);
    if (this.ptrs.size === 1 && this.start) {
      if (!this.moved && Math.hypot(p.x - this.start.x, p.y - this.start.y) > 9) { this.moved = true; HUD.hidePop(); }
      if (this.moved) R.panTo(p.x, p.y);
    } else if (this.ptrs.size >= 2) { const [mx, my, d] = this.mid(); R.pinchTo(mx, my, d); HUD.hidePop(); }
  },
  up(e) {
    const p = this.ptrs.get(e.pointerId);
    this.ptrs.delete(e.pointerId);
    if (!p) return;
    if (this.ptrs.size === 0) {
      if (!this.moved && this.start && performance.now() - this.start.t < 700) HUD.tap(p.x, p.y);
      this.start = null;
    } else if (this.ptrs.size === 1) {
      const q = [...this.ptrs.values()][0];
      this.start = { x: q.x, y: q.y, t: 0 }; this.moved = true; R.panStart(q.x, q.y);
    }
  },
};
