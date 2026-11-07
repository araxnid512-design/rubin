/*
 * Титульная сцена: закат двух солнц над дюнами, разбитый корабль в песке, дым, звёзды.
 * Рисуется кодом на Canvas; корабль — оригинальный условный корпус, не копия кораблей из фильмов.
 */
(function (G) {
  'use strict';
  const TAU = Math.PI * 2;
  function hr(n) { n = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); n ^= n >>> 13; n = Math.imul(n, 0xc2b2ae35); n ^= n >>> 16; return (n >>> 0) / 4294967296; }

  G.TitleScene = function () {
    const canvas = document.createElement('canvas');
    canvas.className = 'title-scene';
    const ctx = canvas.getContext('2d');
    let w = 0, h = 0, dpr = 1, alive = true;
    const t0 = performance.now();

    function resize() {
      const cw = canvas.clientWidth || 600, ch = canvas.clientHeight || 200;
      if (cw === w && ch === h) return;
      w = cw; h = ch; dpr = Math.min(2, globalThis.devicePixelRatio || 1);
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function dune(base, amp, freq, phase, col) {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 6) ctx.lineTo(x, h * base - Math.sin(x * freq + phase) * h * amp - Math.sin(x * freq * 2.3 + phase * 1.7) * h * amp * 0.35);
      ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
    }

    // Корпус: длинный угловатый остов с палубными надстройками, одна сторона разломана
    function hull(t) {
      const x = w * 0.56, y = h * 0.74, L = Math.min(w * 0.62, h * 1.9), H = L * 0.13;
      ctx.save();
      ctx.translate(x, y); ctx.rotate(-0.07);
      const g = ctx.createLinearGradient(0, -H * 2, 0, H);
      g.addColorStop(0, '#5b5650'); g.addColorStop(0.6, '#3a3632'); g.addColorStop(1, '#25221f');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-L * 0.5, 0);
      ctx.lineTo(-L * 0.46, -H * 0.9); ctx.lineTo(-L * 0.18, -H * 1.1); ctx.lineTo(-L * 0.16, -H * 1.7); ctx.lineTo(-L * 0.04, -H * 1.75);
      ctx.lineTo(-L * 0.02, -H * 1.15); ctx.lineTo(L * 0.22, -H * 1.0);
      // разлом: рваный край
      ctx.lineTo(L * 0.27, -H * 1.3); ctx.lineTo(L * 0.3, -H * 0.7); ctx.lineTo(L * 0.34, -H * 1.05); ctx.lineTo(L * 0.37, -H * 0.4); ctx.lineTo(L * 0.4, -H * 0.6); ctx.lineTo(L * 0.42, 0);
      ctx.closePath(); ctx.fill();
      // кормовые дюзы — тлеют
      for (let k = 0; k < 3; k++) {
        const ey = -H * (0.25 + k * 0.28), er = H * 0.13;
        ctx.fillStyle = '#2b2724'; ctx.beginPath(); ctx.ellipse(-L * 0.505, ey, er * 0.7, er, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,120,60,' + (0.35 + 0.25 * Math.sin(t * 2 + k)).toFixed(3) + ')';
        ctx.beginPath(); ctx.ellipse(-L * 0.505, ey, er * 0.4, er * 0.6, 0, 0, TAU); ctx.fill();
      }
      // скошенные бронеплиты по верху корпуса
      ctx.fillStyle = 'rgba(120,112,104,0.5)';
      for (let k = 0; k < 5; k++) {
        const px = -L * 0.44 + k * L * 0.13;
        ctx.beginPath(); ctx.moveTo(px, -H * 0.92); ctx.lineTo(px + L * 0.05, -H * 1.18); ctx.lineTo(px + L * 0.1, -H * 1.0); ctx.closePath(); ctx.fill();
      }
      // панели и пояс огней
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1;
      for (let k = 1; k < 9; k++) { const px = -L * 0.48 + k * L * 0.085; ctx.beginPath(); ctx.moveTo(px, -H * 0.95); ctx.lineTo(px + 2, 0); ctx.stroke(); }
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(-L * 0.45, -H * 0.88, L * 0.65, H * 0.12);
      for (let k = 0; k < 14; k++) {
        const on = hr(k + Math.floor(t * 0.7 + k) * 31) > 0.35;
        ctx.fillStyle = on ? 'rgba(255,190,110,0.85)' : 'rgba(80,60,40,0.6)';
        ctx.fillRect(-L * 0.42 + k * L * 0.045, -H * 0.55, L * 0.012, H * 0.12);
      }
      // мачты связи на надстройке
      ctx.strokeStyle = '#4a4540'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-L * 0.12, -H * 1.72); ctx.lineTo(-L * 0.12, -H * 2.6); ctx.moveTo(-L * 0.07, -H * 1.74); ctx.lineTo(-L * 0.08, -H * 2.2); ctx.stroke();
      ctx.fillStyle = (Math.floor(t * 1.5) % 2) ? '#ff5a4a' : 'rgba(255,90,74,0.25)';
      ctx.beginPath(); ctx.arc(-L * 0.12, -H * 2.62, 1.8, 0, TAU); ctx.fill();
      // искры в разломе
      for (let k = 0; k < 4; k++) {
        const ph = (t * 1.3 + k * 0.37) % 1;
        if (ph > 0.25) continue;
        ctx.fillStyle = 'rgba(255,220,140,' + (1 - ph * 4).toFixed(2) + ')';
        ctx.beginPath(); ctx.arc(L * (0.3 + k * 0.025) + ph * 12, -H * (0.8 - ph * 2), 1.4, 0, TAU); ctx.fill();
      }
      ctx.restore();
      // дым из разлома
      for (let k = 0; k < 9; k++) {
        const ph = ((t * 0.08) + k / 9) % 1;
        const sx = x + L * 0.32 + ph * w * 0.12 + Math.sin(ph * 6 + k) * 6, sy = y - H * 1.1 - ph * h * 0.6;
        ctx.fillStyle = 'rgba(60,52,48,' + (0.35 * (1 - ph)).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(sx, sy, 6 + ph * 26, 0, TAU); ctx.fill();
      }
    }

    function frame() {
      if (!alive) return;
      if (!canvas.isConnected) { alive = false; return; }
      resize();
      const t = (performance.now() - t0) / 1000;
      // небо заката
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#120f1c'); sky.addColorStop(0.45, '#4a2a36'); sky.addColorStop(0.75, '#c2643c'); sky.addColorStop(1, '#f0a75a');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
      // звёзды мерцают в верхней части
      for (let k = 0; k < 70; k++) {
        const a = 0.25 + 0.5 * (0.5 + 0.5 * Math.sin(t * (1 + hr(k) * 2) + k));
        ctx.fillStyle = 'rgba(255,245,230,' + (a * (1 - hr(k + 7) * 0.5)).toFixed(3) + ')';
        ctx.fillRect(hr(k + 100) * w, hr(k + 200) * h * 0.45, 1.2, 1.2);
      }
      // два солнца
      const suns = [[w * 0.2, h * 0.58, Math.min(w, h) * 0.09, '255,214,140'], [w * 0.31, h * 0.5, Math.min(w, h) * 0.055, '255,170,110']];
      for (const [sx, sy0, r, c] of suns) {
        const sy = sy0 + Math.sin(t * 0.15) * 2;
        const glow = ctx.createRadialGradient(sx, sy, r * 0.5, sx, sy, r * 5);
        glow.addColorStop(0, 'rgba(' + c + ',0.55)'); glow.addColorStop(1, 'rgba(' + c + ',0)');
        ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(sx, sy, r * 5, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(' + c + ',1)'; ctx.beginPath(); ctx.arc(sx, sy, r, 0, TAU); ctx.fill();
      }
      // дальние дюны, корабль, ближние дюны
      dune(0.7, 0.05, 0.012, 1.3 + t * 0.01, '#8a5a3a');
      hull(t);
      dune(0.8, 0.04, 0.009, 4.1, '#a9703f');
      dune(0.9, 0.03, 0.015, 2.2, '#c98b4c');
      // летящий песок
      ctx.strokeStyle = 'rgba(255,230,190,0.25)'; ctx.lineWidth = 1;
      for (let k = 0; k < 24; k++) {
        const x = ((hr(k) * w + t * (30 + hr(k + 5) * 50)) % (w + 40)) - 20, y = h * (0.6 + hr(k + 11) * 0.38);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 8 + hr(k + 3) * 12, y - 1); ctx.stroke();
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    return canvas;
  };
})(globalThis.G = globalThis.G || {});
