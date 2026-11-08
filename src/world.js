'use strict';
// ---------- Округа: карта локаций, разведка, группировки ----------

function ensureWorld() {
  if (!S) return;
  S.known = S.known || LOC_ORDER.filter(k => LOCS[k].start);
  S.known = S.known.filter(k => LOCS[k]);
  S.visits = S.visits || {};
  S.seed = S.seed || ((Math.random() * 2 ** 31) | 0) || 777;
  S.fac = S.fac || {};
  for (const f in FACTIONS) S.fac[f] = Object.assign({ met: false, beaten: false, kills: 0, anger: 0 }, S.fac[f]);
  if (S.fac.collectors.tribute === undefined) S.fac.collectors.tribute = null;
}
const isKnown = k => S.known.includes(k);
function reveal(k) { if (LOCS[k] && !isKnown(k)) { S.known.push(k); return true; } return false; }
function locLocked(k) { const L = LOCS[k]; return !!L.needRadio && S.build.radio < L.needRadio; }
const pdist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function tributeCost() {
  const d = S.day;
  return { food: 3 + Math.floor(d / 5), water: 2 + Math.floor(d / 7), ammo: 4 + Math.floor(d / 4) };
}
function metFaction(f, lines) {
  const st = S.fac[f];
  if (!st || st.met) return;
  st.met = true;
  const F = FACTIONS[f];
  lines.push({ t: `Новая группировка: ${F.name}. ${F.desc}`, c: 'bad' });
}
function factionHit(f, n) { if (S.fac[f]) { S.fac[f].kills += n; S.fac[f].anger += n; } }
function factionBeaten(f, lines) {
  const st = S.fac[f];
  if (!st || st.beaten) return;
  st.beaten = true;
  const eff = {
    collectors: 'Сборщики больше не придут за долей.',
    raiders: 'Засад на дорогах станет меньше, ночных налётов Вольницы не будет.',
    flock: 'Паства рассеяна: стад мёртвых у стен больше не будет.',
    garrison: 'Гарнизон отошёл. Блокпост охраняет горстка солдат.',
  }[f];
  if (f === 'collectors') st.tribute = null;
  lines.push({ t: eff, c: 'good' });
}
// После вылазки: что увидели с крыш и что нашли на телах
function revealAfterMission(m, lines) {
  const L = LOCS[m.loc];
  const cand = LOC_ORDER.filter(k => !isKnown(k) && !LOCS[k].camp).sort((a, b) => pdist(L.pos, LOCS[a].pos) - pdist(L.pos, LOCS[b].pos));
  for (const k of cand.slice(0, chance(0.5) ? 2 : 1)) { reveal(k); lines.push({ t: `На карте новая точка: ${LOCS[k].name}.`, c: 'good' }); }
  for (const f in m.hseen || {}) {
    metFaction(f, lines);
    const camp = FACTIONS[f].camp;
    if ((m.hkills[f] || 0) >= 1 && !isKnown(camp)) { reveal(camp); lines.push({ t: `У убитого нашли карту с пометкой: ${LOCS[camp].name}.`, c: 'good' }); }
  }
}

// ----- нападения на базу -----
function rollAttack(lines) {
  const fc = S.fac, tr = fc.collectors.tribute;
  if (tr && !fc.collectors.beaten && S.day >= tr.due) {
    const paid = tr.paid;
    fc.collectors.tribute = { due: S.day + 6, cost: tributeCost(), paid: false };
    if (paid) { lines.push({ t: 'Сборщики приехали, забрали долю и уехали. Следующий раз — через шесть дней.' }); return null; }
    fc.collectors.anger++;
    return { kind: 'raid', fac: 'collectors', waves: S.day >= 16 ? 3 : 2 };
  }
  if (fc.raiders.met && !fc.raiders.beaten && S.day >= 6 && chance(0.09 + Math.min(0.1, fc.raiders.anger * 0.015))) return { kind: 'raid', fac: 'raiders', waves: 2 };
  if (fc.flock.met && !fc.flock.beaten && S.day >= 8 && chance(0.09)) return { kind: 'herd', waves: 2 };
  if (chance(clamp(0.1 + S.day * 0.012 - S.build.walls * 0.035, 0.05, 0.42))) return { kind: 'horde', waves: S.day >= 12 ? 3 : 2 };
  return null;
}
function attackText(atk) {
  if (atk.kind === 'horde') return 'Со стороны дороги идёт толпа мёртвых. Их много, и они уже у забора.';
  if (atk.kind === 'herd') return 'В темноте звенит колокольчик: Паства гонит к вашим стенам стадо мёртвых.';
  return atk.fac === 'collectors' ? 'Доли не было — Сборщики приехали сами. Фары, биты, крики у ворот.' : 'Вольница решила, что у вас есть чем поживиться. Тени у забора, щелчки затворов.';
}
// Если запереться и не выходить: решают стены и удача
function resolveAuto(atk, lines) {
  const w = S.build.walls, ppl = S.survivors;
  if (!ppl.length) return;
  const strength = atk.kind === 'raid' ? 2.2 : atk.kind === 'herd' ? 2 : 1.4 + S.day / 15;
  const hold = w * 0.9 + rnd() * 1.5;
  if (hold >= strength) { lines.push({ t: 'Ночь прошла под стук в ворота. Укрепления выдержали.', c: 'good' }); return; }
  const v = pick(ppl), d = Math.max(1, rint(2, 7) - w);
  v.hp -= d;
  const take = {};
  for (const k of atk.kind === 'raid' ? ['food', 'water', 'ammo', 'meds', 'parts'] : ['food', 'parts']) {
    const n = Math.min(S.res[k], atk.kind === 'raid' ? rint(1, 4) : rint(0, 2));
    if (n > 0) { S.res[k] -= n; take[k] = n; }
  }
  const lost = Object.keys(take).map(k => `${RES[k].name.toLowerCase()} ${take[k]}`).join(', ');
  lines.push({ t: `${atk.kind === 'raid' ? FACTIONS[atk.fac].name + ' прорвались' : 'Мёртвые прорвались'} во двор. ${v.name} ${gv(v, 'ранен', 'ранена')} (−${d}).${lost ? ` Пропало: ${lost}.` : ''}`, c: 'bad' });
}
function siegeLines(rep) {
  const sg = rep.siege, lines = [];
  if (sg.fled) {
    const atk = sg;
    resolveAuto(atk, lines);
  } else if (sg.won) {
    lines.push({ t: `Нападение отбито. Убито: ${rep.kills}.`, c: 'good' });
    if (sg.kind === 'raid') { S.fac[sg.fac].anger = Math.max(0, S.fac[sg.fac].anger - 2); lines.push({ t: `${FACTIONS[sg.fac].name} потеряли людей и надолго запомнят эту ночь.` }); }
  }
  return lines;
}
// Утро: новости округи
function morningNews(lines) {
  const fc = S.fac.collectors;
  if (!fc.met && S.day >= 4 && !fc.beaten) {
    fc.met = true;
    fc.tribute = { due: S.day + 2, cost: tributeCost(), paid: false };
    reveal('camp_collectors');
    lines.push({ t: `Утром у ворот остановился пикап. Люди в чёрной коже: «Теперь вы под защитой Сборщиков. Через два дня — доля». Их лагерь отмечен на карте.`, c: 'bad' });
  }
  if (S.build.radio && chance(0.3 + S.build.radio * 0.1)) {
    const cand = LOC_ORDER.filter(k => !isKnown(k) && !LOCS[k].camp);
    if (cand.length) { const k = pick(cand); reveal(k); lines.push({ t: `По радио рассказали про место: ${LOCS[k].name}. Отмечено на карте.`, c: 'good' }); }
  }
}
function payTribute() {
  const tr = S.fac.collectors.tribute;
  if (!tr || tr.paid || !canPay(tr.cost)) return;
  pay(tr.cost); tr.paid = true;
  addLog('Отложили долю для Сборщиков.', '');
  Sfx.play('search');
  Game.toast('Доля отложена');
  saveGame();
}

// ----- экран карты округи -----
// Река и трасса — постоянные черты местности (координаты карты 0..100 × 0..62)
const RIVER = [[-2, 40], [8, 44], [16, 50], [24, 48], [34, 47], [42, 44], [52, 46], [60, 52], [70, 50], [80, 46], [90, 42], [102, 40]];
const HIGHWAY = [[-2, 17], [20, 18], [40, 15], [60, 18], [80, 22], [102, 26]];
const World = {
  sel: null, cv: null, hit: [],
  render() {
    ensureWorld();
    if (this.sel && !isKnown(this.sel)) this.sel = null;
    if (!this.sel) this.sel = S.known.find(k => !locLocked(k)) || null;
    S.squad = S.squad.filter(id => S.survivors.some(s => s.id === id));
    const root = $('#scr-world');
    root.innerHTML = `
      <header class="wbar">
        <button class="btn sm" id="wBack">${icon('home')}<span>База</span></button>
        <h2>Карта округи</h2>
        <span class="wsub">Известно мест: ${S.known.length} из ${LOC_ORDER.length}</span>
        <span class="res" title="Топливо" style="--rc:${RES.fuel.color}">${icon('fuel')}<b>${S.res.fuel}</b></span>
        <span class="res" title="Патроны" style="--rc:${RES.ammo.color}">${icon('ammo')}<b>${S.res.ammo}</b></span>
      </header>
      <div class="wmain">
        <div class="wmap"><canvas id="wcv" aria-label="Карта округи"></canvas></div>
        <aside class="wcard">${this.card()}</aside>
      </div>`;
    $('#wBack').onclick = () => { Sfx.play('click'); Game.showBase(); };
    this.cv = $('#wcv');
    this.cv.onclick = e => this.click(e);
    $$('[data-sq]', root).forEach(b => { b.onclick = () => this.toggle(+b.dataset.sq); });
    const go = $('#wGo'); if (go) go.onclick = () => this.go();
    requestAnimationFrame(() => this.draw());
  },
  card() {
    const k = this.sel;
    if (!k) return '<p class="hint">Выберите точку на карте.</p>';
    const L = LOCS[k], locked = locLocked(k), v = S.visits[k] || 0, F = L.faction && FACTIONS[L.faction], fs = F && S.fac[L.faction];
    let dng = '';
    for (let d = 0; d < 5; d++) dng += `<i class="${d < L.danger ? 'on' : ''}"></i>`;
    const sq = S.squad.map(id => S.survivors.find(s => s.id === id)).filter(Boolean);
    const fuelOk = S.res.fuel >= L.fuel;
    const lootLeft = Math.round(Math.max(0.35, 1 - v * 0.22) * 100);
    return `<div class="wc-h"><b>${L.name}</b><span class="dng" title="Опасность">${dng}</span></div>
      <p class="wc-m">${L.w}×${L.h} клеток · ${L.fuel ? `топливо ${L.fuel}` : 'пешком'}${v ? ` · были ${v} ${plural(v, 'раз', 'раза', 'раз')}, добычи ~${lootLeft}%` : ''}</p>
      ${F ? `<p class="wc-f" style="--fc:${F.color}">${icon('shield')}<span>${fs.met ? F.name : 'Здесь кто-то есть'}${fs.beaten ? ' · разгромлены' : ''}${L.camp ? ' · лагерь' : ''}${L.captives ? ` · пленных: ${L.captives}` : ''}</span></p>` : ''}
      <p class="wc-d">${L.desc}</p>
      <div class="loc-l">${L.loot.map(r => `<i style="--rc:${RES[r].color}" title="${RES[r].name}">${icon(r)}</i>`).join('')}</div>
      <h3>Отряд <span>${sq.length}/4</span></h3>
      <div class="wsq">${S.survivors.map(s => {
        const on = S.squad.includes(s.id), hp = Math.round((s.hp / s.maxhp) * 100);
        return `<button class="wsq-b ${on ? 'on' : ''} ${s.infected ? 'inf' : ''}" data-sq="${s.id}" style="--uc:${s.color}" aria-pressed="${on}">
          <b>${esc(s.name)}</b><span>${TRAITS[s.trait].name} · ${s.ranged ? WEAP[s.ranged].name.toLowerCase() : WEAP[s.melee].name.toLowerCase()}</span>
          <i class="bar ${hp < 40 ? 'lowhp' : ''}"><i style="width:${hp}%"></i></i></button>`;
      }).join('')}</div>
      ${locked ? `<p class="warn">Сюда не доехать без ${L.needRadio > 1 ? 'мощной антенны (радиоточка 2)' : 'радиоточки'}: не знаем дороги.</p>` : ''}
      ${!fuelOk ? '<p class="warn">Не хватает топлива.</p>' : ''}
      <button class="btn hazard big" id="wGo" ${sq.length && fuelOk && !locked ? '' : 'disabled'}>Выдвигаться</button>`;
  },
  toggle(id) {
    Sfx.init(); Sfx.play('click');
    const k = S.squad.indexOf(id);
    if (k >= 0) S.squad.splice(k, 1);
    else if (S.squad.length < 4) S.squad.push(id);
    else { Game.toast('В отряде уже четверо'); return; }
    saveGame();
    this.render();
  },
  go() {
    Sfx.init();
    const k = this.sel, L = LOCS[k];
    if (!k || !S.squad.length || S.res.fuel < L.fuel || locLocked(k)) return;
    addLog(`Вылазка: ${L.name}. Отряд: ${S.squad.map(id => S.survivors.find(s => s.id === id).name).join(', ')}.`);
    startMission(k, S.squad.slice());
  },
  click(e) {
    const x = e.offsetX, y = e.offsetY;
    let best = null, bd = 26;
    for (const h of this.hit) { const d = Math.hypot(h.x - x, h.y - y); if (d < bd) { bd = d; best = h.k; } }
    if (best && best !== 'base') { Sfx.play('click'); this.sel = best; this.render(); }
  },
  draw() {
    const cv = this.cv;
    if (!cv || !cv.isConnected) return;
    const box = cv.parentElement, W = box.clientWidth, H = box.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    if (!W || !H) return;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sc = Math.min(W / 104, H / 66), ox = (W - 100 * sc) / 2, oy = (H - 62 * sc) / 2;
    const X = x => ox + x * sc, Y = y => oy + y * sc;
    const r = makeRng(S.seed);
    // бумага
    c.fillStyle = '#1c1d16'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#23251b'; c.fillRect(X(0), Y(0), 100 * sc, 62 * sc);
    // леса
    for (let k = 0; k < 70; k++) {
      const fx = r() * 100, fy = r() * 62;
      if (fy > 26 && fy < 40 && fx > 25 && fx < 85) continue;
      c.fillStyle = `rgba(${40 + r() * 12},${58 + r() * 14},${36 + r() * 8},${0.5 + r() * 0.3})`;
      for (let j = 0; j < 6; j++) { c.beginPath(); c.arc(X(fx + (r() - 0.5) * 7), Y(fy + (r() - 0.5) * 5), sc * (1.2 + r() * 2.2), 0, Math.PI * 2); c.fill(); }
    }
    // поля
    for (let k = 0; k < 12; k++) {
      const fx = r() * 90, fy = r() * 55, w = 4 + r() * 6, h = 3 + r() * 4;
      c.fillStyle = 'rgba(120,110,60,0.18)'; c.fillRect(X(fx), Y(fy), w * sc, h * sc);
      c.strokeStyle = 'rgba(120,110,60,0.25)'; c.lineWidth = 1;
      for (let j = 1; j < 4; j++) { c.beginPath(); c.moveTo(X(fx), Y(fy + (h * j) / 4)); c.lineTo(X(fx + w), Y(fy + (h * j) / 4)); c.stroke(); }
    }
    // город
    c.fillStyle = 'rgba(150,145,130,0.16)';
    for (let gx = 52; gx < 92; gx += 3.2) for (let gy = 24; gy < 46; gy += 3) if (r() < 0.72) c.fillRect(X(gx), Y(gy), sc * (1.6 + r() * 1.2), sc * (1.4 + r() * 1.1));
    // река
    const line = (pts, col, w, dash) => {
      c.strokeStyle = col; c.lineWidth = w; c.lineJoin = 'round'; c.lineCap = 'round'; c.setLineDash(dash || []);
      c.beginPath(); c.moveTo(X(pts[0][0]), Y(pts[0][1]));
      for (let k = 1; k < pts.length - 1; k++) { const mx = (pts[k][0] + pts[k + 1][0]) / 2, my = (pts[k][1] + pts[k + 1][1]) / 2; c.quadraticCurveTo(X(pts[k][0]), Y(pts[k][1]), X(mx), Y(my)); }
      const l = pts[pts.length - 1]; c.lineTo(X(l[0]), Y(l[1])); c.stroke(); c.setLineDash([]);
    };
    line(RIVER, '#2b3d45', sc * 2.4); line(RIVER, '#35505a', sc * 1.2);
    line(HIGHWAY, '#4a463a', sc * 1.2); line(HIGHWAY, 'rgba(214,180,80,0.5)', 1, [sc * 1.2, sc * 1.2]);
    // дороги к известным местам: каждая точка — к двум ближайшим
    const pts = [['base', BASE_POS], ...S.known.map(k => [k, LOCS[k].pos])];
    const edges = new Set();
    for (const [a, pa] of pts) {
      const near = pts.filter(q => q[0] !== a).sort((p1, p2) => pdist(pa, p1[1]) - pdist(pa, p2[1])).slice(0, 2);
      for (const [b] of near) edges.add([a, b].sort().join('|'));
    }
    const P = Object.fromEntries(pts);
    c.strokeStyle = '#5c5440'; c.lineWidth = Math.max(1.5, sc * 0.5); c.setLineDash([sc * 0.9, sc * 0.6]);
    for (const e of edges) { const [a, b] = e.split('|'); c.beginPath(); c.moveTo(X(P[a][0]), Y(P[a][1])); c.lineTo(X(P[b][0]), Y(P[b][1])); c.stroke(); }
    c.setLineDash([]);
    // туман: темно везде, кроме окрестностей известного
    const fog = document.createElement('canvas'); fog.width = cv.width; fog.height = cv.height;
    const f = fog.getContext('2d');
    f.setTransform(dpr, 0, 0, dpr, 0, 0);
    f.fillStyle = 'rgba(12,12,9,0.82)'; f.fillRect(0, 0, W, H);
    f.globalCompositeOperation = 'destination-out';
    for (const [, p] of pts) {
      const g = f.createRadialGradient(X(p[0]), Y(p[1]), 0, X(p[0]), Y(p[1]), sc * 13);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.55, 'rgba(0,0,0,0.85)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      f.fillStyle = g; f.fillRect(X(p[0]) - sc * 13, Y(p[1]) - sc * 13, sc * 26, sc * 26);
    }
    c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(fog, 0, 0); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    // метки
    this.hit = [];
    const fs = clamp(sc * 1.9, 10, 14);
    c.font = `500 ${fs}px Oswald, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'top';
    const label = (t, x, y, col) => { c.lineWidth = 3; c.strokeStyle = 'rgba(10,10,8,0.85)'; c.strokeText(t, x, y); c.fillStyle = col; c.fillText(t, x, y); };
    // база
    { const x = X(BASE_POS[0]), y = Y(BASE_POS[1]), s = Math.max(9, sc * 2);
      c.fillStyle = '#e8a62b'; c.strokeStyle = '#1b1406'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(x, y - s); c.lineTo(x + s, y); c.lineTo(x + s * 0.7, y); c.lineTo(x + s * 0.7, y + s * 0.8); c.lineTo(x - s * 0.7, y + s * 0.8); c.lineTo(x - s * 0.7, y); c.lineTo(x - s, y); c.closePath(); c.fill(); c.stroke();
      label('База', x, y + s, '#f0c46a'); this.hit.push({ k: 'base', x, y }); }
    for (const k of S.known) {
      const L = LOCS[k], x = X(L.pos[0]), y = Y(L.pos[1]), sel = k === this.sel, locked = locLocked(k);
      const s = Math.max(7, sc * 1.55);
      const F = L.faction && FACTIONS[L.faction], beaten = F && S.fac[L.faction].beaten;
      const dc = ['#86a85d', '#86a85d', '#c9a43a', '#d9813a', '#c9472f', '#a8322a'][L.danger];
      if (sel) { c.strokeStyle = '#e8a62b'; c.lineWidth = 2.5; c.beginPath(); c.arc(x, y, s + 6, 0, Math.PI * 2); c.stroke(); }
      if (L.camp) {
        c.fillStyle = beaten ? '#4a463a' : F.color; c.strokeStyle = '#0d0c09'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(x, y - s * 1.25); c.lineTo(x + s * 1.1, y); c.lineTo(x, y + s * 1.25); c.lineTo(x - s * 1.1, y); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = '#0d0c09'; c.fillRect(x - s * 0.15, y - s * 0.6, s * 0.3, s * 1.2);
      } else {
        c.fillStyle = locked ? '#3a372c' : '#1d1c16'; c.strokeStyle = locked ? '#5a5440' : dc; c.lineWidth = 2.5;
        c.beginPath(); c.arc(x, y, s, 0, Math.PI * 2); c.fill(); c.stroke();
        if (F && !beaten) { c.fillStyle = F.color; c.beginPath(); c.arc(x + s * 0.75, y - s * 0.75, s * 0.42, 0, Math.PI * 2); c.fill(); }
        c.fillStyle = locked ? '#5a5440' : dc; c.beginPath(); c.arc(x, y, s * 0.38, 0, Math.PI * 2); c.fill();
      }
      const v = S.visits[k] || 0;
      for (let j = 0; j < Math.min(4, v); j++) { c.fillStyle = '#a09781'; c.fillRect(x - s + j * (s * 0.55), y + s + 2, s * 0.4, 2); }
      label(L.short, x, y + s + (v ? 6 : 3), sel ? '#f0c46a' : locked ? '#746c58' : '#ece4cc');
      this.hit.push({ k, x, y });
    }
    // масштабная линейка и роза ветров
    c.fillStyle = '#746c58'; c.font = `500 ${clamp(sc * 1.5, 9, 12)}px Oswald, sans-serif`; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    c.fillText('С ↑', X(1.5), Y(4));
  },
};
