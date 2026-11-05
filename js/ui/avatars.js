/*
 * Аватарки: портреты бойцов, дроидов, наёмников и персонажей событий.
 * Каждый портрет собирается из частей (лицо, кожа, причёска, глаза, шрамы…) детерминированно
 * по номеру бойца — у каждого своё лицо. Все персонажи оригинальные.
 * Avatar.img(unit, size) → <img>; Avatar.npc(key, size) → <img>
 */
(function (G) {
  'use strict';
  const { h } = G.Dom;

  const A = {};
  const SKIN = ['#f3d2b3', '#e9bc96', '#d5a07a', '#bb8458', '#94603f', '#6e432b', '#4f2f1e'];
  const HAIR = ['#1b1714', '#3a2617', '#5e3b1f', '#8a5a2b', '#b9884a', '#d8b46a', '#7a7a7a', '#a33b1f'];
  const FEMALE = new Set(['Нира', 'Талла', 'Вейра', 'Кесса', 'Илса', 'Рена', 'Ориса', 'Дейна', 'Сарен', 'Мейра', 'Лисса', 'Тейла', 'Вента', 'Адра']);

  function rngFrom(str) {
    const r = G.Rng.make(G.Rng.hashString(String(str)));
    return { f: () => r.float(), i: (a, b) => r.int(a, b), pick: (arr) => r.pick(arr) };
  }

  const cache = new Map();
  function toImg(svg, size, cls, title) {
    let url = cache.get(svg);
    if (!url) {
      url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      if (cache.size > 400) cache.clear();
      cache.set(svg, url);
    }
    return h('img', { class: 'ava ' + (cls || ''), src: url, width: size, height: size, alt: title || '', title: title || '', draggable: 'false' });
  }
  const wrap = (bg, body) => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
    '<defs><clipPath id="c"><circle cx="32" cy="32" r="31"/></clipPath>' +
    '<radialGradient id="g" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="' + bg[0] + '"/><stop offset="1" stop-color="' + bg[1] + '"/></radialGradient></defs>' +
    '<g clip-path="url(#c)"><rect width="64" height="64" fill="url(#g)"/>' + body + '</g>' +
    '<circle cx="32" cy="32" r="31" fill="none" stroke="' + (bg[2] || '#d9a85b') + '" stroke-width="2"/></svg>';

  // ---------- лицо человека ----------
  function face(r, o) {
    const skin = o.skin || r.pick(SKIN);
    const hair = o.hair || r.pick(HAIR);
    const fem = !!o.female;
    let s = '';
    // шея
    s += '<rect x="26" y="40" width="12" height="12" fill="' + skin + '"/><rect x="26" y="46" width="12" height="4" fill="rgba(0,0,0,0.15)"/>';
    // волосы сзади (для длинных причёсок)
    const style = o.hairStyle != null ? o.hairStyle : fem ? r.pick(['bun', 'tail', 'bob', 'short']) : r.pick(['buzz', 'crew', 'side', 'bald', 'crew', 'side']);
    if (style === 'bob') s += '<path d="M19 30 Q18 14 32 13 Q46 14 45 30 L46 42 Q40 44 38 40 L26 40 Q24 44 18 42 Z" fill="' + hair + '"/>';
    if (style === 'tail') s += '<path d="M42 22 Q52 28 47 44 Q44 38 41 30 Z" fill="' + hair + '"/>';
    if (style === 'bun') s += '<circle cx="32" cy="13" r="5.5" fill="' + hair + '"/>';
    // уши и лицо
    s += '<ellipse cx="20.5" cy="31" rx="2.6" ry="3.6" fill="' + skin + '"/><ellipse cx="43.5" cy="31" rx="2.6" ry="3.6" fill="' + skin + '"/>';
    const jaw = fem ? 12 : r.i(12, 14);
    s += '<path d="M21 27 Q21 16 32 16 Q43 16 43 27 L43 32 Q43 ' + (38 + (jaw - 12)) + ' 32 ' + (42 + (jaw - 12)) + ' Q21 ' + (38 + (jaw - 12)) + ' 21 32 Z" fill="' + skin + '"/>';
    if (!fem && r.f() < 0.4) s += '<path d="M22 33 Q23 41 32 43 Q41 41 42 33 Q37 38 32 38 Q27 38 22 33 Z" fill="rgba(40,30,25,0.22)"/>'; // щетина
    // причёска сверху
    if (style === 'buzz') s += '<path d="M21 25 Q21 15 32 15 Q43 15 43 25 Q38 20 32 20 Q26 20 21 25 Z" fill="' + hair + '" opacity="0.85"/>';
    if (style === 'crew' || style === 'short') s += '<path d="M20 26 Q19 12 32 12.5 Q45 12 44 26 Q42 19 32 19 Q24 19 20 26 Z" fill="' + hair + '"/>';
    if (style === 'side') s += '<path d="M20 27 Q18 12 33 12 Q46 13 44 25 Q38 17 28 20 Q23 21 20 27 Z" fill="' + hair + '"/>';
    if (style === 'bun' || style === 'tail' || style === 'bob') s += '<path d="M20 27 Q19 13 32 13 Q45 13 44 27 Q40 19 32 19.5 Q24 19 20 27 Z" fill="' + hair + '"/>';
    // глаза и брови
    const eyeY = 29 + r.i(-1, 1);
    const eyeCol = r.pick(['#2a1d14', '#2d3d5a', '#3a4a2a', '#1a1a1a']);
    s += '<ellipse cx="27" cy="' + eyeY + '" rx="1.9" ry="1.5" fill="#fff"/><ellipse cx="37" cy="' + eyeY + '" rx="1.9" ry="1.5" fill="#fff"/>';
    s += '<circle cx="27.3" cy="' + eyeY + '" r="1.1" fill="' + eyeCol + '"/><circle cx="37.3" cy="' + eyeY + '" r="1.1" fill="' + eyeCol + '"/>';
    const tilt = r.pick([0, 0.8, -0.6, 1.4]);
    const brow = o.grey ? '#9a9a9a' : hair;
    s += '<path d="M24 ' + (eyeY - 3.5 + tilt) + ' L30 ' + (eyeY - 3.6) + '" stroke="' + brow + '" stroke-width="1.6" stroke-linecap="round"/>';
    s += '<path d="M34 ' + (eyeY - 3.6) + ' L40 ' + (eyeY - 3.5 + tilt) + '" stroke="' + brow + '" stroke-width="1.6" stroke-linecap="round"/>';
    // нос и рот
    s += '<path d="M32 30 Q30.5 34 32.5 35" stroke="rgba(0,0,0,0.3)" stroke-width="1.1" fill="none"/>';
    const mouth = o.mouth || r.pick(['flat', 'flat', 'frown', 'smirk']);
    if (mouth === 'flat') s += '<path d="M28.5 38 L35.5 38" stroke="#6b3a2c" stroke-width="1.3" stroke-linecap="round"/>';
    if (mouth === 'frown') s += '<path d="M28.5 38.8 Q32 36.8 35.5 38.8" stroke="#6b3a2c" stroke-width="1.3" fill="none" stroke-linecap="round"/>';
    if (mouth === 'smirk') s += '<path d="M28.5 38 Q33 39.5 35.8 37" stroke="#6b3a2c" stroke-width="1.3" fill="none" stroke-linecap="round"/>';
    if (o.moustache) s += '<path d="M27 36 Q32 33.5 37 36 Q32 35 27 36 Z" fill="' + brow + '" stroke="' + brow + '" stroke-width="1.2"/>';
    if (o.scar || (!o.noScar && r.f() < 0.18)) s += '<path d="M37 24 L41 33" stroke="#a8604a" stroke-width="1.2" opacity="0.8"/>';
    return s;
  }

  // ---------- плечи в броне ----------
  function armorShoulders(o) {
    const pad = o.rank >= 4 ? '#b8322a' : o.rank >= 2 ? '#2a2e35' : '#e9ecef';
    let s = '<path d="M4 64 Q6 50 20 47 L26 46 L38 46 L44 47 Q58 50 60 64 Z" fill="' + (o.armor || '#eef0f2') + '" stroke="#2a2e35" stroke-width="1"/>';
    s += '<path d="M26 46 L38 46 L36 52 L28 52 Z" fill="#1d2228"/>';
    s += '<path d="M6 60 Q8 50 18 48 L20 56 Z" fill="' + pad + '" stroke="#2a2e35" stroke-width="0.8"/>';
    s += '<path d="M24 56 L40 56" stroke="rgba(40,45,52,0.45)" stroke-width="1"/>';
    for (let k = 0; k < (o.rank || 0); k++) s += '<rect x="' + (44 + (k % 3) * 4) + '" y="' + (53 + Math.floor(k / 3) * 4) + '" width="3" height="3" fill="' + (o.rank >= 4 ? '#d9a85b' : '#3a3f46') + '"/>';
    return s;
  }

  const SPEC_BADGE = {
    sand: '<path d="M-5 1 Q-2 -3 1 0 T 6 0" stroke="#3a2c14" stroke-width="1.6" fill="none"/>',
    scout: '<path d="M-4 -3 L2 0 L-4 3" stroke="#14303a" stroke-width="1.8" fill="none"/>',
    heavy: '<rect x="-4.5" y="-2.2" width="9" height="4.4" fill="#2a2e35"/>',
    sniper: '<circle r="3.6" fill="none" stroke="#1f2a1a" stroke-width="1.2"/><path d="M-5 0 H5 M0 -5 V5" stroke="#1f2a1a" stroke-width="1"/>',
    medic: '<path d="M-1.4 -4.5 H1.4 V-1.4 H4.5 V1.4 H1.4 V4.5 H-1.4 V1.4 H-4.5 V-1.4 H-1.4 Z" fill="#c0392b"/>',
  };
  const SPEC_BG = { sand: ['#5a4a2c', '#2a2217'], scout: ['#2b4a52', '#14262b'], heavy: ['#4a4436', '#211e17'], sniper: ['#3c4a35', '#1a2116'], medic: ['#55303a', '#24151a'] };

  function bandage(level) {
    let s = '<path d="M20 22 Q32 18 44 22 L44 26 Q32 22 20 26 Z" fill="#f1ede4" stroke="#c9c2b2" stroke-width="0.6"/>';
    s += '<circle cx="38" cy="23" r="1.6" fill="#b8322a" opacity="0.85"/>';
    if (level >= 2) s += '<rect x="0" y="0" width="64" height="64" fill="rgba(160,170,190,0.18)"/><path d="M36 33 L41 36" stroke="#f1ede4" stroke-width="3"/>';
    return s;
  }

  // ---------- шлем штурмовика (стилизованный: не копия шлема из фильмов) ----------
  const STRIPES = [null, null, '#3d6fb6', '#c0392b', '#d9822b', '#3f8f5a', '#7a5bb0', '#1d2228'];
  function helmet(r, o) {
    const shell = o.shell || '#eef0f2';
    const line = '#2a2e35';
    let s = '';
    if (o.hood) s += '<path d="M10 64 Q8 30 18 18 Q32 6 46 18 Q56 30 54 64 Z" fill="' + o.hood + '"/>';
    // уши-диски и купол
    s += '<circle cx="15.5" cy="33" r="3.2" fill="' + shell + '" stroke="' + line + '" stroke-width="0.9"/><circle cx="48.5" cy="33" r="3.2" fill="' + shell + '" stroke="' + line + '" stroke-width="0.9"/>';
    s += '<path d="M16 31 Q15 10 32 9 Q49 10 48 31 L49 38 Q47 45 41 47.5 L23 47.5 Q17 45 15 38 Z" fill="' + shell + '" stroke="' + line + '" stroke-width="1.2"/>';
    s += '<path d="M17.5 23.5 Q32 18.5 46.5 23.5" stroke="rgba(40,45,52,0.35)" stroke-width="1.1" fill="none"/>';
    if (o.stripe) s += '<path d="M29 9.6 Q32 9.3 35 9.6 L34.4 19.5 L29.6 19.5 Z" fill="' + o.stripe + '"/>';
    if (o.cross) s += '<path d="M30.6 11 H33.4 V13.6 H36 V16.4 H33.4 V19 H30.6 V16.4 H28 V13.6 H30.6 Z" fill="#c0392b"/>';
    // визор
    if (o.longVisor) {
      s += '<path d="M18 24.5 L46 24.5 L44 31.5 L20 31.5 Z" fill="#14171b"/><path d="M21 26 L31 26" stroke="rgba(150,190,255,0.45)" stroke-width="1"/>';
      if (o.antenna) s += '<path d="M46 20 L51 9" stroke="' + line + '" stroke-width="1.1"/><circle cx="51" cy="9" r="1.1" fill="#c0392b"/>';
    } else {
      s += '<path d="M19 25.2 Q24 23 29.2 26 L28.2 31.6 Q23 32.6 18.8 29.4 Z" fill="#14171b"/>';
      s += '<path d="M45 25.2 Q40 23 34.8 26 L35.8 31.6 Q41 32.6 45.2 29.4 Z" fill="#14171b"/>';
      s += '<path d="M21 26 L25.5 25.4" stroke="rgba(150,190,255,0.5)" stroke-width="0.9"/><path d="M38.5 25.4 L43 26" stroke="rgba(150,190,255,0.5)" stroke-width="0.9"/>';
      s += '<path d="M30.4 26.2 L33.6 26.2 L33.2 35.5 L30.8 35.5 Z" fill="' + shade(shell) + '"/>';
    }
    // дыхательный фильтр и трубки
    s += '<path d="M25.5 38 L38.5 38 L36.4 44.6 L27.6 44.6 Z" fill="#2a2e35"/>';
    for (const x of [29, 31, 33, 35]) s += '<path d="M' + x + ' 39.3 L' + x + ' 43.4" stroke="#8a9097" stroke-width="0.8"/>';
    s += '<path d="M18.5 35.5 L23.4 36.8 L22.6 41.2 L18 39.8 Z" fill="#3a3f46"/><path d="M45.5 35.5 L40.6 36.8 L41.4 41.2 L46 39.8 Z" fill="#3a3f46"/>';
    s += '<path d="M19.2 37.2 L22.6 38.1 M19 38.8 L22.3 39.7 M44.8 37.2 L41.4 38.1 M45 38.8 L41.7 39.7" stroke="#8a9097" stroke-width="0.6"/>';
    // потёртости, пыль и царапины — у каждого свои
    const dirt = o.dirt != null ? o.dirt : r.f() * 0.5;
    for (let k = 0; k < 3; k++) {
      const x = 18 + r.f() * 28, y = 12 + r.f() * 30;
      s += '<ellipse cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" rx="' + (2 + r.f() * 4).toFixed(1) + '" ry="' + (1 + r.f() * 2).toFixed(1) + '" fill="rgba(150,115,70,' + (dirt * 0.35).toFixed(2) + ')"/>';
    }
    if (r.f() < 0.45) { const x = 20 + r.f() * 20, y = 14 + r.f() * 8; s += '<path d="M' + x.toFixed(1) + ' ' + y.toFixed(1) + ' l4 3 l-1 2" stroke="rgba(40,45,52,0.45)" stroke-width="0.7" fill="none"/>'; }
    return s;
  }
  function shade(hex) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.max(0, Math.round(v * 0.86));
    return 'rgb(' + f((n >> 16) & 255) + ',' + f((n >> 8) & 255) + ',' + f(n & 255) + ')';
  }
  function helmetDamage(level) {
    // лёгкое ранение — треснувшая линза, тяжёлое — ещё и повязка поверх шлема
    let s = '<path d="M21 26.5 L24 28.5 L22.5 30.6 M24 28.5 L27 27.6" stroke="#e8edf2" stroke-width="0.7" fill="none"/>';
    s += '<path d="M40 14 l2 4 l-2 3" stroke="rgba(40,45,52,0.6)" stroke-width="0.8" fill="none"/>';
    if (level >= 2) {
      s += '<path d="M15 17 Q32 10 49 17 L49 21.5 Q32 14.5 15 21.5 Z" fill="#f1ede4" stroke="#c9c2b2" stroke-width="0.6"/><circle cx="40" cy="16.6" r="1.7" fill="#b8322a" opacity="0.85"/>';
      s += '<rect x="0" y="0" width="64" height="64" fill="rgba(150,160,180,0.15)"/>';
    }
    return s;
  }
  function officerUniform(rank) {
    let s = '<path d="M4 64 Q6 50 20 47 L44 47 Q58 50 60 64 Z" fill="#59606a" stroke="#2a2e35"/><path d="M24 46 L40 46 L38 52 L26 52 Z" fill="#4a5058"/>';
    s += '<rect x="40" y="52" width="12" height="5" fill="#2a2e35"/>';
    const cols = rank >= 5 ? ['#d9a85b', '#e2574c', '#6fb3e0', '#7cc287'] : ['#e2574c', '#6fb3e0', '#7cc287'];
    cols.forEach((c, k) => { s += '<rect x="' + (41 + k * 2.6) + '" y="53" width="1.8" height="3" fill="' + c + '"/>'; });
    return s;
  }
  function officerCap() {
    return '<path d="M17 21 Q32 9 47 21 L47 24 L17 24 Z" fill="#3f454d" stroke="#1d2125"/><path d="M15.5 24 H48.5 L51 27 H13 Z" fill="#1d2125"/><rect x="29.5" y="15.5" width="5" height="3.6" rx="0.6" fill="#b9bec5"/>';
  }

  // ================= ПОРТРЕТ БОЙЦА =================
  A.unitSvg = function (u) {
    const r = rngFrom(u.num + '|' + u.name + '|' + u.id);
    const alive = G.Units.isAlive(u);
    const wound = u.kind === 'droid' ? 0 : G.Units.woundLevel(u);
    if (u.kind === 'droid') return droidSvg(r, u.health);
    if (u.kind === 'merc') return mercSvg(r, u.num);
    const rank = G.Units.rankIndex(u);
    const bg = u.spec ? SPEC_BG[u.spec] : rank >= 4 ? ['#5a3434', '#241414'] : ['#36414f', '#161b22'];
    const first = String(u.name || '').split(' ')[0];
    let body;
    if (rank >= 4 && !u.spec) {
      // офицеры — без шлема, в фуражке
      body = officerUniform(rank) + face(r, { female: FEMALE.has(first), hairStyle: FEMALE.has(first) ? 'bun' : 'side', mouth: 'flat' }) + officerCap();
      if (alive && wound) body += bandage(wound);
    } else {
      const sand = u.spec === 'sand', sniper = u.spec === 'sniper', scout = u.spec === 'scout';
      body = armorShoulders({ rank: rank, armor: sand ? '#e6dcc6' : sniper ? '#c3c8cc' : '#eef0f2' });
      if (sand) body += '<path d="M44 48 Q56 50 58 64 L46 64 Z" fill="#d9822b"/>';
      body += helmet(r, {
        shell: sand ? '#e9e0cc' : sniper ? '#cfd3d8' : '#eef0f2',
        hood: sand ? '#a88a5a' : sniper ? '#4f5646' : null,
        stripe: u.spec === 'heavy' ? '#1d2228' : r.pick(STRIPES),
        cross: u.spec === 'medic',
        longVisor: sniper || scout,
        antenna: scout,
        dirt: sand ? 0.9 : null,
      });
      if (alive && wound) body += helmetDamage(wound);
    }
    if (u.spec) body += '<g transform="translate(52 52)"><circle r="8" fill="#e9e2cf" stroke="#2a2e35" stroke-width="1"/>' + SPEC_BADGE[u.spec] + '</g>';
    return wrap(bg.concat(rank >= 4 ? '#e2574c' : '#d9a85b'), body);
  };

  function droidSvg(r, health) {
    const eye = r.pick(['#ff5a4a', '#ff8c3a', '#5ad1ff']);
    let s = '<path d="M6 64 Q8 50 20 48 L44 48 Q56 50 58 64 Z" fill="#3e444c" stroke="#1c1f24"/>';
    s += '<rect x="28" y="40" width="8" height="10" fill="#2a2e35"/><path d="M24 44 L28 42 M40 44 L36 42" stroke="#6d737b" stroke-width="2"/>';
    s += '<rect x="18" y="16" width="28" height="26" rx="6" fill="#4a5059" stroke="#1c1f24" stroke-width="1.2"/>';
    s += '<rect x="21" y="25" width="22" height="7" rx="3" fill="#15181c"/>';
    s += '<circle cx="27" cy="28.5" r="2.4" fill="' + eye + '"/><circle cx="37" cy="28.5" r="2.4" fill="' + eye + '"/>';
    s += '<circle cx="27" cy="28.5" r="4.5" fill="' + eye + '" opacity="0.2"/><circle cx="37" cy="28.5" r="4.5" fill="' + eye + '" opacity="0.2"/>';
    s += '<path d="M23 36 H41" stroke="#2a2e35" stroke-width="1.4"/><path d="M38 16 V8" stroke="#2a2e35" stroke-width="1.6"/><circle cx="38" cy="7" r="1.8" fill="' + eye + '"/>';
    if (health < 60) s += '<path d="M20 18 L25 24 L23 30" stroke="#111" stroke-width="1" fill="none"/>';
    if (health < 35) s += '<path d="M44 34 L39 38 L42 41" stroke="#111" stroke-width="1" fill="none"/>';
    return wrap(['#2f3a46', '#11161c', '#8fb0c8'], s);
  }

  function mercSvg(r, race) {
    const jacket = '<path d="M4 64 Q6 50 20 47 L44 47 Q58 50 60 64 Z" fill="#5a3d26" stroke="#2a1b10"/><path d="M28 47 L32 58 L36 47" fill="#c9b48a"/>';
    let s = jacket;
    switch (race) {
      case 'трандошан':
        s += '<rect x="26" y="40" width="12" height="10" fill="#8a9a48"/>';
        s += '<path d="M19 30 Q19 14 32 14 Q45 14 45 30 Q45 42 32 44 Q19 42 19 30 Z" fill="#8a9a48" stroke="#4a5422"/>';
        s += '<path d="M24 20 l3 3 M30 17 l3 3 M37 19 l3 3 M22 34 l3 2 M39 35 l3 2" stroke="#5f6b2e" stroke-width="1.2"/>';
        s += '<ellipse cx="26" cy="28" rx="2.6" ry="2" fill="#f2a83a"/><ellipse cx="38" cy="28" rx="2.6" ry="2" fill="#f2a83a"/><rect x="25.6" y="26.4" width="0.9" height="3.2" fill="#111"/><rect x="37.6" y="26.4" width="0.9" height="3.2" fill="#111"/>';
        s += '<path d="M26 38 Q32 41 38 38" stroke="#3a3f1a" stroke-width="1.3" fill="none"/>';
        return wrap(['#4a5032', '#1c2012', '#a8b468'], s);
      case 'родианец':
        s += '<rect x="27" y="40" width="10" height="10" fill="#4f9a6a"/>';
        s += '<path d="M18 28 Q18 13 32 13 Q46 13 46 28 Q44 38 36 42 L32 46 L28 42 Q20 38 18 28 Z" fill="#4f9a6a" stroke="#2a5a3a"/>';
        s += '<ellipse cx="25" cy="27" rx="5.2" ry="6" fill="#0d0d12"/><ellipse cx="39" cy="27" rx="5.2" ry="6" fill="#0d0d12"/><circle cx="23.5" cy="25" r="1.3" fill="#fff" opacity="0.6"/><circle cx="37.5" cy="25" r="1.3" fill="#fff" opacity="0.6"/>';
        s += '<path d="M28 13 Q24 5 20 4 M36 13 Q40 5 44 4" stroke="#2a5a3a" stroke-width="1.6" fill="none"/>';
        return wrap(['#2c4a3a', '#101c16', '#7cc29a'], s);
      case 'гаморреанец':
        s += '<path d="M16 32 Q16 14 32 14 Q48 14 48 32 Q48 46 32 47 Q16 46 16 32 Z" fill="#7e9a4e" stroke="#3e4f22"/>';
        s += '<rect x="25" y="30" width="14" height="10" rx="4" fill="#a6bf72"/><circle cx="29" cy="35" r="1.4" fill="#2b2b1a"/><circle cx="35" cy="35" r="1.4" fill="#2b2b1a"/>';
        s += '<circle cx="25" cy="25" r="1.8" fill="#1a1a10"/><circle cx="39" cy="25" r="1.8" fill="#1a1a10"/>';
        s += '<path d="M24 42 L26 37 L27.5 42 Z M40 42 L38 37 L36.5 42 Z" fill="#f2ead2"/><path d="M18 20 L13 10 L23 17 Z M46 20 L51 10 L41 17 Z" fill="#7e9a4e" stroke="#3e4f22"/>';
        return wrap(['#3e4a28', '#161b0e', '#9fb86a'], s);
      case 'вуки-изгнанник':
        s += '<path d="M14 34 Q12 12 32 11 Q52 12 50 34 Q50 52 32 54 Q14 52 14 34 Z" fill="#7a5233" stroke="#4a301c"/>';
        s += '<path d="M18 20 l3 4 M24 15 l2 4 M40 15 l-2 4 M46 20 l-3 4 M16 38 l4 1 M48 38 l-4 1" stroke="#5a3a22" stroke-width="1.4"/>';
        s += '<ellipse cx="32" cy="34" rx="10" ry="9" fill="#9a6d47"/><circle cx="26" cy="27" r="1.8" fill="#14100c"/><circle cx="38" cy="27" r="1.8" fill="#14100c"/>';
        s += '<ellipse cx="32" cy="33" rx="3" ry="2" fill="#2a1a10"/><path d="M27 39 Q32 41 37 39" stroke="#2a1a10" stroke-width="1.3" fill="none"/>';
        return wrap(['#4a3422', '#1a120a', '#c08a5a'], s);
      case 'дурос':
        s += '<rect x="27" y="40" width="10" height="10" fill="#4f6fa8"/>';
        s += '<path d="M17 26 Q17 10 32 10 Q47 10 47 26 Q46 38 38 42 Q32 45 26 42 Q18 38 17 26 Z" fill="#4f6fa8" stroke="#2a3c66"/>';
        s += '<ellipse cx="25" cy="27" rx="4" ry="3.2" fill="#d23a2a"/><ellipse cx="39" cy="27" rx="4" ry="3.2" fill="#d23a2a"/><path d="M28 37 Q32 38.5 36 37" stroke="#1a2440" stroke-width="1.2" fill="none"/>';
        return wrap(['#2c3a5a', '#10162a', '#7c9cd8'], s);
      default:
        s += face(r, { noScar: false });
        s += '<path d="M19 22 Q32 14 45 22 L45 18 Q32 9 19 18 Z" fill="#4e5a33"/>';
        return wrap(['#4a4430', '#1c1a12', '#b8a46a'], s);
    }
  }

  // ================= ПЕРСОНАЖИ СОБЫТИЙ =================
  function npcSvg(key) {
    const r = rngFrom('npc-' + key);
    switch (key) {
      case 'general': {
        let s = '<path d="M4 64 Q6 50 20 47 L44 47 Q58 50 60 64 Z" fill="#5d636b" stroke="#2a2e35"/><rect x="40" y="52" width="11" height="5" fill="#2a2e35"/><rect x="41" y="53" width="2" height="3" fill="#d9a85b"/><rect x="44" y="53" width="2" height="3" fill="#e2574c"/><rect x="47" y="53" width="2" height="3" fill="#6fb3e0"/>';
        s += '<path d="M24 46 L40 46 L38 51 L26 51 Z" fill="#4a5058"/>';
        s += face(r, { skin: '#e2b08c', hair: '#8d8d8d', grey: true, hairStyle: 'crew', moustache: true, mouth: 'flat', scar: true });
        s += '<path d="M18 20 Q32 9 46 20 L46 23 L18 23 Z" fill="#4a5058" stroke="#2a2e35"/><path d="M17 23 H47 L50 26 H14 Z" fill="#2a2e35"/><rect x="29" y="15" width="6" height="4" fill="#d9a85b"/>';
        return wrap(['#3a4250', '#141820', '#d9a85b'], s);
      }
      case 'fleet': {
        let s = '<path d="M4 64 Q6 50 20 47 L44 47 Q58 50 60 64 Z" fill="#2c3540" stroke="#14181e"/><rect x="40" y="52" width="9" height="4" fill="#14181e"/><rect x="41" y="53" width="2" height="2" fill="#6fb3e0"/><rect x="44" y="53" width="2" height="2" fill="#6fb3e0"/>';
        s += face(r, { hairStyle: 'side', mouth: 'flat', noScar: true });
        s += '<path d="M18 20 Q32 10 46 20 L46 23 L18 23 Z" fill="#2c3540"/><path d="M17 23 H47 L50 26 H14 Z" fill="#14181e"/>';
        return wrap(['#25303c', '#0e1218', '#6fb3e0'], s);
      }
      case 'rodian': return mercSvg(r, 'родианец').replace('#7cc29a', '#d9a85b');
      case 'trandoshan': return mercSvg(r, 'трандошан');
      case 'jawa': {
        let s = '<path d="M6 64 Q8 34 20 18 Q32 4 44 18 Q56 34 58 64 Z" fill="#6b4a2b" stroke="#3a2618"/>';
        s += '<ellipse cx="32" cy="34" rx="12" ry="11" fill="#120d08"/><circle cx="27" cy="33" r="2.6" fill="#ffd34d"/><circle cx="37" cy="33" r="2.6" fill="#ffd34d"/>';
        s += '<circle cx="27" cy="33" r="5" fill="#ffd34d" opacity="0.2"/><circle cx="37" cy="33" r="5" fill="#ffd34d" opacity="0.2"/><path d="M14 52 H50" stroke="#3a2618" stroke-width="3"/>';
        return wrap(['#4a3a28', '#1a130c', '#c9a15a'], s);
      }
      case 'tusken': {
        let s = '<path d="M4 64 Q6 48 20 46 L44 46 Q58 48 60 64 Z" fill="#bea47a" stroke="#6e5536"/>';
        s += '<path d="M17 30 Q17 12 32 12 Q47 12 47 30 Q47 46 32 47 Q17 46 17 30 Z" fill="#c9b183" stroke="#6e5536"/>';
        for (let k = 0; k < 6; k++) s += '<path d="M18 ' + (17 + k * 5) + ' Q32 ' + (14 + k * 5) + ' 46 ' + (17 + k * 5) + '" stroke="rgba(110,85,54,0.45)" fill="none"/>';
        s += '<circle cx="26" cy="27" r="4.5" fill="#1a1612" stroke="#555" stroke-width="1.2"/><circle cx="38" cy="27" r="4.5" fill="#1a1612" stroke="#555" stroke-width="1.2"/>';
        s += '<rect x="27" y="35" width="10" height="5" rx="1.5" fill="#8a8f96"/><path d="M29 35 V40 M32 35 V40 M35 35 V40" stroke="#555"/>';
        return wrap(['#6a5236', '#2a1f12', '#cdb48a'], s);
      }
      case 'rebel': {
        let s = '<path d="M4 64 Q6 50 20 47 L44 47 Q58 50 60 64 Z" fill="#6f7a4a" stroke="#2f3420"/><path d="M28 47 L32 56 L36 47" fill="#c9b48a"/>';
        s += face(r, { mouth: 'frown' });
        s += '<path d="M19 23 Q19 11 32 11 Q45 11 45 23 L46 25 H18 Z" fill="#5d6640" stroke="#2f3420"/>';
        return wrap(['#3e4630', '#151a10', '#b8a46a'], s);
      }
      case 'smuggler': {
        let s = '<path d="M4 64 Q6 50 20 47 L44 47 Q58 50 60 64 Z" fill="#22252b" stroke="#111"/><path d="M27 47 L32 58 L37 47" fill="#e9e4d8"/>';
        s += face(r, { hairStyle: 'side', scar: true, mouth: 'smirk' });
        return wrap(['#3a3530', '#14110e', '#d9a85b'], s);
      }
      case 'bandit': {
        let s = '<path d="M4 64 Q6 50 20 47 L44 47 Q58 50 60 64 Z" fill="#3b2a24" stroke="#1a100c"/>';
        s += '<rect x="26" y="40" width="12" height="10" fill="#c84a32"/><path d="M20 30 Q20 15 32 15 Q44 15 44 30 Q44 42 32 44 Q20 42 20 30 Z" fill="#c84a32" stroke="#6a2216"/>';
        s += '<path d="M24 24 Q28 28 26 34 M40 24 Q36 28 38 34" stroke="#2a0e08" stroke-width="1.6" fill="none"/>';
        s += '<circle cx="27" cy="29" r="1.6" fill="#ffd34d"/><circle cx="37" cy="29" r="1.6" fill="#ffd34d"/><path d="M28 38 L36 38" stroke="#2a0e08" stroke-width="1.4"/>';
        for (const [x, y] of [[24, 15], [32, 12], [40, 15], [28, 13], [36, 13]]) s += '<path d="M' + (x - 1.5) + ' ' + (y + 2) + ' L' + x + ' ' + (y - 5) + ' L' + (x + 1.5) + ' ' + (y + 2) + ' Z" fill="#efe0c4"/>';
        return wrap(['#4a2a22', '#1a0e0a', '#e2574c'], s);
      }
      case 'krayt': {
        let s = '<rect width="64" height="64" fill="#2a2214"/><path d="M0 20 Q32 8 64 22 L64 48 Q32 60 0 46 Z" fill="#b0975e"/>';
        s += '<ellipse cx="32" cy="34" rx="13" ry="9" fill="#ffd34d"/><ellipse cx="32" cy="34" rx="2.6" ry="8" fill="#14100c"/><path d="M8 22 L14 30 M50 22 L44 30" stroke="#5a4a2a" stroke-width="2"/>';
        return wrap(['#3a2e18', '#120e08', '#ffd34d'], s);
      }
      case 'droid': return droidSvg(r, 50);
      case 'trooper':
      default: {
        const s = armorShoulders({ rank: 2 }) + helmet(r, { stripe: '#3d6fb6' });
        return wrap(['#36414f', '#161b22', '#d9a85b'], s);
      }
    }
  }

  A.EVENT_PORTRAIT = {
    hutt_envoy: 'rodian', hutt_job_return: 'rodian', jawa_caravan: 'jawa', capsule_jawas: 'jawa',
    rebel_tracks: 'rebel', rebel_prisoner: 'rebel', rebel_strike: 'rebel', krayt_roar: 'krayt',
    smugglers: 'smuggler', merc_offer: 'trandoshan', tusken_sign: 'tusken', tusken_raid: 'tusken',
    bandit_toll: 'bandit', bandit_raid: 'bandit', fleet_arrival: 'fleet', security_droid: 'droid',
    capsule_signal: 'trooper', desertion_plot: 'trooper', sentry_shot: 'trooper', missing_patrol: 'trooper',
  };

  A.img = function (u, size, cls) {
    const dead = !G.Units.isAlive(u);
    return toImg(A.unitSvg(u), size || 40, (dead ? 'ava-dead ' : '') + (cls || ''), G.Units.fullTitle(u));
  };
  A.npc = function (key, size, cls) {
    return toImg(npcSvg(key || 'general'), size || 64, cls, '');
  };
  A.forEvent = function (eventId, size) {
    return A.npc(A.EVENT_PORTRAIT[eventId] || 'general', size);
  };

  G.Avatar = A;
})(globalThis.G = globalThis.G || {});
