/*
 * Живая сцена лагеря (Canvas): корпус корабля с окнами отсеков, постройки, бойцы и дроиды.
 * Используется в штабе (просмотр) и на вкладке «Лагерь» (стройка).
 * G.CampView(s, { cols: [x0, x1], rows: [y0, y1], maxCell, maxHeight, build: bool, onCell(x, y) })
 */
(function (G) {
  'use strict';
  const { h } = G.Dom;
  const TAU = Math.PI * 2;
  const TERRAIN = { 0: '#b38f58', 1: '#c4a067', 2: '#5e4a36', 3: '#6d737b', 4: '#8b8e93' };

  // Где на корпусе окна отсеков (в клетках поля)
  const WINDOWS = {
    comms: [0.9, 4.3], reactor: [1.2, 6.2], vapor: [2.4, 5.4], medbay: [1.2, 8.0],
    armory: [2.4, 7.2], workshop: [1.2, 9.8], hangar: [2.6, 10.3], sensors: [3.6, 6.0],
  };

  const landing = { key: '', t0: 0, dust: false }; // посадка шаттла — анимация один раз за день
  // Состояние гуляющих бойцов переживает перерисовки интерфейса
  const walkers = new Map();
  const puffs = []; // облачка пыли от новых построек — подхватывает следующий кадр
  let walkersSeed = null;

  function pickWalkers(s) {
    if (walkersSeed !== s.seed) { walkers.clear(); walkersSeed = s.seed; }
    const busy = G.Game.busyIds(s);
    const list = G.Units.alive(s).filter((u) => u.status === 'ok' && (u.kind === 'droid' || G.Units.woundLevel(u) < 2));
    // занятые приказами — в первую очередь (они выстраиваются у выхода), затем остальные
    list.sort((a, b) => (busy.has(b.id) - busy.has(a.id)) || a.id - b.id);
    return list.slice(0, 18);
  }

  function freeCell(s, base, rnd) {
    for (let k = 0; k < 20; k++) {
      const x = 5 + rnd() * 6.8, y = 0.5 + rnd() * 15;
      const cx = Math.floor(x), cy = Math.floor(y);
      if (G.BattleMap.passable(base.cells[cy * base.w + cx]) && !G.Camp.at(s, cx, cy)) return [x, y];
    }
    return [7.5, 7.5];
  }

  G.CampView = function (s, opts) {
    opts = opts || {};
    const cols = opts.cols || [0, 15];
    let rows = opts.rows || [0, 15];
    const W = cols[1] - cols[0] + 1;
    let H = rows[1] - rows[0] + 1;
    const rowsWant = rows.slice();
    const canvas = h('canvas', { class: 'camp-canvas' + (opts.build ? ' build' : '') });
    const ctx = canvas.getContext('2d');
    const wrap = h('div', { class: 'camp-view' }, canvas);
    let cell = 0, staticLayer = null, staticKey = '', hover = null, alive = true, last = 0;
    const particles = [];

    function resize() {
      const avail = Math.max(200, wrap.clientWidth || 600);
      const maxH = opts.maxHeight ? (typeof opts.maxHeight === 'function' ? opts.maxHeight() : opts.maxHeight) : 9999;
      let c = Math.max(8, Math.min(Math.floor(avail / W), Math.floor(maxH / H), opts.maxCell || 40));
      if (opts.fill) {
        // сцена во всю ширину: клетка по ширине, строки — сколько влезает по высоте (вокруг середины)
        c = Math.max(8, Math.min(Math.floor(avail / W), opts.maxCell || 40));
        const lim = opts.fill;
        const n = Math.max(8, Math.min(lim[1] - lim[0] + 1, Math.floor(maxH / c)));
        const mid = (rowsWant[0] + rowsWant[1] + 1) / 2;
        let r0 = Math.round(mid - n / 2);
        r0 = Math.max(lim[0], Math.min(lim[1] - n + 1, r0));
        if (r0 !== rows[0] || n !== H) { rows = [r0, r0 + n - 1]; H = n; cell = 0; }
      }
      if (c === cell) return;
      cell = c;
      const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
      canvas.width = W * c * dpr; canvas.height = H * c * dpr;
      canvas.style.width = W * c + 'px'; canvas.style.height = H * c + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      staticKey = '';
    }

    const px = (x) => (x - cols[0]) * cell;
    const py = (y) => (y - rows[0]) * cell;

    // ---------- неподвижный слой: местность и корпус ----------
    function buildStatic() {
      const base = G.Camp.baseMap(s);
      const key = cell + '|' + rows[0] + '|' + H + '|' + Object.keys(s.sections).map((k) => s.sections[k].level).join('');
      if (key === staticKey && staticLayer) return;
      staticKey = key;
      const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
      staticLayer = document.createElement('canvas');
      staticLayer.width = canvas.width; staticLayer.height = canvas.height;
      const c = staticLayer.getContext('2d');
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.fillStyle = TERRAIN[0];
      c.fillRect(0, 0, W * cell, H * cell);
      // объёмная местность, как в бою: рельеф песка, валуны, обломки
      let painted = false;
      if (G.BattleTerrain) {
        try {
          const cells = base.cells.map((t, i) => ((i % base.w) <= 4 && t === 3 ? 0 : t));
          const tmp = document.createElement('canvas');
          tmp.width = base.w * cell * dpr; tmp.height = base.h * cell * dpr;
          const tc = tmp.getContext('2d');
          tc.setTransform(dpr, 0, 0, dpr, 0, 0);
          G.BattleTerrain(tc, cells, base.w, base.h, cell, 'camp');
          c.drawImage(tmp, -cols[0] * cell, -rows[0] * cell, base.w * cell, base.h * cell);
          painted = true;
        } catch (e) { painted = false; }
      }
      for (let y = rows[0]; y <= rows[1] && !painted; y++) for (let x = cols[0]; x <= cols[1]; x++) {
        const t = base.cells[y * base.w + x];
        const X = px(x), Y = py(y);
        if (x <= 4 && t === 3) continue; // корпус рисуем отдельно
        if (t === 1) {
          c.fillStyle = TERRAIN[1]; c.fillRect(X, Y, cell, cell);
          c.strokeStyle = 'rgba(120,85,40,0.3)'; c.beginPath(); c.moveTo(X + 2, Y + cell * 0.65); c.quadraticCurveTo(X + cell / 2, Y + cell * 0.35, X + cell - 2, Y + cell * 0.65); c.stroke();
        } else if (t === 2) {
          c.fillStyle = TERRAIN[2]; rr(c, X + 1, Y + 1, cell - 2, cell - 2, cell * 0.3); c.fill();
        } else if (t === 3) {
          // мелкие обломки — рваные листы металла
          c.fillStyle = '#6d737b';
          c.beginPath(); c.moveTo(X + cell * 0.1, Y + cell * 0.7); c.lineTo(X + cell * 0.4, Y + cell * 0.15); c.lineTo(X + cell * 0.9, Y + cell * 0.35); c.lineTo(X + cell * 0.75, Y + cell * 0.9); c.closePath(); c.fill();
          c.strokeStyle = 'rgba(0,0,0,0.3)'; c.stroke();
        }
      }
      // следы и тропинки в лагере
      c.strokeStyle = 'rgba(120,90,50,0.18)'; c.lineWidth = cell * 0.35;
      c.beginPath(); c.moveTo(px(5), py(8)); c.quadraticCurveTo(px(9), py(7.6), px(15), py(8.2)); c.stroke();
      c.lineWidth = 1;
      drawHull(c);
    }

    function drawHull(c) {
      if (cols[0] > 4) return;
      const P = (x, y) => [px(x), py(y)];
      const pts = [[-0.5, 3.4], [1.0, 3.7], [1.6, 3.3], [3.3, 3.9], [5.05, 4.9], [5.05, 11.1], [3.3, 12.1], [1.4, 12.5], [0.7, 12.0], [-0.5, 12.6]];
      const path = (list, dx, dy) => { c.beginPath(); list.forEach(([x, y], k) => { const [X, Y] = P(x + (dx || 0), y + (dy || 0)); k ? c.lineTo(X, Y) : c.moveTo(X, Y); }); c.closePath(); };
      const hr2 = (n) => { n = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); n ^= n >>> 13; n = Math.imul(n, 0xc2b2ae35); n ^= n >>> 16; return (n >>> 0) / 4294967296; };
      c.save();
      // тень корпуса на песке — вправо вниз
      c.fillStyle = 'rgba(40,24,10,0.38)';
      path(pts, 0.55, 0.65); c.fill();
      // южный борт: видимая стенка под краем палубы
      const south = [[-0.5, 12.6], [0.7, 12.0], [1.4, 12.5], [3.3, 12.1], [5.05, 11.1]];
      const wall = south.concat(south.slice().reverse().map(([x, y]) => [x, y + 0.55]));
      const wg = c.createLinearGradient(0, py(11.1), 0, py(13.2));
      wg.addColorStop(0, '#4f555c'); wg.addColorStop(1, '#2c3035');
      c.fillStyle = wg; path(wall); c.fill();
      c.strokeStyle = 'rgba(15,17,20,0.6)'; c.lineWidth = Math.max(1, cell * 0.03);
      for (let x = -0.3; x < 5; x += 0.42) { // рёбра борта
        const y = x < 0.7 ? 12.6 - (x + 0.5) * 0.5 : x < 1.4 ? 12.0 + (x - 0.7) * 0.7 : x < 3.3 ? 12.5 - (x - 1.4) * 0.21 : 12.1 - (x - 3.3) * 0.57;
        c.beginPath(); c.moveTo(...P(x, y + 0.04)); c.lineTo(...P(x, y + 0.52)); c.stroke();
      }
      // восточный торец — тонкая грань
      c.fillStyle = '#3c4147'; path([[5.05, 4.9], [5.25, 5.1], [5.25, 11.3], [5.05, 11.1]]); c.fill();
      // палуба: свет слева сверху
      const dg = c.createLinearGradient(px(-0.5), py(3.3), px(5), py(12.6));
      dg.addColorStop(0, '#aab1b8'); dg.addColorStop(0.5, '#848b93'); dg.addColorStop(1, '#5b6168');
      c.fillStyle = dg; path(pts); c.fill();
      c.save(); path(pts); c.clip();
      // плиты обшивки разного тона
      let k = 0;
      for (let y = 3.2; y < 12.7; y += 0.55) for (let x = -0.5; x < 5.1; x += 0.68, k++) {
        const v = hr2(k + 17);
        c.fillStyle = v > 0.5 ? 'rgba(255,255,255,' + ((v - 0.5) * 0.14).toFixed(3) + ')' : 'rgba(0,0,0,' + ((0.5 - v) * 0.16).toFixed(3) + ')';
        c.fillRect(px(x) + 1, py(y) + 1, cell * 0.68 - 2, cell * 0.55 - 2);
      }
      // швы: тёмная линия и светлая фаска
      c.lineWidth = 1;
      for (let y = 3.2; y < 12.7; y += 0.55) {
        c.strokeStyle = 'rgba(25,28,32,0.45)'; c.beginPath(); c.moveTo(px(-0.5), py(y)); c.lineTo(px(5.1), py(y)); c.stroke();
        c.strokeStyle = 'rgba(255,255,255,0.1)'; c.beginPath(); c.moveTo(px(-0.5), py(y) + 1); c.lineTo(px(5.1), py(y) + 1); c.stroke();
      }
      for (let x = -0.5; x < 5.1; x += 1.36) { c.strokeStyle = 'rgba(25,28,32,0.35)'; c.beginPath(); c.moveTo(px(x), py(3.2)); c.lineTo(px(x), py(12.7)); c.stroke(); }
      // продольная траншея с трубами
      c.fillStyle = 'rgba(20,22,26,0.55)'; c.fillRect(px(-0.5), py(8.35), cell * 4.3, cell * 0.32);
      c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(px(-0.5), py(8.67), cell * 4.3, Math.max(1, cell * 0.04));
      c.strokeStyle = '#6a7179'; c.lineWidth = Math.max(1, cell * 0.06);
      c.beginPath(); c.moveTo(px(-0.5), py(8.47)); c.lineTo(px(3.8), py(8.47)); c.moveTo(px(-0.5), py(8.57)); c.lineTo(px(3.8), py(8.57)); c.stroke();
      // надстройки: верх, южная и восточная грани, тень
      const block = (x0, y0, x1, y1, hh) => {
        c.fillStyle = 'rgba(20,14,8,0.35)'; c.fillRect(px(x0 + hh * 0.6), py(y0 + hh * 0.7), cell * (x1 - x0), cell * (y1 - y0));
        c.fillStyle = '#4a5057'; c.fillRect(px(x0), py(y1), cell * (x1 - x0), cell * hh * 0.5);
        c.fillStyle = '#5a6067'; c.fillRect(px(x1), py(y0 + hh * 0.1), cell * hh * 0.25, cell * (y1 - y0 + hh * 0.4));
        const bg = c.createLinearGradient(px(x0), py(y0), px(x1), py(y1));
        bg.addColorStop(0, '#b9c0c6'); bg.addColorStop(1, '#7c838a');
        c.fillStyle = bg; c.fillRect(px(x0), py(y0), cell * (x1 - x0), cell * (y1 - y0));
        c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 1; c.strokeRect(px(x0) + 0.5, py(y0) + 0.5, cell * (x1 - x0) - 1, cell * (y1 - y0) - 1);
        c.strokeStyle = 'rgba(30,34,38,0.35)';
        c.beginPath(); c.moveTo(px(x0), py((y0 + y1) / 2)); c.lineTo(px(x1), py((y0 + y1) / 2)); c.stroke();
      };
      block(0.2, 4.4, 1.9, 5.0, 0.5);
      block(1.9, 6.6, 3.2, 7.6, 0.6);
      block(0.1, 9.3, 1.6, 10.3, 0.45);
      block(2.6, 10.6, 3.8, 11.3, 0.35);
      // броневые купола
      for (const [x, y, r] of [[3.4, 5.4, 0.32], [0.9, 7.4, 0.26], [3.0, 9.4, 0.3]]) {
        c.fillStyle = 'rgba(20,14,8,0.35)'; c.beginPath(); c.ellipse(px(x + 0.12), py(y + 0.14), cell * r, cell * r * 0.8, 0, 0, TAU); c.fill();
        const rg = c.createRadialGradient(px(x - r * 0.35), py(y - r * 0.35), 1, px(x), py(y), cell * r);
        rg.addColorStop(0, '#dfe4e8'); rg.addColorStop(0.6, '#8d949b'); rg.addColorStop(1, '#4a5056');
        c.fillStyle = rg; c.beginPath(); c.arc(px(x), py(y), cell * r, 0, TAU); c.fill();
        c.strokeStyle = '#2a2e35'; c.lineWidth = Math.max(1, cell * 0.05);
        c.beginPath(); c.moveTo(px(x), py(y)); c.lineTo(px(x + r * 1.6), py(y - r * 0.3)); c.stroke();
      }
      // пробоины: копоть, рваные края, оголённые рёбра
      for (const [x, y, r] of [[0.4, 5.6, 0.55], [3.9, 11.4, 0.45], [0.5, 11.3, 0.6], [4.4, 6.1, 0.35]]) {
        const sg = c.createRadialGradient(px(x), py(y), 1, px(x), py(y), cell * r * 2.2);
        sg.addColorStop(0, 'rgba(15,12,10,0.75)'); sg.addColorStop(0.5, 'rgba(30,24,20,0.35)'); sg.addColorStop(1, 'rgba(30,24,20,0)');
        c.fillStyle = sg; c.beginPath(); c.arc(px(x), py(y), cell * r * 2.2, 0, TAU); c.fill();
        const hg = c.createRadialGradient(px(x), py(y), 1, px(x), py(y), cell * r);
        hg.addColorStop(0, 'rgba(255,120,40,0.35)'); hg.addColorStop(0.35, '#1a1512'); hg.addColorStop(1, '#2b2622');
        c.fillStyle = hg;
        c.beginPath();
        for (let e = 0; e < 9; e++) { const a = e / 9 * TAU, rr2 = cell * r * (0.55 + hr2(x * 31 + y * 7 + e) * 0.5); const X = px(x) + Math.cos(a) * rr2, Y = py(y) + Math.sin(a) * rr2 * 0.8; e ? c.lineTo(X, Y) : c.moveTo(X, Y); }
        c.closePath(); c.fill();
        c.strokeStyle = '#5a5f66'; c.lineWidth = Math.max(1, cell * 0.04);
        for (let e = 0; e < 3; e++) { c.beginPath(); c.moveTo(px(x - r * 0.5), py(y - r * 0.3 + e * r * 0.3)); c.lineTo(px(x + r * 0.5), py(y - r * 0.2 + e * r * 0.3)); c.stroke(); }
      }
      c.restore();
      // контур
      c.strokeStyle = '#22262b'; c.lineWidth = Math.max(1, cell * 0.06); path(pts); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(...P(-0.5, 3.45)); c.lineTo(...P(1.0, 3.75)); c.lineTo(...P(1.6, 3.35)); c.lineTo(...P(3.3, 3.95)); c.lineTo(...P(5.0, 4.95)); c.stroke();
      // песок наметён к борту
      for (const [x, y, r] of [[0.2, 12.5, 0.9], [2.3, 12.4, 0.8], [4.6, 11.4, 0.6], [-0.2, 3.6, 0.7], [2.4, 3.7, 0.6]]) {
        const sg = c.createRadialGradient(px(x), py(y), 1, px(x), py(y), cell * r);
        sg.addColorStop(0, 'rgba(206,168,110,0.95)'); sg.addColorStop(0.6, 'rgba(196,158,100,0.6)'); sg.addColorStop(1, 'rgba(196,158,100,0)');
        c.fillStyle = sg; c.beginPath(); c.ellipse(px(x), py(y), cell * r, cell * r * 0.55, 0, 0, TAU); c.fill();
      }
      // шлюз в восточном торце
      c.fillStyle = '#1b1d21'; c.fillRect(px(4.2), py(7), cell * 0.85, cell * 2);
      c.strokeStyle = '#3c4147'; c.lineWidth = Math.max(1, cell * 0.05); c.strokeRect(px(4.2), py(7), cell * 0.85, cell * 2);
      const lg = c.createLinearGradient(px(4.35), 0, px(5.05), 0);
      lg.addColorStop(0, 'rgba(255,210,120,0.55)'); lg.addColorStop(1, 'rgba(255,210,120,0.1)');
      c.fillStyle = lg; c.fillRect(px(4.35), py(7.15), cell * 0.55, cell * 1.7);
      // свет из шлюза на песок
      const og = c.createRadialGradient(px(5.3), py(8), 1, px(5.3), py(8), cell * 1.4);
      og.addColorStop(0, 'rgba(255,215,140,0.3)'); og.addColorStop(1, 'rgba(255,215,140,0)');
      c.fillStyle = og; c.beginPath(); c.ellipse(px(5.6), py(8), cell * 1.4, cell * 0.9, 0, 0, TAU); c.fill();
      c.restore();
    }

    // ---------- анимированные части корпуса ----------
    function drawWindows(t) {
      if (cols[0] > 4) return;
      for (const id in WINDOWS) {
        const [x, y] = WINDOWS[id];
        const lv = s.sections[id] ? s.sections[id].level : 0;
        const X = px(x), Y = py(y), w = cell * 0.7, hh = cell * 0.36;
        if (id === 'comms') {
          // антенная мачта
          if (lv >= 1) {
            ctx.strokeStyle = '#2a2e35'; ctx.lineWidth = Math.max(1, cell * 0.06);
            ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X, Y - cell * 1.3); ctx.stroke();
            ctx.beginPath(); ctx.ellipse(X, Y - cell * 1.3, cell * 0.35 * Math.abs(Math.cos(t * 0.8)), cell * 0.12, 0, 0, TAU); ctx.stroke();
            if (Math.sin(t * 4) > 0) { ctx.fillStyle = s.signal ? '#7cff9a' : '#ff4d3d'; ctx.beginPath(); ctx.arc(X, Y - cell * 1.35, cell * 0.08, 0, TAU); ctx.fill(); }
          }
          continue;
        }
        if (id === 'sensors') {
          if (lv >= 1) {
            ctx.fillStyle = '#c9ccd1'; ctx.beginPath(); ctx.ellipse(X, Y, cell * 0.3 * Math.abs(Math.cos(t * 1.4)) + 2, cell * 0.3, 0, 0, TAU); ctx.fill();
          }
          continue;
        }
        ctx.fillStyle = '#15171a'; rr(ctx, X - w / 2, Y - hh / 2, w, hh, 2); ctx.fill();
        if (lv > 0) {
          const flick = 0.75 + 0.25 * Math.sin(t * 3 + x * 7);
          const ga = (0.18 + 0.12 * flick) * Math.min(1, lv / 2 + 0.3);
          const halo = ctx.createRadialGradient(X, Y, 1, X, Y, cell * 0.9);
          halo.addColorStop(0, 'rgba(255,205,110,' + ga.toFixed(3) + ')'); halo.addColorStop(1, 'rgba(255,205,110,0)');
          ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(X, Y, cell * 0.9, 0, TAU); ctx.fill();
          ctx.fillStyle = 'rgba(255,205,110,' + (0.55 + 0.35 * flick * Math.min(1, lv / 2)).toFixed(2) + ')';
          rr(ctx, X - w / 2 + 1.5, Y - hh / 2 + 1.5, w - 3, hh - 3, 1.5); ctx.fill();
          ctx.fillStyle = 'rgba(255,250,230,0.5)'; ctx.fillRect(X - w / 2 + 2, Y - hh / 2 + 2, w - 4, Math.max(1, hh * 0.18));
        } else if (Math.random() < 0.02) {
          sparks(X, Y);
        }
      }
      // навигационные огни по углам корпуса
      for (const [x, y, col, ph] of [[5.0, 5.0, '255,80,60', 0], [5.0, 11.0, '120,255,150', 1.3], [1.6, 3.4, '255,255,255', 2.1]]) {
        const on = Math.sin(t * 2.2 + ph) > 0.55;
        if (!on) continue;
        const X = px(x), Y = py(y);
        const g = ctx.createRadialGradient(X, Y, 0, X, Y, cell * 0.45);
        g.addColorStop(0, 'rgba(' + col + ',0.9)'); g.addColorStop(1, 'rgba(' + col + ',0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X, Y, cell * 0.45, 0, TAU); ctx.fill();
      }
      // дым из повреждённого реактора
      if (s.sections.reactor.level <= 1 && Math.random() < 0.08) particles.push({ x: px(1.2), y: py(5.6), vx: 4 + Math.random() * 6, vy: -8 - Math.random() * 6, life: 2.5, max: 2.5, kind: 'smoke' });
    }
    function sparks(X, Y) {
      for (let k = 0; k < 4; k++) particles.push({ x: X, y: Y, vx: (Math.random() - 0.5) * 40, vy: -Math.random() * 30, life: 0.4, max: 0.4, kind: 'spark' });
    }

    // ---------- шаттл с поставкой: садится на площадку в день прибытия ----------
    function drawShuttle(ts) {
      const L = s.terminal && s.terminal.landed;
      if (!L || L.day !== s.day || !G.drawShuttle) return;
      const key = s.seed + ':' + s.day;
      if (landing.key !== key) { landing.key = key; landing.t0 = ts; landing.dust = false; }
      const k = Math.min(1, (ts - landing.t0) / 2600), e = 1 - Math.pow(1 - k, 3);
      const X = px(17.5), Y = py(8.2), len = cell * 2.6;
      // посадочные огни площадки
      ctx.fillStyle = 'rgba(40,30,20,0.25)'; ctx.beginPath(); ctx.ellipse(X, Y + cell * 0.2, cell * 1.9, cell * 1.3, 0, 0, TAU); ctx.fill();
      for (let j = 0; j < 8; j++) {
        const a = j / 8 * TAU, on = Math.sin(ts / 300 - j) > 0;
        ctx.fillStyle = on ? 'rgba(255,200,90,0.9)' : 'rgba(120,90,40,0.6)';
        ctx.beginPath(); ctx.arc(X + Math.cos(a) * cell * 1.7, Y + cell * 0.2 + Math.sin(a) * cell * 1.15, Math.max(1.2, cell * 0.06), 0, TAU); ctx.fill();
      }
      // тень растёт по мере снижения
      ctx.fillStyle = 'rgba(30,18,8,' + (0.15 + 0.25 * e).toFixed(3) + ')';
      ctx.beginPath(); ctx.ellipse(X + cell * 0.5 * (1 - e) + cell * 0.25, Y + cell * 0.35, len * 0.42 * (0.7 + 0.3 * e), len * 0.3 * (0.7 + 0.3 * e), 0, 0, TAU); ctx.fill();
      if (k >= 0.92 && !landing.dust) {
        landing.dust = true;
        for (let j = 0; j < 22; j++) { const a = j / 22 * TAU; particles.push({ x: X, y: Y + cell * 0.3, vx: Math.cos(a) * 60, vy: Math.sin(a) * 30, life: 1.2, max: 1.2, kind: 'dust' }); }
      }
      G.drawShuttle(ctx, X, Y - (1 - e) * cell * 3.2, len, { scale: 1 + (1 - e) * 0.35, engines: k < 1 ? 1 : 0.25 + 0.1 * Math.sin(ts / 200), ramp: k < 1 ? 0 : Math.min(1, (ts - landing.t0 - 2600) / 800), blink: Math.sin(ts / 250) > 0 });
    }

    // ---------- постройки ----------
    function drawItem(it, t) {
      const X = px(it.x) + cell / 2, Y = py(it.y) + cell / 2;
      const c = cell;
      ctx.save();
      switch (it.t) {
        case 'wall':
          ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(X - c * 0.45, Y + c * 0.08, c * 0.92, c * 0.22);
          ctx.fillStyle = '#8b8e93'; rr(ctx, X - c * 0.46, Y - c * 0.2, c * 0.92, c * 0.36, c * 0.08); ctx.fill();
          ctx.strokeStyle = 'rgba(40,45,52,0.5)'; ctx.beginPath(); ctx.moveTo(X - c * 0.15, Y - c * 0.2); ctx.lineTo(X - c * 0.15, Y + c * 0.16); ctx.moveTo(X + c * 0.18, Y - c * 0.2); ctx.lineTo(X + c * 0.18, Y + c * 0.16); ctx.stroke();
          break;
        case 'turret':
          G.Sprites.draw(ctx, 'turret', X, Y + c * 0.32, c, { t: t, facing: 1, aim: Math.sin(t * 0.7 + it.id) * 0.5, recoil: 0, side: 0, seed: it.id });
          break;
        case 'vapor':
          ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(X, Y + c * 0.32, c * 0.26, c * 0.1, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#e9ecef'; ctx.strokeStyle = '#2a2e35'; rr(ctx, X - c * 0.16, Y - c * 0.55, c * 0.32, c * 0.88, c * 0.08); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#9aa3ad'; ctx.fillRect(X - c * 0.16, Y - c * 0.25, c * 0.32, c * 0.06); ctx.fillRect(X - c * 0.16, Y + c * 0.05, c * 0.32, c * 0.06);
          ctx.fillStyle = '#c9ccd1'; ctx.beginPath(); ctx.ellipse(X, Y - c * 0.56, c * 0.22, c * 0.07, 0, 0, TAU); ctx.fill();
          if (Math.random() < 0.06) particles.push({ x: X, y: Y - c * 0.6, vx: 3, vy: -10, life: 1.6, max: 1.6, kind: 'steam' });
          break;
        case 'panel':
          ctx.fillStyle = '#2a2e35'; ctx.fillRect(X - c * 0.04, Y, c * 0.08, c * 0.3);
          ctx.fillStyle = '#23406e'; ctx.beginPath(); ctx.moveTo(X - c * 0.45, Y - c * 0.05); ctx.lineTo(X + c * 0.35, Y - c * 0.32); ctx.lineTo(X + c * 0.45, Y + c * 0.05); ctx.lineTo(X - c * 0.35, Y + c * 0.32); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = 'rgba(160,200,255,0.35)'; ctx.stroke();
          { const g = ((t * 0.4 + it.id * 0.37) % 1.6) - 0.3; if (g > 0 && g < 1) { ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = c * 0.06; ctx.beginPath(); ctx.moveTo(X - c * 0.45 + g * c * 0.8, Y - c * 0.05 - g * c * 0.27); ctx.lineTo(X - c * 0.35 + g * c * 0.8, Y + c * 0.32 - g * c * 0.27); ctx.stroke(); } }
          break;
        case 'tent':
          ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(X, Y + c * 0.3, c * 0.45, c * 0.12, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = '#9a8a5c'; ctx.strokeStyle = '#4a3f22';
          ctx.beginPath(); ctx.moveTo(X - c * 0.46, Y + c * 0.3); ctx.lineTo(X, Y - c * 0.42); ctx.lineTo(X + c * 0.46, Y + c * 0.3); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#3a3320'; ctx.beginPath(); ctx.moveTo(X - c * 0.12, Y + c * 0.3); ctx.lineTo(X, Y - c * 0.05); ctx.lineTo(X + c * 0.12, Y + c * 0.3); ctx.closePath(); ctx.fill();
          { const flap = Math.sin(t * 2 + it.id) * c * 0.03; ctx.strokeStyle = '#c84a32'; ctx.beginPath(); ctx.moveTo(X, Y - c * 0.42); ctx.lineTo(X + c * 0.18, Y - c * 0.5 + flap); ctx.stroke(); }
          break;
        case 'mast':
          ctx.strokeStyle = '#2a2e35'; ctx.lineWidth = Math.max(1, c * 0.07);
          ctx.beginPath(); ctx.moveTo(X, Y + c * 0.3); ctx.lineTo(X, Y - c * 0.9); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(X - c * 0.25, Y + c * 0.3); ctx.lineTo(X, Y - c * 0.3); ctx.lineTo(X + c * 0.25, Y + c * 0.3); ctx.stroke();
          ctx.fillStyle = '#c9ccd1'; ctx.beginPath(); ctx.ellipse(X, Y - c * 0.9, c * 0.32 * Math.abs(Math.cos(t * 1.2 + it.id)) + 1.5, c * 0.14, 0, 0, TAU); ctx.fill();
          if (Math.sin(t * 5 + it.id) > 0.6) { ctx.fillStyle = '#ff4d3d'; ctx.beginPath(); ctx.arc(X, Y - c * 1.0, c * 0.06, 0, TAU); ctx.fill(); }
          break;
        case 'lamp':
          ctx.strokeStyle = '#2a2e35'; ctx.lineWidth = Math.max(1, c * 0.07);
          ctx.beginPath(); ctx.moveTo(X, Y + c * 0.3); ctx.lineTo(X, Y - c * 0.55); ctx.stroke();
          ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(X + c * 0.08, Y - c * 0.58, c * 0.11, 0, TAU); ctx.fill();
          ctx.fillStyle = 'rgba(255,233,168,' + (0.12 + 0.06 * Math.sin(t * 2 + it.id)).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(X + c * 0.08, Y - c * 0.58, c * 0.5, 0, TAU); ctx.fill();
          break;
      }
      ctx.restore();
    }

    // ---------- бойцы и дроиды ----------
    function updateWalkers(dt, t) {
      const base = G.Camp.baseMap(s);
      const units = pickWalkers(s);
      const busy = G.Game.busyIds(s);
      const orderOf = new Map();
      s.orders.forEach((o, k) => (o.unitIds || []).forEach((id, j) => orderOf.set(id, [k, j])));
      const seen = new Set();
      for (const u of units) {
        seen.add(u.id);
        let w = walkers.get(u.id);
        if (!w) {
          const [x, y] = freeCell(s, base, Math.random);
          w = { x: x, y: y, tx: x, ty: y, wait: Math.random() * 3, face: 1 };
          walkers.set(u.id, w);
        }
        w.u = u;
        if (busy.has(u.id)) {
          // отряд строится у выхода из лагеря колонной
          const [k, j] = orderOf.get(u.id);
          w.tx = 12.6 + k * 0.9 + (j % 2) * 0.45; w.ty = 1.2 + k * 0.6 + j * 0.55;
          if (w.ty > 15) w.ty = 15 - (j % 6) * 0.5;
          w.wait = 0;
        } else if (w.wait > 0) {
          w.wait -= dt;
        } else if (Math.hypot(w.tx - w.x, w.ty - w.y) < 0.05) {
          const [x, y] = freeCell(s, base, Math.random);
          w.tx = x; w.ty = y; w.wait = 1 + Math.random() * 4;
        }
        const dx = w.tx - w.x, dy = w.ty - w.y, d = Math.hypot(dx, dy);
        const sp = (u.kind === 'droid' ? 0.6 : 0.9) * (busy.has(u.id) ? 1.6 : 1);
        w.moving = d > 0.05 && !(w.wait > 0 && !busy.has(u.id));
        if (w.moving) {
          const step = Math.min(d, sp * dt);
          w.x += dx / d * step; w.y += dy / d * step;
          if (Math.abs(dx) > 0.02) w.face = dx > 0 ? 1 : -1;
        } else if (busy.has(u.id)) w.face = 1;
      }
      for (const id of Array.from(walkers.keys())) if (!seen.has(id)) walkers.delete(id);
    }

    // ---------- кадр ----------
    function frame(ts) {
      if (!alive) return;
      if (!wrap.isConnected) { if (last) { alive = false; return; } requestAnimationFrame(frame); return; }
      const dt = last ? Math.min(0.1, (ts - last) / 1000) : 0;
      last = ts;
      const t = ts / 1000;
      resize();
      buildStatic();
      ctx.clearRect(0, 0, W * cell, H * cell);
      ctx.drawImage(staticLayer, 0, 0, W * cell, H * cell);
      if (opts.build) drawBuildGrid();
      drawWindows(t);
      drawShuttle(ts);
      updateWalkers(dt, t);
      // постройки и фигурки — по глубине
      const things = [];
      for (const it of G.Camp.ensure(s).items) if (it.x >= cols[0] && it.x <= cols[1] && it.y >= rows[0] && it.y <= rows[1]) things.push({ y: it.y + 0.5, it: it });
      for (const w of walkers.values()) if (w.x >= cols[0] && w.x <= cols[1] + 1 && w.y >= rows[0] && w.y <= rows[1] + 1) things.push({ y: w.y, w: w });
      things.sort((a, b) => a.y - b.y);
      for (const th of things) {
        if (th.it) drawItem(th.it, t);
        else {
          const w = th.w;
          G.Sprites.draw(ctx, G.BattleFlow.unitType(w.u), px(w.x), py(w.y), cell, { t: t, facing: w.face, moving: w.moving, aim: 0, recoil: 0, melee: 0, hit: 0, dead: 0, side: 0, rank: G.Units.rankIndex(w.u), seed: w.u.id * 13 });
        }
      }
      while (puffs.length) {
        const [X, Y] = puffs.shift();
        for (let k = 0; k < 12; k++) particles.push({ x: px(X) + cell / 2, y: py(Y) + cell / 2, vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.7) * 50, life: 0.8, max: 0.8, kind: 'dust' });
      }
      drawParticles(dt);
      if (opts.build) drawHover();
      requestAnimationFrame(frame);
    }

    function drawParticles(dt) {
      for (let k = particles.length - 1; k >= 0; k--) {
        const p = particles[k];
        p.life -= dt;
        if (p.life <= 0) { particles.splice(k, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt;
        const a = p.life / p.max;
        if (p.kind === 'spark') { ctx.fillStyle = 'rgba(255,210,120,' + a.toFixed(2) + ')'; ctx.fillRect(p.x, p.y, 2, 2); }
        else { ctx.fillStyle = (p.kind === 'smoke' ? 'rgba(60,60,64,' : p.kind === 'dust' ? 'rgba(210,180,130,' : 'rgba(240,245,250,') + (0.35 * a).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(p.x, p.y, cell * (0.15 + (1 - a) * 0.35), 0, TAU); ctx.fill(); }
      }
      if (particles.length > 160) particles.splice(0, particles.length - 160);
    }

    // ---------- стройка ----------
    function drawBuildGrid() {
      const z = G.CONFIG.camp.zone;
      const base = G.Camp.baseMap(s);
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1;
      for (let y = rows[0]; y <= rows[1]; y++) for (let x = Math.max(z.x0, cols[0]); x <= Math.min(z.x1, cols[1]); x++) {
        if (!G.BattleMap.passable(base.cells[y * base.w + x])) continue;
        ctx.strokeRect(px(x) + 0.5, py(y) + 0.5, cell - 1, cell - 1);
      }
      ctx.strokeStyle = 'rgba(243,205,140,0.6)'; ctx.setLineDash([4, 4]);
      ctx.strokeRect(px(z.x0), py(rows[0]), (z.x1 - z.x0 + 1) * cell, H * cell);
      ctx.setLineDash([]);
    }
    function drawHover() {
      const sel = G.UI.campSel;
      if (sel && sel.id) {
        const it = G.Camp.ensure(s).items.find((i) => i.id === sel.id);
        if (it) { ctx.strokeStyle = '#f3cd8c'; ctx.lineWidth = 2; ctx.strokeRect(px(it.x) + 1, py(it.y) + 1, cell - 2, cell - 2); }
      }
      if (!hover || !sel || !sel.t) return;
      const err = G.Camp.canBuild(s, sel.t, hover[0], hover[1]);
      ctx.fillStyle = err ? 'rgba(226,87,76,0.35)' : 'rgba(124,194,135,0.35)';
      ctx.fillRect(px(hover[0]), py(hover[1]), cell, cell);
      if (!err) { ctx.globalAlpha = 0.6; drawItem({ t: sel.t, x: hover[0], y: hover[1], id: 0 }, performance.now() / 1000); ctx.globalAlpha = 1; }
    }
    function cellAt(ev) {
      const r = canvas.getBoundingClientRect();
      const x = Math.floor((ev.clientX - r.left) / cell) + cols[0];
      const y = Math.floor((ev.clientY - r.top) / cell) + rows[0];
      return x >= cols[0] && x <= cols[1] && y >= rows[0] && y <= rows[1] ? [x, y] : null;
    }
    if (opts.build) {
      canvas.addEventListener('pointermove', (ev) => { hover = cellAt(ev); });
      canvas.addEventListener('pointerleave', () => { hover = null; });
      canvas.addEventListener('click', (ev) => {
        const c = cellAt(ev);
        if (!c) return;
        hover = c;
        if (opts.onCell) opts.onCell(c[0], c[1]);
      });
    }

    requestAnimationFrame(frame);
    return { el: wrap, stop() { alive = false; } };
  };
  G.CampView.puff = (x, y) => puffs.push([x, y]);

  function rr(c, x, y, w, hh, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + hh, r);
    c.arcTo(x + w, y + hh, x, y + hh, r);
    c.arcTo(x, y + hh, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
})(globalThis.G = globalThis.G || {});
