'use strict';
/* Мёртвый мир: Плацдарм — общие утилиты */
window.DW = window.DW || {};
(function (DW) {
  const U = {};

  U.rand = function (a, b) { return a + Math.floor(Math.random() * (b - a + 1)); };
  U.randf = function (a, b) { return a + Math.random() * (b - a); };
  U.chance = function (p) { return Math.random() < p; };
  U.pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  U.shuffle = function (arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };
  U.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  U.lerp = function (a, b, t) { return a + (b - a) * t; };
  U.dist = function (ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); };
  U.ease = function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
  U.uid = function () { return Math.random().toString(36).slice(2, 10); };
  U.sleep = function (ms) {
    const sp = (DW.settings && DW.settings.speed) || 1;
    const ts = DW.timeScale || 1;
    // DW.turbo — ускорение хода противника (кнопка «Быстрее»)
    return new Promise(function (r) { setTimeout(r, ms / sp / ts / (DW.turbo || 1)); });
  };
  U.plural = function (n, f1, f2, f5) {
    n = Math.abs(n) % 100;
    const n1 = n % 10;
    if (n > 10 && n < 20) return f5;
    if (n1 > 1 && n1 < 5) return f2;
    if (n1 === 1) return f1;
    return f5;
  };

  /* DOM helper: U.el('div', {class:'x', onclick: fn}, [children]) */
  U.el = function (tag, props, children) {
    const e = document.createElement(tag);
    if (props) {
      for (const k in props) {
        const v = props[k];
        if (v === undefined || v === null || v === false) continue;
        if (k === 'class') e.className = v;
        else if (k === 'html') e.innerHTML = v;
        else if (k === 'text') e.textContent = v;
        else if (k === 'style') e.style.cssText = v;
        else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, v === true ? '' : v);
      }
    }
    if (children !== undefined && children !== null) {
      const list = Array.isArray(children) ? children : [children];
      list.forEach(function (c) {
        if (c === null || c === undefined || c === false) return;
        e.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
      });
    }
    return e;
  };

  /* Шум для процедурной графики */
  U.hash2 = function (x, y, seed) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  U.noise = function (x, y, seed) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = U.hash2(xi, yi, seed), b = U.hash2(xi + 1, yi, seed);
    const c = U.hash2(xi, yi + 1, seed), d = U.hash2(xi + 1, yi + 1, seed);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  U.fbm = function (x, y, seed, oct) {
    let v = 0, amp = 0.5, f = 1, tot = 0;
    const n = oct || 4;
    for (let i = 0; i < n; i++) {
      v += U.noise(x * f, y * f, seed + i * 131) * amp;
      tot += amp; amp *= 0.5; f *= 2;
    }
    return v / tot;
  };
  /* Детерминированный генератор (для спрайтов) */
  U.srng = function (seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /* Цвета */
  U.hexToRgb = function (hex) {
    const h = hex.replace('#', '');
    return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)];
  };
  U.shade = function (hex, amt) {
    const c = U.hexToRgb(hex);
    const f = function (v) { return U.clamp(Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt)), 0, 255); };
    return 'rgb(' + f(c[0]) + ',' + f(c[1]) + ',' + f(c[2]) + ')';
  };
  U.rgba = function (hex, a) {
    const c = U.hexToRgb(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  };

  U.segIntersect = function (a, b, c, d) {
    function o(p, q, r) { return (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x); }
    const o1 = o(a, b, c), o2 = o(a, b, d), o3 = o(c, d, a), o4 = o(c, d, b);
    return (o1 * o2 < 0) && (o3 * o4 < 0);
  };
  U.segPointDist = function (a, b, p) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const L = dx * dx + dy * dy || 1;
    const t = U.clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / L, 0, 1);
    return Math.hypot(a.x + dx * t - p.x, a.y + dy * t - p.y);
  };

  /* Двоичная куча для Дейкстры */
  U.Heap = function () { this.a = []; };
  U.Heap.prototype.push = function (pri, val) {
    const a = this.a; a.push([pri, val]);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      const t = a[p]; a[p] = a[i]; a[i] = t; i = p;
    }
  };
  U.Heap.prototype.pop = function () {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        const t = a[m]; a[m] = a[i]; a[i] = t; i = m;
      }
    }
    return top;
  };
  U.Heap.prototype.size = function () { return this.a.length; };

  DW.U = U;

  /* Хранилище: на Android — через мост в SharedPreferences, в браузере — localStorage */
  DW.store = {
    get: function (k) {
      try {
        if (window.AndroidBridge && window.AndroidBridge.load) {
          const v = window.AndroidBridge.load(k);
          return v === undefined || v === '' ? null : v;
        }
        return window.localStorage.getItem(k);
      } catch (e) { return null; }
    },
    set: function (k, v) {
      try {
        if (window.AndroidBridge && window.AndroidBridge.save) { window.AndroidBridge.save(k, v); return true; }
        window.localStorage.setItem(k, v);
        return true;
      } catch (e) { return false; }
    },
    del: function (k) {
      try {
        if (window.AndroidBridge && window.AndroidBridge.remove) { window.AndroidBridge.remove(k); return; }
        window.localStorage.removeItem(k);
      } catch (e) { /* ignore */ }
    }
  };

  DW.settings = { speed: 1, sound: true, cine: true, gfx: 'auto', fps: false, music: true, autoLevel: -1 };
  DW.timeScale = 1;
  try {
    const s = DW.store.get('deadworld_settings');
    if (s) { const o = JSON.parse(s); if (o) { DW.settings.speed = o.speed || 1; DW.settings.sound = o.sound !== false; DW.settings.cine = o.cine !== false; DW.settings.gfx = o.gfx || 'auto'; DW.settings.fps = !!o.fps; DW.settings.music = o.music !== false; DW.settings.autoLevel = o.autoLevel === undefined ? -1 : o.autoLevel; } }
  } catch (e) { /* ignore */ }
  DW.saveSettings = function () { DW.store.set('deadworld_settings', JSON.stringify(DW.settings)); };
  /* Уровень графики: 0 — низкий, 1 — средний, 2 — высокий */
  DW.gfxGuess = function () {
    const cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 4;
    if (cores <= 4 || mem <= 2) return 0;
    if (cores >= 8 && mem >= 4) return 2;
    return 1;
  };
  DW.gfxLevel = function () {
    const m = DW.settings.gfx;
    if (m === 'low') return 0;
    if (m === 'mid') return 1;
    if (m === 'high') return 2;
    if (DW.settings.autoLevel < 0) DW.settings.autoLevel = DW.gfxGuess();
    return DW.settings.autoLevel;
  };
})(window.DW);
