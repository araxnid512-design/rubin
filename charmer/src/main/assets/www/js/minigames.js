'use strict';
/* Мини-игры: рыбалка с Искрой, оладьи с Бурёнкой, песня с Чирикой, прятки с Желешкой */
(function () {
  const MG = window.MG = {};
  const OUT = '#21121c', TAU = Math.PI * 2;
  let st = null, cv = null, x = null, raf = 0, last = 0;
  MG.LIST = {
    fish: { girl: 'neko', n: 'Рыбалка с Искрой', hint: 'Жди, пока поплавок дёрнется и появится «!», — тогда жми!' },
    pancake: { girl: 'minotaur', n: 'Оладьи с Бурёнкой', hint: 'Переворачивай оладью, когда она станет золотистой.' },
    song: { girl: 'harpy', n: 'Песня с Чирикой', hint: 'Жми на дорожку, когда нота долетит до линии.' },
    hide: { girl: 'slime', n: 'Прятки с Желешкой', hint: 'Следи за кустом, где спряталась Желешка.' }
  };
  MG.forGirl = id => Object.keys(MG.LIST).find(k => MG.LIST[k].girl === id);
  MG.open = () => !!st;

  MG.start = function (kind, done) {
    const root = document.getElementById('mg'); root.classList.remove('hide');
    cv = document.getElementById('mg-cv'); x = cv.getContext('2d');
    const r = cv.getBoundingClientRect(), k = Math.min(2, devicePixelRatio || 1);
    cv.width = r.width * k; cv.height = r.height * k;
    document.getElementById('mg-t').textContent = MG.LIST[kind].n;
    document.getElementById('mg-h').textContent = MG.LIST[kind].hint;
    st = { kind, done, t: 0, score: 0, max: 1, over: false, w: cv.width, h: cv.height, k, msg: '', msgT: 0 };
    INIT[kind](st); last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
    U.music && U.music('date');
  };
  function finish() {
    if (!st || st.over) return; st.over = true;
    const res = { score: st.score, max: st.max, kind: st.kind };
    setTimeout(() => { document.getElementById('mg').classList.add('hide'); cancelAnimationFrame(raf); const d = st.done; st = null; if (d) d(res); }, 1300);
  }
  document.getElementById('mg-x').onclick = () => { if (st) { st.score = Math.min(st.score, st.score); finish(); } };
  document.getElementById('mg-cv').addEventListener('pointerdown', e => {
    if (!st || st.over) return; U.audioInit();
    const r = cv.getBoundingClientRect(); TAP[st.kind](st, (e.clientX - r.left) * st.k, (e.clientY - r.top) * st.k);
  });
  function loop(now) {
    if (!st) return; raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000); last = now; st.t += dt; if (st.msgT > 0) st.msgT -= dt;
    if (!st.over) UPD[st.kind](st, dt);
    DRAW[st.kind](st, x, st.w, st.h);
    // счёт и сообщения
    x.font = '900 ' + (st.h * 0.06 | 0) + 'px sans-serif'; x.textAlign = 'right'; x.fillStyle = OUT; x.fillText('★ ' + st.score + ' / ' + st.max, st.w - 16, st.h * 0.08);
    if (st.msgT > 0 || st.over) { x.textAlign = 'center'; x.font = 'italic 900 ' + (st.h * 0.09 | 0) + 'px sans-serif'; x.lineWidth = 8; x.strokeStyle = OUT; const m = st.over ? (st.score >= st.max * 0.7 ? 'Отлично!' : st.score > 0 ? 'Неплохо!' : 'Ой…') : st.msg; x.strokeText(m, st.w / 2, st.h * 0.3); x.fillStyle = '#ffd04a'; x.fillText(m, st.w / 2, st.h * 0.3); }
  }
  const say = (s, m) => { s.msg = m; s.msgT = 0.9; };
  const girl = (s, id, px, py, sc, expr) => { x.save(); x.translate(px, py); x.scale(sc, sc); ART.girl(x, id, { t: s.t, expr: expr || 'happy', chibi: true }); x.restore(); };
  const bg = (c1, c2) => { const g = x.createLinearGradient(0, 0, 0, st.h); g.addColorStop(0, c1); g.addColorStop(1, c2); x.fillStyle = g; x.fillRect(0, 0, st.w, st.h); };

  /* ---------- Рыбалка ---------- */
  const INIT = {}, UPD = {}, DRAW = {}, TAP = {};
  INIT.fish = s => { s.max = 5; s.round = 0; s.phase = 'wait'; s.wait = 1.5 + Math.random() * 2.5; s.bite = 0; s.expr = 'normal'; };
  UPD.fish = (s, dt) => {
    if (s.phase === 'wait') { if ((s.wait -= dt) <= 0) { s.phase = 'bite'; s.bite = 0.75 - s.round * 0.06; U.sfx('pop'); } }
    else if (s.phase === 'bite') { if ((s.bite -= dt) <= 0) { s.phase = 'miss'; s.wait = 1; say(s, 'Сорвалась!'); s.expr = 'hurt'; } }
    else if (s.phase === 'miss' || s.phase === 'got') { if ((s.wait -= dt) <= 0) { s.round++; if (s.round >= s.max) return finish(); s.phase = 'wait'; s.wait = 1.2 + Math.random() * 3; s.expr = 'normal'; } }
  };
  TAP.fish = s => {
    if (s.phase === 'bite') { s.score++; s.phase = 'got'; s.wait = 1; say(s, 'Поймал!'); s.expr = 'happy'; U.sfx('caught'); }
    else if (s.phase === 'wait') { s.phase = 'miss'; s.wait = 1; say(s, 'Рано! Спугнул.'); s.expr = 'angry'; U.sfx('deny'); }
  };
  DRAW.fish = (s, x, w, h) => {
    bg('#ffc89a', '#ff9ab0'); x.fillStyle = '#3a8ad8'; x.fillRect(0, h * 0.55, w, h); x.strokeStyle = 'rgba(255,255,255,.5)'; x.lineWidth = 3;
    for (let i = 0; i < 8; i++) { const px = (i * w / 7 + s.t * 30) % w; x.beginPath(); x.moveTo(px, h * 0.65 + (i % 3) * 30); x.lineTo(px + 40, h * 0.65 + (i % 3) * 30); x.stroke(); }
    x.fillStyle = '#8a5a32'; x.fillRect(0, h * 0.5, w * 0.35, h * 0.08); x.strokeStyle = OUT; x.strokeRect(0, h * 0.5, w * 0.35, h * 0.08);
    girl(s, 'neko', w * 0.18, h * 0.52, h / 360, s.expr);
    const bx = w * 0.62, by = h * 0.62 + (s.phase === 'bite' ? Math.sin(s.t * 40) * 8 + 10 : Math.sin(s.t * 2) * 3);
    x.strokeStyle = '#fff'; x.lineWidth = 2; x.beginPath(); x.moveTo(w * 0.27, h * 0.25); x.quadraticCurveTo(w * 0.5, h * 0.2, bx, by - 10); x.stroke();
    x.beginPath(); x.arc(bx, by, h * 0.025, 0, TAU); x.fillStyle = '#ff4f4f'; x.fill(); x.lineWidth = 3; x.strokeStyle = OUT; x.stroke();
    if (s.phase === 'bite') { x.font = '900 ' + (h * 0.14 | 0) + 'px sans-serif'; x.textAlign = 'center'; x.fillStyle = '#ffd04a'; x.lineWidth = 8; x.strokeText('!', bx, by - h * 0.06); x.fillText('!', bx, by - h * 0.06); }
  };

  /* ---------- Оладьи ---------- */
  INIT.pancake = s => { s.max = 6; s.n = 0; s.c = 0; s.spd = 0.32; s.fl = 0; s.res = []; };
  UPD.pancake = (s, dt) => { if (s.fl > 0) { s.fl -= dt; if (s.fl <= 0) next(s); return; } s.c += dt * s.spd; if (s.c > 1.05) { say(s, 'Сгорела!'); s.res.push(0); s.fl = 0.8; U.sfx('deny'); } };
  function next(s) { s.n++; if (s.n >= s.max) return finish(); s.c = 0; s.spd = 0.32 + s.n * 0.06; }
  TAP.pancake = s => { if (s.fl > 0) return; const ok = s.c >= 0.58 && s.c <= 0.82; if (ok) { s.score++; say(s, s.c > 0.66 && s.c < 0.74 ? 'Идеально!' : 'Золотистая!'); U.sfx('levelup'); } else { say(s, s.c < 0.58 ? 'Сыровата!' : 'Подгорела!'); U.sfx('bump'); } s.res.push(ok ? 1 : 0); s.fl = 0.8; };
  DRAW.pancake = (s, x, w, h) => {
    bg('#ffe8c8', '#e8b888'); x.fillStyle = '#6a4028'; x.fillRect(0, h * 0.72, w, h);
    girl(s, 'minotaur', w * 0.18, h * 0.86, h / 330, s.fl > 0 ? (s.res[s.res.length - 1] ? 'happy' : 'hurt') : 'normal');
    const cx = w * 0.58, cy = h * 0.62; x.fillStyle = '#3a3a44'; x.beginPath(); x.ellipse(cx, cy, w * 0.2, h * 0.12, 0, 0, TAU); x.fill(); x.lineWidth = 4; x.strokeStyle = OUT; x.stroke(); x.fillRect(cx + w * 0.19, cy - 6, w * 0.15, 12);
    const c = Math.min(1, s.c), col = c < 0.58 ? A0('#fff2c8', '#f0c870', c / 0.58) : c < 0.82 ? A0('#f0c870', '#d89038', (c - 0.58) / 0.24) : A0('#d89038', '#5a3018', (c - 0.82) / 0.2);
    const flip = s.fl > 0 ? Math.sin((0.8 - s.fl) / 0.8 * Math.PI) : 0;
    x.fillStyle = col; x.beginPath(); x.ellipse(cx, cy - flip * h * 0.25, w * 0.13, h * 0.07 * (1 - flip * 0.8), 0, 0, TAU); x.fill(); x.lineWidth = 3; x.stroke();
    // шкала
    const bx = w * 0.4, bw = w * 0.4, by = h * 0.16; x.fillStyle = '#fff'; x.fillRect(bx, by, bw, 16); x.fillStyle = '#ffd04a'; x.fillRect(bx + bw * 0.58, by, bw * 0.24, 16); x.strokeRect(bx, by, bw, 16); x.fillStyle = OUT; x.fillRect(bx + bw * Math.min(1, c) - 2, by - 6, 4, 28);
    for (let i = 0; i < s.max; i++) { x.fillStyle = i < s.res.length ? (s.res[i] ? '#ffd04a' : '#8a5a4a') : 'rgba(255,255,255,.5)'; x.beginPath(); x.ellipse(w * 0.42 + i * w * 0.06, h * 0.9, w * 0.022, h * 0.02, 0, 0, TAU); x.fill(); x.stroke(); }
  };
  function A0(a, b, k) { k = Math.max(0, Math.min(1, k)); return ART.mix(a, b, k); }

  /* ---------- Песня ---------- */
  INIT.song = s => { s.notes = []; const r = U.rng(7); let tt = 1.2; for (let i = 0; i < 22; i++) { s.notes.push({ lane: (r() * 3) | 0, t: tt, hit: 0 }); tt += 0.45 + r() * 0.45; } s.max = 22; s.end = tt + 1.5; s.spd = 0.55; };
  UPD.song = (s, dt) => { for (const n of s.notes) if (!n.hit && s.t - n.t > 0.22) { n.hit = -1; say(s, 'Мимо!'); } if (s.t > s.end) finish(); };
  TAP.song = (s, px) => {
    const lane = Math.max(0, Math.min(2, ((px - s.w * 0.35) / (s.w * 0.6) * 3) | 0));
    let best = null; for (const n of s.notes) if (!n.hit && n.lane === lane && Math.abs(s.t - n.t) < 0.22) { best = n; break; }
    if (best) { best.hit = 1; s.score++; say(s, Math.abs(s.t - best.t) < 0.08 ? 'Чик-чирик!' : 'Хорошо!'); U.sfx('select'); } else U.sfx('bump');
  };
  DRAW.song = (s, x, w, h) => {
    bg('#5a3a8a', '#ff9ab0'); girl(s, 'harpy', w * 0.16, h * 0.9, h / 330, 'happy');
    const L0 = w * 0.35, LW = w * 0.2, hy = h * 0.82;
    for (let i = 0; i < 3; i++) { x.fillStyle = 'rgba(255,255,255,' + (0.12 + i * 0.04) + ')'; x.fillRect(L0 + i * LW + 4, 0, LW - 8, h); }
    x.fillStyle = '#ffd04a'; x.fillRect(L0, hy - 3, LW * 3, 6);
    for (const n of s.notes) { if (n.hit === 1) continue; const y = hy - (n.t - s.t) * h * s.spd * 1.6; if (y < -30 || y > h + 30) continue; x.save(); x.globalAlpha = n.hit === -1 ? 0.3 : 1; ART.heart(x, L0 + n.lane * LW + LW / 2, y, h * 0.035, ['#ff4f7b', '#5fd6b0', '#ffd04a'][n.lane]); x.restore(); }
  };

  /* ---------- Прятки ---------- */
  INIT.hide = s => { s.max = 4; s.round = 0; newRound(s); };
  function newRound(s) { s.pos = [0, 1, 2, 3, 4]; s.slime = (Math.random() * 5) | 0; s.phase = 'show'; s.pt = 1.2; s.swaps = 3 + s.round * 2; s.sw = null; s.swT = 0; s.pick = -1; }
  UPD.hide = (s, dt) => {
    if (s.phase === 'show') { if ((s.pt -= dt) <= 0) s.phase = 'shuffle'; }
    else if (s.phase === 'shuffle') {
      const dur = Math.max(0.22, 0.5 - s.round * 0.08);
      if (!s.sw) { if (s.swaps-- <= 0) { s.phase = 'pick'; return; } let a = (Math.random() * 5) | 0, b = (Math.random() * 4) | 0; if (b >= a) b++; s.sw = [a, b]; s.swT = 0; }
      s.swT += dt / dur; if (s.swT >= 1) { const [a, b] = s.sw, i = s.pos.indexOf(a), j = s.pos.indexOf(b); s.pos[i] = b; s.pos[j] = a; s.sw = null; }
    } else if (s.phase === 'result') { if ((s.pt -= dt) <= 0) { s.round++; if (s.round >= s.max) return finish(); newRound(s); } }
  };
  TAP.hide = (s, px) => {
    if (s.phase !== 'pick') return; const slot = Math.max(0, Math.min(4, ((px - s.w * 0.1) / (s.w * 0.16)) | 0)), bush = s.pos[slot];
    s.pick = bush; s.phase = 'result'; s.pt = 1.2; if (bush === s.slime) { s.score++; say(s, 'Нашёл!'); U.sfx('caught'); } else { say(s, 'Не тут!'); U.sfx('deny'); }
  };
  DRAW.hide = (s, x, w, h) => {
    bg('#8ad8ff', '#7ccc5a'); x.fillStyle = '#6cbc4c'; x.fillRect(0, h * 0.55, w, h);
    const X = slot => w * 0.18 + slot * w * 0.16, by = h * 0.72;
    for (let b = 0; b < 5; b++) {
      let slot = s.pos.indexOf(b), lift = 0;
      if (s.sw && (b === s.sw[0] || b === s.sw[1])) { const o = b === s.sw[0] ? s.sw[1] : s.sw[0], from = s.pos.indexOf(b), to = s.pos.indexOf(o), k = s.swT; slot = from + (to - from) * k; lift = Math.sin(k * Math.PI) * h * 0.08 * (b === s.sw[0] ? 1 : -1); }
      const px = X(slot), show = (s.phase === 'show' || (s.phase === 'result' && (b === s.pick || b === s.slime))) && b === s.slime;
      if (show) girl(s, 'slime', px, by - h * 0.06, h / 420, b === s.pick ? 'happy' : 'smug');
      x.fillStyle = '#3e8a30'; for (let i = 0; i < 5; i++) { x.beginPath(); x.arc(px - w * 0.045 + i * w * 0.0225, by - lift - (i % 2) * h * 0.03, h * 0.07, 0, TAU); x.fill(); x.lineWidth = 3; x.strokeStyle = OUT; x.stroke(); }
      x.fillStyle = '#4cb03a'; for (let i = 0; i < 4; i++) { x.beginPath(); x.arc(px - w * 0.035 + i * w * 0.023, by - lift - h * 0.02, h * 0.055, 0, TAU); x.fill(); }
    }
    if (s.phase === 'pick') { x.font = '900 ' + (h * 0.06 | 0) + 'px sans-serif'; x.textAlign = 'center'; x.fillStyle = OUT; x.fillText('Где Желешка?', w / 2, h * 0.2); }
  };
})();
