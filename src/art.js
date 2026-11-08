'use strict';
// ---------- Картинки для интерфейса: оружие сбоку, постройки движком карты, портреты ----------

// Оружие нарисовано в рамке 100×40, ствол/лезвие смотрит вправо
const WPN_ART = {
  knife(c) {
    c.fillStyle = '#3a2a1c'; c.fillRect(8, 16, 30, 8);
    c.fillStyle = '#c9c3b2'; c.fillRect(14, 19, 2, 2); c.fillRect(26, 19, 2, 2);
    c.fillStyle = '#5a5d60'; c.fillRect(37, 12, 5, 16);
    c.fillStyle = '#b9bec4'; c.beginPath(); c.moveTo(42, 15); c.lineTo(86, 18); c.lineTo(93, 21); c.lineTo(42, 25); c.closePath(); c.fill();
    c.fillStyle = '#e8ecef'; c.beginPath(); c.moveTo(42, 15); c.lineTo(86, 18); c.lineTo(93, 21); c.lineTo(42, 18.5); c.closePath(); c.fill();
  },
  bat(c) {
    c.fillStyle = '#9a7444'; c.beginPath(); c.moveTo(6, 18); c.lineTo(40, 17); c.lineTo(90, 12); c.quadraticCurveTo(97, 20, 90, 28); c.lineTo(40, 23); c.lineTo(6, 22); c.closePath(); c.fill();
    c.fillStyle = '#c29a62'; c.beginPath(); c.moveTo(40, 17); c.lineTo(90, 12); c.quadraticCurveTo(94, 15, 93, 18); c.lineTo(40, 19.5); c.closePath(); c.fill();
    c.fillStyle = '#26221c'; c.fillRect(6, 17, 22, 6);
    c.strokeStyle = 'rgba(60,40,20,0.5)'; c.lineWidth = 1; c.beginPath(); c.moveTo(48, 21); c.lineTo(84, 18); c.stroke();
    c.strokeStyle = '#8a8f94'; c.lineWidth = 1.2; c.beginPath();
    for (let x = 56; x < 88; x += 6) { c.moveTo(x, 13); c.lineTo(x + 3, 27); }
    c.stroke();
  },
  crowbar(c) {
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = '#7a2a22'; c.lineWidth = 6;
    c.beginPath(); c.moveTo(14, 30); c.lineTo(82, 14); c.quadraticCurveTo(94, 11, 92, 22); c.stroke();
    c.strokeStyle = '#b8483a'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(16, 28); c.lineTo(80, 13); c.stroke();
    c.strokeStyle = '#7a2a22'; c.lineWidth = 5; c.beginPath(); c.moveTo(14, 30); c.lineTo(6, 26); c.stroke();
  },
  axe(c) {
    c.lineCap = 'round';
    c.strokeStyle = '#6e4f2c'; c.lineWidth = 6; c.beginPath(); c.moveTo(8, 33); c.lineTo(80, 12); c.stroke();
    c.strokeStyle = '#a07a48'; c.lineWidth = 2; c.beginPath(); c.moveTo(10, 31); c.lineTo(78, 11); c.stroke();
    c.fillStyle = '#b83a2a'; c.beginPath(); c.moveTo(66, 6); c.lineTo(80, 4); c.lineTo(84, 20); c.lineTo(70, 22); c.closePath(); c.fill();
    c.fillStyle = '#9aa0a6'; c.beginPath(); c.moveTo(80, 4); c.lineTo(96, 0); c.quadraticCurveTo(100, 14, 96, 30); c.lineTo(84, 20); c.closePath(); c.fill();
    c.fillStyle = '#e2e6ea'; c.beginPath(); c.moveTo(96, 0); c.quadraticCurveTo(100, 14, 96, 30); c.lineTo(94, 28); c.quadraticCurveTo(97, 14, 94, 3); c.closePath(); c.fill();
  },
  pistol(c) {
    c.fillStyle = '#2c2f33'; c.fillRect(28, 10, 54, 9);
    c.fillStyle = '#4a4f55'; c.fillRect(28, 10, 54, 3);
    c.fillStyle = '#1e2023'; c.fillRect(80, 12, 8, 5);
    c.fillStyle = '#3a2a1c'; c.beginPath(); c.moveTo(32, 19); c.lineTo(48, 19); c.lineTo(44, 36); c.lineTo(28, 36); c.closePath(); c.fill();
    c.strokeStyle = '#2c2f33'; c.lineWidth = 2; c.beginPath(); c.arc(54, 21, 6, 0, Math.PI); c.stroke();
    c.fillStyle = '#c9c3b2'; c.fillRect(31, 23, 2, 9);
  },
  shotgun(c) {
    c.fillStyle = '#7a5530'; c.beginPath(); c.moveTo(2, 22); c.lineTo(34, 15); c.lineTo(44, 15); c.lineTo(44, 24); c.lineTo(30, 24); c.lineTo(4, 31); c.closePath(); c.fill();
    c.fillStyle = '#9a7444'; c.beginPath(); c.moveTo(2, 22); c.lineTo(34, 15); c.lineTo(44, 15); c.lineTo(44, 18); c.lineTo(33, 18); c.lineTo(3, 25); c.closePath(); c.fill();
    c.fillStyle = '#2c2f33'; c.fillRect(43, 13, 55, 4); c.fillRect(43, 17, 55, 4);
    c.fillStyle = '#4a4f55'; c.fillRect(43, 13, 55, 1.5);
    c.fillStyle = '#7a5530'; c.fillRect(56, 21, 22, 4);
    c.strokeStyle = '#2c2f33'; c.lineWidth = 2; c.beginPath(); c.arc(46, 25, 4, 0, Math.PI); c.stroke();
  },
  rifle(c) {
    c.fillStyle = '#6e4f2c'; c.beginPath(); c.moveTo(2, 21); c.lineTo(30, 16); c.lineTo(38, 16); c.lineTo(38, 25); c.lineTo(28, 25); c.lineTo(4, 30); c.closePath(); c.fill();
    c.fillStyle = '#2c2f33'; c.fillRect(37, 15, 26, 9); c.fillRect(62, 17, 36, 3);
    c.fillStyle = '#6e4f2c'; c.fillRect(56, 20, 22, 4);
    c.fillStyle = '#1e2023'; c.fillRect(44, 6, 20, 5); c.fillRect(48, 11, 3, 4); c.fillRect(58, 11, 3, 4);
    c.fillStyle = '#7ea6c4'; c.fillRect(63, 7, 2, 3);
    c.fillStyle = '#2c2f33'; c.fillRect(46, 24, 6, 9);
    c.strokeStyle = '#2c2f33'; c.lineWidth = 2; c.beginPath(); c.arc(41, 26, 4, 0, Math.PI); c.stroke();
  },
};
function drawWeaponArt(cv, w) {
  const dpr = Math.min(3, window.devicePixelRatio || 1), W = cv.clientWidth || 80, H = cv.clientHeight || 32;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  const c = cv.getContext('2d');
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
  if (!WPN_ART[w]) return;
  const s = Math.min(W / 100, H / 40) * dpr;
  c.setTransform(s, 0, 0, s, (W * dpr - 100 * s) / 2, (H * dpr - 40 * s) / 2);
  c.save(); c.translate(1.5, 2.5); c.globalAlpha = 0.35; c.filter = 'brightness(0)'; WPN_ART[w](c); c.restore();
  c.filter = 'none'; c.globalAlpha = 1;
  WPN_ART[w](c);
}

// ----- миниатюры построек: маленькая сцена, нарисованная движком карты -----
const THUMBS = new Map();
function thumbScene(key, lv) {
  const m = newMap(8, 6, 99), r = makeRng(5);
  for (let i = 0; i < m.n; i++) { m.tiles[i] = m.ground[i] = (hash2(i % 8, (i / 8) | 0, 3) > 0.55 ? T.DIRT : T.GRASS); }
  const g = (x, y, t, meta = 0) => { m.tiles[MI(m, x, y)] = t; if (TP[t].floor) m.ground[MI(m, x, y)] = t; m.meta[MI(m, x, y)] = meta; };
  const prop = (k, x, y, w, h, o = {}) => { m.props.push(Object.assign({ k, x, y, w, h }, o)); for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) g(xx, yy, o.tall ? T.BLOCKH : T.BLOCK); };
  const L = Math.max(1, lv);
  if (key === 'walls') {
    for (let x = 0; x < 8; x++) {
      if (L === 1) g(x, 3, T.FENCE, 0);
      else if (L === 2) { g(x, 3, T.FENCE, 0); g(x, 1, T.FENCE, 1); }
      else g(x, 3, T.WALL);
    }
    if (L >= 2) { g(2, 4, T.SANDBAG); g(3, 4, T.SANDBAG); g(4, 4, T.SANDBAG); }
    if (L >= 3) prop('tower', 5, 4, 2, 2, { tall: true });
  } else if (key === 'water') {
    const nd = [1, 2, 4, 6][L];
    for (let k = 0; k < nd; k++) g(1 + (k % 3) * 2, 1 + Math.floor(k / 3) * 2, T.DRUM);
    if (L >= 2) prop('wtower', 5, 2, 2, 2, { tall: true });
  } else if (key === 'garden') {
    const beds = [2, 2, 4, 6][L];
    for (let k = 0; k < beds; k++) { const x = 1 + (k % 2) * 4, y = Math.floor(k / 2) * 2; for (let xx = 0; xx < 3; xx++) { m.ground[MI(m, x + xx, y)] = T.DIRT; g(x + xx, y, T.CROP, k % 2); } }
    if (L >= 3) g(7, 5, T.CRATE);
  } else if (key === 'infirmary') {
    prop('medtent', 1, 1, 3, 3, { c: '#d6d2c4' });
    g(5, 2, T.FURN, FURN_V.cot); if (L >= 2) { g(6, 2, T.FURN, FURN_V.cot); g(5, 4, T.MEDCAB); } if (L >= 3) g(6, 4, T.MEDCAB);
  } else if (key === 'workshop') {
    g(1, 3, T.CRATE); g(2, 3, T.BENCH); g(3, 3, T.CRATE);
    if (L >= 2) { for (let x = 4; x < 8; x++) { g(x, 0, T.WWALL); } g(4, 1, T.WWALL); g(4, 2, T.WWALL); g(5, 1, T.BENCH); g(6, 1, T.DRUM); }
    if (L >= 3) prop('machine', 4, 3, 3, 2, { c: '#5d6b70' });
  } else if (key === 'radio') {
    prop('mast', 3, 2, 1, 1, { tall: true, hgt: L >= 2 ? 6 : 4 });
    g(5, 3, T.DRUM); g(1, 3, T.CRATE);
  }
  m.seen = new Uint8Array(m.n).fill(1); m.vis = new Uint8Array(m.n).fill(1);
  m.units = []; m.zombies = []; m.turn = 1; m.tod = 0;
  return m;
}
function buildThumb(key, lv, W, H) {
  const id = `${key}|${lv}|${W}x${H}`;
  let cv = THUMBS.get(id);
  if (cv) return cv;
  const dpr = 2, m = thumbScene(key, lv);
  cv = document.createElement('canvas'); cv.width = W * dpr; cv.height = H * dpr;
  const c = cv.getContext('2d');
  const tall = { radio: 6, water: 3.2, walls: 2.4, infirmary: 1.4, workshop: 1.6, garden: 0.8 }[key] || 1;
  const k = Math.max(17, W / 8.4), cam = { cx: 4, cy: 3, k, rot: 0 };
  const save = { dpr: R.dpr, hits: R.hits, obj: R.objHits, budget: GroundTex.budget };
  R.dpr = dpr; GroundTex.budget = 60;
  try {
    c.fillStyle = '#1c1b16'; c.fillRect(0, 0, cv.width, cv.height);
    drawIso(c, m, cam, W, H, performance.now(), true, [0, Math.min(H * 0.32, tall * k * VX.cE * 0.42)]);
  } catch (e) { console.error(e); }
  R.dpr = save.dpr; R.hits = save.hits; R.objHits = save.obj; GroundTex.budget = save.budget;
  R.dirty = true;
  THUMBS.set(id, cv);
  return cv;
}
function drawBuildThumb(cv, key, lv) {
  const W = cv.clientWidth || 160, H = cv.clientHeight || 70, dpr = Math.min(3, window.devicePixelRatio || 1);
  const src = buildThumb(key, lv, W, H);
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  const c = cv.getContext('2d');
  c.drawImage(src, 0, 0, cv.width, cv.height);
  if (!lv) { c.fillStyle = 'rgba(19,18,14,0.55)'; c.fillRect(0, 0, cv.width, cv.height); }
}

// Нарисовать все картинки внутри узла
function paintAvatars(root) {
  for (const cv of root.querySelectorAll('canvas[data-pt]')) { const s = S.survivors.find(o => o.id === +cv.dataset.pt); if (s) try { drawPortrait(cv, s); } catch (e) { console.error(e); } }
  for (const cv of root.querySelectorAll('canvas[data-wpn]')) try { drawWeaponArt(cv, cv.dataset.wpn); } catch (e) { console.error(e); }
  for (const cv of root.querySelectorAll('canvas[data-bth]')) try { drawBuildThumb(cv, cv.dataset.bth, +cv.dataset.lv); } catch (e) { console.error(e); }
  for (const cv of root.querySelectorAll('canvas[data-fig]')) try { drawFigure(cv, cv.dataset.fig); } catch (e) { console.error(e); }
}
