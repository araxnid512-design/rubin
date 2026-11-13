'use strict';
/* «Мастерская оружия» — редактор стволов прямо в игре: положение в руках (переноска и стрельба), стрельба
   (очередь, темп, вспышка, трассер, гильзы, отдача, тряска), голос выстрела и физика. Предпросмотр — 3D-боец
   с выбранным стволом, кнопки «Огонь», «Перезарядка». Правки сразу действуют в бою (DW.WT), их можно
   выгрузить текстом и загрузить обратно. */
(function (DW) {
  const WE = {};
  const el = function (tag, attrs, kids) {
    const e = document.createElement(tag);
    for (const k in (attrs || {})) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  };
  const ANIMS = [['idle', 'Стойка'], ['walk', 'Ходьба'], ['run', 'Бег'], ['aim', 'Прицел'], ['kneel', 'С колена'], ['peek', 'Из-за угла'], ['watch', 'Дозор'], ['crouch', 'Присед']];
  const BODIES = [['b_krut', 'Крут'], ['b_marlboro', 'Мальборо'], ['b_pris3', 'Новобранец'], ['b_vest', 'Бронежилет'], ['b_heavy', 'Тяжёлая броня'], ['b_mur1', 'Бандит']];
  const HOLD = [['x', 'Вперёд / назад', -14, 14, 0.5, ' тч'], ['y', 'Выше / ниже', -14, 14, 0.5, ' тч'], ['r', 'Ствол вверх / вниз', -35, 35, 1, '°'], ['s', 'Размер', 0.7, 1.4, 0.02, '×']];
  const FIRE = [['n', 'Выстрелов в очереди', 1, 10, 1, ''], ['gap', 'Темп (между выстрелами)', 30, 220, 2, ' мс'], ['flash', 'Вспышка', 5, 40, 1, ''], ['flife', 'Длительность вспышки', 20, 200, 5, ' мс'],
    ['tw', 'Толщина трассера', 0.5, 5, 0.1, ''], ['tlife', 'Время трассера', 40, 300, 5, ' мс'], ['casS', 'Размер гильз', 1, 4, 0.1, ''], ['eject', 'Выброс гильз', 0, 2, 0.05, '×'],
    ['smoke', 'Дым', 0, 10, 1, ''], ['kick', 'Отдача (толчок бойца)', 0, 6, 0.1, ' тч'], ['shake', 'Тряска экрана', 0, 8, 0.1, ''], ['spread', 'Разброс при промахе', 0.3, 2, 0.05, '×']];
  const SND = [['vol', 'Громкость', 0, 1.5, 0.05, ''], ['pitch', 'Тон', 0.5, 1.6, 0.01, '×'], ['crack', 'Щелчок (резкость)', 0, 1, 0.05, ''], ['body', 'Корпус', 0, 1, 0.05, ''],
    ['bodyF', 'Частота корпуса', 300, 3000, 10, ' Гц'], ['bodyD', 'Длина корпуса', 0.02, 0.4, 0.01, ' с'], ['thump', 'Удар (бас)', 0, 1, 0.05, ''], ['thumpF', 'Частота удара', 40, 250, 1, ' Гц'],
    ['thumpD', 'Длина удара', 0.02, 0.4, 0.01, ' с'], ['tail', 'Хвост (гул)', 0, 1, 0.05, ''], ['tailD', 'Длина хвоста', 0.1, 1.5, 0.05, ' с'], ['echo', 'Эхо', 0, 1, 0.05, ''],
    ['dist', 'Хрип', 0, 1, 0.05, ''], ['mech', 'Затвор после выстрела', 0, 1, 0.05, ''], ['mechD', 'Задержка затвора', 0, 800, 10, ' мс'], ['jit', 'Разброс тона в очереди', 0, 0.15, 0.01, '']];
  const PHYS = [['casBounce', 'Отскок гильз', 0, 0.7, 0.02, ''], ['casFric', 'Скольжение гильз', 0.1, 0.9, 0.02, ''], ['casGrav', 'Тяжесть гильз', 150, 800, 10, ''],
    ['knock', 'Отброс при попадании', 0, 8, 0.1, ' тч'], ['tink', 'Звон гильз', 0, 1, 0.05, ''], ['echoOut', 'Эхо на улице', 0, 1, 0.05, ''], ['echoIn', 'Эхо в помещении и пещере', 0, 1.5, 0.05, '']];

  let root = null, cv = null, raf = 0, st = null;

  WE.open = function () {
    if (root) return;
    const WT = DW.WT, S3 = DW.S3;
    st = { gun: 'ppsh', tab: 'hold', grp: 'carry', anim: 'idle', dir: 7, body: 'b_krut', t0: performance.now(), fire: null, parts: [], tracers: [], flashes: [], marks: true, reload: null };
    if (S3) { S3.load(st.body); WT.ORDER.forEach(function (w) { S3.load('w_' + w); }); }
    root = el('div', { class: 'wed' });
    const top = el('div', { class: 'wed-top' });
    top.appendChild(el('div', { class: 'wed-title', text: 'Мастерская оружия' }));
    const guns = el('div', { class: 'wed-guns' });
    top.appendChild(guns);
    top.appendChild(el('button', { class: 'btn wed-x', html: DW.D.ICONS.close, onclick: WE.close }));
    root.appendChild(top);
    const main = el('div', { class: 'wed-main' });
    const view = el('div', { class: 'wed-view' });
    cv = el('canvas', { class: 'wed-cv' });
    view.appendChild(cv);
    const ctr = el('div', { class: 'wed-ctr' });
    view.appendChild(ctr);
    const side = el('div', { class: 'wed-side' });
    main.appendChild(view); main.appendChild(side);
    root.appendChild(main);
    document.body.appendChild(root);

    function renderGuns() {
      guns.innerHTML = '';
      WT.ORDER.forEach(function (w) {
        const W = DW.D.WEAPONS[w];
        guns.appendChild(el('button', { class: 'chip sm' + (st.gun === w ? ' on' : ''), text: (W ? W.s : w) + (WT.changed(w) ? ' •' : ''), onclick: function () { st.gun = w; DW.SFX.play('click'); renderGuns(); renderSide(); } }));
      });
    }
    function renderCtr() {
      ctr.innerHTML = '';
      const row1 = el('div', { class: 'wed-row' });
      row1.appendChild(el('button', { class: 'btn sm', text: '⟲', title: 'Повернуть', onclick: function () { st.dir = (st.dir + 7) % 8; } }));
      row1.appendChild(el('button', { class: 'btn sm', text: '⟳', title: 'Повернуть', onclick: function () { st.dir = (st.dir + 1) % 8; } }));
      row1.appendChild(el('button', { class: 'btn sm primary', text: 'Огонь!', onclick: function () { fire(); } }));
      row1.appendChild(el('button', { class: 'btn sm', text: 'Перезарядка', onclick: function () { st.reload = performance.now(); if (DW.SFX.reload) DW.SFX.reload(WT.RK[st.gun]); } }));
      row1.appendChild(el('button', { class: 'btn sm' + (st.marks ? ' on' : ''), text: 'Точки', onclick: function () { st.marks = !st.marks; renderCtr(); } }));
      const bi = BODIES.findIndex(function (b) { return b[0] === st.body; });
      row1.appendChild(el('button', { class: 'btn sm', text: 'Боец: ' + BODIES[bi][1], onclick: function () {
        let k = bi;
        for (let n = 0; n < BODIES.length; n++) { k = (k + 1) % BODIES.length; if (S3.has(BODIES[k][0])) break; }
        st.body = BODIES[k][0]; S3.load(st.body); renderCtr();
      } }));
      ctr.appendChild(row1);
      const row2 = el('div', { class: 'wed-row' });
      ANIMS.forEach(function (a) {
        row2.appendChild(el('button', { class: 'chip sm' + (st.anim === a[0] ? ' on' : ''), text: a[1], onclick: function () {
          st.anim = a[0]; const g = WT.group(a[0]); if (g && st.tab === 'hold' && g !== st.grp) { st.grp = g; renderSide(); }
          renderCtr();
        } }));
      });
      ctr.appendChild(row2);
    }
    function slider(def, val, onv) {
      const row = el('div', { class: 'wed-sl' });
      const lab = el('div', { class: 'wl', text: def[1] });
      const out = el('b', { text: fmt(val, def) + def[5] });
      const inp = el('input', { type: 'range', min: def[2], max: def[3], step: def[4], value: val });
      inp.addEventListener('input', function () { const v = parseFloat(inp.value); out.textContent = fmt(v, def) + def[5]; onv(v); });
      lab.appendChild(out); row.appendChild(lab); row.appendChild(inp);
      return row;
    }
    function fmt(v, d) { return d[4] >= 1 ? String(Math.round(v)) : (d[4] >= 0.1 ? v.toFixed(1) : v.toFixed(2)); }
    function renderSide() {
      side.innerHTML = '';
      const tabs = el('div', { class: 'wed-tabs' });
      [['hold', 'Хват'], ['fire', 'Стрельба'], ['snd', 'Звук'], ['phys', 'Физика']].forEach(function (t) {
        tabs.appendChild(el('button', { class: 'chip sm' + (st.tab === t[0] ? ' on' : ''), text: t[1], onclick: function () { st.tab = t[0]; renderSide(); } }));
      });
      side.appendChild(tabs);
      const box = el('div', { class: 'wed-list' });
      const C = WT.get(st.gun);
      if (st.tab === 'hold') {
        const seg = el('div', { class: 'wed-row' });
        [['carry', 'Переноска'], ['aim', 'Стрельба']].forEach(function (g) {
          seg.appendChild(el('button', { class: 'chip sm' + (st.grp === g[0] ? ' on' : ''), text: g[1], onclick: function () { st.grp = g[0]; st.anim = g[0] === 'aim' ? 'aim' : 'idle'; renderCtr(); renderSide(); } }));
        });
        box.appendChild(seg);
        box.appendChild(el('div', { class: 'wed-note', text: st.grp === 'carry' ? 'Как боец держит ствол в стойке, на ходу, при перезарядке.' : 'Как ствол лежит при прицеливании и выстреле (стоя, с колена, из-за угла).' }));
        HOLD.forEach(function (d) { box.appendChild(slider(d, C.hold[st.grp][d[0]], function (v) { WT.set(st.gun, 'hold.' + st.grp + '.' + d[0], v); })); });
      } else if (st.tab === 'fire') {
        FIRE.forEach(function (d) { box.appendChild(slider(d, C.fire[d[0]], function (v) { WT.set(st.gun, 'fire.' + d[0], v); })); });
      } else if (st.tab === 'snd') {
        const r = el('div', { class: 'wed-row' });
        r.appendChild(el('button', { class: 'btn sm primary', text: '▶ Выстрел', onclick: function () { DW.SFX.unlock(); DW.SFX.shot(st.gun, { p: WT.get(st.gun).snd }); } }));
        r.appendChild(el('button', { class: 'btn sm', text: '▶ Очередь', onclick: function () { fire(); } }));
        r.appendChild(el('button', { class: 'btn sm', text: '▶ Эхо помещения', onclick: function () { DW.SFX.unlock(); DW.SFX.shot(st.gun, { env: 'in' }); } }));
        box.appendChild(r);
        SND.forEach(function (d) { box.appendChild(slider(d, C.snd[d[0]], function (v) { WT.set(st.gun, 'snd.' + d[0], v); })); });
      } else {
        box.appendChild(el('div', { class: 'wed-note', text: 'Общие настройки для всех стволов.' }));
        const P = WT.phys();
        PHYS.forEach(function (d) { box.appendChild(slider(d, P[d[0]], function (v) { WT.set('_phys', d[0], v); })); });
      }
      side.appendChild(box);
      const foot = el('div', { class: 'wed-row wed-foot' });
      foot.appendChild(el('button', { class: 'btn sm', text: st.tab === 'phys' ? 'Сбросить физику' : 'Сбросить ствол', onclick: function () { WT.reset(st.tab === 'phys' ? '_phys' : st.gun); renderGuns(); renderSide(); } }));
      foot.appendChild(el('button', { class: 'btn sm', text: 'Выгрузить', onclick: exportBox }));
      foot.appendChild(el('button', { class: 'btn sm', text: 'Загрузить', onclick: importBox }));
      side.appendChild(foot);
      renderGuns();
    }
    function exportBox() {
      const ta = el('textarea', { class: 'wed-ta', readonly: 'readonly' }); ta.value = WT.export();
      DW.UI.modal({ title: 'Настройки оружия', body: el('div', {}, [el('div', { class: 'small dim', text: 'Скопируйте текст — его можно отправить или загрузить позже.' }), ta]), buttons: [
        { text: 'Скопировать', cls: 'primary', onClick: function () { try { navigator.clipboard.writeText(ta.value); DW.UI.toast('Скопировано', 'good'); } catch (e) { ta.select(); document.execCommand('copy'); } } },
        { text: 'Закрыть' }] });
    }
    function importBox() {
      const ta = el('textarea', { class: 'wed-ta' });
      DW.UI.modal({ title: 'Загрузить настройки', body: el('div', {}, [el('div', { class: 'small dim', text: 'Вставьте выгруженный текст.' }), ta]), buttons: [
        { text: 'Загрузить', cls: 'primary', onClick: function () { try { WT.import(ta.value); DW.UI.toast('Настройки загружены', 'good'); renderSide(); } catch (e) { DW.UI.toast('Не получилось: ' + e.message, 'bad'); } } },
        { text: 'Отмена' }] });
    }
    function fire() {
      DW.SFX.unlock();
      const F = WT.get(st.gun).fire;
      if (WT.group(st.anim) !== 'aim') st.anim = 'aim';
      renderCtr();
      st.fire = { t0: performance.now() + 120, n: F.n, gap: F.gap };
      for (let i = 0; i < F.n; i++) DW.SFX.shot(st.gun, { when: 0.12 + i * F.gap / 1000 });
    }
    renderCtr(); renderSide();
    const loop = function () { raf = requestAnimationFrame(loop); draw(); };
    loop();
  };

  WE.close = function () {
    if (!root) return;
    cancelAnimationFrame(raf);
    root.remove(); root = null; cv = null;
    if (DW.S3) DW.S3.clear();
  };

  /* ---------- Предпросмотр ---------- */
  function draw() {
    if (!cv) return;
    const S3 = DW.S3, WT = DW.WT;
    const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.max(10, Math.round(r.width * dpr)), H = Math.max(10, Math.round(r.height * dpr));
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const g = cv.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#2a2420'); bg.addColorStop(1, '#14100d');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    const k = Math.min(W / 90, H / 75), cx = W / 2, cy = H * 0.86;
    // клетки пола
    g.save(); g.translate(cx, cy); g.scale(k, k);
    g.strokeStyle = 'rgba(255,230,190,0.08)'; g.lineWidth = 1 / k;
    for (let i = -3; i <= 3; i++) {
      g.beginPath(); g.moveTo(i * 32 - 3 * 32, i * 16 + 3 * 16); g.lineTo(i * 32 + 3 * 32, i * 16 - 3 * 16); g.stroke();
      g.beginPath(); g.moveTo(i * 32 - 3 * 32, -i * 16 - 3 * 16); g.lineTo(i * 32 + 3 * 32, -i * 16 + 3 * 16); g.stroke();
    }
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(0, 0, 16, 8, 0, 0, 7); g.fill();
    const now = performance.now();
    if (!S3 || !S3.ready(st.body)) { g.restore(); g.fillStyle = '#a8987e'; g.font = (14 * dpr) + 'px sans-serif'; g.textAlign = 'center'; g.fillText('Загрузка модели…', cx, H / 2); return; }
    const wset = 'w_' + st.gun;
    let anim = st.anim, i = 0, kick = 0;
    const n = function (a) { return S3.count(st.body, a); };
    const F = WT.get(st.gun).fire;
    let shotI = -1;
    if (st.reload && now - st.reload < 1100) { anim = 'reload'; i = Math.min(n('reload') - 1, Math.floor((now - st.reload) / 1100 * n('reload'))); }
    else if (st.fire) {
      const tt = now - st.fire.t0, tot = (st.fire.n - 1) * st.fire.gap + 260;
      if (tt > tot) st.fire = null;
      else if (tt >= 0) {
        anim = st.anim === 'aim' ? 'shoot' : st.anim;
        const q = (tt % st.fire.gap) / st.fire.gap, si = Math.floor(tt / st.fire.gap);
        if (si < st.fire.n) { shotI = si; if (anim === 'shoot') i = q < 0.4 ? 1 : 0; kick = (q < 0.25 ? q / 0.25 : Math.max(0, 1 - (q - 0.25) / 0.5)) * F.kick; }
      }
    }
    if (anim !== 'shoot' && anim !== 'reload') {
      const c = n(anim) || 1, fps = anim === 'walk' ? 9 : (anim === 'run' ? 11 : 2.5);
      i = Math.floor((now - st.t0) / 1000 * fps) % c;
    }
    if (!n(anim)) { anim = 'idle'; i = 0; }
    const L = [[st.body, anim, i, st.dir]];
    if (S3.ready(wset) && S3.count(wset, anim)) L.push([wset, anim, i, st.dir]);
    const f = S3.frame(L);
    // куда смотрит боец на экране
    const fa = st.dir * Math.PI / 4, vx = (Math.cos(fa) - Math.sin(fa)) * 32, vy = (Math.cos(fa) + Math.sin(fa)) * 16, vl = Math.hypot(vx, vy);
    const fdir = vx >= 0 ? 1 : -1;
    if (f) g.drawImage(f.c, -f.ox - fdir * kick, -f.oy + kick * 0.25, f.w, f.h);
    // точки: рукоять (голубая) и дуло (пурпурная)
    const mz = S3.ready(wset) ? S3.muzzleAt(wset, anim, i, st.dir) : null;
    if (st.marks && mz) {
      g.fillStyle = '#ff4fd8'; g.beginPath(); g.arc(mz[0] - fdir * kick, mz[1], 1.4, 0, 7); g.fill();
    }
    // стрельба: вспышки, трассеры, гильзы, дым
    if (shotI >= 0 && mz && st.lastShot !== shotI + ':' + Math.floor((now - st.fire.t0) / st.fire.gap)) {
      st.lastShot = shotI + ':' + Math.floor((now - st.fire.t0) / st.fire.gap);
      const sx = mz[0] - fdir * kick, sy = mz[1];
      const ex = sx + vx / vl * 300 + (Math.random() - 0.5) * 12 * F.spread, ey = sy + vy / vl * 300 + (Math.random() - 0.5) * 12 * F.spread;
      st.tracers.push({ x1: sx, y1: sy, x2: ex, y2: ey, t0: now, life: F.tlife, w: F.tw, c: F.tr });
      st.flashes.push({ x: sx, y: sy, r: F.flash * (0.85 + Math.random() * 0.3), t0: now, life: F.flife });
      const P = WT.phys();
      st.parts.push({ x: sx - fdir * 10, y: sy + 4, z: 22, vx: -fdir * (30 + Math.random() * 40) * F.eject, vy: (Math.random() - 0.3) * 20 * F.eject, vz: (70 + Math.random() * 50) * F.eject, t0: now, life: 2400, c: F.cas, s: F.casS, grav: P.casGrav, cas: true });
      for (let s = 0; s < F.smoke / 2; s++) st.parts.push({ x: sx, y: sy, z: 0, vx: fdir * (8 + Math.random() * 14), vy: -6 - Math.random() * 10, vz: 0, t0: now, life: 1100, c: 'rgba(200,196,188,0.3)', s: 5 + Math.random() * 5, grav: 0 });
    }
    const dt = 1 / 60;
    st.parts.forEach(function (p) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.cas) {
        p.z += p.vz * dt; p.vz -= p.grav * dt;
        if (p.z < 0) { const P = WT.phys(); if (!p.tk && p.vz < -40) { p.tk = 1; if (DW.SFX.tink) DW.SFX.tink(p.s > 2.7); } p.z = 0; p.vz = -p.vz * P.casBounce; p.vx *= P.casFric; p.vy *= P.casFric; }
      }
    });
    st.parts = st.parts.filter(function (p) { return now - p.t0 < p.life; });
    st.parts.forEach(function (p) {
      if (p.cas) { g.fillStyle = p.c; g.fillRect(p.x - p.s / 2, p.y - p.z * 0.5 + 22 - p.s / 4, p.s, p.s * 0.5); }
      else { const a = 1 - (now - p.t0) / p.life; g.globalAlpha = a; g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, p.s * (1.5 - a * 0.5), 0, 7); g.fill(); g.globalAlpha = 1; }
    });
    st.tracers = st.tracers.filter(function (t) { return now - t.t0 < t.life; });
    st.tracers.forEach(function (t) {
      const a = 1 - (now - t.t0) / t.life;
      g.strokeStyle = t.c; g.globalAlpha = a; g.lineWidth = t.w; g.beginPath(); g.moveTo(t.x1, t.y1); g.lineTo(t.x2, t.y2); g.stroke(); g.globalAlpha = 1;
    });
    st.flashes = st.flashes.filter(function (f2) { return now - f2.t0 < f2.life; });
    g.globalCompositeOperation = 'lighter';
    st.flashes.forEach(function (f2) {
      const a = 1 - (now - f2.t0) / f2.life;
      const gr = g.createRadialGradient(f2.x, f2.y, 0, f2.x, f2.y, f2.r);
      gr.addColorStop(0, 'rgba(255,250,220,' + a + ')'); gr.addColorStop(0.35, 'rgba(255,190,90,' + a * 0.8 + ')'); gr.addColorStop(1, 'rgba(255,120,40,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(f2.x, f2.y, f2.r, 0, 7); g.fill();
    });
    g.globalCompositeOperation = 'source-over';
    g.restore();
    g.fillStyle = 'rgba(240,228,204,0.55)'; g.font = (11 * dpr) + 'px sans-serif'; g.textAlign = 'left';
    const G = WT.group(anim);
    g.fillText((G === 'aim' ? 'Стрельба' : (G === 'carry' ? 'Переноска' : '—')) + ' · направление ' + (st.dir + 1) + '/8', 8 * dpr, 16 * dpr);
  }

  DW.WEd = WE;
})(window.DW);
