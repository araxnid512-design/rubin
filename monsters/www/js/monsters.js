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
      const c = this.col, o = shade(c, -0.6), s = st.sing || 0, hit = st.hit || 0, t = st.t || 0, TAU = Math.PI * 2;
      const B = st.beat != null ? st.beat : t * 5 / 3, f = B - Math.floor(B), p = hit * hit * (3 - 2 * hit);
      const act = Math.min(1, s * 1.4 + (st.dance || 0) * 0.6);
      // гладкий каменный контур через точки
      const smooth = (q, P, k) => { const n = P.length; q.moveTo(P[0][0], P[0][1]); for (let i = 0; i < n; i++) { const a = P[(i + n - 1) % n], b = P[i], d = P[(i + 1) % n], e = P[(i + 2) % n]; q.bezierCurveTo(b[0] + (d[0] - a[0]) / 6 * k, b[1] + (d[1] - a[1]) / 6 * k, d[0] - (e[0] - b[0]) / 6 * k, d[1] - (e[1] - b[1]) / 6 * k, d[0], d[1]); } q.closePath(); };
      const P = [[-46, -10], [-48, -42], [-36, -70], [-10, -84], [20, -82], [42, -64], [49, -32], [43, -6], [0, -1], [-38, -2]];
      // пыль из-под ног на ударе
      if (hit > 0.05) { g.fillStyle = `rgba(210,190,160,${hit * 0.55})`; for (const k of [-1, 1]) { const u = 1 - hit; g.beginPath(); g.ellipse(k * (42 + u * 12), -4 - u * 4, 6 + u * 4, 4 + u * 2, 0, 0, TAU); g.fill(); } }
      feet(g, 94, c);
      silhouette(g, [{ path: q => smooth(q, P, 0.7), fill: blobFill(g, c, 96, 84) }], c, o);
      const body = new Path2D(); smooth(body, P, 0.7);
      g.save(); g.clip(body);
      g.fillStyle = rgba('#5a4636', 0.14); for (const [x, y, rx, ry] of [[-32, -40, 12, 9], [32, -50, 10, 13], [24, -12, 14, 6], [-28, -12, 9, 5]]) { g.beginPath(); g.ellipse(x, y, rx, ry, 0.4, 0, TAU); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,.25)'; for (const [x, y, r] of [[-38, -54, 2.2], [-30, -62, 1.5], [36, -40, 1.8], [40, -22, 1.4], [-42, -28, 1.6], [12, -70, 1.3]]) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
      g.strokeStyle = rgba('#2a1a12', 0.3); g.lineWidth = 2; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(-48, -48); g.lineTo(-38, -44); g.lineTo(-41, -34); g.moveTo(48, -56); g.lineTo(38, -52); g.lineTo(41, -44); g.moveTo(38, -52); g.lineTo(33, -55); g.stroke();
      g.restore();
      // мох на макушке и росток, который качается в такт
      const moss = new Path2D(); moss.moveTo(-32, -72); moss.bezierCurveTo(-26, -92, 28, -94, 36, -70);
      [[30, -66, 25, -73], [19, -66, 12, -76], [4, -69, -4, -76], [-12, -68, -19, -74], [-26, -67, -32, -72]].forEach(([a, b, x, y]) => moss.quadraticCurveTo(a, b, x, y)); moss.closePath();
      const mg = g.createLinearGradient(0, -92, 0, -64); mg.addColorStop(0, '#9be060'); mg.addColorStop(1, '#4f9a34');
      g.fillStyle = mg; g.strokeStyle = '#2a5a1c'; g.lineWidth = 2.4; g.fill(moss); g.stroke(moss);
      g.fillStyle = 'rgba(220,255,170,.55)'; for (const [x, y, r] of [[-14, -84, 4], [-4, -86, 2.6], [16, -85, 3.2]]) { g.beginPath(); g.ellipse(x, y, r * 1.4, r * 0.8, 0, 0, TAU); g.fill(); }
      const sw = Math.sin(TAU * B) * 0.22 * act + Math.sin(t * 2) * 0.05 - p * 0.15;
      g.save(); g.translate(6, -88); g.rotate(sw);
      g.strokeStyle = '#2a5a1c'; g.lineWidth = 4.6; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-2, -8, 1, -14); g.stroke();
      g.strokeStyle = '#6fbf4a'; g.lineWidth = 2.2; g.stroke();
      leafShape(g, 1, -14, 13, -2.6, '#7cd24e'); leafShape(g, 1, -14, 15, -0.5, '#62c43e');
      g.restore();
      // пузо-барабан: латунный обод, кожа выгибается и идёт кругами на каждом «бум»
      const by = -22, bul = 1 + p * 0.08;
      g.fillStyle = '#9a6a3c'; g.strokeStyle = '#3a2210'; g.lineWidth = 2.6; g.beginPath(); g.ellipse(0, by, 26, 17, 0, 0, TAU); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(255,220,160,.35)'; g.lineWidth = 2; g.beginPath(); g.ellipse(0, by, 23.5, 14.8, 0, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
      g.fillStyle = '#ffd56a'; g.strokeStyle = '#7a5210'; g.lineWidth = 1;
      for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + 0.31; g.beginPath(); g.arc(Math.cos(a) * 23.2, by + Math.sin(a) * 14.6, 1.8, 0, TAU); g.fill(); g.stroke(); }
      const sk = g.createRadialGradient(-6, by - 6, 2, 0, by, 22); sk.addColorStop(0, '#fffaf0'); sk.addColorStop(1, p > 0.3 ? '#ffe9b8' : '#e2cfa8');
      g.fillStyle = sk; g.strokeStyle = '#6a4a2a'; g.lineWidth = 1.8; g.beginPath(); g.ellipse(0, by, 19 * bul, 11 * bul, 0, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = 'rgba(150,100,50,.18)'; g.beginPath(); g.ellipse(0, by + 1, 7, 4, 0, 0, TAU); g.fill();
      if (hit > 0.02) { g.strokeStyle = `rgba(140,95,45,${hit * 0.7})`; g.lineWidth = 1.5; for (const k of [0.3, 0.62]) { const u = Math.min(0.96, k + (1 - hit) * 0.4); g.beginPath(); g.ellipse(0, by, 19 * u, 11 * u, 0, 0, TAU); g.stroke(); } }
      // мордочка
      eye(g, -16, -60, 9.5, st, { happy: true }); eye(g, 16, -60, 9.5, st, { happy: true });
      mouth(g, 0, -45, 22, s * 0.9, 'teeth'); cheeks(g, 0, -48, 27, 6);
      // кулаки бьют в пузо: между ударами замахиваются, на ноте — бух в кожу
      const up = act > 0.02 ? (1 - p) * (0.65 + 0.35 * f) : 0.5;
      for (const k of [-1, 1]) {
        const fx = k * (12 + 36 * up), fy = -20 - 34 * up;
        g.lineCap = 'round'; for (const [col, lw] of [[shade(c, -0.55), 16], [shade(c, -0.05), 11]]) { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(k * 40, -38); g.quadraticCurveTo(k * (40 + 8 * up), -28 - 10 * up, fx, fy); g.stroke(); }
        const fg = g.createRadialGradient(fx - 3, fy - 3, 1, fx, fy, 10); fg.addColorStop(0, shade(c, 0.35)); fg.addColorStop(1, shade(c, -0.12));
        g.fillStyle = fg; g.strokeStyle = o; g.lineWidth = 2.6; g.beginPath(); g.arc(fx, fy, 9, 0, TAU); g.fill(); g.stroke();
        g.strokeStyle = rgba('#2a1a12', 0.45); g.lineWidth = 1.6; for (const d of [-3.5, 0.5]) { g.beginPath(); g.moveTo(fx - k * 2 + d, fy - 7); g.lineTo(fx - k * 2 + d + 1, fy - 2); g.stroke(); }
      }
      // волны «бум» в стороны
      if (hit > 0.08 && s > 0.05) {
        g.lineCap = 'round';
        for (const k of [-1, 1]) for (const d of [0, 8]) {
          const r = 12 + d + (1 - hit) * 10; g.strokeStyle = `rgba(255,255,255,${hit * (d ? 0.55 : 0.9)})`; g.lineWidth = 3;
          g.beginPath(); g.arc(k * 36, -24, r, k > 0 ? -0.55 : Math.PI - 0.55, k > 0 ? 0.55 : Math.PI + 0.55); g.stroke();
        }
      }
    },
  },
  bulya: {
    name: 'Буля', el: ['water'], part: 'marimba', price: 150, rate: 14, need: 1,
    desc: 'Капелька-непоседа. Стучит по маримбе, будто дождь по крыше.', col: '#4aa8ff',
    draw(g, st) {
      const c = this.col, o = shade(c, -0.6), s = st.sing || 0, hit = st.hit || 0, t = st.t || 0, TAU = Math.PI * 2;
      const B = st.beat != null ? st.beat : t * 5 / 3, p = hit * hit * (3 - 2 * hit);
      const act = Math.min(1, s * 1.4 + (st.dance || 0) * 0.6);
      // какой брусок звучит: левая палочка — низкие, правая — высокие
      const nb = B - (1 - hit) * 0.24, n = Math.round(nb * 4), bar = ((n * 5 + Math.floor(nb / 4) * 2) % 6 + 6) % 6, side = bar < 3 ? -1 : 1;
      // капля с гибкой макушкой
      const tip = Math.sin(Math.PI * B) * 5 * act + Math.sin(t * 2.3) * 1.5;
      const drop = q => { q.moveTo(tip, -104); q.quadraticCurveTo(5 + tip * 0.4, -78, 30, -56); q.bezierCurveTo(48, -36, 38, -2, 0, -2); q.bezierCurveTo(-38, -2, -48, -36, -30, -56); q.quadraticCurveTo(-5 + tip * 0.4, -78, tip, -104); q.closePath(); };
      feet(g, 76, c);
      silhouette(g, [{ path: drop, fill: blobFill(g, c, 80, 104) }], c, o);
      const body = new Path2D(); drop(body);
      g.save(); g.clip(body);
      g.fillStyle = 'rgba(255,255,255,.2)'; g.beginPath(); g.ellipse(2, -30, 28, 24, 0, 0, TAU); g.fill();
      for (let i = 0; i < 5; i++) { const u = (t * 0.3 + i / 5) % 1, x = -20 + i * 10 + Math.sin(t * 2 + i) * 3, y = -14 - u * 66; g.strokeStyle = `rgba(255,255,255,${0.55 * (1 - u)})`; g.lineWidth = 1.4; g.beginPath(); g.arc(x, y, 1.6 + (i % 3) * 0.9, 0, TAU); g.stroke(); }
      g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(30, -48); g.quadraticCurveTo(38, -30, 30, -14); g.stroke();
      g.restore();
      shine(g, -15, -66, 5.5, 13); g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(-8, -84, 2.4, 0, TAU); g.fill();
      // мордочка
      eye(g, -13, -63, 10, st, { iris: '#1d4f9a' }); eye(g, 13, -63, 10, st, { iris: '#1d4f9a' });
      mouth(g, 0, -46, 17, s, 'o'); cheeks(g, 0, -50, 23, 5);
      // маримба: ножки, две планки рамы и бруски — длинные (низкие) слева, короткие (высокие) справа
      const BX = i => -30 + i * 12, BH = i => 25 - i * 2.2, CY = -17;
      g.lineCap = 'round'; g.lineJoin = 'round';
      for (const k of [-1, 1]) { g.strokeStyle = '#3a1e0a'; g.lineWidth = 6.5; g.beginPath(); g.moveTo(k * 36, CY + 4); g.lineTo(k * 40, -1); g.stroke(); g.strokeStyle = '#a0643a'; g.lineWidth = 3; g.stroke(); }
      for (const d of [-1, 1]) {
        const y0 = CY + d * (BH(0) / 2 - 5), y1 = CY + d * (BH(5) / 2 - 4);
        g.strokeStyle = '#3a1e0a'; g.lineWidth = 6; g.beginPath(); g.moveTo(-40, y0); g.lineTo(40, y1); g.stroke(); g.strokeStyle = '#8a5028'; g.lineWidth = 3; g.stroke();
      }
      for (let i = 0; i < 6; i++) {
        const lit = i === bar ? p : 0, hgt = BH(i), y0 = CY - hgt / 2 + lit * 1.2;
        const bg = g.createLinearGradient(BX(i) - 5, 0, BX(i) + 5, 0); bg.addColorStop(0, lit > 0.3 ? '#ffe2b8' : '#ee9c62'); bg.addColorStop(1, lit > 0.3 ? '#e8a060' : '#a8522a');
        g.fillStyle = bg; g.strokeStyle = '#4a2010'; g.lineWidth = 2; g.beginPath(); g.roundRect(BX(i) - 5, y0, 10, hgt, 3); g.fill(); g.stroke();
        g.fillStyle = 'rgba(255,240,210,.55)'; g.fillRect(BX(i) - 3.2, y0 + 2.5, 1.8, hgt - 5);
        g.fillStyle = '#3a1a08'; for (const d of [-1, 1]) { g.beginPath(); g.arc(BX(i), CY + d * (hgt / 2 - 4.5), 1, 0, TAU); g.fill(); }
      }
      // брызги с бруска, по которому попали
      if (hit > 0.05 && s > 0.05) {
        g.fillStyle = '#e4f6ff'; g.strokeStyle = '#2a6ab0'; g.lineWidth = 1.3; const u = 1 - hit;
        for (const j of [-1, 0, 1]) { const x = BX(bar) + j * (4 + u * 9), y = CY - 6 - u * 14 * (1.2 - Math.abs(j) * 0.4) + u * u * 6; g.beginPath(); g.arc(x, y, 2.2 - u * 0.6, 0, TAU); g.fill(); g.stroke(); }
      }
      // ручки с палочками
      for (const k of [-1, 1]) {
        const mine = side === k ? p : 0, bi = side === k ? bar : (k < 0 ? 1 : 4);
        const lift = (1 - mine) * (12 + 3 * Math.sin(TAU * B + (k > 0 ? Math.PI : 0)) * act);
        const hx = BX(bi), hy = CY - 3 - lift, gx = hx + k * 17, gy = hy - 10;
        for (const [col, lw] of [[o, 11.5], [shade(c, 0.12), 7]]) { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(k * 29, -46); g.quadraticCurveTo(k * 42, -42, gx, gy); g.stroke(); }
        g.strokeStyle = '#4a2a10'; g.lineWidth = 3.8; g.beginPath(); g.moveTo(gx, gy); g.lineTo(hx, hy); g.stroke();
        g.strokeStyle = '#e0b070'; g.lineWidth = 1.8; g.stroke();
        g.fillStyle = k < 0 ? '#ff7aa8' : '#ffd23a'; g.strokeStyle = k < 0 ? '#7a1a3a' : '#7a5a10'; g.lineWidth = 2; g.beginPath(); g.arc(hx, hy, 4.6, 0, TAU); g.fill(); g.stroke();
        g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(hx - 1.5, hy - 1.6, 1.4, 0, TAU); g.fill();
        g.fillStyle = shade(c, 0.2); g.strokeStyle = o; g.lineWidth = 2.2; g.beginPath(); g.ellipse(gx, gy, 6, 5, k * 0.5, 0, TAU); g.fill(); g.stroke();
      }
    },
  },
  fyuti: {
    name: 'Фьюти', el: ['wind'], part: 'flute', price: 150, rate: 14, need: 1,
    desc: 'Пушистое облачко. Дует в дудочку и ведёт главную мелодию.', col: '#bfe9fb',
    draw(g, st) {
      const c = this.col, s = st.sing || 0, hit = st.hit || 0, t = st.t || 0, TAU = Math.PI * 2, o = '#4a86a8';
      const B = st.beat != null ? st.beat : t * 5 / 3, act = Math.min(1, s * 1.4 + (st.dance || 0) * 0.6);
      const nb = B - (1 - hit) * 0.24, n = Math.round(nb * 4) + Math.floor(nb / 4) * 3;
      // крылышки машут в такт
      for (const k of [-1, 1]) {
        g.save(); g.translate(k * 33, -62); g.rotate(k * (-0.3 + Math.sin(TAU * B + (k > 0 ? 0.6 : 0)) * 0.25 * (0.25 + act)));
        const F = [[14, -8, 14, 7, -0.55], [17, 0, 14, 6.5, -0.15], [14, 7, 10.5, 5.5, 0.25]].map(([x, y, rx, ry, a]) => { const q = new Path2D(); q.ellipse(k * x, y, rx, ry, k * a, 0, TAU); return q; });
        g.strokeStyle = o; g.lineWidth = 4.8; g.lineJoin = 'round'; for (const q of F) g.stroke(q);
        F.forEach((q, i) => { g.fillStyle = i === 1 ? '#f2fbff' : '#ffffff'; g.fill(q); });
        g.strokeStyle = 'rgba(74,134,168,.35)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(k * 6, -3); g.lineTo(k * 24, -9); g.moveTo(k * 6, 1); g.lineTo(k * 27, 1); g.stroke();
        g.restore();
      }
      feet(g, 70, '#9fc8dc');
      // облачко: пушинки чуть дышат
      const puffs = [[0, -50, 36, 34], [-26, -38, 20, 20], [26, -38, 20, 20], [-17, -78, 18, 16], [17, -80, 18, 16], [0, -88, 16, 14], [0, -22, 32, 20], [-34, -58, 12, 12], [34, -58, 12, 12]];
      const br = i => 1 + Math.sin(TAU * B / 2 + i * 1.3) * 0.025 * (0.4 + act);
      const cf = g.createLinearGradient(0, -102, 0, 0); cf.addColorStop(0, '#ffffff'); cf.addColorStop(0.55, '#eaf8ff'); cf.addColorStop(1, '#a6d6ee');
      silhouette(g, puffs.map(([x, y, rx, ry], i) => ({ path: q => q.ellipse(x, y, rx * br(i), ry * br(i), 0, 0, TAU), fill: cf })), c, o);
      g.strokeStyle = 'rgba(110,170,210,.35)'; g.lineWidth = 2.4; g.lineCap = 'round';
      for (const [x, y, r] of [[-17, -78, 15], [17, -80, 15], [0, -88, 13], [-26, -38, 17], [26, -38, 17]]) { g.beginPath(); g.arc(x, y, r, Math.PI * 0.25, Math.PI * 0.75); g.stroke(); }
      // завиток ветра на макушке
      g.strokeStyle = o; g.lineWidth = 2.6; g.beginPath(); g.moveTo(-2, -101); g.bezierCurveTo(-4, -112, 10, -116, 11, -108); g.bezierCurveTo(12, -102, 4, -102, 5, -107); g.stroke();
      shine(g, -16, -80, 7, 4.5); shine(g, -8, -66, 4, 2.6);
      // мордочка
      eye(g, -12, -60, 8.5, st, { lid: 1 }); eye(g, 12, -60, 8.5, st, { lid: 1 });
      g.strokeStyle = '#4a6a8a'; g.lineWidth = 2; for (const k of [-1, 1]) { g.beginPath(); g.arc(k * 12, -66 - s * 3, 9, Math.PI * (k < 0 ? 1.2 : 1.45), Math.PI * (k < 0 ? 1.55 : 1.8)); g.stroke(); }
      cheeks(g, 0, -49, 21, 5 + s * 1.5);
      mouth(g, -3, -44, 12, 0.15 + s * 0.45, 'o');
      // поперечная флейта: серебро, клапаны, пальчики-пушинки перебирают на каждой ноте
      const ang = 0.12 + Math.sin(TAU * B / 4) * 0.04 - s * 0.05;
      g.save(); g.translate(-14, -38); g.rotate(ang);
      const tb = g.createLinearGradient(0, -3.5, 0, 3.5); tb.addColorStop(0, '#ffffff'); tb.addColorStop(0.45, '#d4dde8'); tb.addColorStop(1, '#7d8ca0');
      g.fillStyle = tb; g.strokeStyle = '#3a4658'; g.lineWidth = 2; g.beginPath(); g.roundRect(0, -3.3, 74, 6.6, 3.3); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(58,70,88,.6)'; g.lineWidth = 1.2; for (const x of [22, 60]) { g.beginPath(); g.moveTo(x, -3.3); g.lineTo(x, 3.3); g.stroke(); }
      g.fillStyle = '#5a6678'; g.beginPath(); g.ellipse(11, -0.5, 2.6, 1.6, 0, 0, TAU); g.fill();
      const FING = [63, 62, 60, 56, 48, 32, 30, 15], mask = s > 0.05 ? FING[((n % 8) + 8) % 8] : 63;
      const KX = [28, 33, 38, 45, 50, 55];
      KX.forEach(x => { g.fillStyle = '#eef3f8'; g.strokeStyle = '#4a5668'; g.lineWidth = 1.2; g.beginPath(); g.arc(x, -0.5, 2.3, 0, TAU); g.fill(); g.stroke(); });
      for (const [hx, ks] of [[33, [0, 1, 2]], [50, [3, 4, 5]]]) {
        g.fillStyle = '#ffffff'; g.strokeStyle = o; g.lineWidth = 2; g.beginPath(); g.ellipse(hx, 6, 8, 5, 0, 0, TAU); g.fill(); g.stroke();
        for (const i of ks) { const down = mask >> (5 - i) & 1, y = down ? -2.6 : -7; g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(KX[i], y, 2.8, 2.6, 0, 0, TAU); g.fill(); g.stroke(); }
      }
      g.restore();
      // ноты улетают из флейты
      for (let i = 0; i < 3; i++) {
        const u = (t * 0.55 + i / 3) % 1, a = s * Math.sin(Math.PI * u);
        if (a < 0.03) continue;
        const x = 44 + u * 10 + Math.sin(u * 7 + i * 2) * 3, y = -50 - u * 50;
        g.fillStyle = `rgba(42,90,140,${a})`; g.strokeStyle = `rgba(42,90,140,${a})`; g.lineWidth = 1.6;
        g.beginPath(); g.ellipse(x, y, 3.4, 2.5, -0.4, 0, TAU); g.fill();
        g.beginPath(); g.moveTo(x + 3, y - 0.5); g.lineTo(x + 3, y - 11); g.quadraticCurveTo(x + 7, y - 8, x + 6.5, y - 4.5); g.stroke();
      }
    },
  },
  shursha: {
    name: 'Шурша', el: ['leaf'], part: 'shaker', price: 200, rate: 16, need: 2,
    desc: 'Лесной шуршун. Трясёт маракасами из орехов и хлопает в ладоши.', col: '#74cf4a',
    draw(g, st) {
      const c = this.col, o = shade(c, -0.6), s = st.sing || 0, t = st.t || 0, TAU = Math.PI * 2, w = 76, h = 92;
      const B = st.beat != null ? st.beat : t * 5 / 3, act = Math.min(1, s * 1.5 + (st.dance || 0) * 0.6);
      const lerp = (a, b, k) => a + (b - a) * k;
      // трясёт туда-сюда на каждую восьмую, а на 2 и 4 долю стукает маракасами друг о друга
      const shake = Math.sin(TAU * B * 2) * (0.15 + 0.85 * act);
      const x2 = ((B - 1) % 2 + 2) % 2, dist = Math.min(x2, 2 - x2), cl0 = act * Math.max(0, 1 - dist / 0.24), cl = cl0 * cl0 * (3 - 2 * cl0);
      // листья на макушке
      const sw = Math.sin(TAU * B) * 0.12 * act + Math.sin(t * 2) * 0.04;
      leafShape(g, -2, -88, 34, -1.95 + sw, '#4fae32'); leafShape(g, 2, -88, 30, -1.15 + sw * 1.3, '#62c43e'); leafShape(g, 0, -88, 20, -1.55 - sw, '#86d856');
      feet(g, w, c);
      silhouette(g, [{ path: q => SHAPES.pear(q, w, h), fill: blobFill(g, c, w, h) }], c, o);
      const body = new Path2D(); SHAPES.pear(body, w, h);
      g.save(); g.clip(body);
      g.fillStyle = shade(c, 0.4); g.beginPath(); g.ellipse(0, -22, 22, 18, 0, 0, TAU); g.fill();
      // узор из листиков по бокам
      g.fillStyle = rgba('#2f7a1f', 0.22);
      for (const [x, y, a] of [[-30, -40, -0.6], [-34, -24, -0.2], [30, -44, 0.6], [34, -26, 0.2], [-22, -62, -0.9], [22, -64, 0.9]]) { g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.moveTo(0, -7); g.quadraticCurveTo(5, 0, 0, 7); g.quadraticCurveTo(-5, 0, 0, -7); g.fill(); g.restore(); }
      g.restore();
      shine(g, -12, -74, 6, 9);
      eye(g, -12, -60, 8.5, st, { happy: true }); eye(g, 12, -60, 8.5, st, { happy: true });
      g.fillStyle = rgba('#2f7a1f', 0.45); for (const k of [-1, 1]) for (const [dx, dy] of [[0, 0], [4, 2], [-3, 3]]) { g.beginPath(); g.arc(k * (21 + dx), -48 + dy, 1.1, 0, TAU); g.fill(); }
      mouth(g, 0, -45, 18, s); cheeks(g, 0, -49, 20, 5);
      // маракасы-орехи
      const maraca = (x, y, a, k) => {
        g.save(); g.translate(x, y); g.rotate(a);
        g.lineCap = 'round'; g.strokeStyle = '#4a2a12'; g.lineWidth = 6.5; g.beginPath(); g.moveTo(0, 10); g.lineTo(0, -4); g.stroke();
        g.strokeStyle = '#c8904a'; g.lineWidth = 3; g.stroke();
        const ng = g.createRadialGradient(-3, -17, 1, 0, -13, 12); ng.addColorStop(0, '#ffe0a0'); ng.addColorStop(0.5, '#e09a48'); ng.addColorStop(1, '#a0602a');
        g.fillStyle = ng; g.strokeStyle = '#4a2a12'; g.lineWidth = 2.4; g.beginPath(); g.ellipse(0, -13, 8.5, 10, 0, 0, TAU); g.fill(); g.stroke();
        g.strokeStyle = k < 0 ? '#ff5a4a' : '#ffffff'; g.lineWidth = 2; g.beginPath(); for (let i = 0; i <= 6; i++) { const xx = -7.5 + i * 2.5; g.lineTo(xx, -9 + (i % 2) * 2.5); } g.stroke();
        g.fillStyle = '#7a4a22'; g.strokeStyle = '#3a1e0a'; g.lineWidth = 2; g.beginPath(); g.moveTo(-9, -18); g.quadraticCurveTo(-9.5, -27, 0, -27.5); g.quadraticCurveTo(9.5, -27, 9, -18); g.quadraticCurveTo(0, -15.5, -9, -18); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = 'rgba(255,220,170,.35)'; for (const [xx, yy] of [[-4, -22], [1, -24], [5, -21], [-1, -20]]) { g.beginPath(); g.arc(xx, yy, 1, 0, TAU); g.fill(); }
        g.strokeStyle = '#3a1e0a'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(0, -27); g.lineTo(1.5, -31); g.stroke();
        g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(-3.5, -12, 2, 3.5, 0.3, 0, TAU); g.fill();
        g.restore();
      };
      for (const k of [-1, 1]) {
        const hx = k * lerp(42, 17, cl), hy = lerp(-50 - k * shake * 3, -16, cl), a = lerp(k * 0.35 + shake * 0.45, -k * 0.95, cl);
        for (const [col, lw] of [[shade(c, -0.55), 14], [shade(c, -0.05), 9]]) { g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'round'; g.beginPath(); g.moveTo(k * 30, -42); g.quadraticCurveTo(k * lerp(40, 30, cl), lerp(-40, -24, cl), hx, hy); g.stroke(); }
        maraca(hx, hy, a, k);
        g.fillStyle = shade(c, 0.15); g.strokeStyle = o; g.lineWidth = 2.2; g.beginPath(); g.ellipse(hx, hy + 1, 6, 5, 0, 0, TAU); g.fill(); g.stroke();
        // «ш-ш»: дуги у головки на размахе
        const sa = act * (1 - cl) * Math.abs(shake);
        if (sa > 0.15) {
          const ex = hx + Math.sin(a) * 14, ey = hy - Math.cos(a) * 14, dir = Math.sign(shake) * k || 1;
          g.strokeStyle = `rgba(255,255,255,${sa * 0.9})`; g.lineWidth = 2.2;
          for (const r of [10, 14]) { g.beginPath(); g.arc(ex, ey, r, dir > 0 ? -0.5 : Math.PI - 0.5, dir > 0 ? 0.5 : Math.PI + 0.5); g.stroke(); }
        }
      }
      // хлопок!
      if (cl > 0.7 && s > 0.1) {
        g.strokeStyle = '#fff3a0'; g.lineWidth = 2.4; g.lineCap = 'round';
        for (const a of [-0.5, 0, 0.5, Math.PI - 0.5, Math.PI, Math.PI + 0.5]) { const r1 = 15, r2 = 15 + 7 * cl; g.beginPath(); g.moveTo(Math.cos(a) * r1, -29 + Math.sin(a) * r1); g.lineTo(Math.cos(a) * r2, -29 + Math.sin(a) * r2); g.stroke(); }
      }
    },
  },
  glubun: {
    name: 'Глубун', el: ['water'], part: 'bass', price: 300, rate: 20, need: 3,
    desc: 'Живёт в подводных пещерах. Его низкий бас слышно на дне моря.', col: '#2f8a92',
    draw(g, st) {
      const c = this.col, o = shade(c, -0.6), s = st.sing || 0, hit = st.hit || 0, t = st.t || 0, TAU = Math.PI * 2, w = 104, h = 80;
      const B = st.beat != null ? st.beat : t * 5 / 3, f = B - Math.floor(B), p = hit * hit * (3 - 2 * hit);
      const act = Math.min(1, s * 1.4 + (st.dance || 0) * 0.6), nod = act * 2.6 * Math.pow(Math.cos(Math.PI * f), 2);
      feet(g, w, c);
      const spikes = [[-34, -62, 9, 13], [-13, -76, 10, 14], [10, -76, 10, 15], [32, -62, 9, 12]].map(([x, y, r, hh]) => ({ path: q => { q.moveTo(x - r, y + 10); q.quadraticCurveTo(x - r * 0.4, y - hh * 0.5, x + r * 0.15, y - hh); q.quadraticCurveTo(x + r * 0.5, y - hh * 0.3, x + r, y + 10); q.closePath(); }, fill: '#7f8c7a' }));
      silhouette(g, [...spikes, { path: q => SHAPES.gum(q, w, h), fill: blobFill(g, c, w, h) }], c, o);
      const body = new Path2D(); SHAPES.gum(body, w, h);
      g.save(); g.clip(body);
      g.fillStyle = shade(c, 0.32); g.beginPath(); g.ellipse(0, -10, 38, 16, 0, 0, TAU); g.fill();
      g.strokeStyle = rgba('#1a4a50', 0.25); g.lineWidth = 1.8; for (const y of [-18, -12]) { g.beginPath(); g.moveTo(-26, y); g.quadraticCurveTo(0, y + 4, 26, y); g.stroke(); }
      g.restore();
      // светящиеся пятнышки, как у глубоководных рыб: вспыхивают на каждой ноте
      for (const [x, y, r] of [[-40, -44, 3], [-33, -56, 2.4], [-44, -30, 2.2], [38, -50, 2.8], [44, -36, 2.2], [26, -64, 2]]) {
        const gl = 0.35 + 0.65 * Math.max(p, s * 0.5);
        const gg = g.createRadialGradient(x, y, 0, x, y, r * 3); gg.addColorStop(0, `rgba(170,255,235,${gl * 0.6})`); gg.addColorStop(1, 'rgba(170,255,235,0)');
        g.fillStyle = gg; g.beginPath(); g.arc(x, y, r * 3, 0, TAU); g.fill();
        g.fillStyle = `rgba(210,255,245,${0.5 + gl * 0.5})`; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      }
      shine(g, -26, -62, 8, 4.5);
      // голова кивает на каждую долю
      g.save(); g.translate(0, nod);
      eye(g, -20, -58, 8, st, { iris: '#c8e84a', pupil: 0.6, lid: 1 }); eye(g, 20, -58, 8, st, { iris: '#c8e84a', pupil: 0.6, lid: 1 });
      g.strokeStyle = '#1a2a2a'; g.lineWidth = 3; g.lineCap = 'round'; for (const k of [-1, 1]) { g.beginPath(); g.moveTo(k * 12, -70 - s * 2); g.quadraticCurveTo(k * 20, -73 - s * 3, k * 28, -69); g.stroke(); }
      mouth(g, 0, -44, 27, s * 0.85, 'teeth'); cheeks(g, 0, -47, 30, 5.5);
      g.restore();
      // пузырьки изо рта
      for (let i = 0; i < 3; i++) { const u = (t * 0.7 + i / 3) % 1, a = s * (1 - u); if (a < 0.05) continue; g.strokeStyle = `rgba(230,250,255,${a})`; g.lineWidth = 1.6; g.beginPath(); g.arc(-26 - u * 14 + Math.sin(u * 9 + i) * 3, -46 - u * 50, 2.2 + i, 0, TAU); g.stroke(); }
      // бас-гитара: большой корпус, длинный гриф торчит вправо вверх
      const ang = -0.47 + Math.sin(TAU * B / 2) * 0.03 * act, ca = Math.cos(ang), sa = Math.sin(ang), OX = -17, OY = -13;
      const W = (x, y) => [OX + x * ca - y * sa, OY + x * sa + y * ca];
      g.save(); g.translate(OX, OY); g.rotate(ang);
      const sh = [[-5, 0, 18.5, 14], [11, -1, 12, 10.5]].map(([x, y, rx, ry]) => { const q = new Path2D(); q.ellipse(x, y, rx, ry, 0, 0, TAU); return q; });
      g.strokeStyle = '#3a0e08'; g.lineWidth = 5.4; g.lineJoin = 'round'; for (const q of sh) g.stroke(q);
      const bg = g.createRadialGradient(-2, -4, 2, 0, 0, 22); bg.addColorStop(0, '#ffc070'); bg.addColorStop(0.5, '#e0602e'); bg.addColorStop(1, '#7a1e12');
      g.fillStyle = bg; for (const q of sh) g.fill(q);
      g.fillStyle = '#f6ecd8'; g.strokeStyle = '#6a3a20'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(5, 4, 10, 6.5, 0.2, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = '#1a1a1a'; g.beginPath(); g.roundRect(0, -5, 4, 10, 1.5); g.fill(); g.beginPath(); g.roundRect(-11, -5, 3.5, 10, 1.5); g.fill();
      g.fillStyle = '#c8c8d0'; g.strokeStyle = '#4a4a5a'; g.lineWidth = 1; g.beginPath(); g.roundRect(-18, -4.5, 3.5, 9, 1); g.fill(); g.stroke();
      // гриф и голова с колками
      g.fillStyle = '#e8c890'; g.strokeStyle = '#5a3a18'; g.lineWidth = 2; g.beginPath(); g.roundRect(18, -3.6, 54, 7.2, 1.5); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(90,58,24,.6)'; g.lineWidth = 1; for (let i = 0; i < 8; i++) { const x = 24 + i * 6; g.beginPath(); g.moveTo(x, -3.6); g.lineTo(x, 3.6); g.stroke(); }
      g.fillStyle = '#5a3a18'; for (const x of [33, 45, 57]) { g.beginPath(); g.arc(x, 0, 1.1, 0, TAU); g.fill(); }
      g.fillStyle = '#9a2e1a'; g.strokeStyle = '#3a0e08'; g.lineWidth = 2; g.beginPath(); g.moveTo(71, -4); g.lineTo(84, -7); g.quadraticCurveTo(87, 0, 84, 6); g.lineTo(71, 4); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#f2f2f8'; g.strokeStyle = '#4a4a5a'; g.lineWidth = 1.2; for (const x of [75, 81]) for (const k of [-1, 1]) { g.beginPath(); g.ellipse(x, k * 8.5, 2.2, 2.6, 0, 0, TAU); g.fill(); g.stroke(); }
      // струны дрожат, пока нота звучит
      g.strokeStyle = 'rgba(255,250,235,.95)'; g.lineWidth = 1;
      for (let i = 0; i < 4; i++) { const y0 = -2.4 + i * 1.6; g.beginPath(); g.moveTo(-16, y0); for (let x = -11; x <= 72; x += 4) g.lineTo(x, y0 + Math.sin(x * 0.9 + t * 60 + i) * s * 1.1 * Math.max(0, 1 - Math.abs(x - 28) / 46)); g.stroke(); }
      g.restore();
      // левая лапа щиплет струны (оттягивает на каждой ноте), правая перебирает лады
      const limb = (x1, y1, cx, cy, x2, y2) => { g.lineCap = 'round'; for (const [col, lw] of [[shade(c, -0.55), 13], [shade(c, -0.05), 8]]) { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(x1, y1); g.quadraticCurveTo(cx, cy, x2, y2); g.stroke(); } };
      const [px, py] = W(6, -7 + p * 7), fret = 36 + [0, 14, 7, 21][Math.floor(B / 2) % 4 | 0], [fx, fy] = W(fret, 1);
      limb(-45, -34, -44, -12, px, py); limb(47, -44, 50, -26, fx, fy);
      g.fillStyle = shade(c, 0.18); g.strokeStyle = o; g.lineWidth = 2.2;
      for (const [x, y] of [[px, py], [fx, fy]]) { g.beginPath(); g.ellipse(x, y, 6, 5, ang, 0, TAU); g.fill(); g.stroke(); }
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
      const c = this.col, o = shade(c, -0.6), s = st.sing || 0, hit = st.hit || 0, t = st.t || 0, TAU = Math.PI * 2, w = 86, h = 80;
      const B = st.beat != null ? st.beat : t * 5 / 3, p = hit * hit * (3 - 2 * hit), act = Math.min(1, s * 1.4 + (st.dance || 0) * 0.6);
      const nb = B - (1 - hit) * 0.24, hand = Math.round(nb * 4) % 2 ? 1 : -1;
      // уши ловят ритм: качаются в такт и вздрагивают на каждом ударе
      const R = (x, y, a, cx, cy) => [cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a)];
      const earA = k => Math.sin(TAU * B / 2) * 0.1 * act + k * (p * (hand === k ? 0.16 : 0.07) + Math.sin(t * 1.7 + k) * 0.03);
      const earPath = (k, sc) => q => { const a = earA(k), P = [[k * 18, -70], [k * 50, -114], [k * 40, -64]].map(([x, y]) => R(k * 29 + (x - k * 29) * sc, -68 + (y + 68) * sc, a, k * 29, -68)); q.moveTo(P[0][0], P[0][1]); q.quadraticCurveTo(P[1][0], P[1][1], P[2][0], P[2][1]); q.closePath(); };
      feet(g, w, c);
      const tuft = { path: q => { q.moveTo(-12, -76); q.quadraticCurveTo(-8, -92, -2, -82); q.quadraticCurveTo(2, -98, 7, -82); q.quadraticCurveTo(13, -90, 13, -76); q.closePath(); }, fill: shade(c, 0.05) };
      silhouette(g, [...[-1, 1].map(k => ({ path: earPath(k, 1), fill: shade(c, -0.08) })), tuft, { path: q => SHAPES.gum(q, w, h), fill: blobFill(g, c, w, h) }], c, o);
      for (const k of [-1, 1]) { const q = new Path2D(); earPath(k, 0.62)(q); g.fillStyle = '#ffb6a0'; g.fill(q); }
      const body = new Path2D(); SHAPES.gum(body, w, h);
      g.save(); g.clip(body);
      g.fillStyle = shade(c, 0.4); g.beginPath(); g.ellipse(0, -30, 26, 20, 0, 0, TAU); g.fill();
      g.strokeStyle = rgba('#8a3a10', 0.35); g.lineWidth = 3; g.lineCap = 'round';
      for (const k of [-1, 1]) for (const d of [0, 7]) { g.beginPath(); g.moveTo(k * 44, -56 + d); g.lineTo(k * 34, -54 + d); g.stroke(); }
      g.restore();
      shine(g, -22, -66, 6, 9);
      eye(g, -14, -59, 8.5, st); eye(g, 14, -59, 8.5, st);
      g.fillStyle = '#7a3418'; g.beginPath(); g.ellipse(0, -50, 3.4, 2.4, 0, 0, TAU); g.fill();
      mouth(g, 0, -43, 19, s); cheeks(g, 0, -48, 25, 5);
      // бонги из кокосов
      const drum = (x, top, rx, lit) => {
        const hgt = rx * 1.15, q = new Path2D(); q.moveTo(x - rx, top); q.bezierCurveTo(x - rx, top + hgt * 1.2, x + rx, top + hgt * 1.2, x + rx, top); q.closePath();
        const cg = g.createRadialGradient(x - rx * 0.4, top + 4, 2, x, top + 6, rx * 1.3); cg.addColorStop(0, '#a8703a'); cg.addColorStop(1, '#4a2810');
        g.fillStyle = cg; g.strokeStyle = '#2a1408'; g.lineWidth = 2.4; g.fill(q); g.stroke(q);
        g.save(); g.clip(q); g.strokeStyle = 'rgba(255,220,170,.35)'; g.lineWidth = 1.2; for (let i = 0; i < 9; i++) { const xx = x - rx + 2 + i * rx / 4.4, yy = top + 6 + (i % 3) * 4; g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx + 2.5, yy + 3); g.stroke(); } g.restore();
        g.strokeStyle = '#e8c070'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(x - rx * 0.98, top + 3.5); g.quadraticCurveTo(x, top + 6.5, x + rx * 0.98, top + 3.5); g.stroke();
        g.fillStyle = lit > 0.3 ? '#fffaf0' : '#f2e2c0'; g.strokeStyle = '#4a2a12'; g.lineWidth = 2; g.beginPath(); g.ellipse(x, top, rx, rx * 0.32 * (1 - lit * 0.15), 0, 0, TAU); g.fill(); g.stroke();
        if (lit > 0.02) { g.strokeStyle = `rgba(160,110,60,${lit * 0.7})`; g.lineWidth = 1.2; const u = 0.4 + (1 - lit) * 0.5; g.beginPath(); g.ellipse(x, top, rx * u, rx * 0.32 * u, 0, 0, TAU); g.stroke(); }
      };
      g.fillStyle = '#5a3418'; g.strokeStyle = '#2a1408'; g.lineWidth = 2; g.beginPath(); g.roundRect(-8, -16, 16, 7, 2); g.fill(); g.stroke();
      drum(-21, -21, 17.5, hand < 0 ? p : 0); drum(22, -19, 14.5, hand > 0 ? p : 0);
      // ладошки шлёпают по очереди
      for (const k of [-1, 1]) {
        const dn = hand === k ? p : 0, bob = Math.sin(TAU * B + (k > 0 ? Math.PI : 0)) * 3 * act;
        const hx = k * (21 + 27 * (1 - dn)), hy = (k < 0 ? -25 : -23) - (1 - dn) * (8 + bob);
        g.lineCap = 'round'; for (const [col, lw] of [[shade(c, -0.55), 14], [shade(c, -0.05), 9]]) { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(k * 36, -42); g.quadraticCurveTo(k * (44 - 6 * dn), hy - 6, hx, hy); g.stroke(); }
        g.fillStyle = shade(c, 0.3); g.strokeStyle = o; g.lineWidth = 2.4; g.beginPath(); g.ellipse(hx, hy, 9, 6, k * 0.15, 0, TAU); g.fill(); g.stroke();
        g.fillStyle = '#ff9a8a'; g.beginPath(); g.ellipse(hx, hy + 1, 3.6, 2.4, 0, 0, TAU); g.fill(); for (const d of [-5, 0, 5]) { g.beginPath(); g.arc(hx + d, hy - 3, 1.3, 0, TAU); g.fill(); }
        if (dn > 0.55 && s > 0.05) { g.strokeStyle = '#fff6c0'; g.lineWidth = 2.2; for (const a of [-2.5, -1.9, -1.25, -0.65]) { const ex = hx + Math.cos(a) * 11, ey = hy + Math.sin(a) * 9; g.beginPath(); g.moveTo(ex, ey); g.lineTo(ex + Math.cos(a) * 6, ey + Math.sin(a) * 6); g.stroke(); } }
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
      const c = this.col, o = shade(c, -0.6), s = st.sing || 0, hit = st.hit || 0, t = st.t || 0, TAU = Math.PI * 2, w = 66, h = 104;
      const B = st.beat != null ? st.beat : t * 5 / 3, p = hit * hit * (3 - 2 * hit), act = Math.min(1, s * 1.4 + (st.dance || 0) * 0.6);
      const nb = B - (1 - hit) * 0.24, dir = Math.round(nb * 4) % 2 ? 1 : -1, bpb = st.bpb || 4;
      // травяная чёлка качается в такт
      for (let i = -3; i <= 3; i++) {
        const bx = i * 5, tx = i * 11 + Math.sin(TAU * B / 2 + i * 0.5) * 4 * act + Math.sin(t * 3 + i) * 1.5, ty = -124 + Math.abs(i) * 4;
        const col = ['#5fa83a', '#7cc84a', '#94d85a'][(i + 3) % 3];
        g.fillStyle = col; g.strokeStyle = '#2f5a1a'; g.lineWidth = 2; g.lineJoin = 'round';
        g.beginPath(); g.moveTo(bx - 3.5, -96); g.quadraticCurveTo(bx + (tx - bx) * 0.3 - 3, -114, tx, ty); g.quadraticCurveTo(bx + (tx - bx) * 0.3 + 3, -112, bx + 3.5, -96); g.closePath(); g.fill(); g.stroke();
      }
      feet(g, w, c);
      silhouette(g, [{ path: q => SHAPES.gum(q, w, h), fill: blobFill(g, c, w, h) }], c, o);
      // ромашка в чёлке
      g.save(); g.translate(-14, -100); g.rotate(Math.sin(TAU * B / 2) * 0.15 * act);
      g.fillStyle = '#ffffff'; g.strokeStyle = '#8a8a6a'; g.lineWidth = 1.2; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; g.beginPath(); g.ellipse(Math.cos(a) * 4.6, Math.sin(a) * 4.6, 3.6, 2.2, a, 0, TAU); g.fill(); g.stroke(); }
      g.fillStyle = '#ffc83a'; g.beginPath(); g.arc(0, 0, 2.8, 0, TAU); g.fill(); g.restore();
      shine(g, -14, -86, 5, 10);
      eye(g, -11, -72, 8, st, { lid: 1 }); eye(g, 11, -72, 8, st, { lid: 1 });
      g.fillStyle = rgba('#6a8a1a', 0.55); for (const k of [-1, 1]) for (const [dx, dy] of [[0, 0], [4, 2], [-3, 3]]) { g.beginPath(); g.arc(k * (18 + dx), -60 + dy, 1, 0, TAU); g.fill(); }
      mouth(g, 0, -57, 17, s); cheeks(g, 0, -61, 19, 4.5);
      // гитара
      const ang = -0.52 + Math.sin(TAU * B / bpb) * 0.03 * act, ca = Math.cos(ang), sa = Math.sin(ang), OX = -6, OY = -27;
      const W = (x, y) => [OX + x * ca - y * sa, OY + x * sa + y * ca];
      g.save(); g.translate(OX, OY); g.rotate(ang);
      const sh = [[-7, 0, 13, 15.5], [10, 0, 10, 12]].map(([x, y, rx, ry]) => { const q = new Path2D(); q.ellipse(x, y, rx, ry, 0, 0, TAU); return q; });
      g.strokeStyle = '#4a2410'; g.lineWidth = 5; g.lineJoin = 'round'; for (const q of sh) g.stroke(q);
      const gg = g.createRadialGradient(-2, -4, 2, 0, 0, 18); gg.addColorStop(0, '#ffd890'); gg.addColorStop(0.6, '#e09a48'); gg.addColorStop(1, '#a0582a');
      g.fillStyle = gg; for (const q of sh) g.fill(q);
      g.strokeStyle = '#7a3a1a'; g.lineWidth = 1.8; g.beginPath(); g.arc(3, 0, 6.4, 0, TAU); g.stroke();
      g.fillStyle = '#3a1a0a'; g.beginPath(); g.arc(3, 0, 4.8, 0, TAU); g.fill();
      g.fillStyle = '#5a2a10'; g.beginPath(); g.roundRect(-14, -6, 3.5, 12, 1); g.fill();
      g.fillStyle = '#9a5228'; g.strokeStyle = '#4a2410'; g.lineWidth = 1.8; g.beginPath(); g.roundRect(18, -3, 36, 6, 1.2); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(255,230,180,.65)'; g.lineWidth = 0.9; for (let i = 0; i < 7; i++) { const x = 23 + i * 4.6; g.beginPath(); g.moveTo(x, -3); g.lineTo(x, 3); g.stroke(); }
      g.fillStyle = '#7a3a1a'; g.strokeStyle = '#4a2410'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(53, -3.8); g.lineTo(64, -5); g.lineTo(65, 5); g.lineTo(53, 3.8); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#fff0c0'; g.strokeStyle = '#4a2410'; g.lineWidth = 1; for (const x of [56.5, 61]) for (const k of [-1, 1]) { g.beginPath(); g.arc(x, k * 6.2, 1.7, 0, TAU); g.fill(); g.stroke(); }
      // струны дрожат, пока звучит аккорд
      g.strokeStyle = 'rgba(255,250,230,.95)'; g.lineWidth = 0.9;
      for (let i = 0; i < 4; i++) { const y0 = -2.1 + i * 1.4; g.beginPath(); g.moveTo(-13, y0); for (let x = -9; x <= 54; x += 4) g.lineTo(x, y0 + Math.sin(x * 1.1 + t * 70 + i * 2) * s * 0.9 * Math.max(0, 1 - Math.abs(x - 20) / 36)); g.stroke(); }
      g.restore();
      // правая рука бренчит вверх-вниз на каждой ноте, левая держит аккорд — новый на каждый такт
      const limb = (x1, y1, cx, cy, x2, y2) => { g.lineCap = 'round'; for (const [col, lw] of [[shade(c, -0.55), 12], [shade(c, -0.05), 7.5]]) { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(x1, y1); g.quadraticCurveTo(cx, cy, x2, y2); g.stroke(); } };
      const [sx, sy] = W(5, dir * (9 - 18 * p)), fr = 28 + [0, 10, 5, 15][Math.floor(B / bpb) % 4 | 0], [fx, fy] = W(fr, -1);
      limb(-29, -50, -38, -30, sx, sy); limb(29, -52, 36, -42, fx, fy);
      g.fillStyle = shade(c, 0.2); g.strokeStyle = o; g.lineWidth = 2.2;
      g.beginPath(); g.ellipse(sx, sy, 5.5, 4.8, ang, 0, TAU); g.fill(); g.stroke();
      g.beginPath(); g.ellipse(fx, fy, 5, 6, ang, 0, TAU); g.fill(); g.stroke();
    },
  },
  gromofon: {
    name: 'Громофон', el: ['fire'], part: 'brass', price: 450, rate: 26, need: 5,
    desc: 'Вместо рта — труба. Когда он играет «па-пам», чайки сбиваются с курса.', col: '#ef8a3a',
    draw(g, st) {
      const c = this.col, o = shade(c, -0.6), s = st.sing || 0, hit = st.hit || 0, t = st.t || 0, TAU = Math.PI * 2, w = 96, h = 92;
      const B = st.beat != null ? st.beat : t * 5 / 3, p = hit * hit * (3 - 2 * hit), act = Math.min(1, s * 1.4 + (st.dance || 0) * 0.6);
      const nb = B - (1 - hit) * 0.24, n = Math.round(nb * 4) + Math.floor(nb / 4);
      // огонёк между рогами
      for (const [x, sc, ph] of [[-9, 0.55, 0], [0, 0.75, 1.7], [9, 0.5, 3.1]]) {
        const fk = 1 + Math.sin(t * 12 + ph) * 0.1 + s * 0.18 + p * 0.1;
        g.save(); g.translate(x, -88); g.scale(sc, sc * fk);
        g.fillStyle = '#ff6a1a'; g.strokeStyle = '#8a2a0a'; g.lineWidth = 2.4 / sc; g.beginPath(); g.moveTo(0, -30); g.quadraticCurveTo(14, -10, 10, 0); g.quadraticCurveTo(0, 6, -10, 0); g.quadraticCurveTo(-14, -10, 0, -30); g.fill(); g.stroke();
        g.fillStyle = '#ffd04a'; g.beginPath(); g.moveTo(0, -18); g.quadraticCurveTo(8, -6, 6, 0); g.quadraticCurveTo(0, 4, -6, 0); g.quadraticCurveTo(-8, -6, 0, -18); g.fill();
        g.restore();
      }
      feet(g, w, c);
      const horns = [-1, 1].map(k => ({ path: q => { q.moveTo(k * 20, -82); q.quadraticCurveTo(k * 38, -120, k * 54, -106); q.quadraticCurveTo(k * 44, -98, k * 36, -76); q.closePath(); }, fill: '#f2e2c0' }));
      silhouette(g, [...horns, { path: q => SHAPES.ball(q, w, h), fill: blobFill(g, c, w, h) }], c, o);
      g.strokeStyle = 'rgba(140,110,70,.55)'; g.lineWidth = 1.6; g.lineCap = 'round';
      for (const k of [-1, 1]) for (const u of [0.35, 0.55, 0.75]) { const x = k * (24 + u * 22), y = -86 - u * 20; g.beginPath(); g.moveTo(x - k * 3, y - 4); g.lineTo(x + k * 3, y + 4); g.stroke(); }
      const body = new Path2D(); SHAPES.ball(body, w, h);
      g.save(); g.clip(body); g.fillStyle = shade(c, 0.35); g.beginPath(); g.ellipse(0, -14, 30, 16, 0, 0, TAU); g.fill(); g.restore();
      shine(g, -24, -74, 7, 12);
      eye(g, -15, -66, 8.5, st, { happy: true }); eye(g, 15, -66, 8.5, st, { happy: true });
      g.strokeStyle = '#5a2a10'; g.lineWidth = 3; g.lineCap = 'round'; for (const k of [-1, 1]) { g.beginPath(); g.moveTo(k * 8, -78 - s * 3); g.quadraticCurveTo(k * 15, -82 - s * 4, k * 23, -78 - s * 2); g.stroke(); }
      // щёки надуваются на каждой ноте
      const puff = 6 + s * 6 + p * 2;
      for (const k of [-1, 1]) {
        const x = k * (15 + puff * 0.4), y = -44, cg = g.createRadialGradient(x - k * 2, y - 4, 1, x, y, puff);
        cg.addColorStop(0, shade(c, 0.5)); cg.addColorStop(0.7, shade(c, 0.15)); cg.addColorStop(1, rgba('#ef8a3a', 0));
        g.fillStyle = cg; g.beginPath(); g.arc(x, y, puff * 1.1, 0, TAU); g.fill();
        g.strokeStyle = rgba('#7a2a08', 0.35 + s * 0.3); g.lineWidth = 2; g.lineCap = 'round'; g.beginPath(); g.arc(x, y, puff, Math.PI * (k > 0 ? 0.05 : 0.45), Math.PI * (k > 0 ? 0.55 : 0.95)); g.stroke();
        g.fillStyle = 'rgba(255,100,110,.35)'; g.beginPath(); g.ellipse(x, y + 1, puff * 0.62, puff * 0.42, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(x - k * puff * 0.15 - 1, y - puff * 0.45, puff * 0.28, puff * 0.16, -0.4, 0, TAU); g.fill();
      }
      g.fillStyle = '#e8605a'; g.strokeStyle = '#5a1a14'; g.lineWidth = 2.2; g.beginPath(); g.ellipse(0, -43, 6, 5, 0, 0, TAU); g.fill(); g.stroke();
      // труба вместо рта: мундштук в губах, три клапана, раструб распахивается на каждой ноте
      const ang = -0.24 - s * 0.24 + Math.sin(TAU * B) * 0.03 * act, ca = Math.cos(ang), sa = Math.sin(ang), OX = 2, OY = -43;
      const W = (x, y) => [OX + x * ca - y * sa, OY + x * sa + y * ca];
      const gold = (y0, y1) => { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, '#fff2a8'); gr.addColorStop(0.45, '#ffc83a'); gr.addColorStop(1, '#a06a10'); return gr; };
      const masks = [0, 4, 6, 2, 3, 1, 5, 7], mask = s > 0.05 ? masks[((n % 8) + 8) % 8] : 0;
      g.save(); g.translate(OX, OY); g.rotate(ang); g.lineJoin = 'round'; g.lineCap = 'round';
      g.strokeStyle = '#6a4208'; g.lineWidth = 7; g.beginPath(); g.moveTo(24, 3); g.quadraticCurveTo(22, 11, 30, 11); g.lineTo(38, 11); g.quadraticCurveTo(44, 11, 42, 3); g.stroke();
      g.strokeStyle = '#ffc83a'; g.lineWidth = 3.4; g.stroke();
      g.fillStyle = gold(-2, 2); g.strokeStyle = '#6a4208'; g.lineWidth = 1.8; g.beginPath(); g.roundRect(2, -1.8, 42, 3.6, 1.8); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(2, -3); g.lineTo(8, -1.6); g.lineTo(8, 1.6); g.lineTo(2, 3); g.closePath(); g.fill(); g.stroke();
      const R = 11 * (1 + 0.22 * p + s * 0.06);
      g.fillStyle = gold(-R, R); g.beginPath(); g.moveTo(42, -2.2); g.quadraticCurveTo(51, -3, 56, -R); g.lineTo(57, R); g.quadraticCurveTo(51, 3, 42, 2.2); g.closePath(); g.fill(); g.stroke();
      const ig = g.createRadialGradient(56.5, 0, 1, 56.5, 0, R); ig.addColorStop(0, '#3a2204'); ig.addColorStop(1, '#a06a10');
      g.fillStyle = ig; g.beginPath(); g.ellipse(56.5, 0, 3.6, R, 0, 0, TAU); g.fill(); g.strokeStyle = '#fff0a0'; g.lineWidth = 2.2; g.stroke(); g.strokeStyle = '#6a4208'; g.lineWidth = 1; g.stroke();
      for (let i = 0; i < 3; i++) {
        const x = 26 + i * 6, dn = mask >> i & 1;
        g.fillStyle = gold(-8, 6); g.strokeStyle = '#6a4208'; g.lineWidth = 1.6; g.beginPath(); g.roundRect(x - 2.4, -7, 4.8, 13, 1.2); g.fill(); g.stroke();
        g.beginPath(); g.roundRect(x - 1, -10 + dn * 2.4, 2, 3.5, 0.5); g.fill(); g.stroke();
        g.fillStyle = '#fff6d0'; g.beginPath(); g.ellipse(x, -10.5 + dn * 2.4, 2.6, 1.4, 0, 0, TAU); g.fill(); g.stroke();
      }
      g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(10, -0.9); g.lineTo(22, -0.9); g.moveTo(44, -1.6); g.quadraticCurveTo(51, -2.6, 55, -R * 0.8); g.stroke();
      g.restore();
      // правая лапа жмёт на клапаны
      const limb = (x1, y1, cx, cy, x2, y2) => { g.lineCap = 'round'; for (const [col, lw] of [[shade(c, -0.55), 15], [shade(c, -0.05), 10]]) { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(x1, y1); g.quadraticCurveTo(cx, cy, x2, y2); g.stroke(); } };
      const [hx, hy] = W(32, 9);
      limb(40, -30, 44, -18, hx, hy);
      g.fillStyle = shade(c, 0.2); g.strokeStyle = o; g.lineWidth = 2.2; g.beginPath(); g.ellipse(hx, hy, 8, 5.5, ang, 0, TAU); g.fill(); g.stroke();
      g.lineWidth = 1.6; for (let i = 0; i < 3; i++) if (mask >> i & 1) { const [fx, fy] = W(26 + i * 6, -12.2); g.beginPath(); g.ellipse(fx, fy, 2.4, 2, 0, 0, TAU); g.fill(); g.stroke(); }
      // левая лапа отстукивает такт по пузу
      const pat = act * Math.max(0, Math.sin(TAU * B)), lx = -20, ly = -24 - pat * 7;
      limb(-42, -36, -40, -18, lx, ly);
      g.fillStyle = shade(c, 0.2); g.lineWidth = 2.2; g.beginPath(); g.ellipse(lx, ly, 7.5, 6, 0.3, 0, TAU); g.fill(); g.stroke();
      // звук из раструба
      const [bx, by] = W(56, 0);
      if (s > 0.05) {
        g.strokeStyle = `rgba(255,240,170,${Math.min(1, s * 0.6 + p * 0.6)})`; g.lineWidth = 2.6; g.lineCap = 'round';
        for (const [r, sp] of [[5 + (1 - hit) * 3, 0.7], [9 + (1 - hit) * 3, 0.55]]) { g.beginPath(); g.arc(bx, by, r, ang - sp, ang + sp); g.stroke(); }
      }
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
      const c = this.col, o = shade(c, -0.6), s = st.sing || 0, hit = st.hit || 0, t = st.t || 0, TAU = Math.PI * 2, w = 78, h = 92;
      const B = st.beat != null ? st.beat : t * 5 / 3, p = hit * hit * (3 - 2 * hit), act = Math.min(1, s * 1.4 + (st.dance || 0) * 0.6);
      // кисточки на ушах шевелятся в такт
      const tw = k => Math.sin(TAU * B / 2 + (k > 0 ? 1 : 0)) * 0.12 * act + p * 0.08;
      const tufts = [-1, 1].map(k => ({ path: q => { const a = k * tw(k), cx = k * 22, cy = -84, P = [[k * 12, -86], [k * 30, -114], [k * 36, -76]].map(([x, y]) => [cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a)]); q.moveTo(P[0][0], P[0][1]); q.quadraticCurveTo((P[0][0] + P[1][0]) / 2 - k * 4, (P[0][1] + P[1][1]) / 2, P[1][0], P[1][1]); q.lineTo(P[2][0], P[2][1]); q.closePath(); }, fill: shade(c, -0.12) }));
      // лапки с коготками
      feet(g, w, '#e8a03a');
      g.strokeStyle = shade('#e8a03a', -0.55); g.lineWidth = 1.6; g.lineCap = 'round'; for (const k of [-1, 1]) for (const d of [-3.5, 3.5]) { g.beginPath(); g.moveTo(k * 17 + d, -1); g.lineTo(k * 17 + d, 3.5); g.stroke(); }
      silhouette(g, [...tufts, { path: q => SHAPES.gum(q, w, h), fill: blobFill(g, c, w, h) }], c, o);
      const body = new Path2D(); SHAPES.gum(body, w, h);
      g.save(); g.clip(body);
      g.fillStyle = '#f2e2c0'; g.beginPath(); g.ellipse(0, -26, 25, 25, 0, 0, TAU); g.fill();
      g.strokeStyle = rgba('#8a6a3a', 0.5); g.lineWidth = 1.6;
      for (let r = 0; r < 3; r++) for (let i = -2; i <= 2; i++) { const x = i * 8 + (r % 2) * 4 - 2, y = -36 + r * 9; if (Math.abs(x) > 20) continue; g.beginPath(); g.arc(x, y, 4, Math.PI * 0.15, Math.PI * 0.85); g.stroke(); }
      g.fillStyle = rgba('#5a4626', 0.2); for (const [x, y] of [[-30, -56], [-34, -44], [30, -58], [34, -42], [-24, -80], [24, -80]]) { g.beginPath(); g.ellipse(x, y, 4, 2.4, 0, 0, TAU); g.fill(); }
      g.restore();
      // лицевые диски
      const disc = 14 + s * 1.5;
      for (const k of [-1, 1]) { const dg = g.createRadialGradient(k * 15, -66, 4, k * 15, -66, disc); dg.addColorStop(0, '#fffaf0'); dg.addColorStop(0.75, '#f2e6d0'); dg.addColorStop(1, '#d8c4a0'); g.fillStyle = dg; g.beginPath(); g.arc(k * 15, -66, disc, 0, TAU); g.fill(); }
      g.strokeStyle = '#4a3a20'; g.lineWidth = 3; g.lineCap = 'round'; for (const k of [-1, 1]) { g.beginPath(); g.moveTo(k * 4, -77 - s * 2); g.quadraticCurveTo(k * 14, -84 - s * 3, k * 27, -80); g.stroke(); }
      eye(g, -15, -66, 10, st, { iris: '#ff9a20', pupil: 0.62, lid: 1 }); eye(g, 15, -66, 10, st, { iris: '#ff9a20', pupil: 0.62, lid: 1 });
      // щёчки надуваются
      const cp = 2.5 + s * 4 + p * 1.5;
      g.fillStyle = 'rgba(255,140,150,.5)'; g.strokeStyle = 'rgba(160,70,60,.45)'; g.lineWidth = 1.4; for (const k of [-1, 1]) { g.beginPath(); g.arc(k * (10 + cp * 0.45), -51, cp, 0, TAU); g.fill(); g.stroke(); }
      // свистулька-слайд: трубочка в клюве, поршень ходит туда-сюда — нота тянется и скользит
      const ext = s > 0.05 ? 0.5 + 0.45 * Math.sin(B * Math.PI / 2 + 0.6) : 0.2, ang = 0.9, ca = Math.cos(ang), sa = Math.sin(ang), OX = 1, OY = -49;
      const W = (x, y) => [OX + x * ca - y * sa, OY + x * sa + y * ca];
      const rodL = 28 + ext * 11;
      g.save(); g.translate(OX, OY); g.rotate(ang);
      g.strokeStyle = '#4a5a6a'; g.lineWidth = 3.2; g.lineCap = 'round'; g.beginPath(); g.moveTo(22, 0); g.lineTo(rodL, 0); g.stroke();
      g.strokeStyle = '#d8e2ec'; g.lineWidth = 1.4; g.stroke();
      g.strokeStyle = '#7a1a1a'; g.lineWidth = 4.4; g.beginPath(); g.arc(rodL + 3.6, 0, 3.6, 0, TAU); g.stroke(); g.strokeStyle = '#e04a4a'; g.lineWidth = 2.2; g.stroke();
      const tg = g.createLinearGradient(0, -3.8, 0, 3.8); tg.addColorStop(0, '#d0f4ff'); tg.addColorStop(0.5, '#5ac8f0'); tg.addColorStop(1, '#1a6a9a');
      g.fillStyle = tg; g.strokeStyle = '#14405a'; g.lineWidth = 1.8; g.beginPath(); g.roundRect(-1, -3.8, 24, 7.6, 2.5); g.fill(); g.stroke();
      g.fillStyle = '#ffffff'; for (const x of [12, 18]) g.fillRect(x, -3.1, 2, 6.2);
      g.fillStyle = '#14405a'; g.fillRect(4.5, -3.8, 3.5, 2.8);
      g.restore();
      // клюв
      g.fillStyle = '#ffb02a'; g.strokeStyle = '#7a4a10'; g.lineWidth = 2.4; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(-7, -57); g.quadraticCurveTo(0, -61, 7, -57); g.quadraticCurveTo(4, -49, 0, -45); g.quadraticCurveTo(-4, -49, -7, -57); g.closePath(); g.fill(); g.stroke();
      shine(g, -2.5, -56, 2, 1.4);
      // крылья: правое тянет поршень, левое поднимается на долгой ноте
      const wing = (x, y, a, len) => {
        g.save(); g.translate(x, y); g.rotate(a);
        const q = new Path2D();
        q.moveTo(-8, 0); q.bezierCurveTo(-11, len * 0.4, -8, len * 0.8, -3.5, len);
        q.quadraticCurveTo(-1.5, len + 3, 0.5, len - 2); q.quadraticCurveTo(2.5, len + 2.5, 4, len - 3.5); q.quadraticCurveTo(6.5, len - 0.5, 7, len - 6);
        q.bezierCurveTo(9.5, len * 0.55, 9.5, len * 0.2, 7, 0); q.closePath();
        g.fillStyle = shade(c, -0.2); g.strokeStyle = o; g.lineWidth = 2.4; g.lineJoin = 'round'; g.fill(q); g.stroke(q);
        g.save(); g.clip(q); g.fillStyle = shade(c, 0.08); g.beginPath(); g.ellipse(0, 0, 11, len * 0.42, 0, 0, TAU); g.fill();
        g.strokeStyle = rgba('#3a2a10', 0.3); g.lineWidth = 1.3; for (const yy of [len * 0.18, len * 0.32]) { g.beginPath(); g.arc(-3, yy, 3.5, 0.2, Math.PI - 0.2); g.arc(4, yy, 3.5, 0.2, Math.PI - 0.2); g.stroke(); }
        g.restore();
        g.strokeStyle = rgba('#3a2a10', 0.4); g.lineWidth = 1.3; g.beginPath(); g.moveTo(-2.5, len * 0.55); g.lineTo(-1.5, len * 0.9); g.moveTo(3, len * 0.55); g.lineTo(3.2, len * 0.88); g.stroke();
        g.restore();
      };
      const [rx, ry] = W(rodL + 3.6, 0), SX = 34, SY = -46, ra = Math.atan2(ry - SY, rx - SX) - Math.PI / 2;
      wing(SX, SY, ra, Math.hypot(rx - SX, ry - SY) + 2);
      wing(-34, -50, 0.3 + s * 1.05 + Math.sin(TAU * B / 2) * 0.16 * act, 27);
      // ноты вылетают из окошка свистульки
      const [wx, wy] = W(6, -4);
      for (let i = 0; i < 3; i++) {
        const u = (t * 0.5 + i / 3) % 1, al = s * Math.sin(Math.PI * u);
        if (al < 0.03) continue;
        const x = wx + 6 + u * 40 + Math.sin(u * 6 + i) * 2, y = wy - 8 - u * 56;
        g.fillStyle = `rgba(90,50,10,${al})`; g.strokeStyle = `rgba(90,50,10,${al})`; g.lineWidth = 1.6;
        g.beginPath(); g.ellipse(x, y, 3.3, 2.5, -0.4, 0, TAU); g.fill();
        g.beginPath(); g.moveTo(x + 3, y - 0.5); g.lineTo(x + 3, y - 11); g.quadraticCurveTo(x + 7, y - 8, x + 6.5, y - 4.5); g.stroke();
      }
    },
  },
  barabas: {
    name: 'Барабас', el: ['fire'], part: 'snare', price: 250, rate: 18, need: 2,
    desc: 'Барабанщик-марширолог. Держит ритм так, что под него можно ставить часы.', col: '#cf3d52',
    draw(g, st) {
      const c = this.col, o = shade(c, -0.6), s = st.sing || 0, hit = st.hit || 0, t = st.t || 0, TAU = Math.PI * 2, w = 84, h = 96;
      const B = st.beat != null ? st.beat : t * 5 / 3, f = B - Math.floor(B), p = hit * hit * (3 - 2 * hit), act = Math.min(1, s * 1.4 + (st.dance || 0) * 0.6);
      const nb = B - (1 - hit) * 0.24, hand = Math.round(nb * 4) % 2 ? -1 : 1;
      // огненный чубчик
      for (const [x, sc, ph] of [[-8, 0.45, 0], [2, 0.6, 1.9], [11, 0.42, 3.3]]) {
        const fk = 1 + Math.sin(t * 13 + ph) * 0.12 + p * 0.2;
        g.save(); g.translate(x, -92); g.rotate((x / 40) + Math.sin(TAU * B / 2) * 0.08 * act); g.scale(sc, sc * fk);
        g.fillStyle = '#ffb02a'; g.strokeStyle = '#8a2a0a'; g.lineWidth = 2.4 / sc; g.beginPath(); g.moveTo(0, -30); g.quadraticCurveTo(14, -10, 10, 0); g.quadraticCurveTo(0, 6, -10, 0); g.quadraticCurveTo(-14, -10, 0, -30); g.fill(); g.stroke();
        g.fillStyle = '#fff07a'; g.beginPath(); g.moveTo(0, -16); g.quadraticCurveTo(7, -5, 5, 0); g.quadraticCurveTo(0, 3, -5, 0); g.quadraticCurveTo(-7, -5, 0, -16); g.fill();
        g.restore();
      }
      feet(g, w, c);
      silhouette(g, [{ path: q => SHAPES.box(q, w, h), fill: blobFill(g, c, w, h) }], c, o);
      shine(g, -26, -70, 5, 10);
      // повязка с узлом и развевающимися концами
      g.fillStyle = '#ffd84a'; g.strokeStyle = '#8a6a10'; g.lineWidth = 2.2; g.beginPath(); g.roundRect(-43, -89, 86, 11, 4); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.45)'; g.fillRect(-38, -87, 76, 2.4);
      for (const [d, ph] of [[0, 0], [7, 1.2]]) { const fl = Math.sin(t * 7 + ph) * 3 + Math.sin(TAU * B) * 2 * act; g.beginPath(); g.moveTo(40, -86 + d * 0.3); g.quadraticCurveTo(50, -90 + d + fl, 58, -86 + d * 1.6 + fl * 1.4); g.lineTo(55, -80 + d * 1.4 + fl); g.quadraticCurveTo(48, -82 + d, 40, -80 + d * 0.3); g.closePath(); g.fillStyle = '#ffd84a'; g.fill(); g.stroke(); }
      g.beginPath(); g.ellipse(40, -83.5, 4, 5, 0, 0, TAU); g.fill(); g.stroke();
      // золотые эполеты
      for (const k of [-1, 1]) { g.fillStyle = '#ffd84a'; g.strokeStyle = '#8a6a10'; g.lineWidth = 2; g.beginPath(); g.ellipse(k * 38, -60, 8, 5, k * 0.3, 0, TAU); g.fill(); g.stroke(); g.lineWidth = 1.4; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(k * 38 + i * 3, -56); g.lineTo(k * 38 + i * 3.4, -51); g.stroke(); } }
      eye(g, -15, -65, 8.5, st); eye(g, 15, -65, 8.5, st);
      g.strokeStyle = '#2a1a22'; g.lineWidth = 3.4; g.lineCap = 'round'; for (const k of [-1, 1]) { g.beginPath(); g.moveTo(k * 7, -75 + p * 1.5); g.lineTo(k * 23, -79 + p * 1.5); g.stroke(); } // брови
      mouth(g, 0, -48, 20, Math.max(s, p * 0.4), 'teeth');
      // малый барабан: светлый корпус, золотые обода, верёвочная шнуровка
      const top = -27, bot = -9, RX = 26;
      for (const k of [-1, 1]) { g.strokeStyle = '#f6f2e6'; g.lineWidth = 4; g.beginPath(); g.moveTo(k * 22, top + 2); g.lineTo(k * 34, -48); g.stroke(); g.strokeStyle = 'rgba(90,60,40,.5)'; g.lineWidth = 1; g.stroke(); }
      const shell = g.createLinearGradient(-RX, 0, RX, 0); shell.addColorStop(0, '#c8c0b0'); shell.addColorStop(0.35, '#ffffff'); shell.addColorStop(0.7, '#e6e0d4'); shell.addColorStop(1, '#a8a090');
      g.fillStyle = shell; g.strokeStyle = '#3a3a5a'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(-RX, top); g.lineTo(-RX, bot); g.ellipse(0, bot, RX, 5, 0, Math.PI, 0, true); g.lineTo(RX, top); g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = '#d23a3a'; g.lineWidth = 1.8; g.beginPath(); for (let i = 0; i <= 8; i++) { const x = -RX + 3 + i * (RX * 2 - 6) / 8, y = i % 2 ? bot + 2 : top + 4; i ? g.lineTo(x, y + (i % 2 ? Math.sin((x / RX) * Math.PI / 2) ** 2 * 1.5 : 0)) : g.moveTo(x, y); } g.stroke();
      g.fillStyle = '#7a4a2a'; for (let i = 1; i < 8; i += 2) { const x = -RX + 3 + i * (RX * 2 - 6) / 8; g.fillRect(x - 2, bot - 4, 4, 3); }
      g.fillStyle = '#ffcf4a'; g.strokeStyle = '#8a6010'; g.lineWidth = 1.8;
      g.beginPath(); g.ellipse(0, bot, RX, 5, 0, 0, Math.PI); g.lineTo(-RX, bot - 2.5); g.ellipse(0, bot - 2.5, RX, 5, 0, Math.PI, 0, true); g.closePath(); g.fill(); g.stroke();
      const skin = g.createRadialGradient(-6, top - 2, 1, 0, top, RX); skin.addColorStop(0, '#ffffff'); skin.addColorStop(1, p > 0.3 ? '#fff6d8' : '#e8e0cc');
      g.fillStyle = '#ffcf4a'; g.beginPath(); g.ellipse(0, top, RX + 1.5, 7, 0, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = skin; g.strokeStyle = '#8a6010'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(0, top, RX - 2, 5, 0, 0, TAU); g.fill(); g.stroke();
      // палочки: бьют по очереди, отскакивают и снова замахиваются
      for (const k of [-1, 1]) {
        const d = hand === k ? p : 0, pre = act * 0.25 * f, up = (1 - d) * (0.75 + pre);
        const gx = k * (32 + 3 * up), gy = -38 - 8 * up, tx = k * 10 + k * 18 * up, ty = top - 1 - 34 * up;
        g.lineCap = 'round'; for (const [col, lw] of [[shade(c, -0.55), 15], [shade(c, -0.05), 10]]) { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(k * 40, -54); g.quadraticCurveTo(k * 44, -44, gx, gy); g.stroke(); }
        const ux = tx - gx, uy = ty - gy, L = Math.hypot(ux, uy) || 1, bx = gx - ux / L * 6, by = gy - uy / L * 6;
        g.strokeStyle = '#4a2a12'; g.lineWidth = 5; g.beginPath(); g.moveTo(bx, by); g.lineTo(tx, ty); g.stroke();
        g.strokeStyle = '#e8b878'; g.lineWidth = 2.6; g.stroke();
        g.fillStyle = '#f6dca8'; g.strokeStyle = '#4a2a12'; g.lineWidth = 1.6; g.beginPath(); g.arc(tx, ty, 3, 0, TAU); g.fill(); g.stroke();
        g.fillStyle = shade(c, 0.15); g.strokeStyle = o; g.lineWidth = 2.4; g.beginPath(); g.ellipse(gx, gy, 7, 6, 0, 0, TAU); g.fill(); g.stroke();
        if (d > 0.5 && s > 0.05) { g.strokeStyle = '#fff6a0'; g.lineWidth = 2.2; for (const a of [-2.6, -1.57, -0.55]) { g.beginPath(); g.moveTo(tx + Math.cos(a) * 6, ty + Math.sin(a) * 4); g.lineTo(tx + Math.cos(a) * 12, ty + Math.sin(a) * 8); g.stroke(); } }
      }
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
