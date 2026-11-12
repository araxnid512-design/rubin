'use strict';
/* Сюжетные ролики: прибытие через Портал и финалы */
(function (DW) {
  const U = DW.U, ART = DW.ART;
  const Cine = {};
  let cur = null;

  Cine.active = function () { return !!cur; };
  Cine.skip = function () { if (cur) cur.finish(); };

  Cine.play = function (name, opt) {
    if (DW.settings.cine === false || !SCENES[name]) return Promise.resolve();
    opt = opt || {};
    return new Promise(function (res) {
      const root = U.el('div', { class: 'cine' });
      const cv = U.el('canvas', { class: 'cine-cv' });
      const cap = U.el('div', { class: 'cine-cap' });
      const skip = U.el('button', { class: 'cine-skip', text: 'Пропустить ›' });
      const hint = U.el('div', { class: 'cine-hint', text: 'нажмите, чтобы продолжить' });
      root.appendChild(cv); root.appendChild(cap); root.appendChild(hint); root.appendChild(skip);
      document.getElementById('app').appendChild(root);
      const g = cv.getContext('2d');
      const shots = SCENES[name](opt);
      const S = { i: 0, t0: performance.now(), done: false };
      function setCap() {
        const sh = shots[S.i];
        cap.classList.remove('show');
        cap.innerHTML = sh.cap || '';
        void cap.offsetWidth;
        if (sh.cap) cap.classList.add('show');
      }
      function next() {
        if (S.done) return;
        if (S.i < shots.length - 1) { S.i++; S.t0 = performance.now(); setCap(); if (shots[S.i].sfx) DW.SFX.play(shots[S.i].sfx); }
        else finish();
      }
      function finish() {
        if (S.done) return;
        S.done = true;
        root.classList.add('out');
        setTimeout(function () { root.remove(); cur = null; res(); }, 450);
      }
      cur = { finish: finish };
      skip.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
      skip.addEventListener('click', function (e) { e.stopPropagation(); finish(); });
      root.addEventListener('pointerdown', function () {
        if (performance.now() - S.t0 > 600) next();
      });
      setCap();
      if (shots[0].sfx) DW.SFX.play(shots[0].sfx);
      function frame() {
        if (S.done && !root.isConnected) return;
        const w = root.clientWidth || 800, h = root.clientHeight || 400;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
        const now = performance.now();
        const sh = shots[S.i];
        const el = now - S.t0, k = U.clamp(el / sh.dur, 0, 1);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.save();
        sh.draw(g, w, h, k, el, now);
        g.restore();
        // подложка под субтитры
        if (sh.cap) { const cg = g.createLinearGradient(0, h * 0.66, 0, h * 0.91); cg.addColorStop(0, 'rgba(0,0,0,0)'); cg.addColorStop(1, 'rgba(0,0,0,0.6)'); g.fillStyle = cg; g.fillRect(0, h * 0.66, w, h * 0.25); }
        // затемнение на стыках кадров
        const fin = U.clamp(el / 450, 0, 1), fout = U.clamp((sh.dur - el) / 450, 0, 1);
        const fa = 1 - Math.min(fin, S.i === shots.length - 1 ? fout : 1);
        if (fa > 0) { g.fillStyle = 'rgba(0,0,0,' + fa + ')'; g.fillRect(0, 0, w, h); }
        // широкоэкранные полосы
        const bar = h * 0.09;
        g.fillStyle = '#000'; g.fillRect(0, 0, w, bar); g.fillRect(0, h - bar, w, bar);
        if (!S.done && el >= sh.dur) next();
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
  };

  /* ---------- Общие декорации ---------- */
  const SKY = {
    dusk: ['#1a1216', '#4a2a26', '#9a5a3a', '#d08a4a'],
    dawn: ['#20283a', '#5a5060', '#c08a6a', '#f0c080'],
    night: ['#06070e', '#121628', '#2a2a3a', '#4a3a3a'],
    grey: ['#1a1a1c', '#3a3634', '#6a605a', '#8a7a6a']
  };
  function wasteland(g, w, h, t, mood, opt) {
    opt = opt || {};
    const c = SKY[mood] || SKY.dusk;
    const hor = h * 0.62;
    let gr = g.createLinearGradient(0, 0, 0, hor);
    gr.addColorStop(0, c[0]); gr.addColorStop(0.45, c[1]); gr.addColorStop(0.85, c[2]); gr.addColorStop(1, c[3]);
    g.fillStyle = gr; g.fillRect(0, 0, w, hor + 2);
    // светило
    const sx = w * (opt.sunX || 0.72), sy = hor - h * 0.1;
    gr = g.createRadialGradient(sx, sy, 2, sx, sy, h * 0.4);
    gr.addColorStop(0, mood === 'night' ? 'rgba(200,210,255,0.35)' : 'rgba(255,220,160,0.55)'); gr.addColorStop(1, 'rgba(255,200,140,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, hor);
    g.fillStyle = mood === 'night' ? '#d8dcf0' : 'rgba(255,236,200,0.9)';
    g.beginPath(); g.arc(sx, sy, h * 0.045, 0, 7); g.fill();
    if (mood === 'night') for (let i = 0; i < 60; i++) { const r = U.srng(i * 7 + 3); g.fillStyle = 'rgba(230,235,255,' + (0.3 + r() * 0.6) * (0.7 + 0.3 * Math.sin(t / 500 + i)) + ')'; g.fillRect(r() * w, r() * hor * 0.8, 1.6, 1.6); }
    // дальние горы и руины
    const layer = function (seed, y0, amp, col, ruins) {
      const r = U.srng(seed);
      g.fillStyle = col;
      g.beginPath(); g.moveTo(0, hor + 4);
      let x = 0;
      while (x <= w + 40) {
        const y = y0 - r() * amp;
        if (ruins && r() < 0.3) {
          const bw = 14 + r() * 30, bh = amp * (0.8 + r() * 1.6);
          g.lineTo(x, y0); g.lineTo(x, y0 - bh); g.lineTo(x + bw * 0.4, y0 - bh - r() * 8); g.lineTo(x + bw * 0.7, y0 - bh + 6); g.lineTo(x + bw, y0 - bh * 0.7); g.lineTo(x + bw, y0);
          x += bw + 6;
        } else { g.lineTo(x, y); x += 18 + r() * 30; }
      }
      g.lineTo(w + 40, hor + 4); g.closePath(); g.fill();
    };
    layer(11, hor - h * 0.02, h * 0.08, 'rgba(40,28,26,0.55)', false);
    layer(23, hor, h * 0.05, 'rgba(26,20,18,0.8)', true);
    // земля
    gr = g.createLinearGradient(0, hor, 0, h);
    gr.addColorStop(0, mood === 'night' ? '#1a1820' : '#3a2e26'); gr.addColorStop(1, mood === 'night' ? '#08080c' : '#140f0c');
    g.fillStyle = gr; g.fillRect(0, hor, w, h - hor);
    const r = U.srng(77);
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1.2;
    for (let i = 0; i < 18; i++) {
      let x = r() * w, y = hor + 10 + r() * (h - hor);
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += (r() - 0.3) * 40; y += (r() - 0.5) * 8; g.lineTo(x, y); }
      g.stroke();
    }
    for (let i = 0; i < 14; i++) {
      const x = r() * w, y = hor + 14 + r() * (h - hor - 20), s = 3 + r() * 8;
      g.fillStyle = 'rgba(20,14,10,0.6)'; g.beginPath(); g.ellipse(x, y, s * 1.4, s * 0.5, 0, 0, 7); g.fill();
      g.fillStyle = mood === 'night' ? '#2a2830' : '#5a4a3e'; g.beginPath(); g.ellipse(x, y - s * 0.3, s, s * 0.6, 0, Math.PI, 0); g.fill();
    }
    // пыль
    for (let i = 0; i < 50; i++) {
      const q = U.srng(i * 13 + 5);
      const x = ((q() * w + t / 1000 * (20 + q() * 40)) % (w + 20)) - 10, y = hor * 0.5 + q() * (h * 0.5) + Math.sin(t / 1300 + i) * 6;
      g.fillStyle = 'rgba(230,200,160,' + (0.08 + q() * 0.12) + ')'; g.fillRect(x, y, 1.8, 1.8);
    }
    return hor;
  }
  function portal(g, x, y, r, open, t) {
    if (open <= 0) return;
    const rx = r * 0.62 * open, ry = r * open;
    let gr = g.createRadialGradient(x, y, 2, x, y, r * 2.2 * open);
    gr.addColorStop(0, 'rgba(190,250,255,' + (0.5 * open) + ')'); gr.addColorStop(1, 'rgba(95,212,230,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r * 2.2 * open, 0, 7); g.fill();
    gr = g.createRadialGradient(x, y, 1, x, y, ry);
    gr.addColorStop(0, 'rgba(240,255,255,0.95)'); gr.addColorStop(0.6, 'rgba(120,220,240,0.7)'); gr.addColorStop(1, 'rgba(40,120,150,0.5)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fill();
    g.strokeStyle = 'rgba(230,255,255,0.7)'; g.lineWidth = 1.5;
    for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(x, y, rx * (0.2 + k * 0.16), ry * (0.2 + k * 0.16), 0, t / 400 * (1 + k * 0.3) + k, t / 400 * (1 + k * 0.3) + k + 2.2); g.stroke(); }
    g.strokeStyle = '#2a3238'; g.lineWidth = Math.max(3, r * 0.1); g.beginPath(); g.ellipse(x, y, rx * 1.08, ry * 1.06, 0, 0, 7); g.stroke();
    g.strokeStyle = 'rgba(170,245,255,0.9)'; g.lineWidth = 2; g.beginPath(); g.ellipse(x, y, rx * 1.08, ry * 1.06, 0, 0, 7); g.stroke();
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.fillStyle = '#e8a83e'; g.beginPath(); g.arc(x + Math.cos(a) * rx * 1.08, y + Math.sin(a) * ry * 1.06, Math.max(1.5, r * 0.035), 0, 7); g.fill(); }
    for (let i = 0; i < 16; i++) {
      const k = ((t / 1600 + i / 16) % 1), a = i * 2.4;
      g.fillStyle = 'rgba(170,245,255,' + (k * 0.8 * open) + ')';
      g.fillRect(x + Math.cos(a) * r * 2 * (1 - k), y + Math.sin(a) * r * 1.6 * (1 - k), 2, 2);
    }
  }
  const anon = {};
  function lookFor(seed) { if (!anon[seed]) anon[seed] = ART.makeLook(seed * 131 + 7, { glasses: false }); return anon[seed]; }
  function person(g, s, x, y, sc, t, o) {
    o = o || {};
    g.save(); g.translate(x, y);
    if (o.rot) g.rotate(o.rot);
    ART.human(g, {
      look: s ? s.look : lookFor(o.seed || 0), body: o.body || '#c8691c', pants: o.pants, armor: s && s.armor !== 'robe' ? s.armor : null,
      weapon: o.weapon === undefined ? (s ? s.weapon : 'ppsh') : o.weapon, dir: o.dir || 1, aim: o.aim === undefined ? 0.3 : o.aim,
      walk: o.walk === undefined ? null : o.walk, scale: sc, seed: o.seed || 0, cig: o.cig, pose: o.pose,
      helmet: s && (s.armor === 'heavy' || s.armor === 'exo'), rank: s && s.xp !== undefined && DW.G ? DW.G.rank(s) : 0
    }, t);
    g.restore();
  }
  function crate(g, x, y, s) {
    g.save(); g.translate(x, y);
    ART.box(g, -0.5, -0.5, 0.5, 0.5, 0, 16 * s, '#b08850', '#8a6539', '#6a4c2a', { hw: 16 * s, hh: 8 * s });
    g.restore();
  }
  function dust(g, x, y, q, s) {
    if (q <= 0 || q >= 1) return;
    for (let i = 0; i < 7; i++) {
      const a = Math.PI + i / 6 * Math.PI;
      g.fillStyle = 'rgba(190,165,130,' + (0.5 * (1 - q)) + ')';
      g.beginPath(); g.arc(x + Math.cos(a) * q * 40 * s, y + Math.sin(a) * q * 10 * s, (4 + q * 10) * s, 0, 7); g.fill();
    }
  }
  function title(g, w, h, k, big, small, col) {
    g.fillStyle = '#060504'; g.fillRect(0, 0, w, h);
    const a = Math.min(1, k * 3) * Math.min(1, (1 - k) * 4 + 0.2);
    g.save(); g.globalAlpha = a;
    g.textAlign = 'center';
    g.font = '900 ' + Math.round(h * 0.13) + 'px sans-serif';
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillText(big, w / 2 + 3, h * 0.5 + 3);
    const gr = g.createLinearGradient(0, h * 0.38, 0, h * 0.52);
    gr.addColorStop(0, col || '#f0c070'); gr.addColorStop(1, '#a8682a');
    g.fillStyle = gr; g.fillText(big, w / 2, h * 0.5);
    g.font = '600 ' + Math.round(h * 0.05) + 'px sans-serif'; g.fillStyle = '#c8b898';
    g.fillText(small, w / 2, h * 0.62);
    g.restore();
  }
  const SHAKE = { t: 0 };
  function shake(g, now) {
    const a = Math.max(0, 1 - (now - SHAKE.t) / 260);
    if (a > 0) g.translate((Math.random() - 0.5) * 8 * a, (Math.random() - 0.5) * 6 * a);
  }
  function squadOf(opt) {
    const list = (opt.squad || []).slice(0, 6);
    while (list.length < 6) list.push(null);
    return list;
  }

  /* ---------- Сцены ---------- */
  const SCENES = {};
  SCENES.intro = function (opt) {
    const sq = squadOf(opt);
    const kurt = sq[0], marl = sq[1];
    const fall = [];
    let lastLand = -1;
    function arrival(g, w, h, k, el, now, after) {
      shake(g, now);
      const hor = wasteland(g, w, h, now, 'dusk');
      const px = w * 0.36, py = hor - h * 0.16, pr = h * 0.17;
      const sc = h / 172;
      const open = after ? Math.max(0, 1 - k * 3) : U.clamp(k / 0.18, 0, 1);
      if (after && k < 0.34) { g.fillStyle = 'rgba(200,250,255,' + (0.4 * (1 - k * 3)) + ')'; g.fillRect(0, 0, w, h); }
      portal(g, px, py, pr, open, now);
      const order = [2, 4, 0, 3, 5, 1];
      order.forEach(function (idx, n) {
        const gx = w * (0.18 + idx * 0.105) + (idx % 2) * 10, gy = hor + h * (0.12 + (idx % 2) * 0.045);
        const k0 = 0.2 + n * 0.08, q = after ? 1 : U.clamp((k - k0) / 0.12, 0, 1);
        if (q <= 0) return;
        if (q < 1) {
          const x = U.lerp(px, gx, q), y = U.lerp(py, gy, q) - Math.sin(Math.PI * q) * h * 0.12;
          person(g, sq[idx], x, y, sc, now, { rot: (1 - q) * 5 * (gx > px ? 1 : -1), seed: idx, pose: { crouch: 0.6 }, aim: 0.6 });
        } else {
          if (!after && fall.indexOf(idx) < 0) { fall.push(idx); SHAKE.t = now; if (now - lastLand > 120) { DW.SFX.play('step'); lastLand = now; } }
          const land = after ? 1 : U.clamp((k - k0 - 0.12) / 0.1, 0, 1);
          dust(g, gx, gy, after ? 1 : land, sc * 0.5);
          const cig = after === 'marl' && idx === 1;
          person(g, sq[idx], gx, gy, sc, now, { seed: idx, pose: { crouch: 1 - land }, dir: idx < 3 ? 1 : -1, aim: idx === 0 ? 0 : 0.35, cig: cig || (after && idx === 1 && el > 900) });
        }
      });
      [[0.71, 0.27], [0.77, 0.47]].forEach(function (c, n) {
        const q = after ? 1 : U.clamp((k - (0.72 + n * 0.06)) / 0.08, 0, 1);
        if (q <= 0) return;
        const x = U.lerp(px, w * c[1] + w * 0.25, q), y = U.lerp(py, hor + h * 0.15, q) - Math.sin(Math.PI * q) * h * 0.08;
        if (q >= 1 && !after && fall.indexOf('c' + n) < 0) { fall.push('c' + n); SHAKE.t = now; DW.SFX.play('hit'); }
        crate(g, x, y, sc * 0.6);
      });
      // говорящий подсвечен
      const who = after === 'kurt' ? 0 : (after === 'marl' ? 1 : -1);
      if (who >= 0) {
        const gx = w * (0.18 + who * 0.105) + (who % 2) * 10, gy = hor + h * (0.12 + (who % 2) * 0.045);
        const gr = g.createRadialGradient(gx, gy - 20 * sc, 4, gx, gy - 20 * sc, 46 * sc);
        gr.addColorStop(0, 'rgba(255,220,160,0.18)'); gr.addColorStop(1, 'rgba(255,220,160,0)');
        g.fillStyle = gr; g.fillRect(gx - 60 * sc, gy - 80 * sc, 120 * sc, 100 * sc);
      }
    }
    return [
      {
        dur: 6000,
        cap: 'Институт открыл проход в мёртвый мир, переживший войну. Теперь это <b>тюрьма без решёток</b>: сюда отправляют воров, бандитов и убийц.',
        draw: function (g, w, h, k, el, now) {
          const gr = g.createLinearGradient(0, 0, 0, h);
          gr.addColorStop(0, '#1a1918'); gr.addColorStop(1, '#0a0909');
          g.fillStyle = gr; g.fillRect(0, 0, w, h);
          g.fillStyle = 'rgba(255,255,255,0.03)';
          for (let y = 0; y < h; y += 26) g.fillRect(0, y, w, 1);
          const lx = w * (0.5 + Math.sin(now / 1400) * 0.4), ly = h * 0.45;
          const lg = g.createRadialGradient(lx, ly, 4, lx, ly, h * 0.6);
          lg.addColorStop(0, 'rgba(255,240,200,0.35)'); lg.addColorStop(1, 'rgba(255,240,200,0)');
          g.fillStyle = lg; g.fillRect(0, 0, w, h);
          const sc = h / 140;
          sq.forEach(function (s, i) { person(g, s, w * (0.17 + i * 0.13), h * 0.86, sc, now, { seed: i, dir: 1, aim: 0.65, weapon: null, cig: i === 1 && k > 0.4 }); });
          for (let x = w * 0.03; x < w; x += w * 0.06) {
            const bg = g.createLinearGradient(x - 5, 0, x + 5, 0);
            bg.addColorStop(0, '#2a2a2c'); bg.addColorStop(0.4, '#6a6a6e'); bg.addColorStop(1, '#1a1a1c');
            g.fillStyle = bg; g.fillRect(x - 5, 0, 10, h);
          }
          g.fillStyle = '#2a2a2c'; g.fillRect(0, h * 0.2, w, 10); g.fillRect(0, h * 0.8, w, 10);
          g.fillStyle = 'rgba(0,0,0,' + (0.5 - k * 0.3) + ')'; g.fillRect(0, 0, w, h);
        }
      },
      {
        dur: 7500, sfx: 'portal',
        cap: 'Портал работает только в одну сторону. Шестерых вытолкнули со старыми ППШ и сухпаем. Чтобы протянуть ещё день, нужно нести к Порталу <b class="gem">ценности</b>.',
        draw: function (g, w, h, k, el, now) { arrival(g, w, h, k, el, now, false); }
      },
      {
        dur: 5200,
        cap: '<b class="acc">' + (kurt ? kurt.name : 'Крут') + ':</b> Обратной дороги нет. Держимся вместе — выживем.',
        draw: function (g, w, h, k, el, now) { g.translate(w / 2, h / 2); g.scale(1 + k * 0.06, 1 + k * 0.06); g.translate(-w / 2, -h / 2); arrival(g, w, h, k, el, now, 'kurt'); }
      },
      {
        dur: 5200,
        cap: '<b class="acc">' + (marl ? marl.name : 'Мальборо') + ':</b> Сигарет у меня на неделю. Значит, неделю точно протянем.',
        draw: function (g, w, h, k, el, now) { g.translate(w / 2, h / 2); g.scale(1.06 + k * 0.05, 1.06 + k * 0.05); g.translate(-w / 2, -h / 2); arrival(g, w, h, 1, el, now, 'marl'); }
      },
      {
        dur: 4200, sfx: 'growl',
        cap: 'А мутанты уже почуяли живых…',
        draw: function (g, w, h, k) { title(g, w, h, k, 'МЁРТВЫЙ МИР', 'ПЛАЦДАРМ'); }
      }
    ];
  };

  function ending(kind, opt) {
    const sq = (opt.squad || []).slice(0, 6);
    const mem = (opt.memorial || []).slice(-6);
    if (kind === 'lose') {
      return [
        {
          dur: 7000,
          cap: 'Последний боец отряда погиб. Портал молчит.',
          draw: function (g, w, h, k, el, now) {
            const hor = wasteland(g, w, h, now, 'grey', { sunX: 0.2 });
            const sc = h / 160;
            const n = Math.max(3, mem.length);
            for (let i = 0; i < n; i++) {
              const x = w * (0.2 + i * 0.6 / n), y = hor + h * (0.07 + (i % 2) * 0.05);
              const ws = sc * 0.7, tilt = 0.08 * (i % 2 ? 1 : -1);
              g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(x, y, 20 * sc, 5 * sc, 0, 0, 7); g.fill();
              g.fillStyle = '#4a3c30'; g.beginPath(); g.ellipse(x, y - 1 * sc, 16 * sc, 4.5 * sc, 0, Math.PI, 0); g.fill();
              g.save(); g.translate(x, y - 22 * ws); g.rotate(Math.PI / 2 + tilt);
              ART.weapon(g, 'ppsh', ws); g.restore();
              const hx = x - Math.sin(tilt) * 34 * ws, hy = y - 34 * ws;
              g.fillStyle = '#4a5258'; g.beginPath(); g.ellipse(hx, hy, 6.5 * sc, 4 * sc, 0, Math.PI, 0); g.fill();
              g.fillStyle = '#3a4248'; g.fillRect(hx - 7 * sc, hy - 0.5, 14 * sc, 1.5 * sc);
              const m = mem[i];
              if (m) {
                g.font = '600 ' + Math.round(8 * sc) + 'px sans-serif'; g.textAlign = 'center';
                g.fillStyle = 'rgba(230,215,190,' + U.clamp(k * 3 - i * 0.2, 0, 0.85) + ')'; g.fillText(m.name, x, y + 11 * sc);
              }
            }
            for (let i = 0; i < 3; i++) {
              const a = now / 2000 + i * 2;
              const cx = w * (0.5 + Math.cos(a) * 0.25), cy = h * (0.22 + Math.sin(a * 1.3) * 0.05);
              const f = Math.sin(now / 120 + i) * 4;
              g.strokeStyle = '#141210'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - 8, cy - f); g.quadraticCurveTo(cx - 3, cy - 3, cx, cy); g.quadraticCurveTo(cx + 3, cy - 3, cx + 8, cy - f); g.stroke();
            }
          }
        },
        {
          dur: 6000, sfx: 'portal',
          cap: 'Институт пришлёт новую партию заключённых. Может, им повезёт больше.',
          draw: function (g, w, h, k, el, now) {
            const hor = wasteland(g, w, h, now, 'night', { sunX: 0.85 });
            const px = w * 0.5, py = hor - h * 0.14;
            portal(g, px, py, h * 0.13, U.clamp(k / 0.2, 0, 1), now);
            const sc = h / 220;
            for (let i = 0; i < 6; i++) {
              const k0 = 0.25 + i * 0.08, q = U.clamp((k - k0) / 0.12, 0, 1);
              if (q <= 0) continue;
              const gx = w * (0.3 + i * 0.08), gy = hor + h * 0.12;
              const x = U.lerp(px, gx, q), y = U.lerp(py, gy, q) - Math.sin(Math.PI * q) * h * 0.08;
              g.save(); g.globalAlpha = 0.85;
              person(g, null, x, y, sc, now, { seed: 50 + i, rot: (1 - q) * 4, body: '#7a4a24', weapon: q >= 1 ? 'ppsh' : null });
              g.restore();
            }
          }
        },
        { dur: 4000, cap: '', draw: function (g, w, h, k) { title(g, w, h, k, 'КОНЕЦ ПУТИ', 'Мёртвый мир не прощает ошибок', '#d0a090'); } }
      ];
    }
    if (kind === 'win_nest') {
      return [
        {
          dur: 7500, sfx: 'explosion',
          cap: 'Матка мертва, Гнездо горит. Мутанты рассеялись по пустоши.',
          draw: function (g, w, h, k, el, now) {
            const hor = wasteland(g, w, h, now, 'night', { sunX: 0.15 });
            const nx = w * 0.72, ny = hor + h * 0.05, nh = h * 0.5;
            let gr = g.createRadialGradient(nx, ny - nh * 0.4, 4, nx, ny - nh * 0.4, nh);
            gr.addColorStop(0, 'rgba(255,140,60,0.5)'); gr.addColorStop(1, 'rgba(255,90,40,0)');
            g.fillStyle = gr; g.fillRect(0, 0, w, h);
            gr = g.createLinearGradient(0, ny - nh, 0, ny); gr.addColorStop(0, '#5a2a46'); gr.addColorStop(1, '#1a0a14');
            g.fillStyle = gr;
            g.beginPath(); g.moveTo(nx - nh * 0.35, ny); g.quadraticCurveTo(nx - nh * 0.2, ny - nh * 0.45, nx - nh * 0.06, ny - nh); g.quadraticCurveTo(nx, ny - nh * 1.08, nx + nh * 0.06, ny - nh); g.quadraticCurveTo(nx + nh * 0.2, ny - nh * 0.45, nx + nh * 0.35, ny); g.closePath(); g.fill();
            for (let i = 0; i < 26; i++) {
              const r = U.srng(i * 31 + 1);
              const fx = nx + (r() - 0.5) * nh * 0.6, fb = ny - r() * nh * 0.8;
              const fh = (20 + r() * 40) * (0.8 + 0.2 * Math.sin(now / 90 + i)) * h / 400;
              g.fillStyle = ['rgba(255,110,30,0.85)', 'rgba(255,190,60,0.8)', 'rgba(255,240,160,0.7)'][i % 3];
              g.beginPath(); g.moveTo(fx - fh * 0.3, fb); g.quadraticCurveTo(fx - fh * 0.2, fb - fh * 0.6, fx + Math.sin(now / 130 + i) * 3, fb - fh); g.quadraticCurveTo(fx + fh * 0.25, fb - fh * 0.5, fx + fh * 0.3, fb); g.closePath(); g.fill();
            }
            for (let i = 0; i < 30; i++) {
              const r = U.srng(i * 17 + 9);
              const q = ((now / 3000) + r()) % 1;
              g.fillStyle = 'rgba(60,50,50,' + (0.4 * (1 - q)) + ')';
              g.beginPath(); g.arc(nx + (r() - 0.5) * nh * 0.5 + q * 40, ny - nh * (0.6 + q * 0.9), 8 + q * 30, 0, 7); g.fill();
            }
            const sc = h / 175;
            sq.forEach(function (s, i) { person(g, s, w * (0.1 + i * 0.075), hor + h * (0.13 + (i % 2) * 0.04), sc, now, { seed: i, dir: 1, aim: i % 2 ? 0.1 : 0.45, cig: DW.G.smoker(s) }); });
          }
        },
        {
          dur: 6000,
          cap: 'Впервые у отряда есть время строить, а не только отстреливаться. Этот мир — ваш.',
          draw: function (g, w, h, k, el, now) {
            const hor = wasteland(g, w, h, now, 'dawn', { sunX: 0.5 });
            const sc = h / 160;
            sq.forEach(function (s, i) { person(g, s, w * (0.2 + i * 0.12), hor + h * (0.13 + (i % 2) * 0.04), sc, now, { seed: i, dir: i < 3 ? 1 : -1, aim: 0.5, cig: DW.G.smoker(s) }); });
          }
        },
        { dur: 4200, cap: '', draw: function (g, w, h, k) { title(g, w, h, k, 'СЕРДЦЕ МИРА', 'Гнездо уничтожено'); } }
      ];
    }
    // win_gems
    return [
      {
        dur: 7500, sfx: 'portal',
        cap: 'Тысяча драгоценностей ушла через Портал. Институт выполнил свою часть сделки.',
        draw: function (g, w, h, k, el, now) {
          const hor = wasteland(g, w, h, now, 'dawn', { sunX: 0.8 });
          const px = w * 0.6, py = hor - h * 0.2;
          const open = U.clamp(k / 0.25, 0, 1);
          for (let i = 0; i < 6; i++) {
            const a = -Math.PI / 2 + (i - 2.5) * 0.25 + Math.sin(now / 900 + i) * 0.03;
            g.fillStyle = 'rgba(200,250,255,' + (0.08 * open) + ')';
            g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a - 0.05) * h, py + Math.sin(a - 0.05) * h); g.lineTo(px + Math.cos(a + 0.05) * h, py + Math.sin(a + 0.05) * h); g.closePath(); g.fill();
          }
          portal(g, px, py, h * 0.24, open, now);
          // ящики вольной
          for (let i = 0; i < 3; i++) {
            const q = U.clamp((k - 0.35 - i * 0.08) / 0.1, 0, 1);
            if (q > 0) crate(g, U.lerp(px, w * (0.66 + i * 0.07), q), U.lerp(py, hor + h * 0.27, q) - Math.sin(Math.PI * q) * h * 0.06, h / 300);
          }
          const sc = h / 175;
          sq.forEach(function (s, i) { person(g, s, w * (0.12 + i * 0.07), hor + h * (0.13 + (i % 2) * 0.04), sc, now, { seed: i, dir: 1, aim: 0.4, cig: DW.G.smoker(s) }); });
        }
      },
      {
        dur: 6500,
        cap: 'Вольная для всей колонии. Из Портала выходят первые поселенцы — теперь это ваш мир. Мёртвый, но ваш.',
        draw: function (g, w, h, k, el, now) {
          const hor = wasteland(g, w, h, now, 'dawn', { sunX: 0.8 });
          const px = w * 0.6, py = hor - h * 0.2;
          portal(g, px, py, h * 0.24, 1, now);
          const sc = h / 175;
          for (let i = 0; i < 5; i++) {
            const q = U.clamp((k - i * 0.12) / 0.5, 0, 1);
            if (q <= 0) continue;
            const x = U.lerp(px, w * (0.45 - i * 0.04), q), y = U.lerp(hor + h * 0.06, hor + h * (0.18 + (i % 2) * 0.05), q);
            g.save(); g.globalAlpha = Math.min(1, q * 3);
            person(g, null, x, y, sc * (0.7 + q * 0.3), now, { seed: 70 + i, dir: -1, body: ['#6a6a5a', '#5a4a3a', '#7a6a4a', '#4a5a5a', '#8a5a4a'][i], weapon: null, aim: 0.6, walk: q < 1 ? now / 110 + i : null });
            g.restore();
          }
          sq.forEach(function (s, i) { person(g, s, w * (0.08 + i * 0.06), hor + h * (0.13 + (i % 2) * 0.04), sc, now, { seed: i, dir: 1, aim: 0.5, cig: DW.G.smoker(s) }); });
        }
      },
      { dur: 4200, cap: '', draw: function (g, w, h, k) { title(g, w, h, k, 'ВОЛЬНАЯ', 'Колония свободна'); } }
    ];
  }
  SCENES.end_win_gems = function (opt) { return ending('win_gems', opt); };
  SCENES.end_win_nest = function (opt) { return ending('win_nest', opt); };
  SCENES.end_lose = function (opt) { return ending('lose', opt); };

  DW.Cine = Cine;
})(window.DW);
