'use strict';
// ---------- Погода: дождь, туман, пасмурно — что она меняет в бою и как выглядит ----------
// Осадки рисуются на отдельном холсте поверх карты, чтобы не перерисовывать мир каждый кадр.

const WEATHER = {
  clear: { name: 'Ясно', icon: 'sun', noise: 1, sight: 0, acc: 0, desc: 'Видно далеко — и слышно далеко.' },
  overcast: { name: 'Пасмурно', icon: 'cloud', noise: 1, sight: 0, acc: 0, desc: 'Серое небо. Ничего особенного.' },
  rain: { name: 'Дождь', icon: 'rain', noise: 0.7, sight: 1, acc: 0.05, desc: 'Дождь глушит шаги и выстрелы: их слышно на треть ближе. Обзор −1, стрелять чуть труднее.' },
  fog: { name: 'Туман', icon: 'fog', noise: 1, sight: 3, acc: 0.1, desc: 'Обзор −3 — и у вас, и у них. Можно подкрасться вплотную, но стрелять труднее.' },
};
function rollWeather() { const v = rnd(); return v < 0.46 ? 'clear' : v < 0.66 ? 'overcast' : v < 0.87 ? 'rain' : 'fog'; }
function wxOf(m) { return WEATHER[(m && m.weather) || 'clear']; }

const WX = {
  cv: null, c: null, kind: null, raf: 0, last: 0, W: 0, H: 0, dpr: 1, blob: null, bolt: 0, nextBolt: 0,
  init() {
    this.cv = document.getElementById('wx');
    if (!this.cv) return;
    this.c = this.cv.getContext('2d');
    // мягкое облако для тумана
    const b = document.createElement('canvas'); b.width = b.height = 256;
    const g = b.getContext('2d'), gr = g.createRadialGradient(128, 128, 10, 128, 128, 128);
    gr.addColorStop(0, 'rgba(170,172,168,0.55)'); gr.addColorStop(0.6, 'rgba(160,162,158,0.22)'); gr.addColorStop(1, 'rgba(160,162,158,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    this.blob = b;
    document.addEventListener('visibilitychange', () => { if (!document.hidden && this.kind) this.loop(); });
  },
  set(kind) {
    if (kind === 'clear' || kind === 'overcast') kind = kind === 'overcast' ? 'overcast' : null;
    if (kind === this.kind) return;
    this.kind = kind;
    Sfx.ambient(kind === 'rain' ? 'rain' : kind === 'fog' ? 'wind' : null);
    this.nextBolt = performance.now() + 15000 + Math.random() * 20000;
    if (!this.cv) return;
    if (!kind) { this.clear(); return; }
    this.loop();
  },
  clear() { if (this.c) { this.c.setTransform(1, 0, 0, 1, 0, 0); this.c.clearRect(0, 0, this.cv.width, this.cv.height); } cancelAnimationFrame(this.raf); this.raf = 0; },
  resize() {
    const W = this.cv.clientWidth || 1, H = this.cv.clientHeight || 1, dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (W !== this.W || H !== this.H || dpr !== this.dpr) { this.W = W; this.H = H; this.dpr = dpr; this.cv.width = Math.round(W * dpr); this.cv.height = Math.round(H * dpr); }
  },
  loop() {
    if (this.raf || !this.kind) return;
    const step = now => {
      this.raf = 0;
      if (!this.kind || document.hidden) return;
      this.raf = requestAnimationFrame(step);
      if (now - this.last < 33) return;   // 30 кадров хватает
      this.last = now;
      try { this.frame(now); } catch (e) { console.error(e); this.kind = null; this.clear(); }
    };
    this.raf = requestAnimationFrame(step);
  },
  frame(now) {
    this.resize();
    const c = this.c, W = this.W, H = this.H, t = now / 1000, gfx = CFG.gfx ?? 2, calm = reducedMotion;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this.cv.width, this.cv.height);
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const k = this.kind, inTac = R.mode === 'tac' && TAC.m;
    if (k === 'overcast') { c.fillStyle = 'rgba(40,48,58,0.12)'; c.fillRect(0, 0, W, H); this.raf && cancelAnimationFrame(this.raf); this.raf = 0; return; }
    if (k === 'rain') {
      c.fillStyle = 'rgba(22,32,46,0.16)'; c.fillRect(0, 0, W, H);
      if (calm) return;
      const n = Math.round((W * H) / [15000, 8000, 5200][gfx]);
      c.strokeStyle = 'rgba(190,206,226,0.34)'; c.lineWidth = 1;
      c.beginPath();
      for (let i = 0; i < n; i++) {
        const h1 = hash2(i, 1, 7), h2 = hash2(i, 2, 7), h3 = hash2(i, 3, 7);
        const sp = 1.1 + h1 * 0.6, y = (((h2 + t * sp) % 1) * 1.15 - 0.08) * H, len = 9 + h1 * 15;
        const x = ((h3 * 1.3 + y / H * 0.18) % 1) * W;
        c.moveTo(x, y); c.lineTo(x - len * 0.2, y - len);
      }
      c.stroke();
      // брызги на земле
      const ns = Math.round(n / 3);
      c.strokeStyle = 'rgba(200,214,230,0.4)';
      for (let i = 0; i < ns; i++) {
        const ph = t / 0.55 + hash2(i, 4, 7), cyc = Math.floor(ph), p = ph - cyc;
        const x = hash2(i, cyc, 11) * W, y = (0.12 + hash2(i, cyc, 13) * 0.88) * H, r = 1 + p * 5;
        c.globalAlpha = (1 - p) * 0.8;
        c.beginPath(); c.ellipse(x, y, r, r * 0.42, 0, 0, Math.PI * 2); c.stroke();
      }
      c.globalAlpha = 1;
      // молния вдалеке
      if (now > this.nextBolt) { this.bolt = now; this.nextBolt = now + 18000 + Math.random() * 30000; setTimeout(() => Sfx.thunder(), 500 + Math.random() * 1500); }
      const bp = (now - this.bolt) / 380;
      if (bp >= 0 && bp < 1) { c.fillStyle = `rgba(210,220,255,${(bp < 0.15 || (bp > 0.3 && bp < 0.4) ? 0.32 : 0.08) * (1 - bp)})`; c.fillRect(0, 0, W, H); }
      return;
    }
    if (k === 'fog') {
      // серая пелена, а вокруг бойцов — то, что они видят
      c.fillStyle = 'rgba(150,153,150,0.42)'; c.fillRect(0, 0, W, H);
      if (inTac) {
        const m = TAC.m, kk = R.cam.k, rad = (sightR(m) + 0.8) * kk * 0.85;
        c.globalCompositeOperation = 'destination-out';
        for (const u of liveUnits(m)) {
          const [px, py] = animPos(u, now), [sx, sy] = R.proj(px + 0.5, py + 0.5, 0.4);
          c.save(); c.translate(sx, sy); c.scale(1, VX.sE);
          const g = c.createRadialGradient(0, 0, rad * 0.2, 0, 0, rad);
          g.addColorStop(0, 'rgba(0,0,0,0.92)'); g.addColorStop(0.6, 'rgba(0,0,0,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0)');
          c.fillStyle = g; c.beginPath(); c.arc(0, 0, rad, 0, Math.PI * 2); c.fill();
          c.restore();
        }
        c.globalCompositeOperation = 'source-over';
      }
      if (!calm) for (let i = 0; i < 6; i++) {
        const s = Math.max(W, H) * (0.45 + hash2(i, 5, 3) * 0.35), x = (((hash2(i, 6, 3) + t * (0.006 + hash2(i, 7, 3) * 0.008)) % 1.4) - 0.2) * W, y = hash2(i, 8, 3) * H;
        c.globalAlpha = 0.5; c.drawImage(this.blob, x - s / 2, y - s / 3, s, s * 0.66);
      }
      c.globalAlpha = 1;
    }
  },
};
