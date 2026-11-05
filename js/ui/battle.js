/* Автобой в интерфейсе: подготовка, анимированная схема на Canvas, лог, итоги, повторы. */
(function (G) {
  'use strict';
  const { h, svg } = G.Dom;
  const U = G.U;
  const F = U.FORMS;
  const UI = G.UI = G.UI || {};
  UI.modals = UI.modals || {};

  // ================= ВНЕШНИЙ ВИД ЮНИТОВ (условные фигуры) =================
  const LOOK = {
    trooper: { shape: 'circle', fill: '#eceae4' },
    sand: { shape: 'circle', fill: '#e3cfa3' },
    heavy: { shape: 'circle', fill: '#eceae4', ring: true },
    sniper: { shape: 'circle', fill: '#eceae4', glyph: 'scope' },
    scout: { shape: 'circle', fill: '#eceae4', glyph: 'arrow' },
    medic: { shape: 'circle', fill: '#eceae4', glyph: 'plus' },
    droid: { shape: 'square', fill: '#8fb0c8' },
    merc: { shape: 'circle', fill: '#a9ad72' },
    walker: { shape: 'hex', fill: '#c9ccd1', size: 1.35 },
    turret: { shape: 'square', fill: '#9aa3ad', glyph: 'barrel' },
    tusken: { shape: 'tri', fill: '#a3713f' },
    tusken_rifle: { shape: 'tri', fill: '#7e5631', glyph: 'line' },
    tusken_chief: { shape: 'tri', fill: '#c1803f', size: 1.3, glyph: 'dot' },
    jawa: { shape: 'tri', fill: '#5c3f24', size: 0.75 },
    bandit: { shape: 'diamond', fill: '#d0503f' },
    swoop: { shape: 'diamond', fill: '#e8743f', glyph: 'tail' },
    bandit_boss: { shape: 'diamond', fill: '#ef4b3a', size: 1.3, glyph: 'dot' },
    rebel: { shape: 'tri', fill: '#e08a3a' },
    rebel_heavy: { shape: 'tri', fill: '#c46f2a', ring: true },
    rebel_officer: { shape: 'tri', fill: '#f2a85a', size: 1.25, glyph: 'dot' },
    smuggler: { shape: 'diamond', fill: '#3fb5a5' },
    gamorrean: { shape: 'square', fill: '#6f8f3f', size: 1.2 },
    hutt_guard: { shape: 'diamond', fill: '#a07ad4' },
    krayt: { shape: 'blob', fill: '#bfa86e', size: 2.3 },
  };
  const BOLT = { 0: '#ff4d3d', tusken: '#f3e9c9', tusken_camp: '#f3e9c9', jawa: '#7cc0ff', krayt: '#ffd27a', default: '#8dff7a' };

  const TERRAIN = {
    0: '#b38f58', // песок
    1: '#c4a067', // дюна
    2: '#5e4a36', // скала
    3: '#6d737b', // обломки
    4: '#8b8e93', // баррикада
  };

  // ================= ПРОСМОТР БОЯ =================
  G.BattleView = function (opts) {
    const res = opts.res;
    const setup = opts.setup;
    const W = res.map.w, H = res.map.h;
    const tps = G.CONFIG.battle.playbackTps;
    const ranks = setup.sides[0].units.map((e) => e.rank || 0);
    const st = { tick: 0, playing: opts.autoplay !== false, speed: 1, shownLog: 0, ended: false, destroyed: false, last: 0 };

    const canvas = h('canvas', { class: 'bv-canvas' });
    const ctx = canvas.getContext('2d');
    const timeEl = h('span', { class: 'mono muted small' });
    const playBtn = h('button', { class: 'btn small', onclick: () => { if (st.ended) { st.tick = 0; st.shownLog = 0; logEl.textContent = ''; st.ended = false; } st.playing = !st.playing; syncBtns(); } });
    const speedBtns = [1, 2, 4].map((sp) => h('button', { class: 'btn small', onclick: () => { st.speed = sp; syncBtns(); } }, '×' + sp));
    const skipBtn = h('button', { class: 'btn small', onclick: () => { st.tick = res.ticks; st.playing = false; syncBtns(); } }, '⏭ к итогам');
    const logEl = h('div', { class: 'bv-log' });
    const legend = h('div', { class: 'small muted bv-legend' },
      h('span', null, '● наши'), h('span', null, '■ дроиды'), h('span', null, '▲ ◆ противник'), h('span', null, 'линии — выстрелы'));
    const root = h('div', { class: 'bv' },
      h('div', { class: 'bv-stage' }, canvas),
      h('div', { class: 'row bv-controls' }, playBtn, h('div', { class: 'seg' }, speedBtns), skipBtn, h('span', { class: 'spacer' }), timeEl),
      legend,
      logEl);

    function syncBtns() {
      playBtn.textContent = st.ended ? '↺ заново' : st.playing ? '❚❚ пауза' : '▶ смотреть';
      speedBtns.forEach((b, i) => b.classList.toggle('sel', [1, 2, 4][i] === st.speed));
    }
    syncBtns();

    // Подложка — местность, рисуется один раз на размер
    let cellPx = 0, terrainCanvas = null;
    function resize() {
      const avail = Math.max(240, (root.clientWidth || canvas.parentElement.clientWidth || 600));
      const vh = globalThis.innerHeight || 800;
      const cell = Math.max(10, Math.min(Math.floor(avail / W), Math.floor((vh * 0.48) / H), 34));
      if (cell === cellPx) return;
      cellPx = cell;
      const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
      canvas.width = W * cell * dpr;
      canvas.height = H * cell * dpr;
      canvas.style.width = W * cell + 'px';
      canvas.style.height = H * cell + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      terrainCanvas = document.createElement('canvas');
      terrainCanvas.width = canvas.width;
      terrainCanvas.height = canvas.height;
      const tc = terrainCanvas.getContext('2d');
      tc.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawTerrain(tc, cell);
    }

    function drawTerrain(c, cell) {
      const cells = res.map.cells;
      c.fillStyle = TERRAIN[0];
      c.fillRect(0, 0, W * cell, H * cell);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const t = cells[y * W + x];
        const px = x * cell, py = y * cell;
        if (t === 1) {
          c.fillStyle = TERRAIN[1];
          c.fillRect(px, py, cell, cell);
          c.strokeStyle = 'rgba(120,85,40,0.35)';
          c.beginPath();
          c.moveTo(px + 2, py + cell * 0.65);
          c.quadraticCurveTo(px + cell / 2, py + cell * 0.35, px + cell - 2, py + cell * 0.65);
          c.stroke();
        } else if (t === 2) {
          c.fillStyle = TERRAIN[2];
          roundRect(c, px + 1, py + 1, cell - 2, cell - 2, cell * 0.3);
          c.fill();
          c.fillStyle = 'rgba(255,255,255,0.08)';
          c.fillRect(px + cell * 0.2, py + cell * 0.2, cell * 0.35, cell * 0.2);
        } else if (t === 3) {
          c.fillStyle = TERRAIN[3];
          c.fillRect(px + 0.5, py + 0.5, cell - 1, cell - 1);
          c.strokeStyle = 'rgba(0,0,0,0.35)';
          c.beginPath();
          c.moveTo(px + 2, py + cell / 2); c.lineTo(px + cell - 2, py + cell / 2);
          c.moveTo(px + cell / 2, py + 2); c.lineTo(px + cell / 2, py + cell / 2);
          c.stroke();
        } else if (t === 4) {
          c.fillStyle = TERRAIN[4];
          c.fillRect(px + 1, py + cell * 0.3, cell - 2, cell * 0.4);
        }
      }
      // сетка — едва заметная
      c.strokeStyle = 'rgba(0,0,0,0.06)';
      for (let x = 1; x < W; x++) { c.beginPath(); c.moveTo(x * cell, 0); c.lineTo(x * cell, H * cell); c.stroke(); }
      for (let y = 1; y < H; y++) { c.beginPath(); c.moveTo(0, y * cell); c.lineTo(W * cell, y * cell); c.stroke(); }
    }

    function roundRect(c, x, y, w, hh, r) {
      c.beginPath();
      c.moveTo(x + r, y);
      c.arcTo(x + w, y, x + w, y + hh, r);
      c.arcTo(x + w, y + hh, x, y + hh, r);
      c.arcTo(x, y + hh, x, y, r);
      c.arcTo(x, y, x + w, y, r);
      c.closePath();
    }

    function posAt(i, tick) {
      const f0 = res.frames[Math.min(res.frames.length - 1, Math.floor(tick))];
      const f1 = res.frames[Math.min(res.frames.length - 1, Math.floor(tick) + 1)];
      const a = tick - Math.floor(tick);
      const k = i * 4;
      return { x: (f0[k] + (f1[k] - f0[k]) * a) / 10, y: (f0[k + 1] + (f1[k + 1] - f0[k + 1]) * a) / 10, hp: f0[k + 2], fl: f0[k + 3] };
    }

    function drawUnit(u, p, cell) {
      const look = LOOK[u.type] || LOOK.trooper;
      const cx = (p.x + 0.5) * cell, cy = (p.y + 0.5) * cell;
      const r = cell * 0.36 * (look.size || 1);
      if (p.fl & 1) { // выбыл
        ctx.strokeStyle = 'rgba(40,20,15,0.55)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.6, cy - r * 0.6); ctx.lineTo(cx + r * 0.6, cy + r * 0.6);
        ctx.moveTo(cx + r * 0.6, cy - r * 0.6); ctx.lineTo(cx - r * 0.6, cy + r * 0.6);
        ctx.stroke();
        ctx.lineWidth = 1;
        return;
      }
      if (p.fl & 2) return; // покинул поле
      ctx.fillStyle = look.fill;
      ctx.strokeStyle = u.side === 0 ? '#1b1d21' : '#2a160c';
      ctx.lineWidth = Math.max(1, cell * 0.07);
      ctx.beginPath();
      switch (look.shape) {
        case 'square': ctx.rect(cx - r, cy - r, r * 2, r * 2); break;
        case 'tri': ctx.moveTo(cx, cy - r * 1.1); ctx.lineTo(cx + r, cy + r * 0.8); ctx.lineTo(cx - r, cy + r * 0.8); ctx.closePath(); break;
        case 'diamond': ctx.moveTo(cx, cy - r * 1.1); ctx.lineTo(cx + r, cy); ctx.lineTo(cx, cy + r * 1.1); ctx.lineTo(cx - r, cy); ctx.closePath(); break;
        case 'hex': for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k; ctx[k ? 'lineTo' : 'moveTo'](cx + r * Math.cos(a), cy + r * Math.sin(a)); } ctx.closePath(); break;
        case 'blob': for (let k = 0; k < 10; k++) { const a = Math.PI / 5 * k; const rr = k % 2 ? r * 0.75 : r; ctx[k ? 'lineTo' : 'moveTo'](cx + rr * Math.cos(a), cy + rr * Math.sin(a)); } ctx.closePath(); break;
        default: ctx.arc(cx, cy, r, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.stroke();
      // Знаки специализации
      ctx.strokeStyle = '#1b1d21';
      ctx.fillStyle = '#1b1d21';
      ctx.lineWidth = Math.max(1, cell * 0.06);
      if (look.ring) { ctx.beginPath(); ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2); ctx.stroke(); }
      if (look.glyph === 'plus') { ctx.fillStyle = '#c0392b'; ctx.fillRect(cx - r * 0.15, cy - r * 0.55, r * 0.3, r * 1.1); ctx.fillRect(cx - r * 0.55, cy - r * 0.15, r * 1.1, r * 0.3); }
      if (look.glyph === 'scope') { ctx.beginPath(); ctx.moveTo(cx - r * 0.6, cy); ctx.lineTo(cx + r * 0.6, cy); ctx.moveTo(cx, cy - r * 0.6); ctx.lineTo(cx, cy + r * 0.6); ctx.stroke(); }
      if (look.glyph === 'arrow') { ctx.beginPath(); ctx.moveTo(cx - r * 0.4, cy - r * 0.4); ctx.lineTo(cx + r * 0.4, cy); ctx.lineTo(cx - r * 0.4, cy + r * 0.4); ctx.stroke(); }
      if (look.glyph === 'dot') { ctx.beginPath(); ctx.arc(cx, cy + r * 0.1, r * 0.22, 0, Math.PI * 2); ctx.fill(); }
      if (look.glyph === 'line') { ctx.beginPath(); ctx.moveTo(cx, cy - r * 0.5); ctx.lineTo(cx, cy + r * 0.5); ctx.stroke(); }
      if (look.glyph === 'barrel') { ctx.fillRect(cx, cy - r * 0.15, r * 1.2 * (u.side === 0 ? 1 : -1), r * 0.3); }
      if (look.glyph === 'tail') { ctx.beginPath(); ctx.moveTo(cx + r, cy); ctx.lineTo(cx + r * 1.5, cy); ctx.stroke(); }
      // Сержанты и выше — тёмная полоса
      if (u.side === 0 && u.kind === 'trooper' && ranks[u.i] >= 2) { ctx.fillStyle = '#1b1d21'; ctx.fillRect(cx - r * 0.7, cy - r * 0.75, r * 1.4, r * 0.25); }
      // Здоровье
      const hpw = cell * 0.74 * Math.max(1, (look.size || 1) * 0.8);
      const frac = Math.max(0, p.hp / u.maxHp);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(cx - hpw / 2, cy - r - cell * 0.2, hpw, Math.max(2, cell * 0.1));
      ctx.fillStyle = frac > 0.6 ? '#7cc287' : frac > 0.3 ? '#f2b33d' : '#e2574c';
      ctx.fillRect(cx - hpw / 2, cy - r - cell * 0.2, hpw * Math.min(1, frac), Math.max(2, cell * 0.1));
      if (p.fl & 8) { ctx.strokeStyle = 'rgba(30,30,30,0.5)'; ctx.setLineDash([2, 2]); ctx.beginPath(); ctx.arc(cx, cy, r + cell * 0.12, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
      if (p.fl & 4) { ctx.fillStyle = '#ffd34d'; ctx.font = 'bold ' + Math.round(cell * 0.6) + 'px system-ui'; ctx.fillText('!', cx + r * 0.7, cy - r * 0.4); }
      ctx.lineWidth = 1;
    }

    function draw() {
      if (!cellPx) resize();
      const cell = cellPx;
      ctx.clearRect(0, 0, W * cell, H * cell);
      ctx.drawImage(terrainCanvas, 0, 0, W * cell, H * cell);
      const t = st.tick;
      // дым
      for (const sm of res.smokes) {
        if (t < sm.t0 || t > sm.t1) continue;
        const fade = Math.min(1, (t - sm.t0) / 8, (sm.t1 - t) / 12);
        ctx.fillStyle = 'rgba(210,210,205,' + (0.55 * fade).toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc((sm.x + 0.5) * cell, (sm.y + 0.5) * cell, (Math.sqrt(sm.r2) + 0.6) * cell, 0, Math.PI * 2);
        ctx.fill();
      }
      // юниты
      for (const u of res.units) drawUnit(u, posAt(u.i, t), cell);
      // выстрелы
      ctx.lineWidth = Math.max(1, cell * 0.08);
      for (let k = 0; k < res.shots.length; k++) {
        const sh = res.shots[k];
        if (sh[0] > t || sh[0] < t - 3) continue;
        const a = posAt(sh[1], sh[0]);
        const b = posAt(sh[2], sh[0]);
        const shooter = res.units[sh[1]];
        const miss = sh[3] ? 0 : (k % 2 ? 0.35 : -0.35);
        ctx.strokeStyle = shooter.side === 0 ? BOLT[0] : BOLT[setup.army] || BOLT.default;
        ctx.globalAlpha = 1 - (t - sh[0]) / 3;
        ctx.beginPath();
        ctx.moveTo((a.x + 0.5) * cell, (a.y + 0.5) * cell);
        ctx.lineTo((b.x + 0.5 + miss) * cell, (b.y + 0.5 - miss) * cell);
        ctx.stroke();
        if (sh[4]) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc((b.x + 0.5) * cell, (b.y + 0.5) * cell, cell * 0.18, 0, Math.PI * 2); ctx.fill(); }
      }
      ctx.globalAlpha = 1;
      // взрывы
      for (const bm of res.booms) {
        const dt = t - bm[0];
        if (dt < 0 || dt > 10) continue;
        ctx.fillStyle = 'rgba(255,170,60,' + (0.7 * (1 - dt / 10)).toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc((bm[1] + 0.5) * cell, (bm[2] + 0.5) * cell, cell * (0.6 + dt * 0.12), 0, Math.PI * 2);
        ctx.fill();
      }
      // лечение
      ctx.fillStyle = '#7cff9a';
      for (const hl of res.heals) {
        const dt = t - hl[0];
        if (dt < 0 || dt > 8) continue;
        const p = posAt(hl[1], t);
        const cx = (p.x + 0.5) * cell, cy = (p.y + 0.5) * cell - cell * 0.6 - dt * 0.6;
        ctx.fillRect(cx - cell * 0.05, cy - cell * 0.18, cell * 0.1, cell * 0.36);
        ctx.fillRect(cx - cell * 0.18, cy - cell * 0.05, cell * 0.36, cell * 0.1);
      }
      if (setup.night) { ctx.fillStyle = 'rgba(12,22,58,0.38)'; ctx.fillRect(0, 0, W * cell, H * cell); }
      timeEl.textContent = (t / 10).toFixed(1) + ' / ' + (res.ticks / 10).toFixed(1) + ' с';
    }

    function syncLog() {
      while (st.shownLog < res.log.length && res.log[st.shownLog].t <= st.tick) {
        const e = res.log[st.shownLog++];
        logEl.appendChild(h('div', { class: 'bl k-' + e.k }, h('span', { class: 'mono muted' }, (e.t / 10).toFixed(1) + ' '), e.text));
      }
      logEl.scrollTop = logEl.scrollHeight;
    }

    function frame(ts) {
      if (st.destroyed) return;
      const dt = st.last ? Math.min(0.1, (ts - st.last) / 1000) : 0;
      st.last = ts;
      if (root.isConnected) {
        resize();
        if (st.playing) st.tick = Math.min(res.ticks, st.tick + dt * tps * st.speed);
        if (st.tick >= res.ticks && !st.ended) {
          st.ended = true; st.playing = false; syncBtns();
          if (opts.onEnd) opts.onEnd();
        }
        draw();
        syncLog();
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    if (opts.startAtEnd) { st.tick = res.ticks; st.playing = false; }

    return {
      el: root,
      destroy() { st.destroyed = true; },
      ended: () => st.ended,
    };
  };

  // ================= ПОДГОТОВКА К БОЮ =================
  function enemyIntel(s, p) {
    if (!p.ctx.intel) return 'Силы противника неизвестны — разведка не проводилась.';
    const counts = {};
    for (const e of p.enemies) counts[e.type] = (counts[e.type] || 0) + 1;
    return Object.keys(counts).map((t) => G.TEXT.battleUnits[t] ? U.pl(counts[t], G.TEXT.battleUnits[t]) : t + ' ×' + counts[t]).join(', ');
  }

  function ourForces(s, p) {
    const units = p.unitIds.map((id) => G.Units.byId(s, id)).filter(Boolean);
    const ppl = units.filter((u) => u.kind !== 'droid');
    const dr = units.length - ppl.length;
    const wounded = ppl.filter((u) => G.Units.woundLevel(u) > 0).length;
    const specs = {};
    for (const u of ppl) if (u.spec) specs[u.spec] = (specs[u.spec] || 0) + 1;
    let txt = U.pl(ppl.length, F.fighter) + (wounded ? ' (ранены: ' + wounded + ')' : '') + (dr ? ', ' + U.pl(dr, F.droid) : '');
    const sp = Object.keys(specs).map((k) => (G.TEXT.specs ? G.TEXT.specs[k].name.toLowerCase() : k) + ' ×' + specs[k]);
    if (sp.length) txt += '; специалисты: ' + sp.join(', ');
    if (p.ctx.mode === 'camp' && G.BattleFlow.campTurrets(s)) txt += '; турели: ' + G.BattleFlow.campTurrets(s);
    return txt;
  }

  function formationIcon(id) {
    const pts = {
      line: [[8, 3], [8, 9], [8, 15], [8, 21], [3, 6], [3, 18]],
      wedge: [[14, 12], [9, 7], [9, 17], [4, 3], [4, 21], [4, 12]],
      column: [[12, 9], [12, 15], [7, 9], [7, 15], [2, 9], [2, 15]],
      spread: [[13, 4], [6, 9], [11, 15], [3, 19], [8, 22], [2, 3]],
    }[id];
    return svg('svg', { viewBox: '0 0 18 25', width: 26, height: 34, class: 'f-icon' },
      ...pts.map(([x, y]) => svg('circle', { cx: x + 1, cy: y + 1, r: 2.2, fill: '#eceae4', stroke: '#1b1d21', 'stroke-width': 0.6 })));
  }

  UI.modals.battle = function (s) {
    const p = s.pending;
    const B = G.TEXT.battleUi;
    const act = (payload) => { G.Game.act(s, payload); UI.commit(); };
    const set = (key, value) => act({ action: 'set', key: key, value: value });
    const ch = p.choices;
    const kind = p.ctx.surprise ? B.surprise : p.ctx.night ? B.night : B.day;
    const terrain = G.TEXT.terrain[p.map.type] || p.map.type;

    const box = h('div', { class: 'modal wide battle-setup' },
      h('div', { class: 'small muted' }, 'День ' + s.day + ' · ' + kind + ' · местность: ' + terrain),
      h('h2', null, p.ctx.title),
      h('div', { class: 'kv', style: 'margin-bottom:10px' },
        h('span', { class: 'k' }, 'Наши силы'), h('span', null, ourForces(s, p)),
        h('span', { class: 'k' }, 'Противник'), h('span', null, enemyIntel(s, p))),
      p.ctx.surprise ? h('p', { class: 'warn small' }, B.surpriseHint) : null);

    const grid = h('div', { class: 'grid2' });
    // Построение
    grid.appendChild(h('div', { class: 'card flat' },
      h('h3', null, 'Построение'),
      h('div', { class: 'formations' }, ['line', 'wedge', 'column', 'spread'].map((f) =>
        h('button', { class: 'btn form-btn' + (ch.formation === f ? ' sel' : ''), disabled: p.ctx.surprise, onclick: () => set('formation', f) },
          formationIcon(f), h('span', null, G.TEXT.formations[f].name)))),
      h('p', { class: 'small muted', style: 'margin:6px 0 0' }, G.TEXT.formations[ch.formation].desc)));
    // Тактика и отступление
    grid.appendChild(h('div', { class: 'card flat' },
      h('h3', null, 'Тактика'),
      h('div', { class: 'seg', style: 'margin-bottom:6px' }, ['assault', 'defense', 'flank'].map((t) =>
        h('button', { class: 'btn small' + (ch.tactic === t ? ' sel' : ''), onclick: () => set('tactic', t) }, G.TEXT.tactics[t].name))),
      h('p', { class: 'small muted' }, G.TEXT.tactics[ch.tactic].desc),
      h('h3', { style: 'margin-top:8px' }, 'Отступать при потерях'),
      h('div', { class: 'seg' }, G.CONFIG.battle.retreatOptions.map((r) =>
        h('button', { class: 'btn small' + (ch.retreatAt === r ? ' sel' : ''), onclick: () => set('retreatAt', r) }, r ? 'от ' + Math.round(r * 100) + '%' : 'никогда'))),
      h('p', { class: 'small muted', style: 'margin:6px 0 0' }, B.retreatHint)));
    box.appendChild(grid);

    // Приказы генерала
    box.appendChild(h('div', { class: 'card flat', style: 'margin-top:12px' },
      h('div', { class: 'row between' }, h('h3', null, 'Приказы генерала'), h('span', { class: 'small muted' }, 'выбрано ' + ch.orders.length + ' из ' + G.CONFIG.battle.maxOrders)),
      h('div', { class: 'orders-list' }, G.BattleFlow.orderIds().map((id) => {
        const T = G.TEXT.battleOrders[id];
        const lock = G.BattleFlow.orderLock(s, id);
        const on = ch.orders.indexOf(id) >= 0;
        const cd = G.CONFIG.battle.orders[id].cd / 10;
        return h('button', { class: 'choice order-pick' + (on ? ' sel' : ''), disabled: !!lock, onclick: () => set('order', id) },
          h('div', { class: 'cn' }, (on ? '☑ ' : '☐ ') + T.name),
          h('div', { class: 'ch' }, lock ? 'Недоступно: ' + lock : T.desc + ' Перезарядка ' + cd + ' с.'));
      }))));

    box.appendChild(h('div', { class: 'row', style: 'margin-top:14px' },
      h('button', { class: 'btn primary', style: 'flex:2', onclick: () => act({ action: 'fight' }) }, '⚔ В бой — смотреть'),
      h('button', { class: 'btn', style: 'flex:1', onclick: () => act({ action: 'quick' }) }, 'Быстрый расчёт')));
    return box;
  };

  // ================= ИТОГИ И ПРОСМОТР =================
  function reportBlock(rep, extra) {
    const list = (label, arr, cls) => (arr && arr.length ? h('div', { class: cls || '' }, h('b', null, label + ': '), arr.join(', ')) : null);
    return h('div', { class: 'card flat battle-report' },
      h('h3', { class: rep.won ? 'good' : 'bad', style: 'font-size:18px' }, rep.head),
      h('div', null, 'Врагов выбито: ' + rep.enemyDown + (rep.enemyFled ? ', бежали: ' + rep.enemyFled : '') + '. Время боя: ' + (rep.ticks / 10).toFixed(0) + ' с.'),
      list('Погибли', rep.killed, 'bad'),
      list('Тяжело ранены', rep.heavy, 'warn'),
      rep.light ? h('div', null, 'Легко ранены: ' + U.pl(rep.light, F.fighter) + '.') : null,
      rep.promoted && rep.promoted.length ? h('div', { class: 'good' }, 'Повышены в звании: ' + rep.promoted.join(', ') + '.') : null,
      rep.loot ? h('div', null, 'Трофеи: ' + rep.loot + '.') : null,
      rep.afterText ? h('p', { style: 'margin:6px 0 0' }, rep.afterText) : null,
      extra || null);
  }

  // Вид кэшируется, чтобы анимация не сбрасывалась при перерисовке интерфейса
  UI._bv = null;
  function getView(key, res, setup, opts) {
    if (UI._bv && UI._bv.key === key) return UI._bv.view;
    if (UI._bv) UI._bv.view.destroy();
    const view = G.BattleView(Object.assign({ res: res, setup: setup }, opts));
    UI._bv = { key: key, view: view };
    return view;
  }
  function getRes(id, setup) {
    if (G.BattleFlow.lastRun && G.BattleFlow.lastRun.id === id) return G.BattleFlow.lastRun.res;
    const res = G.BattleEngine.run(setup);
    G.BattleFlow.lastRun = { id: id, res: res };
    return res;
  }

  UI.modals.battleResult = function (s) {
    const p = s.pending;
    const res = getRes(p.id, p.setup);
    const reportHolder = h('div');
    const done = () => {
      G.Dom.clear(reportHolder);
      reportHolder.appendChild(reportBlock(p.report));
      reportHolder.appendChild(h('button', { class: 'btn primary big', style: 'margin-top:10px', onclick: () => {
        if (UI._bv) { UI._bv.view.destroy(); UI._bv = null; }
        G.Game.act(s, { action: 'close' });
        UI.commit();
      } }, 'Продолжить'));
    };
    const view = getView('p' + p.id + ':' + s.seed, res, p.setup, { autoplay: !p.quick, startAtEnd: p.quick, onEnd: done });
    if (p.quick || view.ended()) done();
    return h('div', { class: 'modal wide' },
      h('div', { class: 'small muted' }, 'День ' + s.day),
      h('h2', null, p.title),
      view.el,
      reportHolder);
  };

  // Повтор из хроники
  UI.openReplay = function (rp) {
    const res = G.BattleEngine.run(rp.setup);
    const view = getView('r' + rp.id + ':' + rp.day, res, rp.setup, { autoplay: true });
    UI.overlay = () => h('div', { class: 'modal wide' },
      h('div', { class: 'row between' },
        h('div', null, h('div', { class: 'small muted' }, 'Повтор · день ' + rp.day), h('h2', null, rp.title + (rp.won ? ' — победа' : ' — поражение'))),
        h('button', { class: 'btn small', onclick: () => { if (UI._bv) { UI._bv.view.destroy(); UI._bv = null; } UI.overlay = null; UI.render(); } }, '✕ Закрыть')),
      view.el);
    UI.render();
  };

  UI.replaysCard = function (s) {
    const list = s.replays || [];
    return h('div', { class: 'card' },
      h('h2', null, 'Повторы боёв'),
      list.length ? list.map((rp) => h('div', { class: 'row between', style: 'padding:6px 0;border-bottom:1px solid #23262c' },
        h('div', null, h('div', null, rp.title), h('div', { class: 'small ' + (rp.won ? 'good' : 'bad') }, 'день ' + rp.day + ' · ' + (rp.won ? 'победа' : 'поражение'))),
        h('button', { class: 'btn small', onclick: () => UI.openReplay(rp) }, '▶ Смотреть')))
        : h('p', { class: 'muted' }, 'Боёв ещё не было.'));
  };
})(globalThis.G = globalThis.G || {});
