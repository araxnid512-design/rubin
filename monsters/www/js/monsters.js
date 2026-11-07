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
// гласная, которую монстр поёт прямо сейчас (её ставит drawMonster): рот складывается в «а», «о», «у», «э», «и»
let MOUTH_V = null;
function mouth(g, x, y, w, open, style = 'smile') {
  g.lineCap = 'round'; g.lineJoin = 'round';
  let wk = 1, hk = 1;
  if (MOUTH_V && open >= 0.08) {
    const v = MOUTH_V;
    if (v === 'o' || v === 'u') { if (style !== 'teeth') style = 'o'; wk = v === 'u' ? 0.75 : 1; hk = v === 'u' ? 0.85 : 1.1; }
    else if (v === 'e' || v === 'i' || v === 'y') { if (style === 'o') style = 'smile'; wk = 1.22; hk = v === 'i' ? 0.55 : 0.7; }
    else if (v === 'a') { if (style === 'o') style = 'smile'; hk = 1.18; }
  }
  if (open < 0.08) {
    g.strokeStyle = '#2a1a22'; g.lineWidth = 2.6; g.beginPath();
    if (style === 'o') g.arc(x, y, w * 0.14, 0, Math.PI * 2); else g.arc(x, y - w * 0.3, w * 0.42, Math.PI * 0.22, Math.PI * 0.78);
    g.stroke(); return;
  }
  const hh = (style === 'o' ? w * 0.75 : w * 0.62) * Math.min(1, open) * hk, ww = (style === 'o' ? w * (0.32 + 0.12 * open) : w * 0.5) * wk;
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
      const TAU = Math.PI * 2, w = 70, h = 112, c = this.col, s = st.sing || 0, hit = st.hit || 0, t = st.t || 0, dn = st.dance || 0, o = shade(c, -0.6);
      const sw = dn * Math.sin(TAU * ((st.beat || 0) - 0.3) / (st.bpb === 3 ? 3 : 2)) + (1 - dn) * 0.5 * Math.sin(t * 1.2);
      const glow = (x, y, r, col, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba(col, a)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };
      const star = (x, y, r, col) => { const e = r * 0.18; g.fillStyle = col; g.beginPath(); g.moveTo(x, y - r); g.quadraticCurveTo(x + e, y - e, x + r, y); g.quadraticCurveTo(x + e, y + e, x, y + r); g.quadraticCurveTo(x - e, y + e, x - r, y); g.quadraticCurveTo(x - e, y - e, x, y - r); g.fill(); };
      // облачко из четырёх клубков с общим контуром
      const cloud = (x, y, k, a) => { const p = new Path2D(); for (const [cx, cy, r] of [[-8, 2, 6], [0, -3, 8], [8, 2, 6.5], [1, 4, 6]]) { p.moveTo(x + (cx + r) * k, y + cy * k); p.arc(x + cx * k, y + cy * k, r * k, 0, TAU); } g.lineWidth = 3.4; g.strokeStyle = rgba('#6a6ac8', a * 0.6); g.stroke(p); g.fillStyle = `rgba(255,255,255,${a})`; g.fill(p); };
      glow(0, -66, 74, '#c8b8ff', 0.22 + s * 0.28);
      // гул расходится волнами
      for (let j = 0; j < 2; j++) { const ph = (t * 0.45 + j / 2) % 1, a = s * (1 - ph) * 0.6; if (a > 0.02) { g.strokeStyle = rgba('#e0d8ff', a); g.lineWidth = 3; g.beginPath(); g.ellipse(0, -66, 38 + ph * 26, 44 + ph * 22, 0, 0, TAU); g.stroke(); } }
      // облака кружат вокруг и дрожат от голоса
      // кольцо наклонено: спереди облака проходят низко, у пояса, сзади — за головой
      const CL = [0, 1, 2].map(i => { const a = t * 0.5 + i * TAU / 3; return [Math.cos(a) * 46 + Math.sin(t * 31 + i) * s * 1.8, -64 + Math.sin(a) * 40 + Math.cos(t * 27 + i) * s * 1.2, 0.82 + Math.sin(a) * 0.14, Math.sin(a) > 0]; });
      for (const [x, y, k, f] of CL) if (!f) cloud(x, y, k, 0.85);
      // аметисты на плече светятся на ноте
      for (const [x, y, a, L, wd] of [[-28, -74, -2.15, 30, 6.5], [-30, -64, -2.65, 24, 5.5], [-24, -84, -1.75, 20, 5]]) {
        g.save(); g.translate(x, y); g.rotate(a); g.lineJoin = 'round';
        const cg = g.createLinearGradient(0, -wd, 0, wd); cg.addColorStop(0, '#f2dcff'); cg.addColorStop(0.5, '#b47aff'); cg.addColorStop(1, '#6a3ac0');
        g.fillStyle = cg; g.strokeStyle = '#3a1a7a'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(0, -wd); g.lineTo(L * 0.78, -wd); g.lineTo(L, 0); g.lineTo(L * 0.78, wd); g.lineTo(0, wd); g.closePath(); g.fill(); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(2, -wd * 0.3); g.lineTo(L * 0.76, -wd * 0.3); g.lineTo(L * 0.95, 0); g.stroke();
        if (s > 0.05) glow(L * 0.85, 0, 9, '#f0d8ff', s * 0.8);
        g.restore();
      }
      feet(g, w, c);
      const body = new Path2D(); SHAPES.gum(body, w, h); body.moveTo(14, -108); body.ellipse(0, -108, 14, 8, 0, 0, TAU);
      silhouette(g, [{ path: g2 => SHAPES.gum(g2, w, h), fill: blobFill(g, c, w, h) }, { path: g2 => g2.ellipse(0, -108, 14, 8, 0, 0, TAU), fill: shade(c, 0.2) }], c, o);
      // снежная шапка горной вершины и слои камня
      g.save(); g.clip(body);
      const snow = new Path2D(); snow.moveTo(-40, -130); snow.lineTo(40, -130); snow.lineTo(40, -103);
      for (let i = 0; i < 6; i++) { const x0 = 40 - i * 80 / 6, x1 = x0 - 80 / 6; snow.quadraticCurveTo((x0 + x1) / 2, i % 2 ? -98 : -96, x1, -103 + (i % 2) * 1.5); }
      snow.closePath(); g.fillStyle = '#f6f8ff'; g.fill(snow); g.strokeStyle = rgba('#7a7ad8', 0.55); g.lineWidth = 2.2; g.stroke(snow);
      g.strokeStyle = rgba('#3a2a8a', 0.22); g.lineWidth = 2; for (const y of [-30, -21, -12]) { g.beginPath(); g.moveTo(-36, y); g.quadraticCurveTo(0, y + 6, 36, y); g.stroke(); }
      g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(-40, -30, 80, 9);
      g.restore();
      star(-6, -110, 2.6 + Math.sin(t * 3) * 1.2, '#ffffff'); star(8, -106, 1.8 + Math.sin(t * 3 + 2) * 0.8, '#e8f0ff');
      shine(g, -16, -88, 4.5, 7);
      // глаза закрывает, когда тянет ноту; третий глаз светится
      const cl = { ...st, blink: Math.max(st.blink || 0, Math.min(1, s * 1.2)) };
      eye(g, -14, -80, 7.5, cl); eye(g, 14, -80, 7.5, cl);
      glow(0, -91, 13, '#ffe8ff', 0.25 + s * 0.6); eye(g, 0, -91, 6, st, { iris: '#7a4ad8', pupil: 0.6 });
      cheeks(g, 0, -69, 20, 4.5);
      mouth(g, 0, -59, 24, 0.25 + s * 0.75, 'o');
      // руки раскрываются на долгом аккорде
      const ra = 1.25 - Math.min(1, s * 1.1) * 1.75 + sw * 0.1;
      for (const k of [-1, 1]) {
        const a = k > 0 ? ra : Math.PI - ra, hx = k * 33 + Math.cos(a) * 19, hy = -36 + Math.sin(a) * 19;
        arm(g, k * 33, -36, a, 19, c, 9);
        g.fillStyle = shade(c, 0.15); g.strokeStyle = o; g.lineWidth = 2.4; g.beginPath(); g.arc(hx, hy, 6, 0, TAU); g.fill(); g.stroke();
      }
      // шарф ветра: вокруг тела и хвост по ветру
      g.save(); g.clip(body);
      g.fillStyle = '#7fd6f2'; g.strokeStyle = '#2a6a8a'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(-40, -45); g.quadraticCurveTo(0, -37, 40, -45); g.lineTo(40, -34); g.quadraticCurveTo(0, -26, -40, -34); g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(-40, -40); g.quadraticCurveTo(0, -32, 40, -40); g.stroke();
      g.restore();
      for (let j = 0; j < 2; j++) {
        const P = []; for (let i = 0; i <= 6; i++) { const u = i / 6; P.push([28 + u * (30 - j * 6), -39 + j * 4 + u * (8 + j * 6) + Math.sin(u * 5 - t * (7 + s * 5) + j) * 3.2 * u + sw * 4 * u]); }
        g.lineCap = 'round'; g.lineJoin = 'round';
        for (const [col, lw] of [['#2a6a8a', 11], ['#7fd6f2', 6.5]]) { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); P.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); }
        g.strokeStyle = '#ffffff'; g.lineWidth = 2; const [ex, ey] = P[5]; g.beginPath(); g.arc(ex, ey, 1.2, 0, TAU); g.stroke();
      }
      g.fillStyle = '#7fd6f2'; g.strokeStyle = '#2a6a8a'; g.lineWidth = 2.4; g.beginPath(); g.ellipse(28, -38, 6, 5, 0.3, 0, TAU); g.fill(); g.stroke();
      for (const [x, y, k, f] of CL) if (f) cloud(x, y, k, 0.92);
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
      const TAU = Math.PI * 2, c = this.col, s = st.sing || 0, hit = st.hit || 0, t = st.t || 0, r = 38, cy = -r, o = shade(c, -0.55);
      const glow = (x, y, R, col, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, R); gr.addColorStop(0, rgba(col, a)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.beginPath(); g.arc(x, y, R, 0, TAU); g.fill(); };
      const star = (x, y, R, col) => { const e = R * 0.18; g.fillStyle = col; g.beginPath(); g.moveTo(x, y - R); g.quadraticCurveTo(x + e, y - e, x + R, y); g.quadraticCurveTo(x + e, y + e, x, y + R); g.quadraticCurveTo(x - e, y + e, x - R, y); g.quadraticCurveTo(x - e, y - e, x, y - R); g.fill(); };
      const note = (x, y, sc, a, col) => { if (a < 0.03) return; g.save(); g.translate(x, y); g.scale(sc, sc); g.globalAlpha *= Math.min(1, a); g.lineCap = 'round'; g.strokeStyle = '#3a2a5a'; g.lineWidth = 4.2; g.beginPath(); g.ellipse(0, 0, 4.6, 3.4, -0.45, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(3.8, -1.2); g.lineTo(3.8, -15); g.quadraticCurveTo(10, -12, 9.5, -6); g.stroke(); g.strokeStyle = col; g.lineWidth = 2; g.stroke(); g.fillStyle = col; g.beginPath(); g.ellipse(0, 0, 4.6, 3.4, -0.45, 0, TAU); g.fill(); g.restore(); };
      const bub = (x, y, R, a) => { if (a < 0.03) return; g.lineWidth = 1.6; g.strokeStyle = rgba('#4a5ac0', a * 0.7); g.fillStyle = rgba('#e8f6ff', a * 0.4); g.beginPath(); g.arc(x, y, R, 0, TAU); g.fill(); g.stroke(); g.fillStyle = `rgba(255,255,255,${a})`; g.beginPath(); g.arc(x - R * 0.35, y - R * 0.35, R * 0.3, 0, TAU); g.fill(); };
      glow(0, cy, 66, '#ffc8f0', 0.24 + s * 0.26); glow(0, cy, 46, '#a8e8ff', 0.2 + s * 0.2);
      // пузырики-спутники
      for (let i = 0; i < 4; i++) { const ph = (t * 0.25 + i / 4) % 1, k = i % 2 ? 1 : -1; bub(k * (46 + Math.sin(ph * 8 + i) * 6), -4 - ph * 90, 2.4 + (i % 3) * 1.2, Math.sin(Math.PI * ph) * 0.9); }
      // усик-пружинка с колокольчиком: звенит на каждой ноте
      const ring = Math.sin(t * 16) * (0.1 + 0.5 * hit + 0.15 * s), bx = 3 + Math.sin(t * 2.2) * 2 + Math.sin(t * 7) * s * 3, by = cy - r - 25 - s * 3;
      g.lineCap = 'round'; for (const [col, lw] of [[o, 4.6], ['#ffe27a', 2]]) { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(0, cy - r + 2); g.bezierCurveTo(10, cy - r - 6, -8, cy - r - 14, bx, by); g.stroke(); }
      g.save(); g.translate(bx, by); g.rotate(ring);
      const bg = g.createLinearGradient(-9, 0, 9, 0); bg.addColorStop(0, '#ffe680'); bg.addColorStop(0.4, '#fff6c0'); bg.addColorStop(1, '#e0a020');
      g.fillStyle = '#c88a10'; g.beginPath(); g.arc(-ring * 10, 11, 3, 0, TAU); g.fill();
      g.fillStyle = bg; g.strokeStyle = '#8a6a10'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(-10, 10); g.quadraticCurveTo(-9, -7, 0, -7); g.quadraticCurveTo(9, -7, 10, 10); g.quadraticCurveTo(0, 13, -10, 10); g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = '#8a6a10'; g.lineWidth = 2; g.beginPath(); g.arc(0, -8.5, 2.6, 0, TAU); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.ellipse(-4, -1, 1.6, 4, 0.2, 0, TAU); g.fill();
      g.restore();
      if (hit > 0.05) { g.strokeStyle = rgba('#ffd040', hit); g.lineWidth = 2; for (const k of [-1, 1]) for (const d of [0, 5]) { g.beginPath(); g.arc(bx, by + 2, 14 + d + (1 - hit) * 4, k > 0 ? -0.5 : Math.PI - 0.5, k > 0 ? 0.5 : Math.PI + 0.5); g.stroke(); } }
      // ручки-пузырьки: на высокой ноте взлетают в стороны
      for (const k of [-1, 1]) { const hx = k * (r + 7 + s * 3), hy = cy + 10 - s * 22 - hit * 3 + Math.sin(t * 3 + k) * 1.5; bub(hx, hy, 6.5, 1); g.fillStyle = rgba('#ff9ad8', 0.35); g.beginPath(); g.arc(hx, hy + 1, 4, 0, TAU); g.fill(); }
      // сам пузырь дрожит от голоса
      const wob = 0.02 + 0.035 * s + 0.03 * hit, sq = 1 + Math.sin(t * 3) * 0.015 + hit * 0.035, N = 28, P = [];
      for (let i = 0; i < N; i++) { const a = i / N * TAU, rr = r * (1 + wob * Math.sin(3 * a + t * 5) + wob * 0.6 * Math.sin(2 * a - t * 3.4)); P.push([Math.cos(a) * rr * sq, cy + Math.sin(a) * rr / sq]); }
      const B = new Path2D(), mid = i => [(P[i % N][0] + P[(i + 1) % N][0]) / 2, (P[i % N][1] + P[(i + 1) % N][1]) / 2];
      B.moveTo(...mid(0)); for (let i = 1; i <= N; i++) B.quadraticCurveTo(P[i % N][0], P[i % N][1], ...mid(i));
      const gr = g.createRadialGradient(-12, cy - 14, 4, 0, cy, r);
      gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(0.35, rgba('#bfe6ff', 0.88)); gr.addColorStop(0.85, rgba('#ff9ad8', 0.62)); gr.addColorStop(1, rgba('#7a8cff', 0.8));
      g.fillStyle = gr; g.fill(B);
      // радужная плёнка переливается
      g.save(); g.clip(B); g.lineCap = 'round';
      ['#ff8ad8', '#ffe27a', '#7ae8ff'].forEach((col, i) => { const a0 = t * 0.6 + i * 2.1; g.strokeStyle = rgba(col, 0.42); g.lineWidth = 6; g.beginPath(); g.arc(0, cy, r * 0.84, a0, a0 + 1.1); g.stroke(); });
      g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.arc(0, cy, r * 0.8, Math.PI * 1.08, Math.PI * 1.4); g.arc(0, cy, r * 0.64, Math.PI * 1.38, Math.PI * 1.1, true); g.closePath(); g.fill();
      g.beginPath(); g.arc(r * 0.5, cy + r * 0.55, 3, 0, TAU); g.fill();
      g.restore();
      g.strokeStyle = o; g.lineWidth = 3.2; g.lineJoin = 'round'; g.stroke(B);
      // бантик у основания усика
      g.save(); g.translate(0, cy - r + 1); g.rotate(Math.sin(t * 2) * 0.08); g.fillStyle = '#ff7ab8'; g.strokeStyle = '#8a2a5a'; g.lineWidth = 1.8;
      for (const k of [-1, 1]) { g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(k * 9, -8, k * 10, 0); g.quadraticCurveTo(k * 9, 7, 0, 0); g.fill(); g.stroke(); }
      g.beginPath(); g.arc(0, 0, 2.6, 0, TAU); g.fill(); g.stroke(); g.restore();
      for (const k of [-1, 1]) {
        eye(g, k * 11, cy + 1, 7.5, st, { iris: '#4a5ad8', lid: 1 });
        if (!(st.blink > 0.5)) { g.strokeStyle = '#2a1a22'; g.lineWidth = 1.6; g.lineCap = 'round'; for (let i = 0; i < 2; i++) { g.beginPath(); g.moveTo(k * (16 + i * 2), cy - 5 + i * 3); g.lineTo(k * (20 + i * 2.5), cy - 8 + i * 3.5); g.stroke(); } }
      }
      cheeks(g, 0, cy + 11, 18, 4.2); mouth(g, 0, cy + 17, 15, s, 'o');
      // ноты улетают вверх, искорки мерцают
      for (let i = 0; i < 2; i++) { const ph = (t * 0.45 + i / 2) % 1, k = i ? 1 : -1; note(k * (24 + ph * 22) + Math.sin(ph * 7) * 3, cy - 18 - ph * 42, 0.8 + ph * 0.25, s * (1 - ph) * Math.min(1, ph * 5) * 1.3, i ? '#ff7ab8' : '#6a8aff'); }
      for (let i = 0; i < 5; i++) { const a = t * 0.6 + i * TAU / 5, tw = (Math.sin(t * 4 + i * 2.3) + 1) / 2; star(Math.cos(a) * 54, cy + Math.sin(a) * 40, 2 + tw * 1.8 + s * 2, rgba(i % 2 ? '#ffffff' : '#ffe27a', 0.35 + 0.3 * tw + 0.35 * s)); }
    },
  },
  kvakusha: {
    name: 'Квакуша', el: ['water', 'leaf'], part: 'frog', rate: 46,
    desc: 'Болотная певица. Раздувает горлышко и выводит «ква-ква» точно в такт.', col: '#46c48e',
    draw(g, st) {
      const TAU = Math.PI * 2, w = 96, h = 72, c = this.col, s = st.sing || 0, hit = st.hit || 0, t = st.t || 0, dn = st.dance || 0, o = shade(c, -0.6);
      const sw = dn * Math.sin(TAU * ((st.beat || 0) - 0.2) / (st.bpb === 3 ? 3 : 2)) + (1 - dn) * 0.5 * Math.sin(t * 1.5);
      const glow = (x, y, r, col, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba(col, a)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };
      const note = (x, y, sc, a, col) => { if (a < 0.03) return; g.save(); g.translate(x, y); g.scale(sc, sc); g.globalAlpha *= Math.min(1, a); g.lineCap = 'round'; g.strokeStyle = '#1f4a2a'; g.lineWidth = 4.2; g.beginPath(); g.ellipse(0, 0, 4.6, 3.4, -0.45, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(3.8, -1.2); g.lineTo(3.8, -15); g.quadraticCurveTo(10, -12, 9.5, -6); g.stroke(); g.strokeStyle = col; g.lineWidth = 2; g.stroke(); g.fillStyle = col; g.beginPath(); g.ellipse(0, 0, 4.6, 3.4, -0.45, 0, TAU); g.fill(); g.restore(); };
      glow(0, -46, 74, '#a8ffc0', 0.18 + s * 0.26);
      // светлячки кружат над болотом
      for (let i = 0; i < 3; i++) { const a = t * 0.7 + i * TAU / 3, x = Math.cos(a) * 56, y = -64 + Math.sin(a * 1.3 + i) * 28, b = (Math.sin(t * 4 + i * 2) + 1) / 2; glow(x, y, 9, '#eaff6a', 0.25 + 0.45 * b); g.fillStyle = '#fbffc8'; g.beginPath(); g.arc(x, y, 1.8 + b, 0, TAU); g.fill(); }
      // лапки с присосками: на громкой ноте взлетают «джазовыми ручками»
      for (const k of [-1, 1]) {
        const a0 = 0.55 - Math.min(1, s * 1.2) * 1.3 + Math.sin(t * 15) * hit * 0.15, a = k > 0 ? a0 : Math.PI - a0, x0 = k * 40, y0 = -32, L = 17, hx = x0 + Math.cos(a) * L, hy = y0 + Math.sin(a) * L;
        arm(g, x0, y0, a, L, c, 9);
        g.fillStyle = shade(c, 0.1); g.strokeStyle = o; g.lineWidth = 2.2;
        for (const d of [-0.65, 0, 0.65]) { const fa = a + d, ex = hx + Math.cos(fa) * 7, ey = hy + Math.sin(fa) * 7; g.beginPath(); g.moveTo(hx, hy); g.lineTo(ex, ey); g.lineWidth = 5.6; g.strokeStyle = o; g.stroke(); g.lineWidth = 2.4; g.strokeStyle = shade(c, 0.1); g.stroke(); g.lineWidth = 2; g.strokeStyle = o; g.beginPath(); g.arc(ex, ey, 2.7, 0, TAU); g.fill(); g.stroke(); }
        g.beginPath(); g.arc(hx, hy, 4.2, 0, TAU); g.fill();
      }
      // перепончатые ступни
      for (const k of [-1, 1]) { g.fillStyle = shade(c, -0.12); g.strokeStyle = o; g.lineWidth = 2.4; g.lineJoin = 'round'; g.beginPath(); g.moveTo(k * 16, -7); g.lineTo(k * 12, 0); g.quadraticCurveTo(k * 18, -3, k * 24, 1); g.quadraticCurveTo(k * 29, -3, k * 35, 0); g.lineTo(k * 30, -8); g.closePath(); g.fill(); g.stroke(); g.fillStyle = shade(c, 0.15); for (const x of [12, 24, 35]) { g.beginPath(); g.arc(k * x, -0.5, 2.6, 0, TAU); g.fill(); g.stroke(); } }
      const bumps = [-1, 1].map(k => ({ path: g2 => g2.arc(k * 22, -66, 16, 0, TAU), fill: shade(c, 0.12) }));
      const body = new Path2D(); SHAPES.gum(body, w, h);
      silhouette(g, [...bumps, { path: g2 => SHAPES.gum(g2, w, h), fill: blobFill(g, c, w, h) }], c, o);
      // пятнышки на спине и светлое пузо
      g.save(); g.clip(body);
      g.fillStyle = shade(c, -0.18); for (const [x, y, rx, ry] of [[-38, -48, 6, 4], [38, -42, 5, 3.5], [-30, -60, 3.5, 2.5], [42, -58, 3, 2], [-43, -28, 4, 3], [34, -22, 3, 2.2]]) { g.beginPath(); g.ellipse(x, y, rx, ry, 0.3, 0, TAU); g.fill(); }
      g.fillStyle = 'rgba(255,255,200,.3)'; g.beginPath(); g.ellipse(0, -10, 34, 20, 0, 0, TAU); g.fill();
      g.restore();
      shine(g, -34, -56, 4, 7);
      // кувшинка-шляпка с лотосом и капелькой
      g.save(); g.translate(2, -84); g.rotate(-0.08 + sw * 0.07 - hit * 0.05);
      const pad = g.createLinearGradient(0, -7, 0, 7); pad.addColorStop(0, '#6cc85a'); pad.addColorStop(1, '#2f8a34');
      g.fillStyle = pad; g.strokeStyle = '#1f5a1f'; g.lineWidth = 2.4; g.beginPath(); g.ellipse(0, 0, 25, 7.5, 0, 0.3, TAU - 0.05); g.lineTo(0, 0); g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(20,70,20,.45)'; g.lineWidth = 1.3; for (const a of [0.9, 1.7, 2.5, 3.3, 4.1, 4.9, 5.7]) { g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 21, Math.sin(a) * 6); g.stroke(); }
      g.fillStyle = 'rgba(200,240,255,.9)'; g.strokeStyle = '#3a7aa0'; g.lineWidth = 1.2; g.beginPath(); g.arc(-15, 1, 2.6, 0, TAU); g.fill(); g.stroke(); g.fillStyle = '#fff'; g.beginPath(); g.arc(-15.8, 0.2, 0.9, 0, TAU); g.fill();
      g.translate(5, -4); g.scale(1 + hit * 0.08, 1 + hit * 0.08); g.lineJoin = 'round';
      for (const [n, R, rw, col, a0] of [[6, 10, 4.2, '#ff8ac8', 0], [5, 7, 3.4, '#ffc6e4', 0.6]]) for (let i = 0; i < n; i++) { const a = a0 - Math.PI / 2 + (i - (n - 1) / 2) * 0.48; g.save(); g.rotate(a + Math.PI / 2); g.fillStyle = col; g.strokeStyle = '#a03a6a'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(rw, -R * 0.55, 0, -R); g.quadraticCurveTo(-rw, -R * 0.55, 0, 0); g.fill(); g.stroke(); g.restore(); }
      g.fillStyle = '#ffd23a'; g.beginPath(); g.arc(0, -1, 2.2, 0, TAU); g.fill();
      g.restore();
      // горловой мешок раздувается на ноте
      const sac = 5 + s * 11 + hit * s * 3, sg = g.createRadialGradient(-sac * 0.4, -19 - sac * 0.4, 1, 0, -19, sac * 1.4); sg.addColorStop(0, '#fffdf0'); sg.addColorStop(0.6, '#fff0b0'); sg.addColorStop(1, '#f0c870');
      g.fillStyle = sg; g.strokeStyle = o; g.lineWidth = 2.4; g.beginPath(); g.ellipse(0, -19, sac * 1.45, sac, 0, 0, TAU); g.fill(); g.stroke();
      if (sac > 9) { g.strokeStyle = 'rgba(190,130,40,.4)'; g.lineWidth = 1.4; for (const d of [-0.45, 0.45]) { g.beginPath(); g.ellipse(0, -19, sac * 1.45 * Math.abs(d) * 1.4, sac * 0.8, 0, d > 0 ? -1 : Math.PI - 1, d > 0 ? 1 : Math.PI + 1); g.stroke(); } }
      g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.ellipse(-sac * 0.6, -19 - sac * 0.45, sac * 0.35, sac * 0.18, -0.4, 0, TAU); g.fill();
      eye(g, -22, -67, 10, st, { iris: '#e8b020', lid: 1 }); eye(g, 22, -67, 10, st, { iris: '#e8b020', lid: 1 });
      mouth(g, 0, -42, 40, s * 0.75); cheeks(g, 0, -46, 34, 6);
      g.fillStyle = shade(c, -0.45); for (const k of [-1, 1]) { g.beginPath(); g.ellipse(k * 4.5, -51, 1.6, 1.1, 0, 0, TAU); g.fill(); }
      // «ква!» — ноты выпрыгивают на каждой ноте
      for (let i = 0; i < 2; i++) { const ph = (t * 0.5 + i / 2) % 1, k = i ? 1 : -1; note(k * (30 + ph * 20), -76 - ph * 34, 0.75 + ph * 0.25, s * (1 - ph) * Math.min(1, ph * 5) * 1.3, i ? '#ffd23a' : '#ff8ac8'); }
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
      const TAU = Math.PI * 2, w = 72, h = 104, c = this.col, s = st.sing || 0, hit = st.hit || 0, t = st.t || 0, dn = st.dance || 0, o = shade(c, -0.6);
      const sw = dn * Math.sin(TAU * ((st.beat || 0) - 0.25) / (st.bpb === 3 ? 3 : 2)) + (1 - dn) * 0.5 * Math.sin(t * 1.6);
      const op = Math.max(0, Math.min(1, (s - 0.3) / 0.55));
      const glow = (x, y, r, col, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba(col, a)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };
      const star = (x, y, r, col) => { const e = r * 0.18; g.fillStyle = col; g.beginPath(); g.moveTo(x, y - r); g.quadraticCurveTo(x + e, y - e, x + r, y); g.quadraticCurveTo(x + e, y + e, x, y + r); g.quadraticCurveTo(x - e, y + e, x - r, y); g.quadraticCurveTo(x - e, y - e, x, y - r); g.fill(); };
      const note = (x, y, sc, a, col) => { if (a < 0.03) return; g.save(); g.translate(x, y); g.scale(sc, sc); g.globalAlpha *= Math.min(1, a); g.lineCap = 'round'; g.strokeStyle = '#6a1a4a'; g.lineWidth = 4.2; g.beginPath(); g.ellipse(0, 0, 4.6, 3.4, -0.45, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(3.8, -1.2); g.lineTo(3.8, -15); g.quadraticCurveTo(10, -12, 9.5, -6); g.stroke(); g.strokeStyle = col; g.lineWidth = 2; g.stroke(); g.fillStyle = col; g.beginPath(); g.ellipse(0, 0, 4.6, 3.4, -0.45, 0, TAU); g.fill(); g.restore(); };
      const petal = (x, y, a, pc, al) => { if (al < 0.03) return; g.save(); g.translate(x, y); g.rotate(a); g.globalAlpha *= al; g.fillStyle = pc; g.strokeStyle = '#b04a80'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(0, -5.5); g.quadraticCurveTo(5, 0, 0, 5.5); g.quadraticCurveTo(-5, 0, 0, -5.5); g.fill(); g.stroke(); g.restore(); };
      glow(0, -60, 72, '#ffb0e0', 0.22 + s * 0.28);
      // лепестки летят по ветру
      for (let i = 0; i < 4; i++) { const ph = (t * 0.16 + i / 4) % 1; petal(-60 + ph * 120, -104 + i * 24 + Math.sin(ph * 9 + i) * 7, t * 2 + i * 1.7, i % 2 ? '#ffd6ec' : '#ffffff', Math.sin(Math.PI * ph)); }
      feet(g, w, c);
      const body = new Path2D(); SHAPES.pear(body, w, h);
      silhouette(g, [{ path: g2 => SHAPES.pear(g2, w, h), fill: blobFill(g, c, w, h) }], c, o);
      shine(g, -12, -84, 5, 9);
      // юбочка из лепестков и листьев качается в такт
      const SK = []; for (let i = 0; i < 7; i++) { const u = i / 6 - 0.5; SK.push([u * 52, u * 76 + sw * 2.5 + Math.sin(t * 3 + i) * 0.8, -4 + Math.abs(u) * 7]); }
      g.lineJoin = 'round';
      for (let i = 0; i < 6; i++) { const bx = (SK[i][0] + SK[i + 1][0]) / 2, tx = (SK[i][1] + SK[i + 1][1]) / 2 * 1.05, ty = (SK[i][2] + SK[i + 1][2]) / 2 + 3; g.fillStyle = i % 2 ? '#5cc040' : '#4aa834'; g.strokeStyle = '#1f5a14'; g.lineWidth = 2; g.beginPath(); g.moveTo(bx - 5, -24); g.quadraticCurveTo(tx - 6, (ty - 24) / 2 - 6, tx, ty); g.quadraticCurveTo(tx + 6, (ty - 24) / 2 - 6, bx + 5, -24); g.closePath(); g.fill(); g.stroke(); }
      SK.forEach(([bx, tx, ty], i) => { const pg = g.createLinearGradient(0, -28, 0, ty); pg.addColorStop(0, i % 2 ? '#ffc0e0' : '#ffe8f4'); pg.addColorStop(1, i % 2 ? '#ff8fc6' : '#ffc6e2'); g.fillStyle = pg; g.strokeStyle = shade(c, -0.55); g.lineWidth = 2.2; g.beginPath(); g.moveTo(bx - 7, -28); g.quadraticCurveTo(tx - 10, (ty - 28) / 2 - 2, tx, ty); g.quadraticCurveTo(tx + 10, (ty - 28) / 2 - 2, bx + 7, -28); g.closePath(); g.fill(); g.stroke(); });
      g.save(); g.clip(body); g.fillStyle = '#6cc84a'; g.strokeStyle = '#2f6a1f'; g.lineWidth = 2; g.beginPath(); g.roundRect(-40, -33, 80, 6.5, 3); g.fill(); g.stroke(); g.restore();
      g.fillStyle = '#ffffff'; g.strokeStyle = '#2f6a1f'; g.lineWidth = 1.4; for (const x of [-16, 0, 16]) { g.beginPath(); g.arc(x, -29.8, 1.9, 0, TAU); g.fill(); g.stroke(); }
      // большой цветок на голове: качается в такт, вздрагивает на ноте
      g.save(); g.translate(14, -99); g.rotate(sw * 0.12 + Math.sin(t * 2) * 0.05); const fs = 1 + hit * 0.08; g.scale(fs, fs);
      leafShape(g, -6, 8, 15, 2.5, '#5cc040'); leafShape(g, 6, 9, 12, 1.0, '#6cd04a');
      for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + Math.sin(t * 3) * 0.04; g.fillStyle = '#fff6c8'; g.strokeStyle = '#c0703a'; g.lineWidth = 1.8; g.beginPath(); g.ellipse(Math.cos(a) * 11, Math.sin(a) * 11, 8.5, 5.2, a, 0, TAU); g.fill(); g.stroke(); }
      for (let i = 0; i < 7; i++) { const a = (i + 0.5) / 7 * TAU; g.fillStyle = '#ffd84a'; g.strokeStyle = '#c0703a'; g.lineWidth = 1.4; g.beginPath(); g.ellipse(Math.cos(a) * 6, Math.sin(a) * 6, 5, 3.2, a, 0, TAU); g.fill(); g.stroke(); }
      g.fillStyle = '#ff9a2a'; g.strokeStyle = '#a0502a'; g.lineWidth = 1.8; g.beginPath(); g.arc(0, 0, 5, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = '#b05a10'; for (const [x, y] of [[-1.8, -1.5], [1.8, -1], [0, 1.8]]) { g.beginPath(); g.arc(x, y, 0.9, 0, TAU); g.fill(); }
      g.restore();
      for (const k of [-1, 1]) { eye(g, k * 12, -67, 8.5, st, { iris: '#6a2a8a', happy: true }); if (!(st.blink > 0.5) && !(s > 0.55)) { g.strokeStyle = '#2a1a22'; g.lineWidth = 2; g.lineCap = 'round'; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(k * 12 + k * (3 + i * 3), -75); g.lineTo(k * 12 + k * (6 + i * 4), -81 + i); g.stroke(); } } }
      cheeks(g, 0, -55, 21, 5.5); mouth(g, 0, -49, 18, s, 'o');
      // левая ладонь у сердца, правая на громкой ноте раскрывается в сторону
      const hand = (x0, y0, x1, y1) => { arm(g, x0, y0, Math.atan2(y1 - y0, x1 - x0), Math.hypot(x1 - x0, y1 - y0), c, 8); g.fillStyle = shade(c, 0.2); g.strokeStyle = o; g.lineWidth = 2.2; g.beginPath(); g.arc(x1, y1, 5.5, 0, TAU); g.fill(); g.stroke(); };
      hand(-27, -42, -14 + sw * 0.6, -34 + hit * 1.2);
      hand(27, -42, 6 + 42 * op + hit * 2 * op, -36 - 26 * op - hit * 3 * op);
      for (let i = 0; i < 2; i++) { const ph = (t * 0.45 + i / 2) % 1, k = i ? 1 : -1; note(k * (26 + ph * 24), -84 - ph * 36, 0.8 + ph * 0.25, s * (1 - ph) * Math.min(1, ph * 5) * 1.3, i ? '#ff6ab0' : '#b07aff'); }
      for (let i = 0; i < 4; i++) { const a = -t * 0.55 + i * TAU / 4, tw = (Math.sin(t * 4 + i * 2) + 1) / 2; star(Math.cos(a) * 52, -58 + Math.sin(a) * 42, 2 + tw * 2 + s * 1.8, rgba(i % 2 ? '#ffffff' : '#fff2a0', 0.3 + 0.35 * tw + 0.3 * s)); }
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
      const TAU = Math.PI * 2, w = 96, h = 112, c = this.col, s = st.sing || 0, hit = st.hit || 0, t = st.t || 0, dn = st.dance || 0, o = shade(c, -0.6);
      const sw = dn * Math.sin(TAU * ((st.beat || 0) - 0.3) / (st.bpb === 3 ? 3 : 2)) + (1 - dn) * 0.5 * Math.sin(t * 1.3);
      // op — кульминация: на громкой ноте руки распахиваются; vib — дрожь оперного вибрато
      const op = Math.max(0, Math.min(1, (s - 0.4) / 0.5)), vib = Math.sin(t * 34) * s;
      const glow = (x, y, r, col, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba(col, a)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };
      const star = (x, y, r, col) => { const e = r * 0.18; g.fillStyle = col; g.beginPath(); g.moveTo(x, y - r); g.quadraticCurveTo(x + e, y - e, x + r, y); g.quadraticCurveTo(x + e, y + e, x, y + r); g.quadraticCurveTo(x - e, y + e, x - r, y); g.quadraticCurveTo(x - e, y - e, x, y - r); g.fill(); };
      const note = (x, y, sc, a, col) => { if (a < 0.03) return; g.save(); g.translate(x, y); g.scale(sc, sc); g.globalAlpha *= Math.min(1, a); g.lineCap = 'round'; g.strokeStyle = '#5a1a0a'; g.lineWidth = 4.2; g.beginPath(); g.ellipse(0, 0, 4.6, 3.4, -0.45, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(3.8, -1.2); g.lineTo(3.8, -15); g.quadraticCurveTo(10, -12, 9.5, -6); g.stroke(); g.strokeStyle = col; g.lineWidth = 2; g.stroke(); g.fillStyle = col; g.beginPath(); g.ellipse(0, 0, 4.6, 3.4, -0.45, 0, TAU); g.fill(); g.restore(); };
      glow(0, -66, 78, '#ffd86a', 0.2 + s * 0.3);
      // световое пятно сцены под ногами
      g.save(); g.scale(1, 0.16); glow(0, 0, 64, '#fff6c0', 0.4 + 0.3 * s); g.restore();
      // бархатный плащ с золотой каймой: подол волнуется в такт, на кульминации раскрывается
      const cw = 50 + op * 9, cx = -sw * 3, cape = new Path2D();
      cape.moveTo(-30, -86); cape.quadraticCurveTo(-56 - op * 6, -44, cx - cw, -1);
      for (let i = 0; i < 4; i++) { const x0 = cx - cw + i * cw / 2, x1 = x0 + cw / 2; cape.quadraticCurveTo((x0 + x1) / 2, -1 + (i % 2 ? 4 : -4) * (0.6 + Math.abs(sw) * 0.5), x1, -1); }
      cape.quadraticCurveTo(56 + op * 6, -44, 30, -86); cape.closePath();
      const cg = g.createLinearGradient(-cw, 0, cw, 0); cg.addColorStop(0, '#6a0818'); cg.addColorStop(0.22, '#d42a44'); cg.addColorStop(0.5, '#9a1028'); cg.addColorStop(0.78, '#d42a44'); cg.addColorStop(1, '#6a0818');
      g.lineJoin = 'round'; g.strokeStyle = '#4a0612'; g.lineWidth = 7.5; g.stroke(cape); g.fillStyle = cg; g.fill(cape);
      g.strokeStyle = '#ffd04a'; g.lineWidth = 2.8; g.stroke(cape);
      g.save(); g.clip(cape); g.strokeStyle = 'rgba(60,0,15,.35)'; g.lineWidth = 2.4; for (const k of [-1, 1]) { g.beginPath(); g.moveTo(k * 40, -62); g.quadraticCurveTo(k * 46, -30, k * (44 + op * 4) + cx, -4); g.stroke(); } g.restore();
      // горностаевый воротник
      const col = new Path2D(); for (const k of [-1, 1]) for (const [x, y] of [[24, -84], [32, -82], [40, -78]]) { col.moveTo(k * x + 8, y); col.arc(k * x, y, 8, 0, TAU); }
      g.strokeStyle = '#7a7890'; g.lineWidth = 4.4; g.stroke(col); g.fillStyle = '#ffffff'; g.fill(col);
      g.fillStyle = '#2a2230'; for (const k of [-1, 1]) for (const [x, y] of [[38, -77], [30, -84]]) { g.beginPath(); g.ellipse(k * x, y, 1.4, 2.6, 0, 0, TAU); g.fill(); }
      feet(g, w, c);
      silhouette(g, [{ path: g2 => SHAPES.pear(g2, w, h), fill: blobFill(g, c, w, h) }], c, o);
      shine(g, -18, -88, 6, 11);
      // корона с жемчугом и камнями
      g.save(); g.translate(0, -106); g.rotate(-0.06 + sw * 0.04 + hit * 0.05);
      const kg = g.createLinearGradient(0, -24, 0, 2); kg.addColorStop(0, '#fff6b0'); kg.addColorStop(1, '#e8a820');
      g.fillStyle = kg; g.strokeStyle = '#8a6a10'; g.lineWidth = 2.4; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(-19, 0); g.lineTo(-21, -17); g.lineTo(-10, -8); g.lineTo(0, -22); g.lineTo(10, -8); g.lineTo(21, -17); g.lineTo(19, 0); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.roundRect(-20, -5, 40, 7.5, 3); g.fill(); g.stroke();
      for (const [x, y] of [[-21, -17], [0, -22], [21, -17]]) { g.fillStyle = '#fffaf0'; g.strokeStyle = '#8a6a10'; g.lineWidth = 1.6; g.beginPath(); g.arc(x, y - 1.8, 2.6, 0, TAU); g.fill(); g.stroke(); }
      for (const [x, gc, r] of [[-11, '#3a8aff', 2.2], [0, '#ff2a5a', 3], [11, '#3a8aff', 2.2]]) { g.fillStyle = gc; g.strokeStyle = '#5a3a08'; g.lineWidth = 1.2; g.beginPath(); g.arc(x, -1.3, r, 0, TAU); g.fill(); g.stroke(); g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.arc(x - r * 0.35, -1.3 - r * 0.35, r * 0.35, 0, TAU); g.fill(); }
      const tw = (Math.sin(t * 3) + 1) / 2; star(-13, -10, 2 + tw * 2.5 + hit * 1.5, rgba('#ffffff', 0.5 + 0.5 * tw));
      g.restore();
      eye(g, -14, -78, 8.5, st, { happy: true }); eye(g, 14, -78, 8.5, st, { happy: true });
      g.strokeStyle = '#5a3a1a'; g.lineWidth = 3.2; g.lineCap = 'round'; for (const k of [-1, 1]) { g.beginPath(); g.moveTo(k * 7, -88 - s * 3); g.quadraticCurveTo(k * 15, -94 - s * 4 - hit * 1.5, k * 23, -89 - s * 2); g.stroke(); }
      cheeks(g, 0, -66, 26, 5.5);
      mouth(g, 0, -50, 28, 0.15 + s * 0.85, 'o');
      // закрученные усы дрожат на вибрато
      for (const k of [-1, 1]) {
        const ty = -63 + vib * 1.2 - hit * 2;
        g.fillStyle = '#5a3a1a'; g.strokeStyle = '#2a1a0a'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -64.5); g.bezierCurveTo(k * 8, -71, k * 20, -70, k * 27, ty); g.bezierCurveTo(k * 33, ty - 4, k * 30, ty - 10, k * 25, ty - 7.5); g.bezierCurveTo(k * 27, ty - 3, k * 24, ty + 1, k * 19, -61.5); g.quadraticCurveTo(k * 10, -59.5, 0, -59); g.closePath(); g.fill(); g.stroke();
        g.strokeStyle = 'rgba(255,220,170,.45)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(k * 5, -65.5); g.quadraticCurveTo(k * 14, -69, k * 22, -66); g.stroke();
      }
      // кружевное жабо с рубиновой брошью
      g.save(); g.translate(0, -27); g.rotate(sw * 0.05);
      for (let i = 2; i >= 0; i--) { const y = i * 6, hw = 11 - i * 1.5; g.fillStyle = i % 2 ? '#f2eefa' : '#ffffff'; g.strokeStyle = '#9a90b0'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-hw, y); for (let j = 0; j < 3; j++) { const x0 = -hw + j * hw * 2 / 3, x1 = x0 + hw * 2 / 3; g.quadraticCurveTo((x0 + x1) / 2, y + 8, x1, y); } g.quadraticCurveTo(0, y - 6, -hw, y); g.fill(); g.stroke(); }
      g.fillStyle = '#ffd04a'; g.strokeStyle = '#8a6a10'; g.lineWidth = 1.6; g.beginPath(); g.arc(0, -2, 4.4, 0, TAU); g.fill(); g.stroke(); g.fillStyle = '#e8204a'; g.beginPath(); g.arc(0, -2, 2.6, 0, TAU); g.fill();
      g.restore();
      // левая рука прижата к сердцу, на кульминации обе руки распахиваются
      const hand = (x0, y0, x1, y1) => {
        arm(g, x0, y0, Math.atan2(y1 - y0, x1 - x0), Math.hypot(x1 - x0, y1 - y0), c, 10);
        g.fillStyle = '#ffffff'; g.strokeStyle = '#7a7890'; g.lineWidth = 2.4; g.beginPath(); g.arc(x1, y1, 7, 0, TAU); g.fill(); g.stroke();
        g.strokeStyle = '#ffd04a'; g.lineWidth = 2.6; g.beginPath(); g.arc(x1, y1, 7.2, Math.atan2(y0 - y1, x0 - x1) - 0.7, Math.atan2(y0 - y1, x0 - x1) + 0.7); g.stroke();
      };
      // руки идут по дуге: левая от сердца вниз-наружу и вверх, правая от бедра вверх
      const e = Math.min(1, s * 0.6 + op * 0.5), la = 0.61 + 3.4 * op, ra = 1.11 - 1.98 * e, ll = 28 + 6 * op - 11 * Math.sin(Math.PI * op), rl = 31 + 3 * e - 9 * Math.sin(Math.PI * e);
      hand(-36, -54, -36 + Math.cos(la) * ll + vib * 0.8, -54 + Math.sin(la) * ll);
      hand(36, -54, 36 + Math.cos(ra) * rl + vib * 0.8, -54 + Math.sin(ra) * rl);
      // ноты и блёстки
      for (let i = 0; i < 2; i++) { const ph = (t * 0.4 + i / 2) % 1, k = i ? 1 : -1; note(k * (28 + ph * 22), -92 - ph * 34, 0.8 + ph * 0.3, s * (1 - ph) * Math.min(1, ph * 5) * 1.3, i ? '#ffd04a' : '#ff5a7a'); }
      for (let i = 0; i < 4; i++) { const a = t * 0.5 + i * TAU / 4, tw2 = (Math.sin(t * 4 + i * 2) + 1) / 2; star(Math.cos(a) * 58, -60 + Math.sin(a) * 44, 2 + tw2 * 2 + s * 2, rgba(i % 2 ? '#ffffff' : '#ffe680', 0.3 + 0.35 * tw2 + 0.3 * s)); }
    },
  },
  // ---------- новые элитные певцы
  bubun: {
    name: 'Бубун', el: ['stone', 'water'], part: 'bassvox', rate: 46,
    desc: 'Подводный валун с бородой из водорослей. Поёт басом «дум-дум» вместе с басовой линией.', col: '#5f7fa6',
    draw(g, st) {
      const TAU = Math.PI * 2, w = 108, h = 84, c = this.col, s = st.sing || 0, hit = st.hit || 0, t = st.t || 0, dn = st.dance || 0, o = shade(c, -0.6);
      // качание в такт (с запаздыванием — борода догоняет тело)
      const sw = dn * Math.sin(TAU * ((st.beat || 0) - 0.25) / (st.bpb === 3 ? 3 : 2)) + (1 - dn) * 0.5 * Math.sin(t * 1.4);
      const glow = (x, y, r, col, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba(col, a)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };
      const bub = (x, y, r, a) => { if (a < 0.03) return; g.lineWidth = Math.max(1.2, r * 0.3); g.strokeStyle = `rgba(30,80,140,${a * 0.75})`; g.fillStyle = `rgba(210,245,255,${a * 0.45})`; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.stroke(); g.fillStyle = `rgba(255,255,255,${a})`; g.beginPath(); g.arc(x - r * 0.35, y - r * 0.35, r * 0.32, 0, TAU); g.fill(); };
      const hand = (x, y, a, L) => { arm(g, x, y, a, L, c, 11); const hx = x + Math.cos(a) * L, hy = y + Math.sin(a) * L; g.fillStyle = shade(c, 0.1); g.strokeStyle = o; g.lineWidth = 2.6; g.beginPath(); g.arc(hx, hy, 7.5, 0, TAU); g.fill(); g.stroke(); g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(hx - 2.5, hy - 2.5, 2.4, 0, TAU); g.fill(); };
      glow(0, -52, 76, '#7fd8ff', 0.2 + s * 0.25);
      // на каждое «дум» по воде расходятся круги
      if (hit > 0.02 && s > 0.1) for (const k of [1, 0.7]) { const R = 46 + (1 - hit * k) * 20; g.strokeStyle = `rgba(215,248,255,${hit * k * 0.85})`; g.lineWidth = 2.8; g.beginPath(); g.ellipse(0, -1, R, R * 0.15, 0, 0, TAU); g.stroke(); }
      for (let i = 0; i < 4; i++) { const ph = (t * 0.3 + i / 4) % 1, k = i % 2 ? 1 : -1; bub(k * (50 + Math.sin(ph * 9 + i) * 5), -12 - ph * 96, 2.2 + (i % 3), (1 - ph) * Math.min(1, ph * 6) * 0.8); }
      // коралл позади камней
      const cs = sw * 2, CR = [[14, -86, 13, -98, 12 + cs, -112], [13.5, -95, 5, -98, 2 + cs, -106], [14, -99, 22, -100, 25 + cs, -109], [12.8, -104, 8, -108, 6 + cs, -114], [21, -101, 24, -104, 30 + cs, -101]];
      g.lineCap = 'round'; for (const [col, lw] of [['#8a2a4a', 7.5], ['#ff7aa8', 4]]) { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); for (const [x0, y0, x1, y1, x2, y2] of CR) { g.moveTo(x0, y0); g.quadraticCurveTo(x1, y1, x2, y2); } g.stroke(); }
      g.fillStyle = '#ffb0cc'; for (const [, , , , x2, y2] of CR) { g.beginPath(); g.arc(x2, y2, 2, 0, TAU); g.fill(); }
      feet(g, w, c);
      const rocks = [[-26, -80, 14], [4, -86, 12], [28, -76, 10]];
      silhouette(g, [...rocks.map(([x, y, r]) => ({ path: g2 => g2.ellipse(x, y, r * 1.3, r, 0, 0, TAU), fill: '#9aa6b2' })), { path: g2 => SHAPES.gum(g2, w, h), fill: blobFill(g, c, w, h) }], c, o);
      // камни: блики, крапинки, ракушки и морская звезда
      for (const [x, y, r] of rocks) { g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.ellipse(x - r * 0.45, y - r * 0.4, r * 0.45, r * 0.24, -0.4, 0, TAU); g.fill(); }
      g.fillStyle = 'rgba(20,30,60,.2)'; for (const [x, y, r] of [[-38, -34, 2.4], [36, -52, 2], [-42, -58, 1.8], [40, -24, 2.2], [-30, -14, 1.6], [32, -36, 1.4]]) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
      for (const [x, y] of [[-34, -85], [-21, -89]]) { g.fillStyle = '#ece6d4'; g.strokeStyle = '#5a5a6a'; g.lineWidth = 1.4; g.beginPath(); g.arc(x, y, 3, 0, TAU); g.fill(); g.stroke(); g.fillStyle = '#5a5a6a'; g.beginPath(); g.arc(x, y, 1, 0, TAU); g.fill(); }
      g.save(); g.translate(29, -80); g.rotate(0.4 + Math.sin(t * 1.3) * 0.1 + hit * 0.15); g.fillStyle = '#ff9a4a'; g.strokeStyle = '#8a3a10'; g.lineWidth = 1.8; g.lineJoin = 'round'; g.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 3 : 7.5; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); g.stroke(); g.restore();
      shine(g, -32, -60, 6, 10);
      eye(g, -20, -58, 8.5, st, { lid: 1, iris: '#2a5a8a' }); eye(g, 20, -58, 8.5, st, { lid: 1, iris: '#2a5a8a' });
      // густые брови: на басовой ноте поднимаются домиком
      g.fillStyle = '#3a4656'; g.strokeStyle = '#1a2230'; g.lineWidth = 1.6; for (const k of [-1, 1]) { g.save(); g.translate(k * 20, -72 - s * 3.5 - hit * 2); g.rotate(k * (0.12 + 0.18 * s)); g.beginPath(); g.ellipse(0, 0, 11, 4, 0, 0, TAU); g.fill(); g.stroke(); g.restore(); }
      cheeks(g, 0, -47, 33, 6);
      // борода из водорослей: качается в такт, на открытом рту опускается
      const chin = -25 + s * 5, S = [];
      for (let i = -3; i <= 3; i++) { const dx = sw * 5 + Math.sin(t * 2.4 + i * 1.3) * 2.2; S.push([i * 6.5, chin + Math.abs(i) * 1.2, i * 8.5 + dx * 0.5, -11, i * 8 + dx, -1 - Math.abs(i) * 2]); }
      g.lineCap = 'round';
      for (const [col, lw] of [['#163c24', 8.5], [null, 4.8]]) S.forEach(([x0, y0, x1, y1, x2, y2], i) => { g.strokeStyle = col || (i % 2 ? '#4fb06a' : '#36904e'); g.lineWidth = lw; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x1, y1, x2, y2); g.stroke(); });
      S.forEach(([, , x1, y1, x2, y2], i) => { if (i % 2) return; g.fillStyle = '#5cc070'; g.strokeStyle = '#163c24'; g.lineWidth = 1.6; g.beginPath(); g.ellipse((x1 + x2) / 2 + (i < 3 ? -3.5 : 3.5), (y1 + y2) / 2 - 2, 4.2, 2.2, i < 3 ? 0.6 : -0.6, 0, TAU); g.fill(); g.stroke(); });
      mouth(g, 0, -38, 30, 0.12 + s * 0.88, 'o');
      // левая рука похлопывает по пузу на каждую ноту, правая раскрывается на громкой ноте
      const px = -32, py = -21 + hit * 3.5;
      hand(-45, -38, Math.atan2(py + 38, px + 45), Math.hypot(px + 45, py + 38));
      hand(42, -40, 0.55 - s * 1.2 - hit * 0.15 + sw * 0.08, 19);
      // пузырьки изо рта
      for (let i = 0; i < 3; i++) { const ph = (t * 0.9 + i / 3) % 1; bub(16 + ph * 44, -34 - ph * 40 - ph * ph * 26, 1.6 + ph * 3.2, s * (1 - ph) * Math.min(1, ph * 8)); }
    },
  },
  tyc: {
    name: 'Тыц', el: ['stone', 'leaf'], part: 'beatbox', rate: 46,
    desc: 'Уличный битбоксер в наушниках из ракушек. Делает ртом бочку, тарелки и малый барабан.', col: '#7d9a52',
    draw(g, st) {
      const TAU = Math.PI * 2, w = 82, h = 88, c = this.col, s = st.sing || 0, hit = st.hit || 0, bt = st.beat || 0, t = st.t || 0, dn = st.dance || 0, o = shade(c, -0.6);
      const glow = (x, y, r, col, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba(col, a)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };
      const fist = (x, y, r) => { g.fillStyle = shade(c, 0.1); g.strokeStyle = o; g.lineWidth = 2.4; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.stroke(); g.strokeStyle = rgba('#1f3a10', 0.5); g.lineWidth = 1.3; g.beginPath(); g.moveTo(x - r * 0.5, y - r * 0.2); g.lineTo(x + r * 0.5, y - r * 0.2); g.stroke(); };
      const tap = dn * Math.max(0, -Math.sin(TAU * bt)); // носок кроссовка отбивает восьмые
      glow(0, -50, 72, '#c8ff6a', 0.16 + s * 0.24);
      // кроссовки
      for (const k of [-1, 1]) {
        const lift = k > 0 ? tap * 4 : 0; g.save(); g.translate(k * 20, -4 - lift); g.rotate(k > 0 ? -tap * 0.18 : 0);
        g.fillStyle = '#ffffff'; g.strokeStyle = '#2a2a34'; g.lineWidth = 2.4; g.beginPath(); g.ellipse(k * 2, 0, 15, 7.5, 0, 0, TAU); g.fill(); g.stroke();
        g.fillStyle = '#4fae32'; g.beginPath(); g.moveTo(k * -8, 1); g.quadraticCurveTo(k * 2, 4, k * 12, -3); g.quadraticCurveTo(k * 4, 0, k * -8, -2); g.closePath(); g.fill();
        g.strokeStyle = '#9aa0ae'; g.lineWidth = 2; g.beginPath(); g.moveTo(k * -11, 4.5); g.quadraticCurveTo(k * 2, 8, k * 15, 3); g.stroke();
        g.restore();
      }
      silhouette(g, [{ path: g2 => SHAPES.box(g2, w, h), fill: blobFill(g, c, w, h) }], c, o);
      // лишайник и крапинки на камне
      g.fillStyle = 'rgba(190,240,120,.35)'; for (const [x, y, r] of [[-30, -22, 7], [-24, -16, 4], [32, -74, 5]]) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
      g.fillStyle = 'rgba(30,40,10,.22)'; for (const [x, y] of [[30, -16], [-34, -44], [26, -48], [-8, -12]]) { g.beginPath(); g.arc(x, y, 1.8, 0, TAU); g.fill(); }
      shine(g, -26, -70, 5, 8);
      // золотая цепь с листиком
      g.fillStyle = '#ffd04a'; g.strokeStyle = '#8a6010'; g.lineWidth = 1.4; for (let i = 0; i <= 10; i++) { const u = i / 10, x = -24 + 48 * u, y = -29 + Math.sin(Math.PI * u) * 9; g.beginPath(); g.ellipse(x, y, 2.6, 1.9, 0.6 * (i % 2 ? 1 : -1), 0, TAU); g.fill(); g.stroke(); }
      g.save(); g.translate(0, -15); g.rotate(Math.sin(t * 3) * 0.08 + hit * 0.25); const mg = g.createRadialGradient(-2, -2, 1, 0, 0, 7); mg.addColorStop(0, '#fff6c0'); mg.addColorStop(1, '#e8a820');
      g.fillStyle = mg; g.strokeStyle = '#8a6010'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 6.5, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = '#3f8a2a'; g.beginPath(); g.moveTo(0, -4); g.quadraticCurveTo(4, 0, 0, 4); g.quadraticCurveTo(-4, 0, 0, -4); g.fill(); g.restore();
      eye(g, -14, -62, 8.5, st, { lid: 1 }); eye(g, 14, -62, 8.5, st, { lid: 1 });
      g.strokeStyle = '#1f3a10'; g.lineWidth = 3; g.lineCap = 'round'; for (const k of [-1, 1]) { const up = k < 0 ? hit * 3 + s * 1.5 : 0; g.beginPath(); g.moveTo(k * 7, -73 - up * 0.6); g.lineTo(k * 21, -75 - up); g.stroke(); }
      mouth(g, 0, -42, 20, s, 'o');
      // кепка-лист козырьком вбок: подскакивает на каждом ударе
      g.save(); g.translate(0, -hit * 3); g.rotate(hit * 0.04);
      const cap = g.createLinearGradient(0, -100, 0, -84); cap.addColorStop(0, '#6cc048'); cap.addColorStop(1, '#3f8a2a');
      g.fillStyle = '#2f6a1f'; g.strokeStyle = '#1f4a14'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(26, -89); g.quadraticCurveTo(54, -95, 57, -82); g.quadraticCurveTo(42, -85, 26, -83); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = cap; g.beginPath(); g.moveTo(-36, -85); g.bezierCurveTo(-34, -105, 34, -105, 36, -85); g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(20,60,10,.5)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(0, -99); g.lineTo(0, -86); for (const k of [-1, 1]) for (const y of [-96, -91]) { g.moveTo(0, y); g.quadraticCurveTo(k * 10, y - 1, k * 18, y + 4); } g.stroke();
      g.fillStyle = '#2f6a1f'; g.strokeStyle = '#1f4a14'; g.lineWidth = 2; g.beginPath(); g.arc(0, -100, 3, 0, TAU); g.fill(); g.stroke();
      g.restore();
      // наушники-ракушки; огоньки мигают в такт
      g.lineCap = 'round'; g.strokeStyle = '#22222c'; g.lineWidth = 8; g.beginPath(); g.arc(0, -64, 44, Math.PI * 1.13, Math.PI * 1.87); g.stroke();
      g.strokeStyle = '#5a5a6e'; g.lineWidth = 4; g.stroke(); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1.4; g.beginPath(); g.arc(0, -64, 44.5, Math.PI * 1.3, Math.PI * 1.6); g.stroke();
      for (const k of [-1, 1]) {
        const cx = k * 42, cy = -58 + (k < 0 ? hit * 1.5 : 0);
        g.fillStyle = '#f6ece0'; g.strokeStyle = '#5a4a3a'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(cx, cy + 12); g.quadraticCurveTo(cx + k * 14, cy + 2, cx + k * 9, cy - 11); g.quadraticCurveTo(cx, cy - 16, cx - k * 6, cy - 9); g.quadraticCurveTo(cx - k * 9, cy + 2, cx, cy + 12); g.fill(); g.stroke();
        g.strokeStyle = 'rgba(150,110,80,.55)'; g.lineWidth = 1.3; for (const a of [-1.2, -0.7, -0.2, 0.3]) { g.beginPath(); g.moveTo(cx, cy + 10); g.lineTo(cx + k * Math.cos(a - 0.6) * 11, cy + 10 - 13 + Math.sin(a) * 4); g.stroke(); }
        const led = 0.35 + 0.65 * Math.max(hit, dn * Math.max(0, Math.cos(TAU * bt))); glow(cx + k * 2, cy, 9, '#ff7a5a', led * 0.6); g.fillStyle = `rgba(255,${130 + 100 * led | 0},110,1)`; g.beginPath(); g.arc(cx + k * 2, cy, 2.6, 0, TAU); g.fill();
      }
      // левая рука прижимает наушник
      arm(g, -34, -32, Math.atan2(-56 + hit * 1.5 + 32, -46 + 34), Math.hypot(-12, 24), c, 9); fist(-46, -55 + hit * 1.5, 6.5);
      // микрофон: подносит ко рту, когда поёт; на ударе дрожит
      const mk = Math.min(1, s * 1.6), mx = 26 - 13 * mk + hit * 1.2, my = -22 - 17 * mk + hit * 1.5, ma = -0.5 - mk * 0.15;
      const hx = mx - Math.sin(ma) * 13, hy = my + Math.cos(ma) * 13;
      g.strokeStyle = '#22222c'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(mx - Math.sin(ma) * 22, my + Math.cos(ma) * 22); g.bezierCurveTo(46, -18, 30, -2, 50, -4 + Math.sin(t * 3)); g.stroke();
      arm(g, 36, -30, Math.atan2(hy + 30, hx - 36), Math.hypot(hx - 36, hy + 30), c, 9);
      g.save(); g.translate(mx, my); g.rotate(ma);
      g.fillStyle = '#2a2a34'; g.beginPath(); g.roundRect(-3.5, 4, 7, 19, 3); g.fill();
      g.fillStyle = '#c8ccd8'; g.strokeStyle = '#22222c'; g.lineWidth = 2; g.beginPath(); g.roundRect(-5, 3, 10, 4, 1.5); g.fill(); g.stroke();
      const hg = g.createRadialGradient(-2.5, -3, 1, 0, 0, 8); hg.addColorStop(0, '#ffffff'); hg.addColorStop(1, '#8a92a4');
      g.fillStyle = hg; g.beginPath(); g.arc(0, -1, 7.5, 0, TAU); g.fill(); g.stroke();
      g.save(); g.clip(); g.strokeStyle = 'rgba(40,40,60,.45)'; g.lineWidth = 0.9; for (let d = -6; d <= 6; d += 3) { g.beginPath(); g.moveTo(-8, d - 1); g.lineTo(8, d - 1); g.moveTo(d, -9); g.lineTo(d, 7); g.stroke(); } g.restore();
      g.restore();
      fist(hx, hy, 6.5);
      // «тыц!»: на каждом ударе от микрофона разлетаются чёрточки
      if (hit > 0.05 && s > 0.1) { g.save(); g.globalAlpha *= Math.min(1, hit * 1.5); g.lineCap = 'round'; for (let i = 0; i < 4; i++) { const a = -0.9 + i * 0.42, r1 = 12 + (1 - hit) * 5, r2 = r1 + 3 + hit * 5; for (const [col, lw] of [['#2a2a34', 4.4], ['#fff6a0', 2.2]]) { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(mx + Math.cos(a) * r1, my + Math.sin(a) * r1); g.lineTo(mx + Math.cos(a) * r2, my + Math.sin(a) * r2); g.stroke(); } } g.restore(); }
    },
  },
  heyho: {
    name: 'Хейхо', el: ['stone', 'fire'], part: 'chant', rate: 46,
    desc: 'Вулканический заводила. Кричит «хей!» и «хо!», и весь остров кричит вместе с ним.', col: '#5b4e55',
    draw(g, st) {
      const TAU = Math.PI * 2, w = 96, h = 90, c = this.col, s = st.sing || 0, hit = st.hit || 0, t = st.t || 0, o = shade(c, -0.6), hot = Math.min(1, 0.35 + 0.65 * s + hit * 0.2);
      const glow = (x, y, r, col, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba(col, a)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };
      const star = (x, y, r, col) => { const e = r * 0.18; g.fillStyle = col; g.beginPath(); g.moveTo(x, y - r); g.quadraticCurveTo(x + e, y - e, x + r, y); g.quadraticCurveTo(x + e, y + e, x, y + r); g.quadraticCurveTo(x - e, y + e, x - r, y); g.quadraticCurveTo(x - e, y - e, x, y - r); g.fill(); };
      // язык пламени в три слоя; на крике вспыхивает выше
      const fl = (x, y, sc, ph, ang) => {
        const k = (1 + Math.sin(t * 12 + ph) * 0.1 + Math.sin(t * 7.3 + ph * 2) * 0.06) * (1 + s * 0.16 + hit * 0.22), wob = Math.sin(t * 9 + ph) * 3;
        g.save(); g.translate(x, y); g.rotate(ang); g.scale(sc, sc * k);
        const L = (r, top, col) => { g.beginPath(); g.moveTo(wob * top / 30, -top); g.bezierCurveTo(r * 0.5 + wob * 0.5, -top * 0.6, r * 1.1, -top * 0.35, r, 0); g.quadraticCurveTo(r * 0.8, r * 0.75, 0, r * 0.75); g.quadraticCurveTo(-r * 0.8, r * 0.75, -r, 0); g.bezierCurveTo(-r * 1.1, -top * 0.35, -r * 0.5 + wob * 0.5, -top * 0.6, wob * top / 30, -top); g.fillStyle = col; g.fill(); };
        L(12, 32, '#ff6a1a'); g.strokeStyle = '#8a2a0a'; g.lineWidth = 2.2 / sc; g.stroke(); L(8, 22, '#ffb02a'); L(4.5, 12, '#fff2a0');
        g.restore();
      };
      // раскалённая трещина: свечение, тёмный край, огонь и жёлтая сердцевина
      const ember = (P, wd) => { g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); P.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); for (const [col, lw] of [[`rgba(255,120,30,${0.15 + 0.35 * hot})`, wd * 3.2], ['#2a1410', wd + 1.8], [`rgb(255,${100 + 70 * hot | 0},30)`, wd], [`rgba(255,240,150,${0.3 + 0.7 * hot})`, wd * 0.4]]) { g.strokeStyle = col; g.lineWidth = lw; g.stroke(); } };
      glow(0, -56, 74, '#ff8a2a', 0.14 + s * 0.2); glow(2, -98, 38, '#ffb040', 0.25 + s * 0.3 + hit * 0.2);
      // искры летят из макушки
      for (let i = 0; i < 4; i++) { const ph = (t * (0.6 + s * 0.4) + i / 4) % 1; star(-14 + i * 9 + Math.sin(ph * 6 + i) * 6, -100 - ph * 32, (2.6 + hit * 1.5) * (1 - ph * 0.6), rgba(i % 2 ? '#ffd040' : '#fff4b0', (1 - ph) * (0.5 + 0.5 * s))); }
      fl(-13, -84, 0.72, 0, -0.32); fl(19, -82, 0.62, 2.6, 0.38); fl(3, -88, 0.84, 1.3, 0.02);
      feet(g, w, c);
      const body = new Path2D(); SHAPES.rock(body, w, h);
      silhouette(g, [{ path: g2 => SHAPES.rock(g2, w, h), fill: blobFill(g, c, w, h) }], c, o);
      g.save(); g.clip(body);
      ember([[-52, -64], [-38, -58], [-40, -46], [-30, -36]], 3); ember([[44, -78], [32, -64], [38, -50], [52, -44]], 2.6); ember([[8, 2], [17, -9], [13, -17], [24, -27]], 2.4);
      g.fillStyle = 'rgba(255,255,255,.1)'; for (const [x, y, r] of [[-30, -74, 3], [28, -30, 2.6], [-36, -22, 2.2]]) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
      g.restore();
      shine(g, -24, -74, 5, 8);
      eye(g, -16, -60, 9, st, { iris: '#ff7a20' }); eye(g, 16, -60, 9, st, { iris: '#ff7a20' });
      // брови-уступы: на крике взлетают
      for (const k of [-1, 1]) for (const [col, lw] of [[o, 6.5], ['#3a2a30', 3.6]]) { g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'round'; g.beginPath(); g.moveTo(k * 7, -72 + s * 2 - hit * 3); g.lineTo(k * 26, -78 - hit * 4); g.stroke(); }
      mouth(g, 0, -40, 32, s, 'teeth');
      cheeks(g, 0, -46, 30, 5.5);
      // левая рука: на бедре, а на крике — рупором у рта
      const m = Math.min(1, s * 1.5), lx = -52 + 26 * m, ly = -26 - 16 * m;
      arm(g, -42, -46, Math.atan2(ly + 46, lx + 42), Math.hypot(lx + 42, ly + 46), c, 11);
      g.save(); g.translate(lx, ly); g.rotate(m * 0.2); g.fillStyle = shade(c, 0.12); g.strokeStyle = o; g.lineWidth = 2.6; g.beginPath(); g.ellipse(0, 0, 7 + m, 8.5, 0, 0, TAU); g.fill(); g.stroke();
      g.strokeStyle = rgba('#1a1014', 0.55); g.lineWidth = 1.6; g.beginPath(); g.arc(3 + m * 2, 0, 5.5, Math.PI * 0.6, Math.PI * 1.4); g.stroke(); g.restore();
      // правый кулак: на каждое «хей!» вскидывает вверх
      const fa = -1.0 - s * 0.25 - hit * 0.45, L = 18 + hit * 5, fx = 42 + Math.cos(fa) * L, fy = -50 + Math.sin(fa) * L;
      if (hit > 0.15) { g.strokeStyle = rgba('#fff2a0', hit); g.lineWidth = 2.2; g.lineCap = 'round'; for (const d of [-7, 0, 7]) { g.beginPath(); g.moveTo(fx + d, fy + 13); g.lineTo(fx + d * 1.2, fy + 13 + 9 * hit); g.stroke(); } }
      arm(g, 42, -50, fa, L, c, 11);
      g.save(); g.translate(42 + Math.cos(fa) * L * 0.62, -50 + Math.sin(fa) * L * 0.62); g.rotate(fa); g.fillStyle = '#2a2026'; g.strokeStyle = '#120a0e'; g.lineWidth = 1.8; g.beginPath(); g.roundRect(-4, -8.5, 8, 17, 2); g.fill(); g.stroke();
      g.fillStyle = '#d8dce8'; for (const d of [-4.5, 0, 4.5]) { g.beginPath(); g.arc(0, d, 1.5, 0, TAU); g.fill(); } g.restore();
      g.save(); g.translate(fx, fy); g.rotate(fa + Math.PI / 2); g.fillStyle = shade(c, 0.12); g.strokeStyle = o; g.lineWidth = 2.6; g.beginPath(); g.roundRect(-9, -9, 18, 15, 6); g.fill(); g.stroke();
      g.strokeStyle = rgba('#1a1014', 0.55); g.lineWidth = 1.5; g.beginPath(); for (const d of [-3, 3]) { g.moveTo(d, -9); g.lineTo(d, -4); } g.stroke(); g.restore();
      // на крике от головы разлетаются чёрточки
      if (hit > 0.05 && s > 0.15) { g.lineCap = 'round'; for (let i = 0; i < 3; i++) { const a = -2.3 - i * 0.4, r1 = 50 + (1 - hit) * 4, r2 = r1 + 4 + hit * 7; for (const [col, lw] of [[o, 5], ['#ffd040', 2.6]]) { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(Math.cos(a) * r1, -58 + Math.sin(a) * r1); g.lineTo(Math.cos(a) * r2, -58 + Math.sin(a) * r2); g.stroke(); } } }
    },
  },
  zharptica: {
    name: 'Жар-птичка', el: ['wind', 'fire'], part: 'yodel', rate: 48,
    desc: 'Огненная певчая птичка. Выводит переливы «о-ли-и» с прыжками через октаву.', col: '#ff5a4a',
    draw(g, st) {
      const TAU = Math.PI * 2, w = 74, h = 92, c = this.col, s = st.sing || 0, hit = st.hit || 0, t = st.t || 0, dn = st.dance || 0, o = shade(c, -0.6);
      const sw = dn * Math.sin(TAU * ((st.beat || 0) - 0.3) / (st.bpb === 3 ? 3 : 2)) + (1 - dn) * 0.5 * Math.sin(t * 1.6);
      const glow = (x, y, r, col, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba(col, a)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };
      const star = (x, y, r, col) => { const e = r * 0.18; g.fillStyle = col; g.beginPath(); g.moveTo(x, y - r); g.quadraticCurveTo(x + e, y - e, x + r, y); g.quadraticCurveTo(x + e, y + e, x, y + r); g.quadraticCurveTo(x - e, y + e, x - r, y); g.quadraticCurveTo(x - e, y - e, x, y - r); g.fill(); };
      // перо-пламя хохолка
      const fl = (x, y, sc, ph, ang) => {
        const k = (1 + Math.sin(t * 12 + ph) * 0.1 + Math.sin(t * 7.3 + ph * 2) * 0.06) * (1 + s * 0.15 + hit * 0.25), wob = Math.sin(t * 9 + ph) * 3;
        g.save(); g.translate(x, y); g.rotate(ang); g.scale(sc, sc * k);
        const L = (r, top, col) => { g.beginPath(); g.moveTo(wob * top / 30, -top); g.bezierCurveTo(r * 0.5 + wob * 0.5, -top * 0.6, r * 1.1, -top * 0.35, r, 0); g.quadraticCurveTo(r * 0.8, r * 0.75, 0, r * 0.75); g.quadraticCurveTo(-r * 0.8, r * 0.75, -r, 0); g.bezierCurveTo(-r * 1.1, -top * 0.35, -r * 0.5 + wob * 0.5, -top * 0.6, wob * top / 30, -top); g.fillStyle = col; g.fill(); };
        L(12, 32, '#ff6a1a'); g.strokeStyle = '#8a2a0a'; g.lineWidth = 2.2 / sc; g.stroke(); L(8, 22, '#ffb02a'); L(4.5, 12, '#fff2a0');
        g.restore();
      };
      glow(0, -58, 74, '#ffb040', 0.2 + s * 0.3);
      // хвост жар-птицы: перья с «глазками» качаются в такт
      const TL = [[-3.2, 38, 0], [-2.82, 43, 1.1], [-2.44, 43, 2.2], [-2.06, 37, 3.3]];
      for (const [a, L, ph] of TL) {
        g.save(); g.translate(-18, -26); g.rotate(a + sw * 0.1 + Math.sin(t * 3 + ph) * 0.05 - hit * 0.04);
        const fg = g.createLinearGradient(0, 0, L, 0); fg.addColorStop(0, '#ff4a2a'); fg.addColorStop(1, '#ffb02a');
        g.fillStyle = fg; g.strokeStyle = '#8a2a10'; g.lineWidth = 2.2; g.lineJoin = 'round';
        g.beginPath(); g.moveTo(0, -3); g.quadraticCurveTo(L * 0.5, -5, L - 8, -7); g.quadraticCurveTo(L + 4, -6.5, L + 4, 0); g.quadraticCurveTo(L + 4, 6.5, L - 8, 7); g.quadraticCurveTo(L * 0.5, 5, 0, 3); g.closePath(); g.fill(); g.stroke();
        g.strokeStyle = 'rgba(138,42,16,.45)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(4, 0); g.lineTo(L - 9, 0); g.stroke();
        g.fillStyle = '#ffe27a'; g.beginPath(); g.ellipse(L - 3, 0, 6, 4.6, 0, 0, TAU); g.fill(); g.fillStyle = '#ff3a2a'; g.beginPath(); g.ellipse(L - 2, 0, 3.4, 2.6, 0, 0, TAU); g.fill(); g.fillStyle = '#fff6c0'; g.beginPath(); g.arc(L - 1, -0.6, 1.2, 0, TAU); g.fill();
        g.restore();
      }
      // искры с кончиков хвоста
      for (let i = 0; i < 3; i++) { const ph = (t * 0.8 + i / 3) % 1, [a, L] = TL[i + 1], ex = -18 + Math.cos(a) * (L + 2), ey = -26 + Math.sin(a) * (L + 2); star(ex + ph * 6, ey - ph * 18, (2.4 + s * 1.5) * (1 - ph * 0.5), rgba(i % 2 ? '#ffd040' : '#fff4b0', (1 - ph) * (0.4 + 0.6 * s))); }
      // лапки-когти
      for (const k of [-1, 1]) { g.lineCap = 'round'; for (const [col, lw] of [['#8a4a10', 6], ['#ffb02a', 3]]) { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); for (const d of [-6, 0, 6]) { g.moveTo(k * 13, -7); g.lineTo(k * 13 + d + k * 2, 0); } g.stroke(); } }
      const body = new Path2D(); SHAPES.pear(body, w, h);
      silhouette(g, [{ path: g2 => SHAPES.pear(g2, w, h), fill: blobFill(g, c, w, h) }], c, o);
      // жёлтая грудка в пёрышках
      g.save(); g.clip(body); g.fillStyle = '#ffd84a'; g.beginPath(); g.ellipse(0, -28, 21, 25, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(210,120,20,.5)'; g.lineWidth = 1.5; for (const [y, n] of [[-38, 3], [-28, 4], [-18, 3]]) for (let i = 0; i < n; i++) { const x = (i - (n - 1) / 2) * 9; g.beginPath(); g.arc(x, y, 4.5, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); }
      g.restore();
      shine(g, -14, -78, 5, 8);
      // огненный хохолок вспыхивает на скачке через октаву
      glow(0, -96, 24, '#ffd040', 0.3 + 0.35 * s + hit * 0.25);
      fl(-8, -86, 0.4, 0, -0.42); fl(8, -86, 0.4, 2, 0.42); fl(0, -89, 0.52, 1, 0);
      // крылья: машут чаще на громкой ноте и взлетают вверх
      const lift = Math.min(1, s * 0.85 + hit * 0.3), flap = Math.sin(t * (6 + s * 10)) * (0.08 + 0.22 * s);
      for (const k of [-1, 1]) {
        g.save(); g.translate(k * 28, -52); g.scale(k, 1); g.rotate(0.55 - lift * 1.05 - flap);
        const wg = g.createLinearGradient(0, -6, 26, 12); wg.addColorStop(0, shade(c, -0.12)); wg.addColorStop(0.6, '#ff8a2a'); wg.addColorStop(1, '#ffd04a');
        g.fillStyle = wg; g.strokeStyle = o; g.lineWidth = 2.4; g.lineJoin = 'round';
        g.beginPath(); g.moveTo(-2, -7); g.quadraticCurveTo(16, -12, 27, -2); g.quadraticCurveTo(29, 4, 22, 5); g.quadraticCurveTo(24, 10, 16, 11); g.quadraticCurveTo(16, 16, 8, 14); g.quadraticCurveTo(0, 12, -2, 7); g.closePath(); g.fill(); g.stroke();
        g.strokeStyle = 'rgba(138,42,16,.45)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(5, -1); g.lineTo(21, 1); g.moveTo(4, 4); g.lineTo(14, 9); g.stroke();
        g.restore();
      }
      for (const k of [-1, 1]) { eye(g, k * 11, -67, 8.5, st, { lid: 1, iris: '#c0401a' }); if (!(st.blink > 0.5)) { g.strokeStyle = '#2a1a22'; g.lineWidth = 1.8; g.lineCap = 'round'; for (let i = 0; i < 2; i++) { g.beginPath(); g.moveTo(k * (17 + i * 2), -73 + i * 3); g.lineTo(k * (21 + i * 2.5), -76 + i * 3.5); g.stroke(); } } }
      cheeks(g, 0, -56, 21, 4.5);
      // клюв раскрывается по громкости и гласной
      const V = MOUTH_V, op = s * ({ a: 1, o: 0.9, u: 0.7, e: 0.7, i: 0.55 }[V] || 0.85) * 12, rk = V === 'o' || V === 'u' ? 0.8 : V === 'e' || V === 'i' ? 1.2 : 1;
      g.fillStyle = '#5a1424'; g.strokeStyle = '#2a1a22'; g.lineWidth = 2.2; g.beginPath(); g.ellipse(0, -50 + op * 0.5, (6.5 + op * 0.25) * rk, 1.5 + op * 0.55, 0, 0, TAU); g.fill(); g.stroke();
      if (op > 3) { g.fillStyle = '#ff7a8a'; g.beginPath(); g.ellipse(0, -50 + op * 0.82, (3.5 + op * 0.15) * rk, op * 0.2, 0, 0, TAU); g.fill(); }
      g.fillStyle = '#ffb02a'; g.strokeStyle = '#8a5a10'; g.lineWidth = 2.2; g.lineJoin = 'round'; g.beginPath(); g.moveTo(-7, -49 + op); g.quadraticCurveTo(0, -47 + op, 7, -49 + op); g.lineTo(0, -42 + op); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#ffd23a'; g.beginPath(); g.moveTo(-10, -57); g.quadraticCurveTo(0, -61, 10, -57); g.quadraticCurveTo(4, -52, 0, -47); g.quadraticCurveTo(-4, -52, -10, -57); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.ellipse(-3.5, -56.5, 2.6, 1.1, -0.2, 0, TAU); g.fill();
      // на каждой ноте у клюва вспыхивает искорка
      if (hit > 0.05 && s > 0.1) for (const k of [-1, 1]) star(k * (16 + (1 - hit) * 8), -50 - (1 - hit) * 8, 2 + hit * 3, rgba('#fff4a0', hit));
    },
  },
  dubidub: {
    name: 'Дубидуб', el: ['leaf', 'fire'], part: 'scat', rate: 48,
    desc: 'Джазовый кот-монстрик в листовом берете. Импровизирует «ду-би-ду-ба» на слабые доли.', col: '#9a5ad6',
    draw(g, st) {
      const TAU = Math.PI * 2, w = 80, h = 96, c = this.col, s = st.sing || 0, hit = st.hit || 0, bt = st.beat || 0, t = st.t || 0, dn = st.dance || 0, o = shade(c, -0.6);
      const sw = dn * Math.sin(TAU * bt / (st.bpb === 3 ? 3 : 2)) + (1 - dn) * 0.6 * Math.sin(t * 2);
      // щелчки пальцами на «два» и «четыре» (в вальсе — на «два» и «три»; без музыки — на каждой ноте)
      const bi = Math.floor(bt), fb = bt - bi, off = st.bpb === 3 ? bi % 3 !== 0 : bi % 2 === 1, snap = dn * (off ? Math.max(0, 1 - fb / 0.3) : 0) + (1 - dn) * hit * 0.7;
      const glow = (x, y, r, col, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba(col, a)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };
      const star = (x, y, r, col) => { const e = r * 0.18; g.fillStyle = col; g.beginPath(); g.moveTo(x, y - r); g.quadraticCurveTo(x + e, y - e, x + r, y); g.quadraticCurveTo(x + e, y + e, x, y + r); g.quadraticCurveTo(x - e, y + e, x - r, y); g.quadraticCurveTo(x - e, y - e, x, y - r); g.fill(); };
      const note = (x, y, sc, a, col) => { if (a < 0.03) return; g.save(); g.translate(x, y); g.scale(sc, sc); g.globalAlpha *= Math.min(1, a); g.lineCap = 'round'; g.strokeStyle = '#2a1a3a'; g.lineWidth = 4.2; g.beginPath(); g.ellipse(0, 0, 4.6, 3.4, -0.45, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(3.8, -1.2); g.lineTo(3.8, -15); g.quadraticCurveTo(10, -12, 9.5, -6); g.stroke(); g.strokeStyle = col; g.lineWidth = 2; g.stroke(); g.fillStyle = col; g.beginPath(); g.ellipse(0, 0, 4.6, 3.4, -0.45, 0, TAU); g.fill(); g.restore(); };
      glow(0, -58, 74, '#d8a0ff', 0.2 + s * 0.28); glow(0, -30, 40, '#ffb040', 0.1 + s * 0.12);
      // хвост качается в ритме свинга, на кончике — огонёк
      const tx = 50 + sw * 8, ty = -64 + Math.abs(sw) * 3;
      g.lineCap = 'round'; for (const [col, lw] of [[o, 12], [c, 7]]) { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(26, -14); g.quadraticCurveTo(60 + sw * 4, -26, tx, ty); g.stroke(); }
      g.strokeStyle = shade(c, -0.3); g.lineWidth = 7; g.save(); g.beginPath(); g.moveTo(26, -14); g.quadraticCurveTo(60 + sw * 4, -26, tx, ty); g.setLineDash([3, 7]); g.stroke(); g.restore();
      glow(tx, ty - 6, 14, '#ffb040', 0.35 + 0.35 * s);
      { const k = (1 + Math.sin(t * 13) * 0.12) * (1 + hit * 0.25), wob = Math.sin(t * 9) * 2; g.save(); g.translate(tx, ty - 2); g.rotate(sw * 0.2); g.scale(0.36, 0.36 * k);
        for (const [r, top, col] of [[12, 32, '#ff6a1a'], [8, 22, '#ffb02a'], [4.5, 12, '#fff2a0']]) { g.beginPath(); g.moveTo(wob, -top); g.bezierCurveTo(r * 0.5, -top * 0.6, r * 1.1, -top * 0.35, r, 0); g.quadraticCurveTo(r * 0.8, r * 0.75, 0, r * 0.75); g.quadraticCurveTo(-r * 0.8, r * 0.75, -r, 0); g.bezierCurveTo(-r * 1.1, -top * 0.35, -r * 0.5, -top * 0.6, wob, -top); g.fillStyle = col; g.fill(); if (r === 12) { g.strokeStyle = '#8a2a0a'; g.lineWidth = 6; g.stroke(); g.fill(); } }
        g.restore(); }
      feet(g, w, c);
      const tw = hit * 0.8;
      const ears = [-1, 1].map(k => ({ path: g2 => { g2.moveTo(k * 14, -88); g2.lineTo(k * (30 + (k > 0 ? tw * 2 : 0)), -112 + (k > 0 ? tw * 3 : 0)); g2.lineTo(k * 34, -80); g2.closePath(); }, fill: shade(c, -0.05) }));
      silhouette(g, [...ears, { path: g2 => SHAPES.gum(g2, w, h), fill: blobFill(g, c, w, h) }], c, o);
      g.fillStyle = '#ff9ac8'; for (const k of [-1, 1]) { g.beginPath(); g.moveTo(k * 19, -87); g.lineTo(k * (29.5 + (k > 0 ? tw * 1.6 : 0)), -105 + (k > 0 ? tw * 2.5 : 0)); g.lineTo(k * 31, -84); g.closePath(); g.fill(); }
      g.fillStyle = shade(c, 0.35); g.beginPath(); g.ellipse(0, -18, 24, 16, 0, 0, TAU); g.fill();
      shine(g, -24, -80, 5, 8);
      // листовой берет: подпрыгивает на ноте
      g.save(); g.translate(-5, -95 - hit * 2.5); g.rotate(-0.22 + sw * 0.04);
      const bg = g.createLinearGradient(0, -13, 0, 8); bg.addColorStop(0, '#86e060'); bg.addColorStop(1, '#3f9a32');
      g.strokeStyle = '#6a4a1a'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(3, -11); g.quadraticCurveTo(4, -18, 10, -19); g.stroke();
      g.fillStyle = bg; g.strokeStyle = '#1f5a14'; g.lineWidth = 2.6; g.beginPath(); g.ellipse(0, -1, 31, 11, 0, 0, TAU); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(20,70,10,.5)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-25, 0); g.quadraticCurveTo(0, -4, 27, -2); for (const x of [-14, -3, 8, 18]) { g.moveTo(x, -2.2); g.lineTo(x + 6, -9); g.moveTo(x, -1.8); g.lineTo(x + 5, 5); } g.stroke();
      g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(-12, -6, 9, 2.5, -0.1, 0, TAU); g.fill();
      g.restore();
      // тёмные очки; на громкой ноте над ними взлетают брови
      for (const k of [-1, 1]) { g.strokeStyle = o; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.arc(k * 14, -71 - s * 4 - hit * 2, 9, Math.PI * 1.2, Math.PI * 1.8); g.stroke(); }
      const gy = -66 + s * 1.5;
      for (const k of [-1, 1]) {
        const lg = g.createLinearGradient(0, gy - 9, 0, gy + 9); lg.addColorStop(0, '#24163e'); lg.addColorStop(1, '#3a6a9a');
        g.fillStyle = lg; g.strokeStyle = '#4a2a10'; g.lineWidth = 4.6; g.beginPath(); g.ellipse(k * 14, gy, 12, 9.5, 0, 0, TAU); g.stroke(); g.fill(); g.strokeStyle = '#ffb02a'; g.lineWidth = 2.4; g.stroke();
        g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(k * 14 - 7 + sw * 2, gy - 1); g.lineTo(k * 14 - 2 + sw * 2, gy - 6); g.stroke();
      }
      g.strokeStyle = '#ffb02a'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(-2.5, gy - 1); g.quadraticCurveTo(0, gy - 3, 2.5, gy - 1); g.stroke();
      g.fillStyle = '#ff8ab0'; g.strokeStyle = '#7a2a4a'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-3.5, -55.5); g.lineTo(3.5, -55.5); g.lineTo(0, -52); g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = '#2a1a22'; g.lineWidth = 1.6; for (const k of [-1, 1]) for (const d of [-2.5, 2.5]) { g.beginPath(); g.moveTo(k * 15, -49 + d); g.lineTo(k * 33, -51 + d * 2 + Math.sin(t * 5 + d + k) * 1.2); g.stroke(); }
      cheeks(g, 0, -50, 24, 4.5); mouth(g, 0, -44, 20, s);
      // бабочка в горошек
      g.save(); g.translate(0, -29); g.rotate(Math.sin(t * 4) * 0.06 + hit * 0.12);
      g.fillStyle = '#ff7a2a'; g.strokeStyle = '#7a2a10'; g.lineWidth = 2; g.lineJoin = 'round'; g.beginPath(); g.moveTo(0, 0); g.lineTo(-13, -6.5); g.quadraticCurveTo(-15, 0, -13, 6.5); g.closePath(); g.moveTo(0, 0); g.lineTo(13, -6.5); g.quadraticCurveTo(15, 0, 13, 6.5); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#ffe27a'; for (const [x, y] of [[-8, -2], [-10, 3], [8, -2], [10, 3]]) { g.beginPath(); g.arc(x, y, 1.4, 0, TAU); g.fill(); }
      g.fillStyle = '#e85a1a'; g.beginPath(); g.roundRect(-3, -3.5, 6, 7, 2); g.fill(); g.stroke(); g.restore();
      // лапки щёлкают пальцами в такт
      for (const k of [-1, 1]) {
        const hx = k * (48 - snap * 2) + sw * 2, hy = -56 + snap * 5 + Math.abs(sw) * 2;
        arm(g, k * 30, -38, Math.atan2(hy + 38, hx - k * 30), Math.hypot(hx - k * 30, hy + 38), c, 9);
        g.fillStyle = shade(c, 0.15); g.strokeStyle = o; g.lineWidth = 2.4; g.beginPath(); g.arc(hx, hy, 6.5, 0, TAU); g.fill(); g.stroke();
        g.beginPath(); g.ellipse(hx - k * 2, hy - 6, 2.4, 3.4, k * 0.4, 0, TAU); g.fill(); g.stroke();
        if (snap > 0.1 && s > 0.05) { g.lineCap = 'round'; for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + k * (0.1 + i * 0.5), r1 = 9 + (1 - snap) * 3, r2 = r1 + 2 + snap * 5; for (const [col, lw] of [[o, 4], ['#ffe27a', 2]]) { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(hx + Math.cos(a) * r1, hy - 4 + Math.sin(a) * r1); g.lineTo(hx + Math.cos(a) * r2, hy - 4 + Math.sin(a) * r2); g.stroke(); } } }
      }
      // ноты скэта вылетают изо рта
      for (let i = 0; i < 3; i++) { const ph = (t * 0.55 + i / 3) % 1, k = i % 2 ? 1 : -1; note(k * (42 + ph * 14) + Math.sin(ph * 9) * 3, -74 - ph * 40, 0.75 + ph * 0.3, s * (1 - ph) * Math.min(1, ph * 5) * 1.3, ['#ffb02a', '#7ad85a', '#ff7ab8'][i]); }
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

// танец под музыку: [прыжок на каждую долю, качание, шаг в сторону] — у каждой партии свой стиль
const DANCE = {};
[[['kick', 'snare', 'tom', 'beatbox', 'rockkick', 'anvil', 'bongo', 'claves', 'cowbell', 'woodblock', 'shaker', 'sleigh'], [5, 0.035, 0]],
 [['bass', 'bassvox', 'fuzzbass', 'subbass', 'oompah', 'growl', 'reggaevox', 'chant'], [3, 0.05, 3.5]],
 [['flute', 'marimba', 'pluck', 'brass', 'whistle', 'riff', 'organ', 'celesta', 'glass', 'strings', 'steel', 'ukulele', 'panflute'], [2.2, 0.075, 2]],
 [['lead', 'opera', 'soprano', 'yodel', 'scat', 'frog', 'pad', 'rockvox', 'icesoprano', 'baritone', 'calypsovox'], [1.4, 0.11, 0]]].forEach(([ps, d]) => ps.forEach(p => (DANCE[p] = d)));
// полный рисунок монстра: тень, подпрыгивание, сжатие на ноте, раскачивание, танец, поворот кругом
// st: t — время, sing — громкость своей ноты, sq — пружина «желе» (+ вытянулся, − сплющился),
// jump — высота прыжка, bob — кивок в такт, tilt — наклон, look/lookY — куда смотрит,
// beat — доля песни (дробная), bpb — долей в такте, dance — сколько танцует (0…1), hit — удар новой ноты (1 → 0),
// turn — поворот кругом (0…1), vowel — какую гласную поёт
function drawMonster(g, kind, x, y, size, st) {
  const K = KINDS[kind], s = st.sing || 0, d = st.dance || 0, D = DANCE[K.part] || [2, 0.06, 0];
  const breathe = Math.sin(st.t * 2.2 + (st.phase || 0)) * 0.025;
  // танец: прыжок приземляется ровно на долю, качание и шаг — на два (в вальсе — на три) счёта
  const b = st.beat || 0, f = b - Math.floor(b), per = st.bpb === 3 ? 3 : 2, w = Math.sin(Math.PI * 2 * b / per);
  const hop = D[0] * d * Math.sin(Math.PI * f), land = f < 0.16 ? (1 - f / 0.16) * d * D[0] / 5 : 0;
  const sq = (st.sq || 0) - land * 0.06 + (st.hit || 0) * 0.03 * d;
  const turn = st.turn || 0, spin = turn > 0 ? Math.cos(Math.PI * 2 * turn) : 1;
  const lift = (K.hover ? 14 + Math.sin(st.t * 1.8 + (st.phase || 0)) * 5 : 0) + (st.jump || 0) + (st.hop || 0) + hop + (turn > 0 ? Math.sin(Math.PI * turn) * 22 : 0);
  g.save(); g.translate(x + D[2] * d * w * size / 100, y);
  // тень: мягкая, сжимается, когда монстр в воздухе
  const shK = 1 / (1 + lift / 60), sr = size * 0.36 * (K.hover ? 0.75 : 1) * shK * (1 - sq * 0.4);
  if (sr > 1) {
    g.save(); g.scale(1, 0.2); const sh = g.createRadialGradient(0, 0, sr * 0.2, 0, 0, sr);
    sh.addColorStop(0, `rgba(20,40,10,${0.42 * shK})`); sh.addColorStop(1, 'rgba(20,40,10,0)');
    g.fillStyle = sh; g.beginPath(); g.arc(0, 0, sr, 0, Math.PI * 2); g.fill(); g.restore();
  }
  g.translate(0, -lift + (st.bob || 0)); g.scale(size / 100, size / 100);
  const sy = 1 + breathe + s * 0.05 + sq, sx = 1 - breathe * 0.6 - s * 0.025 - sq * 0.55;
  // качание вокруг ступней: в такт и чуть сильнее на громких нотах
  g.rotate(Math.sin(st.t * 1.3 + (st.phase || 0)) * 0.02 + (st.tilt || 0) + D[1] * d * w * (0.7 + 0.3 * s));
  g.scale(sx * spin, sy);
  st.col = K.col; MOUTH_V = st.vowel || null;
  K.draw(g, st);
  MOUTH_V = null;
  g.restore();
}
