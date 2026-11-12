'use strict';
/* Графика, часть 2: наряды, новые клетки и постройки, мебель усадьбы, иконки подарков, фоны сцен-свиданий */
(function () {
  const A = window.ART, T = D.T, TAU = Math.PI * 2, OUT = '#21121c', sin = Math.sin, cos = Math.cos;
  const cv = (w, h, s) => U.canvas(w, h, s);
  const circ = (x, a, b, r) => { x.beginPath(); x.arc(a, b, r, 0, TAU); x.fill(); };
  const ell = (x, a, b, rx, ry, rot) => { x.beginPath(); x.ellipse(a, b, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, TAU); x.fill(); };
  const ink = (x, fill, lw) => { if (fill) { x.fillStyle = fill; x.fill(); } x.lineWidth = lw || 2.2; x.strokeStyle = OUT; x.lineJoin = 'round'; x.lineCap = 'round'; x.stroke(); };
  const P = (x, p) => { x.beginPath(); x.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) x.lineTo(p[i], p[i + 1]); x.closePath(); };
  const hx = c => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const toHex = a => '#' + a.map(v => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, '0')).join('');
  const mix = (c, d, k) => { const a = hx(c), b = hx(d); return toHex(a.map((v, i) => v + (b[i] - v) * k)); };
  A.mix = mix;

  /* ---------- Наряды ---------- */
  D.OUTFITS = {
    base: { n: 'Обычный', price: 0 },
    swim: { n: 'Пляжный', price: 220, d: 'Слитный купальник и сандалии. Для пляжа и брызг.' },
    pajama: { n: 'Пижама', price: 140, d: 'Мягкая пижама в горошек и колпак с помпоном.' },
    gala: { n: 'Праздничный', price: 320, d: 'Вечернее платье с блёстками — для балов и признаний.' },
    night: { n: 'Пеньюар', price: 450, d: 'Шёлковая сорочка с кружевом. Для вечеров вдвоём.' },
    bikini: { n: 'Бикини', price: 380, d: 'Раздельный купальник на завязках. Пляж одобряет.' },
    lace: { n: 'Кружевное бельё', price: 600, d: 'Кружево, чулки и подвязки. Только для самых близких вечеров.' },
    towel: { n: 'Полотенце', price: 0, hidden: true }
  };
  const cache = {};
  A.dress = function (id, k) {
    const key = id + ':' + k; if (cache[key]) return cache[key];
    const b = D.GIRLS[id].look, L = Object.assign({}, b), legs = b.lower === 'legs' || b.lower === 'dress';
    if (k === 'swim') {
      Object.assign(L, { outfit: 'swim', top: b.top === '#2a1a2e' ? '#b01e34' : b.top, top2: '#ffffff', bottom: b.top === '#2a1a2e' ? '#b01e34' : b.top });
      if (legs) Object.assign(L, { lower: 'legs', socks: null, shoes: '#e8a86a' });
      L.helmet = false; L.hat = false; L.flowerpin = '#ff9ac8';
    } else if (k === 'pajama') {
      const pc = mix(b.top === '#2a1a2e' ? '#8a5ad8' : b.top, '#ffffff', 0.55);
      Object.assign(L, { outfit: 'pajama', top: pc, top2: b.top, bottom: pc, nightcap: mix(pc, '#ffffff', 0.25) });
      if (legs) Object.assign(L, { lower: 'legs', socks: pc, shoes: '#ffffff' });
      L.helmet = false; L.hat = false; L.tiara = false;
    } else if (k === 'gala') {
      const gc = b.top === '#fffaf0' || b.top === '#dfe3ee' ? (b.bottom || '#3a62c4') : b.top;
      Object.assign(L, { outfit: 'gala', top: gc, top2: '#ffd04a', bottom: gc, flowerpin: '#ffd04a' });
      if (b.lower === 'legs') Object.assign(L, { lower: 'dress' });
      L.helmet = false;
    }
    else if (k === 'night') {
      const nc = ({ fox: '#c8324e', slime: '#3a7ad8', harpy: '#2a8a7a', lamia: '#6a2a8a', dryad: '#2a7a3a', minotaur: '#c84a7a', vampire: '#3a1040', valkyrie: '#3a5ac8', neko: '#2a2a4a', snow: '#7aa8e8', mermaid: '#e85a9a', frog: '#3a8a4a', ghost: '#8a8ae8', dragon: '#a01828' })[id] || '#b03a6a';
      Object.assign(L, { outfit: 'slip', top: nc, top2: '#fff0f6', bottom: nc });
      if (legs) Object.assign(L, { lower: 'legs', socks: null, shoes: b.skin });
      L.helmet = false; L.hat = false; L.tiara = false;
    } else if (k === 'bikini' || k === 'lace') {
      const nc = ({ fox: '#e8363c', slime: '#2a8ae8', harpy: '#f2c832', lamia: '#c23c9a', dryad: '#3aa83a', minotaur: '#3a6ad8', vampire: '#b01e34', valkyrie: '#f4f6ff', neko: '#ffd23a', snow: '#8ad0ff', mermaid: '#ff7aa8', frog: '#ffd23a', ghost: '#d8e0ff', dragon: '#d42a2a' })[id] || '#ff5a8a';
      const lc = k === 'lace' ? ({ valkyrie: '#f4f6ff', snow: '#f4f8ff', ghost: '#eef0ff', slime: '#e8f4ff' }[id] || '#241420') : nc;
      Object.assign(L, { outfit: k, top: lc, top2: k === 'lace' ? (lc === '#241420' ? '#c8324e' : '#ffb0d0') : '#ffffff', bottom: lc });
      if (legs) Object.assign(L, { lower: 'legs', socks: k === 'lace' ? (lc === '#241420' ? '#3a2a36' : '#ffffff') : null, shoes: k === 'lace' ? lc : '#e8a86a' });
      L.helmet = false; L.hat = false; if (k === 'bikini') L.flowerpin = '#ff9ac8';
    } else if (k === 'towel') {
      Object.assign(L, { outfit: 'towel', top: '#ffffff', top2: '#e4ecf6', bottom: '#ffffff' });
      if (legs) Object.assign(L, { lower: 'legs', socks: null, shoes: b.skin });
      L.helmet = false; L.hat = false; L.tiara = false; L.bow = false;
    }
    return (cache[key] = L);
  };

  /* ---------- Клетки ---------- */
  const tile = (fn, s) => { const [c, x] = cv(T, T, 1.5); fn(x, U.rng(s)); return c; };
  Object.assign(A.tile, {
    sand: s => tile((x, r) => { x.fillStyle = '#f2dca0'; x.fillRect(0, 0, T, T); x.fillStyle = '#e6cc8a'; for (let i = 0; i < 7; i++) ell(x, r() * T, r() * T, 3 + r() * 6, 1.6 + r() * 2); x.fillStyle = 'rgba(255,255,255,.4)'; for (let i = 0; i < 6; i++) circ(x, r() * T, r() * T, 0.9); if (r() < 0.3) { x.fillStyle = '#ffb0b8'; const px = 8 + r() * 30, py = 8 + r() * 30; x.beginPath(); x.arc(px, py, 3.4, Math.PI, 0); x.closePath(); x.fill(); } }, s),
    swamp: s => tile((x, r) => { x.fillStyle = '#5a7a44'; x.fillRect(0, 0, T, T); x.fillStyle = '#4a6a38'; for (let i = 0; i < 7; i++) ell(x, r() * T, r() * T, 4 + r() * 7, 2 + r() * 3); x.fillStyle = 'rgba(90,70,40,.45)'; for (let i = 0; i < 2; i++) ell(x, r() * T, r() * T, 6 + r() * 6, 3 + r() * 2); x.strokeStyle = '#3e5a30'; x.lineWidth = 1.3; for (let i = 0; i < 5; i++) { const px = 4 + r() * 40, py = 8 + r() * 36; x.beginPath(); x.moveTo(px, py); x.lineTo(px + 1, py - 6); x.stroke(); } }, s),
    wood: s => tile((x, r) => { x.fillStyle = '#c8905a'; x.fillRect(0, 0, T, T); for (let i = 0; i < 4; i++) { x.fillStyle = i % 2 ? '#c08852' : '#cc9862'; x.fillRect(0, i * 12, T, 12); x.fillStyle = 'rgba(80,40,10,.35)'; x.fillRect(0, i * 12 + 11, T, 1.2); x.fillRect(((i * 17 + s * 7) % 40) + 4, i * 12, 1.2, 12); } x.fillStyle = 'rgba(255,240,210,.12)'; x.fillRect(0, 0, T, 3); }, s),
    dungeon: s => tile((x, r) => { x.fillStyle = '#3a3448'; x.fillRect(0, 0, T, T); x.fillStyle = '#4a4458'; for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) { x.beginPath(); U.rr(x, i * 16 + (j % 2) * 8 - 4, j * 16 + 1, 14, 14, 3); x.fill(); } x.fillStyle = 'rgba(150,120,255,.12)'; if (r() < 0.3) ell(x, r() * T, r() * T, 4, 2); }, s)
  });

  A.tile.wallp = s => tile((x, r) => { x.fillStyle = '#e8a0b8'; x.fillRect(0, 0, T, T); x.fillStyle = '#f4b8cc'; for (let i = 0; i < 4; i++) x.fillRect(i * 12 + 2, 0, 6, T * 0.75); x.fillStyle = '#a86a5a'; x.fillRect(0, T * 0.75, T, T * 0.25); x.fillStyle = 'rgba(0,0,0,.2)'; x.fillRect(0, T * 0.75, T, 2); A.heart(x, 24, 18, 3, '#ff6a9a'); }, s);
  Object.assign(A.LOOKS, {
    tolya: { hair: '#f2d24a', skin: '#e8b080', shirt: '#e83a3a', pants: '#3a6ad8', shoes: '#f2d2a0', cap: '#ffffff' },
    klava: { hair: '#4a7a3a', skin: '#c8e0a8', shirt: '#3a5a2a', pants: '#3a5a2a', shoes: '#2a3a1a', skirt: true, scarf: '#8a6a3a' },
    marfa: { hair: '#8a4a2a', skin: '#f6cca8', shirt: '#4a8a5a', pants: '#4a8a5a', shoes: '#2a2018', apron: '#fff4dc', skirt: true, scarf: '#ffd04a', bun: true },
    smith: { hair: '#2a1e18', skin: '#d8a078', shirt: '#6a5a4a', pants: '#3a342c', shoes: '#1a1410', apron: '#4a3a2a', mustache: true, bald: true },
    milka: { hair: '#f2d24a', skin: '#ffe0c8', shirt: '#ff8ab0', pants: '#ff8ab0', shoes: '#4a2c20', skirt: true, bun: true },
    guard: { hair: '#6a4a2a', skin: '#e8b890', shirt: '#4a6a9a', pants: '#3a3a4a', shoes: '#1a1410', cap: '#8a8e9a', mustache: true },
    kondrat: { hair: '#e8e4dc', skin: '#f4f0e6', shirt: '#2a2a3a', pants: '#2a2a3a', shoes: '#111', bald: true, tophat: true }
  });

  /* ---------- Постройки и предметы ---------- */
  function manor() {
    const W = 4 * T, H = 4 * T, [c, x] = cv(W, H, 1.5);
    x.fillStyle = 'rgba(30,20,30,.25)'; x.fillRect(10, H - 10, W - 14, 10);
    x.beginPath(); U.rr(x, 8, H - 110, W - 16, 102, 4); ink(x, '#ffe4ec', 2.6);
    x.fillStyle = 'rgba(200,90,130,.18)'; for (let px = 16; px < W - 16; px += 12) x.fillRect(px, H - 106, 1.4, 96);
    x.beginPath(); x.moveTo(0, H - 104); x.lineTo(W / 2, H - 190); x.lineTo(W, H - 104); x.closePath(); ink(x, U.lg(x, 0, H - 190, 0, H - 104, ['#b07ae8', '#8a5ad8', '#6a3ab0']), 2.8);
    A.heart(x, W / 2, H - 140, 12, '#ff4f7b');
    x.beginPath(); U.rr(x, W / 2 - 16, H - 52, 32, 46, 14); ink(x, '#c85a8a', 2.4); x.fillStyle = '#ffd04a'; circ(x, W / 2 + 9, H - 28, 2.2);
    for (const px of [26, W - 58]) { x.beginPath(); x.arc(px + 16, H - 70, 14, 0, TAU); ink(x, '#9ad4f4', 2.2); x.strokeStyle = OUT; x.lineWidth = 1.4; x.beginPath(); x.moveTo(px + 2, H - 70); x.lineTo(px + 30, H - 70); x.moveTo(px + 16, H - 84); x.lineTo(px + 16, H - 56); x.stroke(); x.fillStyle = '#ff8ab0'; for (let i = 0; i < 4; i++) circ(x, px + 4 + i * 8, H - 52, 3.4); }
    x.font = 'italic 900 15px sans-serif'; x.textAlign = 'center'; x.beginPath(); U.rr(x, W / 2 - 48, H - 128, 96, 22, 4); ink(x, '#fff4d8', 2.2); x.fillStyle = OUT; x.fillText('УСАДЬБА', W / 2, H - 112);
    return c;
  }
  const spr = fn => { const [c, x] = cv(T, T * 1.5, 1.5); x.translate(0, T * 0.5); fn(x); return c; };
  const SHAD = x => { x.fillStyle = 'rgba(30,20,30,.25)'; ell(x, 24, 44, 18, 4.4); };
  const PROPS = {
    palm: x => { SHAD(x); x.strokeStyle = OUT; x.lineWidth = 7; x.lineCap = 'round'; x.beginPath(); x.moveTo(24, 44); x.quadraticCurveTo(28, 14, 23, -6); x.stroke(); x.strokeStyle = '#a8784a'; x.lineWidth = 4.4; x.stroke(); for (let i = 0; i < 6; i++) { const a = -2.9 + i * 0.6; x.save(); x.translate(23, -6); x.rotate(a); x.beginPath(); x.ellipse(10, 0, 11, 3.6, 0, 0, TAU); ink(x, i % 2 ? '#4cb03a' : '#5cc04a', 1.6); x.restore(); } x.fillStyle = '#8a5a2a'; circ(x, 21, -2, 2.6); circ(x, 26, -2, 2.6); },
    shell: x => { x.beginPath(); x.moveTo(10, 42); x.quadraticCurveTo(24, 8, 38, 42); x.closePath(); ink(x, '#ffc8d0', 2); x.strokeStyle = '#e88a9a'; x.lineWidth = 1.2; for (let i = 0; i < 5; i++) { x.beginPath(); x.moveTo(24, 40); x.lineTo(13 + i * 5.5, 24 + Math.abs(i - 2) * 4); x.stroke(); } },
    reed: x => { x.lineCap = 'round'; for (let i = 0; i < 6; i++) { const px = 8 + i * 6, h = 30 + (i * 7) % 16; x.strokeStyle = OUT; x.lineWidth = 3.6; x.beginPath(); x.moveTo(px, 44); x.lineTo(px + (i % 2 ? 3 : -3), 44 - h); x.stroke(); x.strokeStyle = '#6a9a3a'; x.lineWidth = 2; x.stroke(); if (i % 2) { x.beginPath(); x.ellipse(px + 3, 44 - h + 4, 2.6, 6, 0, 0, TAU); ink(x, '#8a5a32', 1.4); } } },
    torch: x => { x.beginPath(); U.rr(x, 20, 4, 8, 40, 2); ink(x, '#6a4a3a', 2); x.beginPath(); x.moveTo(24, -16); x.quadraticCurveTo(34, -2, 24, 6); x.quadraticCurveTo(14, -2, 24, -16); ink(x, '#ffb03a', 1.8); x.fillStyle = '#fff2a0'; ell(x, 24, 0, 3, 5); },
    crystal: x => { SHAD(x); for (const [px, h, c] of [[16, 34, '#a88aff'], [28, 44, '#c8b0ff'], [36, 26, '#8a6ae8']]) { P(x, [px - 6, 44, px - 6, 44 - h * 0.7, px, 44 - h, px + 6, 44 - h * 0.7, px + 6, 44]); ink(x, c, 2); x.fillStyle = 'rgba(255,255,255,.5)'; x.fillRect(px - 3, 44 - h * 0.7, 2, h * 0.5); } },
    chest: x => { SHAD(x); x.beginPath(); U.rr(x, 8, 18, 32, 24, 3); ink(x, '#b8783a', 2.2); x.beginPath(); x.moveTo(8, 22); x.quadraticCurveTo(24, 6, 40, 22); x.closePath(); ink(x, '#c8884a', 2.2); x.fillStyle = '#ffd04a'; x.fillRect(21, 20, 6, 8); },
    // мебель усадьбы
    bed: x => { SHAD(x); x.beginPath(); U.rr(x, 4, 4, 40, 40, 4); ink(x, '#a86a3a', 2.4); x.beginPath(); U.rr(x, 7, 14, 34, 28, 3); ink(x, '#ff9ac8', 2); x.beginPath(); U.rr(x, 10, 6, 28, 9, 4); ink(x, '#ffffff', 1.8); A.heart(x, 24, 28, 5, '#ff4f7b'); },
    fireplace: x => { SHAD(x); x.beginPath(); U.rr(x, 4, -6, 40, 50, 3); ink(x, '#c8786a', 2.4); x.fillStyle = 'rgba(80,30,20,.25)'; for (let j = 0; j < 5; j++) x.fillRect(4, -2 + j * 10, 40, 1.2); x.beginPath(); U.rr(x, 12, 16, 24, 28, 10); ink(x, '#2a1a1a', 2); x.fillStyle = '#ff8a2a'; P(x, [16, 42, 20, 26, 24, 36, 28, 22, 32, 42]); x.fill(); x.fillStyle = '#ffe04a'; P(x, [20, 42, 24, 32, 28, 42]); x.fill(); },
    aquarium: x => { SHAD(x); x.beginPath(); U.rr(x, 6, 30, 36, 14, 2); ink(x, '#8a5a32', 2); x.beginPath(); U.rr(x, 6, 2, 36, 28, 3); ink(x, 'rgba(120,210,255,.85)', 2.2); x.fillStyle = '#ff8a3a'; ell(x, 18, 14, 5, 3); P(x, [22, 14, 27, 10, 27, 18]); x.fill(); x.fillStyle = '#ffd04a'; ell(x, 30, 22, 4, 2.4); x.fillStyle = '#4cb03a'; for (let i = 0; i < 3; i++) ell(x, 12 + i * 4, 26, 1.4, 4); },
    mirror: x => { SHAD(x); x.beginPath(); U.rr(x, 20, 34, 8, 10, 2); ink(x, '#c8a040', 2); x.beginPath(); x.ellipse(24, 12, 14, 22, 0, 0, TAU); ink(x, '#ffd04a', 2.4); x.beginPath(); x.ellipse(24, 12, 10, 18, 0, 0, TAU); ink(x, '#d8f0ff', 1.6); x.fillStyle = 'rgba(255,255,255,.7)'; ell(x, 19, 6, 2.4, 8, 0.3); },
    plant: x => { SHAD(x); x.beginPath(); x.moveTo(14, 26); x.lineTo(34, 26); x.lineTo(31, 44); x.lineTo(17, 44); x.closePath(); ink(x, '#d8784a', 2.2); for (let i = 0; i < 7; i++) { x.save(); x.translate(24, 26); x.rotate(-1.6 + i * 0.5); x.beginPath(); x.ellipse(0, -12, 5, 13, 0, 0, TAU); ink(x, i % 2 ? '#4cb03a' : '#6cd04a', 1.6); x.restore(); } x.fillStyle = '#ff6a9a'; circ(x, 24, 4, 3.4); },
    bookshelf: x => { SHAD(x); x.beginPath(); U.rr(x, 4, -10, 40, 54, 2); ink(x, '#8a5a32', 2.4); const cs = ['#d84a4a', '#3a8ad8', '#ffd04a', '#4cb03a', '#8a5ad8', '#ff8ab0']; for (let j = 0; j < 3; j++) { x.fillStyle = '#5a3a1a'; x.fillRect(6, 6 + j * 14, 36, 2); for (let i = 0; i < 6; i++) { x.fillStyle = cs[(i + j * 2) % 6]; x.fillRect(8 + i * 5.6, -6 + j * 14, 4.4, 12); } } },
    piano: x => { SHAD(x); x.beginPath(); U.rr(x, 2, 6, 44, 38, 3); ink(x, '#2a1a2a', 2.4); x.fillStyle = '#ffffff'; x.fillRect(5, 24, 38, 8); x.fillStyle = OUT; for (let i = 0; i < 9; i++) x.fillRect(7 + i * 4, 24, 2, 5); x.fillStyle = '#ffd04a'; x.fillRect(10, 12, 28, 2); },
    haystack: x => { SHAD(x); x.beginPath(); x.moveTo(4, 44); x.quadraticCurveTo(2, 8, 24, 0); x.quadraticCurveTo(46, 8, 44, 44); x.closePath(); ink(x, '#f0c85a', 2.4); x.strokeStyle = '#c89a30'; x.lineWidth = 1.4; for (let i = 0; i < 7; i++) { x.beginPath(); x.moveTo(9 + i * 5, 42); x.lineTo(13 + i * 3.4, 10 + (i % 3) * 5); x.stroke(); } x.fillStyle = '#ffe08a'; ell(x, 18, 14, 6, 3, -0.5); },
    scarecrow: x => { SHAD(x); x.beginPath(); U.rr(x, 22, 0, 4, 44, 1); ink(x, '#8a5a32', 1.8); x.beginPath(); U.rr(x, 6, 8, 36, 4, 1); ink(x, '#8a5a32', 1.8); x.beginPath(); x.moveTo(10, 8); x.lineTo(38, 8); x.lineTo(34, 28); x.lineTo(14, 28); x.closePath(); ink(x, '#c85a4a', 2); x.fillStyle = '#ffd04a'; circ(x, 20, 16, 1.6); circ(x, 28, 20, 1.6); x.beginPath(); x.arc(24, -4, 8, 0, TAU); ink(x, '#f0d8a0', 2); x.fillStyle = OUT; circ(x, 21, -5, 1.3); circ(x, 27, -5, 1.3); x.strokeStyle = OUT; x.lineWidth = 1.2; x.beginPath(); x.moveTo(20, -1); x.lineTo(28, -1); x.stroke(); x.beginPath(); x.moveTo(12, -8); x.lineTo(24, -18); x.lineTo(36, -8); x.closePath(); ink(x, '#a8783a', 2); },
    bench: x => { SHAD(x); for (const px of [8, 36]) { x.beginPath(); U.rr(x, px, 30, 4, 14, 1); ink(x, '#6a4a2a', 1.8); } x.beginPath(); U.rr(x, 2, 26, 44, 7, 2); ink(x, '#b8844a', 2.2); x.beginPath(); U.rr(x, 4, 12, 40, 6, 2); ink(x, '#b8844a', 2); x.beginPath(); U.rr(x, 4, 19, 40, 5, 2); ink(x, '#a8743a', 2); },
    stall: x => { SHAD(x); x.beginPath(); U.rr(x, 4, 22, 40, 22, 2); ink(x, '#b8844a', 2.2); for (const px of [5, 40]) { x.beginPath(); U.rr(x, px, -6, 3, 30, 1); ink(x, '#8a5a32', 1.6); } x.beginPath(); x.moveTo(0, -4); x.lineTo(48, -4); x.lineTo(44, -16); x.lineTo(4, -16); x.closePath(); ink(x, '#ff6a8a', 2.2); x.fillStyle = '#fff'; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(6 + i * 11, -16); x.lineTo(11 + i * 11, -16); x.lineTo(12 + i * 11, -4); x.lineTo(5 + i * 11, -4); x.fill(); } x.fillStyle = '#e83a3a'; circ(x, 12, 20, 4); x.fillStyle = '#ffd04a'; circ(x, 22, 20, 4); x.fillStyle = '#5cc04a'; circ(x, 32, 20, 4); x.fillStyle = '#e8a85a'; ell(x, 38, 21, 4, 2.6); },
    woodpile: x => { SHAD(x); for (const [px, py] of [[12, 36], [24, 36], [36, 36], [18, 26], [30, 26], [24, 16]]) { x.beginPath(); x.arc(px, py, 6.4, 0, TAU); ink(x, '#c89a5a', 2); x.strokeStyle = '#8a5a32'; x.lineWidth = 1; x.beginPath(); x.arc(px, py, 3.4, 0, TAU); x.stroke(); x.beginPath(); x.arc(px, py, 1.2, 0, TAU); x.stroke(); } },
    laundry: x => { for (const px of [4, 42]) { x.beginPath(); U.rr(x, px, -10, 3, 54, 1); ink(x, '#8a5a32', 1.6); } x.strokeStyle = OUT; x.lineWidth = 1.2; x.beginPath(); x.moveTo(5, -6); x.quadraticCurveTo(24, 0, 43, -6); x.stroke(); x.beginPath(); U.rr(x, 9, -3, 9, 14, 1); ink(x, '#fff', 1.6); x.beginPath(); x.moveTo(21, -1); x.lineTo(30, -1); x.lineTo(32, 12); x.lineTo(19, 12); x.closePath(); ink(x, '#ff8ab0', 1.6); x.beginPath(); U.rr(x, 33, -3, 7, 10, 1); ink(x, '#8ad0ff', 1.6); },
    stump: x => { SHAD(x); x.beginPath(); x.moveTo(8, 44); x.lineTo(10, 24); x.lineTo(38, 24); x.lineTo(40, 44); x.closePath(); ink(x, '#8a5a32', 2.2); x.beginPath(); x.ellipse(24, 24, 14, 6, 0, 0, TAU); ink(x, '#d8a86a', 2); x.strokeStyle = '#a8743a'; x.lineWidth = 1; x.beginPath(); x.ellipse(24, 24, 9, 3.6, 0, 0, TAU); x.stroke(); x.beginPath(); x.ellipse(24, 24, 4, 1.6, 0, 0, TAU); x.stroke(); x.fillStyle = '#5cc04a'; ell(x, 12, 42, 5, 2.4); },
    bigshroom: x => { SHAD(x); x.beginPath(); x.moveTo(18, 44); x.quadraticCurveTo(16, 20, 20, 10); x.lineTo(28, 10); x.quadraticCurveTo(32, 20, 30, 44); x.closePath(); ink(x, '#f4ecdc', 2.2); x.beginPath(); x.moveTo(2, 12); x.quadraticCurveTo(24, -28, 46, 12); x.quadraticCurveTo(24, 20, 2, 12); x.closePath(); ink(x, '#e8483a', 2.4); x.fillStyle = '#fff'; circ(x, 14, 4, 3.4); circ(x, 28, -4, 4); circ(x, 36, 6, 2.6); circ(x, 22, 9, 2); },
    stone: x => { SHAD(x); x.beginPath(); x.moveTo(12, 44); x.lineTo(10, 6); x.quadraticCurveTo(24, -14, 38, 6); x.lineTo(36, 44); x.closePath(); ink(x, '#9a968e', 2.4); x.fillStyle = '#b8b4aa'; x.fillRect(14, 2, 6, 38); x.strokeStyle = '#6ac8a0'; x.lineWidth = 1.6; x.beginPath(); x.arc(24, 14, 6, 0, TAU); x.moveTo(24, 22); x.lineTo(24, 34); x.moveTo(19, 28); x.lineTo(29, 28); x.stroke(); x.fillStyle = '#5a9a44'; ell(x, 14, 42, 6, 2.6); ell(x, 34, 43, 5, 2.2); },
    snowman: x => { SHAD(x); x.beginPath(); x.arc(24, 32, 13, 0, TAU); ink(x, '#fff', 2.2); x.beginPath(); x.arc(24, 12, 9.4, 0, TAU); ink(x, '#fff', 2.2); x.beginPath(); x.arc(24, -3, 6.8, 0, TAU); ink(x, '#fff', 2.2); x.fillStyle = OUT; circ(x, 21.6, -4.6, 1.2); circ(x, 26.4, -4.6, 1.2); circ(x, 24, 10, 1.3); circ(x, 24, 16, 1.3); x.fillStyle = '#ff8a2a'; P(x, [24, -2.6, 32, -1, 24, 0.2]); x.fill(); x.beginPath(); U.rr(x, 17, 3, 14, 4, 2); ink(x, '#e83a5a', 1.6); x.strokeStyle = '#6a4a2a'; x.lineWidth = 2; x.beginPath(); x.moveTo(15, 12); x.lineTo(4, 4); x.moveTo(33, 12); x.lineTo(44, 4); x.stroke(); },
    boat: x => { SHAD(x); x.beginPath(); x.moveTo(0, 26); x.lineTo(48, 26); x.quadraticCurveTo(44, 44, 34, 44); x.lineTo(12, 44); x.quadraticCurveTo(4, 44, 0, 26); x.closePath(); ink(x, '#c8783a', 2.4); x.fillStyle = '#fff4d8'; x.fillRect(3, 28, 42, 4); x.beginPath(); U.rr(x, 22, -14, 3, 40, 1); ink(x, '#8a5a32', 1.6); x.beginPath(); x.moveTo(26, -12); x.lineTo(44, 18); x.lineTo(26, 18); x.closePath(); ink(x, '#fff', 2); x.fillStyle = '#ff6a8a'; x.fillRect(26, 6, 12, 3); },
    umbrella: x => { SHAD(x); x.beginPath(); U.rr(x, 22.5, -8, 3, 52, 1); ink(x, '#f4ecdc', 1.6); x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(24, -34, 48, 0); x.quadraticCurveTo(24, -8, 0, 0); x.closePath(); ink(x, '#ff6a8a', 2.4); x.fillStyle = '#fff'; x.beginPath(); x.moveTo(16, -5); x.quadraticCurveTo(24, -26, 32, -5); x.quadraticCurveTo(24, -8, 16, -5); x.fill(); x.beginPath(); U.rr(x, 4, 36, 30, 6, 2); ink(x, '#8ad0ff', 1.8); },
    bones: x => { SHAD(x); x.beginPath(); x.arc(24, 30, 9, 0, TAU); ink(x, '#f0ece0', 2.2); x.fillStyle = OUT; circ(x, 20.6, 29, 2.2); circ(x, 27.4, 29, 2.2); x.fillRect(22, 35, 1.2, 3); x.fillRect(24.6, 35, 1.2, 3); for (const [a, b2, c2, d] of [[6, 42, 20, 38], [30, 40, 44, 44]]) { x.strokeStyle = OUT; x.lineWidth = 5; x.lineCap = 'round'; x.beginPath(); x.moveTo(a, b2); x.lineTo(c2, d); x.stroke(); x.strokeStyle = '#f0ece0'; x.lineWidth = 2.6; x.stroke(); } },
    statue: x => { SHAD(x); x.beginPath(); U.rr(x, 8, 34, 32, 10, 2); ink(x, '#7a7488', 2.2); x.beginPath(); x.moveTo(16, 34); x.lineTo(18, 6); x.lineTo(30, 6); x.lineTo(32, 34); x.closePath(); ink(x, '#9a94a8', 2.2); x.beginPath(); x.arc(24, -2, 8, 0, TAU); ink(x, '#9a94a8', 2.2); for (const s2 of [-1, 1]) { x.beginPath(); x.moveTo(24 + s2 * 5, -8); x.lineTo(24 + s2 * 10, -18); x.lineTo(24 + s2 * 7, -6); x.closePath(); ink(x, '#9a94a8', 1.6); } x.fillStyle = '#b07aff'; circ(x, 21, -3, 1.4); circ(x, 27, -3, 1.4); A.heart(x, 24, 20, 4, '#b07aff'); },
    bath: x => { SHAD(x); x.beginPath(); x.ellipse(24, 30, 22, 13, 0, 0, TAU); ink(x, '#b8784a', 2.4); x.beginPath(); x.ellipse(24, 27, 18, 9.4, 0, 0, TAU); ink(x, '#7ad0f4', 2); x.fillStyle = 'rgba(255,255,255,.8)'; for (const [px, py, r] of [[16, 25, 3.4], [24, 23, 4], [31, 27, 3], [21, 30, 2.6]]) circ(x, px, py, r); x.fillStyle = 'rgba(255,255,255,.5)'; for (let i = 0; i < 3; i++) ell(x, 14 + i * 10, 8 - i * 3, 5, 3); },
    rug: x => { x.beginPath(); x.ellipse(24, 34, 26, 12, 0, 0, TAU); ink(x, '#ff8ab0', 2); x.beginPath(); x.ellipse(24, 34, 18, 7.4, 0, 0, TAU); ink(x, '#ffd0e0', 1.4); A.heart(x, 24, 34, 4, '#ff4f7b'); }
  };
  D.FURN = {
    bed: { n: 'Большая кровать', price: 300, love: ['fox', 'neko', 'dryad'], d: 'Огромная и мягкая. Почему-то все хотят спать именно на ней.' },
    rug: { n: 'Ковёр-сердечко', price: 120, love: ['slime', 'minotaur'], d: 'Пушистый. Желешка утверждает, что он вкусный.' },
    fireplace: { n: 'Камин', price: 380, love: ['fox', 'lamia', 'neko'], d: 'Тепло и уютно. Пломбирка держится подальше.' },
    aquarium: { n: 'Аквариум', price: 260, love: ['neko', 'mermaid', 'slime'], d: 'Рыбки! Искра смотрит на них не отрываясь.' },
    mirror: { n: 'Зеркало в золотой раме', price: 240, love: ['vampire', 'harpy', 'lamia'], d: 'Графиня в нём не отражается, но очень довольна.' },
    plant: { n: 'Цветок в горшке', price: 90, love: ['dryad', 'frog'], d: 'Листвяна разговаривает с ним по утрам.' },
    bookshelf: { n: 'Книжный шкаф', price: 280, love: ['valkyrie', 'ghost', 'witch'], d: 'Уставы, стихи и одна подозрительная книга рецептов.' },
    bath: { n: 'Купальня', price: 520, love: ['slime', 'mermaid', 'frog'], d: 'Большая бадья с горячей водой и пеной. Говорят, девицы любят тут… поболтать. Подойди и загляни.' },
    piano: { n: 'Пианино', price: 420, love: ['harpy', 'snow', 'vampire'], d: 'Чирика поёт, Клыкс играет. Соседи плачут.' }
  };
  D.FURN_SPOT = { bed: [2, 2], fireplace: [6, 1], bookshelf: [9, 1], piano: [11, 2], aquarium: [2, 7], mirror: [11, 6], plant: [7, 8], rug: [6, 5], bath: [12, 6] };

  /* ---------- Иконки подарков и мебели ---------- */
  const icon = fn => { const [c, x] = cv(64, 64, 1.5); fn(x); return c.toDataURL(); };
  const ICONS = {
    fish: x => { x.beginPath(); x.ellipse(28, 32, 18, 10, 0, 0, TAU); ink(x, '#7ac0e8', 2.4); P(x, [44, 32, 58, 20, 58, 44]); ink(x, '#5aa0d0', 2.2); x.fillStyle = OUT; circ(x, 18, 29, 2.4); },
    shiny: x => { P(x, [32, 8, 50, 26, 32, 56, 14, 26]); ink(x, '#9ae8ff', 2.4); x.fillStyle = 'rgba(255,255,255,.8)'; P(x, [32, 12, 40, 26, 32, 26]); x.fill(); x.strokeStyle = '#5ab0d8'; x.lineWidth = 1.4; x.beginPath(); x.moveTo(14, 26); x.lineTo(50, 26); x.stroke(); },
    tomato: x => { x.beginPath(); U.rr(x, 20, 14, 24, 40, 6); ink(x, '#e83a3a', 2.4); x.beginPath(); U.rr(x, 24, 6, 16, 10, 2); ink(x, '#fff4d8', 2); x.fillStyle = 'rgba(255,255,255,.5)'; x.fillRect(24, 20, 4, 26); },
    icecream: x => { P(x, [20, 30, 44, 30, 32, 58]); ink(x, '#e8b05a', 2.2); x.beginPath(); x.arc(32, 26, 13, 0, TAU); ink(x, '#fff4f8', 2.4); x.fillStyle = '#ff8ab0'; circ(x, 28, 18, 3); circ(x, 37, 22, 2.4); },
    honey: x => { x.beginPath(); U.rr(x, 14, 18, 36, 36, 10); ink(x, '#ffb82a', 2.4); x.beginPath(); U.rr(x, 18, 10, 28, 10, 3); ink(x, '#c86a3a', 2); x.fillStyle = OUT; x.font = '900 12px sans-serif'; x.textAlign = 'center'; x.fillText('МЁД', 32, 42); },
    book: x => { x.beginPath(); U.rr(x, 12, 10, 40, 44, 3); ink(x, '#3a62c4', 2.4); x.fillStyle = '#fff4d8'; x.fillRect(46, 12, 4, 40); A.heart(x, 30, 32, 7, '#ffd04a'); },
    flower: x => { x.strokeStyle = '#3e8a30'; x.lineWidth = 3; x.beginPath(); x.moveTo(32, 30); x.lineTo(32, 58); x.stroke(); x.fillStyle = '#ff6a9a'; for (let i = 0; i < 6; i++) circ(x, 32 + cos(i * 1.05) * 9, 22 + sin(i * 1.05) * 9, 7); x.fillStyle = '#ffd04a'; circ(x, 32, 22, 5); },
    perfume: x => { x.beginPath(); x.arc(32, 40, 15, 0, TAU); ink(x, '#d88aff', 2.4); x.beginPath(); U.rr(x, 27, 12, 10, 14, 2); ink(x, '#c86ae8', 2); x.beginPath(); x.arc(32, 9, 5, 0, TAU); ink(x, '#ffd04a', 1.8); x.fillStyle = 'rgba(255,255,255,.6)'; ell(x, 26, 36, 3, 6, 0.4); },
    dress: x => { P(x, [24, 10, 40, 10, 44, 26, 52, 56, 12, 56, 20, 26]); ink(x, '#ff8ab0', 2.4); x.fillStyle = '#ffd04a'; x.fillRect(20, 26, 24, 4); }
  };
  const base = A.init;
  A.init = function () {
    base();
    A.objs.house.manor = manor();
    { // башня ведьмы
      const Wd = 4 * T, H = 4 * T, [c, x] = cv(Wd, H, 1.5); x.fillStyle = 'rgba(30,20,30,.25)'; x.fillRect(30, H - 10, Wd - 56, 10);
      x.beginPath(); U.rr(x, 44, 46, Wd - 88, H - 54, 4); ink(x, U.lg(x, 44, 0, Wd - 44, 0, ['#8a5ab8', '#c08ae8', '#7a4aa8']), 2.6);
      x.fillStyle = 'rgba(40,10,60,.25)'; for (let y = 62; y < H - 14; y += 16) for (let i = 0; i < 4; i++) x.fillRect(50 + i * 26 + (y % 32 ? 12 : 0), y, 14, 5);
      x.beginPath(); x.moveTo(30, 52); x.lineTo(Wd / 2, -4); x.lineTo(Wd - 30, 52); x.closePath(); ink(x, U.lg(x, 0, 0, 0, 52, ['#ff8ac8', '#d83a9a']), 2.8);
      x.beginPath(); x.arc(Wd / 2, 84, 13, 0, TAU); ink(x, '#ffe88a', 2.2); A.heart(x, Wd / 2, 84, 6, '#ff4f7b');
      x.beginPath(); U.rr(x, Wd / 2 - 16, H - 52, 32, 46, 14); ink(x, '#4a2a5a', 2.4); x.fillStyle = '#ffd04a'; circ(x, Wd / 2 + 9, H - 28, 2.2);
      A.objs.house.tower = c; }
    { // вход в пещеру
      const Wd = 4 * T, H = 4 * T, [c, x] = cv(Wd, H, 1.5); x.fillStyle = 'rgba(30,20,30,.25)'; ell(x, Wd / 2, H - 6, Wd / 2 - 8, 8);
      x.beginPath(); x.moveTo(6, H - 6); x.quadraticCurveTo(10, 60, 50, 40); x.quadraticCurveTo(96, 10, 140, 44); x.quadraticCurveTo(186, 64, 186, H - 6); x.closePath(); ink(x, U.lg(x, 0, 30, 0, H, ['#8a8498', '#5a5468']), 2.8);
      x.fillStyle = '#9a94a8'; ell(x, 60, 70, 22, 10, -0.4); ell(x, 136, 74, 18, 8, 0.3);
      x.beginPath(); x.moveTo(Wd / 2 - 26, H - 6); x.quadraticCurveTo(Wd / 2 - 28, H - 70, Wd / 2, H - 74); x.quadraticCurveTo(Wd / 2 + 28, H - 70, Wd / 2 + 26, H - 6); x.closePath(); ink(x, '#140c1c', 2.6);
      x.fillStyle = '#b07aff'; for (const [px, py] of [[Wd / 2 - 10, H - 40], [Wd / 2 + 8, H - 30], [Wd / 2 - 2, H - 54]]) circ(x, px, py, 1.6);
      A.objs.house.cave = c; }
    for (const k in PROPS) A.objs.prop[k] = spr(PROPS[k]);
    const palmTree = (seed) => { const [c, x] = cv(72, 96, 1.5), r = U.rng(seed), lean = (r() - 0.5) * 16; x.fillStyle = 'rgba(30,20,30,.25)'; ell(x, 36, 90, 20, 5); x.strokeStyle = OUT; x.lineWidth = 9; x.lineCap = 'round'; x.beginPath(); x.moveTo(36, 90); x.quadraticCurveTo(36 + lean, 60, 36 + lean * 0.6, 30); x.stroke(); x.strokeStyle = '#a8784a'; x.lineWidth = 6; x.stroke(); x.strokeStyle = '#8a5a32'; x.lineWidth = 1.4; for (let y = 40; y < 88; y += 8) { const px = 36 + lean * (1 - (y - 30) / 60) * 0.8; x.beginPath(); x.moveTo(px - 3, y); x.lineTo(px + 3, y + 2); x.stroke(); }
      const cx = 36 + lean * 0.6, cy = 30; for (let i = 0; i < 7; i++) { const a = -3.05 + i * 0.52; x.save(); x.translate(cx, cy); x.rotate(a); x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(14, -8, 30, 2); x.quadraticCurveTo(14, 5, 0, 0); ink(x, i % 2 ? '#4cb03a' : '#62c84e', 1.8); x.restore(); } x.fillStyle = '#8a5a2a'; circ(x, cx - 3, cy + 4, 3.4); circ(x, cx + 3, cy + 4, 3.4); return c; };
    A.objs.palm = [palmTree(3), palmTree(8)]; A.objs.crystal = [A.objs.prop.crystal];
    for (const k in ICONS) A.ICON[k] = icon(ICONS[k]);
    for (const k in D.FURN) A.ICON['f_' + k] = A.objs.prop[k].toDataURL();
    A.thumb = A.thumb || {};
    for (const id in D.GIRLS) if (!A.thumb[id]) { const [c, x] = cv(96, 96, 1.5); x.translate(48, 226); x.scale(1, 1); A.girl(x, id, { t: 0.4 }); A.thumb[id] = c.toDataURL(); }
  };

  /* ---------- Фоны сцен-свиданий ---------- */
  const SKY = { day: ['#7ac8ff', '#dff4ff'], sunset: ['#5a3a8a', '#ff9a6a', '#ffd88a'], night: ['#0e0a2a', '#2a2060', '#4a3a7a'], dawn: ['#6a7ad8', '#ffb0a8', '#ffe8b0'], storm: ['#2a2e44', '#5a607a'], indoor: null };
  function sky(x, w, h, k) { const g = x.createLinearGradient(0, 0, 0, h * 0.7), c = SKY[k]; c.forEach((col, i) => g.addColorStop(i / (c.length - 1), col)); x.fillStyle = g; x.fillRect(0, 0, w, h); }
  function stars(x, w, h, t) { const r = U.rng(5); x.fillStyle = '#fff'; for (let i = 0; i < 70; i++) { x.globalAlpha = 0.4 + 0.6 * Math.abs(sin(t * 1.5 + i)); circ(x, r() * w, r() * h * 0.55, r() * 1.6 + 0.4); } x.globalAlpha = 1; }
  function hills(x, w, h, y, col, seed, amp) { const r = U.rng(seed); x.fillStyle = col; x.beginPath(); x.moveTo(0, h); x.lineTo(0, y); for (let i = 0; i <= 8; i++) x.quadraticCurveTo(w * (i - 0.5) / 8, y - r() * amp, w * i / 8, y - r() * amp * 0.4); x.lineTo(w, h); x.closePath(); x.fill(); x.strokeStyle = OUT; x.lineWidth = 3; x.stroke(); }
  function glows(x, w, h, t, n, col, rise) { const r = U.rng(9); x.globalCompositeOperation = 'lighter'; for (let i = 0; i < n; i++) { const px = (r() * w + sin(t * 0.5 + i) * 30) % w, py = rise ? (h - ((t * 20 * (0.5 + r()) + r() * h) % h)) : r() * h * 0.9 + sin(t + i) * 12; x.globalAlpha = 0.4 + 0.5 * Math.abs(sin(t * 2 + i)); x.drawImage(A.glow, px - 10, py - 10, 20, 20); x.fillStyle = col; x.fillRect(px - 1.5, py - 1.5, 3, 3); } x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; }
  function room(x, w, h, wall, floor) { x.fillStyle = wall; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(255,255,255,.08)'; for (let px = 0; px < w; px += 40) x.fillRect(px, 0, 18, h * 0.66); x.fillStyle = floor; x.fillRect(0, h * 0.66, w, h); x.fillStyle = 'rgba(0,0,0,.12)'; for (let px = 0; px < w; px += 60) x.fillRect(px, h * 0.66, 2, h); x.fillStyle = OUT; x.fillRect(0, h * 0.66 - 3, w, 4); }
  A.vnBg = function (x, key, w, h, t) {
    x.save();
    switch (key) {
      case 'roof': sky(x, w, h, 'night'); stars(x, w, h, t); x.fillStyle = '#fff6d0'; circ(x, w * 0.8, h * 0.2, h * 0.08);
        for (let i = 0; i < 7; i++) { const px = i * w / 6 - 40, ph = h * (0.55 + (i % 3) * 0.05); x.fillStyle = '#2a2040'; P(x, [px, h, px, ph, px + 50, ph - 50, px + 100, ph, px + 100, h]); x.fill(); x.fillStyle = (sin(t + i) > 0.3) ? '#ffd88a' : '#ffc060'; x.fillRect(px + 38, ph + 14, 20, 16); }
        x.fillStyle = '#6a3a3a'; P(x, [0, h * 0.78, w, h * 0.7, w, h, 0, h]); x.fill(); x.strokeStyle = OUT; x.lineWidth = 3; x.stroke(); break;
      case 'night': sky(x, w, h, 'night'); stars(x, w, h, t); hills(x, w, h, h * 0.62, '#1e3a2a', 3, h * 0.12); glows(x, w, h, t, 24, '#f4ff9a'); break;
      case 'pond': sky(x, w, h, 'day'); hills(x, w, h, h * 0.5, '#7ccc5a', 4, h * 0.1); x.fillStyle = '#4ab0e8'; ell(x, w * 0.5, h * 0.8, w * 0.45, h * 0.16); x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 2; for (let i = 0; i < 6; i++) { const px = w * (0.15 + i * 0.13) + sin(t + i) * 10; x.beginPath(); x.moveTo(px, h * 0.8); x.quadraticCurveTo(px + 10, h * 0.78, px + 20, h * 0.8); x.stroke(); } break;
      case 'sunset': sky(x, w, h, 'sunset'); x.fillStyle = '#ffe08a'; circ(x, w * 0.5, h * 0.55, h * 0.12); hills(x, w, h, h * 0.62, '#5a3a5a', 6, h * 0.08); x.fillStyle = '#3a2a3a'; P(x, [0, h * 0.7, w * 0.35, h * 0.68, w * 0.4, h, 0, h]); x.fill(); break;
      case 'dawn': sky(x, w, h, 'dawn'); x.fillStyle = '#fff2c0'; circ(x, w * 0.3, h * 0.6, h * 0.1); hills(x, w, h, h * 0.62, '#6a7aa8', 7, h * 0.08); hills(x, w, h, h * 0.75, '#4a5a8a', 8, h * 0.06); break;
      case 'storm': sky(x, w, h, 'storm'); if ((t % 3) < 0.12) { x.fillStyle = 'rgba(255,255,255,.7)'; x.fillRect(0, 0, w, h); } hills(x, w, h, h * 0.65, '#2a3a2a', 9, h * 0.08); x.strokeStyle = 'rgba(200,220,255,.5)'; x.lineWidth = 1.4; const r = U.rng(2); for (let i = 0; i < 80; i++) { const px = (r() * w + t * 300) % w, py = (r() * h + t * 700) % h; x.beginPath(); x.moveTo(px, py); x.lineTo(px - 4, py + 14); x.stroke(); } break;
      case 'snow': sky(x, w, h, 'day'); x.fillStyle = 'rgba(255,255,255,.4)'; x.fillRect(0, 0, w, h); hills(x, w, h, h * 0.58, '#eef4ff', 10, h * 0.14); { const r = U.rng(3); x.fillStyle = '#fff'; for (let i = 0; i < 60; i++) circ(x, (r() * w + sin(t + i) * 20) % w, (r() * h + t * 30 * (0.5 + r())) % h, 1 + r() * 2.4); } break;
      case 'glade': sky(x, w, h, 'day'); hills(x, w, h, h * 0.5, '#3a8a34', 11, h * 0.15); hills(x, w, h, h * 0.68, '#7ccc5a', 12, h * 0.05); { const r = U.rng(4); for (let i = 0; i < 30; i++) { x.fillStyle = ['#ff6a9a', '#ffe04a', '#ffffff', '#b07aff'][i % 4]; circ(x, r() * w, h * 0.7 + r() * h * 0.3, 3.4); } } glows(x, w, h, t, 12, '#fff4a0', true); break;
      case 'nest': sky(x, w, h, 'sunset'); x.fillStyle = 'rgba(255,255,255,.8)'; for (let i = 0; i < 5; i++) ell(x, ((i * 230 + t * 12) % (w + 200)) - 100, h * (0.2 + (i % 3) * 0.1), 60, 18); x.fillStyle = '#8a5a32'; ell(x, w * 0.5, h * 0.92, w * 0.4, h * 0.12); x.strokeStyle = '#5a3a1a'; x.lineWidth = 3; for (let i = 0; i < 20; i++) { x.beginPath(); x.moveTo(w * (0.12 + i * 0.04), h * 0.88); x.lineTo(w * (0.16 + i * 0.04), h * 0.98); x.stroke(); } break;
      case 'tavern': room(x, w, h, '#8a5a3a', '#6a4028'); for (let i = 0; i < 4; i++) { const px = w * (0.15 + i * 0.24); x.globalCompositeOperation = 'lighter'; x.globalAlpha = 0.35 + 0.05 * sin(t * 3 + i); x.drawImage(A.glow, px - 60, h * 0.1 - 40, 120, 120); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.fillStyle = '#ffd88a'; circ(x, px, h * 0.12, 6); } break;
      case 'bedroom': room(x, w, h, '#c87aa8', '#a86a5a'); x.fillStyle = '#1a1440'; x.fillRect(w * 0.62, h * 0.12, w * 0.24, h * 0.32); x.save(); x.beginPath(); x.rect(w * 0.62, h * 0.12, w * 0.24, h * 0.32); x.clip(); stars(x, w, h * 0.8, t); x.fillStyle = '#fff6d0'; circ(x, w * 0.8, h * 0.2, h * 0.035); x.restore(); x.strokeStyle = OUT; x.lineWidth = 4; x.strokeRect(w * 0.62, h * 0.12, w * 0.24, h * 0.32); x.fillStyle = 'rgba(255,240,200,.15)'; x.fillRect(0, 0, w, h); break;
      case 'beach': sky(x, w, h, 'day'); x.fillStyle = '#3aa8e8'; x.fillRect(0, h * 0.5, w, h * 0.2); x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 2; for (let i = 0; i < 10; i++) { const px = (i * 140 + t * 20) % w; x.beginPath(); x.moveTo(px, h * 0.6); x.lineTo(px + 30, h * 0.6); x.stroke(); } x.fillStyle = '#f2dca0'; P(x, [0, h * 0.68, w, h * 0.64, w, h, 0, h]); x.fill(); x.strokeStyle = OUT; x.lineWidth = 3; x.stroke(); break;
      case 'bath': room(x, w, h, '#b88a5a', '#8a5a3a'); x.fillStyle = '#6ac8ec'; ell(x, w * 0.5, h * 0.95, w * 0.6, h * 0.2); x.strokeStyle = OUT; x.lineWidth = 3; x.beginPath(); x.ellipse(w * 0.5, h * 0.95, w * 0.6, h * 0.2, 0, Math.PI, 0); x.stroke(); x.globalAlpha = 0.5; for (let i = 0; i < 9; i++) { const px = ((i * 0.13 + t * 0.012 * (1 + i % 3)) % 1.2 - 0.1) * w, py = h * (0.25 + (i % 4) * 0.17) + sin(t * 0.7 + i) * 10; x.drawImage(A.glow, px - h * 0.3, py - h * 0.16, h * 0.6, h * 0.32); } x.globalAlpha = 1; break;
      case 'black': x.fillStyle = '#16081c'; x.fillRect(0, 0, w, h); for (let i = 0; i < 12; i++) { const r = U.rng(i + 3), px = r() * w, py = h - ((t * 26 * (0.5 + r()) + r() * h) % (h * 1.1)); x.globalAlpha = 0.5 + 0.4 * sin(t * 2 + i); A.heart(x, px, py, 7 + r() * 8, '#ff4f7b'); } x.globalAlpha = 1; break;
      case 'cave': x.fillStyle = '#1a1424'; x.fillRect(0, 0, w, h); for (let i = 0; i < 6; i++) { x.fillStyle = '#2a2238'; P(x, [i * w / 5 - 30, 0, i * w / 5, h * 0.25 + (i % 2) * 30, i * w / 5 + 30, 0]); x.fill(); } glows(x, w, h, t, 18, '#b0a0ff'); x.fillStyle = '#2a2438'; x.fillRect(0, h * 0.7, w, h); break;
      default: sky(x, w, h, 'day'); hills(x, w, h, h * 0.6, '#7ccc5a', 1, h * 0.1);
    }
    x.restore();
  };
})();
