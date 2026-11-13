'use strict';
/* Настройки стволов: положение в руках (поправка к 3D-слою оружия), стрельба (очередь, вспышка, трассер, гильзы,
   отдача, тряска) и голос выстрела (синтез). Значения по умолчанию — здесь; правки игрока из «Мастерской оружия»
   хранятся в localStorage и накладываются поверх. */
(function (DW) {
  const WT = {};
  const KEY = 'deadworld_wt';
  WT.ver = 1;  // растёт при каждой правке — сбрасывает кэш кадров

  // группы движений: «переноска» и «стрельба»
  const GROUP = {
    idle: 'carry', walk: 'carry', run: 'carry', reload: 'carry', hit: 'carry', crouch: 'carry', hunker: 'carry', duck: 'carry', pose: 'carry',
    aim: 'aim', shoot: 'aim', crouchAim: 'aim', peek: 'aim', kneel: 'aim', watch: 'aim'
  };
  WT.group = function (anim) { return GROUP[anim] || null; };

  const H0 = function () { return { carry: { x: 0, y: 0, r: 0, s: 1 }, aim: { x: 0, y: 0, r: 0, s: 1 } }; };
  // fire: n — выстрелов в очереди, gap — темп (мс), flash — размер вспышки, flife — длительность вспышки,
  // tw — толщина трассера, tlife — время трассера, tr — цвет трассера, cas — цвет гильз, casS — размер гильз,
  // eject — сила выброса гильз, smoke — дым, ring — кольцо дыма, kick — отдача (точки), shake — тряска экрана,
  // spread — разброс при промахе, fk — вид вспышки
  // snd: vol, pitch, crack (щелчок), body/bodyF/bodyD (корпус), thump/thumpF/thumpD (удар), tail/tailD (хвост),
  // echo (эхо), dist (хрип), mech/mechD (затвор после выстрела, мс), jit (разброс тона по выстрелам)
  WT.DEF = {
    ppsh: { fire: { n: 7, gap: 46, flash: 11, flife: 45, tw: 1.5, tlife: 90, tr: '#ffd27a', cas: '#c89a40', casS: 2, eject: 1, smoke: 3, ring: 0, kick: 1.2, shake: 1, spread: 1, fk: 'smg' },
      snd: { vol: 0.8, pitch: 1.15, crack: 0.5, body: 0.7, bodyF: 1700, bodyD: 0.06, thump: 0.35, thumpF: 150, thumpD: 0.05, tail: 0.25, tailD: 0.25, echo: 0.35, dist: 0.3, mech: 0, mechD: 0, jit: 0.06 } },
    ak: { fire: { n: 3, gap: 95, flash: 15, flife: 65, tw: 2, tlife: 115, tr: '#ffe08a', cas: '#e0b848', casS: 2.4, eject: 1, smoke: 4, ring: 0, kick: 2, shake: 1.5, spread: 1, fk: 'std' },
      snd: { vol: 0.9, pitch: 1, crack: 0.7, body: 0.8, bodyF: 1300, bodyD: 0.09, thump: 0.5, thumpF: 120, thumpD: 0.08, tail: 0.4, tailD: 0.4, echo: 0.45, dist: 0.35, mech: 0, mechD: 0, jit: 0.04 } },
    ak2: { fire: { n: 3, gap: 80, flash: 14, flife: 60, tw: 2, tlife: 115, tr: '#fff0b0', cas: '#e0b848', casS: 2.2, eject: 1, smoke: 4, ring: 0, kick: 1.7, shake: 1.3, spread: 1, fk: 'std' },
      snd: { vol: 0.9, pitch: 1.1, crack: 0.8, body: 0.75, bodyF: 1600, bodyD: 0.08, thump: 0.45, thumpF: 130, thumpD: 0.07, tail: 0.35, tailD: 0.35, echo: 0.45, dist: 0.3, mech: 0, mechD: 0, jit: 0.04 } },
    shotgun: { fire: { n: 1, gap: 90, flash: 22, flife: 110, tw: 1.6, tlife: 115, tr: '#ffe08a', cas: '#b8302a', casS: 2.8, eject: 0.8, smoke: 6, ring: 0, kick: 3.4, shake: 3, spread: 1.2, fk: 'wide' },
      snd: { vol: 1, pitch: 0.8, crack: 0.5, body: 1, bodyF: 650, bodyD: 0.18, thump: 0.9, thumpF: 90, thumpD: 0.18, tail: 0.7, tailD: 0.7, echo: 0.6, dist: 0.4, mech: 0.8, mechD: 380, jit: 0 } },
    sniper: { fire: { n: 1, gap: 90, flash: 22, flife: 110, tw: 3, tlife: 160, tr: '#fff6d8', cas: '#e0b848', casS: 2.6, eject: 0.7, smoke: 5, ring: 1, kick: 3, shake: 2.5, spread: 0.8, fk: 'long' },
      snd: { vol: 1, pitch: 1, crack: 1, body: 0.8, bodyF: 2200, bodyD: 0.12, thump: 0.6, thumpF: 110, thumpD: 0.12, tail: 0.7, tailD: 0.9, echo: 0.7, dist: 0.3, mech: 0.6, mechD: 450, jit: 0 } },
    hsniper: { fire: { n: 1, gap: 90, flash: 30, flife: 130, tw: 4, tlife: 190, tr: '#fffbe8', cas: '#d8a840', casS: 3.2, eject: 0.6, smoke: 7, ring: 1, kick: 4.2, shake: 4, spread: 0.8, fk: 'long' },
      snd: { vol: 1.1, pitch: 0.7, crack: 1, body: 1, bodyF: 900, bodyD: 0.22, thump: 1, thumpF: 70, thumpD: 0.3, tail: 1, tailD: 1.2, echo: 0.8, dist: 0.5, mech: 0.7, mechD: 600, jit: 0 } },
    lmg: { fire: { n: 6, gap: 68, flash: 17, flife: 60, tw: 2.2, tlife: 115, tr: '#ffcf6a', cas: '#e0b848', casS: 2.4, eject: 1.1, smoke: 5, ring: 0, kick: 1.6, shake: 1.6, spread: 1.1, fk: 'smg' },
      snd: { vol: 0.9, pitch: 0.9, crack: 0.6, body: 0.85, bodyF: 1000, bodyD: 0.1, thump: 0.6, thumpF: 110, thumpD: 0.09, tail: 0.45, tailD: 0.45, echo: 0.5, dist: 0.4, mech: 0, mechD: 0, jit: 0.05 } },
    hlmg: { fire: { n: 5, gap: 85, flash: 24, flife: 80, tw: 3, tlife: 115, tr: '#ffc050', cas: '#d8a840', casS: 3, eject: 1.1, smoke: 6, ring: 0, kick: 2.2, shake: 2.6, spread: 1.1, fk: 'std' },
      snd: { vol: 1.05, pitch: 0.7, crack: 0.7, body: 1, bodyF: 650, bodyD: 0.14, thump: 0.9, thumpF: 75, thumpD: 0.14, tail: 0.7, tailD: 0.7, echo: 0.6, dist: 0.5, mech: 0, mechD: 0, jit: 0.04 } }
  };
  // общая физика боя
  WT.PHYS0 = { casBounce: 0.32, casFric: 0.5, casGrav: 420, knock: 3, tink: 0.5, echoOut: 0.25, echoIn: 0.9 };
  for (const k in WT.DEF) WT.DEF[k].hold = H0();
  // устройство перезарядки
  WT.RK = { ppsh: 'drum', ak: 'mag', ak2: 'mag', lmg: 'box', hlmg: 'box', sniper: 'bolt', hsniper: 'bolt', shotgun: 'pump' };
  WT.ORDER = ['ppsh', 'ak', 'ak2', 'shotgun', 'sniper', 'hsniper', 'lmg', 'hlmg'];

  let user = {};
  try { user = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { user = {}; }

  function merge(a, b) {
    if (!b || typeof b !== 'object') return a;
    const o = Array.isArray(a) ? a.slice() : Object.assign({}, a);
    for (const k in b) o[k] = a && typeof a[k] === 'object' && a[k] !== null && !Array.isArray(a[k]) ? merge(a[k], b[k]) : b[k];
    return o;
  }
  const cache = {};
  WT.get = function (id) {
    if (cache[id]) return cache[id];
    const d = WT.DEF[id] || WT.DEF.ak;
    return (cache[id] = merge(d, user[id]));
  };
  WT.phys = function () { return cache._phys || (cache._phys = merge(WT.PHYS0, user._phys)); };
  WT.has = function (id) { return !!WT.DEF[id]; };
  /* поправка положения ствола для движения: { x, y, r, s } или null, если нулевая */
  WT.hold = function (id, anim) {
    const g = GROUP[anim];
    if (!g || !WT.DEF[id]) return null;
    const h = WT.get(id).hold[g];
    return h && (h.x || h.y || h.r || (h.s && h.s !== 1)) ? h : null;
  };
  function save() { try { localStorage.setItem(KEY, JSON.stringify(user)); } catch (e) { /* ignore */ } }
  /* правка: путь вида 'hold.carry.x', 'fire.n', 'snd.pitch' */
  WT.set = function (id, path, v) {
    const P = path.split('.');
    let o = user[id] = user[id] || {};
    for (let i = 0; i < P.length - 1; i++) o = o[P[i]] = o[P[i]] || {};
    o[P[P.length - 1]] = v;
    delete cache[id]; delete cache._phys;
    WT.ver++;
    save();
  };
  WT.reset = function (id) { if (id) delete user[id]; else user = {}; for (const k in cache) delete cache[k]; WT.ver++; save(); };
  WT.changed = function (id) { return !!(user[id] && Object.keys(user[id]).length); };
  WT.export = function () { return JSON.stringify(user, null, 1); };
  WT.import = function (txt) {
    const o = JSON.parse(txt);
    if (!o || typeof o !== 'object') throw new Error('не JSON');
    user = o; for (const k in cache) delete cache[k]; WT.ver++; save();
  };

  /* Перенос 2D-поправки на точку кадра: поворот вокруг рукояти (gx, gy), сдвиг вперёд/вверх.
     sgn — куда смотрит ствол на экране (1 — вправо, −1 — влево), чтобы «ствол выше» значило одно и то же */
  WT.apply = function (h, x, y, gx, gy, sgn, ss) {
    const a = -h.r * sgn * Math.PI / 180, s = h.s || 1;
    const dx = (x - gx) * s, dy = (y - gy) * s;
    return [gx + dx * Math.cos(a) - dy * Math.sin(a) + h.x * sgn * ss, gy + dx * Math.sin(a) + dy * Math.cos(a) - h.y * ss];
  };

  DW.WT = WT;
})(window.DW);
