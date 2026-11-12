'use strict';
/* Интерфейс: панель ресурсов, карточка жильца, окна, управление убежищем и вылазкой */
(function () {
  const $ = id => document.getElementById(id), UI = window.UI = {}, I = EX.in;
  let panel = null, ctxCell = null, ctxRoom = null, prepP = null, hudT = 1, lastGoal = '', banT = 0;

  UI.banner = function (t, bad) { const b = $('banner'); b.textContent = t; b.classList.toggle('bad', !!bad); b.classList.add('on'); banT = 3.4; };
  const ico = k => ART.ICON[k];
  const cost = (n, ok) => '<span class="cost' + (ok ? '' : ' no') + '"><img src="' + ico('scrap') + '">' + n + '</span>';
  const stars = n => '<span class="danger">' + ('<img src="' + ico('skull') + '">').repeat(n) + '</span>';
  const gx = (p, m, f) => p.male ? m : f;
  const statsH = p => ['S', 'A', 'I'].map(k => '<span class="st"><i>' + D.STAT[k] + '</i>' + p[k] + '</span>').join('');

  /* ---------- Верхняя панель ---------- */
  const chips = {}; ['energy', 'water', 'food', 'scrap', 'meds', 'ppl'].forEach(k => chips[k] = $('c-' + k));
  UI.initHud = function () { for (const k in chips) chips[k].querySelector('img').src = ico(k); $('x-medi').src = ico('meds'); };
  UI.hud = function (dt) {
    if (banT > 0 && (banT -= dt) <= 0) $('banner').classList.remove('on');
    hudT += dt; if (hudT < 0.2) return; hudT = 0;
    const s = SH.s, cap = SH.caps(), e = EX.e;
    for (const k of ['energy', 'water', 'food']) { const v = s.res[k], el = chips[k]; el.querySelector('b').style.transform = 'scaleX(' + Math.min(1, v / cap.max).toFixed(3) + ')'; el.querySelector('span').textContent = Math.floor(v); el.classList.toggle('low', v < cap.max * 0.12); }
    chips.scrap.querySelector('span').textContent = Math.floor(s.res.scrap);
    chips.meds.querySelector('span').textContent = Math.floor(s.res.meds) + '/' + cap.meds;
    chips.ppl.querySelector('span').textContent = s.ppl.length + '/' + cap.beds;
    const hr = (6 + SH.ph * 24) % 24; $('clock').textContent = 'День ' + (Math.floor(s.t / D.DAY) + 1) + ' · ' + String(hr | 0).padStart(2, '0') + ':' + String(((hr % 1) * 6 | 0) * 10).padStart(2, '0');
    $('clock').classList.toggle('night', SH.dark > 0.5);
    const g = D.GOALS[s.goal], gt = g ? g.t : 'Расширяй убежище, копи запасы и переживай набеги';
    if (gt !== lastGoal) { lastGoal = gt; $('goal-t').textContent = gt; }
    $('b-alarm').classList.toggle('on', s.alarm); $('b-alarm').classList.toggle('hot', SH.raid && !s.alarm);
    if (e) {
      $('x-name').textContent = e.p.name + ' · ' + e.loc.n;
      $('x-hp').style.transform = 'scaleX(' + (e.hp / 100).toFixed(3) + ')'; $('x-st').style.transform = 'scaleX(' + (e.st / 100).toFixed(3) + ')';
      $('x-time').style.transform = 'scaleX(' + Math.max(0, e.time / e.loc.time).toFixed(3) + ')'; $('x-timer').textContent = e.time > 0 ? 'До темноты ' + Math.ceil(e.time) + ' с' : 'ОРДА! Беги к машине';
      $('x-time').parentNode.classList.toggle('horde', e.time <= 0);
      $('x-pack').textContent = 'Рюкзак ' + e.cnt + '/' + e.cap; $('x-meds').textContent = Math.floor(s.res.meds);
      $('x-act').firstChild.textContent = e.hint || 'Удар';
    }
    selCard();
  };
  function selCard() {
    const p = SH.sel, el = $('sel');
    if (!p || EX.e || p.st === 'out') { el.classList.remove('on'); return; }
    el.classList.add('on');
    $('sel-name').textContent = p.name + ' · ур. ' + p.lvl;
    $('sel-stats').innerHTML = statsH(p) + '<span class="st"><i>Здоровье</i>' + Math.round(p.hp) + '</span>';
    $('sel-job').textContent = p.st === 'down' ? gx(p, 'ранен', 'ранена') + ', отлёживается' : p.guard ? 'на посту у шлюза' : p.job ? D.ROOMS[p.job.k].n : 'без работы';
  }

  /* ---------- Окна ---------- */
  const modal = $('modal'), body = $('m-body');
  function open(name, title, html, wide) {
    panel = name; $('m-title').textContent = title; body.innerHTML = html; modal.classList.remove('hide'); $('m-panel').classList.toggle('wide', !!wide);
    G.paused = true; U.sfx('ui');
  }
  UI.close = function () { if (!panel) return; panel = null; modal.classList.add('hide'); G.paused = false; G.save(); };
  UI.isOpen = () => !!panel;
  modal.addEventListener('click', e => { if ((e.target === modal || e.target.closest('[data-close]')) && panel !== 'result') UI.close(); });

  function openBuild(c, r) {
    ctxCell = [c, r]; const kinds = SH.canBuild(c, r), sc = SH.s.res.scrap; let h = '<div class="list">';
    for (const k of kinds) { const d = D.ROOMS[k], ok = sc >= d.cost; h += '<div class="row' + (ok ? '' : ' off') + '"><div class="mid"><b>' + d.n + '</b><p>' + d.d + '</p></div>' + cost(d.cost, ok) + '<button data-build="' + k + '">Строить</button></div>'; }
    open('build', 'Новый отсек', h + '</div>');
  }
  function openRoom(rm) {
    ctxRoom = rm; const d = D.ROOMS[rm.k], s = SH.s, sc = s.res.scrap; let h = '<p class="desc">' + d.d + '</p>';
    if (d.slots) {
      h += '<h3>Работники ' + rm.w.length + '/' + d.slots + ' · навык: ' + D.STAT[d.stat] + '</h3><div class="list">';
      for (const id of rm.w) { const p = SH.byId(id); if (p) h += '<div class="row"><div class="mid"><b>' + p.name + '</b><p>' + statsH(p) + '</p></div><button data-free="' + id + '">Снять</button></div>'; }
      if (!rm.w.length) h += '<p class="desc dim">Никого. Нажми на жильца, затем на этот отсек.</p>';
      h += '</div>';
      if (d.out) { let sk = 0; for (const id of rm.w) { const p = SH.byId(id); if (p) sk += SH.statMul(p[d.stat]); } h += '<p class="desc">Выработка: ' + (d.rate * sk * (1 + (rm.lvl - 1) * 0.6) * 60).toFixed(1) + ' ' + D.RES[d.out].toLowerCase() + ' в минуту</p>'; }
    }
    if (rm.k === 'hatch') h += '<p class="desc">Гермодверь: ' + Math.round(s.door) + ' / ' + D.GEAR.door.val[s.gear.door] + '. Сама чинится между набегами (быстрее с мастерской).</p>';
    if (rm.k === 'workshop') {
      h += '<h3>Снаряжение</h3><div class="list">';
      for (const g in D.GEAR) {
        const G_ = D.GEAR[g], lv = s.gear[g], max = lv >= G_.max, c = max ? 0 : G_.cost[lv + (g === 'weapon' ? 1 : 0)], ok = !max && sc >= c && rm.w.length > 0;
        const ic = g === 'weapon' ? (D.WEAPONS[lv].tool || 'fist') : g;
        h += '<div class="row' + (ok ? '' : ' off') + '"><img class="ri" src="' + ico(ic) + '"><div class="mid"><b>' + G_.n + '</b><p>' + G_.info(lv) + (max ? '' : ' → ' + G_.info(lv + 1)) + '</p></div>' + (max ? '<span class="cost">макс.</span>' : cost(c, sc >= c) + '<button data-gear="' + g + '">Улучшить</button>') + '</div>';
      }
      h += '</div>'; if (!rm.w.length) h += '<p class="desc warn">Нужен работник в мастерской.</p>';
    }
    if (!d.fixed && rm.k !== 'stairs') { const uc = SH.upCost(rm), ok = sc >= uc; h += '<div class="foot">' + (rm.lvl >= 3 ? '<span class="cost">Максимальный уровень</span>' : cost(uc, ok) + '<button class="' + (ok ? '' : 'off') + '" data-up="1">Улучшить до ур. ' + (rm.lvl + 1) + '</button>') + '</div>'; }
    open('room', d.n + (d.fixed || rm.k === 'stairs' ? '' : ' · ур. ' + rm.lvl), h);
  }
  function openPrep(p) {
    const s = SH.s;
    if (SH.raid) { UI.banner('Во время набега выходить нельзя', true); U.sfx('deny'); return; }
    prepP = p && p.st !== 'out' && p.st !== 'down' && p.hp > 30 ? p : null;
    let h = '<h3>Кто пойдёт</h3><div class="people">';
    for (const q of s.ppl) { if (q.st === 'out') continue; const ok = q.st !== 'down' && q.hp > 30; h += '<button class="pc' + (ok ? '' : ' off') + (prepP === q ? ' sel' : '') + '" data-who="' + q.id + '"><b>' + q.name + '</b><small>' + statsH(q) + '</small><small>' + (ok ? 'Здоровье ' + Math.round(q.hp) : 'Ранен') + '</small></button>'; }
    h += '</div><h3>Куда</h3><div class="locs">';
    for (const L of D.LOCS) { const lock = L.req && !SH.has(L.req); h += '<button class="loc' + (lock ? ' off' : '') + '" data-loc="' + L.id + '"><b>' + L.n + '</b>' + stars(L.danger) + '<p>' + (lock ? 'Нужна радиоточка' : L.d) + '</p><small>' + L.time + ' с до темноты</small></button>'; }
    const W = SH.weapon(); h += '</div><p class="desc dim">С собой: ' + W.n + ' · ' + D.GEAR.armor.info(s.gear.armor) + ' · ' + D.GEAR.pack.info(s.gear.pack) + '. Пока жилец наверху, его место в отсеке пустует.</p>';
    open('prep', 'Вылазка на поверхность', h, true);
  }
  UI.result = function (r) {
    let h = '<p class="desc">' + (r.ok ? r.p.name + ' ' + gx(r.p, 'вернулся', 'вернулась') + ' в убежище.' : r.p.name + ' ' + gx(r.p, 'потерял', 'потеряла') + ' сознание. ' + gx(r.p, 'Его', 'Её') + ' едва дотащили до люка' + (r.lostAll ? ', добыча осталась наверху.' : '.')) + '</p><div class="lootrow">';
    let any = false; for (const k of ['scrap', 'food', 'water', 'meds']) if (r.got[k]) { any = true; h += '<span class="cost big"><img src="' + ico(k) + '">+' + r.got[k] + '</span>'; }
    if (r.who) h += '<span class="cost big"><img src="' + ico('ppl') + '">+' + r.who + '</span>';
    if (r.ok && !any && !r.who) h += '<span class="cost">Ничего не принёс</span>';
    h += '</div><p class="desc dim">Убито мертвецов: ' + r.kills + (r.got.lost ? ' · не влезло на склад: ' + r.got.lost : '') + '</p>';
    open('result', r.ok ? 'Вылазка удалась' : 'Вылазка провалена', h + '<div class="foot"><button data-ok="1">В убежище</button></div>');
    document.body.classList.remove('exp'); U.sfx(r.ok ? 'good' : 'deny');
  };
  UI.openMenu = function () {
    open('menu', 'Пауза', '<div class="menu"><button data-close>Продолжить</button><button data-m="sound">Звук: ' + (U.soundOn ? 'вкл' : 'выкл') + '</button><button data-m="q">Графика: ' + ['высокая', 'средняя', 'низкая'][G.q] + '</button><button data-m="fps">Счётчик FPS: ' + (G.fps ? 'вкл' : 'выкл') + '</button><button data-m="new" class="danger">Новое убежище</button></div>');
  };
  function startExp(p, L) {
    UI.close(); SH.buildMode = false; $('b-build').classList.remove('on'); SH.sel = null;
    EX.start(p, L); document.body.classList.add('exp'); hudT = 1; UI.banner(L.n + ': обыщи тайники и вернись к машине');
  }
  body.addEventListener('click', ev => {
    const t = ev.target.closest('button'); if (!t) return; const d = t.dataset, s = SH.s;
    if (d.build) { const R = D.ROOMS[d.build]; if (s.res.scrap < R.cost) return U.sfx('deny'); s.res.scrap -= R.cost; SH.room(ctxCell[0], ctxCell[1], d.build); U.sfx('build'); SH.float(ctxCell[0] * D.CW + D.CW / 2, D.TOP + ctxCell[1] * D.CH + 70, R.n, '#9dff9a'); dustRoom(ctxCell); UI.close(); }
    else if (d.up) { const c = SH.upCost(ctxRoom); if (ctxRoom.lvl >= 3 || s.res.scrap < c) return U.sfx('deny'); s.res.scrap -= c; ctxRoom.lvl++; U.sfx('build'); openRoom(ctxRoom); }
    else if (d.gear) { const g = D.GEAR[d.gear], lv = s.gear[d.gear], c = g.cost[lv + (d.gear === 'weapon' ? 1 : 0)]; if (lv >= g.max || s.res.scrap < c || !ctxRoom.w.length) return U.sfx('deny'); s.res.scrap -= c; s.gear[d.gear]++; if (d.gear === 'door') s.door = g.val[s.gear.door]; U.sfx('good'); openRoom(ctxRoom); }
    else if (d.free) { const p = SH.byId(+d.free); if (p) SH.rest(p); openRoom(ctxRoom); }
    else if (d.who) { const p = SH.byId(+d.who); if (!p || p.st === 'down' || p.hp <= 30) return U.sfx('deny'); prepP = p; body.querySelectorAll('.pc').forEach(b => b.classList.toggle('sel', b === t)); U.sfx('ui'); }
    else if (d.loc) { const L = D.LOCS.find(l => l.id === d.loc); if (L.req && !SH.has(L.req)) return U.sfx('deny'); if (!prepP) { UI.banner('Сначала выбери, кто пойдёт', true); return U.sfx('deny'); } startExp(prepP, L); }
    else if (d.ok) { panel = 'x'; UI.close(); }
    else if (d.m === 'sound') { U.soundOn = !U.soundOn; G.saveCfg(); UI.openMenu(); }
    else if (d.m === 'q') { G.setQ((G.q + 1) % 3); G.saveCfg(); UI.openMenu(); }
    else if (d.m === 'fps') { G.fps = !G.fps; $('fps').textContent = ''; G.saveCfg(); UI.openMenu(); }
    else if (d.m === 'new') { if (d.sure) { G.reset(); panel = 'x'; UI.close(); } else { t.dataset.sure = 1; t.textContent = 'Точно? Нажми ещё раз'; } }
  });
  function dustRoom(c) { for (let i = 0; i < 26; i++) SH.fx.push({ x: c[0] * D.CW + Math.random() * D.CW, y: D.TOP + c[1] * D.CH + 20 + Math.random() * 100, vx: (Math.random() - 0.5) * 40, vy: -20, life: 1.2, max: 1.2, s: 10 + Math.random() * 10, smoke: 1 }); }

  /* ---------- Касания в убежище: выбор, перетаскивание, щипок ---------- */
  const cv = $('cv'), pts = new Map(); let drag = null, pinch = null;
  cv.addEventListener('pointerdown', e => {
    U.audioInit(); if (EX.e || G.paused) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); try { cv.setPointerCapture(e.pointerId); } catch (_) { }
    if (pts.size === 1) drag = { x: e.clientX, y: e.clientY, cx: SH.cam.x, cy: SH.cam.y, moved: false };
    else if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: SH.cam.zt }; drag = null; }
  });
  cv.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pts.size >= 2) { const [a, b] = [...pts.values()]; G.zoomTo(pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d); return; }
    if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) > 10) drag.moved = true;
    if (drag.moved) { const k = G.view.css / SH.cam.z; SH.cam.x = drag.cx - dx * k; SH.cam.y = drag.cy - dy * k; SH.cam.free = 3; }
  });
  const up = e => {
    if (!pts.has(e.pointerId)) return; pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (drag && pts.size === 0) { const dd = drag; drag = null; if (!dd.moved && e.type === 'pointerup' && !EX.e && !G.paused) { const w = SH.toWorld(e.clientX * G.view.css, e.clientY * G.view.css, G.view); tap(w[0], w[1]); } }
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => { if (!EX.e) G.zoomTo(SH.cam.zt * (e.deltaY < 0 ? 1.12 : 0.89)); e.preventDefault(); }, { passive: false });
  function tap(wx, wy) {
    const s = SH.s; let hit = null, hd = 24;
    for (const p of s.ppl) if (p.st !== 'out' && wy < p.y + 10 && wy > p.y - 70 && Math.abs(wx - p.x) < hd) { hit = p; hd = Math.abs(wx - p.x); }
    if (hit && !SH.buildMode) { if (hit.st === 'down') { UI.banner(hit.name + ' ' + gx(hit, 'ранен', 'ранена') + ' и отлёживается'); return; } SH.sel = SH.sel === hit ? null : hit; U.sfx('ui'); hudT = 1; return; }
    if (wy < 8) { if (Math.abs(wx - D.SX) < 110 && wy > -130) openPrep(SH.sel); else SH.sel = null; hudT = 1; return; }
    const c = Math.floor(wx / D.CW), r = Math.floor((wy - D.TOP) / D.CH);
    if (c < 0 || r < 0 || c >= D.COLS || r >= D.ROWS) { SH.sel = null; hudT = 1; return; }
    const rm = SH.grid[r][c];
    if (rm) {
      if (SH.sel && !SH.buildMode) {
        const p = SH.sel;
        if (SH.assign(p, rm)) { U.sfx('ui'); SH.float(p.x, p.y - 88, D.ROOMS[rm.k].slots ? 'Иду работать' : 'Иду', '#9dff9a'); p.guard = false; }
        else { U.sfx('deny'); UI.banner('В отсеке «' + D.ROOMS[rm.k].n + '» нет свободных мест', true); }
        SH.sel = null; hudT = 1;
      } else openRoom(rm);
    } else if (SH.canBuild(c, r)) openBuild(c, r);
    else { SH.sel = null; hudT = 1; if (SH.buildMode) UI.banner(c === D.SHAFT ? 'Лестницу строят сверху вниз' : 'Новый отсек ставится рядом с уже построенным'); }
  }
  $('b-build').addEventListener('click', () => { SH.buildMode = !SH.buildMode; $('b-build').classList.toggle('on', SH.buildMode); SH.sel = null; U.sfx('ui'); if (SH.buildMode) { UI.banner('Выбери подсвеченную клетку'); G.zoomTo(SH.cam.zmin * 1.15); } });
  $('b-exp').addEventListener('click', () => openPrep(SH.sel));
  $('b-alarm').addEventListener('click', () => { SH.alarm(!SH.s.alarm); hudT = 1; if (SH.s.alarm) { UI.banner('Все к шлюзу!'); SH.cam.ty = 0; } });
  $('b-zoom').addEventListener('click', () => { G.zoomTo(SH.cam.zt > SH.cam.zmin * 1.3 ? SH.cam.zmin : SH.cam.zdef); U.sfx('ui'); });
  $('btn-menu').addEventListener('click', UI.openMenu);
  $('sel-x').addEventListener('click', () => { SH.sel = null; hudT = 1; });
  $('sel-rest').addEventListener('click', () => { if (SH.sel) SH.rest(SH.sel); SH.sel = null; hudT = 1; U.sfx('ui'); });
  $('sel-go').addEventListener('click', () => openPrep(SH.sel));

  /* ---------- Управление на вылазке ---------- */
  const hold = (id, on, off) => {
    const el = $(id);
    el.addEventListener('pointerdown', e => { U.audioInit(); on(); el.classList.add('on'); try { el.setPointerCapture(e.pointerId); } catch (_) { } e.preventDefault(); });
    const u = () => { off(); el.classList.remove('on'); }; el.addEventListener('pointerup', u); el.addEventListener('pointercancel', u);
  };
  hold('x-l', () => I.l = true, () => I.l = false); hold('x-r', () => I.r = true, () => I.r = false);
  hold('x-act', () => { I.act = true; I.actP = true; }, () => I.act = false);
  hold('x-roll', () => I.roll = true, () => { });
  $('x-med').addEventListener('click', () => EX.heal());
  addEventListener('keydown', e => {
    if (e.repeat) return; U.audioInit();
    if (EX.e && !G.paused) {
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') I.l = true; else if (e.code === 'KeyD' || e.code === 'ArrowRight') I.r = true;
      else if (e.code === 'Space' || e.code === 'KeyJ') { I.act = true; I.actP = true; e.preventDefault(); } else if (e.code === 'ShiftLeft' || e.code === 'KeyK') I.roll = true; else if (e.code === 'KeyH') EX.heal();
    }
    if (e.code === 'Escape') G.onBack();
  });
  addEventListener('keyup', e => { if (e.code === 'KeyA' || e.code === 'ArrowLeft') I.l = false; else if (e.code === 'KeyD' || e.code === 'ArrowRight') I.r = false; else if (e.code === 'Space' || e.code === 'KeyJ') I.act = false; });
  document.addEventListener('contextmenu', e => e.preventDefault());

  UI.back = function () {
    if (!$('title').classList.contains('hide')) return;
    if (panel) { if (panel !== 'result') UI.close(); }
    else if (SH.buildMode) $('b-build').click();
    else if (SH.sel) { SH.sel = null; hudT = 1; }
    else UI.openMenu();
  };
  EX.onEnd = r => UI.result(r);
  SH.onEvent = function (k, p) {
    if (k === 'raid') UI.banner('НАБЕГ! Мертвецы ломятся в шлюз — жми «Тревога»', true);
    else if (k === 'breach') { if (!SH._br) { SH._br = 1; UI.banner('Дверь выбита!', true); } }
    else if (k === 'won') { SH._br = 0; UI.banner('Набег отбит'); }
    else if (k === 'goal') hudT = 1;
    else if (k === 'arrive') UI.banner(p.name + ' ' + gx(p, 'пришёл', 'пришла') + ' на сигнал радио');
  };
})();
