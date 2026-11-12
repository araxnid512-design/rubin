'use strict';
/* Глобальная карта: генерация, отрисовка и стратегический режим */
(function (DW) {
  const U = DW.U, D = DW.D;
  const W = 1600, H = 1000;

  /* ---------- Генерация ---------- */
  const World = {};
  World.W = W; World.H = H;
  World.generate = function () {
    for (let attempt = 0; attempt < 30; attempt++) {
      const w = tryGen();
      if (w) return w;
    }
    return tryGen(true);
  };
  function tryGen(force) {
    const pts = [{ x: 150, y: U.randf(380, 620) }];
    let t = 0;
    while (pts.length < 23 && t < 8000) {
      t++;
      const x = U.randf(90, W - 90), y = U.randf(90, H - 90);
      if (pts.every(function (p) { return Math.hypot(p.x - x, p.y - y) > 170; })) pts.push({ x: x, y: y });
    }
    const n = pts.length;
    const pairs = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
      if (d < 430) pairs.push([d, i, j]);
    }
    pairs.sort(function (a, b) { return a[0] - b[0]; });
    const par = []; for (let i = 0; i < n; i++) par.push(i);
    const find = function (a) { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
    const edges = [];
    const deg = new Array(n).fill(0);
    function ok(i, j) {
      for (let k = 0; k < edges.length; k++) {
        const e = edges[k];
        if (e[0] === i || e[0] === j || e[1] === i || e[1] === j) continue;
        if (U.segIntersect(pts[i], pts[j], pts[e[0]], pts[e[1]])) return false;
      }
      for (let k = 0; k < n; k++) {
        if (k === i || k === j) continue;
        if (U.segPointDist(pts[i], pts[j], pts[k]) < 45) return false;
      }
      return true;
    }
    pairs.forEach(function (p) {
      const i = p[1], j = p[2];
      if (find(i) === find(j)) return;
      if (!ok(i, j)) return;
      edges.push([i, j]); deg[i]++; deg[j]++;
      par[find(i)] = find(j);
    });
    const root = find(0);
    for (let i = 0; i < n; i++) if (find(i) !== root && !force) return null;
    pairs.forEach(function (p) {
      const i = p[1], j = p[2];
      if (p[0] > 310 || deg[i] >= 4 || deg[j] >= 4) return;
      if (edges.some(function (e) { return (e[0] === i && e[1] === j) || (e[0] === j && e[1] === i); })) return;
      if (Math.random() > 0.55 || !ok(i, j)) return;
      edges.push([i, j]); deg[i]++; deg[j]++;
    });
    // расстояния в переходах
    const adj = []; for (let i = 0; i < n; i++) adj.push([]);
    edges.forEach(function (e) { adj[e[0]].push(e[1]); adj[e[1]].push(e[0]); });
    const hops = new Array(n).fill(-1); hops[0] = 0;
    const q = [0];
    while (q.length) { const c = q.shift(); adj[c].forEach(function (m) { if (hops[m] < 0) { hops[m] = hops[c] + 1; q.push(m); } }); }
    if (hops.some(function (h) { return h < 0; }) && !force) return null;
    const maxH = Math.max.apply(null, hops);
    if (maxH < 4 && !force) return null;

    const type = new Array(n).fill(null);
    type[0] = 'landing';
    const free = function () { const r = []; for (let i = 1; i < n; i++) if (!type[i]) r.push(i); return r; };
    // гнездо — самая дальняя точка
    let nest = 1;
    for (let i = 1; i < n; i++) if (hops[i] > hops[nest] || (hops[i] === hops[nest] && pts[i].x > pts[nest].x)) nest = i;
    type[nest] = 'nest';
    // бункер
    let vc = free().filter(function (i) { return hops[i] >= 3 && adj[nest].indexOf(i) < 0; });
    if (!vc.length) vc = free().filter(function (i) { return hops[i] >= 2; });
    if (vc.length) { vc.sort(function (a, b) { return hops[b] - hops[a]; }); type[vc[Math.min(1, vc.length - 1)]] = 'vault'; }
    // укрытия под базу
    let sc = U.shuffle(free().filter(function (i) { return hops[i] >= 1 && hops[i] <= 2; }));
    if (sc.length) type[sc[0]] = 'site';
    sc = U.shuffle(free().filter(function (i) { return hops[i] >= 2 && hops[i] <= 4; }));
    for (let k = 0; k < 2 && k < sc.length; k++) type[sc[k]] = 'site';
    // логова и лагеря подальше и разнесённые
    function spread(kind, count, minHop) {
      for (let k = 0; k < count; k++) {
        let c = free().filter(function (i) { return hops[i] >= minHop; });
        if (!c.length) c = free();
        if (!c.length) return;
        let best = c[0], bd = -1;
        c.forEach(function (i) {
          let d = 1e9;
          for (let j = 0; j < n; j++) if (type[j] === kind) d = Math.min(d, Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y));
          d += Math.random() * 120;
          if (d > bd) { bd = d; best = i; }
        });
        type[best] = kind;
      }
    }
    spread('lair', 3, 2);
    spread('camp', 3, 2);
    // жилы
    let vn = U.shuffle(free().filter(function (i) { return hops[i] >= 1; }));
    for (let k = 0; k < 5 && k < vn.length; k++) type[vn[k]] = 'vein';
    free().forEach(function (i) { type[i] = 'ruins'; });

    const names = {};
    for (const k in D.NODE_NAMES) names[k] = U.shuffle(D.NODE_NAMES[k].slice());
    const nodes = pts.map(function (p, i) {
      const tp = type[i];
      let diff = U.clamp(1 + Math.floor(hops[i] * 0.75), 1, 5);
      if (tp === 'lair') diff = Math.min(5, diff + 1);
      if (tp === 'vault') diff = Math.max(4, diff);
      if (tp === 'nest') diff = 5;
      if (tp === 'landing') diff = 1;
      const nm = names[tp].length ? names[tp].shift() : D.NODE_TYPES[tp].n;
      return {
        id: i, x: Math.round(p.x), y: Math.round(p.y), type: tp, name: nm, diff: diff, hops: hops[i],
        known: false, visited: false, cleared: false, beacon: tp === 'landing', outpost: false, base: false,
        cargo: null, searches: tp === 'ruins' ? 3 : 0
      };
    });
    return { nodes: nodes, edges: edges, landing: 0, seed: U.rand(1, 1e9) };
  }

  /* ---------- Отрисовка ---------- */
  const WR = {};
  let bg = null, bgSeed = null, fogC = null, fogKey = '';
  WR.cam = { x: W / 2, y: H / 2, z: 1, tx: null, ty: null };
  WR.view = { w: 800, h: 400 };
  WR.sel = null;
  WR.anim = null;

  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function buildBg(world) {
    const c = canvas(W, H);
    const g = c.getContext('2d');
    const seed = world.seed % 100000;
    const lw = 200, lh = 125;
    const lc = canvas(lw, lh);
    const lg = lc.getContext('2d');
    const img = lg.createImageData(lw, lh);
    for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) {
      const n = U.fbm(x * 0.028, y * 0.028, seed, 5);
      const m = U.fbm(x * 0.06 + 100, y * 0.06, seed + 7, 3);
      let r = 62 + n * 78, gg = 52 + n * 62, b = 40 + n * 46;
      if (m > 0.58) { r += 18; gg += 2; b -= 8; }
      if (n < 0.4) { r *= 0.72; gg *= 0.74; b *= 0.78; }
      if (n > 0.66) { r += 10; gg += 10; b += 10; }
      const k = (y * lw + x) * 4;
      img.data[k] = r; img.data[k + 1] = gg; img.data[k + 2] = b; img.data[k + 3] = 255;
    }
    lg.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = true;
    g.drawImage(lc, 0, 0, W, H);
    const rnd = U.srng(world.seed);
    // топографические линии
    g.strokeStyle = 'rgba(30,22,14,0.18)'; g.lineWidth = 1;
    for (let k = 0; k < 18; k++) {
      let x = rnd() * W, y = rnd() * H;
      g.beginPath(); g.moveTo(x, y);
      for (let s = 0; s < 40; s++) { x += Math.cos(s * 0.3 + k) * 22 + (rnd() - 0.5) * 10; y += Math.sin(s * 0.25 + k * 2) * 18 + (rnd() - 0.5) * 10; g.lineTo(x, y); }
      g.stroke();
    }
    // трещины
    g.strokeStyle = 'rgba(20,14,8,0.35)';
    for (let k = 0; k < 45; k++) {
      let x = rnd() * W, y = rnd() * H;
      g.lineWidth = 0.8 + rnd() * 1.6;
      g.beginPath(); g.moveTo(x, y);
      for (let s = 0; s < 8; s++) { x += (rnd() - 0.5) * 50; y += (rnd() - 0.5) * 50; g.lineTo(x, y); }
      g.stroke();
    }
    // кратеры
    for (let k = 0; k < 28; k++) {
      const x = rnd() * W, y = rnd() * H, r = 8 + rnd() * 30;
      g.fillStyle = 'rgba(15,10,6,0.3)'; g.beginPath(); g.ellipse(x, y, r, r * 0.7, 0, 0, 7); g.fill();
      g.strokeStyle = 'rgba(220,200,170,0.12)'; g.lineWidth = 2; g.beginPath(); g.ellipse(x, y + 1, r, r * 0.7, 0, 0.2, 2.8); g.stroke();
    }
    // мёртвые леса
    for (let k = 0; k < 14; k++) {
      const cx = rnd() * W, cy = rnd() * H;
      g.strokeStyle = 'rgba(30,22,16,0.55)'; g.lineWidth = 1.2;
      for (let s = 0; s < 34; s++) {
        const x = cx + (rnd() - 0.5) * 120, y = cy + (rnd() - 0.5) * 80;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 3, y - 6 - rnd() * 6); g.stroke();
      }
    }
    // детали у узлов
    world.nodes.forEach(function (n) {
      if (n.type === 'ruins' || n.type === 'site') {
        for (let s = 0; s < 14; s++) {
          const x = n.x + (rnd() - 0.5) * 120, y = n.y + (rnd() - 0.5) * 90;
          g.fillStyle = 'rgba(40,34,28,' + (0.3 + rnd() * 0.3) + ')';
          g.fillRect(x, y, 5 + rnd() * 14, 4 + rnd() * 10);
        }
      } else if (n.type === 'vein') {
        for (let s = 0; s < 22; s++) {
          const x = n.x + (rnd() - 0.5) * 120, y = n.y + (rnd() - 0.5) * 90, sz = 2 + rnd() * 4;
          g.fillStyle = 'rgba(95,212,230,' + (0.25 + rnd() * 0.4) + ')';
          g.beginPath(); g.moveTo(x, y - sz * 1.6); g.lineTo(x + sz * 0.6, y); g.lineTo(x, y + sz * 0.5); g.lineTo(x - sz * 0.6, y); g.closePath(); g.fill();
        }
      } else if (n.type === 'lair' || n.type === 'nest') {
        const big = n.type === 'nest' ? 1.8 : 1;
        for (let s = 0; s < 6; s++) {
          const x = n.x + (rnd() - 0.5) * 120 * big, y = n.y + (rnd() - 0.5) * 90 * big, r = (10 + rnd() * 18) * big;
          const gr = g.createRadialGradient(x, y, 1, x, y, r);
          gr.addColorStop(0, 'rgba(110,150,30,0.45)'); gr.addColorStop(1, 'rgba(110,150,30,0)');
          g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
        }
        if (n.type === 'nest') {
          g.strokeStyle = 'rgba(120,40,70,0.4)'; g.lineWidth = 3;
          for (let s = 0; s < 10; s++) {
            g.beginPath(); g.moveTo(n.x, n.y);
            g.bezierCurveTo(n.x + (rnd() - 0.5) * 200, n.y + (rnd() - 0.5) * 200, n.x + (rnd() - 0.5) * 300, n.y + (rnd() - 0.5) * 300, n.x + (rnd() - 0.5) * 380, n.y + (rnd() - 0.5) * 300);
            g.stroke();
          }
        }
      } else if (n.type === 'camp') {
        g.fillStyle = 'rgba(30,20,12,0.35)';
        for (let s = 0; s < 5; s++) { g.beginPath(); g.arc(n.x + (rnd() - 0.5) * 70, n.y + (rnd() - 0.5) * 50, 6 + rnd() * 6, 0, 7); g.fill(); }
      }
    });
    // сетка карты
    g.strokeStyle = 'rgba(255,230,190,0.05)'; g.lineWidth = 1;
    for (let x = 0; x <= W; x += 100) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    for (let y = 0; y <= H; y += 100) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    // виньетка
    const vg = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.7);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    return c;
  }
  function buildFog(world) {
    if (!fogC) fogC = canvas(W / 4, H / 4);
    const g = fogC.getContext('2d');
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, fogC.width, fogC.height);
    g.fillStyle = 'rgba(10,9,8,0.9)'; g.fillRect(0, 0, fogC.width, fogC.height);
    g.globalCompositeOperation = 'destination-out';
    world.nodes.forEach(function (n) {
      if (!n.known) return;
      const r = (n.visited ? 230 : 150) / 4;
      const x = n.x / 4, y = n.y / 4;
      const gr = g.createRadialGradient(x, y, r * 0.3, x, y, r);
      gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    });
    g.globalCompositeOperation = 'source-over';
  }

  WR.init = function () {
    const st = DW.G.state;
    if (!bg || bgSeed !== st.world.seed) { bg = buildBg(st.world); bgSeed = st.world.seed; }
    fogKey = '';
    const n = DW.G.node(st.squadAt);
    WR.cam.z = U.clamp(Math.min(WR.view.h / 470, WR.view.w / 780), 0.55, 1.4);
    WR.cam.x = n.x + 90 / WR.cam.z; WR.cam.y = n.y;
    WR.cam.tx = null;
    clampCam();
  };
  function clampCam() {
    const z = WR.cam.z;
    const hw = WR.view.w / 2 / z, hh = WR.view.h / 2 / z;
    const m = 120;
    WR.cam.x = W + 2 * m < hw * 2 ? W / 2 : U.clamp(WR.cam.x, hw - m, W - hw + m);
    WR.cam.y = H + 2 * m < hh * 2 ? H / 2 : U.clamp(WR.cam.y, hh - m, H - hh + m);
  }
  WR.pan = function (dx, dy) { WR.cam.x -= dx / WR.cam.z; WR.cam.y -= dy / WR.cam.z; WR.cam.tx = null; clampCam(); };
  WR.zoomAt = function (f, sx, sy) {
    const b = WR.s2w(sx, sy);
    WR.cam.z = U.clamp(WR.cam.z * f, 0.35, 2);
    const a = WR.s2w(sx, sy);
    WR.cam.x += b[0] - a[0]; WR.cam.y += b[1] - a[1];
    clampCam();
  };
  WR.s2w = function (sx, sy) { return [(sx - WR.view.w / 2) / WR.cam.z + WR.cam.x, (sy - WR.view.h / 2) / WR.cam.z + WR.cam.y]; };
  WR.w2s = function (x, y) { return [(x - WR.cam.x) * WR.cam.z + WR.view.w / 2, (y - WR.cam.y) * WR.cam.z + WR.view.h / 2]; };
  WR.focus = function (x, y) { WR.cam.tx = x; WR.cam.ty = y; };
  WR.update = function (dt) {
    const c = WR.cam;
    if (c.tx !== null) {
      const k = Math.min(1, dt * 5);
      c.x += (c.tx - c.x) * k; c.y += (c.ty - c.y) * k;
      clampCam();
      if (Math.abs(c.tx - c.x) < 2 && Math.abs(c.ty - c.y) < 2) c.tx = null;
    }
  };

  function nodeIcon(g, n, x, y, t) {
    const col = D.NODE_TYPES[n.type].color;
    g.fillStyle = col; g.strokeStyle = col; g.lineWidth = 2.2;
    switch (n.type) {
      case 'landing': {
        const gl = 0.35 + Math.sin(t / 400) * 0.15;
        g.fillStyle = 'rgba(95,212,230,' + gl + ')'; g.beginPath(); g.ellipse(x, y, 6, 10, 0, 0, 7); g.fill();
        g.lineWidth = 2.5; g.beginPath(); g.ellipse(x, y, 9, 13, 0, 0, 7); g.stroke();
        break;
      }
      case 'ruins':
        g.fillRect(x - 10, y - 2, 6, 11); g.fillRect(x - 3, y - 9, 6, 18); g.fillRect(x + 4, y - 4, 6, 13);
        g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x - 1, y - 5, 2, 3); g.fillRect(x + 6, y, 2, 3);
        break;
      case 'vein':
        g.beginPath(); g.moveTo(x, y - 12); g.lineTo(x + 7, y - 2); g.lineTo(x, y + 10); g.lineTo(x - 7, y - 2); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.moveTo(x, y - 12); g.lineTo(x + 2, y - 2); g.lineTo(x - 3, y - 1); g.closePath(); g.fill();
        break;
      case 'camp':
        g.beginPath(); g.moveTo(x - 11, y + 8); g.lineTo(x, y - 9); g.lineTo(x + 11, y + 8); g.closePath(); g.fill();
        g.fillStyle = '#2a1a10'; g.beginPath(); g.moveTo(x - 3, y + 8); g.lineTo(x, y + 1); g.lineTo(x + 3, y + 8); g.closePath(); g.fill();
        g.strokeStyle = col; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y - 9); g.lineTo(x, y - 15); g.lineTo(x + 6, y - 13); g.stroke();
        break;
      case 'lair':
        g.lineWidth = 2.6;
        for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(x - 7 + i * 5, y - 10); g.quadraticCurveTo(x + i * 5, y, x - 3 + i * 5, y + 10); g.stroke(); }
        break;
      case 'site':
        g.fillRect(x - 8, y - 5, 16, 14);
        g.fillRect(x - 8, y - 10, 4, 5); g.fillRect(x - 2, y - 10, 4, 5); g.fillRect(x + 4, y - 10, 4, 5);
        g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x - 2, y + 2, 4, 7);
        break;
      case 'vault':
        g.beginPath(); g.arc(x, y, 10, 0, 7); g.stroke();
        g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill();
        g.beginPath(); g.moveTo(x - 10, y); g.lineTo(x + 10, y); g.moveTo(x, y - 10); g.lineTo(x, y + 10); g.stroke();
        break;
      case 'nest':
        g.lineWidth = 2.6;
        g.beginPath();
        for (let a = 0; a < 14; a += 0.3) { const r = a * 1.1; const px = x + Math.cos(a + t / 900) * r, py = y + Math.sin(a + t / 900) * r; if (a) g.lineTo(px, py); else g.moveTo(px, py); }
        g.stroke();
        break;
      default: break;
    }
  }
  function drawNode(g, n, t, st) {
    const sel = WR.sel === n.id;
    const big = n.type === 'nest' ? 1.3 : 1;
    const r = 20 * big;
    const hostile = !n.cleared;
    g.globalAlpha = n.visited ? 1 : 0.85;
    if (n.id === st.baseNode) {
      g.fillStyle = 'rgba(127,176,105,0.18)'; g.beginPath(); g.arc(n.x, n.y, r + 16, 0, 7); g.fill();
    }
    g.fillStyle = 'rgba(14,12,10,0.88)'; g.beginPath(); g.arc(n.x, n.y, r + 3, 0, 7); g.fill();
    g.strokeStyle = n.type === 'landing' ? '#5fd4e6' : (hostile ? '#c0504d' : '#7fb069');
    g.lineWidth = 3; g.beginPath(); g.arc(n.x, n.y, r, 0, 7); g.stroke();
    if (sel) {
      g.strokeStyle = 'rgba(255,240,200,' + (0.6 + Math.sin(t / 200) * 0.3) + ')'; g.lineWidth = 2.5;
      g.beginPath(); g.arc(n.x, n.y, r + 9, 0, 7); g.stroke();
    }
    if (n.id === st.baseNode) {
      g.fillStyle = '#7fb069';
      g.beginPath(); g.moveTo(n.x - 11, n.y + 4); g.lineTo(n.x, n.y - 8); g.lineTo(n.x + 11, n.y + 4); g.lineTo(n.x + 8, n.y + 4); g.lineTo(n.x + 8, n.y + 11); g.lineTo(n.x - 8, n.y + 11); g.lineTo(n.x - 8, n.y + 4); g.closePath(); g.fill();
      g.strokeStyle = '#e3a33b'; g.lineWidth = 2; g.beginPath(); g.moveTo(n.x + 6, n.y - 4); g.lineTo(n.x + 6, n.y - 18); g.stroke();
      g.fillStyle = '#e3a33b'; g.beginPath(); g.moveTo(n.x + 6, n.y - 18); g.lineTo(n.x + 15, n.y - 15); g.lineTo(n.x + 6, n.y - 12); g.closePath(); g.fill();
    } else {
      nodeIcon(g, n, n.x, n.y, t);
    }
    if (hostile) {
      for (let i = 0; i < n.diff; i++) {
        const a = -Math.PI / 2 + (i - (n.diff - 1) / 2) * 0.32;
        g.fillStyle = '#e0473f';
        g.beginPath(); g.arc(n.x + Math.cos(a) * (r + 9), n.y + Math.sin(a) * (r + 9), 3, 0, 7); g.fill();
      }
    }
    if (n.beacon && n.type !== 'landing') {
      g.strokeStyle = '#5fd4e6'; g.lineWidth = 2;
      const bx = n.x - r - 2, by = n.y - r + 2;
      g.beginPath(); g.moveTo(bx, by + 10); g.lineTo(bx, by - 4); g.stroke();
      g.beginPath(); g.arc(bx, by - 4, 5 + Math.sin(t / 300) * 1.5, -2.4, -0.7); g.stroke();
    }
    if (n.outpost) {
      g.fillStyle = '#e3a33b'; g.fillRect(n.x + r - 2, n.y + r - 8, 8, 10);
      g.fillStyle = '#5fd4e6'; g.beginPath(); g.moveTo(n.x + r + 2, n.y + r + 6); g.lineTo(n.x + r - 1, n.y + r + 2); g.lineTo(n.x + r + 5, n.y + r + 2); g.closePath(); g.fill();
    }
    if (n.cargo && n.cargo.length) {
      const bx = n.x + r - 2, by = n.y - r - 4;
      g.fillStyle = '#8a6539'; g.fillRect(bx, by, 14, 11);
      g.strokeStyle = '#e3a33b'; g.lineWidth = 1.5; g.strokeRect(bx, by, 14, 11);
      g.beginPath(); g.moveTo(bx, by + 5.5); g.lineTo(bx + 14, by + 5.5); g.stroke();
    }
    g.globalAlpha = 1;
    const fs = Math.round(12.5 / Math.min(1, WR.cam.z));
    g.font = 'bold ' + fs + 'px sans-serif'; g.textAlign = 'center';
    g.lineWidth = 4; g.strokeStyle = 'rgba(10,8,6,0.9)';
    g.strokeText(n.name, n.x, n.y + r + 6 + fs);
    g.fillStyle = n.visited ? '#efe3cc' : '#bfb29a';
    g.fillText(n.name, n.x, n.y + r + 6 + fs);
  }

  WR.render = function (g, Wd, Hd, dpr) {
    const st = DW.G.state;
    if (!st || !bg) return;
    const t = performance.now();
    const z = WR.cam.z;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#0d0b09'; g.fillRect(0, 0, Wd, Hd);
    g.setTransform(dpr * z, 0, 0, dpr * z, dpr * (Wd / 2 - WR.cam.x * z), dpr * (Hd / 2 - WR.cam.y * z));
    g.drawImage(bg, 0, 0, W, H);
    const key = st.world.nodes.map(function (n) { return (n.known ? 1 : 0) + (n.visited ? 2 : 0); }).join('');
    if (key !== fogKey) { buildFog(st.world); fogKey = key; }
    g.imageSmoothingEnabled = true;
    g.drawImage(fogC, 0, 0, W, H);
    g.strokeStyle = 'rgba(200,160,110,0.3)'; g.lineWidth = 2;
    g.strokeRect(0, 0, W, H);

    const nodes = st.world.nodes;
    // путь к выбранной точке
    let pathSet = {};
    if (WR.sel !== null && WR.sel !== st.squadAt && !WR.anim) {
      const path = DW.G.findPath(st.squadAt, WR.sel);
      if (path) { let prev = st.squadAt; path.forEach(function (p) { pathSet[prev + '_' + p] = 1; pathSet[p + '_' + prev] = 1; prev = p; }); }
    }
    st.world.edges.forEach(function (e) {
      const a = nodes[e[0]], b = nodes[e[1]];
      if (!a.known || !b.known) return;
      const onPath = pathSet[e[0] + '_' + e[1]];
      const nearSquad = e[0] === st.squadAt || e[1] === st.squadAt;
      g.strokeStyle = onPath ? 'rgba(255,210,90,0.95)' : (nearSquad ? 'rgba(235,215,175,0.6)' : 'rgba(220,195,150,0.32)');
      g.lineWidth = onPath ? 4 : (nearSquad ? 3 : 2.2);
      g.setLineDash(onPath ? [] : [10, 8]);
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
    });
    g.setLineDash([]);
    nodes.forEach(function (n) { if (n.known) drawNode(g, n, t, st); });

    // набег
    if (st.raid && st.baseNode !== null) {
      const b = nodes[st.baseNode];
      const k = (t % 1200) / 1200;
      g.strokeStyle = 'rgba(224,71,63,' + (1 - k) + ')'; g.lineWidth = 3;
      g.beginPath(); g.arc(b.x, b.y, 26 + k * 30, 0, 7); g.stroke();
    }
    // отряд
    let sx, sy;
    if (WR.anim) {
      const a = WR.anim;
      const k = U.clamp((t - a.t0) / a.dur, 0, 1);
      const e = U.ease(k);
      sx = U.lerp(a.from.x, a.to.x, e); sy = U.lerp(a.from.y, a.to.y, e);
      if (k >= 1) { const r = a.res; WR.anim = null; r(); }
    } else { const n = nodes[st.squadAt]; sx = n.x; sy = n.y; }
    const bob = Math.sin(t / 300) * 3;
    const ty = sy - 34 + bob;
    g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.ellipse(sx, sy - 8, 9, 3, 0, 0, 7); g.fill();
    g.fillStyle = '#e3a33b';
    g.beginPath(); g.moveTo(sx, ty + 16); g.lineTo(sx - 12, ty - 2); g.arc(sx, ty - 4, 12, Math.PI * 0.85, Math.PI * 0.15); g.closePath(); g.fill();
    g.strokeStyle = '#1a140e'; g.lineWidth = 2; g.stroke();
    g.fillStyle = '#1a140e'; g.font = 'bold 13px sans-serif'; g.textAlign = 'center';
    g.fillText(String(st.roster.length), sx, ty);
  };

  WR.animateMove = function (fromId, toId) {
    const st = DW.G.state;
    const a = st.world.nodes[fromId], b = st.world.nodes[toId];
    WR.focus(b.x, b.y);
    return new Promise(function (res) {
      WR.anim = { from: a, to: b, t0: performance.now(), dur: 750 / ((DW.settings && DW.settings.speed) || 1), res: res };
    });
  };
  WR.hitNode = function (sx, sy) {
    const st = DW.G.state;
    const w = WR.s2w(sx, sy);
    let best = null, bd = 1e9;
    st.world.nodes.forEach(function (n) {
      if (!n.known) return;
      const d = Math.hypot(n.x - w[0], n.y - w[1]) * WR.cam.z;
      if (d < 34 && d < bd) { bd = d; best = n; }
    });
    return best;
  };

  DW.World = World;
  DW.WR = WR;
})(window.DW);
