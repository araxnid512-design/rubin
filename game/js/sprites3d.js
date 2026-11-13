'use strict';
/* 3D-спрайты: кадры, запечённые из моделей Tripo (tools/art3d), в формате кадров отрисовки боя.
   Атласы — game/assets3d/*.webp, описание — DW.A3 (assets3d/meta.js). Тело человека и оружие — два слоя,
   склеиваются в один холст на кадр и кэшируются. Пока атлас не загружен, бой рисует процедурные фигуры. */
(function (DW) {
  const S3 = {};
  const A = function () { return DW.A3 && DW.A3.sets ? DW.A3.sets : null; };
  const imgs = {};      // setId → [Image] (страницы)
  const state = {};     // setId → 'loading' | 'ok' | 'err'
  const cache = new Map();
  let CAP = 360;

  S3.has = function (id) { const s = A(); return !!(s && s[id]); };
  S3.ready = function (id) { return state[id] === 'ok'; };
  const half = {};      // setId → true, если загружены половинные страницы
  S3.load = function (id) {
    const s = A();
    if (!s || !s[id] || state[id]) return;
    state[id] = 'loading';
    // низкая графика — половинные копии атласов (вчетверо меньше памяти)
    const useLo = s[id].lo && DW.gfxLevel && DW.gfxLevel() === 0;
    half[id] = !!useLo;
    const list = useLo ? s[id].lo : s[id].pages;
    let left = list.length;
    imgs[id] = list.map(function (f) {
      const im = new Image();
      im.onload = function () { if (--left === 0 && state[id] === 'loading') state[id] = 'ok'; };
      im.onerror = function () { state[id] = 'err'; };
      im.src = 'assets3d/' + f;
      return im;
    });
  };
  /* Масштаб хранения кадров по уровню графики: на слабых телефонах — меньше памяти */
  function keep() { const L = DW.gfxLevel ? DW.gfxLevel() : 2; return L === 0 ? 0.6 : (L === 1 ? 0.8 : 1); }
  S3.clear = function () { cache.clear(); CAP = [220, 300, 380][DW.gfxLevel ? DW.gfxLevel() : 2]; };

  function rect(id, anim, i, d) {
    const s = A()[id];
    const fr = s.frames[anim];
    if (!fr) return null;
    const dirs = s.dirs || 8;
    return fr[i * dirs + (dirs === 1 ? 0 : d)] || null;
  }
  S3.count = function (id, anim) { const s = A(); const a = s && s[id] && s[id].anims[anim]; return a ? a.n : 0; };

  /* Кадр в формате отрисовки: { c, sh, w, h, ox, oy } в точках мира. layers — [[setId, anim, i, d], …] */
  /* поправка положения ствола из «Мастерской оружия» для слоя оружия (w_… / fw_…) */
  function holdOf(set, anim) {
    if (!DW.WT) return null;
    const wid = set.indexOf('fw_') === 0 ? set.slice(3) : (set.indexOf('w_') === 0 ? set.slice(2) : null);
    return wid ? DW.WT.hold(wid, anim) : null;
  }
  S3.frame = function (layers, flip) {
    const key = layers.map(function (l) { return l.join(':'); }).join('|') + (flip ? 'F' : '') + (DW.WT && layers.length > 1 ? '#' + DW.WT.ver : '');
    const hit = cache.get(key);
    if (hit) { cache.delete(key); cache.set(key, hit); return hit; }
    const sets = A();
    let ss = 2, L = Infinity, T = Infinity, R = -Infinity, Bt = -Infinity;
    const parts = [];
    for (let k = 0; k < layers.length; k++) {
      const l = layers[k];
      if (!S3.ready(l[0])) { if (k === 0) return null; continue; }
      const r = rect(l[0], l[1], l[2], l[3]);
      if (!r) { if (k === 0) return null; continue; }
      ss = sets[l[0]].ss || 2;
      const ho = k > 0 && r.length >= 11 ? holdOf(l[0], l[1]) : null;
      parts.push({ im: imgs[l[0]][r[0]], r: r, h: half[l[0]] ? 0.5 : 1, ho: ho, ss: ss });
      if (ho) {
        const sg = r[7] >= r[9] ? 1 : -1;
        [[-r[5], -r[6]], [r[3] - r[5], -r[6]], [-r[5], r[4] - r[6]], [r[3] - r[5], r[4] - r[6]]].forEach(function (c) {
          const p = DW.WT.apply(ho, c[0], c[1], r[9], r[10], sg, ss);
          L = Math.min(L, p[0]); T = Math.min(T, p[1]); R = Math.max(R, p[0]); Bt = Math.max(Bt, p[1]);
        });
      } else { L = Math.min(L, -r[5]); T = Math.min(T, -r[6]); R = Math.max(R, r[3] - r[5]); Bt = Math.max(Bt, r[4] - r[6]); }
    }
    if (!parts.length) return null;
    const q = keep();
    const W = Math.max(1, Math.ceil((R - L) * q)), H = Math.max(1, Math.ceil((Bt - T) * q));
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    if (flip) { g.translate(W, 0); g.scale(-1, 1); }
    g.scale(q, q);
    parts.forEach(function (p) {
      const r = p.r, h = p.h, ho = p.ho;
      if (!ho) { g.drawImage(p.im, r[1] * h, r[2] * h, r[3] * h, r[4] * h, -r[5] - L, -r[6] - T, r[3], r[4]); return; }
      // ствол с поправкой: поворот и масштаб вокруг рукояти, сдвиг вперёд/вверх
      const sg = r[7] >= r[9] ? 1 : -1;
      g.save();
      g.translate(-L + r[9] + ho.x * sg * p.ss, -T + r[10] - ho.y * p.ss);
      g.rotate(-ho.r * sg * Math.PI / 180); g.scale(ho.s || 1, ho.s || 1);
      g.drawImage(p.im, r[1] * h, r[2] * h, r[3] * h, r[4] * h, -r[5] - r[9], -r[6] - r[10], r[3], r[4]);
      g.restore();
    });
    const sh = document.createElement('canvas'); sh.width = W; sh.height = H;
    const sg = sh.getContext('2d'); sg.drawImage(c, 0, 0); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = '#000'; sg.fillRect(0, 0, W, H);
    const k = 1 / ss;
    const out = { c: c, sh: sh, w: (R - L) * k, h: (Bt - T) * k, ox: (flip ? R : -L) * k, oy: -T * k, d3: true };
    cache.set(key, out);
    if (cache.size > CAP) cache.delete(cache.keys().next().value);
    return out;
  }

  /* Дуло оружия в кадре (точки мира от стоп), [dx, dy] или null */
  S3.muzzleAt = function (wset, anim, i, d) {
    if (!S3.ready(wset)) return null;
    const r = rect(wset, anim, i, d);
    if (!r || r.length < 9) return null;
    const ss = A()[wset].ss || 2, k = 1 / ss;
    const ho = r.length >= 11 ? holdOf(wset, anim) : null;
    if (ho) { const p = DW.WT.apply(ho, r[7], r[8], r[9], r[10], r[7] >= r[9] ? 1 : -1, ss); return [p[0] * k, p[1] * k]; }
    return [r[7] * k, r[8] * k];
  };

  /* ---------- Кто чем нарисован ---------- */
  // у бандитов несколько моделей — каждому своя по номеру
  const ENEMY_BODY = { raider: ['b_mur1', 'b_bandit3', 'b_bandit4'], thug: ['b_mur2', 'b_bandit5'], marksman: ['b_marksman'], boss: ['b_boss'] };
  const NAME_BODY = { 'Крут': 'b_krut', 'Мальборо': 'b_marlboro', 'Сыч': 'b_pris1', 'Тихий': 'b_pris1', 'Док': 'b_pris2', 'Бугай': 'b_pris2' };
  const ARMOR_BODY = { vest: 'b_vest', heavy: 'b_heavy', exo: 'b_exo' };
  function first(list) { for (let i = 0; i < list.length; i++) if (list[i] && S3.has(list[i])) return list[i]; return null; }
  // новобранцы: своя внешность по номеру бойца (из тех моделей, что есть в сборке)
  const RECRUIT = ['b_pris1', 'b_pris2', 'b_pris3', 'b_pris4', 'b_pris5', 'b_pris6'];
  function recruitBody(id) {
    const L = RECRUIT.filter(function (b) { return S3.has(b); });
    return L.length ? L[(id || 0) % L.length] : null;
  }
  /* набор тела и оружия для бойца/врага: { body, weapon, kind: 'human'|'creature'|'turret' } */
  S3.setsFor = function (u) {
    if (!A()) return null;
    if (u.kind === 'turret') return S3.has('p_turret') ? { body: 'p_turret', kind: 'turret' } : null;
    if (u.kind === 'soldier') {
      const nm = u.name || '';
      const rb = recruitBody(u.sid !== undefined ? u.sid : u.id);
      const base = (u.armorId && ARMOR_BODY[u.armorId]) || NAME_BODY[nm.split(' ')[0]] || rb;
      const body = first([base, NAME_BODY[nm.split(' ')[0]], rb, 'b_krut']);
      if (!body) return null;
      return { body: body, weapon: first(['w_' + (u.weapon || 'ppsh'), 'w_ak']), kind: 'human' };
    }
    if (ENEMY_BODY[u.type]) {
      const L = ENEMY_BODY[u.type];
      const body = first([L[(u.id || 0) % L.length], L[0], 'b_mur1']);
      const T = DW.D.ENEMIES[u.type];
      return body ? { body: body, weapon: first(['w_' + (u.weapon || (T && T.weapon) || 'ak'), 'w_ak']), kind: 'human' } : null;
    }
    // вторая порода Падальщиков — через одного
    if (u.type === 'scav' && (u.id || 0) % 2 && S3.has('c_scav2')) return { body: 'c_scav2', kind: 'creature' };
    if (S3.has('c_' + u.type)) return { body: 'c_' + u.type, kind: 'creature' };
    return null;
  };
  /* загрузить всё нужное для боя */
  S3.preload = function (B) {
    if (!A() || !B) return;
    S3.clear();
    B.units.forEach(function (u) { const s = S3.setsFor(u); if (s) { S3.load(s.body); if (s.weapon) S3.load(s.weapon); if (u.kind === 'soldier') S3.load('h_' + s.body.slice(2)); } });
    for (const id in A()) if (id.indexOf('p_') === 0 && id !== 'p_base') S3.load(id);
    if (B.units.some(function (u) { return u.cls === 'heavy'; })) S3.load('w_rpg');
  };

  /* Крупная фигура бойца для экрана отряда: холст или null (пока атласы не загружены) */
  S3.figure = function (s) {
    const S = S3.setsFor({ kind: 'soldier', name: s.name, armorId: s.armor, weapon: s.weapon, id: s.id });
    if (!S) return null;
    const fb = 'f_' + S.body.slice(2), fw = 'f' + (S.weapon || 'w_ak');
    S3.load(fb); S3.load(fw);
    if (!S3.ready(fb)) return null;
    const L = [[fb, 'pose', 0, 0]];
    if (S3.ready(fw)) L.push([fw, 'pose', 0, 0]);
    const f = S3.frame(L);
    if (!f) return null;
    const c = document.createElement('canvas'); c.width = f.c.width; c.height = f.c.height;
    c.getContext('2d').drawImage(f.c, 0, 0);
    return c;
  };
  /* 3D-портрет бойца: холст снимка головы или null */
  S3.head = function (s) {
    if (S3.noHeads) return null;
    const S = S3.setsFor({ kind: 'soldier', name: s.name, armorId: s.armor, weapon: s.weapon, id: s.id });
    if (!S) return null;
    const id = 'h_' + S.body.slice(2);
    if (!S3.has(id)) return null;
    S3.load(id);
    if (!S3.ready(id)) return null;
    const f = S3.frame([[id, 'v', 0, 0]]);
    return f ? f.c : null;
  };
  /* Кадр врага для портрета: стойка лицом к камере (направление 1) */
  S3.enemyShot = function (type) {
    const S = S3.setsFor({ side: 'e', kind: 'enemy', type: type, id: 0 });
    if (!S || !S3.ready(S.body)) return null;
    const anim = S3.count(S.body, 'idle') ? 'idle' : 'walk';
    const L = [[S.body, anim, 0, 1]];
    if (S.weapon && S3.ready(S.weapon) && S3.count(S.weapon, anim)) L.push([S.weapon, anim, 0, 1]);
    return S3.frame(L);
  };
  /* заранее — фигуры и портреты отряда (маленькие файлы) */
  S3.preloadFigures = function (roster) {
    if (!A()) return;
    (roster || []).forEach(function (s) { const S = S3.setsFor({ kind: 'soldier', name: s.name, armorId: s.armor, weapon: s.weapon, id: s.id }); if (S) { S3.load('f_' + S.body.slice(2)); S3.load('h_' + S.body.slice(2)); if (S.weapon) S3.load('f' + S.weapon); } });
  };

  /* направление клетки (0..7, шаг 45°) по углу взгляда юнита */
  S3.dir8 = function (face) {
    const f = face === undefined ? Math.PI : face;
    let d = Math.round(f / (Math.PI / 4)) % 8;
    if (d < 0) d += 8;
    return d;
  };

  DW.S3 = S3;
})(window.DW);
