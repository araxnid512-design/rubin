/* Курьер миров — экраны, управление, сохранения, игровой цикл. */
(function () {
  'use strict';
  const K = window.K, E = K.ENGINE, AU = K.AUDIO;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const SAVE = 'kurier.save.v1';
  const load = () => { try { return JSON.parse(localStorage.getItem(SAVE)) || null; } catch (e) { return null; } };
  const store = () => { try { localStorage.setItem(SAVE, JSON.stringify(save)); } catch (e) { /* без сохранений */ } };
  let save = load() || { done: {}, seen: {}, music: true, sfx: true };
  AU.musicOn = save.music !== false;
  AU.sfxOn = save.sfx !== false;

  const cv = $('#cv'), ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  let mode = 'title', sceneWorld = 1, sceneT = 0, cur = null, story = null;

  /* ---------- прогресс ---------- */
  const last = (w) => K.stageCount(K.worldById(w));
  function unlocked(w, s) {
    if (w === 1 && s === 1) return true;
    if (s > 1) return !!save.done[`${w}-${s - 1}`];
    return !!save.done[`${w - 1}-${last(w - 1)}`];
  }
  function nextStage() {
    for (const wd of K.WORLDS) for (let s = 1; s <= K.stageCount(wd); s++) if (!save.done[`${wd.id}-${s}`] && unlocked(wd.id, s)) return [wd.id, s];
    return null;
  }
  const shardTotal = () => Object.values(save.done).reduce((a, d) => a + (d.shards ? d.shards.filter(Boolean).length : 0), 0);

  /* ---------- экраны ---------- */
  function show(html) { const ov = $('#ov'); ov.innerHTML = html; ov.hidden = !html; ov.scrollTop = 0; const f = ov.querySelector('[data-focus]') || ov.querySelector('button'); if (f) f.focus({ preventScroll: true }); }
  function music(name, boss) { AU.play(name, boss); }

  function titleScreen() {
    mode = 'title'; sceneWorld = 1;
    music('title');
    const nx = nextStage();
    const any = Object.keys(save.done).length > 0;
    show(`<div class="panel center">
      <p class="kicker">Аркада про попаданца</p>
      <h1 class="logo">Курьер<br>миров</h1>
      <p class="lede">Курьер Миша везёт последнюю шаурму за смену и проваливается в Разлом между мирами. Семь миров, двадцать шесть уровней, семь боссов. Заказ должен быть доставлен.</p>
      <div class="row">
        <button class="btn primary" data-act="play" data-focus>${any ? (nx ? `Продолжить: ${nx[0]}-${nx[1]}` : 'Играть') : 'Начать'}</button>
        <button class="btn" data-act="map">Карта миров</button>
      </div>
      <div class="row small">
        <button class="btn ghost" data-act="music">Музыка: ${AU.musicOn ? 'вкл' : 'выкл'}</button>
        <button class="btn ghost" data-act="sfx">Звуки: ${AU.sfxOn ? 'вкл' : 'выкл'}</button>
        <button class="btn ghost" data-act="help">Управление</button>
      </div>
      <p class="meta">Осколков Разлома собрано: ${shardTotal()} из 60</p>
    </div>`);
  }

  function helpScreen() {
    show(`<div class="panel center">
      <h2>Управление</h2>
      <table class="keys"><tbody>
        <tr><td>Бег</td><td>← → или A D</td></tr>
        <tr><td>Прыжок</td><td>Пробел, W, ↑ или Z. Держите дольше — выше</td></tr>
        <tr><td>Рывок</td><td>Shift или X (после мира 2)</td></tr>
        <tr><td>Огненный шар</td><td>C или F (после мира 4)</td></tr>
        <tr><td>Пауза</td><td>Esc или P</td></tr>
        <tr><td>Геймпад</td><td>стик, A — прыжок, B — рывок, X — огонь</td></tr>
        <tr><td>Телефон</td><td>кнопки на экране, лучше держать горизонтально</td></tr>
      </tbody></table>
      <p class="lede">Прыгайте врагам на голову. Флажки сохраняют место. На каждом уровне три осколка Разлома, часть спрятана.</p>
      <button class="btn primary" data-act="title" data-focus>Назад</button>
    </div>`);
  }

  function mapScreen() {
    mode = 'map';
    music('title');
    const nx = nextStage();
    let html = `<div class="panel wide"><div class="map-head"><h2>Карта миров</h2><p class="meta">Осколков: ${shardTotal()} из 60</p><button class="btn ghost" data-act="title">Меню</button></div><div class="worlds">`;
    for (const wd of K.WORLDS) {
      const open = unlocked(wd.id, 1);
      const sh = Array.from({ length: wd.levels }, (_, i) => save.done[`${wd.id}-${i + 1}`]).reduce((a, d) => a + (d ? d.shards.filter(Boolean).length : 0), 0);
      html += `<article class="world ${open ? '' : 'locked'}" style="--w1:${wd.pal.sky[1]};--w2:${wd.pal.sky[2]};--wa:${wd.pal.accent}">
        <div class="wnum">${wd.id}</div><div class="wbody"><h3>${open ? esc(wd.name) : 'Неизвестный мир'}</h3><p>${open ? esc(wd.sub) : 'Откроется после победы над боссом'}</p>
        <div class="stages">`;
      for (let s = 1; s <= K.stageCount(wd); s++) {
        const id = `${wd.id}-${s}`, d = save.done[id], ok = unlocked(wd.id, s), boss = K.isBoss(wd.id, s);
        const isNext = nx && nx[0] === wd.id && nx[1] === s;
        html += `<button class="st ${d ? 'done' : ''} ${isNext ? 'next' : ''} ${boss ? 'boss' : ''}" data-act="stage" data-w="${wd.id}" data-s="${s}" ${ok ? '' : 'disabled'} title="${boss ? esc(wd.bossName) : 'Уровень ' + id}">${boss ? 'Б' : s}${d && !boss ? `<i>${d.shards.filter(Boolean).length}/3</i>` : ''}</button>`;
      }
      html += `</div>${open ? `<p class="meta">Осколков ${sh} из ${wd.levels * 3}${wd.gives && save.done[`${wd.id}-${K.stageCount(wd)}`] ? ` · получено: ${K.ABILITY_NAMES[wd.gives]}` : ''}</p>` : ''}</div></article>`;
    }
    html += '</div></div>';
    show(html);
    sceneWorld = nx ? nx[0] : 7;
  }

  function storyScreen(pages, wid, then, opts) {
    mode = 'story';
    sceneWorld = wid;
    story = { pages, i: 0, then };
    music(opts && opts.song ? opts.song : K.worldById(wid).music);
    renderStory(opts);
  }
  function renderStory(opts) {
    const p = story.pages[story.i];
    const lastPage = story.i === story.pages.length - 1;
    show(`<div class="panel story"><p class="kicker">${esc(opts && opts.kicker ? opts.kicker : K.worldById(sceneWorld).name)}</p><p class="story-text">${esc(p)}</p>
      <div class="row"><button class="btn primary" data-act="next" data-focus>${lastPage ? 'Вперёд' : 'Дальше'}</button>${story.pages.length > 1 && !lastPage ? '<button class="btn ghost" data-act="skip">Пропустить</button>' : ''}</div>
      <p class="meta">${story.i + 1} / ${story.pages.length}</p></div>`);
  }

  function startStage(w, s) {
    const wd = K.worldById(w);
    if (s === 1 && !save.seen['w' + w]) {
      save.seen['w' + w] = 1; store();
      const pages = (w === 1 ? K.STORY.intro : []).concat(K.STORY.worldIntro[w]);
      storyScreen(pages, w, () => play(w, s), { kicker: w === 1 ? 'Пролог' : `Мир ${w}. ${wd.name}` });
      return;
    }
    play(w, s);
  }
  function play(w, s) {
    mode = 'play';
    cur = { w, s };
    show('');
    E.load(w, s);
    E.onComplete = onComplete;
    music(K.worldById(w).music, K.isBoss(w, s));
    $('#pausebtn').hidden = false;
    updateTouch();
  }

  function onComplete(r) {
    const id = `${r.world}-${r.stage}`, prev = save.done[id];
    const best = prev ? { time: Math.min(prev.time, r.time), coins: Math.max(prev.coins, r.coins), total: r.totalCoins, shards: prev.shards.map((v, i) => v || r.shards[i]), deaths: Math.min(prev.deaths, r.deaths) } : { time: r.time, coins: r.coins, total: r.totalCoins, shards: r.shards, deaths: r.deaths };
    save.done[id] = best; store();
    $('#pausebtn').hidden = true;
    if (r.boss) {
      AU.sfx('win');
      const after = r.world === 7 ? () => endingScreen() : () => mapScreen();
      storyScreen(K.STORY.bossWin[r.world], r.world, r.world === 7 ? () => storyScreen(K.STORY.ending, 7, after, { song: 'ending', kicker: 'Казань. Девятый этаж' }) : after, { kicker: 'Победа' });
      return;
    }
    mode = 'result';
    const m = Math.floor(r.time / 60), sec = Math.floor(r.time % 60);
    const wd = K.worldById(r.world);
    const nextS = r.stage + 1 <= K.stageCount(wd) ? [r.world, r.stage + 1] : null;
    show(`<div class="panel center"><p class="kicker">Уровень ${id} пройден</p><h2>${esc(wd.name)}</h2>
      <div class="stats"><div><b>${m}:${String(sec).padStart(2, '0')}</b><span>время</span></div><div><b>${r.coins}/${r.totalCoins}</b><span>кристаллы</span></div><div><b class="shards">${r.shards.map((v) => (v ? '◆' : '◇')).join('')}</b><span>осколки</span></div><div><b>${r.deaths}</b><span>падений</span></div></div>
      <div class="row">${nextS ? `<button class="btn primary" data-act="stage" data-w="${nextS[0]}" data-s="${nextS[1]}" data-focus>${K.isBoss(nextS[0], nextS[1]) ? 'К боссу' : 'Дальше'}</button>` : ''}<button class="btn" data-act="map">Карта</button><button class="btn ghost" data-act="stage" data-w="${r.world}" data-s="${r.stage}">Ещё раз</button></div></div>`);
  }

  function endingScreen() {
    mode = 'ending';
    music('ending');
    const total = Object.values(save.done).reduce((a, d) => a + d.time, 0), deaths = Object.values(save.done).reduce((a, d) => a + d.deaths, 0);
    show(`<div class="panel center"><p class="kicker">Конец</p><h1 class="logo">Заказ<br>доставлен</h1>
      <div class="stats"><div><b>${Math.round(total / 60)} мин</b><span>в пути</span></div><div><b>${shardTotal()}/60</b><span>осколков</span></div><div><b>${deaths}</b><span>падений</span></div></div>
      <p class="lede">Спасибо, что доставили шаурму. Все уровни открыты на карте: можно вернуться за пропущенными осколками.</p>
      <div class="row"><button class="btn primary" data-act="map" data-focus>Карта миров</button><button class="btn" data-act="title">Меню</button></div></div>`);
  }

  function pause() {
    if (mode !== 'play') return;
    mode = 'pause';
    const ab = Object.keys(K.abilitiesFor(cur.w)).map((k) => K.ABILITY_NAMES[k]);
    show(`<div class="panel center"><h2>Пауза</h2><p class="meta">${ab.length ? 'Умения: ' + esc(ab.join(', ')) : 'Пока только бег и прыжок'}</p><div class="col">
      <button class="btn primary" data-act="resume" data-focus>Продолжить</button>
      <button class="btn" data-act="restart">Начать уровень заново</button>
      <button class="btn" data-act="map">Карта миров</button>
      <div class="row small"><button class="btn ghost" data-act="music">Музыка: ${AU.musicOn ? 'вкл' : 'выкл'}</button><button class="btn ghost" data-act="sfx">Звуки: ${AU.sfxOn ? 'вкл' : 'выкл'}</button></div></div></div>`);
  }
  function resume() { mode = 'play'; show(''); }

  /* ---------- кнопки экранов ---------- */
  $('#ov').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-act]');
    if (!b || b.disabled) return;
    AU.init();
    AU.sfx('click');
    const act = b.dataset.act;
    if (act === 'play') { const nx = nextStage(); if (nx) startStage(nx[0], nx[1]); else mapScreen(); }
    else if (act === 'map') { $('#pausebtn').hidden = true; mapScreen(); }
    else if (act === 'title') titleScreen();
    else if (act === 'help') helpScreen();
    else if (act === 'stage') startStage(Number(b.dataset.w), Number(b.dataset.s));
    else if (act === 'music') { AU.setMusic(!AU.musicOn); save.music = AU.musicOn; store(); b.textContent = `Музыка: ${AU.musicOn ? 'вкл' : 'выкл'}`; }
    else if (act === 'sfx') { AU.setSfx(!AU.sfxOn); save.sfx = AU.sfxOn; store(); b.textContent = `Звуки: ${AU.sfxOn ? 'вкл' : 'выкл'}`; }
    else if (act === 'next') { if (story.i < story.pages.length - 1) { story.i++; renderStory(); } else story.then(); }
    else if (act === 'skip') story.then();
    else if (act === 'resume') resume();
    else if (act === 'restart') play(cur.w, cur.s);
  });
  $('#pausebtn').addEventListener('click', () => { AU.init(); if (mode === 'play') pause(); else if (mode === 'pause') resume(); });

  /* ---------- управление ---------- */
  const I = E.input;
  const keys = new Set();
  const MAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', KeyZ: 'jump', KeyK: 'jump', ShiftLeft: 'dash', ShiftRight: 'dash', KeyX: 'dash', KeyJ: 'dash', KeyC: 'fire', KeyF: 'fire', KeyL: 'fire', ArrowDown: 'down', KeyS: 'down' };
  const src = { key: {}, touch: {}, pad: {} };
  function press(name, on, from) {
    const was = I[name];
    src[from][name] = on;
    I[name] = !!(src.key[name] || src.touch[name] || src.pad[name]);
    if (I[name] && !was) { if (name === 'jump') I.jumpPressed = true; if (name === 'dash') I.dashPressed = true; if (name === 'fire') I.firePressed = true; }
  }
  window.addEventListener('keydown', (e) => {
    AU.init();
    if ((e.code === 'Escape' || e.code === 'KeyP') && (mode === 'play' || mode === 'pause')) { e.preventDefault(); mode === 'play' ? pause() : resume(); return; }
    if ((e.code === 'Enter' || e.code === 'Space') && mode === 'story') { e.preventDefault(); $('[data-act="next"]').click(); return; }
    const a = MAP[e.code];
    if (a && mode === 'play') { e.preventDefault(); if (!e.repeat) press(a, true, 'key'); }
  });
  window.addEventListener('keyup', (e) => { const a = MAP[e.code]; if (a) press(a, false, 'key'); });
  window.addEventListener('blur', () => { for (const k of Object.keys(src.key)) press(k, false, 'key'); if (mode === 'play') pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') pause(); });

  // Сенсорные кнопки
  const touchEl = $('#touch');
  const isTouch = () => matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  function updateTouch() {
    touchEl.hidden = !(isTouch() && mode === 'play');
    if (!cur) return;
    const ab = K.abilitiesFor(cur.w);
    touchEl.querySelector('[data-b="dash"]').classList.toggle('off', !ab.dash);
    touchEl.querySelector('[data-b="fire"]').classList.toggle('off', !ab.fire);
  }
  const ptr = new Map();
  touchEl.addEventListener('pointerdown', (e) => { const b = e.target.closest('[data-b]'); if (!b) return; e.preventDefault(); AU.init(); b.setPointerCapture(e.pointerId); ptr.set(e.pointerId, b.dataset.b); press(b.dataset.b, true, 'touch'); b.classList.add('on'); });
  const up = (e) => { const n = ptr.get(e.pointerId); if (!n) return; ptr.delete(e.pointerId); if (![...ptr.values()].includes(n)) press(n, false, 'touch'); touchEl.querySelectorAll(`[data-b="${n}"]`).forEach((x) => x.classList.remove('on')); };
  touchEl.addEventListener('pointerup', up);
  touchEl.addEventListener('pointercancel', up);
  touchEl.addEventListener('contextmenu', (e) => e.preventDefault());

  // Геймпад
  let padStart = false;
  function pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const p = pads && Array.from(pads).find(Boolean);
    if (!p) return;
    const ax = p.axes[0] || 0, btn = (i) => p.buttons[i] && p.buttons[i].pressed;
    press('left', ax < -0.4 || btn(14), 'pad');
    press('right', ax > 0.4 || btn(15), 'pad');
    press('jump', btn(0) || btn(12), 'pad');
    press('dash', btn(1) || btn(5) || btn(7), 'pad');
    press('fire', btn(2) || btn(3), 'pad');
    const st = btn(9);
    if (st && !padStart) { if (mode === 'play') pause(); else if (mode === 'pause') resume(); }
    padStart = st;
  }

  /* ---------- цикл ---------- */
  let acc = 0, lastT = performance.now();
  const STEP = 1000 / 60;
  function frame(now) {
    acc += Math.min(100, now - lastT);
    lastT = now;
    pollPad();
    while (acc >= STEP) {
      if (mode === 'play') { E.update(); I.jumpPressed = I.dashPressed = I.firePressed = false; }
      else sceneT++;
      acc -= STEP;
    }
    if (mode === 'play' || mode === 'pause' || mode === 'result') E.render(ctx);
    else { E.renderScene(ctx, sceneWorld, sceneT); ctx.fillStyle = 'rgba(5,4,15,0.45)'; ctx.fillRect(0, 0, K.VW, K.VH); }
    requestAnimationFrame(frame);
  }

  function start() {
    const fontsReady = document.fonts && document.fonts.load ? Promise.all([document.fonts.load('20px "Pixelify Sans"'), document.fonts.load('16px "Press Start 2P"')]).catch(() => {}) : Promise.resolve();
    fontsReady.then(() => {});
    titleScreen();
    requestAnimationFrame(frame);
    window.addEventListener('resize', updateTouch);
  }
  // Для автотестов: доступ к состоянию.
  K.debug = { E, startStage: (w, s) => play(w, s), mode: () => mode, save: () => save };
  start();
})();
