/* Пришлый — иллюстрации, нарисованные кодом.
   Каждая сцена собирается из слоёв: небо, дальние горы, средний план, передний план, эффекты.
   Цвета слоёв выводятся из палитры времени суток: чем дальше слой, тем сильнее он растворяется
   в дымке горизонта. Так сто картинок выглядят как работа одного художника. */
(function () {
  'use strict';
  const R = (window.R = window.R || {});
  const f = (n) => Math.round(n * 10) / 10;
  const pts = (a) => a.map((p) => f(p[0]) + ',' + f(p[1])).join(' ');
  const poly = (a, extra) => `<polygon points="${pts(a)}"${extra || ''}/>`;
  const GOLD = '#d6b25e';
  const CLOTH = ['#8e3a2f', '#35597f', '#a8822f', '#4b7446', '#6b3f73', '#9a5a2a'];

  function hx(c) {
    c = c.replace('#', '');
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    return [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16));
  }
  function mix(a, b, t) {
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const A = hx(a), B = hx(b);
    return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
  }
  R.mix = mix;

  const PAL = {
    dawn:   { sky: ['#27325e', '#b25f7c', '#f3b57d'], sun: '#ffe1a6', near: '#22192f', light: '#ffcf7a' },
    day:    { sky: ['#3b78b8', '#8bbfe4', '#dcecf6'], sun: '#fff7da', near: '#2b4434', light: '#ffe49a' },
    golden: { sky: ['#4a74a2', '#d6b07a', '#f5d9a2'], sun: '#fff0c0', near: '#3a2a1a', light: '#ffd47a' },
    dusk:   { sky: ['#1b1937', '#7a3456', '#ec874a'], sun: '#ffcd7e', near: '#1c1125', light: '#ffb35c', dark: 1 },
    night:  { sky: ['#03061a', '#0b1736', '#1c2d57'], sun: '#f1efe0', near: '#060a17', light: '#ffc66b', dark: 1 },
    storm:  { sky: ['#13171d', '#313a45', '#5a646f'], sun: '#d8dde2', near: '#101418', light: '#ffd98a', dark: 1 },
    magic:  { sky: ['#0c0420', '#35145a', '#7a3da2'], sun: '#f1dcff', near: '#120922', light: '#d8adff', dark: 1 },
    fire:   { sky: ['#150404', '#5a1608', '#d4582a'], sun: '#ffd28c', near: '#140705', light: '#ffb050', dark: 1 },
    winter: { sky: ['#7c97b2', '#bccad7', '#eaf0f4'], sun: '#ffffff', near: '#2f3d4c', light: '#ffd98a', snow: '#f1f5f9' },
    winnight: { sky: ['#050a1e', '#15254a', '#34507a'], sun: '#eef2ff', near: '#0a1222', light: '#ffc66b', snow: '#b9c8dc', dark: 1 },
    mist:   { sky: ['#5d686e', '#99a19c', '#c8cabd'], sun: '#f0eee0', near: '#2f3631', light: '#ffd98a' },
    spring: { sky: ['#5a98cf', '#a7d2e9', '#e6f5ee'], sun: '#fffbe0', near: '#2a5232', light: '#fff0a0' },
    // Интерьеры: wall — цвет стены, он же «дымка» для дальних предметов.
    tavern:   { wall: '#6a4327', floor: '#3b2414', near: '#170e07', light: '#ffb45e', tex: 'logs', dark: 1 },
    kitchen:  { wall: '#5f4630', floor: '#3a2a1b', near: '#160f08', light: '#ffb85e', tex: 'logs', dark: 1 },
    stone:    { wall: '#5a5754', floor: '#36322d', near: '#14110e', light: '#ffc777', tex: 'stone', dark: 1 },
    study:    { wall: '#4b3a2c', floor: '#2b2018', near: '#120c07', light: '#ffd28a', tex: 'planks', dark: 1 },
    noble:    { wall: '#55252e', floor: '#2b1a1b', near: '#14090b', light: '#ffd88f', tex: 'stone', dark: 1 },
    dungeon:  { wall: '#33373a', floor: '#1d2022', near: '#09090a', light: '#ff9a4a', tex: 'stone', dark: 1 },
    chapel:   { wall: '#6a6872', floor: '#3a3840', near: '#17161b', light: '#ffe6ae', tex: 'stone', dark: 1 },
    workshop: { wall: '#4a3e35', floor: '#29221c', near: '#110d0a', light: '#ffa244', tex: 'planks', dark: 1 },
    cave:     { wall: '#211b33', floor: '#17132a', near: '#07050c', light: '#b98cff', tex: 'none', dark: 1 },
    bath:     { wall: '#6b4a2d', floor: '#3d2a19', near: '#1a1008', light: '#ffc27a', tex: 'logs', dark: 1 },
  };

  let UID = 0;

  class Pic {
    constructor(key) {
      this.r = R.mulberry(R.hash(key));
      this.id = 'k' + (++UID).toString(36) + '_';
      this.o = [];
      this.d = [];
      this.n = 0;
      this.use('day');
    }
    use(name) { this.p = PAL[name]; this.hz = this.p.wall || this.p.sky[2]; return this; }
    rn(a, b) { return a + (b - a) * this.r(); }
    pk(a) { return a[Math.floor(this.r() * a.length)]; }
    add(s) { this.o.push(s); return this; }
    col(d) { return mix(this.hz, this.p.near, 0.12 + 0.88 * d); }
    shade(d, k) { return mix(this.col(d), '#000000', k === undefined ? 0.3 : k); }
    tint(c, d) { return mix(this.hz, c, 0.3 + 0.7 * d); }
    uid() { return this.id + (this.n++); }

    lin(stops, x2, y2) {
      const id = this.uid();
      this.d.push(`<linearGradient id="${id}" x1="0" y1="0" x2="${x2 || 0}" y2="${y2 === undefined ? 1 : y2}">` +
        stops.map((s) => `<stop offset="${s[0]}" stop-color="${s[1]}" stop-opacity="${s[2] === undefined ? 1 : s[2]}"/>`).join('') + '</linearGradient>');
      return `url(#${id})`;
    }
    rad(stops) {
      const id = this.uid();
      this.d.push(`<radialGradient id="${id}">` +
        stops.map((s) => `<stop offset="${s[0]}" stop-color="${s[1]}" stop-opacity="${s[2] === undefined ? 1 : s[2]}"/>`).join('') + '</radialGradient>');
      return `url(#${id})`;
    }
    glowF() {
      if (!this._gf) {
        this._gf = this.uid();
        this.d.push(`<filter id="${this._gf}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`);
      }
      return `url(#${this._gf})`;
    }
    blurF(sd) {
      const id = this.uid();
      this.d.push(`<filter id="${id}" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${sd}"/></filter>`);
      return `url(#${id})`;
    }
    svg() {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><defs>${this.d.join('')}</defs>${this.o.join('')}</svg>`;
    }

    /* ---------- небо ---------- */
    sky(name) {
      this.use(name);
      const s = this.p.sky;
      return this.add(`<rect width="800" height="450" fill="${this.lin([[0, s[0]], [0.5, s[1]], [0.76, s[2]], [1, s[2]]])}"/>`);
    }
    sun(x, y, r, op) {
      r = r || 28; op = op === undefined ? 1 : op;
      const c = this.p.sun;
      const g = this.rad([[0, c, 0.75 * op], [0.22, c, 0.3 * op], [1, c, 0]]);
      return this.add(`<circle cx="${x}" cy="${y}" r="${r * 6}" fill="${g}"/><circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity="${op}"/>`);
    }
    moon(x, y, r, o) {
      r = r || 20; o = o || {};
      const c = o.c || this.p.sun;
      let s = `<circle cx="${x}" cy="${y}" r="${r * 4}" fill="${this.rad([[0, c, 0.35], [1, c, 0]])}"/>`;
      if (o.crescent) s += `<path d="M${x},${y - r}A${r},${r} 0 1 1 ${x},${y + r}A${f(r * 0.68)},${r} 0 1 0 ${x},${y - r}Z" fill="${c}"/>`;
      else s += `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/><circle cx="${f(x - r * 0.3)}" cy="${f(y - r * 0.2)}" r="${f(r * 0.22)}" fill="#000" opacity=".08"/><circle cx="${f(x + r * 0.28)}" cy="${f(y + r * 0.3)}" r="${f(r * 0.15)}" fill="#000" opacity=".08"/><circle cx="${f(x + r * 0.1)}" cy="${f(y - r * 0.45)}" r="${f(r * 0.1)}" fill="#000" opacity=".07"/>`;
      return this.add(s);
    }
    stars(n, maxY) {
      n = n || 90; maxY = maxY || 250;
      let s = '';
      for (let i = 0; i < n; i++) {
        const x = this.rn(0, 800), y = Math.pow(this.r(), 1.4) * maxY, r = this.rn(0.4, 1.5);
        s += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" opacity="${f(this.rn(0.25, 0.95))}"${i % 6 === 0 ? ` class="tw" style="animation-delay:-${f(this.rn(0, 4))}s"` : ''}/>`;
      }
      return this.add(`<g fill="#fff">${s}</g>`);
    }
    clouds(n, y0, y1, op, c) {
      c = c || mix(this.p.sky[1], '#ffffff', 0.25);
      let s = '';
      for (let i = 0; i < n; i++) {
        const cx = this.rn(-40, 840), cy = this.rn(y0, y1), w = this.rn(70, 170);
        for (let j = 0; j < 5; j++) s += `<ellipse cx="${f(cx + this.rn(-w / 2, w / 2))}" cy="${f(cy + this.rn(-8, 8))}" rx="${f(w * this.rn(0.25, 0.45))}" ry="${f(w * this.rn(0.1, 0.17))}"/>`;
      }
      return this.add(`<g class="drift" fill="${c}" opacity="${op === undefined ? 0.55 : op}">${s}</g>`);
    }
    rays(x, y, n, op, len) {
      let s = '';
      len = len || 700;
      for (let i = 0; i < n; i++) {
        const a = this.rn(0, Math.PI * 2), w = this.rn(0.03, 0.08);
        s += poly([[x, y], [x + Math.cos(a - w) * len, y + Math.sin(a - w) * len], [x + Math.cos(a + w) * len, y + Math.sin(a + w) * len]]);
      }
      return this.add(`<g fill="${this.p.light}" opacity="${op || 0.08}">${s}</g>`);
    }
    beams(x0, x1, y0, op) { // лучи сверху вниз, как сквозь кроны или окна
      let s = '';
      for (let x = x0; x < x1; x += this.rn(60, 120)) {
        const w = this.rn(14, 40);
        s += poly([[x, y0], [x + w, y0], [x + w + 140, 450], [x + 120, 450]]);
      }
      return this.add(`<g fill="${this.p.light}" opacity="${op || 0.1}">${s}</g>`);
    }
    meteor(x0, y0, x1, y1) {
      const g = this.lin([[0, '#fff', 0], [1, '#fff', 0.95]], 1, 0);
      return this.add(`<path d="M${x0},${y0}L${x1},${y1}" stroke="${g}" stroke-width="3" stroke-linecap="round"/><circle cx="${x1}" cy="${y1}" r="16" fill="${this.rad([[0, '#fff', 0.9], [1, '#fff', 0]])}"/>`);
    }
    aurora(y, op) {
      let s = '';
      const cols = ['#5cf2b0', '#7ad8ff', '#b07bff'];
      for (let i = 0; i < 3; i++) {
        const c = cols[i], yy = y + i * 26;
        let p = `M-20,${yy}`;
        for (let x = 0; x <= 840; x += 60) p += ` Q${x + 30},${f(yy + this.rn(-40, 40))} ${x + 60},${f(yy + this.rn(-20, 20))}`;
        const g = this.lin([[0, c, 0], [0.5, c, 0.55], [1, c, 0]]);
        s += `<path d="${p}" stroke="${g}" stroke-width="${f(this.rn(28, 46))}" fill="none" opacity="${op || 0.6}"/>`;
      }
      return this.add(`<g class="drift" filter="${this.blurF(6)}">${s}</g>`);
    }

    /* ---------- рельеф ---------- */
    noise(n, rough) {
      const a = new Array(n + 1).fill(0);
      a[0] = this.r(); a[n] = this.r();
      let disp = 1;
      for (let st = n / 2; st >= 1; st /= 2) {
        for (let i = st; i < n; i += st * 2) a[i] = (a[i - st] + a[i + st]) / 2 + (this.r() - 0.5) * disp;
        disp *= rough;
      }
      const mn = Math.min(...a), mx = Math.max(...a);
      return a.map((v) => (v - mn) / (mx - mn || 1));
    }
    ridge(d, base, amp, rough, o) {
      o = o || {};
      const n = 64, v = this.noise(n, rough || 0.55);
      const X = (i) => f(-10 + (i * 820) / n), Y = (i) => f(base - amp * v[i]);
      let p = `M-10,450L-10,${Y(0)}`;
      for (let i = 1; i <= n; i++) p += `L${X(i)},${Y(i)}`;
      this.add(`<path d="${p}L810,450Z" fill="${o.fill || this.col(d)}"/>`);
      if (o.caps || this.p.snow) {
        const T = base - amp * 0.5;
        let top = '', bot = [];
        for (let i = 0; i <= n; i++) {
          const y = base - amp * v[i];
          top += (i ? 'L' : 'M') + X(i) + ',' + f(y);
          bot.push(X(i) + ',' + f(y < T ? Math.min(y + 16, T) : y));
        }
        this.add(`<path d="${top}L${bot.reverse().join('L')}Z" fill="${this.p.snow || '#f4f6f8'}" opacity=".85"/>`);
      }
      return this;
    }
    hills(d, base, amp, fq, fill) {
      amp = amp === undefined ? 30 : amp; fq = fq || 1;
      const a = this.rn(0, 6), b = this.rn(0, 6);
      let p = 'M-10,450';
      for (let x = -10; x <= 810; x += 10) p += `L${x},${f(base - amp * (0.55 + 0.3 * Math.sin(x * 0.007 * fq + a) + 0.15 * Math.sin(x * 0.019 * fq + b)))}`;
      if (!fill && this.p.snow) fill = mix(this.p.snow, this.col(d), 0.12 + 0.22 * d);
      return this.add(`<path d="${p}L810,450Z" fill="${fill || this.col(d)}"/>`);
    }
    ground(d, y, fill) { return this.hills(d, y, 8, 1.5, fill); }
    mound(x, b, w, h, d, fill) { // отдельный холм под замок или башню
      return this.add(`<path d="M${x - w},${b}C${x - w * 0.5},${b} ${x - w * 0.45},${b - h} ${x},${b - h}C${x + w * 0.45},${b - h} ${x + w * 0.5},${b} ${x + w},${b}L${x + w},450L${x - w},450Z" fill="${fill || (this.p.snow ? mix(this.p.snow, this.col(d), 0.25) : this.col(d))}"/>`);
    }
    cliff(x0, x1, top, d, side) { // скала с обрывом
      const c = this.col(d);
      const p = side === 'left'
        ? `M-10,450L-10,${top}L${x1 - 60},${top - 10}L${x1 - 20},${top + 20}L${x1},${top + 70}L${x1 + 20},${top + 160}L${x1 + 10},450Z`
        : `M810,450L810,${top}L${x0 + 60},${top - 10}L${x0 + 20},${top + 20}L${x0},${top + 70}L${x0 - 20},${top + 160}L${x0 - 10},450Z`;
      return this.add(`<path d="${p}" fill="${c}"/>`);
    }

    /* ---------- растительность ---------- */
    pine(x, b, h) {
      const w = h * 0.8;
      const P = [[0, -1], [0.28, -0.66], [0.16, -0.66], [0.42, -0.34], [0.26, -0.34], [0.5, -0.06], [0.07, -0.06], [0.07, 0], [-0.07, 0], [-0.07, -0.06], [-0.5, -0.06], [-0.26, -0.34], [-0.42, -0.34], [-0.16, -0.66], [-0.28, -0.66]];
      return poly(P.map((q) => [x + q[0] * w, b + q[1] * h]));
    }
    leafy(x, b, h, c2) {
      const r = h * 0.3;
      const fillAttr = c2 ? ` fill="${c2}"` : '';
      return `<rect x="${f(x - h * 0.04)}" y="${f(b - h * 0.5)}" width="${f(h * 0.08)}" height="${f(h * 0.5)}"/>` +
        `<g${fillAttr}><circle cx="${f(x)}" cy="${f(b - h * 0.68)}" r="${f(r)}"/><circle cx="${f(x - r * 0.7)}" cy="${f(b - h * 0.52)}" r="${f(r * 0.8)}"/><circle cx="${f(x + r * 0.75)}" cy="${f(b - h * 0.55)}" r="${f(r * 0.75)}"/><circle cx="${f(x + r * 0.1)}" cy="${f(b - h * 0.86)}" r="${f(r * 0.6)}"/></g>`;
    }
    bare(x, b, h) {
      const w = f(Math.max(1.2, h * 0.05));
      return `<path d="M${f(x)},${f(b)}L${f(x)},${f(b - h * 0.6)}L${f(x - h * 0.25)},${f(b - h * 0.95)}M${f(x)},${f(b - h * 0.45)}L${f(x + h * 0.3)},${f(b - h * 0.8)}L${f(x + h * 0.38)},${f(b - h * 0.92)}M${f(x)},${f(b - h * 0.62)}L${f(x + h * 0.06)},${f(b - h)}M${f(x - h * 0.13)},${f(b - h * 0.78)}L${f(x - h * 0.05)},${f(b - h * 0.92)}M${f(x + h * 0.18)},${f(b - h * 0.65)}L${f(x + h * 0.3)},${f(b - h * 0.62)}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round"/>`;
    }
    willow(x, b, h, d) {
      const c = this.col(d);
      const top = b - h, w = h * 0.55;
      let s = `<path d="M${f(x - h * 0.04)},${b}C${f(x - h * 0.06)},${f(b - h * 0.4)} ${f(x + h * 0.05)},${f(b - h * 0.6)} ${f(x)},${f(top + h * 0.2)}L${f(x + h * 0.05)},${f(top + h * 0.2)}C${f(x + h * 0.1)},${f(b - h * 0.6)} ${f(x + h * 0.02)},${f(b - h * 0.4)} ${f(x + h * 0.05)},${b}Z" fill="${c}"/>`;
      s += `<path d="M${f(x - w)},${f(top + h * 0.32)}C${f(x - w)},${f(top - h * 0.02)} ${f(x + w)},${f(top - h * 0.02)} ${f(x + w)},${f(top + h * 0.32)}Z" fill="${c}"/>`;
      let lines = '';
      for (let i = 0; i < 46; i++) {
        const t = i / 45, xx = x - w + t * 2 * w + this.rn(-6, 6);
        const y0 = top + h * 0.3 - Math.sin(t * Math.PI) * h * 0.18, y1 = y0 + this.rn(h * 0.35, h * 0.75) * (0.55 + 0.45 * Math.sin(t * Math.PI));
        lines += `M${f(xx)},${f(y0)}Q${f(xx + (t - 0.5) * 18)},${f((y0 + y1) / 2)} ${f(xx + (t - 0.5) * 26)},${f(y1)}`;
      }
      s += `<path d="${lines}" stroke="${c}" stroke-width="${f(Math.max(2, h * 0.016))}" fill="none" stroke-linecap="round"/>`;
      return this.add(s);
    }
    forest(d, base, kind, hMin, hMax, dens, x0, x1, fill) {
      kind = kind || 'pine'; hMin = hMin || 28; hMax = hMax || 56; dens = dens || 1;
      x0 = x0 === undefined ? -20 : x0; x1 = x1 === undefined ? 820 : x1;
      const c = fill || this.col(d);
      let s = '', x = x0;
      while (x < x1) {
        const h = this.rn(hMin, hMax), y = base + this.rn(-3, 5);
        if (kind === 'pine') s += this.pine(x, y, h);
        else if (kind === 'mixed') s += this.r() < 0.5 ? this.pine(x, y, h) : this.leafy(x, y, h * 0.9);
        else if (kind === 'dead') s += this.bare(x, y, h);
        else s += this.leafy(x, y, h);
        x += (this.rn(0.25, 0.55) * h) / dens;
      }
      return this.add(`<g fill="${c}" color="${c}">${s}</g>`);
    }
    tree(x, b, h, d, kind, leaf) {
      const c = this.col(d);
      const s = kind === 'pine' ? this.pine(x, b, h) : kind === 'dead' ? this.bare(x, b, h) : this.leafy(x, b, h, leaf);
      return this.add(`<g fill="${c}" color="${c}">${s}</g>`);
    }
    autumnTrees(x0, x1, b, hMin, hMax, d) {
      const leaves = ['#b8642a', '#c99a3a', '#8a3d22', '#a77b2c'];
      let x = x0;
      while (x < x1) {
        const h = this.rn(hMin, hMax);
        this.tree(x, b + this.rn(-4, 4), h, d, 'leafy', this.tint(this.pk(leaves), d));
        x += this.rn(0.4, 0.8) * h;
      }
      return this;
    }
    reeds(x0, x1, b, h, d) {
      let s = '';
      for (let x = x0; x < x1; x += this.rn(3, 9)) {
        const hh = this.rn(h * 0.5, h), lean = this.rn(-8, 8);
        s += `M${f(x)},${b}Q${f(x + lean * 0.3)},${f(b - hh * 0.5)} ${f(x + lean)},${f(b - hh)}`;
        if (this.r() < 0.3) s += `M${f(x + lean)},${f(b - hh)}l0,${f(hh * 0.18)}`;
      }
      return this.add(`<path d="${s}" stroke="${this.col(d)}" stroke-width="2" fill="none" stroke-linecap="round"/>`);
    }
    flowers(x0, x1, y0, y1, n, cols) {
      cols = cols || ['#f2d36b', '#f0f0e8', '#d77fa1', '#8fb4e8'];
      let s = '';
      for (let i = 0; i < n; i++) {
        const y = this.rn(y0, y1);
        s += `<circle cx="${f(this.rn(x0, x1))}" cy="${f(y)}" r="${f(1 + ((y - y0) / (y1 - y0)) * 2.4)}" fill="${this.pk(cols)}"/>`;
      }
      return this.add(`<g opacity=".9">${s}</g>`);
    }

    /* ---------- вода и дороги ---------- */
    water(y, sunX, o) {
      o = o || {};
      const s = this.p.sky;
      const g = this.lin([[0, mix(s[2], s[1], 0.25)], [1, mix(s[1], this.p.near, 0.5)]]);
      let str = `<rect x="0" y="${y}" width="800" height="${450 - y}" fill="${o.fill || g}"/>`;
      let l = '';
      const sx = sunX === undefined ? 400 : sunX;
      for (let i = 0; i < 30; i++) {
        const yy = y + Math.pow(this.r(), 1.6) * (450 - y), w = this.rn(10, 60) * (1 + (yy - y) / 120), xx = sx + this.rn(-1, 1) * (30 + (yy - y) * 1.2);
        l += `<rect x="${f(xx - w / 2)}" y="${f(yy)}" width="${f(w)}" height="${f(this.rn(1, 2.2))}"/>`;
      }
      str += `<g fill="${o.glint || this.p.sun}" opacity="${o.glintOp || 0.4}">${l}</g>`;
      return this.add(str);
    }
    river(xTop, yTop, xBot, wTop, wBot, fill) {
      const g = fill || this.lin([[0, this.p.sky[2]], [1, mix(this.p.sky[1], this.p.near, 0.35)]]);
      const m = (xTop + xBot) / 2 + this.rn(-120, 120), my = (yTop + 450) / 2, wm = (wTop + wBot) / 2;
      return this.add(`<path d="M${xTop - wTop},${yTop}Q${f(m - wm)},${f(my)} ${xBot - wBot},450L${xBot + wBot},450Q${f(m + wm)},${f(my)} ${xTop + wTop},${yTop}Z" fill="${g}"/>`);
    }
    road(xTop, yTop, xBot, wTop, wBot, d) {
      const c = this.p.snow ? mix(this.p.snow, this.col(d || 0.5), 0.12) : mix(this.col(d === undefined ? 0.5 : d), '#c8b48c', 0.28);
      return this.river(xTop, yTop, xBot, wTop, wBot, c);
    }
    puddles(n, y0, y1) {
      let s = '';
      for (let i = 0; i < n; i++) s += `<ellipse cx="${f(this.rn(40, 760))}" cy="${f(this.rn(y0, y1))}" rx="${f(this.rn(20, 60))}" ry="${f(this.rn(3, 7))}"/>`;
      return this.add(`<g fill="${this.p.sky[2]}" opacity=".5">${s}</g>`);
    }

    /* ---------- постройки ---------- */
    house(x, b, s, d, o) {
      o = o || {};
      const w = 56 * s, h = 34 * s, rh = 24 * s, c = this.col(d);
      const wall = o.wall || mix(c, this.hz, 0.14), roof = this.p.snow ? this.p.snow : mix(c, '#000', 0.12);
      const lit = o.lit === undefined ? !!this.p.dark : o.lit;
      let t = `<rect x="${f(x + w * 0.18)}" y="${f(b - h - rh * 0.9)}" width="${f(7 * s)}" height="${f(rh * 0.6)}" fill="${c}"/>`;
      t += `<rect x="${f(x - w / 2)}" y="${f(b - h)}" width="${f(w)}" height="${f(h)}" fill="${wall}"/>`;
      t += poly([[x - w / 2 - 5 * s, b - h + 1], [x, b - h - rh], [x + w / 2 + 5 * s, b - h + 1]], ` fill="${roof}"`);
      t += `<rect x="${f(x - w * 0.3)}" y="${f(b - h * 0.62)}" width="${f(9 * s)}" height="${f(h * 0.62)}" fill="${mix(c, '#000', 0.3)}"/>`;
      if (lit) t += `<circle cx="${f(x + w * 0.08 + 6 * s)}" cy="${f(b - h * 0.7 + 5 * s)}" r="${f(18 * s)}" fill="${this.rad([[0, this.p.light, 0.45], [1, this.p.light, 0]])}"/>`;
      t += `<rect x="${f(x + w * 0.08)}" y="${f(b - h * 0.7)}" width="${f(12 * s)}" height="${f(10 * s)}" fill="${lit ? this.p.light : mix(c, '#000', 0.25)}"/>`;
      this.add(t);
      if (o.smoke) this.smoke(x + w * 0.18 + 3.5 * s, b - h - rh * 0.9, 60 * s);
      return this;
    }
    village(x, b, n, s, d, o) {
      const hs = [];
      for (let i = 0; i < n; i++) hs.push({ x: x + (i - (n - 1) / 2) * 50 * s + this.rn(-12, 12) * s, b: b + this.rn(-8, 8) * s, s: s * this.rn(0.8, 1.15) });
      hs.sort((a, c) => a.b - c.b).forEach((h) => this.house(h.x, h.b, h.s, d, o));
      return this;
    }
    barn(x, b, s, d) {
      const c = this.col(d), w = 110 * s, h = 50 * s;
      return this.add(`<g fill="${c}"><rect x="${f(x - w / 2)}" y="${f(b - h)}" width="${f(w)}" height="${f(h)}"/>${poly([[x - w / 2 - 6 * s, b - h], [x - w * 0.3, b - h - 32 * s], [x + w * 0.3, b - h - 32 * s], [x + w / 2 + 6 * s, b - h]])}<rect x="${f(x - 14 * s)}" y="${f(b - 34 * s)}" width="${f(28 * s)}" height="${f(34 * s)}" fill="${mix(c, '#000', 0.35)}"/></g>`);
    }
    manor(x, b, s, d, o) {
      o = o || {};
      const c = this.col(d), lit = o.lit === undefined ? !!this.p.dark : o.lit, L = lit ? this.p.light : mix(c, '#000', 0.3);
      const roof = this.p.snow ? this.p.snow : mix(c, '#000', 0.12);
      let t = `<rect x="${f(x - 70 * s)}" y="${f(b - 50 * s)}" width="${f(120 * s)}" height="${f(50 * s)}" fill="${mix(c, this.hz, 0.1)}"/>`;
      t += poly([[x - 76 * s, b - 49 * s], [x - 10 * s, b - 86 * s], [x + 56 * s, b - 49 * s]], ` fill="${roof}"`);
      t += `<rect x="${f(x + 40 * s)}" y="${f(b - 110 * s)}" width="${f(36 * s)}" height="${f(110 * s)}" fill="${c}"/>`;
      for (let i = 0; i < 3; i++) t += `<rect x="${f(x + 40 * s + i * 13 * s)}" y="${f(b - 118 * s)}" width="${f(8 * s)}" height="${f(8 * s)}" fill="${c}"/>`;
      for (const [wx, wy] of [[-55, 34], [-30, 34], [-5, 34], [20, 34], [52, 80], [52, 50]]) t += `<rect x="${f(x + wx * s)}" y="${f(b - wy * s)}" width="${f(9 * s)}" height="${f(13 * s)}" fill="${L}"/>`;
      if (lit) t += `<circle cx="${f(x - 10 * s)}" cy="${f(b - 28 * s)}" r="${f(70 * s)}" fill="${this.rad([[0, this.p.light, 0.25], [1, this.p.light, 0]])}"/>`;
      return this.add(t);
    }
    castle(x, b, s, d, o) {
      o = o || {};
      const c = this.col(d), lit = o.lit === undefined ? !!this.p.dark : o.lit;
      const roof = this.p.snow ? this.p.snow : mix(c, '#000', 0.18), win = lit ? this.p.light : mix(c, '#000', 0.35);
      const merl = (x0, x1, y, mw) => { let m = ''; for (let xx = x0; xx < x1 - mw * 0.5; xx += mw * 2) m += `<rect x="${f(xx)}" y="${f(y - mw)}" width="${f(mw)}" height="${f(mw)}"/>`; return m; };
      let t = `<rect x="${f(x - 112 * s)}" y="${f(b - 55 * s)}" width="${f(224 * s)}" height="${f(55 * s)}"/>` + merl(x - 112 * s, x + 112 * s, b - 55 * s, 7 * s);
      t += `<rect x="${f(x - 40 * s)}" y="${f(b - 122 * s)}" width="${f(80 * s)}" height="${f(122 * s)}"/>` + merl(x - 40 * s, x + 40 * s, b - 122 * s, 8 * s);
      for (const sx of [-1, 1]) {
        const ox = x + sx * 112 * s;
        t += `<rect x="${f(ox - 16 * s)}" y="${f(b - 92 * s)}" width="${f(32 * s)}" height="${f(92 * s)}"/>` + merl(ox - 18 * s, ox + 18 * s, b - 92 * s, 6 * s);
        const ix = x + sx * 52 * s;
        t += `<rect x="${f(ix - 13 * s)}" y="${f(b - 150 * s)}" width="${f(26 * s)}" height="${f(150 * s)}"/>`;
        t += poly([[ix - 17 * s, b - 150 * s], [ix, b - 196 * s], [ix + 17 * s, b - 150 * s]], ` fill="${roof}"`);
        t += `<path d="M${f(ix)},${f(b - 196 * s)}V${f(b - 216 * s)}" stroke="${c}" stroke-width="${f(1.6 * s)}"/>` + poly([[ix, b - 216 * s], [ix + 16 * s * (o.flagDir || 1), b - 211 * s], [ix, b - 206 * s]], ` fill="${this.tint(o.flag || '#9b2c2c', d)}"`);
        t += `<rect x="${f(ix - 3 * s)}" y="${f(b - 128 * s)}" width="${f(6 * s)}" height="${f(12 * s)}" fill="${win}"/>`;
        t += `<rect x="${f(ox - 3 * s)}" y="${f(b - 70 * s)}" width="${f(6 * s)}" height="${f(11 * s)}" fill="${win}"/>`;
      }
      for (const [wx, wy] of [[-20, 100], [14, 100], [-20, 74], [14, 74]]) t += `<rect x="${f(x + wx * s)}" y="${f(b - wy * s)}" width="${f(6 * s)}" height="${f(12 * s)}" fill="${win}"/>`;
      t += `<path d="M${f(x - 13 * s)},${f(b)}V${f(b - 22 * s)}A${f(13 * s)},${f(13 * s)} 0 0 1 ${f(x + 13 * s)},${f(b - 22 * s)}V${f(b)}Z" fill="${mix(c, '#000', 0.4)}"/>`;
      if (lit) t += `<circle cx="${x}" cy="${f(b - 80 * s)}" r="${f(150 * s)}" fill="${this.rad([[0, this.p.light, 0.16], [1, this.p.light, 0]])}"/>`;
      return this.add(`<g fill="${c}">${t}</g>`);
    }
    tower(x, b, s, d, o) {
      o = o || {};
      const c = this.col(d), w = (o.slim ? 26 : 38) * s, h = (o.h || 150) * s, lit = o.lit === undefined ? !!this.p.dark : o.lit;
      let t = `<rect x="${f(x - w / 2)}" y="${f(b - h)}" width="${f(w)}" height="${f(h)}"/>`;
      if (o.ruined) t += poly([[x - w / 2, b - h], [x - w * 0.3, b - h - 14 * s], [x - w * 0.1, b - h - 4 * s], [x + w * 0.15, b - h - 20 * s], [x + w * 0.3, b - h - 6 * s], [x + w / 2, b - h - 10 * s], [x + w / 2, b - h]]);
      else if (o.flat) for (let i = 0; i < 3; i++) t += `<rect x="${f(x - w / 2 + i * w * 0.4)}" y="${f(b - h - 7 * s)}" width="${f(w * 0.2)}" height="${f(7 * s)}"/>`;
      else t += poly([[x - w / 2 - 6 * s, b - h], [x, b - h - (o.spire || 60) * s], [x + w / 2 + 6 * s, b - h]], ` fill="${this.p.snow || mix(c, '#000', 0.15)}"`);
      const wc = lit ? this.p.light : mix(c, '#000', 0.35);
      for (let i = 0; i < 3; i++) t += `<rect x="${f(x - 3 * s)}" y="${f(b - h * (0.25 + i * 0.25))}" width="${f(6 * s)}" height="${f(12 * s)}" fill="${o.glowTop && i === 2 ? this.p.light : wc}"/>`;
      this.add(`<g fill="${c}">${t}</g>`);
      if (o.glowTop) this.light(x, b - h * 0.78, 60 * s, 0.6);
      return this;
    }
    church(x, b, s, d, o) {
      o = o || {};
      const c = this.col(d), lit = o.lit === undefined ? !!this.p.dark : o.lit, roof = this.p.snow || mix(c, '#000', 0.15);
      let t = `<rect x="${f(x - 70 * s)}" y="${f(b - 46 * s)}" width="${f(90 * s)}" height="${f(46 * s)}"/>`;
      t += poly([[x - 74 * s, b - 45 * s], [x - 25 * s, b - 78 * s], [x + 24 * s, b - 45 * s]], ` fill="${roof}"`);
      t += `<rect x="${f(x + 20 * s)}" y="${f(b - 96 * s)}" width="${f(28 * s)}" height="${f(96 * s)}"/>`;
      t += poly([[x + 17 * s, b - 96 * s], [x + 34 * s, b - 150 * s], [x + 51 * s, b - 96 * s]], ` fill="${roof}"`);
      t += `<circle cx="${f(x - 25 * s)}" cy="${f(b - 30 * s)}" r="${f(7 * s)}" fill="${lit ? this.p.light : mix(c, '#000', 0.3)}"/>`;
      t += `<rect x="${f(x + 30 * s)}" y="${f(b - 80 * s)}" width="${f(8 * s)}" height="${f(14 * s)}" fill="${lit ? this.p.light : mix(c, '#000', 0.3)}"/>`;
      this.add(`<g fill="${c}">${t}</g>`);
      return this.sunSign(x + 34 * s, b - 158 * s, 6 * s);
    }
    sunSign(x, y, r, c) { // знак Светлого Ока
      c = c || GOLD;
      let rays = '';
      for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; rays += `M${f(x + Math.cos(a) * r * 1.3)},${f(y + Math.sin(a) * r * 1.3)}L${f(x + Math.cos(a) * r * 2)},${f(y + Math.sin(a) * r * 2)}`; }
      return this.add(`<g stroke="${c}" fill="none" stroke-width="${f(Math.max(1, r * 0.3))}"><circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}"/><path d="${rays}"/></g><circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.35)}" fill="${c}"/>`);
    }
    windmill(x, b, s, d) {
      const c = this.col(d), hy = b - 78 * s, sail = mix(c, this.hz, 0.45);
      let t = poly([[x - 18 * s, b], [x + 18 * s, b], [x + 11 * s, b - 70 * s], [x - 11 * s, b - 70 * s]], ` fill="${c}"`);
      t += poly([[x - 15 * s, b - 68 * s], [x, b - 88 * s], [x + 15 * s, b - 68 * s]], ` fill="${this.p.snow || mix(c, '#000', 0.15)}"`);
      t += `<rect x="${f(x - 5 * s)}" y="${f(b - 18 * s)}" width="${f(10 * s)}" height="${f(18 * s)}" fill="${mix(c, '#000', 0.35)}"/>`;
      let bl = '';
      for (const a of [15, 105, 195, 285]) bl += `<g transform="rotate(${a} ${f(x)} ${f(hy)})"><rect x="${f(x - 1.5 * s)}" y="${f(hy - 64 * s)}" width="${f(3 * s)}" height="${f(62 * s)}" fill="${c}"/><rect x="${f(x + 1.5 * s)}" y="${f(hy - 62 * s)}" width="${f(11 * s)}" height="${f(46 * s)}" fill="${sail}" opacity=".9"/></g>`;
      t += `<g class="spin" style="transform-origin:${f(x)}px ${f(hy)}px">${bl}</g><circle cx="${f(x)}" cy="${f(hy)}" r="${f(4 * s)}" fill="${c}"/>`;
      return this.add(t);
    }
    wheel(x, y, r, c, w, spin) {
      let sp = '';
      for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; sp += `M${f(x)},${f(y)}L${f(x + Math.cos(a) * r)},${f(y + Math.sin(a) * r)}`; }
      return this.add(`<g${spin ? ` class="spin-slow" style="transform-origin:${f(x)}px ${f(y)}px"` : ''} stroke="${c}" fill="none" stroke-width="${f(w)}"><circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}"/><path d="${sp}"/></g>`);
    }
    watermill(x, b, s, d, o) {
      o = o || {};
      this.house(x, b, s * 1.25, d, { smoke: !o.ruined, lit: false });
      const c = this.col(d);
      if (o.ruined) {
        this.add(`<g stroke="${c}" stroke-width="${f(4 * s)}" fill="none"><path d="M${f(x + 40 * s)},${f(b - 4 * s)}A${f(26 * s)},${f(26 * s)} 0 0 1 ${f(x + 80 * s)},${f(b - 30 * s)}"/><path d="M${f(x + 55 * s)},${f(b - 20 * s)}L${f(x + 75 * s)},${f(b - 44 * s)}M${f(x + 58 * s)},${f(b - 10 * s)}L${f(x + 86 * s)},${f(b - 12 * s)}"/></g>`);
        return this;
      }
      return this.wheel(x + 52 * s, b - 14 * s, 26 * s, c, 4 * s, true);
    }
    stall(x, b, s, d, color) {
      const c = this.col(d), cl = this.tint(color, d), cl2 = mix(cl, '#ffffff', 0.35), w = 70 * s;
      let t = `<rect x="${f(x - w / 2)}" y="${f(b - 26 * s)}" width="${f(w)}" height="${f(26 * s)}" fill="${c}"/>`;
      t += `<path d="M${f(x - w / 2 + 3 * s)},${f(b - 26 * s)}V${f(b - 62 * s)}M${f(x + w / 2 - 3 * s)},${f(b - 26 * s)}V${f(b - 62 * s)}" stroke="${c}" stroke-width="${f(3 * s)}"/>`;
      const n = 5;
      for (let i = 0; i < n; i++) t += poly([[x - w / 2 - 6 * s + (i * (w + 12 * s)) / n, b - 60 * s], [x - w / 2 - 6 * s + ((i + 1) * (w + 12 * s)) / n, b - 60 * s], [x - w / 2 - 6 * s + ((i + 1) * (w + 12 * s)) / n, b - 46 * s], [x - w / 2 - 6 * s + ((i + 0.5) * (w + 12 * s)) / n, b - 42 * s], [x - w / 2 - 6 * s + (i * (w + 12 * s)) / n, b - 46 * s]], ` fill="${i % 2 ? cl2 : cl}"`);
      for (let i = 0; i < 4; i++) t += `<circle cx="${f(x - w / 3 + i * 14 * s)}" cy="${f(b - 29 * s)}" r="${f(4 * s)}" fill="${this.tint(this.pk(['#c96b2c', '#d8b35a', '#7a9a4a', '#a33']), d)}"/>`;
      return this.add(t);
    }
    well(x, b, s, d) {
      const c = this.col(d);
      return this.add(`<g fill="${c}"><rect x="${f(x - 22 * s)}" y="${f(b - 24 * s)}" width="${f(44 * s)}" height="${f(24 * s)}" rx="${f(3 * s)}"/><rect x="${f(x - 20 * s)}" y="${f(b - 62 * s)}" width="${f(4 * s)}" height="${f(40 * s)}"/><rect x="${f(x + 16 * s)}" y="${f(b - 62 * s)}" width="${f(4 * s)}" height="${f(40 * s)}"/>${poly([[x - 30 * s, b - 58 * s], [x, b - 78 * s], [x + 30 * s, b - 58 * s]])}<path d="M${f(x)},${f(b - 58 * s)}V${f(b - 38 * s)}" stroke="${c}" stroke-width="${f(1.4 * s)}"/><rect x="${f(x - 5 * s)}" y="${f(b - 40 * s)}" width="${f(10 * s)}" height="${f(9 * s)}"/></g>`);
    }
    wall(x0, x1, b, h, d) {
      const c = this.col(d);
      let t = `<rect x="${x0}" y="${f(b - h)}" width="${x1 - x0}" height="${h}"/>`;
      for (let x = x0; x < x1; x += 18) t += `<rect x="${f(x)}" y="${f(b - h - 9)}" width="9" height="9"/>`;
      return this.add(`<g fill="${c}">${t}</g>`);
    }
    gate(x, b, s, d) {
      const c = this.col(d);
      let t = `<rect x="${f(x - 60 * s)}" y="${f(b - 130 * s)}" width="${f(120 * s)}" height="${f(130 * s)}"/>`;
      for (let i = 0; i < 4; i++) t += `<rect x="${f(x - 60 * s + i * 32 * s)}" y="${f(b - 142 * s)}" width="${f(16 * s)}" height="${f(12 * s)}"/>`;
      t += `<path d="M${f(x - 28 * s)},${f(b)}V${f(b - 52 * s)}A${f(28 * s)},${f(28 * s)} 0 0 1 ${f(x + 28 * s)},${f(b - 52 * s)}V${f(b)}Z" fill="${mix(c, '#000', 0.45)}"/>`;
      let port = '';
      for (let i = -3; i <= 3; i++) port += `M${f(x + i * 8 * s)},${f(b - 74 * s)}V${f(b - 40 * s)}`;
      t += `<path d="${port}M${f(x - 28 * s)},${f(b - 50 * s)}H${f(x + 28 * s)}" stroke="${c}" stroke-width="${f(2.5 * s)}"/>`;
      return this.add(`<g fill="${c}">${t}</g>`);
    }
    bridge(x0, x1, b, h, d, arches) {
      const c = this.col(d);
      let p = `M${x0},${b - h}H${x1}V${b}H${x0}Z`;
      const n = arches || 3, span = (x1 - x0) / n;
      for (let i = 0; i < n; i++) {
        const ax0 = x0 + i * span + span * 0.15, ax1 = x0 + (i + 1) * span - span * 0.15;
        p += `M${f(ax0)},${b}V${f(b - h * 0.35)}A${f((ax1 - ax0) / 2)},${f(h * 0.45)} 0 0 1 ${f(ax1)},${f(b - h * 0.35)}V${b}Z`;
      }
      let rail = '';
      for (let x = x0; x <= x1; x += 14) rail += `<rect x="${f(x)}" y="${b - h - 8}" width="5" height="8"/>`;
      return this.add(`<g fill="${c}"><path d="${p}" fill-rule="evenodd"/>${rail}</g>`);
    }
    townhouses(x0, x1, b, d, hMin, hMax) {
      const c = this.col(d), lit = !!this.p.dark;
      let t = '', x = x0;
      while (x < x1) {
        const w = this.rn(34, 56), h = this.rn(hMin || 70, hMax || 130);
        const wc = mix(c, this.hz, this.rn(0.05, 0.2));
        t += `<rect x="${f(x)}" y="${f(b - h)}" width="${f(w)}" height="${f(h)}" fill="${wc}"/>`;
        t += poly([[x - 3, b - h], [x + w / 2, b - h - w * 0.75], [x + w + 3, b - h]], ` fill="${this.p.snow || mix(c, '#000', 0.15)}"`);
        for (let yy = b - h + 12; yy < b - 18; yy += 22) for (let xx = x + 7; xx < x + w - 10; xx += 14) {
          const on = lit && this.r() < 0.35;
          t += `<rect x="${f(xx)}" y="${f(yy)}" width="6" height="10" fill="${on ? this.p.light : mix(wc, '#000', 0.3)}"/>`;
        }
        x += w + this.rn(-2, 2);
      }
      return this.add(t);
    }
    cityMedieval(b, d, s) {
      s = s || 1;
      const c = this.col(d);
      let roofs = '', x = 40;
      while (x < 760) {
        const w = this.rn(20, 40) * s, h = this.rn(20, 70) * s;
        roofs += `<rect x="${f(x)}" y="${f(b - h)}" width="${f(w)}" height="${f(h)}"/>` + poly([[x - 2, b - h], [x + w / 2, b - h - w * 0.7], [x + w + 2, b - h]]);
        x += w * this.rn(0.6, 1);
      }
      this.add(`<g fill="${mix(c, this.hz, 0.12)}">${roofs}</g>`);
      this.castle(560, b - 70 * s, 0.65 * s, d - 0.05);
      this.church(250, b - 30 * s, 1.5 * s, d);
      this.wall(20, 780, b + 18, 46 * s, d + 0.08);
      for (const tx of [60, 240, 420, 600, 760]) this.tower(tx, b + 18, 0.75 * s, d + 0.1, { flat: true, h: 90, lit: !!this.p.dark });
      return this;
    }
    ruins(x, b, s, d) {
      const c = this.col(d);
      let t = '';
      for (const [cx, h] of [[-90, 90], [-50, 130], [40, 110], [90, 60]]) t += poly([[x + (cx - 9) * s, b], [x + (cx - 9) * s, b - h * s], [x + (cx - 3) * s, b - (h + 10) * s], [x + (cx + 3) * s, b - (h - 6) * s], [x + (cx + 9) * s, b - (h + 4) * s], [x + (cx + 9) * s, b]]);
      t += `<path d="M${f(x - 59 * s)},${f(b - 130 * s)}A${f(50 * s)},${f(40 * s)} 0 0 1 ${f(x + 49 * s)},${f(b - 110 * s)}" stroke="${c}" stroke-width="${f(14 * s)}" fill="none"/>`;
      t += `<rect x="${f(x - 20 * s)}" y="${f(b - 10 * s)}" width="${f(40 * s)}" height="${f(10 * s)}" transform="rotate(-8 ${f(x)} ${f(b)})"/>`;
      return this.add(`<g fill="${c}">${t}</g>`);
    }
    menhir(x, b, h, d, glow) {
      const c = this.col(d);
      this.add(poly([[x - h * 0.16, b], [x - h * 0.12, b - h * 0.8], [x - h * 0.02, b - h], [x + h * 0.12, b - h * 0.88], [x + h * 0.17, b]], ` fill="${c}"`));
      if (glow) {
        let r = '';
        for (let i = 0; i < 5; i++) { const y = b - h * (0.2 + i * 0.14); r += `M${f(x - h * 0.06)},${f(y)}l${f(h * 0.05)},${f(-h * 0.05)}l${f(h * 0.05)},${f(h * 0.05)}`; }
        this.add(`<path d="${r}" stroke="${this.p.light}" stroke-width="2" fill="none" filter="${this.glowF()}" class="flicker"/>`);
      }
      return this;
    }
    cog(x, y, R0, teeth, c, op) {
      let p = '';
      const n = teeth * 2;
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2, r = i % 2 ? R0 * 0.82 : R0;
        const a2 = ((i + 0.5) / n) * Math.PI * 2;
        p += (i ? 'L' : 'M') + f(x + Math.cos(a) * r) + ',' + f(y + Math.sin(a) * r) + 'L' + f(x + Math.cos(a2) * r) + ',' + f(y + Math.sin(a2) * r);
      }
      p += `ZM${f(x + R0 * 0.3)},${f(y)}A${f(R0 * 0.3)},${f(R0 * 0.3)} 0 1 0 ${f(x - R0 * 0.3)},${f(y)}A${f(R0 * 0.3)},${f(R0 * 0.3)} 0 1 0 ${f(x + R0 * 0.3)},${f(y)}Z`;
      return this.add(`<path d="${p}" fill="${c}" fill-rule="evenodd" opacity="${op || 1}"/>`);
    }

    /* ---------- люди и звери ---------- */
    person(x, b, h, d, k, o) {
      k = k || 'man'; o = o || {};
      const c = o.c || this.col(d), r = h * 0.085, hy = b - h + r, sh = hy + r * 1.15, F = o.flip ? -1 : 1, H = h;
      const P = (a) => poly(a);
      let t = '', acc = '';
      const stroke = (dpath, w) => `<path d="${dpath}" stroke="${c}" stroke-width="${f(w)}" fill="none" stroke-linecap="round"/>`;
      if (k === 'lying') return this.add(`<g fill="${c}"><ellipse cx="${f(x)}" cy="${f(b - h * 0.07)}" rx="${f(h * 0.42)}" ry="${f(h * 0.075)}"/><circle cx="${f(x + h * 0.48)}" cy="${f(b - h * 0.09)}" r="${f(r)}"/></g>`);
      if (k === 'crouch') return this.add(`<g fill="${c}"><path d="M${f(x - h * 0.2)},${f(b)}Q${f(x - h * 0.25)},${f(b - h * 0.45)} ${f(x)},${f(b - h * 0.5)}Q${f(x + h * 0.2)},${f(b - h * 0.45)} ${f(x + h * 0.22)},${f(b)}Z"/><circle cx="${f(x + F * h * 0.1)}" cy="${f(b - h * 0.55)}" r="${f(r * 1.1)}"/>${o.dagger ? stroke(`M${f(x + F * h * 0.2)},${f(b - h * 0.3)}l${f(F * h * 0.18)},${f(-h * 0.08)}`, h * 0.02) : ''}</g>`);
      if (k === 'sit') {
        t = `<circle cx="${f(x)}" cy="${f(hy)}" r="${f(r)}"/>` + P([[x - 0.11 * H, sh], [x + 0.11 * H, sh], [x + 0.13 * H, b - 0.3 * H], [x + 0.3 * F * H, b - 0.28 * H], [x + 0.3 * F * H, b], [x + 0.22 * F * H, b], [x + 0.2 * F * H, b - 0.18 * H], [x - 0.13 * H, b - 0.16 * H]]);
        return this.add(`<g fill="${c}">${t}</g>`);
      }
      let body;
      const robe = ['cloak', 'robe', 'mage', 'priest', 'elder', 'monk'].indexOf(k) >= 0;
      if (k === 'woman' || k === 'dancer') {
        body = P([[x - 0.07 * H, sh], [x + 0.07 * H, sh], [x + 0.1 * H, b - 0.55 * H], [x + 0.19 * H, b], [x - 0.19 * H, b], [x - 0.1 * H, b - 0.55 * H]]);
        t += `<ellipse cx="${f(x - F * r * 0.3)}" cy="${f(hy + r * 0.5)}" rx="${f(r * 1.1)}" ry="${f(r * 1.7)}"/>`;
      } else if (robe) {
        body = P([[x - 0.08 * H, sh - r * 0.2], [x + 0.08 * H, sh - r * 0.2], [x + 0.21 * H, b], [x - 0.21 * H, b]]);
        if (k !== 'elder' && k !== 'priest') t += P([[x - r * 1.25, hy + r * 0.6], [x, hy - r * (k === 'mage' ? 3.4 : 1.9)], [x + r * 1.25, hy + r * 0.6]]);
        if (k === 'mage') t += `<ellipse cx="${f(x)}" cy="${f(hy - r * 0.2)}" rx="${f(r * 2.2)}" ry="${f(r * 0.35)}"/>`;
      } else {
        body = P([[x - 0.11 * H, sh], [x + 0.11 * H, sh], [x + 0.12 * H, b - 0.46 * H], [x + 0.075 * H, b], [x + 0.015 * H, b], [x, b - 0.4 * H], [x - 0.015 * H, b], [x - 0.075 * H, b], [x - 0.12 * H, b - 0.46 * H]]);
      }
      const headX = x + (k === 'elder' ? F * r * 0.6 : 0);
      t += `<circle cx="${f(headX)}" cy="${f(hy)}" r="${f(r)}"/>` + body;
      switch (k) {
        case 'soldier':
          acc += stroke(`M${f(x + F * 0.17 * H)},${f(b)}V${f(b - 1.3 * H)}`, H * 0.022) + P([[x + F * 0.17 * H - 0.025 * H, b - 1.28 * H], [x + F * 0.17 * H, b - 1.42 * H], [x + F * 0.17 * H + 0.025 * H, b - 1.28 * H]]);
          acc += `<path d="M${f(x - r * 1.3)},${f(hy - r * 0.1)}A${f(r * 1.3)},${f(r * 1.3)} 0 0 1 ${f(x + r * 1.3)},${f(hy - r * 0.1)}Z"/>`;
          break;
        case 'knight':
          acc += `<path d="M${f(x - r * 1.2)},${f(hy + r * 0.3)}A${f(r * 1.2)},${f(r * 1.3)} 0 0 1 ${f(x + r * 1.2)},${f(hy + r * 0.3)}Z"/>`;
          acc += P([[x - F * 0.26 * H, sh + 0.03 * H], [x - F * 0.06 * H, sh + 0.03 * H], [x - F * 0.06 * H, b - 0.62 * H], [x - F * 0.16 * H, b - 0.48 * H], [x - F * 0.26 * H, b - 0.62 * H]]);
          acc += stroke(`M${f(x + F * 0.12 * H)},${f(b - 0.5 * H)}L${f(x + F * 0.42 * H)},${f(b - 1.0 * H)}`, H * 0.02);
          break;
        case 'mage':
          acc += stroke(`M${f(x + F * 0.22 * H)},${f(b)}V${f(b - 1.12 * H)}`, H * 0.022);
          acc += `<circle cx="${f(x + F * 0.22 * H)}" cy="${f(b - 1.16 * H)}" r="${f(r * 0.8)}" fill="${this.p.light}" filter="${this.glowF()}" class="flicker"/>`;
          break;
        case 'priest':
          acc += `<circle cx="${f(x)}" cy="${f(sh + 0.12 * H)}" r="${f(r * 0.5)}" fill="${GOLD}"/>`;
          break;
        case 'elder':
          acc += stroke(`M${f(x + F * 0.24 * H)},${f(b)}L${f(x + F * 0.16 * H)},${f(b - 0.75 * H)}`, H * 0.025);
          break;
        case 'noble': case 'king':
          acc += P([[x - 0.13 * H, sh], [x + 0.13 * H, sh], [x + 0.24 * H, b], [x - 0.24 * H, b]], ` opacity=".85"`);
          if (k === 'king') acc += P([[x - r, hy - r * 0.6], [x - r, hy - r * 1.7], [x - r * 0.5, hy - r * 1.1], [x, hy - r * 1.9], [x + r * 0.5, hy - r * 1.1], [x + r, hy - r * 1.7], [x + r, hy - r * 0.6]], ` fill="${GOLD}"`);
          break;
        case 'archer':
          acc += `<path d="M${f(x + F * 0.2 * H)},${f(sh - 0.1 * H)}Q${f(x + F * 0.42 * H)},${f(b - 0.62 * H)} ${f(x + F * 0.2 * H)},${f(b - 0.3 * H)}" stroke="${c}" stroke-width="${f(H * 0.018)}" fill="none"/>`;
          break;
        case 'smith':
          acc += stroke(`M${f(x + F * 0.1 * H)},${f(sh + 0.05 * H)}L${f(x + F * 0.28 * H)},${f(hy - 0.12 * H)}`, H * 0.035) + `<rect x="${f(x + F * 0.28 * H - 0.07 * H)}" y="${f(hy - 0.2 * H)}" width="${f(0.14 * H)}" height="${f(0.08 * H)}"/>`;
          break;
        case 'reaper':
          acc += stroke(`M${f(x + F * 0.05 * H)},${f(b - 0.1 * H)}L${f(x + F * 0.32 * H)},${f(hy - 0.05 * H)}`, H * 0.02) + `<path d="M${f(x + F * 0.32 * H)},${f(hy - 0.05 * H)}Q${f(x + F * 0.55 * H)},${f(hy + 0.02 * H)} ${f(x + F * 0.62 * H)},${f(hy + 0.22 * H)}" stroke="${c}" stroke-width="${f(H * 0.025)}" fill="none"/>`;
          break;
        case 'cheer': case 'dancer':
          acc += stroke(`M${f(x - 0.09 * H)},${f(sh + 0.02 * H)}L${f(x - 0.2 * H)},${f(hy - 0.12 * H)}M${f(x + 0.09 * H)},${f(sh + 0.02 * H)}L${f(x + 0.2 * H)},${f(hy - 0.12 * H)}`, H * 0.04);
          break;
        case 'bucket':
          acc += P([[x + F * 0.16 * H, b - 0.5 * H], [x + F * 0.26 * H, b - 0.5 * H], [x + F * 0.24 * H, b - 0.38 * H], [x + F * 0.18 * H, b - 0.38 * H]]);
          break;
        case 'bard':
          acc += `<ellipse cx="${f(x + F * 0.05 * H)}" cy="${f(b - 0.58 * H)}" rx="${f(0.1 * H)}" ry="${f(0.07 * H)}" fill="${mix(c, '#c58b4a', 0.35)}"/>` + stroke(`M${f(x + F * 0.12 * H)},${f(b - 0.6 * H)}L${f(x + F * 0.3 * H)},${f(b - 0.8 * H)}`, H * 0.02);
          break;
        case 'torch':
          acc += stroke(`M${f(x + F * 0.14 * H)},${f(b - 0.5 * H)}L${f(x + F * 0.2 * H)},${f(hy - 0.05 * H)}`, H * 0.025);
          this.light(x + F * 0.2 * H, hy - 0.1 * H, H * 0.9, 0.5);
          acc += `<path d="M${f(x + F * 0.2 * H)},${f(hy - 0.28 * H)}q${f(-0.04 * H)},${f(0.12 * H)} 0,${f(0.2 * H)}q${f(0.04 * H)},${f(-0.08 * H)} 0,${f(-0.2 * H)}" fill="${this.p.light}" class="flicker"/>`;
          break;
        case 'lantern':
          acc += `<rect x="${f(x + F * 0.16 * H)}" y="${f(b - 0.55 * H)}" width="${f(0.08 * H)}" height="${f(0.1 * H)}" fill="${this.p.light}"/>`;
          this.light(x + F * 0.2 * H, b - 0.5 * H, H * 0.8, 0.45);
          break;
        case 'monk':
          acc += `<rect x="${f(x - 0.06 * H)}" y="${f(sh + 0.15 * H)}" width="${f(0.12 * H)}" height="${f(0.15 * H)}" fill="${mix(c, '#d8c69c', 0.4)}"/>`;
          break;
      }
      const g = `<g fill="${c}"${o.op ? ` opacity="${o.op}"` : ''}${o.filter ? ` filter="${o.filter}"` : ''}${o.rot ? ` transform="rotate(${o.rot} ${f(x)} ${f(b - h / 2)})"` : ''}>${t}${acc}</g>`;
      return this.add(g);
    }
    crowd(x0, x1, b, h, d, n, kinds, o) {
      kinds = kinds || ['man', 'woman', 'cloak'];
      const arr = [];
      for (let i = 0; i < n; i++) arr.push({ x: x0 + ((x1 - x0) * i) / Math.max(1, n - 1) + this.rn(-10, 10), b: b + this.rn(-6, 6), h: h * this.rn(0.85, 1.1), k: this.pk(kinds), fl: this.r() < 0.5 });
      arr.sort((a, c) => a.b - c.b).forEach((p) => this.person(p.x, p.b, p.h, d, p.k, Object.assign({ flip: p.fl }, o || {})));
      return this;
    }
    army(x0, x1, b, h, d, rows, o) {
      o = o || {};
      const c = this.col(d);
      let t = '';
      for (let r = 0; r < rows; r++) {
        const yb = b + r * h * 0.25, hh = h * (1 + r * 0.12);
        for (let x = x0 + this.rn(0, 8); x < x1; x += this.rn(6, 12) * (hh / 30)) {
          t += `<circle cx="${f(x)}" cy="${f(yb - hh * 0.92)}" r="${f(hh * 0.09)}"/><rect x="${f(x - hh * 0.1)}" y="${f(yb - hh * 0.82)}" width="${f(hh * 0.2)}" height="${f(hh * 0.82)}"/>`;
          if (this.r() < 0.6) t += `<path d="M${f(x + hh * 0.12)},${f(yb)}V${f(yb - hh * this.rn(1.3, 1.6))}" stroke="${c}" stroke-width="${f(Math.max(1, hh * 0.04))}"/>`;
        }
      }
      this.add(`<g fill="${c}">${t}</g>`);
      if (o.banners) for (let i = 0; i < o.banners; i++) this.banner(x0 + ((x1 - x0) * (i + 0.5)) / o.banners, b, h * 2.2, d, o.color || '#8e2a24');
      return this;
    }
    horse(x, b, sc, d, o) {
      o = o || {};
      const c = o.c || this.col(d), F = o.flip ? -1 : 1;
      if (o.rider) this.person(x - F * 2 * sc, b - 36 * sc, 50 * sc, d, o.rider, { c, flip: o.flip });
      const s = `<ellipse cx="0" cy="-40" rx="32" ry="12"/><polygon points="20,-46 36,-70 44,-67 36,-36"/><polygon points="36,-72 56,-58 53,-53 38,-62"/><polygon points="37,-71 39,-79 42,-70"/><polygon points="-24,-36 -19,-36 -20,0 -23,0"/><polygon points="-16,-36 -11,-36 -12,0 -15,0"/><polygon points="18,-36 23,-36 23,0 20,0"/><polygon points="26,-36 30,-36 29,0 26,0"/><path d="M-30,-44Q-44,-36 -40,-12L-36,-12Q-38,-34 -28,-40Z"/>`;
      return this.add(`<g fill="${c}" transform="translate(${f(x)},${f(b)}) scale(${f(F * sc * 100) / 100},${f(sc * 100) / 100})">${s}</g>`);
    }
    beast(x, b, sc, d, kind, o) {
      o = o || {};
      const c = o.c || this.col(d), F = o.flip ? -1 : 1;
      let s = '';
      if (kind === 'wolf') {
        s = '<ellipse cx="0" cy="-22" rx="22" ry="8"/><polygon points="-16,-18 -12,-18 -13,0 -16,0"/><polygon points="-9,-18 -6,-18 -6,0 -9,0"/><polygon points="10,-18 14,-18 14,0 11,0"/><polygon points="16,-18 19,-18 19,0 16,0"/><path d="M-20,-24Q-34,-20 -36,-8Q-30,-16 -20,-18Z"/>';
        s += o.howl ? '<polygon points="12,-28 18,-42 22,-54 27,-52 25,-44 27,-38 22,-22"/><polygon points="18,-44 16,-51 21,-47"/>' : '<polygon points="14,-26 24,-34 25,-41 28,-34 40,-29 38,-25 26,-21"/><polygon points="22,-33 21,-40 25,-36"/>';
      } else if (kind === 'deer') {
        s = '<ellipse cx="0" cy="-36" rx="26" ry="10"/><polygon points="16,-40 28,-62 34,-60 26,-34"/><polygon points="28,-64 42,-56 40,-52 30,-58"/><path d="M30,-64L26,-80L20,-86M26,-80L32,-90M31,-64L36,-78L42,-84M36,-78L34,-90" stroke="currentColor" stroke-width="2.4" fill="none"/><polygon points="-20,-32 -16,-32 -17,0 -19,0"/><polygon points="-12,-32 -8,-32 -9,0 -11,0"/><polygon points="12,-32 16,-32 16,0 14,0"/><polygon points="18,-32 22,-32 21,0 19,0"/>';
      } else if (kind === 'shadow') {
        s = '<path d="M-40,0Q-50,-50 -22,-80Q0,-104 24,-86Q42,-70 36,-40L44,0L30,0L26,-30Q10,-20 -6,-30L-14,0L-28,0L-26,-26Z"/><path d="M28,-62Q52,-40 50,-6L44,-6Q44,-36 22,-52Z"/><circle cx="24" cy="-84" r="15"/><polygon points="16,-94 6,-116 22,-98"/><polygon points="30,-96 40,-118 34,-94"/>';
      } else if (kind === 'raven') {
        s = '<ellipse cx="0" cy="-30" rx="13" ry="20" transform="rotate(20 0 -30)"/><circle cx="9" cy="-50" r="8"/><polygon points="15,-53 28,-48 15,-45"/><polygon points="-6,-14 -20,8 -4,4 4,-12"/><path d="M-2,-12L-2,0M4,-12L5,0" stroke="currentColor" stroke-width="2"/>';
      } else if (kind === 'dragon') {
        s = '<polygon points="-5,-4 -26,-62 -10,-50 0,-64 8,-46 20,-56 14,-6" opacity=".8"/><ellipse cx="0" cy="0" rx="28" ry="8"/><polygon points="20,-3 45,-14 56,-12 62,-15 66,-11 56,-6 44,-6 22,4"/><path d="M-26,2Q-55,12 -78,-4Q-60,8 -26,-3Z"/><polygon points="0,-2 -34,-74 -14,-62 -2,-80 10,-58 26,-70 16,-2"/>';
      }
      this.add(`<g fill="${c}" color="${c}" transform="translate(${f(x)},${f(b)}) scale(${f(F * sc * 100) / 100},${f(sc * 100) / 100})">${s}</g>`);
      if (o.eyes) this.add(`<g fill="#ff5a3c" filter="${this.glowF()}" class="flicker"><circle cx="${f(x + F * 20 * sc)}" cy="${f(b - 86 * sc)}" r="${f(2.6 * sc)}"/><circle cx="${f(x + F * 30 * sc)}" cy="${f(b - 86 * sc)}" r="${f(2.6 * sc)}"/></g>`);
      return this;
    }
    birds(n, x, y, spread, d, size) {
      let s = '';
      size = size || 1;
      for (let i = 0; i < n; i++) {
        const bx = x + this.rn(-spread, spread), by = y + this.rn(-spread * 0.4, spread * 0.4), w = this.rn(5, 9) * size;
        s += `M${f(bx - w)},${f(by)}q${f(w / 2)},${f(-w / 2)} ${f(w)},0q${f(w / 2)},${f(-w / 2)} ${f(w)},0`;
      }
      return this.add(`<path d="${s}" stroke="${this.col(d === undefined ? 0.9 : d)}" stroke-width="1.6" fill="none"/>`);
    }
    ship(x, y, sc, d, sails) {
      const c = this.col(d), sl = sails || mix(this.hz, '#f3ead6', 0.5);
      const s = `<polygon points="-62,-14 64,-16 50,2 -52,2"/><rect x="-14" y="-112" width="3" height="100"/><rect x="18" y="-100" width="3" height="88"/><polygon points="-36,-104 10,-104 14,-34 -40,-34" fill="${sl}"/><polygon points="-30,-112 6,-112 8,-104 -34,-104" fill="${sl}"/><polygon points="22,-94 52,-94 56,-34 22,-34" fill="${sl}"/><polygon points="-12,-112 4,-108 -12,-104"/>`;
      return this.add(`<g fill="${c}" transform="translate(${f(x)},${f(y)}) scale(${sc})">${s}</g>`);
    }
    cart(x, b, sc, d, cover) {
      const c = this.col(d);
      let s = `<rect x="-32" y="-30" width="64" height="16"/><path d="M32,-22L58,-16" stroke="${c}" stroke-width="3"/>`;
      if (cover) s += `<path d="M-32,-30Q0,-70 32,-30Z" fill="${mix(c, '#efe4cc', 0.45)}"/>`;
      this.add(`<g fill="${c}" transform="translate(${f(x)},${f(b)}) scale(${sc})">${s}</g>`);
      this.wheel(x - 18 * sc, b - 10 * sc, 10 * sc, c, 2.4 * sc);
      return this.wheel(x + 18 * sc, b - 10 * sc, 10 * sc, c, 2.4 * sc);
    }
    boat(x, y, sc, d) {
      const c = this.col(d);
      this.add(`<g fill="${c}" transform="translate(${f(x)},${f(y)}) scale(${sc})"><path d="M-40,-8H40L30,4H-32Z"/></g>`);
      return this.person(x + 6 * sc, y - 8 * sc, 30 * sc, d, 'man');
    }

    /* ---------- огонь, свет, погода ---------- */
    light(x, y, r, op, c) {
      c = c || this.p.light;
      return this.add(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${this.rad([[0, c, op === undefined ? 0.5 : op], [1, c, 0]])}"/>`);
    }
    flame(x, b, h) {
      const L = this.p.light;
      return this.add(`<g class="flicker" style="transform-origin:${f(x)}px ${f(b)}px"><path d="M${f(x - h * 0.35)},${f(b)}Q${f(x - h * 0.4)},${f(b - h * 0.5)} ${f(x)},${f(b - h)}Q${f(x + h * 0.15)},${f(b - h * 0.6)} ${f(x + h * 0.38)},${f(b - h * 0.55)}Q${f(x + h * 0.42)},${f(b - h * 0.2)} ${f(x + h * 0.32)},${f(b)}Z" fill="${mix(L, '#ff5a1f', 0.45)}"/><path d="M${f(x - h * 0.18)},${f(b)}Q${f(x - h * 0.2)},${f(b - h * 0.35)} ${f(x + h * 0.02)},${f(b - h * 0.68)}Q${f(x + h * 0.2)},${f(b - h * 0.3)} ${f(x + h * 0.18)},${f(b)}Z" fill="${L}"/><path d="M${f(x - h * 0.07)},${f(b)}Q${f(x - h * 0.08)},${f(b - h * 0.2)} ${f(x + h * 0.02)},${f(b - h * 0.38)}Q${f(x + h * 0.1)},${f(b - h * 0.15)} ${f(x + h * 0.08)},${f(b)}Z" fill="#fff6d8"/></g>`);
    }
    campfire(x, b, s) {
      this.light(x, b - 10 * s, 130 * s, 0.5);
      const c = this.col(1);
      this.add(`<g fill="${c}"><rect x="${f(x - 18 * s)}" y="${f(b - 5 * s)}" width="${f(36 * s)}" height="${f(5 * s)}" transform="rotate(12 ${f(x)} ${f(b)})"/><rect x="${f(x - 18 * s)}" y="${f(b - 5 * s)}" width="${f(36 * s)}" height="${f(5 * s)}" transform="rotate(-12 ${f(x)} ${f(b)})"/></g>`);
      return this.flame(x, b - 2 * s, 34 * s);
    }
    smoke(x, y, h, op, c) {
      c = c || mix(this.p.sky[2], '#7a7a7a', 0.3);
      let s = '';
      for (let i = 0; i < 7; i++) { const t = i / 6; s += `<circle cx="${f(x + t * h * 0.35 + this.rn(-3, 3))}" cy="${f(y - t * h)}" r="${f(3 + t * h * 0.22)}" opacity="${f((1 - t) * 0.55)}"/>`; }
      return this.add(`<g class="drift" fill="${c}" opacity="${op || 0.5}">${s}</g>`);
    }
    smokeColumn(x, b, h, w, op) {
      const c = mix(this.p.near, '#555555', 0.4);
      let s = '';
      for (let i = 0; i < 14; i++) { const t = i / 13; s += `<circle cx="${f(x + t * h * 0.4 + this.rn(-w * 0.3, w * 0.3))}" cy="${f(b - t * h)}" r="${f(w * (0.4 + t * 0.9))}"/>`; }
      return this.add(`<g class="drift" fill="${c}" opacity="${op || 0.55}">${s}</g>`);
    }
    fog(y, h, op) {
      const c = this.p.sky ? this.p.sky[2] : this.hz;
      const g = this.lin([[0, c, 0], [0.5, c, op || 0.55], [1, c, 0]]);
      let s = `<rect x="0" y="${f(y)}" width="800" height="${f(h)}" fill="${g}"/>`;
      let e = '';
      for (let i = 0; i < 6; i++) e += `<ellipse cx="${f(this.rn(0, 800))}" cy="${f(y + h * this.rn(0.3, 0.7))}" rx="${f(this.rn(80, 200))}" ry="${f(h * 0.2)}"/>`;
      return this.add(`${s}<g class="drift" fill="${c}" opacity="${f((op || 0.55) * 0.5)}">${e}</g>`);
    }
    rain(n, op, slant) {
      let s = '';
      const sl = slant === undefined ? -8 : slant;
      for (let i = 0; i < (n || 150); i++) { const x = this.rn(-20, 820), y = this.rn(-20, 450), l = this.rn(10, 22); s += `M${f(x)},${f(y)}l${sl},${f(l)}`; }
      return this.add(`<path d="${s}" stroke="#dfe8f0" stroke-width="1" opacity="${op || 0.3}"/>`);
    }
    snow(n, op) {
      let s = '';
      for (let i = 0; i < (n || 130); i++) s += `<circle cx="${f(this.rn(0, 800))}" cy="${f(this.rn(0, 450))}" r="${f(this.rn(0.8, 2.6))}"/>`;
      return this.add(`<g fill="#ffffff" opacity="${op || 0.8}" class="fall">${s}</g>`);
    }
    embers(n, x0, x1, y0, y1) {
      let s = '';
      for (let i = 0; i < n; i++) s += `<circle cx="${f(this.rn(x0, x1))}" cy="${f(this.rn(y0, y1))}" r="${f(this.rn(0.8, 2.2))}"/>`;
      return this.add(`<g fill="${this.p.light}" class="tw">${s}</g>`);
    }
    sparkles(n, x0, x1, y0, y1, c) {
      let s = '';
      for (let i = 0; i < n; i++) { const x = this.rn(x0, x1), y = this.rn(y0, y1), r = this.rn(1.5, 4); s += `M${f(x)},${f(y - r)}L${f(x + r * 0.25)},${f(y - r * 0.25)}L${f(x + r)},${f(y)}L${f(x + r * 0.25)},${f(y + r * 0.25)}L${f(x)},${f(y + r)}L${f(x - r * 0.25)},${f(y + r * 0.25)}L${f(x - r)},${f(y)}L${f(x - r * 0.25)},${f(y - r * 0.25)}Z`; }
      return this.add(`<path d="${s}" fill="${c || this.p.light}" class="tw"/>`);
    }
    wisps(n, x0, x1, y0, y1, c) {
      for (let i = 0; i < n; i++) this.light(this.rn(x0, x1), this.rn(y0, y1), this.rn(8, 16), 0.9, c || '#c9f7a8');
      return this;
    }
    lightning(x, y0, y1) {
      let p = `M${x},${y0}`, cx = x;
      for (let y = y0; y < y1; y += this.rn(18, 34)) { cx += this.rn(-26, 26); p += `L${f(cx)},${f(y)}`; }
      return this.add(`<rect width="800" height="450" fill="#e8eeff" opacity=".07"/><path d="${p}" stroke="#f4f7ff" stroke-width="3" fill="none" filter="${this.glowF()}"/>`);
    }
    explosion(x, y, r) {
      this.light(x, y, r * 3, 0.7, '#ffd27a');
      let spikes = '';
      for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2, rr = i % 2 ? r * 0.6 : r * this.rn(1, 1.5); spikes += (i ? 'L' : 'M') + f(x + Math.cos(a) * rr) + ',' + f(y + Math.sin(a) * rr); }
      this.add(`<path d="${spikes}Z" fill="#fff1c4"/>`);
      let deb = '';
      for (let i = 0; i < 16; i++) { const a = this.rn(-Math.PI, 0), rr = this.rn(r * 1.4, r * 3); deb += `<rect x="${f(x + Math.cos(a) * rr)}" y="${f(y + Math.sin(a) * rr)}" width="3" height="3"/>`; }
      return this.add(`<g fill="${this.col(1)}">${deb}</g>`);
    }
    vortex(x, y, r) {
      let s = '';
      for (let k = 0; k < 4; k++) {
        let p = '';
        for (let t = 0; t <= 1; t += 0.02) { const a = t * Math.PI * 5 + (k * Math.PI) / 2, rr = r * t; p += (t ? 'L' : 'M') + f(x + Math.cos(a) * rr) + ',' + f(y + Math.sin(a) * rr * 0.6); }
        s += `<path d="${p}" stroke="${k % 2 ? this.p.light : this.p.sun}" stroke-width="${2 + k}" fill="none" opacity="${0.25 + k * 0.12}"/>`;
      }
      this.light(x, y, r * 0.9, 0.55);
      return this.add(`<g class="spin-slow" style="transform-origin:${x}px ${y}px">${s}</g>`);
    }
    portal(x, y, rx, ry, o) {
      o = o || {};
      const L = this.p.light;
      this.light(x, y, rx * 2.4, 0.45, L);
      if (o.inside) {
        const cid = this.uid();
        this.d.push(`<clipPath id="${cid}"><ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}"/></clipPath>`);
        const saved = this.o; this.o = [];
        const savedP = this.p, savedHz = this.hz;
        this.use('night');
        this.add(`<rect x="${x - rx}" y="${y - ry}" width="${rx * 2}" height="${ry * 2}" fill="${this.lin([[0, '#0b1736'], [1, '#2a3f6e']])}"/>`);
        this.cityModern(y + ry * 0.55, 0.6, 0.55, x - rx, x + rx);
        this.add(`<rect x="${x - rx}" y="${f(y + ry * 0.55)}" width="${rx * 2}" height="${ry}" fill="#0b0f1a"/>`);
        const inner = this.o.join('');
        this.o = saved; this.p = savedP; this.hz = savedHz;
        this.add(`<g clip-path="url(#${cid})">${inner}</g>`);
      } else {
        this.add(`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${this.rad([[0, '#ffffff', 0.9], [0.5, L, 0.55], [1, L, 0.1]])}"/>`);
      }
      let sw = '';
      for (let i = 0; i < 3; i++) sw += `<ellipse cx="${x}" cy="${y}" rx="${f(rx * (1 + i * 0.07))}" ry="${f(ry * (1 + i * 0.07))}" stroke="${i ? L : '#fff'}" stroke-width="${3 - i * 0.8}" fill="none" opacity="${1 - i * 0.3}" stroke-dasharray="${i ? '40 18' : ''}"/>`;
      return this.add(`<g filter="${this.glowF()}" class="spin-slow" style="transform-origin:${x}px ${y}px">${sw}</g>`);
    }
    runeCircle(x, y, rx, ry) {
      const L = this.p.light;
      let star = '';
      for (let i = 0; i <= 5; i++) { const a = ((i * 2) / 5) * Math.PI * 2 - Math.PI / 2; star += (i ? 'L' : 'M') + f(x + Math.cos(a) * rx * 0.85) + ',' + f(y + Math.sin(a) * ry * 0.85); }
      let ticks = '';
      for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; ticks += `M${f(x + Math.cos(a) * rx * 1.05)},${f(y + Math.sin(a) * ry * 1.05)}l${f(Math.cos(a + 1) * 6)},${f(Math.sin(a + 1) * 4)}`; }
      this.light(x, y, rx * 1.6, 0.35);
      return this.add(`<g stroke="${L}" fill="none" stroke-width="2" filter="${this.glowF()}" class="flicker"><ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}"/><ellipse cx="${x}" cy="${y}" rx="${f(rx * 1.12)}" ry="${f(ry * 1.12)}"/><path d="${star}Z${ticks}"/></g>`);
    }
    crystals(x, b, s, c) {
      c = c || this.p.light;
      let t = '';
      for (const [dx, h, a] of [[-30, 70, -18], [-12, 110, -6], [8, 90, 10], [26, 60, 22], [-46, 40, -30], [40, 36, 34]]) t += `<polygon points="${f(-7 * s)},0 ${f(-6 * s)},${f(-h * s * 0.85)} 0,${f(-h * s)} ${f(6 * s)},${f(-h * s * 0.85)} ${f(7 * s)},0" transform="translate(${f(x + dx * s)},${f(b)}) rotate(${a})"/>`;
      this.light(x, b - 50 * s, 160 * s, 0.5, c);
      return this.add(`<g fill="${c}" opacity=".9" filter="${this.glowF()}">${t}</g>`);
    }
    garland(x0, x1, y, sag, kind) {
      const mx = (x0 + x1) / 2;
      let s = `<path d="M${x0},${y}Q${mx},${y + sag * 2} ${x1},${y}" stroke="${this.col(0.9)}" stroke-width="1.2" fill="none"/>`;
      for (let i = 1; i < 12; i++) {
        const t = i / 12, px = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * mx + t * t * x1, py = (1 - t) * (1 - t) * y + 2 * (1 - t) * t * (y + sag * 2) + t * t * y;
        if (kind === 'lanterns') { s += `<circle cx="${f(px)}" cy="${f(py + 5)}" r="4" fill="${this.p.light}"/>`; this.light(px, py + 5, 18, 0.5); }
        else s += poly([[px - 5, py], [px + 5, py], [px, py + 10]], ` fill="${this.tint(this.pk(CLOTH), 0.9)}"`);
      }
      return this.add(s);
    }
    banner(x, b, h, d, color, o) {
      o = o || {};
      const c = this.col(d), cl = this.tint(color || '#8e2a24', d), w = h * 0.28;
      this.add(`<path d="M${f(x)},${f(b)}V${f(b - h)}" stroke="${c}" stroke-width="${f(Math.max(1.5, h * 0.02))}"/>` + poly([[x, b - h], [x + w, b - h], [x + w, b - h + w * 1.5], [x + w / 2, b - h + w * 1.2], [x, b - h + w * 1.5]], ` fill="${cl}"`));
      if (o.sign) this.sunSign(x + w / 2, b - h + w * 0.6, w * 0.18);
      return this;
    }
    tent(x, b, s, d, o) {
      o = o || {};
      const c = this.col(d), cl = o.color ? this.tint(o.color, d) : mix(c, '#e8dcc0', 0.3);
      this.add(poly([[x - 40 * s, b], [x, b - 50 * s], [x + 40 * s, b]], ` fill="${cl}"`) + poly([[x - 9 * s, b], [x, b - 30 * s], [x + 9 * s, b]], ` fill="${o.lit ? this.p.light : mix(c, '#000', 0.4)}"`));
      if (o.lit) this.light(x, b - 10 * s, 50 * s, 0.6);
      if (o.flag) this.banner(x, b - 48 * s, 20 * s, d, o.flag);
      return this;
    }
    pyre(x, b, s, burning) {
      const c = this.col(1);
      this.add(`<g fill="${c}">${poly([[x - 50 * s, b], [x - 34 * s, b - 22 * s], [x + 34 * s, b - 22 * s], [x + 50 * s, b]])}<rect x="${f(x - 3 * s)}" y="${f(b - 95 * s)}" width="${f(6 * s)}" height="${f(75 * s)}"/></g>`);
      if (burning) { this.light(x, b - 40 * s, 220 * s, 0.55); this.flame(x - 18 * s, b - 18 * s, 55 * s); this.flame(x + 14 * s, b - 18 * s, 70 * s); this.flame(x, b - 20 * s, 90 * s); }
      return this;
    }
    cannon(x, b, s, d, fire) {
      const c = this.col(d);
      this.add(`<g fill="${c}"><rect x="${f(x - 10 * s)}" y="${f(b - 30 * s)}" width="${f(62 * s)}" height="${f(13 * s)}" rx="${f(5 * s)}" transform="rotate(-14 ${f(x)} ${f(b - 24 * s)})"/></g>`);
      this.wheel(x, b - 14 * s, 14 * s, c, 3.5 * s);
      if (fire) { this.light(x + 66 * s, b - 42 * s, 60 * s, 0.8, '#ffe2a0'); this.smokeColumn(x + 80 * s, b - 40 * s, 80 * s, 26 * s, 0.4); }
      return this;
    }
    pylon(x, b, h, d) {
      const c = this.col(d), w = h * 0.28;
      const p = `M${f(x - w / 2)},${b}L${f(x - 4)},${f(b - h)}M${f(x + w / 2)},${b}L${f(x + 4)},${f(b - h)}` +
        `M${f(x - w * 0.42)},${f(b - h * 0.15)}L${f(x + w * 0.36)},${f(b - h * 0.32)}M${f(x + w * 0.42)},${f(b - h * 0.15)}L${f(x - w * 0.36)},${f(b - h * 0.32)}` +
        `M${f(x - w * 0.34)},${f(b - h * 0.36)}L${f(x + w * 0.24)},${f(b - h * 0.56)}M${f(x + w * 0.34)},${f(b - h * 0.36)}L${f(x - w * 0.24)},${f(b - h * 0.56)}` +
        `M${f(x - w * 0.9)},${f(b - h * 0.8)}H${f(x + w * 0.9)}M${f(x - w * 0.7)},${f(b - h * 0.62)}H${f(x + w * 0.7)}`;
      return this.add(`<path d="${p}" stroke="${c}" stroke-width="2.2" fill="none"/>`);
    }
    wires(a, bb, sag, d) {
      return this.add(`<path d="M${a[0]},${a[1]}Q${(a[0] + bb[0]) / 2},${(a[1] + bb[1]) / 2 + sag} ${bb[0]},${bb[1]}" stroke="${this.col(d)}" stroke-width="1.2" fill="none"/>`);
    }
    cityModern(base, d, hs, x0, x1) {
      hs = hs || 1; x0 = x0 === undefined ? -10 : x0; x1 = x1 === undefined ? 810 : x1;
      const c = this.col(d);
      let t = '', win = '', x = x0;
      while (x < x1) {
        const w = this.rn(28, 70), h = this.rn(60, 240) * hs;
        t += `<rect x="${f(x)}" y="${f(base - h)}" width="${f(w)}" height="${f(h + 2)}"/>`;
        if (this.r() < 0.3) t += `<rect x="${f(x + w / 2 - 1)}" y="${f(base - h - 26 * hs)}" width="2" height="${f(26 * hs)}"/>`;
        for (let yy = base - h + 8; yy < base - 6; yy += 11 * Math.max(0.7, hs)) for (let xx = x + 5; xx < x + w - 6; xx += 9) if (this.r() < 0.28) win += `<rect x="${f(xx)}" y="${f(yy)}" width="4" height="5" fill="${this.r() < 0.75 ? '#ffd98a' : '#bfe3ff'}"/>`;
        x += w + this.rn(0, 6);
      }
      return this.add(`<g fill="${c}">${t}</g><g opacity=".85">${win}</g>`);
    }
    panelBlocks(base, d) {
      const c = this.col(d);
      let t = '', win = '';
      for (const [x, w, h] of [[30, 180, 170], [240, 230, 150], [500, 150, 200], [670, 160, 160]]) {
        t += `<rect x="${x}" y="${base - h}" width="${w}" height="${h}"/>`;
        for (let yy = base - h + 10; yy < base - 10; yy += 17) for (let xx = x + 8; xx < x + w - 10; xx += 15) win += `<rect x="${xx}" y="${f(yy)}" width="8" height="9" fill="${this.r() < 0.3 ? this.pk(['#ffd98a', '#ffcf7a', '#ffe6b0', '#b9d8ff']) : mix(c, '#000', 0.25)}"/>`;
      }
      return this.add(`<g fill="${c}">${t}</g>${win}`);
    }
    lamps(y, xs, d) {
      const c = this.col(d === undefined ? 0.95 : d);
      for (const x of xs) {
        this.light(x + 14, y - 92, 60, 0.45);
        this.add(`<path d="M${x},${y}V${y - 95}H${x + 16}" stroke="${c}" stroke-width="3" fill="none"/><rect x="${x + 10}" y="${y - 96}" width="10" height="5" fill="${this.p.light}"/>`);
      }
      return this;
    }
    roadModern(y) {
      let s = `<rect x="0" y="${y}" width="800" height="${450 - y}" fill="${mix(this.p.near, '#2a2f3a', 0.4)}"/>`;
      for (let x = 10; x < 800; x += 60) s += `<rect x="${x}" y="${y + 30}" width="30" height="3" fill="#cfd6e0" opacity=".5"/>`;
      for (let i = 0; i < 6; i++) { const x = this.rn(0, 700), red = i % 2; s += `<rect x="${f(x)}" y="${f(y + (red ? 14 : 44) + this.rn(-3, 3))}" width="${f(this.rn(60, 140))}" height="2" fill="${red ? '#ff5a4a' : '#fff4d6'}" opacity=".8"/>`; }
      return this.add(s);
    }
    sheaves(n, x0, x1, y0, y1, d) {
      let s = '';
      const c = this.tint('#c99a3a', d);
      for (let i = 0; i < n; i++) { const y = this.rn(y0, y1), sc = 0.5 + ((y - y0) / (y1 - y0)) * 0.8, x = this.rn(x0, x1); s += poly([[x - 9 * sc, y], [x - 3 * sc, y - 26 * sc], [x + 3 * sc, y - 26 * sc], [x + 9 * sc, y]]) + `<rect x="${f(x - 5 * sc)}" y="${f(y - 14 * sc)}" width="${f(10 * sc)}" height="${f(3 * sc)}" fill="${mix(c, '#000', 0.4)}"/>`; }
      return this.add(`<g fill="${c}">${s}</g>`);
    }
    fieldStripes(y0, cols) {
      let s = '';
      const n = 9;
      for (let i = 0; i < n; i++) {
        const xt0 = 400 + (i - n / 2) * 60, xt1 = xt0 + 60, xb0 = 400 + (i - n / 2) * 260, xb1 = xb0 + 260;
        s += poly([[xt0, y0], [xt1, y0], [xb1, 450], [xb0, 450]], ` fill="${cols[i % cols.length]}"`);
      }
      return this.add(s);
    }
    cracks(y0) {
      let s = '';
      for (let i = 0; i < 40; i++) { let x = this.rn(0, 800), y = this.rn(y0, 450); s += `M${f(x)},${f(y)}`; for (let j = 0; j < 4; j++) { x += this.rn(-30, 30); y += this.rn(-6, 6); s += `L${f(x)},${f(y)}`; } }
      return this.add(`<path d="${s}" stroke="${mix(this.p.near, '#000', 0.2)}" stroke-width="1.4" fill="none" opacity=".6"/>`);
    }
    charred(x, b, s) {
      const c = this.col(1);
      return this.add(`<g stroke="${c}" stroke-width="${f(5 * s)}" fill="none" stroke-linecap="round"><path d="M${f(x - 30 * s)},${b}V${f(b - 40 * s)}L${f(x)},${f(b - 66 * s)}L${f(x + 18 * s)},${f(b - 50 * s)}M${f(x + 30 * s)},${b}V${f(b - 30 * s)}M${f(x - 30 * s)},${f(b - 40 * s)}L${f(x + 10 * s)},${f(b - 30 * s)}M${f(x - 8 * s)},${b}L${f(x + 6 * s)},${f(b - 22 * s)}"/></g>`);
    }
    rails(y) {
      const c = this.col(1);
      let s = `<path d="M0,${y}H800M0,${y + 10}H800" stroke="${c}" stroke-width="3"/>`;
      for (let x = 0; x < 800; x += 22) s += `<rect x="${x}" y="${y - 2}" width="6" height="15" fill="${c}"/>`;
      return this.add(s);
    }
    locomotive(x, y, sc) {
      const c = this.col(1);
      this.add(`<g fill="${c}" transform="translate(${f(x)},${f(y)}) scale(${sc})"><rect x="-70" y="-44" width="96" height="30" rx="12"/><rect x="26" y="-70" width="40" height="56"/><rect x="20" y="-76" width="52" height="8"/><rect x="-56" y="-74" width="14" height="32"/><polygon points="-60,-78 -38,-78 -42,-72 -56,-72"/><polygon points="-84,-14 -70,-30 -70,-14"/><rect x="34" y="-62" width="22" height="16" fill="${this.p.light}"/></g>`);
      for (const wx of [-50, -18, 14, 46]) this.wheel(x + wx * sc, y - 10 * sc, 13 * sc, c, 3 * sc);
      return this.smokeColumn(x - 49 * sc, y - 80 * sc, 120 * sc, 18 * sc, 0.5);
    }
    chimneys(xs, b, d) {
      const c = this.col(d);
      for (const [x, h] of xs) { this.add(`<rect x="${x - 8}" y="${b - h}" width="16" height="${h}" fill="${c}"/>`); this.smokeColumn(x, b - h, 140, 14, 0.35); }
      return this;
    }

    /* ---------- интерьеры ---------- */
    room(name, o) {
      o = o || {};
      this.use(name);
      const p = this.p, fy = o.floorY || 330;
      let t = `<rect width="800" height="${fy}" fill="${this.lin([[0, mix(p.wall, p.near, 0.5)], [0.55, p.wall], [1, mix(p.wall, p.near, 0.25)]])}"/>`;
      const line = mix(p.wall, p.near, 0.45);
      if (p.tex === 'stone') {
        for (let y = 0, row = 0; y < fy; y += 30, row++) for (let x = row % 2 ? -30 : 0; x < 800; x += 60) t += `<rect x="${x + 1}" y="${y + 1}" width="58" height="28" fill="${mix(p.wall, this.r() < 0.5 ? '#ffffff' : p.near, this.rn(0, 0.08))}" stroke="${line}" stroke-width="1.2" opacity=".55"/>`;
      } else if (p.tex === 'logs') {
        for (let y = 0; y < fy; y += 26) t += `<rect x="0" y="${y}" width="800" height="24" rx="10" fill="${mix(p.wall, '#ffffff', this.rn(0, 0.06))}" stroke="${line}" stroke-width="1.5" opacity=".7"/>`;
      } else if (p.tex === 'planks') {
        for (let x = 0; x < 800; x += 36) t += `<rect x="${x}" y="0" width="34" height="${fy}" fill="${mix(p.wall, '#ffffff', this.rn(0, 0.05))}" stroke="${line}" stroke-width="1" opacity=".6"/>`;
      }
      t += `<rect x="0" y="${fy}" width="800" height="${450 - fy}" fill="${this.lin([[0, p.floor], [1, mix(p.floor, p.near, 0.6)]])}"/>`;
      const vy = fy - 220;
      let fl = '';
      for (let xb = -600; xb <= 1400; xb += 90) { const tt = (fy - vy) / (450 - vy); fl += `M${f(400 + (xb - 400) * tt)},${fy}L${xb},450`; }
      t += `<path d="${fl}" stroke="${mix(p.floor, p.near, 0.5)}" stroke-width="1.2" opacity=".6"/><rect x="0" y="${fy - 4}" width="800" height="6" fill="${mix(p.wall, p.near, 0.6)}"/>`;
      if (o.beams) {
        t += `<rect x="0" y="0" width="800" height="22" fill="${this.col(0.85)}"/>`;
        for (const bx of o.posts || [70, 730]) t += `<rect x="${bx - 12}" y="0" width="24" height="${fy}" fill="${this.col(0.8)}"/>`;
      }
      return this.add(t);
    }
    cave(o) {
      this.use('cave');
      this.add(`<rect width="800" height="450" fill="${this.lin([[0, '#120d1f'], [1, '#2a2140']])}"/>`);
      const c1 = this.col(0.6), c2 = this.col(0.95);
      this.add(`<path d="M0,0H800V450H0Z M120,450C90,300 160,160 300,120C420,80 560,110 640,190C720,270 700,380 690,450Z" fill="${c1}" fill-rule="evenodd"/>`);
      this.add(`<path d="M0,0H260C180,60 120,160 90,260C70,340 60,400 40,450H0Z" fill="${c2}"/><path d="M800,0H560C660,70 740,180 760,300C770,370 780,420 800,450Z" fill="${c2}"/><path d="M0,410C200,380 600,390 800,420V450H0Z" fill="${c2}"/>`);
      let st = '';
      for (let x = 240; x < 600; x += this.rn(30, 60)) st += poly([[x - 8, 0], [x + 8, 0], [x, this.rn(30, 90)]]);
      return this.add(`<g fill="${c2}">${st}</g>`);
    }
    win(x, y, w, h, outside, o) {
      o = o || {};
      const cid = this.uid(), op = PAL[outside];
      const shape = `M${x},${y + h}V${y + w / 2}A${w / 2},${w / 2} 0 0 1 ${x + w},${y + w / 2}V${y + h}Z`;
      this.d.push(`<clipPath id="${cid}"><path d="${shape}"/></clipPath>`);
      let inner = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${this.lin([[0, op.sky[0]], [0.6, op.sky[1]], [1, op.sky[2]]])}"/>`;
      if (o.moon) inner += `<circle cx="${x + w * 0.65}" cy="${y + h * 0.3}" r="${w * 0.12}" fill="${op.sun}"/>`;
      if (o.stars) for (let i = 0; i < 14; i++) inner += `<circle cx="${f(x + this.rn(0, w))}" cy="${f(y + this.rn(0, h * 0.7))}" r="1" fill="#fff" opacity="${f(this.rn(0.3, 1))}"/>`;
      if (o.stained) {
        const cols = ['#b23a3a', '#2f5fa8', '#d8a83a', '#3f8a5a', '#7a3fa0'];
        for (let yy = y; yy < y + h; yy += h / 6) for (let xx = x; xx < x + w; xx += w / 4) inner += `<rect x="${f(xx)}" y="${f(yy)}" width="${f(w / 4)}" height="${f(h / 6)}" fill="${this.pk(cols)}" opacity=".85"/>`;
      } else inner += `<path d="M${x},${y + h}L${x},${y + h * 0.82}Q${x + w * 0.3},${y + h * 0.74} ${x + w * 0.6},${y + h * 0.8}T${x + w},${y + h * 0.78}V${y + h}Z" fill="${mix(op.sky[2], op.near, 0.6)}"/>`;
      const fc = this.col(0.85);
      this.add(`<g clip-path="url(#${cid})">${inner}</g><path d="${shape}" fill="none" stroke="${fc}" stroke-width="7"/><path d="M${x + w / 2},${y + 4}V${y + h}M${x},${y + h * 0.55}H${x + w}" stroke="${fc}" stroke-width="4"/>`);
      if (o.beam !== false) this.add(poly([[x, y + h * 0.3], [x + w, y + h * 0.3], [x + w + 160, 450], [x + 40, 450]], ` fill="${o.stained ? '#ffe6ae' : op.sun}" opacity="${o.beamOp || 0.08}"`));
      return this;
    }
    fireplace(x, fy, s) {
      const c = this.col(0.6), dk = '#120a05';
      this.light(x, fy - 40 * s, 300 * s, 0.4);
      this.add(`<rect x="${f(x - 70 * s)}" y="${f(fy - 120 * s)}" width="${f(140 * s)}" height="${f(120 * s)}" fill="${c}"/><rect x="${f(x - 80 * s)}" y="${f(fy - 128 * s)}" width="${f(160 * s)}" height="${f(12 * s)}" fill="${this.col(0.8)}"/><path d="M${f(x - 46 * s)},${fy}V${f(fy - 60 * s)}A${f(46 * s)},${f(36 * s)} 0 0 1 ${f(x + 46 * s)},${f(fy - 60 * s)}V${fy}Z" fill="${dk}"/>`);
      return this.flame(x - 10 * s, fy - 4 * s, 40 * s).flame(x + 12 * s, fy - 4 * s, 52 * s);
    }
    table(x, b, w, d, s) {
      s = s || 1;
      const c = this.col(d === undefined ? 0.85 : d);
      return this.add(`<g fill="${c}"><rect x="${f(x - w / 2)}" y="${f(b - 52 * s)}" width="${f(w)}" height="${f(9 * s)}"/><rect x="${f(x - w / 2 + 6 * s)}" y="${f(b - 44 * s)}" width="${f(7 * s)}" height="${f(44 * s)}"/><rect x="${f(x + w / 2 - 13 * s)}" y="${f(b - 44 * s)}" width="${f(7 * s)}" height="${f(44 * s)}"/></g>`);
    }
    candle(x, y, s) {
      s = s || 1;
      this.light(x, y - 18 * s, 90 * s, 0.5);
      return this.add(`<rect x="${f(x - 2.5 * s)}" y="${f(y - 14 * s)}" width="${f(5 * s)}" height="${f(14 * s)}" fill="#e9dfc4"/><ellipse cx="${x}" cy="${f(y - 19 * s)}" rx="${f(2.5 * s)}" ry="${f(5 * s)}" fill="${this.p.light}" class="flicker"/>`);
    }
    books(x, y, n, s, d) {
      s = s || 1;
      let t = '', xx = x;
      for (let i = 0; i < n; i++) { const w = this.rn(5, 9) * s, h = this.rn(16, 24) * s; t += `<rect x="${f(xx)}" y="${f(y - h)}" width="${f(w)}" height="${f(h)}" fill="${mix(this.pk(CLOTH), this.p.near, 0.35 + (d || 0) * 0.3)}"/>`; xx += w + 1; }
      return this.add(t);
    }
    shelf(x, y, w, h, d) {
      const c = this.col(d === undefined ? 0.8 : d);
      this.add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${mix(c, '#000', 0.3)}"/><path d="M${x},${y}V${y + h}M${x + w},${y}V${y + h}" stroke="${c}" stroke-width="8"/>`);
      for (let yy = y + 34; yy <= y + h; yy += 34) { this.books(x + 6, yy - 3, Math.floor((w - 12) / 8.5), 1, 0.2); this.add(`<rect x="${x}" y="${yy - 3}" width="${w}" height="5" fill="${c}"/>`); }
      return this;
    }
    paper(x, y, w, h, rot, blue) {
      const cl = blue ? '#2c4a7a' : '#d9c9a0';
      let s = `<g transform="rotate(${rot || 0} ${x + w / 2} ${y + h / 2})"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${cl}"/>`;
      const ln = blue ? '#cfe0ff' : '#6b5a3a';
      s += `<g stroke="${ln}" stroke-width="1" fill="none" opacity=".75">`;
      if (blue) s += `<circle cx="${x + w * 0.35}" cy="${y + h * 0.5}" r="${h * 0.25}"/><circle cx="${x + w * 0.35}" cy="${y + h * 0.5}" r="${h * 0.08}"/><path d="M${x + w * 0.6},${y + h * 0.2}H${x + w * 0.9}M${x + w * 0.6},${y + h * 0.4}H${x + w * 0.85}M${x + w * 0.6},${y + h * 0.6}H${x + w * 0.9}M${x + w * 0.1},${y + h * 0.9}H${x + w * 0.9}"/>`;
      else for (let yy = y + 6; yy < y + h - 3; yy += 6) s += `<path d="M${x + 5},${yy}H${x + w - 5 - this.rn(0, 10)}"/>`;
      return this.add(s + '</g></g>');
    }
    bed(x, b, s) {
      const c = this.col(0.85);
      return this.add(`<rect x="${f(x - 110 * s)}" y="${f(b - 90 * s)}" width="${f(16 * s)}" height="${f(90 * s)}" fill="${c}"/><rect x="${f(x - 110 * s)}" y="${f(b - 40 * s)}" width="${f(220 * s)}" height="${f(30 * s)}" fill="${c}"/><rect x="${f(x - 94 * s)}" y="${f(b - 54 * s)}" width="${f(46 * s)}" height="${f(16 * s)}" rx="${f(6 * s)}" fill="#d9cdb4" opacity=".85"/><path d="M${f(x - 50 * s)},${f(b - 40 * s)}Q${f(x)},${f(b - 66 * s)} ${f(x + 110 * s)},${f(b - 46 * s)}V${f(b - 12 * s)}H${f(x - 50 * s)}Z" fill="${mix('#7a2f3a', this.p.near, 0.4)}"/><rect x="${f(x + 96 * s)}" y="${f(b - 60 * s)}" width="${f(14 * s)}" height="${f(60 * s)}" fill="${c}"/>`);
    }
    throne(x, b, s) {
      const c = this.col(0.9), red = mix('#7a1f2a', this.p.near, 0.25);
      this.add(`<rect x="${f(x - 160 * s)}" y="${f(b - 18 * s)}" width="${f(320 * s)}" height="${f(18 * s)}" fill="${this.col(0.7)}"/><rect x="${f(x - 120 * s)}" y="${f(b - 34 * s)}" width="${f(240 * s)}" height="${f(16 * s)}" fill="${this.col(0.75)}"/>`);
      this.add(`<path d="M${f(x - 40 * s)},${f(b - 34 * s)}V${f(b - 170 * s)}Q${f(x)},${f(b - 215 * s)} ${f(x + 40 * s)},${f(b - 170 * s)}V${f(b - 34 * s)}Z" fill="${red}" stroke="${GOLD}" stroke-width="${f(3 * s)}"/><rect x="${f(x - 52 * s)}" y="${f(b - 80 * s)}" width="${f(104 * s)}" height="${f(14 * s)}" fill="${c}"/><rect x="${f(x - 52 * s)}" y="${f(b - 120 * s)}" width="${f(10 * s)}" height="${f(86 * s)}" fill="${c}"/><rect x="${f(x + 42 * s)}" y="${f(b - 120 * s)}" width="${f(10 * s)}" height="${f(86 * s)}" fill="${c}"/>`);
      return this.sunSign(x, b - 175 * s, 7 * s);
    }
    hanging(x, y, w, h, color, sign) {
      const cl = mix(color, this.p.near, 0.3);
      this.add(poly([[x, y], [x + w, y], [x + w, y + h], [x + w / 2, y + h - w * 0.4], [x, y + h]], ` fill="${cl}"`) + `<rect x="${x - 4}" y="${y - 4}" width="${w + 8}" height="5" fill="${this.col(0.9)}"/>`);
      if (sign) this.sunSign(x + w / 2, y + h * 0.35, w * 0.13);
      return this;
    }
    anvil(x, b, s) {
      const c = this.col(0.95);
      return this.add(`<g fill="${c}"><rect x="${f(x - 16 * s)}" y="${f(b - 30 * s)}" width="${f(32 * s)}" height="${f(30 * s)}"/>${poly([[x - 40 * s, b - 46 * s], [x + 30 * s, b - 46 * s], [x + 46 * s, b - 40 * s], [x + 30 * s, b - 34 * s], [x + 14 * s, b - 34 * s], [x + 10 * s, b - 28 * s], [x - 10 * s, b - 28 * s], [x - 16 * s, b - 34 * s], [x - 36 * s, b - 38 * s]])}</g>`);
    }
    forge(x, fy, s) {
      const c = this.col(0.75);
      this.light(x, fy - 60 * s, 320 * s, 0.55);
      this.add(`<rect x="${f(x - 80 * s)}" y="${f(fy - 90 * s)}" width="${f(160 * s)}" height="${f(90 * s)}" fill="${c}"/>${poly([[x - 60 * s, fy - 90 * s], [x - 25 * s, fy - 230 * s], [x + 25 * s, fy - 230 * s], [x + 60 * s, fy - 90 * s]], ` fill="${this.col(0.65)}"`)}<rect x="${f(x - 50 * s)}" y="${f(fy - 70 * s)}" width="${f(100 * s)}" height="${f(30 * s)}" fill="#ff8a2a"/><rect x="${f(x - 50 * s)}" y="${f(fy - 70 * s)}" width="${f(100 * s)}" height="${f(30 * s)}" fill="#ffd27a" class="flicker"/>`);
      return this.embers(20, x - 60 * s, x + 60 * s, fy - 160 * s, fy - 70 * s);
    }
    barrel(x, b, s) {
      const c = this.col(0.9);
      return this.add(`<rect x="${f(x - 18 * s)}" y="${f(b - 46 * s)}" width="${f(36 * s)}" height="${f(46 * s)}" rx="${f(10 * s)}" fill="${c}"/><path d="M${f(x - 18 * s)},${f(b - 36 * s)}H${f(x + 18 * s)}M${f(x - 18 * s)},${f(b - 10 * s)}H${f(x + 18 * s)}" stroke="${mix(c, '#000', 0.4)}" stroke-width="${f(3 * s)}"/>`);
    }
    crate(x, b, s) {
      const c = this.col(0.85);
      return this.add(`<rect x="${f(x - 20 * s)}" y="${f(b - 36 * s)}" width="${f(40 * s)}" height="${f(36 * s)}" fill="${c}"/><path d="M${f(x - 20 * s)},${f(b - 36 * s)}L${f(x + 20 * s)},${b}M${f(x + 20 * s)},${f(b - 36 * s)}L${f(x - 20 * s)},${b}" stroke="${mix(c, '#000', 0.4)}" stroke-width="${f(2.4 * s)}"/>`);
    }
    flasks(x, y, n, s) {
      s = s || 1;
      const cols = ['#7ee08a', '#c08cff', '#ffb24a', '#6ad0ff'];
      let t = '';
      for (let i = 0; i < n; i++) {
        const xx = x + i * 26 * s, cl = cols[i % cols.length], r = this.rn(7, 11) * s;
        t += `<rect x="${f(xx - 2.5 * s)}" y="${f(y - r * 2 - 12 * s)}" width="${f(5 * s)}" height="${f(14 * s)}" fill="${this.col(0.6)}"/><circle cx="${f(xx)}" cy="${f(y - r)}" r="${f(r)}" fill="${this.col(0.6)}"/><circle cx="${f(xx)}" cy="${f(y - r * 0.8)}" r="${f(r * 0.75)}" fill="${cl}" opacity=".85"/>`;
        this.light(xx, y - r, r * 4, 0.35, cl);
      }
      return this.add(t);
    }
    press(x, b, s) {
      const c = this.col(0.9);
      return this.add(`<g fill="${c}"><rect x="${f(x - 60 * s)}" y="${f(b - 170 * s)}" width="${f(14 * s)}" height="${f(170 * s)}"/><rect x="${f(x + 46 * s)}" y="${f(b - 170 * s)}" width="${f(14 * s)}" height="${f(170 * s)}"/><rect x="${f(x - 70 * s)}" y="${f(b - 180 * s)}" width="${f(140 * s)}" height="${f(16 * s)}"/><rect x="${f(x - 70 * s)}" y="${f(b - 70 * s)}" width="${f(140 * s)}" height="${f(14 * s)}"/><rect x="${f(x - 8 * s)}" y="${f(b - 164 * s)}" width="${f(16 * s)}" height="${f(60 * s)}"/><rect x="${f(x - 36 * s)}" y="${f(b - 104 * s)}" width="${f(72 * s)}" height="${f(12 * s)}"/><path d="M${f(x)},${f(b - 140 * s)}L${f(x + 70 * s)},${f(b - 128 * s)}" stroke="${c}" stroke-width="${f(5 * s)}"/></g><rect x="${f(x - 34 * s)}" y="${f(b - 76 * s)}" width="${f(68 * s)}" height="${f(6 * s)}" fill="#e9dfc4"/>`);
    }
    sheets(y, x0, x1) {
      let s = `<path d="M${x0},${y}Q${(x0 + x1) / 2},${y + 14} ${x1},${y}" stroke="${this.col(0.9)}" stroke-width="1.2" fill="none"/>`;
      for (let x = x0 + 20; x < x1 - 20; x += 44) s += `<rect x="${x}" y="${y + 6}" width="32" height="42" fill="#e6dcc2" opacity=".85" transform="rotate(${f(this.rn(-4, 4))} ${x + 16} ${y + 6})"/>`;
      return this.add(s);
    }
    chest(x, b, s, gold) {
      const c = this.col(0.9);
      if (gold) this.light(x, b - 40 * s, 110 * s, 0.55, '#ffd76a');
      return this.add(`<rect x="${f(x - 34 * s)}" y="${f(b - 34 * s)}" width="${f(68 * s)}" height="${f(34 * s)}" fill="${c}"/>${gold ? `<g fill="${GOLD}">${[-20, -8, 4, 16].map((dx) => `<circle cx="${f(x + dx * s)}" cy="${f(b - 36 * s - (dx % 8) * s)}" r="${f(6 * s)}"/>`).join('')}</g>` : ''}<path d="M${f(x - 34 * s)},${f(b - 34 * s)}Q${f(x)},${f(b - 66 * s)} ${f(x + 34 * s)},${f(b - 34 * s)}" fill="none" stroke="${c}" stroke-width="${f(6 * s)}" transform="rotate(-14 ${f(x - 34 * s)} ${f(b - 34 * s)})"/><rect x="${f(x - 5 * s)}" y="${f(b - 26 * s)}" width="${f(10 * s)}" height="${f(10 * s)}" fill="${GOLD}"/>`);
    }
    coins(x, b, n, s) {
      let t = '';
      for (let i = 0; i < n; i++) { const h = this.rn(3, 9); for (let j = 0; j < h; j++) t += `<ellipse cx="${f(x + i * 18 * s)}" cy="${f(b - j * 3 * s)}" rx="${f(7 * s)}" ry="${f(2.4 * s)}" fill="${j === h - 1 ? '#f0d488' : GOLD}"/>`; }
      return this.add(t);
    }
    scales(x, b, s) {
      const c = this.col(0.9);
      return this.add(`<g stroke="${GOLD}" stroke-width="${f(2.4 * s)}" fill="none"><path d="M${x},${b}V${f(b - 80 * s)}M${f(x - 46 * s)},${f(b - 74 * s)}L${f(x + 46 * s)},${f(b - 82 * s)}M${f(x - 46 * s)},${f(b - 74 * s)}L${f(x - 58 * s)},${f(b - 40 * s)}M${f(x - 46 * s)},${f(b - 74 * s)}L${f(x - 34 * s)},${f(b - 40 * s)}M${f(x + 46 * s)},${f(b - 82 * s)}L${f(x + 34 * s)},${f(b - 50 * s)}M${f(x + 46 * s)},${f(b - 82 * s)}L${f(x + 58 * s)},${f(b - 50 * s)}"/></g><path d="M${f(x - 62 * s)},${f(b - 40 * s)}Q${f(x - 46 * s)},${f(b - 26 * s)} ${f(x - 30 * s)},${f(b - 40 * s)}Z M${f(x + 30 * s)},${f(b - 50 * s)}Q${f(x + 46 * s)},${f(b - 36 * s)} ${f(x + 62 * s)},${f(b - 50 * s)}Z" fill="${GOLD}"/><rect x="${f(x - 20 * s)}" y="${f(b - 4 * s)}" width="${f(40 * s)}" height="${f(4 * s)}" fill="${c}"/>`);
    }
    door(x, b, w, h) {
      const c = this.col(0.9);
      let planks = '';
      for (let xx = x - w / 2 + w / 5; xx < x + w / 2; xx += w / 5) planks += `M${f(xx)},${b}V${f(b - h + w / 2)}`;
      return this.add(`<path d="M${f(x - w / 2)},${b}V${f(b - h + w / 2)}A${f(w / 2)},${f(w / 2)} 0 0 1 ${f(x + w / 2)},${f(b - h + w / 2)}V${b}Z" fill="${mix(c, '#000', 0.2)}" stroke="${c}" stroke-width="6"/><path d="${planks}" stroke="${c}" stroke-width="2"/><circle cx="${f(x + w * 0.25)}" cy="${f(b - h * 0.45)}" r="4" fill="none" stroke="${GOLD}" stroke-width="2"/>`);
    }
    lantern(x, y, s) {
      s = s || 1;
      const c = this.col(0.95);
      this.light(x, y, 110 * s, 0.45);
      return this.add(`<path d="M${x},0V${f(y - 14 * s)}" stroke="${c}" stroke-width="1.5"/><rect x="${f(x - 8 * s)}" y="${f(y - 14 * s)}" width="${f(16 * s)}" height="${f(22 * s)}" fill="${this.p.light}" stroke="${c}" stroke-width="${f(2.5 * s)}"/>${poly([[x - 11 * s, y - 14 * s], [x, y - 24 * s], [x + 11 * s, y - 14 * s]], ` fill="${c}"`)}`);
    }
    cauldron(x, b, s, glow, steam) {
      const c = this.col(0.95);
      if (glow) this.light(x, b - 40 * s, 100 * s, 0.45, glow);
      this.add(`<path d="M${f(x - 40 * s)},${f(b - 50 * s)}Q${f(x - 44 * s)},${b} ${x},${b}Q${f(x + 44 * s)},${b} ${f(x + 40 * s)},${f(b - 50 * s)}Z" fill="${c}"/><ellipse cx="${x}" cy="${f(b - 50 * s)}" rx="${f(42 * s)}" ry="${f(8 * s)}" fill="${glow || mix(c, '#ffffff', 0.15)}"/>`);
      if (steam) { let st = ''; for (let i = 0; i < 4; i++) st += `<path d="M${f(x - 20 * s + i * 13 * s)},${f(b - 58 * s)}q${f(-10 * s)},${f(-25 * s)} 0,${f(-50 * s)}t0,${f(-50 * s)}" stroke="#e6e6e6" stroke-width="${f(6 * s)}" fill="none" opacity=".18" stroke-linecap="round"/>`; this.add(`<g class="drift">${st}</g>`); }
      return this;
    }
    herbs(x0, x1, y) {
      let s = '';
      for (let x = x0; x < x1; x += this.rn(26, 44)) { const l = this.rn(30, 60); s += `<path d="M${f(x)},${y}V${f(y + 10)}" stroke="${this.col(0.9)}" stroke-width="1.2"/>` + poly([[x - 7, y + 10], [x + 7, y + 10], [x + 3, y + l], [x - 3, y + l]], ` fill="${this.tint(this.pk(['#6b7f3a', '#8a6f3a', '#4f6b3a']), 0.8)}"`); }
      return this.add(s);
    }
    mirror(x, y, w, h) {
      this.add(`<ellipse cx="${x}" cy="${y + h / 2}" rx="${w / 2 + 12}" ry="${h / 2 + 12}" fill="${mix(GOLD, this.p.near, 0.35)}"/><ellipse cx="${x}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" fill="${this.lin([[0, '#9fb3c4'], [1, '#3e4c5a']])}"/>`);
      this.person(x, y + h * 0.98, h * 0.75, 0.6, 'man', { op: 0.55 });
      return this.add(`<path d="M${x - w * 0.3},${y + h * 0.15}L${x - w * 0.1},${y + h * 0.05}" stroke="#fff" stroke-width="3" opacity=".35"/>`);
    }
    tub(x, b, s) {
      const c = this.col(0.85);
      this.add(`<path d="M${f(x - 60 * s)},${f(b - 50 * s)}L${f(x - 50 * s)},${b}H${f(x + 50 * s)}L${f(x + 60 * s)},${f(b - 50 * s)}Z" fill="${c}"/><path d="M${f(x - 58 * s)},${f(b - 36 * s)}H${f(x + 58 * s)}M${f(x - 53 * s)},${f(b - 12 * s)}H${f(x + 53 * s)}" stroke="${mix(c, '#000', 0.4)}" stroke-width="${f(3 * s)}"/>`);
      return this.steam(x, b - 50 * s, 120 * s);
    }
    steam(x, y, w) {
      let s = '';
      for (let i = 0; i < 8; i++) s += `<ellipse cx="${f(x + this.rn(-w / 2, w / 2))}" cy="${f(y - this.rn(10, 160))}" rx="${f(this.rn(30, 70))}" ry="${f(this.rn(12, 26))}"/>`;
      return this.add(`<g class="drift" fill="#ffffff" opacity=".12" filter="${this.blurF(8)}">${s}</g>`);
    }
    vignette(op) {
      return this.add(`<rect width="800" height="450" fill="${this.rad([[0.55, '#000', 0], [1, '#000', op === undefined ? 0.45 : op]])}"/>`);
    }
  }

  /* ================== 100 сцен ================== */
  const CATS = [
    { id: 'world', name: 'Между мирами' },
    { id: 'village', name: 'Деревня' },
    { id: 'nature', name: 'Природа и дороги' },
    { id: 'castle', name: 'Замки и города' },
    { id: 'interior', name: 'Под крышей' },
    { id: 'craft', name: 'Прогрессорство' },
    { id: 'magic', name: 'Магия и тайны' },
    { id: 'danger', name: 'Опасности' },
    { id: 'people', name: 'Люди и интриги' },
    { id: 'war', name: 'Война и финал' },
  ];
  const SCENES = [];
  const S = (id, title, cat, tags, draw) => SCENES.push({ id, title, cat, tags, draw, n: SCENES.length + 1 });

  // ---- Между мирами ----
  S('w_city_night', 'Ночной город, откуда вы родом', 'world', ['home', 'city', 'night', 'dream', 'rain'], (b) => {
    b.sky('night').stars(40, 160).moon(640, 80, 16, { crescent: true });
    b.cityModern(330, 0.35, 0.8).cityModern(372, 0.75, 1.1).roadModern(372).lamps(390, [80, 300, 520, 740]).rain(160, 0.22).vignette(0.5);
  });
  S('w_substation', 'Последняя смена на подстанции', 'world', ['home', 'storm', 'death', 'portal'], (b) => {
    b.sky('storm').clouds(7, 30, 170, 0.6, '#252c35').hills(0.35, 330, 22);
    b.pylon(170, 365, 175, 0.85).pylon(560, 345, 130, 0.6);
    b.wires([170 - 44, 365 - 140], [560 - 33, 345 - 104], 26, 0.8).wires([170 + 44, 365 - 140], [560 + 33, 345 - 104], 26, 0.8);
    b.ground(1, 398).lightning(400, 0, 300).light(560, 230, 90, 0.7, '#cfe3ff').sparkles(18, 520, 600, 200, 260, '#e6f0ff');
    b.person(330, 420, 64, 1, 'man').rain(200, 0.3).vignette(0.5);
  });
  S('w_void', 'Падение сквозь пустоту', 'world', ['portal', 'magic', 'dream', 'death'], (b) => {
    b.sky('magic').stars(150, 450).vortex(400, 225, 300);
    b.person(410, 270, 52, 1, 'man', { c: '#0a0614', rot: 140 }).sparkles(40, 0, 800, 0, 450).vignette(0.65);
  });
  S('w_river_wake', 'Пробуждение у реки', 'world', ['river', 'dawn', 'water', 'awakening', 'summer', 'people'], (b) => {
    b.sky('dawn').sun(560, 296, 26).clouds(4, 60, 170, 0.35).ridge(0.18, 300, 90).forest(0.4, 318, 'pine', 16, 30);
    b.water(318, 560).willow(110, 400, 170, 0.9).ground(0.92, 388).reeds(600, 800, 392, 40, 1);
    b.person(330, 404, 64, 1, 'lying').person(470, 410, 66, 1, 'woman').person(525, 412, 70, 1, 'elder', { flip: true }).fog(300, 50, 0.4);
  });
  S('w_bedroom', 'Чужая спальня', 'world', ['interior', 'manor', 'healing', 'people', 'dawn'], (b) => {
    b.room('noble', { beams: true }).win(560, 70, 110, 190, 'dawn', { beamOp: 0.12 }).bed(320, 400, 1.15);
    b.table(150, 410, 90).candle(150, 358).person(520, 425, 150, 0.95, 'woman').vignette(0.55);
  });
  S('w_mirror', 'Лицо в зеркале', 'world', ['interior', 'manor', 'mystery', 'night'], (b) => {
    b.room('study').mirror(470, 70, 150, 230).table(470, 400, 150).candle(420, 348).candle(520, 348, 0.8);
    b.person(250, 450, 260, 1, 'man').vignette(0.65);
  });
  S('w_two_moons', 'Две луны', 'world', ['night', 'mystery', 'magic', 'manor', 'field', 'sign'], (b) => {
    b.sky('night').stars(170, 300).moon(560, 110, 34).moon(668, 70, 14, { c: '#ffc9a8' });
    b.hills(0.45, 330, 40).manor(220, 318, 0.5, 0.55).hills(0.85, 384, 26).person(560, 418, 60, 1, 'cloak').fog(300, 60, 0.25);
  });
  S('w_manor', 'Серый Брод', 'world', ['manor', 'village', 'dusk', 'home'], (b) => {
    b.sky('dusk').sun(640, 300, 30).ridge(0.2, 300, 70).hills(0.5, 332, 30).manor(430, 336, 1.1, 0.72);
    b.village(190, 378, 4, 0.7, 0.8, { smoke: true }).forest(0.85, 400, 'leafy', 26, 44, 1, 560, 820).ground(0.95, 420).birds(6, 300, 120, 80, 0.9).fog(330, 70, 0.3);
  });
  S('w_dream_home', 'Сон о доме', 'world', ['home', 'dream', 'night', 'winter'], (b) => {
    b.sky('winnight').stars(60, 140).panelBlocks(360, 0.55).ground(0.15, 380, '#a9b8cc');
    b.tree(140, 410, 120, 0.9, 'dead').tree(660, 405, 100, 0.9, 'dead').lamps(410, [300, 520]).person(420, 425, 56, 1, 'cloak').snow(140, 0.7).vignette(0.5);
  });
  S('w_star_fall', 'Падающая звезда', 'world', ['night', 'mystery', 'magic', 'field', 'sign'], (b) => {
    b.sky('night').stars(180, 320).meteor(180, 40, 560, 210).hills(0.4, 330, 34).light(620, 330, 120, 0.3, '#d6e4ff');
    b.forest(0.6, 352, 'pine', 20, 36).hills(0.9, 392, 18).person(300, 412, 48, 1, 'man').person(330, 414, 36, 1, 'child', { flip: true });
  });

  // ---- Деревня ----
  S('v_dawn', 'Утро в деревне', 'village', ['village', 'dawn', 'calm', 'summer', 'people'], (b) => {
    b.sky('dawn').sun(400, 300, 30).ridge(0.15, 290, 80).hills(0.45, 326, 25).village(400, 354, 7, 0.9, 0.7, { smoke: true });
    b.forest(0.82, 386, 'leafy', 30, 52, 1, -20, 180).ground(1, 410).person(560, 420, 50, 1, 'reaper').fog(318, 60, 0.45);
  });
  S('v_market', 'Деревенский торг', 'village', ['village', 'market', 'trade', 'people', 'day', 'summer'], (b) => {
    b.sky('day').clouds(5, 40, 160).hills(0.35, 310, 30).village(400, 332, 6, 0.7, 0.5).ground(0.9, 380);
    b.stall(150, 396, 1, 0.9, '#8e3a2f').stall(320, 392, 1, 0.9, '#35597f').stall(560, 396, 1, 0.9, '#a8822f');
    b.crowd(60, 740, 440, 66, 1, 12, ['man', 'woman', 'cloak', 'child', 'bucket']);
  });
  S('v_harvest', 'Жатва', 'village', ['field', 'harvest', 'food', 'autumn', 'people', 'village'], (b) => {
    b.sky('golden').sun(150, 250, 34).hills(0.3, 300, 25).fieldStripes(310, [b.tint('#c99a3a', 0.6), b.tint('#b88a2e', 0.6), b.tint('#d8b05a', 0.6)]);
    b.sheaves(14, 0, 800, 330, 430, 0.8).person(260, 420, 70, 1, 'reaper').person(480, 430, 74, 1, 'reaper', { flip: true }).person(620, 400, 56, 0.95, 'woman');
    b.horse(700, 372, 0.6, 0.9).cart(650, 372, 0.6, 0.9).birds(5, 520, 120, 70, 0.8);
  });
  S('v_winter', 'Деревня под снегом', 'village', ['village', 'winter', 'calm'], (b) => {
    b.sky('winter').clouds(6, 40, 140, 0.5, '#d9e2ea').ridge(0.25, 290, 80).forest(0.45, 322, 'pine', 20, 40);
    b.hills(0.3, 350, 20).village(400, 376, 7, 0.95, 0.75, { smoke: true }).ground(0.2, 410).person(250, 430, 54, 1, 'cloak').snow(160, 0.8);
  });
  S('v_festival', 'Праздник у костра', 'village', ['village', 'celebration', 'night', 'people', 'summer'], (b) => {
    b.sky('night').stars(90, 220).hills(0.55, 330, 26).village(400, 350, 6, 0.7, 0.75).garland(40, 760, 70, 30, 'lanterns');
    b.ground(1, 395).campfire(400, 405, 2.2).crowd(120, 680, 430, 72, 1, 12, ['cheer', 'dancer', 'man', 'woman']).embers(30, 330, 470, 230, 380);
  });
  S('v_well', 'У колодца', 'village', ['village', 'water', 'people', 'day', 'calm', 'healing'], (b) => {
    b.sky('day').clouds(4, 40, 150).hills(0.3, 312, 24).village(560, 346, 4, 0.8, 0.55).tree(150, 380, 150, 0.8).ground(0.9, 388);
    b.well(380, 420, 1.3, 1).person(470, 430, 80, 1, 'bucket').person(300, 432, 46, 1, 'child');
  });
  S('v_rain', 'Осенний дождь', 'village', ['village', 'autumn', 'rain', 'calm'], (b) => {
    b.sky('mist').clouds(8, 20, 160, 0.6, '#6f7774').hills(0.35, 322, 24).village(400, 362, 6, 0.95, 0.65, { smoke: true, lit: true });
    b.ground(0.9, 395).puddles(8, 405, 445).person(620, 436, 70, 1, 'cloak').rain(260, 0.35, -5);
  });
  S('v_barn_fire', 'Пожар в амбаре', 'village', ['village', 'fire', 'danger', 'night'], (b) => {
    b.sky('fire').smokeColumn(420, 260, 260, 40, 0.6).hills(0.6, 340, 20).barn(420, 380, 1.4, 0.85);
    b.flame(370, 312, 70).flame(430, 300, 100).flame(480, 315, 60).light(420, 300, 260, 0.45);
    b.house(170, 388, 0.9, 0.9).ground(1, 400).crowd(80, 720, 440, 66, 1, 9, ['bucket', 'man', 'woman']).embers(40, 300, 560, 100, 320);
  });
  S('v_old_mill', 'Сгоревшая мельница', 'village', ['village', 'river', 'ruins', 'invention', 'autumn'], (b) => {
    b.sky('mist').hills(0.35, 320, 28).forest(0.5, 340, 'dead', 30, 50).river(400, 330, 520, 10, 160);
    b.watermill(330, 380, 1.1, 0.9, { ruined: true }).tree(660, 400, 140, 0.95, 'dead').ground(1, 412).birds(4, 640, 150, 40, 0.9).fog(320, 80, 0.5);
  });
  S('v_wedding', 'Деревенская свадьба', 'village', ['village', 'celebration', 'love', 'people', 'summer'], (b) => {
    b.sky('golden').sun(640, 260, 30).hills(0.3, 312, 22).tree(110, 380, 160, 0.85).tree(700, 384, 150, 0.85).garland(140, 660, 130, 26);
    b.ground(0.95, 384).table(400, 410, 420, 1).person(370, 430, 92, 1, 'woman').person(430, 432, 98, 1, 'man', { flip: true }).crowd(120, 680, 446, 60, 1, 8, ['cheer', 'man', 'woman']);
  });

  // ---- Природа и дороги ----
  S('n_crossroads', 'Перекрёсток', 'nature', ['road', 'travel', 'field', 'choice'], (b) => {
    b.sky('golden').sun(620, 262, 26).hills(0.3, 312, 22).road(470, 320, 120, 4, 120).road(340, 320, 680, 4, 110);
    b.tree(660, 380, 170, 0.9).add(`<path d="M400,430V330" stroke="${b.col(1)}" stroke-width="7"/>`).add(poly([[400, 340], [470, 344], [482, 352], [470, 360], [400, 356]], ` fill="${b.col(1)}"`) + poly([[400, 366], [332, 370], [320, 378], [332, 386], [400, 382]], ` fill="${b.col(1)}"`));
    b.horse(520, 320, 0.25, 0.4, { rider: 'cloak' }).birds(4, 300, 110, 60, 0.7);
  });
  S('n_forest_path', 'Лесная тропа', 'nature', ['forest', 'road', 'travel', 'summer'], (b) => {
    b.sky('day').forest(0.25, 300, 'pine', 70, 120, 1.4).beams(80, 700, 0, 0.12).forest(0.5, 340, 'pine', 90, 150, 1.2).ground(0.62, 342, mix('#4f6a44', '#2b4434', 0.4));
    b.road(400, 330, 400, 6, 160, 0.5).forest(0.85, 420, 'pine', 180, 260, 0.6, -40, 160).forest(0.85, 430, 'pine', 180, 260, 0.6, 640, 840).person(400, 380, 40, 0.8, 'cloak');
  });
  S('n_deep_fog', 'Туман в чаще', 'nature', ['forest', 'fog', 'mystery', 'danger', 'autumn'], (b) => {
    b.sky('mist').forest(0.2, 300, 'pine', 80, 120, 1.2).fog(220, 120, 0.6).forest(0.45, 350, 'dead', 90, 140, 1).fog(280, 120, 0.55);
    b.forest(0.8, 440, 'dead', 200, 280, 0.7).person(430, 400, 40, 0.65, 'cloak').fog(340, 110, 0.4);
  });
  S('n_lake', 'Озеро на рассвете', 'nature', ['lake', 'water', 'dawn', 'calm', 'food', 'summer'], (b) => {
    b.sky('dawn').sun(450, 296, 28).ridge(0.15, 296, 70).forest(0.4, 312, 'pine', 14, 28).water(312, 450);
    b.boat(330, 372, 1, 0.9).reeds(0, 260, 450, 90, 1).reeds(600, 800, 450, 80, 1).fog(296, 50, 0.45);
  });
  S('n_pass', 'Горный перевал', 'nature', ['mountain', 'winter', 'travel', 'road'], (b) => {
    b.sky('winter').sun(600, 120, 22, 0.8).ridge(0.15, 260, 170, 0.6, { caps: true }).ridge(0.4, 320, 150, 0.6, { caps: true });
    b.hills(0.25, 380, 30).road(420, 330, 300, 3, 90).horse(360, 400, 0.45, 0.9, { rider: 'cloak' }).person(300, 410, 46, 0.9, 'cloak').person(270, 414, 44, 0.9, 'elder').snow(90, 0.7);
  });
  S('n_bridge', 'Каменный мост', 'nature', ['river', 'road', 'travel', 'water', 'summer'], (b) => {
    b.sky('day').clouds(5, 40, 150).ridge(0.15, 290, 70).forest(0.4, 316, 'mixed', 20, 40).water(330, 420);
    b.bridge(160, 640, 378, 60, 0.85, 3).horse(420, 318, 0.55, 0.85, { rider: 'knight' }).ground(1, 430).reeds(0, 200, 440, 50, 1);
  });
  S('n_meadow', 'Весенний луг', 'nature', ['field', 'spring', 'calm', 'nature'], (b) => {
    b.sky('spring').clouds(6, 40, 170, 0.7).hills(0.3, 300, 30).hills(0.55, 344, 34).flowers(0, 800, 330, 380, 70);
    b.tree(620, 360, 150, 0.7).hills(0.8, 400, 20).flowers(0, 800, 392, 450, 120).person(260, 440, 52, 1, 'child').birds(3, 400, 100, 60, 0.7);
  });
  S('n_autumn', 'Осенние холмы', 'nature', ['autumn', 'field', 'travel', 'road'], (b) => {
    b.sky('golden').sun(120, 240, 26).hills(0.3, 304, 30).autumnTrees(-20, 820, 330, 50, 80, 0.5).hills(0.6, 360, 24);
    b.road(500, 350, 300, 4, 140, 0.7).autumnTrees(560, 820, 420, 120, 170, 0.9).cart(260, 418, 0.9, 1, true).horse(330, 418, 0.75, 1);
  });
  S('n_swamp', 'Болото', 'nature', ['swamp', 'mystery', 'danger', 'fog', 'magic', 'autumn'], (b) => {
    b.sky('mist').forest(0.3, 320, 'dead', 40, 70).water(330, 400, { glintOp: 0.15 }).add(`<g fill="${b.col(0.7)}"><ellipse cx="150" cy="370" rx="120" ry="16"/><ellipse cx="560" cy="400" rx="180" ry="20"/><ellipse cx="320" cy="430" rx="200" ry="22"/></g>`);
    b.tree(140, 372, 150, 0.85, 'dead').tree(620, 404, 180, 0.95, 'dead').reeds(0, 800, 450, 70, 1).wisps(6, 200, 600, 300, 380).fog(300, 100, 0.55);
  });
  S('n_hunt', 'Охота в лесу', 'nature', ['forest', 'hunt', 'food', 'animals', 'autumn'], (b) => {
    b.sky('golden').forest(0.3, 320, 'mixed', 60, 100, 1.2).beams(100, 700, 0, 0.1).ground(0.6, 360);
    b.beast(500, 380, 1.2, 0.75, 'deer').person(170, 430, 96, 1, 'archer').beast(260, 440, 0.8, 1, 'wolf').forest(0.95, 450, 'pine', 200, 260, 0.6, 660, 840);
  });

  // ---- Замки и города ----
  S('c_castle_day', 'Замок на холме', 'castle', ['castle', 'noble', 'day', 'summer'], (b) => {
    b.sky('day').clouds(6, 40, 170).ridge(0.15, 290, 60).mound(400, 330, 280, 60, 0.4).castle(400, 276, 0.9, 0.5);
    b.road(380, 300, 260, 4, 110, 0.6).village(640, 370, 3, 0.6, 0.65).forest(0.8, 410, 'leafy', 40, 70, 1, -20, 200).ground(0.95, 430);
  });
  S('c_castle_dusk', 'Замок в закатный час', 'castle', ['castle', 'dusk', 'noble'], (b) => {
    b.sky('dusk').sun(200, 300, 34).ridge(0.2, 300, 60).cliff(480, 0, 250, 0.7).castle(640, 250, 0.75, 0.7);
    b.forest(0.85, 410, 'pine', 40, 80, 1, -20, 460).birds(8, 360, 140, 80, 0.85).fog(330, 60, 0.3);
  });
  S('c_ducal_city', 'Вельмар, город герцога', 'castle', ['city', 'noble', 'travel', 'trade'], (b) => {
    b.sky('golden').sun(660, 220, 26).ridge(0.15, 270, 60).cityMedieval(300, 0.5, 1).water(360, 660).boat(260, 410, 0.8, 0.9).boat(560, 430, 0.9, 1);
  });
  S('c_city_gate', 'Городские ворота', 'castle', ['city', 'road', 'travel', 'trade'], (b) => {
    b.sky('day').clouds(4, 30, 140).wall(-10, 810, 360, 120, 0.6).gate(400, 360, 1.5, 0.7).ground(0.9, 370).road(400, 360, 400, 50, 260, 0.6);
    b.person(310, 410, 84, 1, 'soldier').person(490, 410, 84, 1, 'soldier', { flip: true }).cart(560, 440, 1, 1, true).horse(640, 440, 0.85, 1).crowd(60, 220, 440, 70, 1, 4);
  });
  S('c_city_market', 'Городской рынок', 'castle', ['city', 'market', 'trade', 'people', 'day'], (b) => {
    b.sky('day').townhouses(-10, 820, 360, 0.55, 110, 190).ground(0.8, 370, b.col(0.4));
    b.stall(120, 402, 1.1, 0.85, '#6b3f73').stall(400, 398, 1.2, 0.85, '#8e3a2f').stall(680, 402, 1.1, 0.85, '#4b7446').crowd(30, 780, 448, 72, 1, 15, ['man', 'woman', 'cloak', 'bucket', 'child']);
  });
  S('c_harbor', 'Гавань', 'castle', ['city', 'harbor', 'water', 'trade', 'dusk'], (b) => {
    b.sky('dusk').sun(300, 300, 32).water(310, 300).townhouses(560, 820, 316, 0.6, 50, 100).tower(600, 316, 0.7, 0.65, { flat: true, h: 120, lit: true });
    b.ship(260, 360, 0.9, 0.75).ship(480, 400, 1.3, 0.92).add(`<rect x="560" y="410" width="260" height="14" fill="${b.col(1)}"/>`).birds(6, 400, 160, 120, 0.85);
  });
  S('c_cathedral', 'Соборная площадь', 'castle', ['city', 'church', 'faith', 'people'], (b) => {
    b.sky('mist').townhouses(-10, 230, 380, 0.55, 90, 160).townhouses(580, 820, 380, 0.55, 90, 160).church(420, 380, 2.4, 0.65);
    b.ground(0.8, 390, b.col(0.45)).crowd(120, 680, 440, 54, 1, 12, ['cloak', 'woman', 'man', 'priest']).birds(10, 400, 120, 160, 0.8);
  });
  S('c_castle_winter', 'Зимняя крепость', 'castle', ['castle', 'winter', 'noble'], (b) => {
    b.sky('winter').clouds(5, 40, 150, 0.6, '#dde5ec').ridge(0.18, 280, 100, 0.55, { caps: true }).mound(400, 340, 300, 50, 0.3).castle(400, 292, 0.85, 0.55);
    b.forest(0.7, 392, 'pine', 40, 70).ground(0.15, 420).snow(150, 0.8);
  });
  S('c_lonely_tower', 'Одинокая башня', 'castle', ['tower', 'magic', 'mystery', 'storm', 'sea'], (b) => {
    b.sky('storm').clouds(6, 30, 150, 0.6, '#262d36').lightning(180, 0, 260).water(320, 200, { glintOp: 0.1 }).cliff(480, 0, 230, 0.8);
    b.tower(640, 236, 0.9, 0.85, { glowTop: true, lit: true }).birds(5, 380, 160, 70, 0.85).rain(140, 0.25);
  });
  S('c_palace_night', 'Дворец ночью', 'castle', ['castle', 'night', 'noble', 'celebration'], (b) => {
    b.sky('night').stars(80, 200).sparkles(30, 120, 320, 60, 160, '#ffd27a').sparkles(30, 480, 700, 40, 150, '#c08cff').water(340, 400, { glint: '#ffc66b', glintOp: 0.5 });
    b.castle(400, 336, 1.1, 0.7, { lit: true }).garland(0, 800, 330, 10, 'lanterns');
  });

  // ---- Под крышей ----
  S('i_tavern', 'Таверна «Хромой гусь»', 'interior', ['tavern', 'interior', 'people', 'night', 'trade'], (b) => {
    b.room('tavern', { beams: true, posts: [40, 760] }).fireplace(620, 330, 1).lantern(260, 120).lantern(480, 140, 0.9);
    b.barrel(90, 380, 1.2).barrel(140, 384, 1.1).person(250, 420, 110, 0.9, 'sit').person(380, 422, 110, 0.9, 'sit', { flip: true }).table(320, 430, 200);
    b.person(560, 440, 150, 1, 'man').vignette(0.55);
  });
  S('i_study', 'Ночь над чертежами', 'interior', ['study', 'interior', 'invention', 'knowledge', 'night'], (b) => {
    b.room('study').win(570, 60, 120, 200, 'night', { moon: true, stars: true }).shelf(40, 70, 170, 240);
    b.table(400, 450, 380).paper(250, 380, 110, 70, -6, true).paper(370, 384, 90, 64, 4).paper(470, 376, 100, 70, -2, true).candle(560, 398, 1.1);
    b.person(300, 460, 200, 1, 'man').vignette(0.6);
  });
  S('i_throne', 'Тронный зал', 'interior', ['throne', 'noble', 'interior'], (b) => {
    b.room('noble').hanging(110, 30, 70, 200, '#35597f', true).hanging(620, 30, 70, 200, '#35597f', true);
    b.add(poly([[340, 330], [460, 330], [620, 450], [180, 450]], ` fill="${mix('#7a1f2a', '#14090b', 0.3)}"`)).throne(400, 330, 1);
    b.beams(260, 540, 0, 0.08).person(230, 420, 130, 1, 'soldier').person(570, 420, 130, 1, 'soldier', { flip: true }).vignette(0.55);
  });
  S('i_library', 'Монастырская библиотека', 'interior', ['knowledge', 'faith', 'interior', 'study'], (b) => {
    b.room('stone').shelf(20, 40, 220, 290).shelf(560, 40, 220, 290).win(340, 40, 120, 220, 'day', { beamOp: 0.14 });
    b.add(`<path d="M400,420V350M370,350H430L420,336H380Z" stroke="${b.col(0.95)}" stroke-width="8" fill="${b.col(0.95)}"/>`).paper(372, 326, 56, 16).person(470, 430, 140, 1, 'monk').sparkles(20, 340, 560, 120, 400).vignette(0.5);
  });
  S('i_kitchen', 'Кухня Марты', 'interior', ['interior', 'manor', 'food', 'home', 'people'], (b) => {
    b.room('kitchen', { beams: true }).herbs(60, 760, 22).fireplace(560, 330, 1.1).cauldron(560, 330, 0.8, null, true);
    b.table(250, 420, 260).add(`<g fill="#b8823e"><ellipse cx="200" cy="364" rx="26" ry="12"/><ellipse cx="260" cy="362" rx="20" ry="10"/></g>`).person(330, 440, 150, 1, 'woman').vignette(0.5);
  });
  S('i_chapel', 'Часовня Светлого Ока', 'interior', ['church', 'faith', 'interior'], (b) => {
    b.room('chapel').win(340, 30, 120, 230, 'day', { stained: true, beamOp: 0.12 });
    b.add(`<rect x="330" y="290" width="140" height="40" fill="${b.col(0.85)}"/>`).sunSign(400, 280, 8).candle(345, 290).candle(455, 290);
    for (let i = 0; i < 3; i++) b.add(`<rect x="${100 - i * 30}" y="${370 + i * 28}" width="${200 + i * 20}" height="16" fill="${b.col(0.9)}"/><rect x="${500 + i * 10}" y="${370 + i * 28}" width="${200 + i * 20}" height="16" fill="${b.col(0.9)}"/>`);
    b.person(400, 380, 110, 1, 'priest').vignette(0.5);
  });
  S('i_dungeon', 'Темница', 'interior', ['dungeon', 'danger', 'interior', 'night', 'faith'], (b) => {
    b.room('dungeon').win(360, 50, 80, 90, 'night', { moon: true, beamOp: 0.16 }).person(400, 430, 120, 0.95, 'sit');
    b.add(`<path d="M150,60Q160,160 150,260M650,60Q640,160 650,260" stroke="${b.col(0.8)}" stroke-width="5" stroke-dasharray="10 4" fill="none"/>`).light(720, 200, 200, 0.4);
    let bars = ''; for (let x = 20; x < 800; x += 56) bars += `<rect x="${x}" y="0" width="14" height="450"/>`;
    b.add(`<g fill="${b.col(1)}">${bars}<rect x="0" y="60" width="800" height="12"/><rect x="0" y="380" width="800" height="12"/></g>`).vignette(0.6);
  });
  S('i_banya', 'Баня по-чёрному', 'interior', ['healing', 'interior', 'invention'], (b) => {
    b.room('bath').win(120, 120, 70, 90, 'day', { beamOp: 0.15 }).add(`<rect x="300" y="300" width="460" height="30" fill="${b.col(0.85)}"/><rect x="330" y="330" width="16" height="70" fill="${b.col(0.85)}"/><rect x="720" y="330" width="16" height="70" fill="${b.col(0.85)}"/>`);
    b.tub(220, 430, 1).light(600, 260, 220, 0.3).add(`<rect x="560" y="210" width="100" height="90" fill="${b.col(0.7)}"/>`).flame(610, 296, 26).steam(450, 300, 600).vignette(0.5);
  });
  S('i_council', 'Военный совет', 'interior', ['war', 'noble', 'intrigue', 'interior'], (b) => {
    b.room('noble').hanging(360, 20, 80, 150, '#8e2a24', true).person(200, 400, 160, 0.95, 'knight').person(600, 400, 160, 0.95, 'noble', { flip: true });
    b.table(400, 450, 460, 1).paper(260, 386, 280, 60, 0).add(`<g fill="${b.col(1)}"><circle cx="330" cy="410" r="5"/><circle cx="360" cy="400" r="5"/><rect x="430" y="404" width="8" height="8"/></g>`).candle(250, 398).candle(560, 398).vignette(0.55);
  });
  S('i_feast', 'Пир', 'interior', ['noble', 'celebration', 'intrigue', 'people', 'interior'], (b) => {
    b.room('noble', { beams: true }).hanging(120, 30, 60, 160, '#a8822f', true).hanging(620, 30, 60, 160, '#a8822f', true).fireplace(400, 330, 0.9);
    b.crowd(80, 720, 400, 110, 0.95, 8, ['noble', 'woman', 'man']).table(400, 460, 760, 1).add(`<g fill="${GOLD}">${[120, 220, 330, 470, 580, 680].map((x) => `<rect x="${x}" y="394" width="8" height="14"/>`).join('')}</g>`).vignette(0.5);
  });

  // ---- Прогрессорство ----
  S('k_forge', 'Кузница', 'craft', ['workshop', 'invention', 'craft', 'war'], (b) => {
    b.room('workshop').forge(600, 330, 1).add(`<path d="M80,60V200M110,60V180M140,60V210" stroke="${b.col(0.9)}" stroke-width="4"/>`).anvil(380, 420, 1.3);
    b.person(270, 440, 170, 1, 'smith').sparkles(14, 380, 470, 330, 380, '#ffd27a').vignette(0.5);
  });
  S('k_watermill', 'Новая водяная мельница', 'craft', ['invention', 'river', 'food', 'village', 'summer'], (b) => {
    b.sky('day').clouds(4, 40, 150).ridge(0.15, 290, 60).forest(0.4, 320, 'mixed', 20, 40).river(560, 330, 640, 14, 200);
    b.watermill(440, 392, 1.4, 0.85).house(180, 380, 0.8, 0.8, { smoke: true }).ground(0.95, 420).person(300, 440, 64, 1, 'bucket');
  });
  S('k_windmill', 'Ветряк над полями', 'craft', ['invention', 'field', 'food', 'summer'], (b) => {
    b.sky('golden').clouds(5, 40, 160, 0.5).hills(0.3, 312, 22).windmill(170, 316, 0.6, 0.45);
    b.fieldStripes(330, [b.tint('#8a9a3a', 0.6), b.tint('#c99a3a', 0.6), b.tint('#6b7f3a', 0.6)]).windmill(470, 410, 1.6, 0.92).birds(5, 600, 120, 60, 0.8);
  });
  S('k_glass', 'Стекольная мастерская', 'craft', ['workshop', 'invention', 'trade'], (b) => {
    b.room('workshop').shelf(560, 60, 210, 200).add(`<path d="M120,330V220Q200,140 280,220V330Z" fill="${b.col(0.75)}"/>`).light(200, 290, 200, 0.6).add('<ellipse cx="200" cy="290" rx="30" ry="22" fill="#ffb24a"/>');
    b.person(400, 440, 170, 1, 'man').add(`<path d="M420,330L520,300" stroke="${b.col(1)}" stroke-width="4"/>`).light(528, 298, 50, 0.9, '#ffc46a').add('<circle cx="528" cy="298" r="10" fill="#ffd98a"/>');
    for (let i = 0; i < 6; i++) b.add(`<ellipse cx="${590 + i * 30}" cy="${150}" rx="9" ry="13" fill="#a8d8ff" opacity=".55"/>`);
    b.vignette(0.5);
  });
  S('k_soap', 'Мыловарня', 'craft', ['workshop', 'invention', 'healing', 'trade'], (b) => {
    b.room('workshop').win(600, 70, 110, 160, 'day').cauldron(220, 410, 1.2, null, true).cauldron(420, 410, 0.9, null, true);
    b.person(320, 440, 160, 1, 'man').add(`<path d="M330,320L230,350" stroke="${b.col(1)}" stroke-width="5"/>`);
    for (let i = 0; i < 8; i++) b.add(`<rect x="${560 + (i % 4) * 44}" y="${280 + Math.floor(i / 4) * 24}" width="34" height="16" fill="${['#e8d8b0', '#c9e0c0', '#e0c8d8'][i % 3]}" opacity=".8"/>`);
    b.vignette(0.5);
  });
  S('k_press', 'Печатный станок', 'craft', ['invention', 'knowledge', 'workshop'], (b) => {
    b.room('study').sheets(70, 40, 760).press(420, 430, 1.4).person(620, 440, 160, 1, 'man', { flip: true });
    b.add(`<rect x="120" y="390" width="120" height="40" fill="#e6dcc2" opacity=".8"/><rect x="126" y="380" width="110" height="10" fill="#d8ccb0" opacity=".8"/>`).candle(180, 378).vignette(0.55);
  });
  S('k_still', 'Перегонный куб', 'craft', ['invention', 'healing', 'workshop'], (b) => {
    b.room('workshop').shelf(40, 60, 170, 220).light(400, 380, 140, 0.5).flame(400, 420, 30);
    b.add(`<circle cx="400" cy="350" r="60" fill="${b.lin([[0, '#d48a4a'], [1, '#6b3a1a']])}"/><path d="M400,290Q400,230 500,240T620,320" stroke="#b87333" stroke-width="10" fill="none"/><rect x="580" y="320" width="80" height="90" rx="10" fill="${b.col(0.85)}"/>`);
    b.flasks(690, 440, 3, 1.2).person(200, 450, 150, 1, 'man').vignette(0.5);
  });
  S('k_furnace', 'Доменная печь', 'craft', ['invention', 'fire', 'night', 'war', 'workshop'], (b) => {
    b.sky('night').stars(50, 160).smokeColumn(420, 140, 160, 30, 0.5).hills(0.5, 360, 20);
    b.add(poly([[340, 400], [370, 160], [470, 160], [500, 400]], ` fill="${b.col(0.85)}"`)).light(420, 360, 240, 0.6).add('<path d="M395,400V360A25,25 0 0 1 445,360V400Z" fill="#ffb24a"/>').flame(420, 162, 60);
    b.ground(1, 410).person(250, 440, 80, 1, 'man').person(580, 440, 84, 1, 'smith', { flip: true }).embers(40, 330, 520, 40, 200);
  });
  S('k_gunpowder', 'Испытание пороха', 'craft', ['invention', 'war', 'danger', 'fire'], (b) => {
    b.sky('mist').hills(0.35, 320, 26).forest(0.5, 340, 'pine', 20, 36).explosion(560, 320, 34).smokeColumn(540, 310, 160, 46, 0.5);
    b.ground(0.95, 396).person(200, 430, 70, 1, 'crouch').person(280, 434, 70, 1, 'crouch').person(130, 436, 84, 1, 'soldier').barrel(380, 430, 0.8);
  });
  S('k_fields', 'Севооборот', 'craft', ['field', 'invention', 'food', 'spring'], (b) => {
    b.sky('spring').clouds(5, 40, 150).hills(0.3, 306, 22).windmill(650, 316, 0.5, 0.45).village(180, 320, 3, 0.45, 0.45);
    b.fieldStripes(326, [b.tint('#6b8f3a', 0.6), b.tint('#7a5a3a', 0.6), b.tint('#c9b25a', 0.6), b.tint('#4f7a3a', 0.6)]);
    b.horse(440, 420, 0.9, 1).add(`<path d="M400,400L340,418" stroke="${b.col(1)}" stroke-width="4"/>`).person(320, 430, 80, 1, 'man').birds(5, 300, 360, 50, 0.95);
  });

  // ---- Магия и тайны ----
  S('m_witch_hut', 'Изба лесной ведьмы', 'magic', ['forest', 'magic', 'witch', 'night', 'healing'], (b) => {
    b.sky('night').stars(60, 160).moon(640, 80, 18, { crescent: true }).forest(0.4, 330, 'pine', 80, 130, 1.2);
    b.house(400, 390, 1.6, 0.9, { lit: true, smoke: true }).beast(420, 302, 0.6, 1, 'raven').forest(0.95, 440, 'pine', 200, 280, 0.6, -40, 180).wisps(5, 200, 640, 330, 400).fog(340, 90, 0.35);
  });
  S('m_rune_circle', 'Круг рун', 'magic', ['magic', 'ritual', 'night', 'mystery'], (b) => {
    b.sky('night').stars(140, 300).hills(0.45, 330, 26).runeCircle(400, 400, 210, 34);
    for (const [x, y, h] of [[230, 380, 70], [320, 370, 64], [480, 370, 64], [570, 380, 70], [190, 420, 90], [610, 420, 90]]) b.menhir(x, y, h, 0.95);
    b.person(400, 410, 90, 1, 'robe').person(400, 410, 90, 1, 'cheer');
  });
  S('m_mage_tower', 'Башня Коллегии чародеев', 'magic', ['magic', 'city', 'tower', 'guild'], (b) => {
    b.sky('magic').stars(80, 220).townhouses(-10, 820, 410, 0.7, 40, 90).tower(400, 410, 1.6, 0.85, { slim: true, h: 220, spire: 90, glowTop: true });
    b.add(`<g stroke="${b.p.light}" fill="none" opacity=".6" filter="${b.glowF()}" class="spin-slow" style="transform-origin:400px 120px"><ellipse cx="400" cy="120" rx="90" ry="16"/><ellipse cx="400" cy="120" rx="130" ry="24" stroke-dasharray="20 14"/></g>`).wisps(8, 260, 540, 40, 200, '#e2c4ff');
  });
  S('m_crystal_cave', 'Пещера кристаллов', 'magic', ['cave', 'magic', 'mystery'], (b) => {
    b.cave().crystals(440, 410, 1.6, '#b98cff').crystals(250, 420, 0.8, '#7ad8ff').person(600, 430, 120, 1, 'lantern', { flip: true }).sparkles(30, 200, 600, 150, 400, '#e6d4ff').vignette(0.4);
  });
  S('m_ghost_tower', 'Призрак в башне', 'magic', ['mystery', 'ruins', 'night', 'danger', 'magic'], (b) => {
    b.sky('night').stars(80, 200).moon(220, 100, 30).hills(0.5, 360, 20).tower(470, 380, 1.3, 0.85, { ruined: true, h: 200, lit: false });
    b.light(600, 300, 120, 0.25, '#cfe6ff').person(600, 360, 130, 0, 'robe', { c: '#cfe6ff', op: 0.5, filter: b.glowF() }).ground(1, 410).birds(5, 600, 120, 50, 0.9).fog(360, 80, 0.4);
  });
  S('m_mechanism', 'Механизм Древних', 'magic', ['ruins', 'mystery', 'invention', 'portal', 'magic'], (b) => {
    b.sky('mist').hills(0.35, 330, 24).cog(260, 330, 90, 14, b.col(0.75)).cog(430, 300, 60, 10, b.col(0.7)).ruins(560, 390, 1.2, 0.85);
    b.light(330, 320, 160, 0.3, '#9fe0ff').ground(0.95, 395).person(420, 430, 80, 1, 'cloak').fog(340, 80, 0.45);
  });
  S('m_glow_stone', 'Светящийся камень', 'magic', ['mystery', 'magic', 'field', 'night', 'sign'], (b) => {
    b.sky('night').stars(140, 280).hills(0.5, 340, 26).light(420, 300, 220, 0.25).add(`<rect x="408" y="0" width="24" height="320" fill="${b.lin([[0, b.p.light, 0], [1, b.p.light, 0.35]])}"/>`);
    b.menhir(420, 380, 120, 0.9, true).hills(0.95, 410, 14).person(260, 436, 70, 1, 'cloak').sparkles(26, 0, 800, 330, 430, '#fff4b0');
  });
  S('m_aurora', 'Сияние над лесом', 'magic', ['magic', 'night', 'winter', 'sign'], (b) => {
    b.sky('winnight').stars(120, 300).aurora(90, 0.7).hills(0.4, 350, 26).forest(0.7, 380, 'pine', 40, 80);
    b.house(560, 412, 0.7, 0.95, { lit: true, smoke: true }).ground(0.2, 420, '#9fb2cc').snow(60, 0.5);
  });
  S('m_oracle', 'Шатёр гадалки', 'magic', ['mystery', 'market', 'magic', 'people', 'night'], (b) => {
    b.sky('night').stars(70, 200).garland(0, 800, 90, 30, 'lanterns').tent(400, 400, 4, 0.9, { color: '#6b3f73', lit: true });
    b.light(400, 380, 40, 0.9, '#9ff0ff').ground(1, 410).crowd(80, 260, 440, 64, 1, 3).crowd(560, 740, 440, 64, 1, 3);
  });
  S('m_raven', 'Вестник-ворон', 'magic', ['mystery', 'sign', 'animals', 'night', 'dusk'], (b) => {
    b.sky('dusk').moon(560, 200, 70, { c: '#ffd8a0' }).hills(0.5, 360, 20).tree(170, 400, 220, 0.95, 'dead');
    b.add(`<rect x="430" y="300" width="18" height="150" fill="${b.col(1)}"/><path d="M0,380H800" stroke="${b.col(1)}" stroke-width="6"/>`).beast(440, 302, 1.6, 1, 'raven').birds(4, 650, 120, 60, 0.9);
  });

  // ---- Опасности ----
  S('d_bandits', 'Засада на дороге', 'danger', ['road', 'danger', 'forest', 'bandits', 'dusk'], (b) => {
    b.sky('dusk').forest(0.4, 320, 'pine', 60, 100).road(400, 330, 400, 10, 200, 0.8).forest(0.8, 430, 'pine', 160, 240, 0.7, -40, 200).forest(0.8, 430, 'pine', 160, 240, 0.7, 600, 840);
    b.cart(400, 380, 0.8, 0.9, true).person(260, 440, 110, 1, 'soldier').person(560, 436, 110, 1, 'archer', { flip: true }).person(470, 400, 70, 0.95, 'cloak');
  });
  S('d_wolves', 'Волки', 'danger', ['winter', 'danger', 'beast', 'animals', 'night'], (b) => {
    b.sky('winnight').stars(90, 250).moon(600, 120, 46).forest(0.5, 350, 'pine', 50, 90).ground(0.2, 380, '#b9c8dc');
    b.add(`<path d="M520,380Q580,320 680,330Q740,340 800,380Z" fill="${b.col(0.9)}"/>`).beast(640, 338, 1.2, 1, 'wolf', { howl: true });
    b.beast(250, 420, 1.3, 1, 'wolf').beast(380, 432, 1.1, 1, 'wolf', { flip: true }).beast(120, 440, 1, 1, 'wolf').snow(60, 0.5);
  });
  S('d_beast', 'Лесная тень', 'danger', ['beast', 'forest', 'danger', 'mystery', 'night'], (b) => {
    b.sky('night').forest(0.35, 330, 'pine', 90, 140, 1.4).fog(280, 100, 0.35).beast(420, 400, 2.2, 0.95, 'shadow', { eyes: true });
    b.forest(0.95, 450, 'pine', 220, 300, 0.6, -40, 200).person(640, 440, 90, 1, 'torch', { flip: true });
  });
  S('d_plague', 'Мор', 'danger', ['plague', 'village', 'death', 'danger', 'healing'], (b) => {
    b.sky('mist').hills(0.35, 330, 20).village(400, 370, 6, 0.9, 0.7, { lit: false }).ground(0.95, 395);
    b.cart(420, 430, 1.1, 1, true).person(300, 440, 90, 1, 'robe').person(540, 440, 84, 1, 'robe', { flip: true }).birds(7, 200, 150, 90, 0.9).fog(330, 110, 0.55);
  });
  S('d_flood', 'Паводок', 'danger', ['water', 'river', 'danger', 'spring', 'storm'], (b) => {
    b.sky('storm').clouds(8, 20, 160, 0.6, '#2c343d').hills(0.35, 300, 20).village(400, 360, 6, 0.9, 0.6, { lit: false }).tree(140, 380, 120, 0.8);
    b.add(`<rect x="0" y="340" width="800" height="110" fill="${b.lin([[0, '#5a6a72'], [1, '#2a343a']])}" opacity=".92"/>`).boat(560, 400, 1.1, 0.95).rain(200, 0.3);
  });
  S('d_drought', 'Засуха', 'danger', ['field', 'danger', 'summer', 'food'], (b) => {
    b.sky('golden').sun(560, 150, 46).hills(0.3, 310, 18, 1, mix('#c9a46a', '#3a2a1a', 0.3)).ground(0.5, 340, mix('#b88a4a', '#3a2a1a', 0.35)).cracks(350);
    b.tree(200, 380, 170, 0.9, 'dead').person(470, 420, 66, 1, 'sit').light(560, 150, 300, 0.25);
  });
  S('d_assassin', 'Тень на крыше', 'danger', ['night', 'danger', 'intrigue', 'assassin', 'city'], (b) => {
    b.sky('night').stars(80, 220).townhouses(-10, 820, 380, 0.55, 60, 140).moon(268, 196, 64);
    b.add(poly([[-10, 450], [-10, 340], [260, 262], [560, 340], [560, 450]], ` fill="${b.col(1)}"`)).person(268, 266, 110, 1, 'crouch', { dagger: true });
  });
  S('d_storm', 'Гроза', 'danger', ['storm', 'danger', 'nature', 'rain'], (b) => {
    b.sky('storm').clouds(9, 20, 180, 0.7, '#1f252c').lightning(520, 0, 330).hills(0.4, 330, 24).house(250, 380, 1.1, 0.85, { lit: true });
    b.add(`<g transform="skewX(-12)" style="transform-origin:600px 400px">`).tree(620, 400, 200, 0.95).add('</g>').ground(1, 410).rain(280, 0.35, -14);
  });
  S('d_burned', 'Пепелище', 'danger', ['fire', 'death', 'war', 'village', 'danger'], (b) => {
    b.sky('fire').smokeColumn(220, 340, 300, 30, 0.5).smokeColumn(560, 360, 300, 36, 0.5).hills(0.6, 350, 18);
    b.charred(180, 390, 1.6).charred(420, 384, 1.3).charred(620, 392, 1.8).ground(1, 400).person(400, 440, 80, 1, 'sit').embers(50, 0, 800, 200, 420);
  });
  S('d_deserters', 'Лагерь дезертиров', 'danger', ['camp', 'danger', 'war', 'forest', 'bandits'], (b) => {
    b.sky('dusk').forest(0.45, 340, 'pine', 70, 110).tent(200, 400, 1.6, 0.9).tent(620, 404, 1.4, 0.9).ground(1, 405);
    b.campfire(420, 420, 1.6).person(330, 440, 80, 1, 'sit').person(500, 442, 80, 1, 'sit', { flip: true }).person(700, 440, 110, 1, 'soldier', { flip: true }).banner(120, 440, 110, 1, '#5a3a2a');
  });

  // ---- Люди и интриги ----
  S('p_duke', 'Герцог Ардан', 'people', ['noble', 'throne', 'interior', 'people'], (b) => {
    b.room('noble').hanging(100, 30, 70, 210, '#35597f', true).hanging(630, 30, 70, 210, '#35597f', true).throne(400, 330, 1).person(400, 300, 110, 0.95, 'king');
    b.person(250, 430, 150, 1, 'soldier').person(560, 450, 100, 1, 'sit').vignette(0.5);
  });
  S('p_inquisitor', 'Прибытие инквизитора', 'people', ['faith', 'danger', 'road', 'intrigue', 'storm'], (b) => {
    b.sky('storm').clouds(7, 20, 170, 0.6, '#262d36').forest(0.45, 330, 'pine', 50, 90).road(400, 330, 420, 8, 200, 0.7);
    b.horse(300, 430, 1.4, 1, { rider: 'knight' }).horse(470, 420, 1.3, 1, { rider: 'robe' }).horse(620, 414, 1.1, 0.95, { rider: 'soldier' });
    b.banner(560, 330, 120, 0.95, '#d8d0b8', { sign: true }).rain(200, 0.3);
  });
  S('p_moneylender', 'Контора ростовщика', 'people', ['money', 'interior', 'trade', 'intrigue'], (b) => {
    b.room('study').win(80, 70, 90, 150, 'mist').shelf(600, 50, 170, 260).person(400, 400, 180, 0.95, 'noble');
    b.table(400, 460, 480).scales(300, 404, 1).coins(420, 404, 5, 1).paper(500, 384, 90, 22).chest(640, 450, 1.2, true).candle(240, 404).vignette(0.55);
  });
  S('p_caravan', 'Купеческий караван', 'people', ['trade', 'road', 'travel', 'people'], (b) => {
    b.sky('golden').sun(150, 260, 30).hills(0.3, 310, 28).road(700, 330, 300, 4, 200, 0.7);
    b.cart(560, 360, 0.8, 0.75, true).horse(620, 360, 0.6, 0.75).cart(380, 400, 1.1, 0.88, true).horse(460, 400, 0.85, 0.88).horse(200, 440, 1.1, 1, { rider: 'soldier' }).person(300, 440, 84, 1, 'man');
  });
  S('p_priest', 'Отец Бенедикт', 'people', ['faith', 'church', 'village', 'people'], (b) => {
    b.sky('day').clouds(4, 40, 150).hills(0.3, 310, 26).church(430, 380, 1.4, 0.75).tree(130, 390, 160, 0.85).ground(0.95, 395);
    b.add(`<g fill="${b.col(0.95)}"><rect x="600" y="400" width="16" height="22" rx="6"/><rect x="640" y="404" width="16" height="22" rx="6"/><rect x="680" y="398" width="16" height="22" rx="6"/></g>`).person(330, 440, 110, 1, 'priest').crowd(430, 560, 444, 72, 1, 3);
  });
  S('p_duel', 'Поединок', 'people', ['duel', 'danger', 'noble', 'dawn', 'field'], (b) => {
    b.sky('dawn').sun(400, 300, 26).hills(0.3, 320, 20).fog(300, 60, 0.5).ground(0.9, 384);
    b.person(300, 430, 130, 1, 'knight').person(500, 430, 130, 1, 'man', { flip: true }).add(`<path d="M520,360L600,300" stroke="${b.col(1)}" stroke-width="3"/>`).crowd(80, 180, 412, 60, 0.85, 3).crowd(620, 740, 412, 60, 0.85, 3);
  });
  S('p_bard', 'Бард', 'people', ['tavern', 'people', 'celebration', 'interior'], (b) => {
    b.room('tavern', { beams: true, posts: [40, 760] }).light(400, 260, 220, 0.4).person(400, 410, 170, 1, 'bard');
    b.crowd(60, 300, 450, 100, 1, 4, ['sit']).crowd(500, 760, 450, 100, 1, 4, ['sit']).lantern(600, 120).vignette(0.6);
  });
  S('p_letter', 'Письмо с печатью', 'people', ['intrigue', 'interior', 'noble', 'study', 'letter'], (b) => {
    b.room('study', { floorY: 200 }).add(`<rect x="0" y="200" width="800" height="250" fill="${b.col(0.7)}"/>`).paper(240, 230, 320, 190, -4).candle(640, 330, 1.6);
    b.add(`<circle cx="480" cy="390" r="24" fill="#9b2c2c"/><circle cx="480" cy="390" r="15" fill="none" stroke="#6e1e1e" stroke-width="3"/><path d="M120,260L200,420" stroke="${b.col(1)}" stroke-width="4"/><path d="M120,260Q100,230 140,200" stroke="#e8e0d0" stroke-width="6" fill="none"/>`).vignette(0.6);
  });
  S('p_pilgrims', 'Паломники', 'people', ['faith', 'road', 'travel', 'people', 'dusk'], (b) => {
    b.sky('dusk').sun(560, 290, 30).hills(0.3, 312, 30).church(600, 300, 0.6, 0.45).road(560, 316, 300, 4, 180, 0.7);
    b.crowd(180, 520, 410, 70, 1, 8, ['robe', 'elder', 'cloak']).banner(480, 410, 140, 1, '#d8d0b8', { sign: true });
  });
  S('p_lovers', 'Встреча у реки', 'people', ['love', 'river', 'people', 'dusk', 'summer'], (b) => {
    b.sky('dusk').sun(560, 300, 28).ridge(0.2, 300, 50).water(320, 560).willow(170, 410, 220, 0.95).ground(1, 400);
    b.person(470, 430, 100, 1, 'woman').person(510, 432, 108, 1, 'man', { flip: true }).sparkles(18, 300, 700, 300, 420, '#fff4b0');
  });

  // ---- Война и финал ----
  S('x_camp', 'Военный лагерь', 'war', ['war', 'camp', 'army', 'dusk'], (b) => {
    b.sky('dusk').sun(650, 300, 26).hills(0.35, 320, 24);
    for (let i = 0; i < 6; i++) b.tent(80 + i * 130, 352, 0.6, 0.6, { flag: i % 2 ? '#8e2a24' : '#35597f' });
    b.tent(160, 420, 1.4, 0.9).tent(620, 424, 1.6, 0.9).campfire(400, 420, 1.3).person(330, 440, 80, 1, 'soldier').person(470, 440, 80, 1, 'sit', { flip: true }).smoke(400, 380, 120);
  });
  S('x_siege', 'Осада', 'war', ['war', 'battle', 'fire', 'danger', 'siege'], (b) => {
    b.sky('fire').smokeColumn(200, 260, 260, 30, 0.5).wall(-10, 810, 330, 150, 0.7).tower(140, 330, 1.2, 0.75, { flat: true, h: 200 }).tower(660, 330, 1.2, 0.75, { flat: true, h: 200 });
    b.crowd(220, 580, 182, 30, 0.75, 9, ['soldier', 'archer']).add(`<g stroke="${b.col(0.95)}" stroke-width="4"><path d="M300,450L360,190M330,450L390,190M560,450L500,190M590,450L530,190"/></g>`);
    b.flame(420, 180, 70).army(0, 800, 430, 46, 1, 2).embers(60, 0, 800, 50, 300).rain(60, 0.25, -30);
  });
  S('x_cannons', 'Батарея', 'war', ['war', 'invention', 'battle'], (b) => {
    b.sky('mist').hills(0.35, 322, 26).army(380, 800, 340, 16, 0.5, 2).ground(0.95, 384);
    b.cannon(150, 430, 1.3, 1, true).cannon(330, 426, 1.1, 1, true).person(90, 440, 90, 1, 'man').person(270, 440, 84, 1, 'soldier').banner(60, 440, 140, 1, '#35597f');
  });
  S('x_battle', 'Битва в поле', 'war', ['war', 'battle', 'danger', 'storm'], (b) => {
    b.sky('storm').clouds(6, 20, 160, 0.6, '#262d36').hills(0.35, 320, 20).army(0, 360, 360, 26, 0.7, 2, { banners: 2, color: '#35597f' }).army(440, 800, 360, 26, 0.7, 2, { banners: 2, color: '#8e2a24' });
    b.ground(0.95, 396).horse(260, 440, 1.3, 1, { rider: 'knight' }).horse(560, 440, 1.3, 1, { rider: 'soldier', flip: true }).rain(120, 0.25);
  });
  S('x_horde', 'Орда с севера', 'war', ['war', 'danger', 'army', 'storm'], (b) => {
    b.sky('fire').clouds(7, 20, 150, 0.5, '#2a0e0a').ridge(0.25, 300, 70).army(-10, 810, 330, 16, 0.55, 2).army(-10, 810, 352, 24, 0.75, 3, { banners: 6, color: '#1a1a1a' });
    b.ground(0.95, 404).horse(170, 440, 1.5, 1, { rider: 'cloak', flip: true }).birds(10, 500, 140, 140, 0.9);
  });
  S('x_victory', 'Рассвет победы', 'war', ['war', 'victory', 'dawn', 'celebration'], (b) => {
    b.sky('dawn').sun(400, 280, 34).rays(400, 280, 14, 0.07).hills(0.3, 318, 24).mound(400, 400, 260, 70, 0.95);
    b.person(400, 336, 90, 1, 'cheer').banner(420, 336, 150, 1, '#35597f', { sign: true }).crowd(80, 260, 440, 70, 1, 4, ['cheer', 'soldier']).crowd(540, 720, 440, 70, 1, 4, ['cheer', 'soldier']).birds(6, 220, 140, 60, 0.85);
  });
  S('x_funeral', 'Погребальный костёр', 'war', ['death', 'war', 'fire', 'dusk'], (b) => {
    b.sky('dusk').stars(30, 120).hills(0.4, 330, 22).smokeColumn(420, 260, 260, 26, 0.4).ground(0.95, 395);
    b.pyre(420, 400, 1.3, true).crowd(80, 300, 444, 80, 1, 5, ['cloak', 'robe', 'woman']).crowd(560, 760, 444, 80, 1, 4, ['cloak', 'soldier']).embers(40, 300, 540, 100, 330);
  });
  S('x_portal_home', 'Дорога домой', 'war', ['portal', 'home', 'magic', 'ending', 'night'], (b) => {
    b.sky('magic').stars(120, 300).hills(0.45, 360, 20).ruins(400, 380, 1.6, 0.85).portal(400, 240, 92, 120, { inside: true });
    b.ground(1, 410).person(400, 440, 100, 1, 'cloak').sparkles(30, 260, 540, 100, 380);
  });
  S('x_coronation', 'Коронация', 'war', ['noble', 'ending', 'celebration', 'throne', 'interior'], (b) => {
    b.room('noble').win(350, 20, 100, 170, 'golden', { beamOp: 0.16 }).hanging(140, 30, 70, 210, '#a8822f', true).hanging(590, 30, 70, 210, '#a8822f', true).throne(400, 330, 0.9);
    b.person(400, 400, 100, 1, 'sit').person(470, 400, 150, 1, 'priest', { flip: true }).crowd(40, 220, 450, 120, 1, 4, ['noble', 'woman']).crowd(580, 780, 450, 120, 1, 4, ['knight', 'noble']).vignette(0.45);
  });
  S('x_new_age', 'Новый век', 'war', ['invention', 'ending', 'city', 'victory', 'dawn'], (b) => {
    b.sky('dawn').sun(560, 270, 30).ridge(0.15, 280, 60).townhouses(80, 520, 340, 0.55, 40, 90).chimneys([[180, 110], [300, 140], [430, 100]], 340, 0.6);
    b.windmill(640, 350, 1.1, 0.7).windmill(740, 340, 0.8, 0.6).ground(0.9, 370).rails(410).locomotive(260, 410, 1.2).banner(700, 430, 120, 1, '#35597f', { sign: true });
  });

  const byId = {};
  SCENES.forEach((s) => { byId[s.id] = s; });

  R.ART = {
    CATS,
    SCENES,
    byId,
    render(id) {
      const s = byId[id] || SCENES[0];
      const pic = new Pic(s.id);
      s.draw(pic);
      return pic.svg();
    },
  };
})();
