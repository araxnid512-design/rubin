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
    spread('camp', 5, 2);   // лагеря банд, станы клана, блокпосты СОБР
    // жилы
    let vn = U.shuffle(free().filter(function (i) { return hops[i] >= 1; }));
    for (let k = 0; k < 5 && k < vn.length; k++) type[vn[k]] = 'vein';
    free().forEach(function (i) { type[i] = 'ruins'; });

    const names = {};
    for (const k in D.NODE_NAMES) names[k] = U.shuffle(D.NODE_NAMES[k].slice());
    const nodes = pts.map(function (p, i) {
      const tp = type[i];
      let diff = U.clamp(1 + Math.floor(hops[i] * 0.6), 1, 5);
      if (tp === 'lair') diff = Math.min(5, diff + 1);
      if (tp === 'vault') diff = Math.max(4, diff);
      if (tp === 'nest') diff = 5;
      if (tp === 'landing') diff = 1;
      const nm = names[tp].length ? names[tp].shift() : D.NODE_TYPES[tp].n;
      return {
        id: i, x: Math.round(p.x), y: Math.round(p.y), type: tp, name: nm, diff: diff, hops: hops[i],
        known: false, visited: false, cleared: false, beacon: tp === 'landing', outpost: false, base: false,
        cargo: null, searches: tp === 'ruins' ? 3 : 0,
        map: D.mapFor(tp, null, nm)
      };
    });
    // хозяева лагерей: дальний — СОБР, двое — клан, остальные — банды
    const camps = nodes.filter(function (n) { return n.type === 'camp'; }).sort(function (a, b) { return b.hops - a.hops; });
    camps.forEach(function (n, k) {
      n.fac = k === 0 ? 'sobr' : (k <= 2 ? 'clan' : 'raider');
      if (n.fac === 'sobr') { n.diff = Math.max(3, n.diff); n.map = D.mapFor('camp', 'sobr'); }
      const pool = D.NODE_NAMES[n.fac] && (names['_' + n.fac] = names['_' + n.fac] || U.shuffle(D.NODE_NAMES[n.fac].slice()));
      if (pool && pool.length) n.name = pool.shift();
    });
    return { nodes: nodes, edges: edges, landing: 0, seed: U.rand(1, 1e9) };
  }

  /* ---------- Отрисовка ---------- */
  const WR = {};
  const ART = DW.ART;
  let bg = null, bgSeed = null, fogC = null, fogKey = '';
  let baseKey = '', baseArt = null;
  WR.cam = { x: W / 2, y: H / 2, z: 1, tx: null, ty: null };
  WR.view = { w: 800, h: 400 };
  WR.sel = null;
  WR.anim = null;
  const LM = 0.62; // масштаб диорам на карте

  function canvas(w, h) { return ART.canvas(w, h); }
  function lerpC(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  const BGS = 1.5;
  let lakePts = [];
  function buildBg(world) {
    const c = canvas(W * BGS, H * BGS);
    const g = c.getContext('2d');
    g.scale(BGS, BGS);
    const seed = world.seed % 100000;
    const lw = 400, lh = 250;
    const hf = new Float32Array(lw * lh);
    for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) {
      const n = U.fbm(x * 0.0144, y * 0.0144, seed, 5);
      const r = 1 - Math.abs(U.noise(x * 0.0096 + 50, y * 0.0096, seed + 3) * 2 - 1);
      hf[y * lw + x] = n * 0.72 + r * r * 0.34;
    }
    const lc = canvas(lw, lh);
    const lg = lc.getContext('2d');
    const img = lg.createImageData(lw, lh);
    const pal = [[0, [44, 34, 26]], [0.36, [70, 54, 38]], [0.48, [116, 94, 66]], [0.6, [134, 112, 80]], [0.72, [118, 106, 94]], [0.86, [158, 150, 138]], [1.2, [176, 170, 160]]];
    for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) {
      const i = y * lw + x;
      const h = hf[i];
      const dx = hf[y * lw + Math.min(lw - 1, x + 1)] - hf[y * lw + Math.max(0, x - 1)];
      const dy = hf[Math.min(lh - 1, y + 1) * lw + x] - hf[Math.max(0, y - 1) * lw + x];
      const shade = U.clamp(1 + (-dx * 1.1 - dy) * 11, 0.45, 1.55);
      let col = pal[pal.length - 1][1];
      for (let k = 0; k < pal.length - 1; k++) {
        if (h < pal[k + 1][0]) { col = lerpC(pal[k][1], pal[k + 1][1], (h - pal[k][0]) / (pal[k + 1][0] - pal[k][0])); break; }
      }
      const rust = U.fbm(x * 0.04 + 300, y * 0.04, seed + 9, 3);
      if (rust > 0.6) col = lerpC(col, [col[0] * 1.15, col[1] * 0.86, col[2] * 0.7], (rust - 0.6) * 2.5);
      const k = i * 4;
      const warm = shade > 1 ? (shade - 1) * 0.35 : 0, cool = shade < 1 ? (1 - shade) * 0.5 : 0;
      img.data[k] = U.clamp(col[0] * shade * (1 + warm * 0.3) * (1 - cool * 0.25), 0, 255);
      img.data[k + 1] = U.clamp(col[1] * shade * (1 + warm * 0.12) * (1 - cool * 0.1), 0, 255);
      img.data[k + 2] = U.clamp(col[2] * shade * (1 - warm * 0.15) * (1 + cool * 0.25), 0, 255);
      img.data[k + 3] = 255;
    }
    lg.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = true;
    g.drawImage(lc, 0, 0, W, H);
    // мелкая фактура трещин и камней поверх рельефа
    try {
      const pat = g.createPattern(DW.TR.matTex('earth'), 'repeat');
      g.save(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.22; g.scale(0.32, 0.32); g.fillStyle = pat; g.fillRect(0, 0, W * 3.2, H * 3.2); g.restore();
      const pat2 = g.createPattern(DW.TR.matTex('grain'), 'repeat');
      g.save(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.45; g.scale(0.25, 0.25); g.fillStyle = pat2; g.fillRect(0, 0, W * 4, H * 4); g.restore();
    } catch (e) { /* ignore */ }
    // кислотные озёра в низинах
    {
      const mc = canvas(lw, lh), mg = mc.getContext('2d');
      const mi = mg.createImageData(lw, lh);
      const shore = canvas(lw, lh), sg2 = shore.getContext('2d');
      const si = sg2.createImageData(lw, lh);
      lakePts = [];
      for (let i = 0; i < lw * lh; i++) {
        const h = hf[i];
        if (h < 0.27) {
          const a = U.clamp((0.27 - h) * 14, 0, 1);
          mi.data[i * 4] = 70; mi.data[i * 4 + 1] = 110; mi.data[i * 4 + 2] = 30; mi.data[i * 4 + 3] = a * 230;
          if (a > 0.6 && (i % 37) === 0 && lakePts.length < 60) lakePts.push([(i % lw) * W / lw, ((i / lw) | 0) * H / lh]);
        }
        if (h < 0.3) { const a2 = U.clamp((0.3 - h) * 10, 0, 1); si.data[i * 4] = 150; si.data[i * 4 + 1] = 140; si.data[i * 4 + 2] = 100; si.data[i * 4 + 3] = a2 * 120; }
      }
      sg2.putImageData(si, 0, 0); mg.putImageData(mi, 0, 0);
      g.drawImage(shore, 0, 0, W, H);
      g.drawImage(mc, 0, 0, W, H);
      g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.25; g.drawImage(mc, -2, -2, W, H); g.restore();
    }
    const rnd = U.srng(world.seed);
    const sx = W / lw, sy = H / lh;
    const hAt = function (x, y) { const ix = U.clamp(Math.floor(x / sx), 0, lw - 1), iy = U.clamp(Math.floor(y / sy), 0, lh - 1); return hf[iy * lw + ix]; };
    // зернистость
    for (let i = 0; i < 9000; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.08)' : 'rgba(255,240,210,0.05)'; g.fillRect(rnd() * W, rnd() * H, 1.5, 1.5); }
    // пересохшие реки
    for (let r = 0; r < 4; r++) {
      let x = rnd() * W, y = rnd() * H;
      for (let tries = 0; tries < 30; tries++) { const nx = rnd() * W, ny = rnd() * H; if (hAt(nx, ny) > hAt(x, y)) { x = nx; y = ny; } }
      const pts = [[x, y]];
      for (let s = 0; s < 260; s++) {
        let best = null, bh = hAt(x, y) + 0.004;
        for (let a = 0; a < 8; a++) {
          const ang = a / 8 * Math.PI * 2 + rnd() * 0.4, nx = x + Math.cos(ang) * 7, ny = y + Math.sin(ang) * 7;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const hh = hAt(nx, ny);
          if (hh < bh) { bh = hh; best = [nx, ny]; }
        }
        if (!best) { const ang = rnd() * Math.PI * 2; best = [x + Math.cos(ang) * 7, y + Math.sin(ang) * 7]; }
        x = best[0]; y = best[1];
        if (x < 0 || y < 0 || x >= W || y >= H) break;
        pts.push([x, y]);
      }
      const stroke = function (w, col) { g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); pts.forEach(function (p, i) { if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); g.stroke(); };
      stroke(9, 'rgba(25,18,12,0.35)'); stroke(4, 'rgba(150,130,100,0.35)'); stroke(1.2, 'rgba(30,22,15,0.5)');
    }
    // хребты
    for (let i = 0; i < 260; i++) {
      const x = rnd() * W, y = rnd() * H;
      const h = hAt(x, y);
      if (h < 0.7) continue;
      const ph = 10 + (h - 0.7) * 120 + rnd() * 8, pw = ph * (0.9 + rnd() * 0.5);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.moveTo(x - pw, y); g.lineTo(x + pw * 0.4, y - ph * 0.2); g.lineTo(x + pw * 1.4, y + 3); g.closePath(); g.fill();
      g.fillStyle = 'rgb(' + (150 + h * 40) + ',' + (138 + h * 40) + ',' + (120 + h * 40) + ')';
      g.beginPath(); g.moveTo(x - pw, y); g.lineTo(x, y - ph); g.lineTo(x + 2, y); g.closePath(); g.fill();
      g.fillStyle = 'rgb(' + (82 + h * 30) + ',' + (72 + h * 30) + ',' + (64 + h * 30) + ')';
      g.beginPath(); g.moveTo(x, y - ph); g.lineTo(x + pw, y); g.lineTo(x + 2, y); g.closePath(); g.fill();
    }
    // старое шоссе
    {
      let x = -20, y = 150 + rnd() * (H - 300);
      const pts = [];
      while (x < W + 20) { pts.push([x, y]); x += 40; y += (rnd() - 0.5) * 30; }
      g.lineCap = 'butt';
      for (let i = 1; i < pts.length; i++) {
        if (rnd() < 0.18) continue;
        const a = pts[i - 1], b = pts[i];
        g.strokeStyle = 'rgba(30,28,26,0.55)'; g.lineWidth = 11; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
        g.strokeStyle = 'rgba(70,66,60,0.6)'; g.lineWidth = 8; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
        g.strokeStyle = 'rgba(200,170,90,0.45)'; g.lineWidth = 1.2; g.setLineDash([8, 9]); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); g.setLineDash([]);
      }
    }
    // скелет гиганта
    {
      let bx = 0, by = 0, far = -1;
      for (let k = 0; k < 40; k++) {
        const x = 200 + rnd() * (W - 400), y = 150 + rnd() * (H - 300);
        let d = 1e9; world.nodes.forEach(function (n) { d = Math.min(d, Math.hypot(n.x - x, n.y - y)); });
        if (d > far) { far = d; bx = x; by = y; }
      }
      const ang = rnd() * Math.PI;
      g.save(); g.translate(bx, by); g.rotate(ang);
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 9; g.beginPath(); g.moveTo(-90, 4); g.quadraticCurveTo(0, -10, 90, 4); g.stroke();
      g.strokeStyle = '#d6cab2'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(-90, 0); g.quadraticCurveTo(0, -14, 90, 0); g.stroke();
      for (let k = -6; k <= 6; k++) {
        g.strokeStyle = '#cfc2a8'; g.lineWidth = 3.4;
        g.beginPath(); g.moveTo(k * 11, -7 + Math.abs(k) * 0.5); g.quadraticCurveTo(k * 11 + 10, -40, k * 11 + 4, -52 + Math.abs(k) * 3); g.stroke();
        g.beginPath(); g.moveTo(k * 11, -7 + Math.abs(k) * 0.5); g.quadraticCurveTo(k * 11 + 10, 26, k * 11 + 4, 38 - Math.abs(k) * 3); g.stroke();
      }
      g.fillStyle = '#d6cab2'; g.beginPath(); g.ellipse(104, 0, 18, 11, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#2a2018'; g.beginPath(); g.arc(108, -3, 3.5, 0, 7); g.fill();
      g.restore();
    }
    // кратеры
    for (let k = 0; k < 30; k++) {
      const x = rnd() * W, y = rnd() * H, r = 8 + rnd() * 28;
      g.fillStyle = 'rgba(15,10,6,0.32)'; g.beginPath(); g.ellipse(x + 2, y + 2, r, r * 0.62, 0, 0, 7); g.fill();
      g.strokeStyle = 'rgba(230,210,180,0.18)'; g.lineWidth = 2.5; g.beginPath(); g.ellipse(x, y, r, r * 0.62, 0, 0.3, 2.8); g.stroke();
    }
    // мёртвые леса
    for (let k = 0; k < 16; k++) {
      const cx = rnd() * W, cy = rnd() * H;
      if (hAt(cx, cy) > 0.68) continue;
      for (let s = 0; s < 40; s++) {
        const x = cx + (rnd() - 0.5) * 130, y = cy + (rnd() - 0.5) * 80, h = 6 + rnd() * 6;
        g.strokeStyle = 'rgba(0,0,0,0.2)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + h * 0.6, y + 2); g.stroke();
        g.strokeStyle = 'rgba(38,28,20,0.75)'; g.lineWidth = 1.3;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - h); g.moveTo(x, y - h * 0.6); g.lineTo(x - 3, y - h * 0.9); g.moveTo(x, y - h * 0.7); g.lineTo(x + 3, y - h); g.stroke();
      }
    }
    // детали вокруг локаций
    world.nodes.forEach(function (n) {
      if (n.type === 'ruins' || n.type === 'site') {
        for (let s = 0; s < 16; s++) {
          const x = n.x + (rnd() - 0.5) * 150, y = n.y + (rnd() - 0.5) * 100;
          if (Math.hypot(x - n.x, y - n.y) < 40) continue;
          g.save(); g.translate(x, y);
          const h = 4 + rnd() * 12;
          ART.box(g, -0.5, -0.5, 0.5, 0.5, 0, h, '#8a7f72', '#6a5e52', '#4e443a', { hw: 4 + rnd() * 3, hh: 2 + rnd() * 1.5, edge: false });
          g.restore();
        }
      } else if (n.type === 'vein') {
        for (let s = 0; s < 26; s++) {
          const x = n.x + (rnd() - 0.5) * 140, y = n.y + (rnd() - 0.5) * 100, sz = 2 + rnd() * 4;
          g.fillStyle = 'rgba(95,212,230,' + (0.3 + rnd() * 0.4) + ')';
          g.beginPath(); g.moveTo(x, y - sz * 1.8); g.lineTo(x + sz * 0.6, y); g.lineTo(x, y + sz * 0.4); g.lineTo(x - sz * 0.6, y); g.closePath(); g.fill();
        }
      } else if (n.type === 'lair' || n.type === 'nest') {
        const big = n.type === 'nest' ? 2 : 1;
        for (let s = 0; s < 7; s++) {
          const x = n.x + (rnd() - 0.5) * 140 * big, y = n.y + (rnd() - 0.5) * 100 * big, r = (12 + rnd() * 20) * big;
          const gr = g.createRadialGradient(x, y, 1, x, y, r);
          gr.addColorStop(0, 'rgba(120,160,30,0.45)'); gr.addColorStop(1, 'rgba(120,160,30,0)');
          g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
        }
        if (n.type === 'nest') {
          g.strokeStyle = 'rgba(130,40,80,0.45)'; g.lineWidth = 3.5;
          for (let s = 0; s < 14; s++) {
            g.beginPath(); g.moveTo(n.x, n.y);
            g.bezierCurveTo(n.x + (rnd() - 0.5) * 240, n.y + (rnd() - 0.5) * 200, n.x + (rnd() - 0.5) * 320, n.y + (rnd() - 0.5) * 300, n.x + (rnd() - 0.5) * 420, n.y + (rnd() - 0.5) * 320);
            g.stroke();
          }
        }
      }
    });
    g.strokeStyle = 'rgba(255,230,190,0.045)'; g.lineWidth = 1;
    for (let x = 0; x <= W; x += 100) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    for (let y = 0; y <= H; y += 100) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    const vg = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.72);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    return c;
  }
  function buildFog(world) {
    if (!fogC) fogC = canvas(W / 4, H / 4);
    const g = fogC.getContext('2d');
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, fogC.width, fogC.height);
    g.fillStyle = 'rgba(12,11,10,0.9)'; g.fillRect(0, 0, fogC.width, fogC.height);
    g.globalCompositeOperation = 'destination-out';
    world.nodes.forEach(function (n) {
      if (!n.known) return;
      const r = (n.visited ? 240 : 160) / 4;
      const x = n.x / 4, y = n.y / 4;
      const rr = U.srng(n.id * 31 + 7);
      for (let k = 0; k < 7; k++) {
        const a = k / 7 * Math.PI * 2 + rr(), d = k ? r * (0.25 + rr() * 0.35) : 0, rk = k ? r * (0.55 + rr() * 0.35) : r;
        const cx = x + Math.cos(a) * d, cy = y + Math.sin(a) * d * 0.8;
        const gr = g.createRadialGradient(cx, cy, rk * 0.3, cx, cy, rk);
        gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, rk, 0, 7); g.fill();
      }
    });
    g.globalCompositeOperation = 'source-over';
  }
  /* Блики на кислотных озёрах */
  function lakeGlints(g, t) {
    lakePts.forEach(function (p, i) {
      const a = Math.max(0, Math.sin(t / 700 + i * 1.7)) * 0.6;
      if (a < 0.05) return;
      g.fillStyle = 'rgba(200,255,140,' + a + ')';
      g.fillRect(p[0] + Math.sin(t / 1300 + i) * 3, p[1], 3, 1);
    });
  }
  /* Дрейфующая дымка над неразведанным */
  let mistC = null, mistTex = null, mistT = 0;
  function mistLayer(g, t) {
    if (!fogC) return;
    if (!mistTex) {
      mistTex = canvas(128, 128);
      const mg = mistTex.getContext('2d'), img = mg.createImageData(128, 128);
      for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
        let v = 0, amp = 0.5, f = 4;
        for (let o = 0; o < 3; o++) { const per = f; const xi = x / 128 * per, yi = y / 128 * per; v += pnoiseW(xi, yi, per, 11 + o) * amp; amp *= 0.5; f *= 2; }
        const k = (y * 128 + x) * 4;
        img.data[k] = 120; img.data[k + 1] = 112; img.data[k + 2] = 102; img.data[k + 3] = U.clamp((v - 0.38) * 2.4, 0, 1) * 130;
      }
      mg.putImageData(img, 0, 0);
    }
    if (!mistC) mistC = canvas(fogC.width, fogC.height);
    if (t - mistT > 60) {
      mistT = t;
      const m = mistC.getContext('2d');
      m.globalCompositeOperation = 'source-over';
      m.clearRect(0, 0, mistC.width, mistC.height);
      m.drawImage(fogC, 0, 0);
      m.globalCompositeOperation = 'source-in';
      const pat = m.createPattern(mistTex, 'repeat');
      const ox = (t / 260) % 128, oy = (t / 900) % 128;
      m.save(); m.translate(-ox, -oy); m.fillStyle = pat; m.fillRect(0, 0, mistC.width + 256, mistC.height + 256); m.restore();
      m.globalCompositeOperation = 'source-over';
    }
    g.globalAlpha = 0.4; g.drawImage(mistC, 0, 0, W, H); g.globalAlpha = 1;
  }
  function pnoiseW(x, y, per, seed) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const x0 = ((xi % per) + per) % per, y0 = ((yi % per) + per) % per, x1 = (x0 + 1) % per, y1 = (y0 + 1) % per;
    const a = U.hash2(x0, y0, seed), b = U.hash2(x1, y0, seed), c = U.hash2(x0, y1, seed), d = U.hash2(x1, y1, seed);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
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
    const m = 130;
    WR.cam.x = W + 2 * m < hw * 2 ? W / 2 : U.clamp(WR.cam.x, hw - m, W - hw + m);
    WR.cam.y = H + 2 * m < hh * 2 ? H / 2 : U.clamp(WR.cam.y, hh - m, H - hh + m);
  }
  WR.pan = function (dx, dy) { WR.cam.x -= dx / WR.cam.z; WR.cam.y -= dy / WR.cam.z; WR.cam.tx = null; clampCam(); };
  WR.zoomAt = function (f, sx, sy) {
    const b = WR.s2w(sx, sy);
    WR.cam.z = U.clamp(WR.cam.z * f, 0.35, 2.2);
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

  function roadCurve(a, b, e) {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
    const k = (U.hash2(e[0], e[1], 99) - 0.5) * 0.35 * L;
    return [mx - dy / L * k, my + dx / L * k];
  }
  function plaque(g, text, x, y, fs, bright) {
    g.font = 'bold ' + fs + 'px sans-serif';
    const w = g.measureText(text).width + fs * 0.9, h = fs * 1.45;
    g.fillStyle = 'rgba(18,14,10,0.82)';
    g.beginPath();
    const r = h * 0.3;
    g.moveTo(x - w / 2 + r, y - h / 2); g.lineTo(x + w / 2 - r, y - h / 2); g.quadraticCurveTo(x + w / 2, y - h / 2, x + w / 2, y - h / 2 + r);
    g.lineTo(x + w / 2, y + h / 2 - r); g.quadraticCurveTo(x + w / 2, y + h / 2, x + w / 2 - r, y + h / 2); g.lineTo(x - w / 2 + r, y + h / 2);
    g.quadraticCurveTo(x - w / 2, y + h / 2, x - w / 2, y + h / 2 - r); g.lineTo(x - w / 2, y - h / 2 + r); g.quadraticCurveTo(x - w / 2, y - h / 2, x - w / 2 + r, y - h / 2);
    g.closePath(); g.fill();
    g.strokeStyle = bright ? 'rgba(232,168,62,0.7)' : 'rgba(150,120,80,0.45)'; g.lineWidth = 1; g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = bright ? '#f6e6c8' : '#c8b898'; g.fillText(text, x, y + 0.5);
    g.textBaseline = 'alphabetic';
  }
  function drawNode(g, n, t, st) {
    const sel = WR.sel === n.id;
    const hostile = !n.cleared;
    const isBase = n.id === st.baseNode;
    const ringC = n.type === 'landing' ? '95,212,230' : (isBase ? '232,168,62' : (hostile ? '224,71,63' : '127,200,105'));
    g.globalAlpha = n.visited ? 1 : 0.8;
    // кольцо статуса
    const pulse = hostile ? 0.55 + Math.sin(t / 400 + n.id) * 0.2 : 0.7;
    const gr = g.createRadialGradient(n.x, n.y + 2, 10, n.x, n.y + 2, 44);
    gr.addColorStop(0, 'rgba(' + ringC + ',0)'); gr.addColorStop(0.75, 'rgba(' + ringC + ',' + (0.18 * pulse) + ')'); gr.addColorStop(1, 'rgba(' + ringC + ',0)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(n.x, n.y + 2, 46, 25, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(' + ringC + ',' + pulse + ')'; g.lineWidth = 2.5;
    g.beginPath(); g.ellipse(n.x, n.y + 2, 40, 21, 0, 0, Math.PI * 2); g.stroke();
    if (sel) {
      g.strokeStyle = 'rgba(255,245,220,' + (0.6 + Math.sin(t / 200) * 0.3) + ')'; g.lineWidth = 2;
      g.setLineDash([6, 5]); g.lineDashOffset = -t / 60;
      g.beginPath(); g.ellipse(n.x, n.y + 2, 50, 27, 0, 0, Math.PI * 2); g.stroke();
      g.setLineDash([]);
    }
    // диорама
    let art;
    if (isBase) {
      const key = JSON.stringify(st.buildings);
      if (key !== baseKey || !baseArt) { baseKey = key; baseArt = ART.landmark('base', { key: key, b: st.buildings }); }
      art = baseArt;
    } else art = ART.landmark(n.type);
    const sc = (n.type === 'nest' ? 0.85 : LM);
    if (isBase) baseLife(g, n, t, st, false);
    g.drawImage(art, n.x - 64 * sc, n.y - 70 * sc, 128 * sc, 104 * sc);
    g.globalAlpha = 1;
    if (isBase) { baseLife(g, n, t, st, true); baseSmoke(g, n, t); }
    if (n.type === 'landing') portalShimmer(g, n, t);
    if (hostile) {
      for (let i = 0; i < n.diff; i++) {
        const x = n.x - (n.diff - 1) * 6 + i * 12, y = n.y - 44;
        const sg = g.createRadialGradient(x - 1, y - 1, 0.5, x, y, 5);
        sg.addColorStop(0, '#ffb0a0'); sg.addColorStop(0.6, '#d0392e'); sg.addColorStop(1, '#5a1410');
        g.fillStyle = sg; g.beginPath(); g.arc(x, y, 4.5, 0, 7); g.fill();
      }
    }
    if (n.beacon && n.type !== 'landing' && !isBase) {
      const bx = n.x - 36, by = n.y - 26;
      g.strokeStyle = '#8a969e'; g.lineWidth = 2; g.beginPath(); g.moveTo(bx, by + 14); g.lineTo(bx, by - 6); g.stroke();
      g.strokeStyle = 'rgba(111,216,255,' + (0.5 + Math.sin(t / 250) * 0.4) + ')'; g.lineWidth = 2;
      g.beginPath(); g.arc(bx, by - 6, 6, -2.4, -0.7); g.stroke(); g.beginPath(); g.arc(bx, by - 6, 10, -2.4, -0.7); g.stroke();
    }
    if (n.outpost) {
      g.save(); g.translate(n.x + 30, n.y - 8);
      ART.box(g, -0.5, -0.5, 0.5, 0.5, 0, 6, '#8a7a5a', '#6a5a3e', '#544630', { hw: 7, hh: 3.5 });
      g.strokeStyle = '#55606a'; g.lineWidth = 2; g.beginPath(); g.moveTo(-5, -6); g.lineTo(0, -22); g.lineTo(5, -6); g.stroke();
      g.fillStyle = '#e3a33b'; g.beginPath(); g.arc(0, -22 + Math.sin(t / 150) * 1.5, 2, 0, 7); g.fill();
      g.restore();
    }
    if (n.quest && !n.cleared) {
      // сюжетное задание — золотая звезда
      g.save(); g.translate(n.x, n.y - 58 + Math.sin(t / 260) * 2.5);
      g.shadowColor = 'rgba(255,200,80,0.9)'; g.shadowBlur = 10;
      g.fillStyle = '#ffcf5a'; g.strokeStyle = '#7a4a10'; g.lineWidth = 1.5;
      g.beginPath();
      for (let k = 0; k < 10; k++) { const r = k % 2 ? 4.5 : 10, a = -Math.PI / 2 + k * Math.PI / 5; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      g.closePath(); g.fill(); g.shadowBlur = 0; g.stroke();
      g.restore();
    }
    if (n.cargo && n.cargo.length) {
      g.save(); g.translate(n.x + 32, n.y - 34 + Math.sin(t / 300) * 2);
      ART.box(g, -0.5, -0.5, 0.5, 0.5, 0, 9, '#b08850', '#8a6539', '#6a4c2a', { hw: 8, hh: 4 });
      g.strokeStyle = '#e3a33b'; g.lineWidth = 1.2; g.strokeRect(-6, -10, 12, 2);
      g.restore();
    }
    const fs = Math.round(11.5 / Math.min(1, WR.cam.z));
    const near = n.id === st.squadAt || DW.G.neighbors(st.squadAt).indexOf(n.id) >= 0;
    if (WR.cam.z >= 0.62 || sel || near || isBase) plaque(g, n.name, n.x, n.y + 34 + fs * 0.4, fs, n.visited || sel);
  }

  /* ---------- Живой мир: база, патрули, набеги, ночь, грузы ---------- */
  const looks = [];
  function lookN(i) { if (!looks[i]) looks[i] = ART.makeLook(4242 + i * 97, { glasses: false }); return looks[i]; }
  const CLOTH = ['#c8691c', '#6a6a5a', '#5a4a3a', '#7a6a4a', '#4a5a5a', '#c8691c'];
  function baseLife(g, n, t, st, front) {
    let nb = 0; for (const k in st.buildings) if (st.buildings[k]) nb++;
    const cnt = 2 + Math.min(3, nb >> 1);
    for (let i = 0; i < cnt; i++) {
      const dir = i % 2 ? -1 : 1;
      const a = t / (5200 + i * 900) * Math.PI * 2 * dir + i * 2.3;
      const sa = Math.sin(a);
      if ((sa > 0) !== front) continue;
      const x = n.x + Math.cos(a) * (22 + (i % 3) * 3), y = n.y + 2 + sa * (9 + (i % 2) * 2);
      const vx = -Math.sin(a) * dir;
      g.save(); g.translate(x, y); g.scale(0.3, 0.3);
      ART.human(g, { look: lookN(i), body: CLOTH[i % CLOTH.length], weapon: i % 3 === 0 ? 'ppsh' : null, dir: vx >= 0 ? 1 : -1, aim: 0.6, walk: t / 110 + i * 1.7, seed: i }, t);
      g.restore();
    }
  }
  function baseSmoke(g, n, t) {
    g.fillStyle = '#3a2e24'; g.fillRect(n.x - 6, n.y - 24, 3, 6);
    for (let i = 0; i < 9; i++) {
      const ph = ((t / 3400) + i / 9) % 1;
      const x = n.x - 4.5 + Math.sin(ph * 5 + i) * 2 + ph * 16, y = n.y - 25 - ph * 44;
      g.fillStyle = 'rgba(160,150,140,' + (0.34 * (1 - ph) * Math.min(1, ph * 6)) + ')';
      g.beginPath(); g.arc(x, y, 2 + ph * 8, 0, 7); g.fill();
    }
    // костёр
    const fx = n.x + 12, fy = n.y + 8;
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(fx, fy, 5, 2, 0, 0, 7); g.fill();
    g.strokeStyle = '#4a3220'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(fx - 4, fy + 1); g.lineTo(fx + 4, fy - 1); g.moveTo(fx - 4, fy - 1); g.lineTo(fx + 4, fy + 1); g.stroke();
    for (let k = 0; k < 3; k++) {
      const h = 5 + Math.sin(t / 90 + k * 2) * 1.6;
      g.fillStyle = ['rgba(255,120,30,0.9)', 'rgba(255,190,60,0.9)', 'rgba(255,240,160,0.85)'][k];
      g.beginPath(); g.moveTo(fx - 2.6 + k * 1.2, fy); g.quadraticCurveTo(fx - 1 + k, fy - h, fx + Math.sin(t / 120 + k) * 0.8, fy - h - 2 + k);
      g.quadraticCurveTo(fx + 2 - k * 0.5, fy - h * 0.5, fx + 2.6 - k * 1.2, fy); g.closePath(); g.fill();
    }
  }
  function portalShimmer(g, n, t) {
    const px = n.x, py = n.y - 22;
    const gl = 0.3 + Math.sin(t / 380) * 0.12;
    const gr = g.createRadialGradient(px, py, 1, px, py, 16);
    gr.addColorStop(0, 'rgba(170,245,255,' + gl + ')'); gr.addColorStop(1, 'rgba(95,212,230,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(px, py, 16, 0, 7); g.fill();
    for (let i = 0; i < 5; i++) {
      const k = ((t / 1400) + i / 5) % 1, a = i * 2.4 + t / 900;
      g.fillStyle = 'rgba(170,245,255,' + (0.7 * (1 - k)) + ')';
      g.fillRect(px + Math.cos(a) * 10 * (1 - k), py + Math.sin(a) * 14 * (1 - k), 1.4, 1.4);
    }
  }
  const BANDIT = { body: '#4a3a2e', pants: '#2a2520', mask: '#2a2a2a', robe: false };
  function patrols(g, st, t) {
    st.world.nodes.forEach(function (n) {
      if (!n.known || n.cleared || n.id === st.baseNode) return;
      if (n.type === 'camp') {
        // патруль лагеря: банда — 2, клан — 3 (их много), СОБР — 2 в чёрном с касками
        const F = n.fac === 'sobr' ? { body: '#1e2226', pants: '#15181a', mask: '#111', helmet: true, hc: '#2c3a30', w: 'ak2', k: 2 } : (n.fac === 'clan' ? { body: '#2a2622', pants: '#1c1a18', mask: null, w: 'ak', k: 3 } : { body: BANDIT.body, pants: BANDIT.pants, mask: BANDIT.mask, w: 'ak', k: 2 });
        for (let i = 0; i < F.k; i++) {
          const a = t / 2600 + n.id + i * 2.1, x = n.x + Math.sin(a) * 30, y = n.y + 16 + i * 5;
          g.save(); g.translate(x, y); g.scale(0.3, 0.3);
          ART.human(g, { look: lookN(10 + i + (n.fac === 'clan' ? 5 : 0)), body: F.body, pants: F.pants, mask: F.mask, robe: false, weapon: F.w, helmet: !!F.helmet, helmetColor: F.hc, armor: n.fac === 'sobr' ? 'vest' : null, dir: Math.cos(a) >= 0 ? 1 : -1, aim: 0.2, walk: t / 110 + i, seed: 20 + i }, t);
          g.restore();
        }
      } else if (n.type === 'lair' || n.type === 'nest') {
        const a = t / 3000 + n.id;
        const x = n.x + Math.cos(a) * 30, y = n.y + 10 + Math.sin(a) * 9;
        g.save(); g.translate(x, y); g.scale(0.32, 0.32);
        ART.creature(g, 'scav', { dir: -Math.sin(a) >= 0 ? 1 : -1, walk: t / 120, seed: n.id }, t);
        g.restore();
      }
    });
  }
  function edgeOf(a, b) {
    return DW.G.state.world.edges.find(function (e) { return (e[0] === a && e[1] === b) || (e[0] === b && e[1] === a); });
  }
  function qpt(a, cp, b, u) { const v = 1 - u; return [v * v * a.x + 2 * v * u * cp[0] + u * u * b.x, v * v * a.y + 2 * v * u * cp[1] + u * u * b.y]; }
  let raidShow = null, raidKey = '', raidPath = null, lastT = 0;
  function drawRaid(g, st, t) {
    const r = st.raid;
    if (!r || r.from === undefined || r.from === null || st.baseNode === null) { raidShow = null; return; }
    const nodes = st.world.nodes;
    const key = r.from + '_' + st.baseNode + '_' + r.start;
    if (key !== raidKey) { raidKey = key; raidPath = DW.G.roadPath(r.from, st.baseNode); raidShow = null; }
    const path = raidPath, segs = path.length - 1;
    if (segs < 1) return;
    const tot = Math.max(1, r.day - r.start);
    const target = U.clamp((st.day - r.start) / tot, 0, 1) * 0.82;
    const dt = Math.min(0.1, Math.max(0, (t - lastT) / 1000));
    raidShow = raidShow === null ? target : raidShow + (target - raidShow) * Math.min(1, dt * 1.6);
    const f = raidShow * segs, si = Math.min(segs - 1, Math.floor(f)), u = f - si;
    const pa = nodes[path[si]], pb = nodes[path[si + 1]];
    const e = edgeOf(path[si], path[si + 1]);
    const cp = e ? roadCurve(nodes[e[0]], nodes[e[1]], e) : [(pa.x + pb.x) / 2, (pa.y + pb.y) / 2];
    const pos = qpt(pa, cp, pb, u);
    WR.raidPos = pos;
    // оставшийся путь
    g.strokeStyle = 'rgba(224,71,63,0.75)'; g.lineWidth = 2.5; g.setLineDash([7, 6]); g.lineDashOffset = -t / 50;
    g.beginPath(); g.moveTo(pos[0], pos[1]);
    for (let k = 0; k <= 12; k++) { const p = qpt(pa, cp, pb, u + (1 - u) * k / 12); g.lineTo(p[0], p[1]); }
    for (let s2 = si + 1; s2 < segs; s2++) {
      const a2 = nodes[path[s2]], b2 = nodes[path[s2 + 1]], e2 = edgeOf(path[s2], path[s2 + 1]);
      const c2 = e2 ? roadCurve(nodes[e2[0]], nodes[e2[1]], e2) : [(a2.x + b2.x) / 2, (a2.y + b2.y) / 2];
      for (let k = 1; k <= 12; k++) { const p = qpt(a2, c2, b2, k / 12); g.lineTo(p[0], p[1]); }
    }
    g.stroke(); g.setLineDash([]); g.lineDashOffset = 0;
    // маркер банды
    const pk = (t % 1000) / 1000;
    g.strokeStyle = 'rgba(224,71,63,' + (0.9 * (1 - pk)) + ')'; g.lineWidth = 2;
    g.beginPath(); g.ellipse(pos[0], pos[1] + 2, 14 + pk * 16, 6 + pk * 7, 0, 0, 7); g.stroke();
    g.fillStyle = 'rgba(224,71,63,0.25)'; g.beginPath(); g.ellipse(pos[0], pos[1] + 2, 16, 7, 0, 0, 7); g.fill();
    const ahead = qpt(pa, cp, pb, Math.min(1, u + 0.05));
    const dir = ahead[0] >= pos[0] ? 1 : -1;
    for (let i = 0; i < 3; i++) {
      g.save(); g.translate(pos[0] - dir * i * 9 + (i === 1 ? 2 : 0), pos[1] + (i === 1 ? 4 : 0)); g.scale(0.38, 0.38);
      if (r.kind === 'beast') ART.creature(g, i === 1 ? 'brute' : 'scav', { dir: dir, walk: t / 100 + i, seed: i, scale: i === 1 ? 0.7 : 1 }, t);
      else ART.human(g, { look: lookN(12 + i), body: BANDIT.body, pants: BANDIT.pants, mask: BANDIT.mask, robe: false, weapon: i === 1 ? 'shotgun' : 'ak', dir: dir, aim: 0.15, walk: t / 100 + i, seed: 30 + i }, t);
      g.restore();
    }
    // флажок с днями
    const left = Math.max(0, r.day - st.day);
    const fx = pos[0] + 12, fy = pos[1] - 24;
    g.strokeStyle = '#2a1a12'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(fx, fy + 22); g.lineTo(fx, fy - 4); g.stroke();
    g.fillStyle = '#c0302a'; g.beginPath(); g.moveTo(fx, fy - 4); g.lineTo(fx + 18, fy); g.lineTo(fx, fy + 5); g.closePath(); g.fill();
    g.fillStyle = '#fff'; g.font = 'bold 8px sans-serif'; g.textAlign = 'center'; g.fillText(left + 'д', fx + 7, fy + 3);
  }
  function drawFx(g, st, t) {
    WR.fx = WR.fx.filter(function (f) { return t - f.t0 < f.dur; });
    WR.fx.forEach(function (f) {
      const n = st.world.nodes[f.node];
      const k = (t - f.t0) / f.dur;
      const px = n.x + 26, py = n.y - 26, ry = py - 80;
      const open = k < 0.15 ? k / 0.15 : (k > 0.7 ? Math.max(0, (0.92 - k) / 0.22) : 1);
      if (open > 0) {
        let gr = g.createRadialGradient(px, ry, 2, px, ry, 46 * open);
        gr.addColorStop(0, 'rgba(200,250,255,' + (0.6 * open) + ')'); gr.addColorStop(1, 'rgba(95,212,230,0)');
        g.fillStyle = gr; g.beginPath(); g.ellipse(px, ry, 46 * open, 26 * open, 0, 0, 7); g.fill();
        g.strokeStyle = 'rgba(170,245,255,' + open + ')'; g.lineWidth = 3;
        g.beginPath(); g.ellipse(px, ry, 24 * open, 9 * open, 0, 0, 7); g.stroke();
        g.lineWidth = 1.2;
        for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(px, ry, (8 + i * 5) * open, (3 + i * 2) * open, 0, t / 200 + i, t / 200 + i + 2.2); g.stroke(); }
        // луч
        gr = g.createLinearGradient(0, ry, 0, py);
        gr.addColorStop(0, 'rgba(170,245,255,' + (0.25 * open) + ')'); gr.addColorStop(1, 'rgba(170,245,255,0)');
        g.fillStyle = gr; g.beginPath(); g.moveTo(px - 18 * open, ry); g.lineTo(px + 18 * open, ry); g.lineTo(px + 8, py); g.lineTo(px - 8, py); g.closePath(); g.fill();
      }
      if (k > 0.2 && k < 0.55) {
        const q = (k - 0.2) / 0.35, y = ry + (py - ry) * q * q;
        g.strokeStyle = 'rgba(200,250,255,0.5)'; g.lineWidth = 1;
        for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(px + i * 5, y - 10); g.lineTo(px + i * 5, y - 10 - 26 * q); g.stroke(); }
        g.save(); g.translate(px, y);
        ART.box(g, -0.5, -0.5, 0.5, 0.5, 0, 10, '#b08850', '#8a6539', '#6a4c2a', { hw: 9, hh: 4.5 });
        g.restore();
      }
      if (k >= 0.55) {
        const q = (k - 0.55) / 0.45;
        g.strokeStyle = 'rgba(220,200,160,' + (0.8 * (1 - q)) + ')'; g.lineWidth = 3 * (1 - q) + 0.5;
        g.beginPath(); g.ellipse(px, py + 4, 8 + q * 40, 3 + q * 15, 0, 0, 7); g.stroke();
        for (let i = 0; i < 8; i++) {
          const a = i / 8 * Math.PI * 2;
          g.fillStyle = 'rgba(180,160,130,' + (0.45 * (1 - q)) + ')';
          g.beginPath(); g.arc(px + Math.cos(a) * q * 30, py + 2 + Math.sin(a) * q * 11 - q * 8, 3 + q * 5, 0, 7); g.fill();
        }
        if (q < 0.25) { g.fillStyle = 'rgba(255,250,230,' + (0.7 * (1 - q / 0.25)) + ')'; g.beginPath(); g.ellipse(px, py, 30, 14, 0, 0, 7); g.fill(); }
      }
    });
  }
  function nightLayer(g, st, t, k, sq, Wd, Hd, dpr) {
    g.save(); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = 'rgba(10,14,40,' + (0.6 * k) + ')'; g.fillRect(0, 0, Wd, Hd);
    g.restore();
    g.globalCompositeOperation = 'lighter';
    const glow = function (x, y, r, col, a) {
      const gr = g.createRadialGradient(x, y, 1, x, y, r);
      gr.addColorStop(0, 'rgba(' + col + ',' + a + ')'); gr.addColorStop(1, 'rgba(' + col + ',0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    };
    const nodes = st.world.nodes;
    if (st.baseNode !== null) {
      const b = nodes[st.baseNode];
      glow(b.x + 10, b.y + 4, 46, '255,160,70', 0.55 * k);
      glow(b.x - 4, b.y - 12, 26, '255,200,120', 0.4 * k);
    }
    nodes.forEach(function (n) {
      if (!n.known) return;
      if (n.type === 'landing') glow(n.x, n.y - 22, 44, '120,230,255', 0.5 * k);
      if (n.outpost) glow(n.x + 30, n.y - 22, 18, '255,190,90', 0.6 * k);
      if (!n.cleared && n.type === 'camp') glow(n.x, n.y, 30, n.fac === 'sobr' ? '120,160,230' : (n.fac === 'clan' ? '230,190,80' : '255,140,60'), 0.35 * k);
      if (!n.cleared && (n.type === 'lair' || n.type === 'nest')) glow(n.x, n.y - 10, 30, '255,80,140', 0.3 * k);
    });
    glow(sq[0], sq[1], 30, '255,160,70', 0.5 * k);
    g.globalCompositeOperation = 'source-over';
  }

  WR.fx = [];
  WR.night = null;
  WR.alarm = null;
  function spd() { return (DW.settings && DW.settings.speed) || 1; }
  WR.nightPass = function () { WR.night = { t0: performance.now(), dur: 1700 / spd() }; };
  WR.dropFx = function (id) { WR.fx.push({ node: id, t0: performance.now(), dur: 2000 / spd() }); };
  WR.raidAlarm = function () { WR.alarm = { t0: performance.now(), dur: 2600 / spd() }; };

  WR.render = function (g, Wd, Hd, dpr) {
    const st = DW.G.state;
    if (!st || !bg) return;
    const t = performance.now();
    const z = WR.cam.z;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#0d0b09'; g.fillRect(0, 0, Wd, Hd);
    g.setTransform(dpr * z, 0, 0, dpr * z, dpr * (Wd / 2 - WR.cam.x * z), dpr * (Hd / 2 - WR.cam.y * z));
    g.drawImage(bg, 0, 0, W, H);
    lakeGlints(g, performance.now());
    const key = st.world.nodes.map(function (n) { return (n.known ? 1 : 0) + (n.visited ? 2 : 0); }).join('');
    if (key !== fogKey) { buildFog(st.world); fogKey = key; }
    g.imageSmoothingEnabled = true;
    g.drawImage(fogC, 0, 0, W, H);
    mistLayer(g, performance.now());
    g.strokeStyle = 'rgba(200,160,110,0.35)'; g.lineWidth = 3;
    g.strokeRect(0, 0, W, H);

    const nodes = st.world.nodes;
    let pathSet = {};
    if (WR.sel !== null && WR.sel !== st.squadAt && !WR.anim) {
      const path = DW.G.findPath(st.squadAt, WR.sel);
      if (path) { let prev = st.squadAt; path.forEach(function (p) { pathSet[prev + '_' + p] = 1; pathSet[p + '_' + prev] = 1; prev = p; }); }
    }
    // дороги
    st.world.edges.forEach(function (e) {
      const a = nodes[e[0]], b = nodes[e[1]];
      if (!a.known || !b.known) return;
      const cp = roadCurve(a, b, e);
      const onPath = pathSet[e[0] + '_' + e[1]];
      const curve = function () { g.beginPath(); g.moveTo(a.x, a.y); g.quadraticCurveTo(cp[0], cp[1], b.x, b.y); };
      g.lineCap = 'round';
      g.strokeStyle = 'rgba(20,14,9,0.55)'; g.lineWidth = 9; curve(); g.stroke();
      g.strokeStyle = onPath ? '#e8b866' : '#8f7656'; g.lineWidth = 5; curve(); g.stroke();
      g.strokeStyle = onPath ? 'rgba(255,240,200,0.8)' : 'rgba(40,30,20,0.35)'; g.lineWidth = 1.2; g.setLineDash([5, 7]);
      if (onPath) g.lineDashOffset = -t / 40;
      curve(); g.stroke(); g.setLineDash([]); g.lineDashOffset = 0;
    });
    // узлы по глубине
    nodes.filter(function (n) { return n.known; }).sort(function (a, b) { return a.y - b.y; }).forEach(function (n) { drawNode(g, n, t, st); });
    patrols(g, st, t);
    drawRaid(g, st, t);

    if (st.raid && st.baseNode !== null) {
      const b = nodes[st.baseNode];
      const k = (t % 1200) / 1200;
      g.strokeStyle = 'rgba(224,71,63,' + (1 - k) + ')'; g.lineWidth = 3;
      g.beginPath(); g.ellipse(b.x, b.y + 2, 40 + k * 40, 21 + k * 21, 0, 0, Math.PI * 2); g.stroke();
    }
    // отряд
    let sx, sy;
    if (WR.anim) {
      const a = WR.anim;
      const k = U.clamp((t - a.t0) / a.dur, 0, 1);
      const e = U.ease(k);
      const ea = st.world.edges.find(function (ed) { return (nodes[ed[0]] === a.from && nodes[ed[1]] === a.to) || (nodes[ed[1]] === a.from && nodes[ed[0]] === a.to); });
      if (ea) {
        const cp = roadCurve(nodes[ea[0]], nodes[ea[1]], ea);
        const p0 = a.from, p2 = a.to, u = 1 - e;
        sx = u * u * p0.x + 2 * u * e * cp[0] + e * e * p2.x; sy = u * u * p0.y + 2 * u * e * cp[1] + e * e * p2.y;
      } else { sx = U.lerp(a.from.x, a.to.x, e); sy = U.lerp(a.from.y, a.to.y, e); }
      if (k >= 1) { const r = a.res; WR.anim = null; r(); }
    } else { const n = nodes[st.squadAt]; sx = n.x + 20; sy = n.y + 14; }
    const moving = !!WR.anim;
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(sx, sy, 16, 6, 0, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 3; i++) {
      g.save(); g.translate(sx - 9 + i * 9, sy - 2 + (i % 2) * 3); g.scale(0.5, 0.5);
      ART.human(g, { look: st.roster[i] ? st.roster[i].look : null, body: '#c8691c', weapon: st.roster[i] ? st.roster[i].weapon : 'ppsh', dir: 1, aim: -0.2, walk: moving ? t / 90 + i : null, seed: i }, t);
      g.restore();
    }
    const fx = sx + 14, fy = sy - 4;
    g.strokeStyle = '#3a2a18'; g.lineWidth = 2; g.beginPath(); g.moveTo(fx, fy); g.lineTo(fx, fy - 40); g.stroke();
    g.fillStyle = '#e8a83e';
    g.beginPath(); g.moveTo(fx, fy - 40);
    for (let i = 0; i <= 6; i++) { const x = fx + i * 3.4, y = fy - 40 + Math.sin(t / 160 + i * 0.9) * 1.6; g.lineTo(x, y); }
    for (let i = 6; i >= 0; i--) { const x = fx + i * 3.4, y = fy - 29 + Math.sin(t / 160 + i * 0.9) * 1.6; g.lineTo(x, y); }
    g.closePath(); g.fill();
    g.fillStyle = '#1a120a'; g.font = 'bold 9px sans-serif'; g.textAlign = 'center'; g.fillText(String(st.roster.length), fx + 11, fy - 31.5);
    drawFx(g, st, t);
    // облака
    const ct = t / 1000;
    if (!clouds) clouds = makeClouds();
    clouds.forEach(function (cl) {
      const span = W + 700;
      const cx = ((cl.x0 + ct * cl.v) % span) - 350;
      g.drawImage(cl.sh, cx - cl.sz + 40, cl.y - cl.sz * 0.6 + 70, cl.sz * 2, cl.sz * 1.2);
      g.drawImage(cl.c, cx - cl.sz, cl.y - cl.sz * 0.6, cl.sz * 2, cl.sz * 1.2);
    });
    if (WR.night) {
      const k = (t - WR.night.t0) / WR.night.dur;
      if (k >= 1) WR.night = null;
      else nightLayer(g, st, t, Math.sin(Math.PI * U.clamp(k, 0, 1)), [sx, sy], Wd, Hd, dpr);
    }
    lastT = t;
    // пыль и виньетка в экранных координатах
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (let i = 0; i < 40; i++) {
      const r = U.srng(i * 13 + 1);
      const x = ((r() * Wd + t / 1000 * (20 + r() * 30)) % (Wd + 20)) - 10, y = (r() * Hd + Math.sin(t / 1500 + i) * 10);
      g.fillStyle = 'rgba(230,200,160,' + (0.08 + r() * 0.12) + ')'; g.fillRect(x, y, 1.6, 1.6);
    }
    g.drawImage(DW.TR.vignette(Wd, Hd, 0.45), 0, 0, Wd, Hd);
    if (WR.alarm) {
      const k = (t - WR.alarm.t0) / WR.alarm.dur;
      if (k >= 1) WR.alarm = null;
      else {
        const a = (1 - k) * (0.5 + 0.5 * Math.abs(Math.sin(k * Math.PI * 4)));
        const gr = g.createRadialGradient(Wd / 2, Hd / 2, Math.min(Wd, Hd) * 0.3, Wd / 2, Hd / 2, Math.max(Wd, Hd) * 0.7);
        gr.addColorStop(0, 'rgba(200,30,20,0)'); gr.addColorStop(1, 'rgba(200,30,20,' + (0.55 * a) + ')');
        g.fillStyle = gr; g.fillRect(0, 0, Wd, Hd);
        g.save();
        g.globalAlpha = Math.min(1, (1 - k) * 2.5);
        g.font = '900 ' + Math.round(Hd * 0.11) + 'px sans-serif'; g.textAlign = 'center';
        g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillText('ТРЕВОГА', Wd / 2 + 3, Hd * 0.3 + 3);
        g.fillStyle = Math.sin(k * Math.PI * 8) > 0 ? '#ff5a3a' : '#ffd0a0'; g.fillText('ТРЕВОГА', Wd / 2, Hd * 0.3);
        g.restore();
      }
    }
  };
  let clouds = null;
  function makeClouds() {
    const list = [];
    for (let i = 0; i < 6; i++) {
      const r = U.srng(i * 31 + 7);
      const sz = 90 + r() * 110;
      const mk = function (col, a) {
        const c = canvas(128, 77);
        const g = c.getContext('2d');
        const rr2 = U.srng(i * 31 + 7);
        for (let k = 0; k < 4; k++) {
          const x = 64 + (rr2() - 0.5) * 60, y = 38 + (rr2() - 0.5) * 20, rad = 22 + rr2() * 18;
          const gr = g.createRadialGradient(x, y, 1, x, y, rad);
          gr.addColorStop(0, 'rgba(' + col + ',' + a + ')'); gr.addColorStop(1, 'rgba(' + col + ',0)');
          g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill();
        }
        return c;
      };
      list.push({ x0: r() * (W + 700), y: r() * H, v: 6 + r() * 6, sz: sz, c: mk('230,215,195', 0.12), sh: mk('0,0,0', 0.14) });
    }
    return list;
  }
  WR.idle = function () { return !WR.anim && WR.cam.tx === null && !WR.fx.length && !WR.night && !WR.alarm; };

  WR.animateMove = function (fromId, toId) {
    const st = DW.G.state;
    const a = st.world.nodes[fromId], b = st.world.nodes[toId];
    WR.focus(b.x, b.y);
    return new Promise(function (res) {
      WR.anim = { from: a, to: b, t0: performance.now(), dur: 900 / ((DW.settings && DW.settings.speed) || 1), res: res };
    });
  };
  WR.hitNode = function (sx, sy) {
    const st = DW.G.state;
    const w = WR.s2w(sx, sy);
    let best = null, bd = 1e9;
    st.world.nodes.forEach(function (n) {
      if (!n.known) return;
      const d = Math.hypot(n.x - w[0], (n.y - 10 - w[1]) * 1.3) * WR.cam.z;
      if (d < 44 && d < bd) { bd = d; best = n; }
    });
    return best;
  };

  DW.World = World;
  DW.WR = WR;
})(window.DW);
