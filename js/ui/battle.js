/* Автобой в интерфейсе: подготовка, живой бой на Canvas с приказами генерала, итоги, повторы. */
(function (G) {
  'use strict';
  const { h, svg } = G.Dom;
  const U = G.U;
  const F = U.FORMS;
  const UI = G.UI = G.UI || {};
  UI.modals = UI.modals || {};
  const TAU = Math.PI * 2;

  const BOLT = { 0: '#ff4d3d', tusken: '#f3e9c9', tusken_camp: '#f3e9c9', jawa: '#7cc0ff', krayt: '#ffd27a', default: '#8dff7a' };
  const TERRAIN = { 0: '#b38f58', 1: '#c4a067', 2: '#5e4a36', 3: '#6d737b', 4: '#8b8e93' };
  const METAL = new Set(['droid', 'walker', 'turret', 'scav_droid', 'assassin_droid']);
  const ORDER_ICON = { focus: '⌖', hold: '⛨', smoke: '☁', rush: '➤', grenade: '✸', medkit: '✚', retreat: '↩' };
  const FX_BANNER = { nade: 'Термодетонатор!', cry: 'Боевой клич!', roar: 'Рёв дракона!', retreat: 'Отход!' };

  // Скорость просмотра боя запоминается (по умолчанию ×2 — динамичнее)
  UI.battleSpeed = function (v) {
    try {
      if (v) localStorage.setItem('kolrat.speed', String(v));
      return Number(localStorage.getItem('kolrat.speed')) || 2;
    } catch (e) { return v || 2; }
  };

  // Псевдослучайное число по номеру события — разлёт искр и осколков без хранения состояния
  function hr(n) {
    n = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); n ^= n >>> 13;
    n = Math.imul(n, 0xc2b2ae35); n ^= n >>> 16;
    return (n >>> 0) / 4294967296;
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

  // Местность: песок, дюны, скалы, обломки, баррикады
  function drawTerrain(c, cells, W, H, cell) {
    c.fillStyle = TERRAIN[0];
    c.fillRect(0, 0, W * cell, H * cell);
    // лёгкая рябь песка
    c.fillStyle = 'rgba(255,240,200,0.06)';
    for (let k = 0; k < W * H / 3; k++) c.fillRect(hr(k) * W * cell, hr(k + 999) * H * cell, cell * 0.5, 1);
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
        c.fillStyle = 'rgba(0,0,0,0.22)';
        roundRect(c, px + 2, py + 3, cell - 2, cell - 2, cell * 0.3); c.fill();
        c.fillStyle = TERRAIN[2];
        roundRect(c, px + 1, py + 1, cell - 2, cell - 2, cell * 0.3);
        c.fill();
        c.fillStyle = 'rgba(255,255,255,0.08)';
        c.fillRect(px + cell * 0.2, py + cell * 0.2, cell * 0.35, cell * 0.2);
      } else if (t === 3) {
        c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(px + 2, py + 3, cell - 2, cell - 2);
        c.fillStyle = TERRAIN[3];
        c.fillRect(px + 0.5, py + 0.5, cell - 1, cell - 1);
        c.strokeStyle = 'rgba(0,0,0,0.35)';
        c.beginPath();
        c.moveTo(px + 2, py + cell / 2); c.lineTo(px + cell - 2, py + cell / 2);
        c.moveTo(px + cell / 2, py + 2); c.lineTo(px + cell / 2, py + cell / 2);
        c.stroke();
        c.fillStyle = 'rgba(160,80,40,0.35)'; c.fillRect(px + cell * 0.6, py + cell * 0.6, cell * 0.25, cell * 0.2);
      } else if (t === 4) {
        c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(px + 2, py + cell * 0.36, cell - 2, cell * 0.4);
        c.fillStyle = TERRAIN[4];
        c.fillRect(px + 1, py + cell * 0.3, cell - 2, cell * 0.4);
      }
    }
    c.strokeStyle = 'rgba(0,0,0,0.05)';
    for (let x = 1; x < W; x++) { c.beginPath(); c.moveTo(x * cell, 0); c.lineTo(x * cell, H * cell); c.stroke(); }
    for (let y = 1; y < H; y++) { c.beginPath(); c.moveTo(0, y * cell); c.lineTo(W * cell, y * cell); c.stroke(); }
  }

  function drawBarrel(c, x, y, cell) {
    const w = cell * 0.46, hh = cell * 0.58;
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(x, y + hh * 0.48, w * 0.6, w * 0.22, 0, 0, TAU); c.fill();
    c.fillStyle = '#b5482e'; c.fillRect(x - w / 2, y - hh / 2, w, hh);
    c.fillStyle = '#8a321f'; c.fillRect(x - w / 2, y - hh * 0.18, w, hh * 0.1); c.fillRect(x - w / 2, y + hh * 0.18, w, hh * 0.1);
    c.fillStyle = '#e7c34a'; c.fillRect(x - w * 0.15, y - hh * 0.08, w * 0.3, hh * 0.16);
    c.fillStyle = '#d0644a'; c.beginPath(); c.ellipse(x, y - hh / 2, w / 2, w * 0.2, 0, 0, TAU); c.fill();
  }

  // ================= ПРОСМОТР И ЖИВОЙ БОЙ =================
  // opts: setup, live (можно отдавать приказы), autoplay, startAtEnd, onFinish(cmds), onEnd()
  G.BattleView = function (opts) {
    const E = G.BattleEngine;
    const C = G.CONFIG.battle;
    const tps = C.playbackTps;
    const setup = U.clone(opts.setup);
    let live = !!opts.live;
    const lamps = ((setup.map && setup.map.layout) || []).filter((it) => it.t === 'lamp');
    const st = { tick: 0, playing: opts.autoplay !== false, speed: UI.battleSpeed(), shownLog: 0, ended: false, destroyed: false, last: 0,
      sel: -1, fxShown: 0, auto: true, armRetreat: 0, finished: false, skip: false };
    let B, N, shotsBy, hitsOn, deathTick, shotI, frameI, decalShot, decalBoom, ranks, facing;
    const nums = [];

    // ---------- DOM ----------
    const canvas = h('canvas', { class: 'bv-canvas' });
    const ctx = canvas.getContext('2d');
    const banner = h('div', { class: 'bv-banner' });
    const sideEl = (cls) => { const b = h('b'), i = h('i'); return { el: h('div', { class: 'bv-side ' + cls }, b, h('span', { class: 'bv-bar' }, i)), b: b, i: i, last: '' }; };
    const hudOurs = sideEl('ours'), hudFoe = sideEl('foe');
    const timeEl = h('span', { class: 'bv-time mono' });
    const tip = h('div', { class: 'bv-tip' });
    const stage = h('div', { class: 'bv-stage' }, h('div', { class: 'bv-inner' }, canvas, h('div', { class: 'bv-hud' }, hudOurs.el, timeEl, hudFoe.el), banner, tip));
    const playBtn = h('button', { class: 'btn small', onclick: () => {
      if (st.ended) { restart(); st.playing = true; } else st.playing = !st.playing;
      syncBtns();
    } });
    const speedBtns = [1, 2, 4].map((sp) => h('button', { class: 'btn small', onclick: () => { st.speed = sp; UI.battleSpeed(sp); syncBtns(); } }, '×' + sp));
    const skipBtn = h('button', { class: 'btn small', title: 'К итогам', onclick: () => { if (!st.ended) { st.skip = true; st.playing = true; syncBtns(); } } }, '⏭');
    const logEl = h('div', { class: 'bv-log' });
    const reportEl = h('div', { class: 'bv-report' });
    const ordersEl = h('div', { class: 'bv-orders' });
    const panel = h('div', { class: 'bv-panel' }, ordersEl, h('div', { class: 'row bv-controls' }, playBtn, h('div', { class: 'seg' }, speedBtns), skipBtn), logEl, reportEl);
    const root = h('div', { class: 'bv' + (live ? ' live' : '') }, stage, panel);

    function syncBtns() {
      playBtn.textContent = st.ended ? '↺' : st.playing ? '❚❚' : '▶';
      speedBtns.forEach((b, i) => b.classList.toggle('sel', [1, 2, 4][i] === st.speed));
      skipBtn.disabled = st.ended;
    }

    // ---------- приказы во время боя ----------
    const orderBtns = [];
    function buildOrders() {
      G.Dom.clear(ordersEl);
      orderBtns.length = 0;
      if (!live) return;
      const add = (id, cls, icon, name) => {
        const el = h('button', { class: 'ob ' + cls, onclick: () => press(id) }, h('span', { class: 'oi' }, icon), h('span', { class: 'on' }, name));
        orderBtns.push({ id: id, el: el });
        ordersEl.appendChild(el);
      };
      for (const id of setup.sides[0].orders) add(id, 'ord', ORDER_ICON[id] || '•', G.TEXT.battleOrders[id].short || G.TEXT.battleOrders[id].name);
      add('retreat', 'ret', '↩', 'Отход');
      add('auto', 'auto', 'А', 'Сами');
    }
    function press(id) {
      if (!live || !B || B.over) return;
      if (id === 'auto') { st.auto = !st.auto; E.command(B, 'auto', st.auto ? 1 : 0); return; }
      if (id === 'retreat') {
        if (B.sides[0].retreating) return;
        const now = performance.now();
        if (!st.armRetreat || now - st.armRetreat > 2500) { st.armRetreat = now; return; }
        st.armRetreat = 0;
        E.command(B, 'retreat');
      } else {
        if (E.orderWait(B, id) > 0) return;
        E.command(B, id);
      }
      if (!st.playing) { st.playing = true; syncBtns(); }
    }
    function syncOrders() {
      for (const ob of orderBtns) {
        const el = ob.el;
        if (ob.id === 'auto') { el.classList.toggle('on', st.auto); el.title = st.auto ? 'Штаб отдаёт приказы сам' : 'Приказы — только по кнопкам'; continue; }
        if (ob.id === 'retreat') {
          const armed = st.armRetreat && performance.now() - st.armRetreat < 2500;
          el.classList.toggle('armed', !!armed);
          el.lastChild.textContent = armed ? 'Точно?' : 'Отход';
          el.disabled = B.over || B.sides[0].retreating;
          continue;
        }
        const wait = E.orderWait(B, ob.id);
        el.disabled = B.over || wait > 0;
        el.style.setProperty('--cd', (wait > 0 ? (wait / C.orders[ob.id].cd) * 360 : 0).toFixed(0) + 'deg');
      }
    }

    // ---------- движок ----------
    function start(cmds) {
      const sup = U.clone(setup);
      if (cmds) sup.cmds = cmds;
      B = E.init(sup);
      N = B.units.length;
      shotsBy = Array.from({ length: N }, () => []);
      hitsOn = Array.from({ length: N }, () => []);
      deathTick = new Array(N).fill(-1);
      shotI = 0; frameI = 0; decalShot = 0; decalBoom = 0;
      st.fxShown = 0; st.shownLog = 0; st.tick = 0; st.ended = false; st.sel = -1;
      ranks = sup.sides[0].units.map((e) => e.rank || 0);
      facing = B.units.map((u) => (u.side === 0 ? 1 : -1));
      G.Dom.clear(logEl);
      if (decalCtx) decalCtx.clearRect(0, 0, decalCanvas.width, decalCanvas.height);
      if (terrainCanvas) drawTerrainLayer();
    }
    function restart() {
      // повтор живого боя: те же команды, без управления
      const cmds = B.cmds.map((c) => c.slice());
      if (live || st.finished) { live = false; root.classList.remove('live'); buildOrders(); }
      start(cmds);
    }
    function ensure(T) {
      while (!B.over && B.t < T + 1) E.tick(B);
      for (; shotI < B.shots.length; shotI++) {
        const sh = B.shots[shotI];
        if (!sh[6]) shotsBy[sh[1]].push(sh);
        if (sh[3]) hitsOn[sh[2]].push(sh[0]);
      }
      for (; frameI < B.frames.length; frameI++) {
        const fr = B.frames[frameI];
        for (let i = 0; i < N; i++) if (deathTick[i] < 0 && (fr[i * 4 + 3] & 1)) deathTick[i] = frameI;
      }
    }

    function posAt(i, tick) {
      const L = B.frames.length - 1;
      const f0 = B.frames[Math.max(0, Math.min(L, Math.floor(tick)))];
      const f1 = B.frames[Math.max(0, Math.min(L, Math.floor(tick) + 1))];
      const a = tick - Math.floor(tick);
      const k = i * 4;
      return { x: (f0[k] + (f1[k] - f0[k]) * a) / 10, y: (f0[k + 1] + (f1[k + 1] - f0[k + 1]) * a) / 10, hp: f0[k + 2], fl: f0[k + 3] };
    }

    // ---------- слои ----------
    let cellPx = 0, dpr = 1, W = 0, H = 0;
    let terrainCanvas = null, decalCanvas = null, decalCtx = null, lightCanvas = null, lightCtx = null;
    function layer() {
      const c = document.createElement('canvas');
      c.width = canvas.width; c.height = canvas.height;
      const x = c.getContext('2d');
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
      return [c, x];
    }
    function drawTerrainLayer() {
      const tc = terrainCanvas.getContext('2d');
      tc.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawTerrain(tc, B.cells0, W, H, cellPx);
    }
    function resize() {
      const vh = globalThis.innerHeight || 800;
      const land = UI.isLandscapePhone();
      let avail = Math.max(240, root.clientWidth || 600);
      if (land) avail = Math.max(240, avail - 200);
      const cell = Math.max(10, Math.min(Math.floor(avail / W), Math.floor((land ? vh - 52 : vh * 0.5) / H), 36));
      if (cell === cellPx) return;
      cellPx = cell;
      dpr = Math.min(2, globalThis.devicePixelRatio || 1);
      canvas.width = W * cell * dpr;
      canvas.height = H * cell * dpr;
      canvas.style.width = W * cell + 'px';
      canvas.style.height = H * cell + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      [terrainCanvas] = layer();
      drawTerrainLayer();
      [decalCanvas, decalCtx] = layer();
      decalShot = 0; decalBoom = 0;
      [lightCanvas, lightCtx] = layer();
    }

    // Следы: подпалины от промахов и воронки от взрывов (накапливаются по ходу боя)
    function updateDecals(t) {
      const cell = cellPx, dc = decalCtx;
      for (; decalShot < B.shots.length && B.shots[decalShot][0] <= t; decalShot++) {
        const sh = B.shots[decalShot];
        if (sh[3] || sh[6] || decalShot % 3) continue;
        if ((B.units[sh[1]].base.range || 5) <= 2) continue;
        const p = posAt(sh[2], sh[0]);
        const x = (p.x + 0.5 + (hr(decalShot) - 0.5) * 1.1) * cell, y = (p.y + 0.62 + (hr(decalShot + 7) - 0.5) * 0.8) * cell;
        dc.fillStyle = 'rgba(45,30,18,0.25)';
        dc.beginPath(); dc.ellipse(x, y, cell * 0.11, cell * 0.06, 0, 0, TAU); dc.fill();
      }
      for (; decalBoom < B.booms.length && B.booms[decalBoom][0] <= t; decalBoom++) {
        const bm = B.booms[decalBoom];
        const x = (bm[1] + 0.5) * cell, y = (bm[2] + 0.6) * cell, r = cell * (bm[5] === 'barrel' ? 1.3 : 0.9);
        const g = dc.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(30,22,16,0.75)'); g.addColorStop(0.6, 'rgba(60,42,26,0.45)'); g.addColorStop(1, 'rgba(60,42,26,0)');
        dc.fillStyle = g; dc.beginPath(); dc.ellipse(x, y, r, r * 0.7, 0, 0, TAU); dc.fill();
      }
    }

    // ---------- фигурки ----------
    const meleeType = (type) => ((C.types[type] || {}).range || 5) <= 2;
    function lastBefore(arr, t, key) {
      let lo = 0, hi = arr.length - 1, ans = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const v = key ? arr[mid][0] : arr[mid];
        if (v <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1;
      }
      return ans;
    }
    const feet = (p, cell) => ({ x: (p.x + 0.5) * cell, y: (p.y + 0.82) * cell });
    const hgt = (type) => G.Sprites.height(type);

    function unitState(u, p, t, cell) {
      const i = u.i;
      const s = { t: t / 10, facing: facing[i], moving: !!(p.fl & 16), aim: 0, recoil: 0, melee: 0, hit: 0, dead: 0,
        broken: !!(p.fl & 4), side: u.side, rank: u.side === 0 ? ranks[i] || 0 : 0, seed: i * 31 + 7 };
      if (s.moving) {
        const a = posAt(i, Math.max(0, t - 0.6)), b = posAt(i, t + 0.6);
        if (Math.abs(b.x - a.x) > 0.01) facing[i] = s.facing = b.x > a.x ? 1 : -1;
      }
      const k = lastBefore(shotsBy[i], t, true);
      if (k >= 0) {
        const sh = shotsBy[i][k];
        const dt = t - sh[0];
        if (dt < 20) {
          const tp = posAt(sh[2], sh[0]);
          if (Math.abs(tp.x - p.x) > 0.05) facing[i] = s.facing = tp.x > p.x ? 1 : -1;
          const dx = Math.abs(tp.x - p.x) * cell, dy = (tp.y - p.y) * cell;
          s.aim = Math.atan2(dy, Math.max(1, dx));
          if (meleeType(u.type)) { if (dt < 6) s.melee = dt / 6; } else if (dt < 3) s.recoil = 1 - dt / 3;
        }
      }
      const hh = lastBefore(hitsOn[i], t, false);
      if (hh >= 0 && t - hitsOn[i][hh] < 2) s.hit = 1 - (t - hitsOn[i][hh]) / 2;
      if (p.fl & 1) s.dead = deathTick[i] >= 0 ? Math.max(0.05, Math.min(1, (t - deathTick[i]) / 3.5)) : 1;
      return s;
    }

    // Полоска здоровья и значки — поверх ночной тьмы
    function drawMarks(u, p, cell, t) {
      if ((p.fl & 3)) return;
      const f = feet(p, cell);
      const top = f.y - hgt(u.type) * cell - cell * 0.12;
      const hpw = cell * 0.7 * (u.type === 'krayt' ? 2 : 1);
      const hb = Math.max(2, cell * 0.09);
      const frac = Math.max(0, p.hp / u.maxHp);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(f.x - hpw / 2, top, hpw, hb);
      ctx.fillStyle = frac > 0.6 ? '#7cc287' : frac > 0.3 ? '#f2b33d' : '#e2574c';
      ctx.fillRect(f.x - hpw / 2, top, hpw * Math.min(1, frac), hb);
      let ix = f.x + hpw / 2 + cell * 0.12;
      const iy = top + hb / 2;
      // командир: звезда
      if (u.leader) {
        ctx.fillStyle = u.side === 0 ? '#f3cd8c' : '#ff8f80';
        star(f.x - hpw / 2 - cell * 0.14, iy, cell * 0.13);
      }
      if (p.fl & 32) { // в укрытии
        ctx.fillStyle = 'rgba(150,200,255,0.9)';
        ctx.beginPath(); ctx.moveTo(ix - cell * 0.08, iy - cell * 0.1); ctx.lineTo(ix + cell * 0.08, iy - cell * 0.1); ctx.lineTo(ix + cell * 0.08, iy + 0.01 * cell); ctx.quadraticCurveTo(ix, iy + cell * 0.12, ix - cell * 0.08, iy + 0.01 * cell); ctx.closePath(); ctx.fill();
        ix += cell * 0.22;
      }
      if (p.fl & 4) { ctx.fillStyle = '#ffd34d'; ctx.font = 'bold ' + Math.round(cell * 0.5) + 'px system-ui'; ctx.fillText('!', ix - cell * 0.05, iy + cell * 0.16); }
      else if (p.fl & 8) {
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.setLineDash([2, 2]); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(f.x, top - cell * 0.16, cell * 0.11, t * 0.3, t * 0.3 + TAU); ctx.stroke(); ctx.setLineDash([]);
      }
      if (st.sel === u.i) {
        ctx.strokeStyle = '#f3cd8c'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(f.x, f.y, cell * 0.42, cell * 0.15, 0, 0, TAU); ctx.stroke();
      }
    }
    function star(x, y, r) {
      ctx.beginPath();
      for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
      ctx.closePath(); ctx.fill();
    }

    // ---------- кадр ----------
    function draw() {
      if (!cellPx) resize();
      const cell = cellPx;
      const t = st.tick;
      updateDecals(t);
      ctx.clearRect(0, 0, W * cell, H * cell);
      // тряска от взрывов
      let sx = 0, sy = 0;
      for (let k = B.booms.length - 1; k >= 0; k--) {
        const dt = t - B.booms[k][0];
        if (dt < 0) continue;
        if (dt > 6) break;
        const amp = cell * (B.booms[k][5] === 'barrel' ? 0.18 : 0.1) * (1 - dt / 6);
        sx += Math.sin(t * 47 + k) * amp; sy += Math.cos(t * 39 + k) * amp;
      }
      ctx.save();
      ctx.translate(sx, sy);
      ctx.drawImage(terrainCanvas, 0, 0, W * cell, H * cell);
      ctx.drawImage(decalCanvas, 0, 0, W * cell, H * cell);

      // бочки и пожары на их месте
      for (const b of B.props) {
        const x = (b.x + 0.5) * cell, y = (b.y + 0.55) * cell;
        if (b.boomT < 0 || t < b.boomT) drawBarrel(ctx, x, y, cell);
        else if (t - b.boomT < 90) flames(x, y + cell * 0.1, cell * 0.5, t + b.x * 7, 1 - (t - b.boomT) / 90);
      }

      const rushOn = B.fx.some((f) => f[1] === 'rush' && f[2] === 0 && t >= f[0] && t < f[0] + C.orders.rush.dur);
      // пыль за бегущими
      const list = B.units.map((u) => ({ u: u, p: posAt(u.i, t) }));
      for (const it of list) {
        if (!(it.p.fl & 16) || (it.p.fl & 3)) continue;
        const n = rushOn && it.u.side === 0 ? 3 : 2;
        for (let k = 1; k <= n; k++) {
          const q = posAt(it.u.i, Math.max(0, t - k * 1.6));
          const f = feet(q, cell);
          ctx.fillStyle = 'rgba(225,200,150,' + (0.28 / k).toFixed(3) + ')';
          ctx.beginPath(); ctx.arc(f.x, f.y - cell * 0.05, cell * (0.1 + k * 0.05), 0, TAU); ctx.fill();
        }
      }
      // фигурки: павшие снизу, затем живые сверху вниз
      list.sort((a, b) => ((b.p.fl & 1) - (a.p.fl & 1)) || a.p.y - b.p.y || a.u.i - b.u.i);
      for (const it of list) {
        if (it.p.fl & 2) continue;
        const f = feet(it.p, cell);
        G.Sprites.draw(ctx, it.u.type, f.x, f.y, cell, unitState(it.u, it.p, t, cell));
      }

      // выстрелы: болты, вспышки, искры, фонтанчики песка
      nums.length = 0;
      for (let k = B.shots.length - 1; k >= 0; k--) {
        const sh = B.shots[k];
        if (sh[0] < t - 12) break;
        if (sh[0] > t) continue;
        const dt = t - sh[0];
        const target = B.units[sh[2]];
        if (sh[3] && sh[5] > 0 && dt < 11) nums.push({ i: sh[2], dt: dt - (sh[6] ? 0 : 1.2), v: sh[5], crit: sh[4], ex: sh[6], k: k });
        if (sh[6]) continue;
        const shooter = B.units[sh[1]];
        const fb = feet(posAt(sh[2], sh[0]), cell);
        const tx = fb.x, ty = fb.y - cell * hgt(target.type) * 0.5;
        if (meleeType(shooter.type)) {
          if (sh[3] && dt < 3) sparks(tx, ty, cell, dt / 3, k, '255,230,200');
          continue;
        }
        const fa = feet(posAt(sh[1], sh[0]), cell);
        const dir = fb.x >= fa.x ? 1 : -1;
        const miss = sh[3] ? 0 : (k % 2 ? 0.45 : -0.45);
        const x1 = fa.x + dir * cell * 0.45, y1 = fa.y - cell * hgt(shooter.type) * 0.55;
        const x2 = tx + miss * cell, y2 = ty - miss * cell * 0.6;
        const col = shooter.side === 0 ? BOLT[0] : BOLT[setup.army] || BOLT.default;
        if (dt < 1) { // вспышка у ствола
          ctx.fillStyle = 'rgba(255,240,200,' + (1 - dt).toFixed(3) + ')';
          ctx.beginPath(); ctx.arc(x1, y1, cell * 0.16 * (1.2 - dt), 0, TAU); ctx.fill();
        }
        const prog = Math.min(1, dt / 1.2);
        if (dt < 2.7) {
          const bx = x1 + (x2 - x1) * prog, by = y1 + (y2 - y1) * prog;
          const tail = Math.max(0, prog - 0.35);
          ctx.globalAlpha = prog >= 1 ? Math.max(0, 1 - (dt - 1.2) / 1.5) : 1;
          ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.5, cell * 0.09); ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(x1 + (x2 - x1) * tail, y1 + (y2 - y1) * tail); ctx.lineTo(bx, by); ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = Math.max(0.6, cell * 0.03);
          ctx.beginPath(); ctx.moveTo(x1 + (x2 - x1) * tail, y1 + (y2 - y1) * tail); ctx.lineTo(bx, by); ctx.stroke();
          ctx.globalAlpha = 1;
        }
        if (dt >= 1.2 && dt < 5) {
          const q = (dt - 1.2) / 3.8;
          if (sh[3]) sparks(x2, y2, cell, q, k, METAL.has(target.type) ? '255,235,140' : '255,190,120');
          else { // фонтанчик песка у ног
            ctx.fillStyle = 'rgba(230,205,160,' + (0.5 * (1 - q)).toFixed(3) + ')';
            ctx.beginPath(); ctx.arc(x2, fb.y - cell * 0.05 - q * cell * 0.25, cell * (0.08 + q * 0.18), 0, TAU); ctx.fill();
          }
        }
      }

      // гранаты в полёте и взрывы
      for (const bm of B.booms) {
        const [bt, bx, by, from, throwT, kind] = bm;
        if (t < throwT) continue;
        const cx = (bx + 0.5) * cell, cy = (by + 0.6) * cell;
        if (t < bt) {
          if (from >= 0) {
            const p0 = feet(posAt(from, throwT), cell);
            const k = (t - throwT) / Math.max(1, bt - throwT);
            const x = p0.x + (cx - p0.x) * k, y = p0.y - cell + (cy - p0.y + cell) * k - Math.sin(k * Math.PI) * cell * 1.8;
            ctx.fillStyle = '#2a2d31'; ctx.beginPath(); ctx.arc(x, y, cell * 0.1, 0, TAU); ctx.fill();
            ctx.fillStyle = (Math.floor(t * 2) % 2) ? '#ff3b2f' : '#ffd34d'; ctx.beginPath(); ctx.arc(x, y, cell * 0.04, 0, TAU); ctx.fill();
          }
          continue;
        }
        explosion(cx, cy, t - bt, cell, kind === 'barrel' ? 1.5 : kind === 'blast' ? 0.8 : 1, bt);
      }

      // дымовая завеса
      for (const sm of B.smokes) {
        if (t < sm.t0 || t > sm.t1) continue;
        const fade = Math.min(1, (t - sm.t0) / 8, (sm.t1 - t) / 12);
        const r = (Math.sqrt(sm.r2) + 0.4) * cell;
        for (let k = 0; k < 7; k++) {
          const a = k / 7 * TAU + t * 0.012;
          const px = (sm.x + 0.5) * cell + Math.cos(a) * r * 0.55, py = (sm.y + 0.5) * cell + Math.sin(a) * r * 0.4 - (t - sm.t0) * 0.02 * cell;
          ctx.fillStyle = 'rgba(214,214,208,' + (0.3 * fade).toFixed(3) + ')';
          ctx.beginPath(); ctx.arc(px, py, r * (0.55 + 0.08 * Math.sin(t * 0.05 + k)), 0, TAU); ctx.fill();
        }
      }

      // кольца: «Держать строй», клич, рёв; прицел сосредоточенного огня
      for (const fx of B.fx) {
        const dt = t - fx[0];
        if (dt < 0) continue;
        if (fx[1] === 'hold' && dt < 14) {
          ctx.strokeStyle = 'rgba(140,200,255,' + (0.8 * (1 - dt / 14)).toFixed(3) + ')'; ctx.lineWidth = 2;
          for (const it of list) if (it.u.side === fx[2] && !(it.p.fl & 3)) { const f = feet(it.p, cell); ctx.beginPath(); ctx.ellipse(f.x, f.y, cell * (0.3 + dt * 0.04), cell * (0.12 + dt * 0.015), 0, 0, TAU); ctx.stroke(); }
        } else if ((fx[1] === 'cry' || fx[1] === 'roar') && dt < 18) {
          const p = posAt(fx[5], fx[0]);
          const f = feet(p, cell);
          ctx.strokeStyle = (fx[1] === 'roar' ? 'rgba(255,210,120,' : 'rgba(255,150,90,') + (0.7 * (1 - dt / 18)).toFixed(3) + ')';
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(f.x, f.y - cell * 0.5, cell * (0.5 + dt * (fx[1] === 'roar' ? 0.42 : 0.3)), 0, TAU); ctx.stroke();
        } else if (fx[1] === 'focus' && fx[5] >= 0 && dt < C.orders.focus.dur) {
          const p = posAt(fx[5], t);
          if (!(p.fl & 3)) {
            const u = B.units[fx[5]];
            const f = feet(p, cell);
            const cy = f.y - hgt(u.type) * cell * 0.5, r = cell * 0.55;
            ctx.strokeStyle = 'rgba(255,80,60,0.85)'; ctx.lineWidth = 1.6;
            ctx.beginPath(); ctx.arc(f.x, cy, r, t * 0.08, t * 0.08 + TAU * 0.8); ctx.stroke();
            for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; ctx.beginPath(); ctx.moveTo(f.x + Math.cos(a) * r * 0.6, cy + Math.sin(a) * r * 0.6); ctx.lineTo(f.x + Math.cos(a) * r * 1.25, cy + Math.sin(a) * r * 1.25); ctx.stroke(); }
          }
        }
      }

      // ночь: темнота с пятнами света
      if (setup.night) drawNight(t, cell, list);

      // поверх тьмы: лечение, полоски, значки, цифры урона
      ctx.fillStyle = '#7cff9a';
      for (let k = B.heals.length - 1; k >= 0; k--) {
        const hl = B.heals[k];
        const dt = t - hl[0];
        if (dt < 0) continue;
        if (dt > 8) break;
        const p = posAt(hl[1], t);
        const cx = (p.x + 0.5) * cell, cy = (p.y + 0.82) * cell - cell * 1.4 - dt * 0.6;
        ctx.fillRect(cx - cell * 0.05, cy - cell * 0.18, cell * 0.1, cell * 0.36);
        ctx.fillRect(cx - cell * 0.18, cy - cell * 0.05, cell * 0.36, cell * 0.1);
      }
      for (const it of list) drawMarks(it.u, it.p, cell, t);
      ctx.textAlign = 'center';
      for (const n of nums) {
        if (n.dt < 0 || n.dt > 9.5) continue;
        const p = posAt(n.i, t);
        const f = feet(p, cell);
        const y = f.y - hgt(B.units[n.i].type) * cell - cell * 0.3 - n.dt * cell * 0.07;
        const big = n.crit || n.ex;
        ctx.globalAlpha = Math.min(1, (9.5 - n.dt) / 3);
        ctx.font = (big ? 'bold ' + Math.round(cell * 0.46) : '600 ' + Math.round(cell * 0.34)) + 'px system-ui';
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.75)';
        const txt = '−' + n.v + (n.crit ? '!' : '');
        const x = f.x + ((n.k % 3) - 1) * cell * 0.18;
        ctx.strokeText(txt, x, y);
        ctx.fillStyle = n.ex ? '#ffb15a' : n.crit ? '#ffe066' : B.units[n.i].side === 0 ? '#ff9a8a' : '#ffffff';
        ctx.fillText(txt, x, y);
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = 'start';
      ctx.restore();
    }

    function sparks(x, y, cell, q, seed, rgb) {
      ctx.strokeStyle = 'rgba(' + rgb + ',' + (1 - q).toFixed(3) + ')';
      ctx.lineWidth = Math.max(1, cell * 0.04);
      for (let j = 0; j < 5; j++) {
        const a = hr(seed * 7 + j) * TAU, l = cell * (0.12 + q * 0.35) * (0.6 + hr(seed + j * 3));
        ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * l * 0.4, y + Math.sin(a) * l * 0.4); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
      }
    }

    function flames(x, y, s, t, k) {
      for (let j = 0; j < 3; j++) {
        const fl = 0.7 + 0.3 * Math.sin(t * 0.9 + j * 2.1);
        const hh = s * (0.9 + 0.4 * fl) * Math.max(0.3, k);
        const xx = x + (j - 1) * s * 0.35;
        ctx.fillStyle = j === 1 ? 'rgba(255,220,120,0.9)' : 'rgba(255,130,50,0.85)';
        ctx.beginPath(); ctx.moveTo(xx - s * 0.2, y); ctx.quadraticCurveTo(xx, y - hh * 1.2, xx + s * 0.2, y); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = 'rgba(60,55,50,' + (0.25 * k).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(x + Math.sin(t * 0.05) * s * 0.3, y - s * 1.6 - (t % 20) * s * 0.03, s * 0.5, 0, TAU); ctx.fill();
    }

    function explosion(cx, cy, dt, cell, big, seed) {
      if (dt > 40) return;
      if (dt < 2) {
        ctx.fillStyle = 'rgba(255,250,230,' + (0.9 * (1 - dt / 2)).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(cx, cy, cell * 1.5 * big, 0, TAU); ctx.fill();
      }
      if (dt < 9) {
        const r = cell * (0.6 + dt * 0.17) * big;
        const g = ctx.createRadialGradient(cx, cy - dt * cell * 0.03, 0, cx, cy, r);
        const a = 1 - dt / 9;
        g.addColorStop(0, 'rgba(255,240,170,' + a.toFixed(3) + ')');
        g.addColorStop(0.45, 'rgba(255,140,40,' + (0.85 * a).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(120,40,10,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
      }
      if (dt < 6) {
        ctx.strokeStyle = 'rgba(255,235,200,' + (0.6 * (1 - dt / 6)).toFixed(3) + ')'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(cx, cy, cell * (0.5 + dt * 0.5) * big, cell * (0.3 + dt * 0.3) * big, 0, 0, TAU); ctx.stroke();
      }
      if (dt < 14) {
        ctx.fillStyle = '#3a3027';
        for (let j = 0; j < 9; j++) {
          const a = hr(seed * 11 + j) * TAU, v = (0.25 + hr(seed + j * 5) * 0.35) * cell * big;
          const x = cx + Math.cos(a) * v * dt, y = cy + Math.sin(a) * v * dt * 0.6 - v * dt * 0.9 + 0.045 * cell * dt * dt;
          ctx.fillRect(x, y, cell * 0.07, cell * 0.07);
        }
      }
      if (dt >= 3) {
        const a = 0.38 * (1 - (dt - 3) / 37);
        for (let j = 0; j < 3; j++) {
          ctx.fillStyle = 'rgba(70,64,58,' + a.toFixed(3) + ')';
          ctx.beginPath(); ctx.arc(cx + (j - 1) * cell * 0.35 + Math.sin(dt * 0.1 + j) * cell * 0.1, cy - dt * cell * 0.05 - j * cell * 0.25, cell * (0.45 + dt * 0.025) * big, 0, TAU); ctx.fill();
        }
      }
    }

    function drawNight(t, cell, list) {
      const lc = lightCtx;
      lc.setTransform(1, 0, 0, 1, 0, 0);
      lc.globalCompositeOperation = 'source-over';
      lc.clearRect(0, 0, lightCanvas.width, lightCanvas.height);
      lc.fillStyle = 'rgba(6,12,34,0.68)';
      lc.fillRect(0, 0, lightCanvas.width, lightCanvas.height);
      lc.setTransform(dpr, 0, 0, dpr, 0, 0);
      lc.globalCompositeOperation = 'destination-out';
      const light = (x, y, r, a) => {
        const g = lc.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(0,0,0,' + a.toFixed(3) + ')');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        lc.fillStyle = g; lc.beginPath(); lc.arc(x, y, r, 0, TAU); lc.fill();
      };
      for (const l of lamps) light((l.x + 0.5) * cell, (l.y + 0.5) * cell, cell * 4.5, 0.95);
      for (const it of list) {
        if (it.p.fl & 3) continue;
        const f = feet(it.p, cell);
        if (it.u.type === 'turret') light(f.x, f.y - cell * 0.3, cell * 2, 0.7);
        else if (it.u.side === 0) light(f.x, f.y - cell * 0.5, cell * 1.3, 0.5);
      }
      for (let k = B.shots.length - 1; k >= 0; k--) {
        const sh = B.shots[k];
        if (sh[0] < t - 2) break;
        if (sh[0] > t || sh[6]) continue;
        const f = feet(posAt(sh[1], sh[0]), cell);
        light(f.x, f.y - cell * 0.6, cell * 1.8, 0.8 * (1 - (t - sh[0]) / 2));
      }
      for (const bm of B.booms) { const dt = t - bm[0]; if (dt >= 0 && dt < 24) light((bm[1] + 0.5) * cell, (bm[2] + 0.5) * cell, cell * 5 * (1 - dt / 30), 1); }
      for (const b of B.props) if (b.boomT >= 0 && t >= b.boomT && t - b.boomT < 90) light((b.x + 0.5) * cell, (b.y + 0.5) * cell, cell * (2.4 + 0.3 * Math.sin(t)), 0.85);
      lc.globalCompositeOperation = 'source-over';
      ctx.drawImage(lightCanvas, 0, 0, W * cell, H * cell);
    }

    // ---------- интерфейс вокруг поля ----------
    function syncHud() {
      const f = B.frames[Math.min(B.frames.length - 1, Math.floor(st.tick))];
      const act = [0, 0];
      for (let i = 0; i < N; i++) if (!(f[i * 4 + 3] & 3)) act[B.units[i].side]++;
      for (const [side, hd] of [[0, hudOurs], [1, hudFoe]]) {
        const key = act[side] + '/' + B.sides[side].start;
        if (hd.last === key) continue;
        hd.last = key;
        hd.b.textContent = act[side];
        hd.i.style.width = (100 * act[side] / Math.max(1, B.sides[side].start)).toFixed(0) + '%';
      }
      timeEl.textContent = (st.tick / 10).toFixed(0) + ' с';
      // всплывающие надписи о приказах и умениях
      while (st.fxShown < B.fx.length && B.fx[st.fxShown][0] <= st.tick) {
        const fx = B.fx[st.fxShown++];
        if (st.tick - fx[0] > 8) continue; // при перемотке старые надписи не показываем
        const text = fx[2] === 0 ? (FX_BANNER[fx[1]] && fx[1] !== 'nade' ? FX_BANNER[fx[1]] : (G.TEXT.battleOrders[fx[1]] ? (G.TEXT.battleOrders[fx[1]].short || G.TEXT.battleOrders[fx[1]].name) + '!' : '')) : FX_BANNER[fx[1]];
        if (!text) continue;
        banner.textContent = (fx[2] === 0 && ORDER_ICON[fx[1]] ? ORDER_ICON[fx[1]] + ' ' : '') + text;
        banner.className = 'bv-banner ' + (fx[2] === 0 ? 'ours' : 'foe');
        void banner.offsetWidth;
        banner.classList.add('show');
      }
      // выбранный боец
      if (st.sel >= 0) {
        const u = B.units[st.sel];
        const p = posAt(st.sel, st.tick);
        tip.classList.add('on');
        tip.textContent = U.cap(u.label) + ' · ' + ((p.fl & 3) ? 'выбыл' : p.hp + '/' + u.maxHp) + (u.kills ? ' · ☠' + u.kills : '');
      } else tip.classList.remove('on');
    }

    function syncLog() {
      if (st.done) return;
      let added = false;
      while (st.shownLog < B.log.length && B.log[st.shownLog].t <= st.tick) {
        const e = B.log[st.shownLog++];
        const el = h('div', { class: 'bl k-' + e.k }, h('span', { class: 'mono muted' }, (e.t / 10).toFixed(0) + ' '), e.text);
        e.el = el;
        logEl.appendChild(el);
        added = true;
      }
      // склеенные повторы: «×3»
      for (let k = Math.max(0, st.shownLog - 4); k < st.shownLog; k++) {
        const e = B.log[k];
        if (e.n > 1 && e.el && e.shownN !== e.n) { e.shownN = e.n; let s = e.el.querySelector('.n'); if (!s) { s = h('span', { class: 'n' }); e.el.appendChild(s); } s.textContent = ' ×' + e.n; }
      }
      if (added) logEl.scrollTop = logEl.scrollHeight;
    }

    canvas.addEventListener('click', (ev) => {
      if (!B || !cellPx) return;
      const r = canvas.getBoundingClientRect();
      const cx = (ev.clientX - r.left) / cellPx, cy = (ev.clientY - r.top) / cellPx;
      let best = -1, bd = 0.9;
      for (let i = 0; i < N; i++) {
        const p = posAt(i, st.tick);
        if (p.fl & 3) continue;
        const d = Math.hypot(p.x + 0.5 - cx, p.y + 0.3 - cy);
        if (d < bd) { bd = d; best = i; }
      }
      st.sel = best === st.sel ? -1 : best;
    });

    function frame(ts) {
      if (st.destroyed) return;
      const dt = st.last ? Math.min(0.1, (ts - st.last) / 1000) : 0;
      st.last = ts;
      if (root.isConnected) {
        resize();
        if (st.skip) { while (!B.over) E.tick(B); st.tick = B.t; st.skip = false; }
        else if (st.playing) st.tick = Math.min(B.over ? B.t : Infinity, st.tick + dt * tps * st.speed);
        ensure(Math.ceil(st.tick));
        if (B.over) st.tick = Math.min(st.tick, B.t);
        if (B.over && st.tick >= B.t && !st.ended) {
          st.ended = true; st.playing = false; syncBtns();
          ended();
        }
        draw();
        syncLog();
        syncHud();
        syncOrders();
      }
      requestAnimationFrame(frame);
    }

    function ended() {
      if (live && !st.finished) {
        st.finished = true;
        live = false;
        root.classList.remove('live');
        buildOrders();
        if (opts.onFinish) opts.onFinish(B.cmds.map((c) => c.slice()));
      } else if (opts.onEnd) opts.onEnd();
    }

    start(setup.cmds || null);
    W = B.W; H = B.H;
    buildOrders();
    syncBtns();
    if (opts.startAtEnd) {
      while (!B.over) E.tick(B);
      ensure(B.t);
      st.tick = B.t; st.playing = false; st.ended = true; st.finished = true; live = false;
      root.classList.remove('live'); buildOrders(); syncBtns();
    }
    requestAnimationFrame(frame);

    return {
      el: root,
      destroy() { st.destroyed = true; },
      ended: () => st.ended,
      // после боя место журнала занимают итоги
      setPanel(el) { st.done = true; root.classList.add('done'); G.Dom.clear(reportEl); reportEl.appendChild(el); },
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

  // Превью поля: местность, бочки, наше построение и (если есть разведка) противник
  function previewCanvas(s, p) {
    let B;
    try { B = G.BattleEngine.init(G.BattleFlow.toSetup(s, p)); } catch (e) { return null; }
    const cell = UI.isLandscapePhone() ? 8 : 11;
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    const c = h('canvas', { class: 'bv-preview', title: 'Поле боя' });
    c.width = B.W * cell * dpr; c.height = B.H * cell * dpr;
    c.style.width = B.W * cell + 'px'; c.style.height = B.H * cell + 'px';
    const x = c.getContext('2d');
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawTerrain(x, B.cells0, B.W, B.H, cell);
    for (const b of B.props) drawBarrel(x, (b.x + 0.5) * cell, (b.y + 0.55) * cell, cell * 1.3);
    if (!p.ctx.intel) {
      x.fillStyle = 'rgba(226,87,76,0.18)';
      const x0 = p.ctx.mode === 'fort' ? 17 : B.W - 6;
      x.fillRect(x0 * cell, 0, (B.W - x0) * cell, B.H * cell);
      x.fillStyle = '#ffb3a8'; x.font = 'bold ' + cell * 2 + 'px system-ui'; x.textAlign = 'center';
      x.fillText('?', (x0 + (B.W - x0) / 2) * cell, B.H * cell / 2 + cell * 0.7);
    }
    for (const u of B.units) {
      if (u.state !== 'active' || (u.side === 1 && !p.ctx.intel)) continue;
      x.fillStyle = u.side === 0 ? (u.leader ? '#f3cd8c' : '#8fd0ff') : (u.leader ? '#ffd34d' : '#ff6b5b');
      x.strokeStyle = 'rgba(0,0,0,0.6)';
      x.beginPath(); x.arc((u.x + 0.5) * cell, (u.y + 0.5) * cell, cell * (u.base.big ? 0.5 : 0.32), 0, Math.PI * 2); x.fill(); x.stroke();
    }
    return c;
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
      h('div', { class: 'prep-top' },
        previewCanvas(s, p),
        h('div', { class: 'kv' },
          h('span', { class: 'k' }, 'Наши силы'), h('span', null, ourForces(s, p)),
          h('span', { class: 'k' }, 'Противник'), h('span', null, enemyIntel(s, p)))),
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
      h('div', { class: 'row between' }, h('h3', null, 'Приказы генерала'), h('span', { class: 'small muted' }, ch.orders.length + ' из ' + G.CONFIG.battle.maxOrders + ' · в бою — кнопками')),
      h('div', { class: 'orders-list' }, G.BattleFlow.orderIds().map((id) => {
        const T = G.TEXT.battleOrders[id];
        const lock = G.BattleFlow.orderLock(s, id);
        const on = ch.orders.indexOf(id) >= 0;
        const cd = G.CONFIG.battle.orders[id].cd / 10;
        return h('button', { class: 'choice order-pick' + (on ? ' sel' : ''), disabled: !!lock, onclick: () => set('order', id) },
          h('div', { class: 'cn' }, (on ? '☑ ' : '☐ ') + (ORDER_ICON[id] || '') + ' ' + T.name),
          h('div', { class: 'ch' }, lock ? 'Недоступно: ' + lock : T.desc + ' Перезарядка ' + cd + ' с.'));
      }))));

    box.appendChild(h('div', { class: 'row sticky-actions', style: 'margin-top:14px' },
      h('button', { class: 'btn primary', style: 'flex:2', onclick: () => act({ action: 'fight' }) }, '⚔ В бой'),
      h('button', { class: 'btn', style: 'flex:1', onclick: () => act({ action: 'quick' }) }, 'Быстрый расчёт')));
    return box;
  };

  // ================= ИТОГИ И ПРОСМОТР =================
  function reportBlock(rep, extra) {
    const s = UI.s;
    const faces = (ids) => (ids && ids.length && s ? h('div', { class: 'ava-row' }, ids.map((id) => G.Units.byId(s, id)).filter(Boolean).map((u) =>
      h('div', { class: 'ava-chip' }, G.Avatar.img(u, 40), h('span', null, u.num)))) : null);
    const mvp = rep.mvp && s ? G.Units.byId(s, rep.mvp.uid) : null;
    return h('div', { class: 'battle-report' },
      h('h3', { class: rep.won ? 'good' : 'bad', style: 'font-size:20px;margin:0 0 4px' }, rep.head),
      h('div', { class: 'rep-stats' },
        h('span', null, '☠ ', h('b', null, rep.enemyDown), rep.enemyFled ? ' +' + rep.enemyFled + ' бежали' : ''),
        rep.acc != null ? h('span', null, '◎ ', h('b', null, rep.acc + '%')) : null,
        h('span', null, '⏱ ', h('b', null, (rep.ticks / 10).toFixed(0) + ' с')),
        rep.killed.length ? h('span', { class: 'bad' }, '✝ ', h('b', null, rep.killed.length)) : null,
        rep.heavy.length ? h('span', { class: 'warn' }, '✚ ', h('b', null, rep.heavy.length)) : null),
      mvp ? h('div', { class: 'mvp' }, G.Avatar.img(mvp, 44), h('div', null, h('div', { class: 'small muted' }, 'Лучший в бою'), h('b', null, G.Units.title(mvp)),
        h('div', { class: 'small' }, U.pl(rep.mvp.kills, ['враг', 'врага', 'врагов']) + ' · урон ' + rep.mvp.dealt))) : null,
      rep.killed.length ? h('div', { class: 'bad small' }, 'Погибли: ' + rep.killed.join(', ')) : null,
      faces(rep.killedIds),
      rep.heavy.length ? h('div', { class: 'warn small' }, 'Тяжело ранены: ' + rep.heavy.join(', ')) : null,
      rep.promoted && rep.promoted.length ? h('div', { class: 'good small' }, '▲ Новое звание: ' + rep.promoted.join(', ')) : null,
      rep.loot ? h('div', { class: 'small' }, '⚙ ' + rep.loot) : null,
      rep.afterText ? h('p', { class: 'small', style: 'margin:6px 0 0' }, rep.afterText) : null,
      extra || null);
  }

  // Вид кэшируется, чтобы бой не начинался заново при перерисовке интерфейса
  UI._bv = null;
  const viewKey = (s, id) => 'b' + id + ':' + s.seed;
  function getView(key, setup, opts) {
    if (UI._bv && UI._bv.key === key) return UI._bv.view;
    if (UI._bv) UI._bv.view.destroy();
    const view = G.BattleView(Object.assign({ setup: setup }, opts));
    UI._bv = { key: key, view: view };
    return view;
  }
  function dropView() { if (UI._bv) { UI._bv.view.destroy(); UI._bv = null; } }

  // Живой бой: генерал смотрит и отдаёт приказы кнопками
  UI.modals.battleLive = function (s) {
    const L = s.pending;
    const view = getView(viewKey(s, L.id), L.setup, { live: true, autoplay: true, onFinish: (cmds) => { G.Game.act(s, { action: 'finish', cmds: cmds }); UI.commit(); } });
    return h('div', { class: 'modal wide battle-live' },
      h('div', { class: 'bv-head' }, h('span', { class: 'small muted' }, 'День ' + s.day + (L.setup.night ? ' · ночь' : '') + ' · '), h('b', null, L.title)),
      view.el);
  };

  UI.modals.battleResult = function (s) {
    const p = s.pending;
    const view = getView(viewKey(s, p.id), p.setup, { autoplay: false, startAtEnd: true });
    view.setPanel(h('div', null, reportBlock(p.report), h('div', { class: 'sticky-actions' }, h('button', { class: 'btn primary big', onclick: () => {
      dropView();
      G.Game.act(s, { action: 'close' });
      UI.commit();
    } }, 'Продолжить'))));
    return h('div', { class: 'modal wide battle-live' },
      h('div', { class: 'bv-head' }, h('span', { class: 'small muted' }, 'День ' + s.day + ' · '), h('b', null, p.title)),
      view.el);
  };

  // Повтор из хроники
  UI.openReplay = function (rp) {
    const view = getView('r' + rp.id + ':' + rp.day, rp.setup, { autoplay: true });
    UI.overlay = () => h('div', { class: 'modal wide battle-live' },
      h('div', { class: 'row between bv-head' },
        h('div', null, h('span', { class: 'small muted' }, 'Повтор · день ' + rp.day + ' · '), h('b', null, rp.title + (rp.won ? ' — победа' : ' — поражение'))),
        h('button', { class: 'btn small', onclick: () => { dropView(); UI.overlay = null; UI.render(); } }, '✕')),
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
