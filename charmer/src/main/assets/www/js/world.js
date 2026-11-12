'use strict';
/* Мир: генерация карт, ходьба по клеткам, встречи, отрисовка вида сверху */
(function () {
  const W = window.WD = {}, T = D.T;
  const GRASS = 0, PATH = 1, WATER = 2, TALL = 3, FLOWER = 4, WALL = 8;

  /* ---------- Генерация карты ---------- */
  W.build = function (id) {
    const def = D.MAPS[id], w = def.w, h = def.h, r = U.rng(def.seed * 7919 + 1), N = w * h;
    const m = { id, def, w, h, tile: new Uint8Array(N), block: new Uint8Array(N), objs: [], npcs: [], signs: [], doors: [], exits: def.exits };
    const at = (x, y) => y * w + x, inb = (x, y) => x >= 0 && y >= 0 && x < w && y < h;
    const isExit = (x, y) => def.exits.some(e => e.x === x && e.y === y);
    const path = new Uint8Array(N);
    for (const pl of def.paths) for (let i = 0; i < pl.length - 1; i++) {
      const [x0, y0] = pl[i], [x1, y1] = pl[i + 1], dx = Math.sign(x1 - x0), dy = Math.sign(y1 - y0), n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let k = 0; k <= n; k++) { const px = x0 + dx * k, py = y0 + dy * k; for (const [ax, ay] of dx ? [[px, py], [px, py - 1]] : [[px, py], [px + 1, py]]) if (inb(ax, ay)) path[at(ax, ay)] = 1; }
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = at(x, y);
      if (def.indoor) { m.tile[i] = (x === 0 || y === 0 || x === w - 1 || y === h - 1) && !isExit(x, y) ? WALL : PATH === 1 && path[i] ? GRASS : GRASS; if (m.tile[i] === WALL) m.block[i] = 1; continue; }
      if (path[i]) { m.tile[i] = PATH; continue; }
      let wv = false; for (const p of def.ponds) if (Math.hypot(x - p[0], (y - p[1]) * 1.2) < p[2] + (U.noise(x * 1.7 + y * 3.1) - 0.5) * 0.8) wv = true;
      if (wv) { m.tile[i] = WATER; m.block[i] = 1; continue; }
      let tall = false; for (const g of def.grass) { const d = Math.hypot((x - g[0]) / g[2], (y - g[1]) / g[3]); if (d < 1 + (U.noise(x * 2.3 + y * 1.3 + 5) - 0.5) * 0.5) tall = true; }
      if (tall) { m.tile[i] = TALL; continue; }
      m.tile[i] = r() < def.flowers ? FLOWER : GRASS;
    }
    const treeKind = def.ground === 'forest' ? 'dark' : def.ground === 'rock' ? 'snowpine' : 'tree';
    const addTree = (x, y) => { m.block[at(x, y)] = 1; m.objs.push({ k: 'tree', im: U.pick(ART.objs[treeKind], r), x, y, sy: (y + 1) * T }); };
    // дома
    for (const ho of def.houses || []) {
      for (let y = ho.y; y < ho.y + 4; y++) for (let x = ho.x; x < ho.x + 4; x++) if (inb(x, y)) { m.block[at(x, y)] = 1; m.tile[at(x, y)] = GRASS; }
      m.objs.push({ k: 'house', im: ART.objs.house[ho.k], x: ho.x, y: ho.y, sy: (ho.y + 4) * T });
      m.doors.push({ k: ho.k, x: ho.x + 1, y: ho.y + 3 }, { k: ho.k, x: ho.x + 2, y: ho.y + 3 });
    }
    const reserved = new Uint8Array(N);
    for (const n of def.npcs) for (const [x, y] of [[n.x, n.y], n.aside || [n.x, n.y]]) if (inb(x, y)) reserved[at(x, y)] = 1;
    for (const s of def.signs) reserved[at(s.x, s.y)] = 1;
    for (const d of m.doors) if (inb(d.x, d.y + 1)) reserved[at(d.x, d.y + 1)] = 1;
    // граница
    if (!def.indoor) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1, i = at(x, y);
      if (edge && !isExit(x, y) && !path[i]) addTree(x, y);
      else if (!edge && !m.block[i] && !path[i] && !reserved[i] && m.tile[i] !== TALL && m.tile[i] !== WATER && r() < def.trees) {
        let nearPath = false; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inb(x + dx, y + dy) && path[at(x + dx, y + dy)]) nearPath = true;
        if (!nearPath) { if (def.ground === 'rock' && r() < 0.35) { m.block[i] = 1; m.objs.push({ k: 'rock', im: ART.objs.rock, x, y, sy: (y + 1) * T - 4 }); } else addTree(x, y); }
      }
    }
    for (const s of def.signs) { m.block[at(s.x, s.y)] = 1; m.tile[at(s.x, s.y)] = m.tile[at(s.x, s.y)] === PATH ? PATH : GRASS; m.signs.push(s); m.objs.push({ k: 'sign', im: ART.objs.sign, x: s.x, y: s.y, sy: (s.y + 1) * T - 2 }); }
    for (const n of def.npcs) {
      const done = n.trainer && G.S.flags[n.trainer];
      const p = done && n.aside ? n.aside : [n.x, n.y];
      m.npcs.push({ id: n.id, look: n.look, x: p[0], y: p[1], face: done && n.aside ? 'down' : n.face, trainer: n.trainer, t: Math.random() * 9 });
    }
    m.ground = renderGround(m);
    return m;
  };
  function renderGround(m) {
    const [c, x] = U.canvas(m.w * T, m.h * T, 1.5), def = m.def, base = { grass: 'grass', forest: 'forest', rock: 'rock', tower: 'tower' }[def.ground], r = U.rng(def.seed);
    const tl = ART.tiles;
    for (let y = 0; y < m.h; y++) for (let x0 = 0; x0 < m.w; x0++) {
      const t = m.tile[y * m.w + x0], v = (x0 * 7 + y * 13) % 3;
      const im = t === PATH ? (def.indoor ? tl.tower[v] : tl.path[v]) : t === WATER ? tl.water[v] : t === TALL ? tl.tall[v] : t === FLOWER ? tl.flower[v] : t === WALL ? tl.wall[v] : tl[base][v];
      x.drawImage(im, x0 * T, y * T, T, T);
    }
    // мягкие края воды и троп
    for (let y = 0; y < m.h; y++) for (let x0 = 0; x0 < m.w; x0++) {
      const t = m.tile[y * m.w + x0]; if (t !== WATER) continue;
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) { const nx = x0 + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h || m.tile[ny * m.w + nx] === WATER) continue; x.fillStyle = 'rgba(255,255,255,.55)'; x.fillRect(x0 * T + (dx > 0 ? T - 3 : 0), y * T + (dy > 0 ? T - 3 : 0), dx ? 3 : T, dy ? 3 : T); x.fillStyle = '#21121c'; x.fillRect(x0 * T + (dx > 0 ? T - 1 : dx < 0 ? -1 : 0), y * T + (dy > 0 ? T - 1 : dy < 0 ? -1 : 0), dx ? 2 : T, dy ? 2 : T); }
    }
    if (def.indoor) { x.fillStyle = 'rgba(255,120,200,.12)'; x.fillRect(0, 0, m.w * T, m.h * T); x.fillStyle = '#4a2a5a'; x.fillRect(5 * T, 0, 3 * T, 2 * T); }
    return c;
  }

  /* ---------- Ходьба ---------- */
  const DIR = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  W.enter = function (mapId, x, y, face) {
    const S = G.S; S.map = mapId; S.x = x; S.y = y; if (face) S.face = face;
    W.m = W.build(mapId);
    W.hero = { px: x * T, py: y * T, mv: 0, fx: x, fy: y, walk: 0 };
    W.fol = { x, y, px: x * T, py: y * T, walk: 0, path: [] };
    UI.zone(W.m.def.n);
    U.music(mapId === 'village' ? 'tavern' : 'world');
  };
  W.walkable = function (x, y) {
    const m = W.m; if (x < 0 || y < 0 || x >= m.w || y >= m.h) return false;
    if (m.block[y * m.w + x]) return false;
    if (m.npcs.some(n => n.x === x && n.y === y)) return false;
    return true;
  };
  W.npcAt = (x, y) => W.m.npcs.find(n => n.x === x && n.y === y);
  W.update = function (dt, input) {
    const S = G.S, h = W.hero, m = W.m, tm = G.time;
    if (h.mv > 0) {
      h.mv -= dt / 0.2; h.walk += dt * 14;
      const k = Math.max(0, h.mv);
      h.px = (S.x - (S.x - h.fx) * k) * T; h.py = (S.y - (S.y - h.fy) * k) * T;
      if (h.mv <= 0) { h.px = S.x * T; h.py = S.y * T; arrived(); }
    } else if (input) {
      S.face = input; const [dx, dy] = DIR[input], nx = S.x + dx, ny = S.y + dy;
      if (W.walkable(nx, ny)) {
        if (S.map === 'village' && !S.flags.starter && m.exits.some(e => e.x === nx && e.y === ny)) { UI.say([{ who: 'Баба Нюра', t: 'Куда без напарницы?! Зайди ко мне, выбери девицу!' }]); return; }
        h.fx = S.x; h.fy = S.y; W.fol.path.push([S.x, S.y]); S.x = nx; S.y = ny; h.mv = 1;
      } else { const n = W.npcAt(nx, ny); if (n && n.trainer && !S.flags[n.trainer]) W.interact(); else if (W.bumpT <= 0 || W.bumpT === undefined) { U.sfx('bump'); W.bumpT = 0.3; } }
    } else h.walk = 0;
    if (W.bumpT > 0) W.bumpT -= dt;
    // напарница идёт следом
    const f = W.fol;
    if (f.path.length > 1 || (f.path.length && h.mv <= 0)) {
      const tgt = f.path[0], tx = tgt[0] * T, ty = tgt[1] * T, dx = tx - f.px, dy = ty - f.py, d = Math.hypot(dx, dy), sp = T / 0.2 * dt;
      if (d <= sp) { f.px = tx; f.py = ty; f.x = tgt[0]; f.y = tgt[1]; f.path.shift(); } else { f.px += dx / d * sp; f.py += dy / d * sp; }
      f.walk += dt * 14; f.face = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    } else f.walk = 0;
    if (f.path.length > 3) f.path.splice(0, f.path.length - 3);
    for (const n of m.npcs) n.t += dt;
  };
  function arrived() {
    const S = G.S, m = W.m, ex = m.exits.find(e => e.x === S.x && e.y === S.y);
    if (ex) { UI.fade(() => W.enter(ex.to, ex.tx, ex.ty)); return; }
    if (m.tile[S.y * m.w + S.x] === TALL && m.def.wild && G.alive() && Math.random() < 0.13) startWild();
  }
  function startWild() {
    const wd = W.m.def.wild; let tot = 0; for (const e of wd.list) tot += e[1];
    let q = Math.random() * tot, id = wd.list[0][0]; for (const e of wd.list) { q -= e[1]; if (q <= 0) { id = e[0]; break; } }
    const lvl = wd.lv[0] + Math.floor(Math.random() * (wd.lv[1] - wd.lv[0] + 1));
    BT.start({ wild: { id, lvl }, zone: W.m.id });
  }
  W.interact = function () {
    const S = G.S, [dx, dy] = DIR[S.face], tx = S.x + dx, ty = S.y + dy, m = W.m;
    const n = W.npcAt(tx, ty);
    if (n) {
      n.face = { up: 'down', down: 'up', left: 'right', right: 'left' }[S.face];
      if (n.trainer) return trainerTalk(n);
      const lines = D.NPC[n.id]; return UI.say([{ who: n.id === 'pahom' ? 'Дед Пахом' : 'Мальчишка', t: U.pick(lines, Math.random) }]);
    }
    const s = m.signs.find(s => s.x === tx && s.y === ty); if (s) return UI.say([{ who: 'Табличка', t: s.t }]);
    const d = m.doors.find(d => d.x === tx && d.y === ty);
    if (d) {
      if (d.k === 'elder') return elder();
      if (d.k === 'shop') return UI.openShop();
      if (d.k === 'tavern') return UI.openTavern();
    }
    const t = m.tile[ty * m.w + tx];
    if (t === WATER) return UI.say([{ who: '', t: 'Вода прозрачная. В отражении — красавец. Ну, почти.' }]);
  };
  function elder() {
    const S = G.S;
    if (!S.flags.starter) {
      UI.say(D.NPC.elderIntro.map(t => ({ who: 'Баба Нюра', t })), () => UI.chooseStarter(id => {
        G.addGirl(id, 5); S.flags.starter = true; W.fol.path = [];
        const g = D.GIRLS[id];
        UI.say([{ girl: id, expr: 'happy', t: g.tame }, ...D.NPC.elderAfter.map(t => ({ who: 'Баба Нюра', t }))], () => G.save());
      }));
    } else UI.say((S.flags.boss ? D.NPC.elderWin : D.NPC.elderAfter).map(t => ({ who: 'Баба Нюра', t })));
  }
  function trainerTalk(n) {
    const S = G.S, tr = D.TRAINERS[n.trainer];
    if (S.flags[n.trainer]) return UI.say([{ who: tr.n, t: tr.after }]);
    if (!G.alive()) return UI.say([{ who: tr.n, t: 'Твои девицы без сил. Сначала отдохни в таверне, герой-любовник.' }]);
    UI.say(tr.before.map(t => ({ who: tr.n, t })), () => BT.start({ trainer: n.trainer, zone: W.m.id, npc: n }));
  }
  W.trainerBeaten = function (key) {
    const n = W.m.npcs.find(q => q.trainer === key), def = D.MAPS[W.m.id].npcs.find(q => q.trainer === key);
    if (n && def && def.aside) { n.x = def.aside[0]; n.y = def.aside[1]; n.face = 'down'; }
  };

  /* ---------- Отрисовка ---------- */
  W.render = function (x, V) {
    const m = W.m, h = W.hero, z = V.h / (T * 8.6), S = G.S, tm = G.time;
    const hw = V.w / 2 / z, hh = V.h / 2 / z, mw = m.w * T, mh = m.h * T;
    let cx = h.px + T / 2, cy = h.py + T / 2;
    cx = mw < hw * 2 ? mw / 2 : U.clamp(cx, hw, mw - hw); cy = mh < hh * 2 ? mh / 2 : U.clamp(cy, hh, mh - hh);
    const left = cx - hw, top = cy - hh;
    x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = m.def.indoor ? '#1a0e22' : '#2e5a2a'; x.fillRect(0, 0, V.w, V.h);
    x.setTransform(z, 0, 0, z, -left * z, -top * z);
    x.drawImage(m.ground, 0, 0, mw, mh);
    // блики на воде
    x.strokeStyle = 'rgba(255,255,255,.6)'; x.lineWidth = 1.6;
    const x0 = Math.max(0, Math.floor(left / T)), x1 = Math.min(m.w - 1, Math.ceil((left + hw * 2) / T)), y0 = Math.max(0, Math.floor(top / T)), y1 = Math.min(m.h - 1, Math.ceil((top + hh * 2) / T));
    for (let y = y0; y <= y1; y++) for (let xx = x0; xx <= x1; xx++) if (m.tile[y * m.w + xx] === WATER && ((xx * 7 + y * 3) % 2 === 0)) { const ph = (tm * 0.6 + xx * 0.3 + y * 0.7) % 1; x.globalAlpha = Math.sin(ph * Math.PI); x.beginPath(); x.moveTo(xx * T + 10 + ph * 10, y * T + 20); x.quadraticCurveTo(xx * T + 16 + ph * 10, y * T + 16, xx * T + 22 + ph * 10, y * T + 20); x.stroke(); }
    x.globalAlpha = 1;
    // объекты по глубине
    const list = [];
    for (const o of m.objs) if (o.x * T < left + hw * 2 + 3 * T && (o.x + 4) * T > left - T && o.y * T < top + hh * 2 + T && o.sy > top) list.push(o);
    for (const n of m.npcs) list.push({ k: 'npc', n, sy: (n.y + 1) * T - 6 });
    const lead = S.party[0];
    if (lead && S.flags.starter && (W.fol.path.length || W.fol.x !== S.x || W.fol.y !== S.y)) list.push({ k: 'fol', sy: W.fol.py + T - 7 });
    list.push({ k: 'hero', sy: h.py + T - 6 });
    for (let y = y0; y <= y1; y++) for (let xx = x0; xx <= x1; xx++) if (m.tile[y * m.w + xx] === TALL) list.push({ k: 'tall', x: xx, y, sy: (y + 1) * T - 0.5 });
    list.sort((a, b) => a.sy - b.sy);
    for (const o of list) {
      if (o.k === 'tree') x.drawImage(o.im, o.x * T - 12, (o.y + 1) * T - 92, 72, 96);
      else if (o.k === 'house') x.drawImage(o.im, o.x * T, o.y * T, 4 * T, 4 * T);
      else if (o.k === 'rock' || o.k === 'sign') x.drawImage(o.im, o.x * T, o.y * T, T, T);
      else if (o.k === 'tall') { x.save(); x.translate(o.x * T, (o.y + 1) * T); x.transform(1, 0, Math.sin(tm * 2 + o.x * 0.7 + o.y) * 0.06, 1, 0, 0); x.drawImage(ART.tallFront, 0, -T * 0.62, T, T * 0.62); x.restore(); }
      else if (o.k === 'npc') {
        const n = o.n; x.save(); x.translate(n.x * T + T / 2, (n.y + 1) * T - 6);
        if (n.look === 'witch') { x.scale(0.38, 0.38); ART.girl(x, 'witch', { t: tm, chibi: true, expr: 'smug' }); } else ART.person(x, n.look, n.face, 0, tm + n.t);
        x.restore();
        if (n.trainer && !S.flags[n.trainer]) { const d = Math.abs(n.x - S.x) + Math.abs(n.y - S.y); if (d < 5) bubble(x, n.x * T + T / 2 + 10, n.y * T - 40 + Math.sin(tm * 4) * 2, '!'); }
      } else if (o.k === 'fol') { x.save(); x.translate(W.fol.px + T / 2, W.fol.py + T - 7); x.scale(0.36, 0.36); ART.girl(x, lead.id, { t: tm, chibi: true, walk: W.fol.walk, bloom: lead.bloom, expr: lead.aff >= 75 ? 'happy' : 'normal' }); x.restore(); if (lead.aff >= 50 && Math.sin(tm * 1.3) > 0.97) heartFloat(x, W.fol.px + T / 2, W.fol.py - 30); }
      else if (o.k === 'hero') { x.save(); x.translate(h.px + T / 2, h.py + T - 6); ART.person(x, 'hero', S.face, h.mv > 0 ? h.walk : 0, tm); x.restore(); }
    }
    // табличка у двери
    if (m.def.indoor) { x.fillStyle = 'rgba(255,90,180,' + (0.06 + 0.04 * Math.sin(tm * 2)) + ')'; x.fillRect(0, 0, mw, mh); }
  };
  function bubble(x, px, py, t) {
    x.fillStyle = '#fff'; x.strokeStyle = '#21121c'; x.lineWidth = 2; x.beginPath(); x.ellipse(px, py, 9, 11, 0, 0, 6.283); x.moveTo(px - 3, py + 9); x.lineTo(px - 7, py + 16); x.lineTo(px + 2, py + 10); x.fill(); x.stroke();
    x.fillStyle = '#e8243a'; x.font = '900 15px sans-serif'; x.textAlign = 'center'; x.fillText(t, px, py + 5.5);
  }
  function heartFloat(x, px, py) { ART.heart(x, px, py, 5, '#ff4f7b'); }
})();
