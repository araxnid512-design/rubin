/* Курьер миров — графика. Всё рисуется кодом в пиксельном стиле: тайлы, параллакс-фоны,
   герой, враги, боссы, предметы и эффекты. Никаких внешних картинок. */
(function () {
  'use strict';
  const K = window.K;
  const TS = 32;
  const G = (K.GFX = {});
  let pal = null, worldId = 1, atlas = null, bg = null;

  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  function R(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), 1 | t); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const f = (v) => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)));
    return '#' + ((1 << 24) | (f(r) << 16) | (f(g) << 8) | f(b)).toString(16).slice(1);
  }
  G.shade = shade;

  /* ================= ТАЙЛЫ ================= */
  // В атласе на каждый тип два варианта: открытый сверху (с травой/снегом) и внутренний.
  function buildAtlas() {
    const T = K.T, n = 12;
    atlas = mk(TS * n, TS * 2);
    const c = atlas.getContext('2d');
    const r = rng(worldId * 977);
    for (let v = 0; v < 2; v++) {
      const top = v === 0, oy = v * TS;
      // GROUND
      let ox = T.GROUND * TS;
      R(c, ox, oy, TS, TS, pal.groundDark);
      for (let i = 0; i < 9; i++) R(c, ox + Math.floor(r() * 14) * 2, oy + Math.floor(r() * 14) * 2, 4, 4, pal.ground);
      if (worldId === 6) for (let i = 0; i < 3; i++) R(c, ox + Math.floor(r() * 14) * 2, oy + 8 + Math.floor(r() * 10) * 2, 6, 2, '#ff6a1a');
      if (worldId === 7) for (let i = 0; i < 2; i++) R(c, ox + Math.floor(r() * 14) * 2, oy + Math.floor(r() * 14) * 2, 2, 2, pal.topHi);
      if (top) {
        R(c, ox, oy, TS, 8, pal.top);
        R(c, ox, oy, TS, 2, pal.topHi);
        for (let i = 0; i < 6; i++) R(c, ox + i * 6 + 2, oy + 8, 4, 2 + Math.floor(r() * 3) * 2, pal.top);
        if (worldId === 1) { R(c, ox, oy + 6, TS, 2, '#2c2f3c'); for (let i = 0; i < 4; i++) R(c, ox + i * 8, oy + 2, 4, 2, '#e0c040'); }
      }
      // BLOCK
      ox = T.BLOCK * TS;
      R(c, ox, oy, TS, TS, pal.blockDark);
      if (worldId === 6) {
        R(c, ox + 2, oy + 2, TS - 4, TS - 4, pal.block);
        for (const [a, b] of [[4, 4], [24, 4], [4, 24], [24, 24]]) R(c, ox + a, oy + b, 4, 4, pal.blockDark);
      } else if (worldId === 7 || worldId === 5) {
        R(c, ox + 2, oy + 2, TS - 4, TS - 4, pal.block);
        R(c, ox + 6, oy + 4, 4, 14, shade(pal.block, 0.35));
        R(c, ox + 12, oy + 4, 2, 6, shade(pal.block, 0.35));
      } else {
        for (let row = 0; row < 4; row++) {
          const off = row % 2 ? 8 : 0;
          for (let k = -1; k < 2; k++) R(c, ox + off + k * 16 + 1, oy + row * 8 + 1, 14, 6, pal.block);
        }
        if (worldId === 4) for (let i = 0; i < 4; i++) R(c, ox + Math.floor(r() * 14) * 2, oy, 4, 2 + Math.floor(r() * 4) * 2, pal.top);
      }
      // PLAT (одностороння)
      ox = T.PLAT * TS;
      R(c, ox, oy, TS, 10, pal.plat);
      R(c, ox, oy, TS, 2, shade(pal.plat, 0.3));
      R(c, ox, oy + 8, TS, 2, shade(pal.plat, -0.35));
      R(c, ox + 4, oy + 10, 4, 6, shade(pal.plat, -0.45));
      R(c, ox + 24, oy + 10, 4, 6, shade(pal.plat, -0.45));
      if (worldId === 5) R(c, ox, oy, TS, 3, '#ffffff');
      // SPIKE
      ox = T.SPIKE * TS;
      for (let k = 0; k < 4; k++) {
        for (let s = 0; s < 6; s++) R(c, ox + k * 8 + s, oy + 30 - s * 4, 8 - s * 2 > 0 ? 8 - 2 * s : 2, 4, s < 2 ? shade(pal.hazard, -0.3) : pal.hazard);
        R(c, ox + k * 8 + 3, oy + 8, 2, 4, '#ffffff');
      }
      R(c, ox, oy + 28, TS, 4, shade(pal.hazard, -0.5));
      // ICE
      ox = T.ICE * TS;
      R(c, ox, oy, TS, TS, '#9ed8f0');
      R(c, ox, oy, TS, 4, '#e8f8ff');
      R(c, ox + 4, oy + 8, 4, 4, '#ffffff'); R(c, ox + 8, oy + 12, 4, 4, '#d2f0fb'); R(c, ox + 20, oy + 18, 6, 2, '#d2f0fb');
      // BOUNCE
      ox = T.BOUNCE * TS;
      R(c, ox, oy + 12, TS, 20, pal.groundDark);
      if (worldId === 4) {
        R(c, ox + 10, oy + 14, 12, 18, '#e8dcc0');
        R(c, ox, oy + 2, TS, 14, '#d23a4a'); R(c, ox + 2, oy, TS - 4, 4, '#d23a4a');
        R(c, ox + 6, oy + 4, 4, 4, '#ffffff'); R(c, ox + 20, oy + 6, 4, 4, '#ffffff'); R(c, ox + 13, oy + 2, 4, 3, '#ffffff');
      } else {
        R(c, ox + 2, oy + 4, TS - 4, 6, pal.accent);
        for (let k = 0; k < 3; k++) R(c, ox + 6, oy + 12 + k * 6, TS - 12, 3, '#c0c4cc');
      }
      // CRUMBLE
      ox = T.CRUMBLE * TS;
      R(c, ox, oy, TS, TS, shade(pal.block, -0.2));
      R(c, ox + 2, oy + 2, 12, 12, pal.block); R(c, ox + 18, oy + 4, 12, 10, pal.block); R(c, ox + 4, oy + 18, 22, 10, pal.block);
      R(c, ox + 14, oy + 2, 2, 16, '#00000055'); R(c, ox + 8, oy + 14, 14, 2, '#00000055');
      // BREAK
      ox = T.BREAK * TS;
      if (worldId >= 5) { R(c, ox, oy, TS, TS, '#8fd0ee'); R(c, ox + 2, oy + 2, TS - 4, TS - 4, '#bfe8fa'); }
      else { R(c, ox, oy, TS, TS, '#6b4a2a'); R(c, ox + 2, oy + 2, TS - 4, TS - 4, '#a07a4a'); }
      for (let k = 0; k < 6; k++) { R(c, ox + 6 + k * 3, oy + 6 + k * 3, 3, 3, '#00000044'); R(c, ox + 22 - k * 3, oy + 6 + k * 3, 3, 3, '#00000044'); }
    }
  }

  G.drawTiles = function (ctx, L, camX, t, crumble) {
    const T = K.T;
    const x0 = Math.max(0, Math.floor(camX / TS)), x1 = Math.min(L.w - 1, Math.floor((camX + K.VW) / TS) + 1);
    for (let y = 0; y < L.h; y++) {
      for (let x = x0; x <= x1; x++) {
        const v = L.tiles[y * L.w + x];
        if (!v) continue;
        const sx = x * TS - camX, sy = y * TS;
        if (v === T.HAZARD) { drawHazard(ctx, sx, sy, t, y > 0 && L.tiles[(y - 1) * L.w + x] !== T.HAZARD); continue; }
        if (v === T.CONV_L || v === T.CONV_R) { drawConveyor(ctx, sx, sy, t, v === T.CONV_L ? -1 : 1); continue; }
        const above = y > 0 ? L.tiles[(y - 1) * L.w + x] : 0;
        const exposed = !above || above === T.PLAT || above === T.SPIKE || above === T.HAZARD;
        if (v === T.CRUMBLE && crumble) {
          const st = crumble.get(y * L.w + x);
          if (st && st.gone) continue;
          const shake = st && st.t > 0 ? ((t >> 1) % 2 ? 1 : -1) * 2 : 0;
          ctx.drawImage(atlas, v * TS, 0, TS, TS, sx + shake, sy, TS, TS);
          continue;
        }
        ctx.drawImage(atlas, v * TS, exposed ? 0 : TS, TS, TS, sx, sy, TS, TS);
      }
    }
  };

  function drawHazard(ctx, x, y, t, surface) {
    const col = pal.hazard;
    R(ctx, x, y, TS, TS, shade(col, -0.35));
    if (surface) {
      const ph = t * 0.08 + x * 0.05;
      R(ctx, x, y + 4, TS, TS - 4, col);
      for (let i = 0; i < 4; i++) R(ctx, x + i * 8, y + 2 + Math.round(Math.sin(ph + i) * 2), 8, 4, shade(col, 0.35));
      if (worldId === 6 && (t + x) % 90 < 4) R(ctx, x + 12, y - 4, 4, 4, '#ffd06a');
    }
  }
  function drawConveyor(ctx, x, y, t, dir) {
    R(ctx, x, y, TS, TS, pal.groundDark);
    R(ctx, x, y, TS, 10, '#2a2a30');
    const off = ((t * dir) % 16 + 16) % 16;
    for (let k = -1; k < 3; k++) { const cx = x + k * 16 + off; if (cx > x - 8 && cx < x + TS) R(ctx, Math.max(x, cx), y + 3, Math.min(6, x + TS - Math.max(x, cx)), 4, '#ffb02a'); }
    R(ctx, x, y + 10, TS, 2, '#000000');
  }

  /* ================= ФОНЫ ================= */
  function buildBg() {
    const W = K.VW, H = K.VH, r = rng(worldId * 131);
    const sky = mk(W, H), sc = sky.getContext('2d');
    const g = sc.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, pal.sky[0]); g.addColorStop(0.6, pal.sky[1]); g.addColorStop(1, pal.sky[2]);
    sc.fillStyle = g; sc.fillRect(0, 0, W, H);
    const far = mk(W, H), mid = mk(W, H), near = mk(W, H);
    const f = far.getContext('2d'), m = mid.getContext('2d'), n = near.getContext('2d');
    const hills = (c, base, amp, col, fq) => { c.fillStyle = col; c.beginPath(); c.moveTo(0, H); for (let x = 0; x <= W; x += 8) c.lineTo(x, base - amp * (0.5 + 0.5 * Math.sin((x / W) * Math.PI * 2 * fq + fq))); c.lineTo(W, H); c.fill(); };
    const peaks = (c, base, amp, col, cap) => { c.fillStyle = col; c.beginPath(); c.moveTo(0, H); let x = 0; const pts = []; while (x <= W) { const y = base - amp * (0.3 + r() * 0.7); pts.push([x, y]); c.lineTo(x, y); x += 60 + r() * 60; } c.lineTo(W, base); c.lineTo(W, H); c.fill(); if (cap) { c.fillStyle = cap; for (const [px, py] of pts) { c.beginPath(); c.moveTo(px - 16, py + 18); c.lineTo(px, py); c.lineTo(px + 16, py + 18); c.fill(); } } };
    switch (worldId) {
      case 1: {
        sc.fillStyle = '#f4ecd0'; sc.beginPath(); sc.arc(760, 90, 34, 0, 7); sc.fill();
        for (let i = 0; i < 80; i++) R(sc, r() * W, r() * 260, 2, 2, 'rgba(255,255,255,' + (0.3 + r() * 0.6) + ')');
        let x = 0;
        while (x < W) { const w = 40 + r() * 50, h = 120 + r() * 200; R(f, x, H - 140 - h, w, h + 140, pal.far); for (let wy = H - 130 - h; wy < H - 150; wy += 14) for (let wx = x + 6; wx < x + w - 8; wx += 12) if (r() < 0.3) R(f, wx, wy, 6, 6, r() < 0.8 ? '#ffd56b' : '#8fd0ff'); x += w + 4; }
        x = 0;
        while (x < W) { const w = 60 + r() * 70, h = 60 + r() * 140; R(m, x, H - 120 - h, w, h + 120, pal.mid); if (r() < 0.4) { R(m, x + w / 2 - 10, H - 150 - h, 20, 30, pal.mid); R(m, x + w / 2 - 14, H - 156 - h, 28, 8, pal.mid); } x += w + 20; }
        for (const cx of [180, 640]) { R(n, cx, 120, 8, H, pal.near); R(n, cx - 120, 120, 260, 8, pal.near); R(n, cx + 100, 128, 2, 80, pal.near); R(n, cx + 94, 206, 14, 10, pal.near); }
        R(n, 400, 300, 120, 50, pal.near); R(n, 404, 304, 112, 42, '#1a1030'); n.fillStyle = pal.accent; n.font = 'bold 22px monospace'; n.fillText('ШАУРМА', 414, 334);
        break;
      }
      case 2: {
        sc.fillStyle = '#ffd08a'; sc.beginPath(); sc.arc(700, 330, 70, 0, 7); sc.fill();
        sc.fillStyle = 'rgba(255,220,150,0.25)'; sc.beginPath(); sc.arc(700, 330, 120, 0, 7); sc.fill();
        peaks(f, 360, 90, pal.far);
        hills(m, 420, 60, pal.mid, 1.5);
        for (const yx of [120, 330, 560, 820]) { const yy = 400; m.fillStyle = shade(pal.mid, -0.3); m.beginPath(); m.moveTo(yx - 36, yy); m.quadraticCurveTo(yx, yy - 60, yx + 36, yy); m.fill(); R(m, yx - 36, yy, 72, 20, shade(pal.mid, -0.3)); R(m, yx - 6, yy + 4, 12, 16, '#ffcf7a'); }
        hills(n, 500, 40, pal.near, 2.5);
        for (const tx of [90, 480, 870]) { R(n, tx, 360, 14, 140, pal.near); R(n, tx - 10, 360, 34, 14, pal.near); R(n, tx - 4, 390, 22, 10, pal.near); }
        break;
      }
      case 3: {
        for (let i = 0; i < 6; i++) { const cx = r() * W, cy = 40 + r() * 140; sc.fillStyle = 'rgba(255,255,255,0.85)'; for (let k = 0; k < 4; k++) R(sc, cx + k * 22 - 30, cy - (k % 2) * 10, 44, 18, 'rgba(255,255,255,0.8)'); }
        hills(f, 380, 50, pal.far, 1);
        const castle = (c, x, base, s, col) => { R(c, x, base - 120 * s, 160 * s, 120 * s, col); for (let k = 0; k < 8; k++) R(c, x + k * 20 * s, base - 132 * s, 10 * s, 12 * s, col); for (const tx of [0, 130]) { R(c, x + tx * s - 6 * s, base - 180 * s, 42 * s, 180 * s, col); c.fillStyle = col; c.beginPath(); c.moveTo(x + tx * s - 10 * s, base - 180 * s); c.lineTo(x + tx * s + 15 * s, base - 230 * s); c.lineTo(x + tx * s + 40 * s, base - 180 * s); c.fill(); R(c, x + tx * s + 14 * s, base - 250 * s, 2, 22 * s, col); R(c, x + tx * s + 16 * s, base - 250 * s, 14 * s, 8 * s, pal.accent); } };
        castle(f, 560, 380, 1, shade(pal.far, -0.1));
        hills(m, 440, 50, pal.mid, 2);
        castle(m, 100, 440, 0.6, pal.mid);
        for (let x = 20; x < W; x += 70 + r() * 60) { R(n, x + 14, 430, 10, 120, '#4a3a2a'); n.fillStyle = pal.near; n.beginPath(); n.arc(x + 19, 420, 34, 0, 7); n.fill(); }
        break;
      }
      case 4: {
        for (let x = 0; x < W; x += 90 + r() * 40) { R(f, x, 0, 34 + r() * 20, H, pal.far); }
        for (let i = 0; i < 6; i++) { const mx = r() * W, mh = 120 + r() * 120; R(m, mx + 26, H - mh, 24, mh, '#cfc2a0'); m.fillStyle = r() < 0.5 ? '#7a2a3a' : '#3a2a6a'; m.beginPath(); m.ellipse(mx + 38, H - mh, 70, 34, 0, Math.PI, 0); m.fill(); }
        for (let x = 0; x < W; x += 40 + r() * 50) { const l = 60 + r() * 140; R(n, x, 0, 6, l, pal.near); R(n, x - 6, l - 10, 18, 12, pal.near); }
        break;
      }
      case 5: {
        sc.fillStyle = 'rgba(255,255,255,0.9)'; sc.beginPath(); sc.arc(200, 100, 28, 0, 7); sc.fill();
        peaks(f, 320, 200, pal.far, '#ffffff');
        peaks(m, 420, 140, pal.mid, '#f4f8fc');
        for (let x = 0; x < W; x += 50 + r() * 70) { const h = 60 + r() * 60; n.fillStyle = pal.near; n.beginPath(); n.moveTo(x, 520); n.lineTo(x + 20, 520 - h); n.lineTo(x + 40, 520); n.fill(); n.fillStyle = '#ffffff'; n.beginPath(); n.moveTo(x + 10, 520 - h * 0.5); n.lineTo(x + 20, 520 - h); n.lineTo(x + 30, 520 - h * 0.5); n.fill(); }
        break;
      }
      case 6: {
        const gl = sc.createRadialGradient(480, 600, 40, 480, 600, 520); gl.addColorStop(0, 'rgba(255,90,20,0.55)'); gl.addColorStop(1, 'rgba(255,90,20,0)'); sc.fillStyle = gl; sc.fillRect(0, 0, W, H);
        for (let x = 0; x < W; x += 30 + r() * 40) { const l = 40 + r() * 140; f.fillStyle = pal.far; f.beginPath(); f.moveTo(x, 0); f.lineTo(x + 14, l); f.lineTo(x + 28, 0); f.fill(); }
        for (let x = 40; x < W; x += 180 + r() * 80) { for (let y = 0; y < 300; y += 12) R(m, x, y, 8, 8, pal.mid); R(m, x - 16, 300, 40, 30, pal.mid); }
        for (let x = 0; x < W; x += 160) { R(n, x, 470, 160, 16, pal.near); R(n, x + 60, 380, 16, 100, pal.near); n.fillStyle = pal.near; n.beginPath(); n.arc(x + 120, 440, 30, 0, 7); n.fill(); }
        break;
      }
      case 7: {
        for (let i = 0; i < 160; i++) R(sc, r() * W, r() * H, 2, 2, 'rgba(255,255,255,' + (0.2 + r() * 0.7) + ')');
        for (let i = 0; i < 4; i++) { const gx = r() * W, gy = r() * H * 0.7; const gl = sc.createRadialGradient(gx, gy, 10, gx, gy, 200); gl.addColorStop(0, 'rgba(200,100,255,0.25)'); gl.addColorStop(1, 'rgba(200,100,255,0)'); sc.fillStyle = gl; sc.fillRect(0, 0, W, H); }
        const isl = (c, x, y, w, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y); c.lineTo(x + w * 0.6, y + w * 0.6); c.lineTo(x + w * 0.3, y + w * 0.5); c.fill(); };
        for (let i = 0; i < 6; i++) isl(f, r() * W, 80 + r() * 300, 50 + r() * 60, pal.far);
        const things = [(c, x, y) => { R(c, x, y - 40, 50, 40, pal.mid); R(c, x + 6, y - 32, 8, 8, '#ffd56b'); }, (c, x, y) => { c.fillStyle = pal.mid; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 25, y - 50, x + 50, y); c.fill(); }, (c, x, y) => { R(c, x + 10, y - 70, 24, 70, pal.mid); c.fillStyle = pal.mid; c.beginPath(); c.moveTo(x + 6, y - 70); c.lineTo(x + 22, y - 96); c.lineTo(x + 38, y - 70); c.fill(); }];
        for (let i = 0; i < 5; i++) { const x = 40 + i * 190 + r() * 40, y = 200 + r() * 160; isl(m, x - 10, y, 80, pal.mid); things[i % 3](m, x, y); }
        for (let i = 0; i < 8; i++) { const x = r() * W, y = 420 + r() * 100; n.fillStyle = pal.near; n.beginPath(); n.moveTo(x, y + 60); n.lineTo(x + 10, y); n.lineTo(x + 20, y + 60); n.fill(); }
        break;
      }
    }
    bg = { sky, far, mid, near };
  }

  G.drawBg = function (ctx, camX, t) {
    ctx.drawImage(bg.sky, 0, 0);
    const layer = (img, k) => { const off = -((camX * k) % K.VW); ctx.drawImage(img, off, 0); ctx.drawImage(img, off + K.VW, 0); };
    layer(bg.far, 0.12); layer(bg.mid, 0.3); layer(bg.near, 0.55);
    if (pal.fog) { ctx.fillStyle = pal.fog; ctx.fillRect(0, 0, K.VW, K.VH); }
  };

  // Погода и живые мелочи поверх фона.
  G.drawAmbient = function (ctx, camX, t) {
    const r = rng(worldId * 7);
    if (worldId === 5) for (let i = 0; i < 70; i++) { const sx = r() * K.VW, sp = 0.4 + r(); const x = ((sx - camX * 0.6 + Math.sin(t * 0.02 + i) * 20) % K.VW + K.VW) % K.VW; const y = (r() * K.VH + t * sp) % K.VH; R(ctx, x, y, 3, 3, 'rgba(255,255,255,0.85)'); }
    if (worldId === 4) for (let i = 0; i < 30; i++) { const x = ((r() * K.VW * 2 - camX * 0.4) % K.VW + K.VW) % K.VW + Math.sin(t * 0.03 + i) * 12, y = r() * K.VH + Math.cos(t * 0.025 + i) * 10; ctx.globalAlpha = 0.4 + 0.4 * Math.sin(t * 0.07 + i * 2); R(ctx, x, y, 3, 3, pal.light); ctx.globalAlpha = 1; }
    if (worldId === 6) for (let i = 0; i < 40; i++) { const sp = 0.5 + r(); const x = ((r() * K.VW - camX * 0.5) % K.VW + K.VW) % K.VW + Math.sin(t * 0.04 + i) * 6; const y = K.VH - ((r() * K.VH + t * sp) % K.VH); R(ctx, x, y, 2, 2, r() < 0.5 ? '#ffb02a' : '#ff6a1a'); }
    if (worldId === 2) for (let i = 0; i < 18; i++) { const x = ((r() * K.VW * 2 - camX * 0.8 + t * 1.2) % K.VW + K.VW) % K.VW, y = 300 + r() * 220; R(ctx, x, y, 6, 2, 'rgba(255,230,180,0.35)'); }
  };

  /* ================= ГЕРОЙ ================= */
  const HERO_PAL = { c: '#2fae5c', C: '#1d7a3d', s: '#f2c29b', S: '#d79f78', e: '#1b1b2b', h: '#4a2c1a', j: '#f2c230', J: '#c4931a', b: '#2fae5c', B: '#1d7a3d', w: '#ffffff', p: '#2b3a67', o: '#1b1b2b' };
  const HERO_TOP = [
    '....ccccc...',
    '...cccccccCC',
    '...hhsssss..',
    '...hssssess.',
    '....sssSs...',
    '.bbbjjjjj...',
    '.bwbjjjjjj..',
    '.bwbjJjjjss.',
    '.bbbjJjjj...',
    '.BBBjJjjj...',
    '....jjjjj...',
    '....ppppp...',
  ];
  const HERO_LEGS = {
    idle: ['....pp.pp...', '....pp.pp...', '....pp.pp...', '...ooo.ooo..'],
    runA: ['...pp...pp..', '..pp.....pp.', '.pp.......p.', '.oo.......oo'],
    runB: ['....pppp....', '....pppp....', '.....pp.....', '....ooo.....'],
    runC: ['....pp..pp..', '...pp....pp.', '...p......pp', '..oo.....oo.'],
    jump: ['...pp..pp...', '...pp..pp...', '...oo..oo...', '............'],
    fall: ['....pp.pp...', '...pp...pp..', '..pp.....pp.', '..oo.....oo.'],
  };
  let heroFrames = null;
  function buildHero() {
    heroFrames = {};
    for (const k of Object.keys(HERO_LEGS)) {
      const rows = HERO_TOP.concat(HERO_LEGS[k]);
      for (const dir of [1, -1]) {
        const cv = mk(24, 32), c = cv.getContext('2d');
        rows.forEach((row, y) => { for (let x = 0; x < 12; x++) { const ch = row[x]; if (ch !== '.') R(c, (dir === 1 ? x : 11 - x) * 2, y * 2, 2, 2, HERO_PAL[ch]); } });
        heroFrames[k + dir] = cv;
      }
    }
  }
  G.drawHero = function (ctx, P, camX, t) {
    if (!heroFrames) buildHero();
    if (P.inv > 0 && Math.floor(P.inv / 4) % 2 === 0 && !P.dashT) return;
    let k = 'idle';
    if (!P.onGround) k = P.vy < 0 ? 'jump' : 'fall';
    else if (Math.abs(P.vx) > 0.6) k = ['runA', 'runB', 'runC', 'runB'][Math.floor(t / 5) % 4];
    if (P.wallSlide) k = 'fall';
    const x = Math.round(P.x - camX - 2), y = Math.round(P.y - 2);
    if (P.dashT > 0) {
      ctx.globalAlpha = 0.35;
      for (let i = 1; i <= 3; i++) ctx.drawImage(heroFrames['runA' + P.facing], x - P.facing * i * 12, y);
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(heroFrames[k + P.facing], x, y);
  };

  /* ================= ВРАГИ ================= */
  // Каждый облик рисуется прямоугольниками в сетке 2px, лицом вправо; flip отражает.
  function sprite(ctx, x, y, w, flip, draw) {
    ctx.save();
    if (flip) { ctx.translate(Math.round(x + w), Math.round(y)); ctx.scale(-1, 1); } else ctx.translate(Math.round(x), Math.round(y));
    draw((a, b, c, d, col) => R(ctx, a, b, c, d, col));
    ctx.restore();
  }
  const SKINS = {
    dog: (p, f) => { p(2, 6, 18, 8, '#8a5a32'); p(16, 2, 8, 8, '#8a5a32'); p(16, 0, 3, 4, '#5a3a1e'); p(22, 6, 3, 2, '#1b1b2b'); p(20, 4, 2, 2, '#1b1b2b'); p(0, 4, 3, 4, '#8a5a32'); p(4, 14, 3, 6 - f * 2, '#5a3a1e'); p(14, 14, 3, 4 + f * 2, '#5a3a1e'); },
    wolf: (p, f) => { p(2, 6, 20, 8, '#7d8590'); p(16, 2, 9, 8, '#7d8590'); p(16, 0, 3, 3, '#5a6068'); p(21, 0, 3, 3, '#5a6068'); p(24, 6, 2, 3, '#2a2a2a'); p(20, 4, 2, 2, '#ffd56b'); p(0, 5, 4, 3, '#5a6068'); p(4, 14, 3, 6 - f * 2, '#5a6068'); p(16, 14, 3, 4 + f * 2, '#5a6068'); },
    knight: (p, f) => { p(4, 4, 14, 20, '#9aa0aa'); p(6, 0, 10, 8, '#c0c6d0'); p(10, 3, 6, 2, '#1b1b2b'); p(8, -4, 4, 4, '#c23a3a'); p(16, 6, 6, 14, '#3a5aa8'); p(18, 9, 2, 6, '#ffd56b'); p(5, 24, 4, 4 - f, '#5a5f69'); p(12, 24, 4, 3 + f, '#5a5f69'); },
    slime: (p, f, t) => { const s = Math.round(Math.sin(t * 0.2) * 2); p(2, 8 - s, 20, 12 + s, '#5ad06a'); p(4, 6 - s, 16, 4, '#7ae68a'); p(14, 10 - s, 3, 3, '#1b1b2b'); p(8, 10 - s, 3, 3, '#1b1b2b'); },
    yeti: (p, f) => { p(2, 2, 20, 20, '#f2f4f8'); p(10, 6, 10, 8, '#7ab0d8'); p(16, 8, 2, 2, '#1b1b2b'); p(12, 8, 2, 2, '#1b1b2b'); p(0, 10, 4, 8, '#e0e4ea'); p(20, 10, 4, 8, '#e0e4ea'); p(4, 22, 5, 4 - f, '#c8ccd4'); p(14, 22, 5, 3 + f, '#c8ccd4'); },
    imp: (p, f) => { p(4, 6, 16, 14, '#d23a2a'); p(6, 2, 3, 5, '#5a1a10'); p(15, 2, 3, 5, '#5a1a10'); p(14, 9, 3, 3, '#ffd06a'); p(8, 9, 3, 3, '#ffd06a'); p(0, 12, 5, 2, '#d23a2a'); p(6, 20, 3, 4 - f, '#8a1a10'); p(14, 20, 3, 3 + f, '#8a1a10'); },
    shade: (p, f, t) => { p(4, 2, 16, 18, 'rgba(160,100,255,0.75)'); p(4, 20, 4, 4, 'rgba(160,100,255,0.6)'); p(10, 20, 4, 3 + f, 'rgba(160,100,255,0.6)'); p(16, 20, 4, 4, 'rgba(160,100,255,0.6)'); p(14, 7, 3, 4, '#ffffff'); p(8, 7, 3, 4, '#ffffff'); },
    cat: (p, f) => { p(2, 8, 18, 8, '#2a2a33'); p(14, 2, 10, 9, '#2a2a33'); p(14, 0, 3, 3, '#2a2a33'); p(21, 0, 3, 3, '#2a2a33'); p(20, 5, 2, 2, '#ffd56b'); p(0, 2, 3, 8, '#2a2a33'); p(4, 16, 3, 4, '#2a2a33'); p(15, 16, 3, 4, '#2a2a33'); },
    goblinJ: (p, f) => { p(6, 6, 12, 12, '#6aa84a'); p(8, 2, 10, 8, '#7cc05a'); p(4, 4, 4, 3, '#7cc05a'); p(18, 4, 4, 3, '#7cc05a'); p(15, 5, 2, 2, '#1b1b2b'); p(7, 18, 3, 4, '#4a3a2a'); p(14, 18, 3, 4, '#4a3a2a'); },
    jester: (p, f) => { p(6, 8, 12, 12, '#c23a3a'); p(12, 8, 6, 12, '#ffd56b'); p(8, 2, 10, 8, '#f2c29b'); p(4, 0, 8, 4, '#c23a3a'); p(14, 0, 8, 4, '#3a5aa8'); p(15, 5, 2, 2, '#1b1b2b'); p(7, 20, 3, 4, '#3a5aa8'); p(14, 20, 3, 4, '#c23a3a'); },
    frog: (p, f) => { p(2, 8, 20, 10, '#3a9a4a'); p(4, 4, 6, 6, '#3a9a4a'); p(14, 4, 6, 6, '#3a9a4a'); p(6, 5, 2, 2, '#1b1b2b'); p(16, 5, 2, 2, '#1b1b2b'); p(6, 14, 12, 4, '#cfe8a0'); p(0, 16, 6, 4, '#2a7a3a'); p(18, 16, 6, 4, '#2a7a3a'); },
    penguin: (p, f) => { p(6, 2, 12, 18, '#1b1b2b'); p(9, 6, 8, 12, '#ffffff'); p(14, 4, 2, 2, '#ffffff'); p(18, 7, 4, 2, '#ffb02a'); p(7, 20, 4, 2, '#ffb02a'); p(13, 20, 4, 2, '#ffb02a'); },
    shadeJ: (p, f) => { p(4, 4, 16, 16, 'rgba(255,100,210,0.7)'); p(14, 8, 3, 3, '#ffffff'); p(8, 8, 3, 3, '#ffffff'); p(6, 20, 3, 3, 'rgba(255,100,210,0.6)'); p(14, 20, 3, 3, 'rgba(255,100,210,0.6)'); },
    // летуны
    pigeon: (p, f) => { p(4, 6, 14, 8, '#8a90a0'); p(16, 3, 6, 6, '#6a7080'); p(22, 5, 3, 2, '#ffb02a'); p(19, 4, 2, 2, '#ff4a2a'); p(6, f ? 0 : 10, 10, 5, '#a6acba'); p(0, 8, 5, 3, '#6a7080'); },
    vulture: (p, f) => { p(4, 6, 14, 8, '#5a3a24'); p(16, 2, 6, 6, '#e0a090'); p(22, 4, 3, 3, '#e0c060'); p(0, f ? 0 : 10, 22, 5, '#3a2414'); },
    bat: (p, f) => { p(8, 4, 8, 8, '#3a2a4a'); p(10, 6, 2, 2, '#ff4a4a'); p(13, 6, 2, 2, '#ff4a4a'); p(0, f ? 0 : 6, 8, 5, '#2a1a3a'); p(16, f ? 0 : 6, 8, 5, '#2a1a3a'); },
    wisp: (p, f, t) => { p(6, 4, 12, 12, 'rgba(200,255,140,0.35)'); p(8, 6, 8, 8, '#d8ff9a'); p(10, 8, 4, 4, '#ffffff'); },
    owl: (p, f) => { p(6, 2, 12, 14, '#eef2f6'); p(8, 5, 3, 3, '#ffb02a'); p(13, 5, 3, 3, '#ffb02a'); p(11, 9, 2, 2, '#c08a2a'); p(0, f ? 2 : 8, 7, 5, '#d0d8e0'); p(17, f ? 2 : 8, 7, 5, '#d0d8e0'); },
    firebat: (p, f) => { p(8, 4, 8, 8, '#ff7a2a'); p(10, 6, 4, 2, '#ffd06a'); p(0, f ? 0 : 6, 8, 5, '#d23a2a'); p(16, f ? 0 : 6, 8, 5, '#d23a2a'); },
    // стрелки
    drone: (p, f, t) => { p(4, 8, 16, 6, '#3a3f4a'); p(10, 14, 4, 3, '#ff4a4a'); p(0, 4, 8, 2, (t >> 2) % 2 ? '#a0a6b0' : '#5a6068'); p(16, 4, 8, 2, (t >> 2) % 2 ? '#5a6068' : '#a0a6b0'); p(3, 6, 2, 2, '#3a3f4a'); p(19, 6, 2, 2, '#3a3f4a'); },
    goblin: (p, f) => { p(6, 8, 12, 14, '#6aa84a'); p(8, 2, 10, 8, '#7cc05a'); p(4, 4, 4, 3, '#7cc05a'); p(18, 4, 4, 3, '#7cc05a'); p(15, 5, 2, 2, '#1b1b2b'); p(18, 0, 2, 22, '#8a6a3a'); p(17, -4, 4, 4, '#c0c6d0'); },
    archer: (p, f) => { p(6, 6, 12, 16, '#3a7a3a'); p(8, 0, 10, 8, '#f2c29b'); p(6, -2, 12, 4, '#2a5a2a'); p(15, 3, 2, 2, '#1b1b2b'); p(18, 2, 2, 20, '#8a5a2a'); p(19, 2, 4, 2, '#8a5a2a'); p(19, 20, 4, 2, '#8a5a2a'); },
    plant: (p, f, t) => { p(10, 10, 4, 14, '#3a8a3a'); p(4, 0, 16, 12, '#c040a0'); p(8, 4, 8, 6, '#ffd06a'); p(4, 16, 6, 3, '#3a8a3a'); p(14, 18, 6, 3, '#3a8a3a'); },
    iceturret: (p) => { p(6, 4, 12, 20, '#8fd0ee'); p(8, 0, 8, 6, '#bfe8fa'); p(12, 10, 10, 4, '#5aa0d0'); p(9, 8, 3, 3, '#1b4a7a'); },
    turret: (p) => { p(4, 12, 16, 12, '#5a4a40'); p(8, 6, 8, 8, '#3a302a'); p(14, 8, 10, 4, '#2a2420'); p(10, 16, 4, 4, '#ff6a1a'); },
    eye: (p, f, t) => { p(4, 4, 16, 16, '#e8d8ff'); p(10 + Math.round(Math.sin(t * 0.05) * 2), 9, 6, 6, '#6a2aa8'); p(12 + Math.round(Math.sin(t * 0.05) * 2), 11, 2, 2, '#1b1b2b'); },
  };
  G.drawEnemy = function (ctx, e, camX, t) {
    const fn = SKINS[e.skin] || SKINS.dog;
    const f = Math.floor(t / 8) % 2;
    if (e.hurt > 0 && (e.hurt >> 1) % 2) ctx.globalAlpha = 0.5;
    sprite(ctx, e.x - camX - (24 - e.w) / 2, e.y - (e.h <= 20 ? 0 : 2), 24, e.dir < 0, (p) => fn(p, f, t));
    ctx.globalAlpha = 1;
    if (e.stun > 0) for (let i = 0; i < 3; i++) R(ctx, e.x - camX + e.w / 2 + Math.cos(t * 0.2 + i * 2) * 12, e.y - 8 + Math.sin(t * 0.2 + i * 2) * 3, 3, 3, '#ffd56b');
  };

  /* ================= БОССЫ ================= */
  const BOSS = {
    pigeon: (p, b, t) => { const f = Math.floor(t / 6) % 2; p(8, 20, 56, 28, '#8a90a0'); p(48, 8, 22, 22, '#6a7080'); p(68, 16, 10, 6, '#ffb02a'); p(58, 14, 5, 5, '#ff4a2a'); p(46, 4, 18, 6, '#ffd56b'); p(48, 0, 4, 6, '#ffd56b'); p(55, 0, 4, 6, '#ffd56b'); p(62, 0, 4, 6, '#ffd56b'); p(14, f ? 2 : 36, 36, 14, '#a6acba'); p(0, 26, 12, 8, '#6a7080'); p(28, 48, 4, 8, '#ffb02a'); p(40, 48, 4, 8, '#ffb02a'); },
    wolf: (p, b, t) => { const f = Math.floor(t / 5) % 2; p(6, 18, 58, 24, '#5a6068'); p(50, 6, 26, 24, '#6d747e'); p(50, 0, 7, 9, '#4a5058'); p(66, 0, 7, 9, '#4a5058'); p(74, 18, 6, 6, '#2a2a2a'); p(62, 12, 5, 4, '#ff3a2a'); p(66, 26, 10, 3, '#ffffff'); p(0, 14, 10, 8, '#4a5058'); p(10, 42, 7, 10 - f * 4, '#4a5058'); p(44, 42, 7, 6 + f * 4, '#4a5058'); if (b.stun > 0) p(30, 0, 20, 4, '#ffd56b'); },
    knight: (p, b, t) => { p(8, 14, 40, 44, '#2a2a33'); p(14, 0, 28, 20, '#3a3a44'); p(24, 8, 14, 4, '#ff3a2a'); p(20, -10, 8, 10, '#8a1a1a'); p(42, 18, 16, 36, '#4a1a1a'); p(46, 26, 8, 14, '#ffd56b'); p(-6, 10, 6, 46, '#c0c6d0'); p(-8, 8, 10, 4, '#8a6a3a'); p(14, 58, 10, 14, '#1a1a22'); p(32, 58, 10, 14, '#1a1a22'); },
    treant: (p, b, t) => { p(30, 40, 60, 120, '#5a3a24'); p(0, 0, 120, 60, '#2f6a3a'); p(10, -10, 100, 20, '#3a8a4a'); p(44, 70, 10, 10, b.open ? '#ffd56b' : '#2a1a10'); p(66, 70, 10, 10, b.open ? '#ffd56b' : '#2a1a10'); p(50, 96, 20, 6, '#2a1a10'); p(10, 60, 22, 8, '#5a3a24'); p(88, 60, 26, 8, '#5a3a24'); p(30, 150, 14, 10, '#4a2a18'); p(76, 150, 14, 10, '#4a2a18'); },
    serpent: (p, b, t) => { p(0, 8, 70, 26, '#cfe8f8'); p(56, 0, 34, 30, '#e8f6ff'); p(80, 8, 5, 5, '#3a7fd0'); p(86, 20, 8, 3, '#7ab0d8'); p(60, -6, 6, 8, '#ffffff'); p(70, -6, 6, 8, '#ffffff'); for (let i = 0; i < 5; i++) p(8 + i * 12, 4, 6, 6, '#ffffff'); },
    golem: (p, b, t) => { p(10, 20, 76, 70, '#4a3a36'); p(24, 0, 48, 26, '#5a4a44'); p(34, 8, 10, 6, '#ffb02a'); p(54, 8, 10, 6, '#ffb02a'); p(38, 40, 20, 20, b.open ? '#ffd06a' : '#ff6a1a'); p(-8, 26, 20, 50, '#3a2c28'); p(84, 26, 20, 50, '#3a2c28'); p(18, 90, 22, 30, '#3a2c28'); p(56, 90, 22, 30, '#3a2c28'); },
    keeper: (p, b, t) => { p(8, 10, 32, 50, '#2a1450'); p(4, 54, 40, 10, '#2a1450'); p(12, 0, 24, 18, '#3a1a6a'); p(16, 8, 16, 8, '#0d0420'); p(18, 10, 4, 3, '#ff6ad8'); p(26, 10, 4, 3, '#ff6ad8'); p(20, 24, 8, 8, '#ffd56b'); p(14, 26, 4, 4, '#2fae5c'); },
  };
  G.drawBoss = function (ctx, b, camX, t) {
    const fn = BOSS[b.kind];
    if (b.inv > 0 && (b.inv >> 2) % 2) ctx.globalAlpha = 0.45;
    if (b.kind === 'keeper' || b.kind === 'serpent') { ctx.save(); ctx.shadowColor = b.kind === 'keeper' ? '#ff6ad8' : '#ffffff'; ctx.shadowBlur = 14; }
    sprite(ctx, b.x - camX, b.y, b.w, b.dir < 0, (p) => fn(p, b, t));
    if (b.kind === 'keeper' || b.kind === 'serpent') ctx.restore();
    if (b.kind === 'serpent') for (let i = 1; i <= 5; i++) { const tx = b.x - camX + (b.dir < 0 ? b.w + i * 18 : -i * 18), ty = b.y + 12 + Math.sin(t * 0.15 - i) * 10; R(ctx, tx, ty, 18, 18 - i, '#cfe8f8'); }
    ctx.globalAlpha = 1;
    if (b.warn > 0) { ctx.globalAlpha = 0.25 + 0.25 * Math.sin(t * 0.5); R(ctx, b.x - camX - 4, b.y - 4, b.w + 8, b.h + 8, '#ffffff'); ctx.globalAlpha = 1; }
  };

  /* ================= ПРЕДМЕТЫ И ЭФФЕКТЫ ================= */
  G.drawItem = function (ctx, e, camX, t) {
    const x = Math.round(e.x - camX), y = Math.round(e.y);
    switch (e.t) {
      case 'coin': { const w = Math.max(2, Math.round(Math.abs(Math.cos(t * 0.08 + e.x * 0.01)) * 12)); R(ctx, x + 10 - w / 2, y + 4, w, 16, pal.light); R(ctx, x + 10 - w / 2 + 1, y + 6, Math.max(1, w / 3), 6, '#ffffff'); break; }
      case 'shard': { const bob = Math.round(Math.sin(t * 0.06) * 3); ctx.save(); ctx.shadowColor = '#c8a8ff'; ctx.shadowBlur = 16; ctx.fillStyle = '#b48aff'; ctx.beginPath(); ctx.moveTo(x + 12, y + bob); ctx.lineTo(x + 24, y + 14 + bob); ctx.lineTo(x + 12, y + 30 + bob); ctx.lineTo(x, y + 14 + bob); ctx.fill(); ctx.restore(); R(ctx, x + 8, y + 8 + bob, 4, 10, '#ffffff'); break; }
      case 'heart': { const b = Math.round(Math.sin(t * 0.1) * 2); heart(ctx, x + 2, y + 4 + b, '#ff4f6a'); break; }
      case 'flag': { R(ctx, x + 2, y - 30, 4, 62, '#d0d4dc'); R(ctx, x + 6, y - 28, 20, 14, e.on ? '#2fae5c' : '#8a8f99'); if (e.on) R(ctx, x + 10, y - 24, 6, 6, '#ffffff'); break; }
      case 'portal': {
        ctx.save(); ctx.translate(x + 16, y - 20);
        for (let i = 0; i < 4; i++) { ctx.strokeStyle = i % 2 ? '#c06cff' : '#ffffff'; ctx.globalAlpha = 0.9 - i * 0.18; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(0, 0, 22 + i * 5, 40 + i * 5, Math.sin(t * 0.03 + i) * 0.2, t * 0.05 + i, t * 0.05 + i + 4.6); ctx.stroke(); }
        ctx.globalAlpha = 0.6; ctx.fillStyle = '#7a3aff'; ctx.beginPath(); ctx.ellipse(0, 0, 18, 34, 0, 0, 7); ctx.fill();
        ctx.restore(); ctx.globalAlpha = 1; break;
      }
      case 'sign': { R(ctx, x + 12, y + 10, 6, 22, '#6a4a2a'); R(ctx, x, y - 6, 30, 18, '#a07a4a'); R(ctx, x + 2, y - 4, 26, 14, '#c49a62'); for (let i = 0; i < 3; i++) R(ctx, x + 5, y - 1 + i * 4, 20 - i * 4, 2, '#6a4a2a'); break; }
      case 'mover': { const w = e.w; R(ctx, x, y, w, 12, pal.plat); R(ctx, x, y, w, 3, shade(pal.plat, 0.35)); R(ctx, x, y + 10, w, 2, shade(pal.plat, -0.4)); for (let i = 6; i < w - 6; i += 16) R(ctx, x + i, y + 4, 6, 4, pal.accent); break; }
      case 'icicle': { const sh = e.state === 1 ? ((t >> 1) % 2 ? 1 : -1) : 0; ctx.fillStyle = '#d8f2ff'; ctx.beginPath(); ctx.moveTo(x + 2 + sh, y); ctx.lineTo(x + 22 + sh, y); ctx.lineTo(x + 12 + sh, y + 30); ctx.fill(); R(ctx, x + 8 + sh, y + 2, 3, 12, '#ffffff'); break; }
      case 'firejet': {
        R(ctx, x + 6, y + 20, 20, 12, '#3a302a'); R(ctx, x + 10, y + 16, 12, 6, '#5a4a40');
        if (e.state === 1) { ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 0.6); R(ctx, x + 12, y + 8, 8, 8, '#ffb02a'); ctx.globalAlpha = 1; }
        if (e.state === 2) { for (let i = 0; i < 6; i++) { const w = 18 - i * 2 + ((t + i) % 3) * 2; R(ctx, x + 16 - w / 2, y + 16 - (i + 1) * 16, w, 16, i < 2 ? '#fff0a0' : i < 4 ? '#ffb02a' : '#ff5a1a'); } }
        break;
      }
    }
  };
  function heart(ctx, x, y, col) { R(ctx, x + 2, y, 6, 4, col); R(ctx, x + 12, y, 6, 4, col); R(ctx, x, y + 2, 20, 8, col); R(ctx, x + 2, y + 10, 16, 4, col); R(ctx, x + 6, y + 14, 8, 4, col); R(ctx, x + 4, y + 2, 4, 3, '#ffffff'); }
  G.heart = heart;

  G.drawShot = function (ctx, s, camX, t) {
    const x = Math.round(s.x - camX), y = Math.round(s.y);
    switch (s.kind) {
      case 'fireball': ctx.save(); ctx.shadowColor = '#ffb02a'; ctx.shadowBlur = 12; R(ctx, x, y, 14, 14, '#ff6a1a'); R(ctx, x + 3, y + 3, 8, 8, '#ffe08a'); ctx.restore(); break;
      case 'arrow': R(ctx, x, y + 5, 22, 3, '#8a5a2a'); R(ctx, s.vx > 0 ? x + 20 : x - 4, y + 3, 6, 7, '#c0c6d0'); break;
      case 'spear': R(ctx, x, y + 5, 26, 3, '#8a6a3a'); R(ctx, s.vx > 0 ? x + 24 : x - 4, y + 2, 6, 9, '#c0c6d0'); break;
      case 'seed': R(ctx, x, y, 12, 12, '#7a5a2a'); R(ctx, x + 3, y + 3, 4, 4, '#c9a05a'); break;
      case 'ice': R(ctx, x, y, 12, 12, '#bfe8fa'); R(ctx, x + 3, y + 3, 4, 4, '#ffffff'); break;
      case 'fire': R(ctx, x, y, 12, 12, '#ff5a1a'); R(ctx, x + 3, y + 3, 6, 6, '#ffd06a'); break;
      case 'orb': ctx.save(); ctx.shadowColor = '#ff6ad8'; ctx.shadowBlur = 10; R(ctx, x, y, 14, 14, '#ff6ad8'); R(ctx, x + 4, y + 4, 6, 6, '#ffffff'); ctx.restore(); break;
      case 'laser': R(ctx, x, y, 8, 4, '#ff3a5a'); break;
      case 'shock': for (let i = 0; i < 3; i++) R(ctx, x + i * 6, y + 18 - i * 8, 8, 6 + i * 8, i === 2 ? '#ffffff' : '#ffd56b'); break;
      case 'feather': R(ctx, x, y, 14, 6, '#c0c6d0'); break;
      case 'root': R(ctx, x, y, 24, s.h, '#5a3a24'); R(ctx, x + 8, y, 8, 8, '#7a5a3a'); break;
      case 'beam': ctx.globalAlpha = 0.85; R(ctx, x, 0, s.w, K.VH, '#ff6ad8'); R(ctx, x + s.w / 2 - 3, 0, 6, K.VH, '#ffffff'); ctx.globalAlpha = 1; break;
      case 'warn': ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 0.6); R(ctx, x, s.y, s.w, s.h, '#ff4a4a'); ctx.globalAlpha = 1; break;
      default: R(ctx, x, y, 10, 10, '#ffffff');
    }
  };

  G.drawParticles = function (ctx, parts, camX) {
    for (const p of parts) { ctx.globalAlpha = Math.max(0, p.life / p.max); R(ctx, p.x - camX, p.y, p.s, p.s, p.c); }
    ctx.globalAlpha = 1;
  };

  /* ================= ПОГОНЯ ================= */
  const CHASE = { stampede: ['#4a3020', '#a07a4a', '#e0c49a'], rubble: ['#3f444d', '#8a8f99', '#c8ccd4'], swamp: ['#14382a', '#3f8a6a', '#a8f0c0'], avalanche: ['#9fb4c8', '#e2ecf6', '#ffffff'], lava: ['#6a1404', '#ff6a1a', '#ffd06a'], void: ['#04020c', '#3a1460', '#c08aff'] };
  G.chaseColor = (k) => CHASE[k][2];
  G.drawChase = function (ctx, c, camX, t) {
    const fx = Math.round(c.x - camX), col = CHASE[c.kind];
    if (fx < -60) return;
    if (fx > 0) {
      const g = ctx.createLinearGradient(fx - 260, 0, fx, 0);
      g.addColorStop(0, col[0]); g.addColorStop(1, col[1]);
      ctx.fillStyle = g; ctx.fillRect(0, 0, fx, K.VH);
    }
    for (let y = -16; y < K.VH + 16; y += 16) {
      const wob = Math.sin(t * 0.21 + y * 0.07) * 10 + Math.sin(t * 0.13 + y * 0.21) * 6;
      R(ctx, fx - 34 + wob, y, 38, 18, col[1]);
      R(ctx, fx - 10 + wob, y + 4, 16, 10, col[2]);
    }
    if (c.kind === 'stampede') for (let i = 0; i < 4; i++) {
      const hx = fx - 40 - i * 46, hy = 380 + (i % 2) * 40 + Math.round(Math.abs(Math.sin(t * 0.25 + i)) * -14);
      R(ctx, hx, hy, 40, 18, '#2a1a10'); R(ctx, hx + 28, hy - 18, 14, 22, '#2a1a10'); R(ctx, hx + 36, hy - 12, 12, 8, '#2a1a10'); R(ctx, hx + 30, hy - 22, 4, 6, '#2a1a10');
    }
    if (c.kind === 'rubble' || c.kind === 'avalanche') for (let i = 0; i < 8; i++) {
      const sx = fx - 20 + ((i * 37 + t * 3) % 70), sy = ((t * (4 + i % 3) + i * 90) % (K.VH + 40)) - 20, sz = 10 + (i % 3) * 6;
      R(ctx, sx, sy, sz, sz, c.kind === 'rubble' ? '#6c717b' : '#ffffff');
    }
    if (c.kind === 'lava') { ctx.fillStyle = 'rgba(255,140,40,0.18)'; ctx.fillRect(fx, 0, 80, K.VH); }
    if (c.kind === 'void') for (let i = 0; i < 26; i++) R(ctx, (fx - 30 - ((i * 53) % Math.max(60, fx + 30))), (i * 97 + t) % K.VH, 2, 2, '#ffffff');
  };
  // Когда погоня за краем экрана — красная полоса слева, ярче по мере приближения.
  G.drawChaseWarn = function (ctx, gap, t) {
    if (gap > 900) return;
    const k = Math.max(0, Math.min(1, (900 - gap) / 600));
    const g = ctx.createLinearGradient(0, 0, 90, 0);
    g.addColorStop(0, `rgba(255,60,60,${0.55 * k * (0.75 + 0.25 * Math.sin(t * 0.3))})`); g.addColorStop(1, 'rgba(255,60,60,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 40, 90, K.VH - 40);
  };

  /* ================= ИНТЕРФЕЙС НА ХОЛСТЕ ================= */
  G.font = (px) => `${px}px "Pixelify Sans", "Press Start 2P", monospace`;
  G.drawHud = function (ctx, S) {
    R(ctx, 0, 0, K.VW, 40, 'rgba(0,0,0,0.35)');
    for (let i = 0; i < S.maxHp; i++) heart(ctx, 12 + i * 26, 10, i < S.hp ? '#ff4f6a' : 'rgba(255,255,255,0.18)');
    ctx.font = G.font(20); ctx.textBaseline = 'middle';
    if (S.totalCoins > 0) {
      R(ctx, 104, 12, 10, 16, pal.light);
      ctx.fillStyle = '#ffffff'; ctx.fillText(`${S.coins}/${S.totalCoins}`, 122, 21);
      for (let i = 0; i < 3; i++) { ctx.fillStyle = S.shards[i] ? '#b48aff' : 'rgba(255,255,255,0.2)'; ctx.beginPath(); const sx = 230 + i * 22; ctx.moveTo(sx + 7, 8); ctx.lineTo(sx + 14, 20); ctx.lineTo(sx + 7, 32); ctx.lineTo(sx, 20); ctx.fill(); }
    }
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.fillText(S.title, K.VW / 2, 21);
    ctx.textAlign = 'right'; const s = Math.floor(S.time / 60); ctx.fillText(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`, K.VW - 58, 21);
    ctx.textAlign = 'left';
  };
  G.drawBossBar = function (ctx, b, name) {
    const w = 420, x = (K.VW - w) / 2, y = 50;
    R(ctx, x - 2, y - 2, w + 4, 14, '#000000');
    R(ctx, x, y, w * Math.max(0, b.hp / b.maxHp), 10, '#ff4f6a');
    ctx.font = G.font(16); ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText(name, K.VW / 2, y + 30); ctx.textAlign = 'left';
  };
  G.drawSignText = function (ctx, text, x, y) {
    ctx.font = G.font(16);
    const w = Math.min(520, ctx.measureText(text).width + 24);
    const bx = Math.max(8, Math.min(K.VW - w - 8, x - w / 2));
    R(ctx, bx, y - 40, w, 30, 'rgba(10,10,20,0.85)');
    R(ctx, bx, y - 40, w, 2, pal.light);
    ctx.fillStyle = '#ffffff'; ctx.textBaseline = 'middle'; ctx.fillText(text, bx + 12, y - 25, w - 24);
  };

  G.setWorld = function (id) {
    if (id === worldId && atlas) return;
    worldId = id;
    pal = K.worldById(id).pal;
    buildAtlas();
    buildBg();
  };
  G.pal = () => pal;
})();
