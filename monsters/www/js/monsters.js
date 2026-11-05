// =====================================================================
//  МОНСТРЫ: описание 15 видов и их рисование кодом (без картинок).
//  Монстр рисуется в своей системе: ступни в (0, 0), рост — 100 единиц вверх (y < 0).
// =====================================================================
const ELEMENTS = {
  stone: { name: 'Камень', col: '#b98d5e', icon: '◆' },
  water: { name: 'Вода', col: '#3aa6ff', icon: '●' },
  wind: { name: 'Ветер', col: '#7fd6f2', icon: '≈' },
  leaf: { name: 'Лист', col: '#4fc24a', icon: '♣' },
  fire: { name: 'Огонь', col: '#ff6a2a', icon: '▲' },
};

// цвет: светлее (k > 0) или темнее (k < 0)
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  if (k >= 0) { r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; } else { r *= 1 + k; g *= 1 + k; b *= 1 + k; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

// ---------- формы тела (путь в системе монстра)
const SHAPES = {
  gum(g, w, h) { // мягкий «мармелад» с плоским низом
    g.moveTo(0, -h); g.bezierCurveTo(w * 0.5, -h, w * 0.56, -h * 0.45, w * 0.5, -h * 0.12);
    g.quadraticCurveTo(w * 0.47, 0, 0, 0); g.quadraticCurveTo(-w * 0.47, 0, -w * 0.5, -h * 0.12);
    g.bezierCurveTo(-w * 0.56, -h * 0.45, -w * 0.5, -h, 0, -h); g.closePath();
  },
  pear(g, w, h) {
    g.moveTo(0, -h); g.bezierCurveTo(w * 0.3, -h, w * 0.34, -h * 0.72, w * 0.42, -h * 0.5);
    g.bezierCurveTo(w * 0.56, -h * 0.25, w * 0.5, 0, 0, 0); g.bezierCurveTo(-w * 0.5, 0, -w * 0.56, -h * 0.25, -w * 0.42, -h * 0.5);
    g.bezierCurveTo(-w * 0.34, -h * 0.72, -w * 0.3, -h, 0, -h); g.closePath();
  },
  drop(g, w, h) {
    g.moveTo(0, -h); g.quadraticCurveTo(w * 0.1, -h * 0.72, w * 0.42, -h * 0.45);
    g.bezierCurveTo(w * 0.62, -h * 0.2, w * 0.42, 0, 0, 0); g.bezierCurveTo(-w * 0.42, 0, -w * 0.62, -h * 0.2, -w * 0.42, -h * 0.45);
    g.quadraticCurveTo(-w * 0.1, -h * 0.72, 0, -h); g.closePath();
  },
  rock(g, w, h) {
    const P = [[-0.5, -0.16], [-0.47, -0.62], [-0.22, -0.96], [0.2, -1], [0.47, -0.68], [0.52, -0.2], [0.36, 0], [-0.36, 0]];
    P.forEach(([x, y], i) => (i ? g.lineTo : g.moveTo).call(g, x * w, y * h)); g.closePath();
  },
  ball(g, w, h) { g.ellipse(0, -h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); },
  box(g, w, h) {
    const r = w * 0.22; g.moveTo(-w / 2 + r, -h); g.lineTo(w / 2 - r, -h); g.quadraticCurveTo(w / 2, -h, w / 2, -h + r);
    g.quadraticCurveTo(w / 2 + 3, -h / 2, w / 2, -r * 0.6); g.quadraticCurveTo(w / 2, 0, w / 2 - r, 0); g.lineTo(-w / 2 + r, 0);
    g.quadraticCurveTo(-w / 2, 0, -w / 2, -r * 0.6); g.quadraticCurveTo(-w / 2 - 3, -h / 2, -w / 2, -h + r); g.quadraticCurveTo(-w / 2, -h, -w / 2 + r, -h); g.closePath();
  },
};

// ---------- общие части
function blobFill(g, col, w, h, top = -h) {
  const gr = g.createLinearGradient(0, top, 0, 0); gr.addColorStop(0, shade(col, 0.28)); gr.addColorStop(0.55, col); gr.addColorStop(1, shade(col, -0.25));
  return gr;
}
// силуэт из нескольких фигур: сначала толстый контур всех, потом заливка всех — получается единый контур
// после заливки — объём: свет сверху слева, тень у земли, светлая кромка изнутри сверху и тёмная снизу
function silhouette(g, figs, col, outline, lw = 3.2) {
  g.lineJoin = 'round'; g.lineCap = 'round';
  const ps = figs.map(f => { const p = new Path2D(); f.path(p); return p; });
  g.strokeStyle = outline; g.lineWidth = lw * 2;
  for (const p of ps) g.stroke(p);
  ps.forEach((p, i) => { g.fillStyle = figs[i].fill || col; g.fill(p); });
  const all = new Path2D(); for (const p of ps) all.addPath(p);
  g.save(); g.clip(all);
  g.fillStyle = LIGHT(g); g.fillRect(-90, -160, 180, 170);
  g.fillStyle = AO(g); g.fillRect(-90, -36, 180, 40);
  // кромка — только у цельного силуэта: у составного обводка прошла бы по внутренним стыкам
  if (ps.length === 1) { g.lineWidth = 8; g.strokeStyle = 'rgba(255,255,255,.2)'; g.translate(3.5, 4.5); g.stroke(all); g.strokeStyle = 'rgba(40,10,50,.16)'; g.translate(-7, -9); g.stroke(all); }
  g.restore();
}
const LIGHT = g => { const r = g.createRadialGradient(-24, -84, 3, -24, -84, 72); r.addColorStop(0, 'rgba(255,255,255,.42)'); r.addColorStop(0.5, 'rgba(255,255,255,.12)'); r.addColorStop(1, 'rgba(255,255,255,0)'); return r; };
const AO = g => { const r = g.createLinearGradient(0, -34, 0, 0); r.addColorStop(0, 'rgba(30,10,40,0)'); r.addColorStop(1, 'rgba(30,10,40,.3)'); return r; };
function eye(g, x, y, r, st, o = {}) {
  const closed = st.blink > 0.85 || (o.happy && st.sing > 0.55);
  if (closed) {
    g.strokeStyle = '#2a1a22'; g.lineWidth = r * 0.28; g.lineCap = 'round'; g.beginPath();
    if (o.happy && st.sing > 0.55) g.arc(x, y + r * 0.25, r * 0.7, Math.PI * 1.15, Math.PI * 1.85); else g.arc(x, y - r * 0.15, r * 0.75, Math.PI * 0.15, Math.PI * 0.85);
    g.stroke(); return;
  }
  g.fillStyle = '#fff'; g.strokeStyle = '#2a1a22'; g.lineWidth = Math.max(1.6, r * 0.16);
  g.beginPath(); g.ellipse(x, y, r, r * (o.tall || 1.08), 0, 0, Math.PI * 2); g.fill(); g.stroke();
  const px = x + st.look * r * 0.32, py = y + r * 0.12 + (st.lookY || 0) * r * 0.18, pr = r * (o.pupil || 0.55) * (1 + (st.wide || 0) * 0.15);
  g.fillStyle = o.iris || '#2a1a22'; g.beginPath(); g.arc(px, py, pr, 0, Math.PI * 2); g.fill();
  if (o.iris) { g.fillStyle = '#1a0e14'; g.beginPath(); g.arc(px, py, pr * 0.55, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#fff'; g.beginPath(); g.arc(px - pr * 0.35, py - pr * 0.4, pr * 0.34, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(px + pr * 0.38, py + pr * 0.35, pr * 0.14, 0, Math.PI * 2); g.fill();
  // веко цвета тела: плавное моргание, а певцы на долгих нотах прикрывают глаза
  const lid = Math.max(o.lid ? Math.max(0, st.sing - 0.35) * 0.8 : 0, st.blink || 0);
  if (lid > 0.04) {
    const ry = r * (o.tall || 1.08), ly = y - ry + ry * 2 * lid;
    g.save(); g.beginPath(); g.ellipse(x, y, r, ry, 0, 0, Math.PI * 2); g.clip();
    g.fillStyle = st.col ? shade(st.col, -0.08) : '#888'; g.fillRect(x - r - 1, y - ry - 1, r * 2 + 2, ly - (y - ry) + 1);
    g.strokeStyle = '#2a1a22'; g.lineWidth = Math.max(1.4, r * 0.13); g.beginPath(); g.moveTo(x - r, ly); g.quadraticCurveTo(x, ly + r * 0.25, x + r, ly); g.stroke();
    g.restore();
    g.strokeStyle = '#2a1a22'; g.lineWidth = Math.max(1.6, r * 0.16); g.beginPath(); g.ellipse(x, y, r, ry, 0, 0, Math.PI * 2); g.stroke();
  }
}
function mouth(g, x, y, w, open, style = 'smile') {
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (open < 0.08) {
    g.strokeStyle = '#2a1a22'; g.lineWidth = 2.6; g.beginPath();
    if (style === 'o') g.arc(x, y, w * 0.14, 0, Math.PI * 2); else g.arc(x, y - w * 0.3, w * 0.42, Math.PI * 0.22, Math.PI * 0.78);
    g.stroke(); return;
  }
  const hh = (style === 'o' ? w * 0.75 : w * 0.62) * Math.min(1, open), ww = style === 'o' ? w * (0.32 + 0.12 * open) : w * 0.5;
  g.fillStyle = '#5a1424'; g.strokeStyle = '#2a1a22'; g.lineWidth = 2.6;
  g.beginPath();
  if (style === 'o') g.ellipse(x, y, ww, hh * 0.6, 0, 0, Math.PI * 2);
  else { g.moveTo(x - ww, y - hh * 0.15); g.quadraticCurveTo(x, y - hh * 0.35, x + ww, y - hh * 0.15); g.quadraticCurveTo(x + ww * 0.9, y + hh, x, y + hh); g.quadraticCurveTo(x - ww * 0.9, y + hh, x - ww, y - hh * 0.15); }
  g.fill(); g.stroke();
  g.save(); g.clip();
  g.fillStyle = '#ff7a8a'; g.beginPath(); g.ellipse(x, y + hh * (style === 'o' ? 0.45 : 0.85), ww * 0.65, hh * 0.38, 0, 0, Math.PI * 2); g.fill();
  if (style === 'teeth') { g.fillStyle = '#fff'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(x + s * ww * 0.55, y - hh * 0.3); g.lineTo(x + s * ww * 0.3, y - hh * 0.3); g.lineTo(x + s * ww * 0.42, y + hh * 0.12); g.closePath(); g.fill(); } }
  g.restore();
}
function cheeks(g, x, y, dx, r) { g.fillStyle = 'rgba(255,110,140,.32)'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(x + s * dx, y, r, r * 0.6, 0, 0, Math.PI * 2); g.fill(); } }
function feet(g, w, col) {
  g.fillStyle = shade(col, -0.32); g.strokeStyle = shade(col, -0.6); g.lineWidth = 2.6;
  for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * w * 0.22, -2, w * 0.15, 6.5, 0, 0, Math.PI * 2); g.fill(); g.stroke(); }
}
function arm(g, x, y, ang, len, col, wd = 10) {
  g.save(); g.translate(x, y); g.rotate(ang);
  g.strokeStyle = shade(col, -0.55); g.lineWidth = wd + 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, 0); g.lineTo(len, 0); g.stroke();
  g.strokeStyle = shade(col, -0.05); g.lineWidth = wd; g.beginPath(); g.moveTo(0, 0); g.lineTo(len, 0); g.stroke();
  g.restore();
}
function shine(g, x, y, rx, ry) { g.fillStyle = 'rgba(255,255,255,.42)'; g.beginPath(); g.ellipse(x, y, rx, ry, -0.5, 0, Math.PI * 2); g.fill(); }
function leafShape(g, x, y, len, ang, col) {
  g.save(); g.translate(x, y); g.rotate(ang);
  g.fillStyle = col; g.strokeStyle = shade(col, -0.5); g.lineWidth = 2.4;
  g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * 0.5, -len * 0.42, len, 0); g.quadraticCurveTo(len * 0.5, len * 0.42, 0, 0); g.fill(); g.stroke();
  g.strokeStyle = shade(col, -0.3); g.lineWidth = 1.6; g.beginPath(); g.moveTo(len * 0.1, 0); g.lineTo(len * 0.85, 0); g.stroke();
  g.restore();
}

// ---------- виды. part — партия в песне (audio.js), rate — монет в минуту на 1 уровне
const KINDS = {
  bumbo: {
    name: 'Бумбо', el: ['stone'], part: 'kick', price: 100, rate: 12, need: 1,
    desc: 'Каменный малыш. Отбивает ритм пузом и басит «бум».', col: '#a3917f',
    draw(g, st) {
      const w = 92, h = 80, c = this.col, s = st.sing;
      arm(g, -40, -34, Math.PI * 0.85 - s * 0.6, 22, c, 11); arm(g, 40, -34, Math.PI * 0.15 + s * 0.6, 22, c, 11);
      feet(g, w, c);
      silhouette(g, [{ path: g2 => SHAPES.rock(g2, w, h), fill: blobFill(g, c, w, h) }], c, shade(c, -0.6));
      g.strokeStyle = rgba('#000000', 0.15); g.lineWidth = 2; g.beginPath(); g.moveTo(-22, -96); g.lineTo(-10, -70); g.lineTo(-30, -50); g.moveTo(30, -64); g.lineTo(18, -46); g.stroke();
      g.fillStyle = '#6fbf4a'; g.beginPath(); g.ellipse(-6, -78, 18, 7, -0.15, 0, Math.PI * 2); g.fill(); // мох
      g.fillStyle = '#8fd860'; g.beginPath(); g.ellipse(-10, -80, 9, 3.5, -0.15, 0, Math.PI * 2); g.fill();
      // барабан-пузо
      g.fillStyle = shade(c, 0.35); g.strokeStyle = shade(c, -0.55); g.lineWidth = 2.6; g.beginPath(); g.ellipse(0, -24, 22 + s * 3, 16 + s * 2, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.strokeStyle = rgba('#5a3c2a', 0.4); g.lineWidth = 1.8; g.beginPath(); g.ellipse(0, -24, 14 + s * 2, 9, 0, 0, Math.PI * 2); g.stroke();
      eye(g, -15, -60, 9, st, { happy: true }); eye(g, 15, -60, 9, st, { happy: true });
      mouth(g, 0, -44, 26, s, 'teeth'); cheeks(g, 0, -48, 25, 6);
    },
  },
  bulya: {
    name: 'Буля', el: ['water'], part: 'marimba', price: 150, rate: 14, need: 1,
    desc: 'Капелька-непоседа. Стучит по маримбе, будто дождь по крыше.', col: '#4aa8ff',
    draw(g, st) {
      const w = 78, h = 100, c = this.col, s = st.sing;
      // плавники
      for (const k of [-1, 1]) { g.save(); g.translate(k * 34, -32); g.rotate(k * (0.5 + s * 0.5)); g.fillStyle = shade(c, 0.25); g.strokeStyle = shade(c, -0.55); g.lineWidth = 2.6; g.beginPath(); g.moveTo(0, -8); g.quadraticCurveTo(k * 22, -4, k * 18, 12); g.quadraticCurveTo(k * 6, 6, 0, 8); g.fill(); g.stroke(); g.restore(); }
      feet(g, w, c);
      silhouette(g, [{ path: g2 => SHAPES.drop(g2, w, h), fill: blobFill(g, c, w, h) }], c, shade(c, -0.6));
      g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.ellipse(0, -26, 24, 18, 0, 0, Math.PI * 2); g.fill();
      shine(g, -14, -66, 7, 13);
      eye(g, -13, -48, 10, st, { iris: '#1d4f9a' }); eye(g, 13, -48, 10, st, { iris: '#1d4f9a' });
      mouth(g, 0, -28, 20, s, 'o'); cheeks(g, 0, -34, 22, 5);
    },
  },
  fyuti: {
    name: 'Фьюти', el: ['wind'], part: 'flute', price: 150, rate: 14, need: 1,
    desc: 'Пушистое облачко. Дует в дудочку и ведёт главную мелодию.', col: '#bfe9fb',
    draw(g, st) {
      const c = this.col, s = st.sing;
      // крылышки
      for (const k of [-1, 1]) { g.save(); g.translate(k * 36, -56); g.rotate(k * (-0.4 + Math.sin(st.t * 9) * 0.25 * (0.3 + s))); g.fillStyle = '#fff'; g.strokeStyle = shade(c, -0.55); g.lineWidth = 2.4; g.beginPath(); g.ellipse(k * 14, -6, 16, 9, k * -0.5, 0, Math.PI * 2); g.fill(); g.stroke(); g.restore(); }
      feet(g, 70, '#9fc8dc');
      const puffs = [[0, -50, 36, 34], [-26, -38, 20, 20], [26, -38, 20, 20], [-16, -78, 18, 16], [16, -80, 18, 16], [0, -86, 16, 14], [0, -22, 32, 20]];
      const cf = g.createLinearGradient(0, -100, 0, 0); cf.addColorStop(0, '#ffffff'); cf.addColorStop(0.6, '#e4f6ff'); cf.addColorStop(1, '#a9d8ef');
      silhouette(g, puffs.map(([x, y, rx, ry]) => ({ path: g2 => g2.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2), fill: cf })), c, '#4a86a8');
      shine(g, -14, -76, 8, 5);
      eye(g, -12, -56, 8.5, st); eye(g, 12, -56, 8.5, st); cheeks(g, 0, -45, 21, 5);
      // дудочка
      g.save(); g.translate(2, -38); g.rotate(0.35); g.fillStyle = '#d99a4e'; g.strokeStyle = '#6a4220'; g.lineWidth = 2.2;
      g.beginPath(); g.roundRect(0, -4, 34, 8, 4); g.fill(); g.stroke(); g.fillStyle = '#6a4220';
      for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(12 + i * 7, 0, 1.6, 0, Math.PI * 2); g.fill(); } g.restore();
      mouth(g, 0, -38, 14, 0.3 + s * 0.4, 'o');
    },
  },
  shursha: {
    name: 'Шурша', el: ['leaf'], part: 'shaker', price: 200, rate: 16, need: 2,
    desc: 'Лесной шуршун. Трясёт маракасами из орехов и хлопает в ладоши.', col: '#74cf4a',
    draw(g, st) {
      const w = 76, h = 92, c = this.col, s = st.sing, sh = Math.sin(st.t * 22) * s;
      leafShape(g, 0, -88, 34, -1.9, '#4fae32'); leafShape(g, 2, -88, 30, -1.1, '#62c43e');
      // маракасы
      for (const k of [-1, 1]) {
        g.save(); g.translate(k * 34, -40); g.rotate(k * (0.9 + sh * 0.35));
        g.strokeStyle = '#7a4f2a'; g.lineWidth = 4; g.beginPath(); g.moveTo(0, 0); g.lineTo(k * 20, -10); g.stroke();
        g.fillStyle = '#e8a33c'; g.strokeStyle = '#7a4f2a'; g.lineWidth = 2.2; g.beginPath(); g.ellipse(k * 26, -13, 9, 7, k * -0.45, 0, Math.PI * 2); g.fill(); g.stroke();
        g.restore();
        arm(g, k * 30, -38, k > 0 ? -0.2 - sh * 0.3 : Math.PI + 0.2 + sh * 0.3, 12, c, 9);
      }
      feet(g, w, c);
      silhouette(g, [{ path: g2 => SHAPES.pear(g2, w, h), fill: blobFill(g, c, w, h) }], c, shade(c, -0.6));
      g.fillStyle = shade(c, 0.4); g.beginPath(); g.ellipse(0, -24, 20, 16, 0, 0, Math.PI * 2); g.fill();
      shine(g, -12, -74, 6, 9);
      eye(g, -11, -58, 8, st, { happy: true }); eye(g, 11, -58, 8, st, { happy: true });
      mouth(g, 0, -42, 18, s); cheeks(g, 0, -46, 19, 5);
    },
  },
  glubun: {
    name: 'Глубун', el: ['water'], part: 'bass', price: 300, rate: 20, need: 3,
    desc: 'Живёт в подводных пещерах. Его низкий бас слышно на дне моря.', col: '#2f8a92',
    draw(g, st) {
      const w = 104, h = 70, c = this.col, s = st.sing;
      feet(g, w, c);
      const spikes = [[-30, -62], [-10, -72], [12, -70], [32, -58]].map(([x, y]) => ({ path: g2 => { g2.moveTo(x - 10, y + 12); g2.lineTo(x, y - 8); g2.lineTo(x + 10, y + 12); g2.closePath(); }, fill: '#8a7a6a' }));
      silhouette(g, [...spikes, { path: g2 => SHAPES.gum(g2, w, h), fill: blobFill(g, c, w, h) }], c, shade(c, -0.6));
      g.fillStyle = shade(c, 0.35); g.beginPath(); g.ellipse(0, -16, 34, 13, 0, 0, Math.PI * 2); g.fill();
      for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.arc(-30 + i * 9, -40 + (i % 2) * 6, 2.6, 0, Math.PI * 2); g.fill(); }
      eye(g, -20, -52, 7.5, st, { iris: '#c8e84a', pupil: 0.6 }); eye(g, 20, -52, 7.5, st, { iris: '#c8e84a', pupil: 0.6 });
      mouth(g, 0, -34, 40, s * 0.85, 'teeth');
    },
  },
  gudun: {
    name: 'Гудун', el: ['stone', 'wind'], part: 'pad', rate: 45,
    desc: 'Поющая скала с горных вершин. Тянет «у-у-о» так, что дрожат облака.', col: '#9b8cf0',
    draw(g, st) {
      const w = 70, h = 112, c = this.col, s = st.sing;
      // дымка вокруг
      g.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 3; i++) { const a = st.t * 0.8 + i * 2.1; g.beginPath(); g.ellipse(Math.cos(a) * 40, -60 + Math.sin(a) * 10, 14, 6, 0, 0, Math.PI * 2); g.fill(); }
      feet(g, w, c);
      silhouette(g, [{ path: g2 => SHAPES.gum(g2, w, h), fill: blobFill(g, c, w, h) }, { path: g2 => g2.ellipse(0, -108, 14, 8, 0, 0, Math.PI * 2), fill: shade(c, 0.2) }], c, shade(c, -0.6));
      g.strokeStyle = rgba('#3a2a8a', 0.25); g.lineWidth = 2; for (const y of [-26, -18]) { g.beginPath(); g.moveTo(-26, y); g.quadraticCurveTo(0, y + 6, 26, y); g.stroke(); }
      shine(g, -12, -92, 6, 10);
      // три глаза: при пении закрывает
      const cl = { ...st, blink: Math.max(st.blink, s > 0.3 ? 1 : 0) };
      eye(g, -14, -78, 7, cl); eye(g, 14, -78, 7, cl); eye(g, 0, -92, 6, cl);
      mouth(g, 0, -56, 22, 0.25 + s * 0.75, 'o');
    },
  },
  tumtum: {
    name: 'Тумтум', el: ['stone'], part: 'tom', price: 300, rate: 20, need: 3,
    desc: 'Стучит в бонги из кокосов. Ушами ловит ритм всего острова.', col: '#ee9440',
    draw(g, st) {
      const w = 86, h = 80, c = this.col, s = st.sing, hit = Math.abs(Math.sin(st.t * 14)) * s;
      feet(g, w, c);
      const ears = [-1, 1].map(k => ({ path: g2 => { g2.moveTo(k * 18, -70); g2.quadraticCurveTo(k * 46, -110, k * 40, -66); g2.closePath(); }, fill: shade(c, -0.08) }));
      silhouette(g, [...ears, { path: g2 => SHAPES.gum(g2, w, h), fill: blobFill(g, c, w, h) }], c, shade(c, -0.6));
      for (const k of [-1, 1]) { g.fillStyle = '#ffb6a0'; g.beginPath(); g.moveTo(k * 22, -72); g.quadraticCurveTo(k * 40, -98, k * 36, -70); g.closePath(); g.fill(); }
      g.fillStyle = shade(c, 0.38); g.beginPath(); g.ellipse(0, -26, 24, 15, 0, 0, Math.PI * 2); g.fill();
      eye(g, -14, -56, 8, st); eye(g, 14, -56, 8, st);
      mouth(g, 0, -40, 22, s); cheeks(g, 0, -44, 24, 5);
      // бонги перед собой
      for (const k of [-1, 1]) {
        g.fillStyle = '#9a5a2a'; g.strokeStyle = '#4a2a12'; g.lineWidth = 2.4;
        g.beginPath(); g.moveTo(k * 26 - 13, -18); g.lineTo(k * 26 + 13, -18); g.lineTo(k * 26 + 9, 4); g.lineTo(k * 26 - 9, 4); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = '#f2e2c0'; g.beginPath(); g.ellipse(k * 26, -18, 13, 4.5, 0, 0, Math.PI * 2); g.fill(); g.stroke();
        arm(g, k * 34, -34, k > 0 ? Math.PI * 0.62 - hit * 0.3 : Math.PI * 0.38 + hit * 0.3, 16, c, 9);
      }
    },
  },
  puzyrik: {
    name: 'Пузырик', el: ['water', 'wind'], part: 'soprano', rate: 48, hover: true,
    desc: 'Мыльный пузырь-сопрано. Поёт «ла-а» так высоко, что звенит колокольчик на усике.', col: '#8fd0ff',
    draw(g, st) {
      const c = this.col, s = st.sing, r = 38;
      // усик с колокольчиком
      g.strokeStyle = shade(c, -0.5); g.lineWidth = 3; g.beginPath(); g.moveTo(0, -r * 2 + 2); g.quadraticCurveTo(8, -r * 2 - 18, 2 + Math.sin(st.t * 6) * s * 6, -r * 2 - 26); g.stroke();
      g.save(); g.translate(2 + Math.sin(st.t * 6) * s * 6, -r * 2 - 26); g.rotate(Math.sin(st.t * 12) * s * 0.4);
      g.fillStyle = '#ffd34a'; g.strokeStyle = '#8a6a10'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(-8, 10); g.quadraticCurveTo(-8, -6, 0, -6); g.quadraticCurveTo(8, -6, 8, 10); g.closePath(); g.fill(); g.stroke(); g.restore();
      const gr = g.createRadialGradient(-12, -r - 14, 4, 0, -r, r);
      gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(0.35, rgba('#bfe6ff', 0.85)); gr.addColorStop(0.85, rgba('#ff9ad8', 0.6)); gr.addColorStop(1, rgba('#7a8cff', 0.75));
      g.fillStyle = gr; g.strokeStyle = shade(c, -0.55); g.lineWidth = 3.2; g.beginPath(); g.arc(0, -r, r * (1 + s * 0.05), 0, Math.PI * 2); g.fill(); g.stroke();
      shine(g, -14, -r - 16, 9, 5);
      eye(g, -10, -r + 2, 6.5, st); eye(g, 10, -r + 2, 6.5, st);
      mouth(g, 0, -r + 15, 12, s, 'o'); cheeks(g, 0, -r + 10, 17, 4);
    },
  },
  kvakusha: {
    name: 'Квакуша', el: ['water', 'leaf'], part: 'frog', rate: 46,
    desc: 'Болотная певица. Раздувает горлышко и выводит «ква-ква» точно в такт.', col: '#46c48e',
    draw(g, st) {
      const w = 96, h = 72, c = this.col, s = st.sing;
      feet(g, w, c);
      const bumps = [-1, 1].map(k => ({ path: g2 => g2.arc(k * 22, -66, 16, 0, Math.PI * 2), fill: shade(c, 0.12) }));
      silhouette(g, [...bumps, { path: g2 => SHAPES.gum(g2, w, h), fill: blobFill(g, c, w, h) }], c, shade(c, -0.6));
      // кувшинка-шляпка
      g.fillStyle = '#3f9a3a'; g.strokeStyle = '#1f5a1f'; g.lineWidth = 2.4; g.beginPath(); g.ellipse(4, -86, 24, 7, -0.1, 0.25, Math.PI * 2 - 0.05); g.lineTo(4, -86); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#ff9ad0'; g.beginPath(); for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; g.ellipse(6 + Math.cos(a) * 5, -92 + Math.sin(a) * 2.5, 4.5, 3, a, 0, Math.PI * 2); } g.fill();
      // горловой мешок
      const sac = 4 + s * 14; g.fillStyle = '#ffc0d4'; g.strokeStyle = shade(c, -0.6); g.lineWidth = 2.4; g.beginPath(); g.ellipse(0, -18, sac * 1.4, sac, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      eye(g, -22, -66, 9.5, st, { iris: '#e8b020', lid: 1 }); eye(g, 22, -66, 9.5, st, { iris: '#e8b020', lid: 1 });
      mouth(g, 0, -40, 44, s * 0.7); cheeks(g, 0, -42, 32, 6);
    },
  },
  brenchik: {
    name: 'Бренчик', el: ['leaf'], part: 'pluck', price: 350, rate: 22, need: 4,
    desc: 'Степной гитарист с травяной чёлкой. Бренчит аккорды на слабую долю.', col: '#cbe04a',
    draw(g, st) {
      const w = 66, h = 104, c = this.col, s = st.sing, strum = Math.sin(st.t * 16) * s;
      for (let i = -2; i <= 2; i++) { g.strokeStyle = i % 2 ? '#5fa83a' : '#7cc84a'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(i * 6, -96); g.quadraticCurveTo(i * 10, -118, i * 14 + Math.sin(st.t * 3 + i) * 3, -122); g.stroke(); }
      feet(g, w, c);
      silhouette(g, [{ path: g2 => SHAPES.gum(g2, w, h), fill: blobFill(g, c, w, h) }], c, shade(c, -0.6));
      shine(g, -11, -84, 6, 10);
      eye(g, -11, -70, 8, st, { lid: 1 }); eye(g, 11, -70, 8, st, { lid: 1 });
      mouth(g, 0, -54, 18, s); cheeks(g, 0, -58, 18, 4.5);
      // лютня
      g.save(); g.translate(-4, -26); g.rotate(-0.5);
      g.fillStyle = '#c87a3a'; g.strokeStyle = '#5a3218'; g.lineWidth = 2.4;
      g.beginPath(); g.ellipse(0, 0, 16, 12, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = '#5a3218'; g.beginPath(); g.arc(2, 0, 4, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#8a5228'; g.beginPath(); g.roundRect(12, -3, 30, 6, 2); g.fill(); g.stroke();
      g.restore();
      arm(g, 26, -40, Math.PI * 0.75 + strum * 0.4, 18, c, 9); arm(g, -28, -46, Math.PI * 0.2, 14, c, 9);
    },
  },
  gromofon: {
    name: 'Громофон', el: ['fire'], part: 'brass', price: 450, rate: 26, need: 5,
    desc: 'Вместо рта — труба. Когда он играет «па-пам», чайки сбиваются с курса.', col: '#ef8a3a',
    draw(g, st) {
      const w = 96, h = 92, c = this.col, s = st.sing;
      feet(g, w, c);
      const horns = [-1, 1].map(k => ({ path: g2 => { g2.moveTo(k * 22, -82); g2.quadraticCurveTo(k * 40, -118, k * 52, -104); g2.quadraticCurveTo(k * 42, -96, k * 36, -76); g2.closePath(); }, fill: '#f2e2c0' }));
      silhouette(g, [...horns, { path: g2 => SHAPES.ball(g2, w, h), fill: blobFill(g, c, w, h) }], c, shade(c, -0.6));
      shine(g, -20, -72, 8, 13);
      eye(g, -17, -62, 9, st); eye(g, 17, -62, 9, st);
      // труба
      const bell = 13 + s * 5;
      g.fillStyle = '#ffcc3a'; g.strokeStyle = '#8a5a10'; g.lineWidth = 2.6;
      g.beginPath(); g.moveTo(-6, -40); g.lineTo(6, -40); g.lineTo(bell, -18); g.lineTo(-bell, -18); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#5a3a08'; g.beginPath(); g.ellipse(0, -18, bell, 4.5, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      shine(g, -4, -32, 2, 6);
      cheeks(g, 0, -46, 30, 7 + s * 3);
    },
  },
  pevunya: {
    name: 'Певунья', el: ['wind', 'leaf'], part: 'lead', rate: 48,
    desc: 'Цветочная примадонна. Поёт вторым голосом и никогда не фальшивит.', col: '#ff8fc6',
    draw(g, st) {
      const w = 72, h = 104, c = this.col, s = st.sing;
      feet(g, w, c);
      silhouette(g, [{ path: g2 => SHAPES.pear(g2, w, h), fill: blobFill(g, c, w, h) }], c, shade(c, -0.6));
      // цветок
      g.save(); g.translate(14, -98); g.rotate(Math.sin(st.t * 2) * 0.1);
      g.fillStyle = '#fff3a0'; g.strokeStyle = '#a0603a'; g.lineWidth = 2;
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.beginPath(); g.ellipse(Math.cos(a) * 10, Math.sin(a) * 10, 8, 5, a, 0, Math.PI * 2); g.fill(); g.stroke(); }
      g.fillStyle = '#ffb02a'; g.beginPath(); g.arc(0, 0, 6, 0, Math.PI * 2); g.fill(); g.stroke(); g.restore();
      shine(g, -12, -82, 5, 9);
      for (const k of [-1, 1]) { eye(g, k * 12, -66, 8, st, { iris: '#6a2a8a', happy: true }); if (!(st.blink > 0.5) && !(s > 0.55)) { g.strokeStyle = '#2a1a22'; g.lineWidth = 2; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(k * 12 + k * (3 + i * 3), -74); g.lineTo(k * 12 + k * (6 + i * 4), -80 + i); g.stroke(); } } }
      mouth(g, 0, -48, 16, s, 'o'); cheeks(g, 0, -54, 20, 5);
      arm(g, -24, -36, 0.35 + s * 0.3, 14, c, 8); arm(g, 24, -36, Math.PI - 0.35 - s * 0.3, 14, c, 8);
    },
  },
  svistun: {
    name: 'Свистун', el: ['wind'], part: 'whistle', price: 350, rate: 22, need: 4,
    desc: 'Совёнок-свистульщик. Тянет длинные ноты высоко-высоко.', col: '#a08a5a',
    draw(g, st) {
      const w = 78, h = 92, c = this.col, s = st.sing;
      feet(g, w, '#e8a03a');
      const tufts = [-1, 1].map(k => ({ path: g2 => { g2.moveTo(k * 14, -86); g2.lineTo(k * 30, -112); g2.lineTo(k * 34, -78); g2.closePath(); }, fill: shade(c, -0.1) }));
      silhouette(g, [...tufts, { path: g2 => SHAPES.gum(g2, w, h), fill: blobFill(g, c, w, h) }], c, shade(c, -0.6));
      g.fillStyle = '#f2e2c0'; g.beginPath(); g.ellipse(0, -30, 24, 24, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = rgba('#8a6a3a', 0.5); g.lineWidth = 1.8; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(0, -36 + i * 9, 10, Math.PI * 0.2, Math.PI * 0.8); g.stroke(); }
      // крылья
      for (const k of [-1, 1]) { g.fillStyle = shade(c, -0.2); g.strokeStyle = shade(c, -0.6); g.lineWidth = 2.4; g.beginPath(); g.ellipse(k * 36, -44, 9, 22, k * (0.25 + s * 0.25), 0, Math.PI * 2); g.fill(); g.stroke(); }
      g.fillStyle = '#f6f0e0'; for (const k of [-1, 1]) { g.beginPath(); g.arc(k * 15, -66, 14, 0, Math.PI * 2); g.fill(); }
      eye(g, -15, -66, 10, st, { iris: '#ff9a20', pupil: 0.62, lid: 1 }); eye(g, 15, -66, 10, st, { iris: '#ff9a20', pupil: 0.62, lid: 1 });
      // клюв-свистулька
      g.fillStyle = '#ffb02a'; g.strokeStyle = '#7a4a10'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(-6, -54); g.lineTo(6, -54); g.lineTo(0, -44 + s * 2); g.closePath(); g.fill(); g.stroke();
    },
  },
  barabas: {
    name: 'Барабас', el: ['fire'], part: 'snare', price: 250, rate: 18, need: 2,
    desc: 'Барабанщик-марширолог. Держит ритм так, что под него можно ставить часы.', col: '#cf3d52',
    draw(g, st) {
      const w = 84, h = 96, c = this.col, s = st.sing, hit = Math.abs(Math.sin(st.t * 15)) * s;
      feet(g, w, c);
      silhouette(g, [{ path: g2 => SHAPES.box(g2, w, h), fill: blobFill(g, c, w, h) }], c, shade(c, -0.6));
      // повязка
      g.fillStyle = '#ffd84a'; g.strokeStyle = '#8a6a10'; g.lineWidth = 2.2; g.beginPath(); g.roundRect(-42, -88, 84, 10, 4); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(38, -84); g.lineTo(52, -92 + Math.sin(st.t * 5) * 3); g.lineTo(50, -78); g.closePath(); g.fill(); g.stroke();
      eye(g, -15, -64, 8.5, st); eye(g, 15, -64, 8.5, st);
      g.strokeStyle = '#2a1a22'; g.lineWidth = 3; for (const k of [-1, 1]) { g.beginPath(); g.moveTo(k * 8, -76); g.lineTo(k * 22, -79); g.stroke(); } // брови
      mouth(g, 0, -46, 22, s, 'teeth');
      // малый барабан
      g.fillStyle = '#e8e8f0'; g.strokeStyle = '#3a3a5a'; g.lineWidth = 2.4; g.beginPath(); g.roundRect(-24, -26, 48, 20, 5); g.fill(); g.stroke();
      g.strokeStyle = '#d23a3a'; g.lineWidth = 2; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * 9 - 4, -24); g.lineTo(i * 9 + 4, -8); g.stroke(); }
      g.fillStyle = '#f6f2e6'; g.strokeStyle = '#3a3a5a'; g.beginPath(); g.ellipse(0, -26, 24, 5, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      for (const k of [-1, 1]) { g.save(); g.translate(k * 30, -40); g.rotate(k > 0 ? Math.PI * 0.75 - hit * 0.5 : Math.PI * 0.25 + hit * 0.5); g.strokeStyle = '#5a3a1a'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 0); g.lineTo(26, 0); g.stroke(); g.fillStyle = '#5a3a1a'; g.beginPath(); g.arc(26, 0, 3, 0, Math.PI * 2); g.fill(); g.restore(); }
    },
  },
  maestro: {
    name: 'Маэстро', el: ['water', 'fire'], part: 'opera', rate: 60,
    desc: 'Тенор в золотой короне. Поёт главную мелодию оперным голосом — весь остров слушает.', col: '#ffc63a',
    draw(g, st) {
      const w = 96, h = 112, c = this.col, s = st.sing;
      // плащ
      g.fillStyle = '#c8243a'; g.strokeStyle = '#5a0a18'; g.lineWidth = 3; g.beginPath(); g.moveTo(-34, -78); g.quadraticCurveTo(-62, -30, -50 - Math.sin(st.t * 2) * 4, 0); g.lineTo(50 + Math.sin(st.t * 2 + 1) * 4, 0); g.quadraticCurveTo(62, -30, 34, -78); g.closePath(); g.fill(); g.stroke();
      feet(g, w, c);
      silhouette(g, [{ path: g2 => SHAPES.pear(g2, w, h), fill: blobFill(g, c, w, h) }], c, shade(c, -0.6));
      // корона
      g.fillStyle = '#ffe680'; g.strokeStyle = '#8a6a10'; g.lineWidth = 2.4;
      g.beginPath(); g.moveTo(-18, -104); g.lineTo(-20, -126); g.lineTo(-9, -114); g.lineTo(0, -130); g.lineTo(9, -114); g.lineTo(20, -126); g.lineTo(18, -104); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#ff4a8a'; g.beginPath(); g.arc(0, -112, 3.5, 0, Math.PI * 2); g.fill();
      shine(g, -16, -88, 7, 12);
      eye(g, -14, -76, 8, st, { happy: true }); eye(g, 14, -76, 8, st, { happy: true });
      mouth(g, 0, -50, 24, 0.15 + s * 0.85, 'o');
      // усы
      g.fillStyle = '#5a3a1a'; for (const k of [-1, 1]) { g.beginPath(); g.moveTo(0, -62); g.quadraticCurveTo(k * 16, -68, k * 28, -58 + Math.sin(st.t * 3) * 1.5); g.quadraticCurveTo(k * 16, -60, 0, -58); g.fill(); }
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(-10, -30); g.lineTo(0, -22); g.lineTo(10, -30); g.lineTo(0, -38); g.closePath(); g.fill(); // жабо
      arm(g, -38, -46, Math.PI * 0.9 - s * 0.9, 18, c, 10); arm(g, 38, -46, Math.PI * 0.1 + s * 0.9, 18, c, 10);
    },
  },
  // ---------- новые элитные певцы
  bubun: {
    name: 'Бубун', el: ['stone', 'water'], part: 'bassvox', rate: 46,
    desc: 'Подводный валун с бородой из водорослей. Поёт басом «дум-дум» вместе с басовой линией.', col: '#5f7fa6',
    draw(g, st) {
      const w = 108, h = 84, c = this.col, s = st.sing;
      feet(g, w, c);
      const rocks = [[-26, -80, 14], [4, -86, 12], [28, -76, 10]].map(([x, y, r]) => ({ path: g2 => g2.ellipse(x, y, r * 1.3, r, 0, 0, Math.PI * 2), fill: '#9aa6b2' }));
      silhouette(g, [...rocks, { path: g2 => SHAPES.gum(g2, w, h), fill: blobFill(g, c, w, h) }], c, shade(c, -0.6));
      for (let i = -3; i <= 3; i++) { g.strokeStyle = i % 2 ? '#3f9a5a' : '#2f7a46'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(i * 7, -24); g.quadraticCurveTo(i * 8 + Math.sin(st.t * 3 + i) * 4, -12, i * 7 + Math.sin(st.t * 2 + i) * 5, -3); g.stroke(); }
      eye(g, -20, -58, 8, st, { lid: 1, iris: '#2a5a8a' }); eye(g, 20, -58, 8, st, { lid: 1, iris: '#2a5a8a' });
      g.fillStyle = '#2a1a22'; for (const k of [-1, 1]) { g.beginPath(); g.ellipse(k * 20, -71, 9, 3, k * 0.2, 0, Math.PI * 2); g.fill(); }
      mouth(g, 0, -38, 26, 0.12 + s * 0.88, 'o'); cheeks(g, 0, -46, 30, 6);
    },
  },
  tyc: {
    name: 'Тыц', el: ['stone', 'leaf'], part: 'beatbox', rate: 46,
    desc: 'Уличный битбоксер в наушниках из ракушек. Делает ртом бочку, тарелки и малый барабан.', col: '#7d9a52',
    draw(g, st) {
      const w = 82, h = 88, c = this.col, s = st.sing, bob = Math.sin(st.t * 10) * s * 3;
      feet(g, w, c);
      silhouette(g, [{ path: g2 => SHAPES.box(g2, w, h), fill: blobFill(g, c, w, h) }], c, shade(c, -0.6));
      g.fillStyle = '#3f8a2a'; g.strokeStyle = '#1f4a14'; g.lineWidth = 2.6;
      g.beginPath(); g.ellipse(0, -86, 34, 12, 0, Math.PI, 0); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(28, -88); g.quadraticCurveTo(52, -92, 50, -80); g.quadraticCurveTo(40, -84, 28, -82); g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = '#3a3a4a'; g.lineWidth = 5; g.beginPath(); g.arc(0, -66, 42, Math.PI * 1.12, Math.PI * 1.88); g.stroke();
      for (const k of [-1, 1]) { g.fillStyle = '#f0e6d8'; g.strokeStyle = '#5a4a3a'; g.lineWidth = 2.4; g.beginPath(); g.ellipse(k * 40, -58, 9, 13, 0, 0, Math.PI * 2); g.fill(); g.stroke(); g.fillStyle = '#ff8a6a'; g.beginPath(); g.ellipse(k * 40, -58, 4, 7, 0, 0, Math.PI * 2); g.fill(); }
      eye(g, -14, -62, 8, st, { lid: 1 }); eye(g, 14, -62, 8, st, { lid: 1 });
      mouth(g, 0, -42, 18, s, 'o');
      g.save(); g.translate(20, -34 + bob); g.rotate(-0.6); g.fillStyle = '#3a3a4a'; g.fillRect(-3, 0, 6, 22); g.fillStyle = '#9aa0ae'; g.strokeStyle = '#3a3a4a'; g.lineWidth = 2; g.beginPath(); g.arc(0, -2, 8, 0, Math.PI * 2); g.fill(); g.stroke(); g.restore();
      arm(g, 30, -28, Math.PI * 0.8, 12, c, 9); arm(g, -32, -34, Math.PI * 0.15 + s * 0.5, 14, c, 9);
    },
  },
  heyho: {
    name: 'Хейхо', el: ['stone', 'fire'], part: 'chant', rate: 46,
    desc: 'Вулканический заводила. Кричит «хей!» и «хо!», и весь остров кричит вместе с ним.', col: '#5b4e55',
    draw(g, st) {
      const w = 96, h = 90, c = this.col, s = st.sing;
      const fl = (x, y, sc, ph) => { const k = 1 + Math.sin(st.t * 12 + ph) * 0.12 + s * 0.3; g.save(); g.translate(x, y); g.scale(sc, sc * k); g.fillStyle = '#ffb02a'; g.beginPath(); g.moveTo(0, -30); g.quadraticCurveTo(14, -10, 10, 0); g.quadraticCurveTo(0, 6, -10, 0); g.quadraticCurveTo(-14, -10, 0, -30); g.fill(); g.fillStyle = '#ff5a2a'; g.beginPath(); g.moveTo(0, -18); g.quadraticCurveTo(8, -6, 6, 0); g.quadraticCurveTo(0, 4, -6, 0); g.quadraticCurveTo(-8, -6, 0, -18); g.fill(); g.restore(); };
      fl(-14, -90, 0.8, 0); fl(4, -96, 1, 1.3); fl(20, -88, 0.7, 2.6);
      feet(g, w, c);
      silhouette(g, [{ path: g2 => SHAPES.rock(g2, w, h), fill: blobFill(g, c, w, h) }], c, shade(c, -0.6));
      g.strokeStyle = `rgba(255,${120 + s * 80 | 0},40,${0.7 + s * 0.3})`; g.lineWidth = 3; g.lineJoin = 'round';
      for (const P of [[[-38, -60], [-26, -50], [-30, -36]], [[30, -70], [22, -56], [32, -44]], [[-10, -16], [0, -10], [12, -16]]]) { g.beginPath(); P.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); }
      eye(g, -16, -62, 8.5, st, { iris: '#ff7a20' }); eye(g, 16, -62, 8.5, st, { iris: '#ff7a20' });
      g.strokeStyle = '#2a1a22'; g.lineWidth = 3; for (const k of [-1, 1]) { g.beginPath(); g.moveTo(k * 8, -74); g.lineTo(k * 24, -78 + s * 3); g.stroke(); }
      mouth(g, 0, -42, 30, s, 'teeth');
      arm(g, 40, -44, -Math.PI * 0.35 - s * 0.6, 20, c, 11); arm(g, -40, -40, Math.PI * 0.85, 14, c, 10);
    },
  },
  zharptica: {
    name: 'Жар-птичка', el: ['wind', 'fire'], part: 'yodel', rate: 48,
    desc: 'Огненная певчая птичка. Выводит переливы «о-ли-и» с прыжками через октаву.', col: '#ff5a4a',
    draw(g, st) {
      const w = 74, h = 92, c = this.col, s = st.sing;
      for (let i = -1; i <= 1; i++) { g.save(); g.translate(-24, -24); g.rotate(-2.5 + i * 0.35 + Math.sin(st.t * 3 + i) * 0.08); g.fillStyle = ['#ffb02a', '#ff7a2a', '#ffd84a'][i + 1]; g.strokeStyle = '#8a2a10'; g.lineWidth = 2.2; g.beginPath(); g.ellipse(22, 0, 24, 7, 0, 0, Math.PI * 2); g.fill(); g.stroke(); g.restore(); }
      feet(g, w, '#e8a03a');
      silhouette(g, [{ path: g2 => SHAPES.pear(g2, w, h), fill: blobFill(g, c, w, h) }], c, shade(c, -0.6));
      g.fillStyle = '#ffd84a'; g.beginPath(); g.ellipse(0, -30, 20, 22, 0, 0, Math.PI * 2); g.fill();
      for (let i = -1; i <= 1; i++) { const k = 1 + Math.sin(st.t * 14 + i) * 0.15; g.save(); g.translate(i * 8, -88); g.rotate(i * 0.35); g.scale(1, k); g.fillStyle = i ? '#ffb02a' : '#ffd84a'; g.strokeStyle = '#8a2a10'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -22); g.quadraticCurveTo(8, -8, 5, 0); g.lineTo(-5, 0); g.quadraticCurveTo(-8, -8, 0, -22); g.fill(); g.stroke(); g.restore(); }
      for (const k of [-1, 1]) { g.save(); g.translate(k * 30, -48); g.rotate(k * (0.3 + Math.sin(st.t * 10) * 0.25 * (0.3 + s))); g.fillStyle = shade(c, -0.12); g.strokeStyle = shade(c, -0.6); g.lineWidth = 2.4; g.beginPath(); g.ellipse(k * 8, 4, 10, 18, k * 0.3, 0, Math.PI * 2); g.fill(); g.stroke(); g.restore(); }
      eye(g, -11, -66, 8, st, { lid: 1 }); eye(g, 11, -66, 8, st, { lid: 1 });
      const op = s * 7; g.fillStyle = '#ffcc2a'; g.strokeStyle = '#8a5a10'; g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(-6, -50 + op * 0.3); g.lineTo(6, -50 + op * 0.3); g.lineTo(0, -42 + op); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(-8, -55); g.lineTo(8, -55); g.lineTo(0, -45); g.closePath(); g.fill(); g.stroke();
    },
  },
  dubidub: {
    name: 'Дубидуб', el: ['leaf', 'fire'], part: 'scat', rate: 48,
    desc: 'Джазовый кот-монстрик в листовом берете. Импровизирует «ду-би-ду-ба» на слабые доли.', col: '#9a5ad6',
    draw(g, st) {
      const w = 80, h = 96, c = this.col, s = st.sing, sw = Math.sin(st.t * 6) * 0.15;
      g.lineCap = 'round'; g.strokeStyle = shade(c, -0.6); g.lineWidth = 12; g.beginPath(); g.moveTo(30, -16); g.quadraticCurveTo(58, -30 + sw * 20, 50, -60); g.stroke();
      g.strokeStyle = c; g.lineWidth = 7; g.beginPath(); g.moveTo(30, -16); g.quadraticCurveTo(58, -30 + sw * 20, 50, -60); g.stroke();
      feet(g, w, c);
      const ears = [-1, 1].map(k => ({ path: g2 => { g2.moveTo(k * 14, -88); g2.lineTo(k * 30, -112); g2.lineTo(k * 34, -80); g2.closePath(); }, fill: shade(c, -0.05) }));
      silhouette(g, [...ears, { path: g2 => SHAPES.gum(g2, w, h), fill: blobFill(g, c, w, h) }], c, shade(c, -0.6));
      g.save(); g.translate(-6, -96); g.rotate(-0.25); g.fillStyle = '#5cc040'; g.strokeStyle = '#2f6a1f'; g.lineWidth = 2.6; g.beginPath(); g.ellipse(0, 0, 30, 10, 0, 0, Math.PI * 2); g.fill(); g.stroke(); g.lineWidth = 2; g.beginPath(); g.moveTo(-22, 0); g.lineTo(22, 0); g.stroke(); g.restore();
      for (const k of [-1, 1]) { g.fillStyle = '#2a2236'; g.strokeStyle = '#ffb02a'; g.lineWidth = 2.4; g.beginPath(); g.ellipse(k * 14, -66, 12, 9, 0, 0, Math.PI * 2); g.fill(); g.stroke(); g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.ellipse(k * 14 - 4, -69, 4, 2, -0.4, 0, Math.PI * 2); g.fill(); }
      g.strokeStyle = '#ffb02a'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(-2, -66); g.lineTo(2, -66); g.stroke();
      g.strokeStyle = '#2a1a22'; g.lineWidth = 1.6; for (const k of [-1, 1]) for (const d of [-2, 2]) { g.beginPath(); g.moveTo(k * 14, -50 + d); g.lineTo(k * 32, -52 + d * 2); g.stroke(); }
      mouth(g, 0, -46, 18, s, s > 0.5 ? 'o' : 'smile');
      g.fillStyle = '#ff7a2a'; g.strokeStyle = '#7a2a10'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -30); g.lineTo(-12, -36); g.lineTo(-12, -24); g.closePath(); g.moveTo(0, -30); g.lineTo(12, -36); g.lineTo(12, -24); g.closePath(); g.fill(); g.stroke();
      arm(g, -30, -34, Math.PI * 0.75 - Math.abs(sw) * 2 - s * 0.3, 16, c, 9); arm(g, 30, -36, Math.PI * 0.25 + Math.abs(sw) * 2 + s * 0.3, 16, c, 9);
    },
  },
};
// порядок в магазине и книге: обычные по цене, затем элитные
const BASE_IDS = ['bumbo', 'fyuti', 'bulya', 'shursha', 'barabas', 'glubun', 'tumtum', 'brenchik', 'svistun', 'gromofon'];
const ELITE_IDS = ['bubun', 'gudun', 'tyc', 'heyho', 'puzyrik', 'kvakusha', 'maestro', 'pevunya', 'zharptica', 'dubidub'];
const KIND_IDS = [...BASE_IDS, ...ELITE_IDS];
const RARITY = n => (n > 1 ? 'Элитный' : 'Обычный');
// скрещивание: по стихии от каждого родителя; разные — элитный этой пары, одинаковые — обычный этой стихии
const ELITE_BY_PAIR = Object.fromEntries(ELITE_IDS.map(k => [KINDS[k].el.slice().sort().join('+'), k]));
const BASE_BY_EL = {}; for (const k of BASE_IDS) (BASE_BY_EL[KINDS[k].el[0]] = BASE_BY_EL[KINDS[k].el[0]] || []).push(k);

// полный рисунок монстра: тень, подпрыгивание, сжатие на ноте, раскачивание
// st: t — время, sing — громкость своей ноты, sq — пружина «желе» (+ вытянулся, − сплющился),
// jump — высота прыжка, bob — кивок в такт, tilt — наклон, look/lookY — куда смотрит
function drawMonster(g, kind, x, y, size, st) {
  const K = KINDS[kind], s = st.sing || 0;
  const breathe = Math.sin(st.t * 2.2 + (st.phase || 0)) * 0.025, sq = st.sq || 0;
  const lift = (K.hover ? 14 + Math.sin(st.t * 1.8 + (st.phase || 0)) * 5 : 0) + (st.jump || 0) + (st.hop || 0);
  g.save(); g.translate(x, y);
  // тень: мягкая, сжимается, когда монстр в воздухе
  const shK = 1 / (1 + lift / 60), sr = size * 0.36 * (K.hover ? 0.75 : 1) * shK * (1 - sq * 0.4);
  if (sr > 1) {
    g.save(); g.scale(1, 0.2); const sh = g.createRadialGradient(0, 0, sr * 0.2, 0, 0, sr);
    sh.addColorStop(0, `rgba(20,40,10,${0.42 * shK})`); sh.addColorStop(1, 'rgba(20,40,10,0)');
    g.fillStyle = sh; g.beginPath(); g.arc(0, 0, sr, 0, Math.PI * 2); g.fill(); g.restore();
  }
  g.translate(0, -lift + (st.bob || 0)); g.scale(size / 100, size / 100);
  const sy = 1 + breathe + s * 0.05 + sq, sx = 1 - breathe * 0.6 - s * 0.025 - sq * 0.55;
  g.rotate(Math.sin(st.t * 1.3 + (st.phase || 0)) * 0.02 + (st.tilt || 0));
  g.scale(sx, sy);
  st.col = K.col; K.draw(g, st);
  g.restore();
}
