/* Пришлый — общие утилиты: случайность с зерном, текстовая грамматика, генератор имён. */
(function () {
  'use strict';
  const R = (window.R = window.R || {});

  R.hash = function (str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };

  // Детерминированный генератор для иллюстраций: одна и та же сцена всегда рисуется одинаково.
  R.mulberry = function (a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  R.clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // Игровая случайность. Состояние хранится в сохранении, поэтому перезагрузка страницы
  // не даёт «перебросить» кубик.
  R.makeRng = function (seed) {
    let s = seed >>> 0;
    const next = () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), 1 | t);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return {
      next,
      state: () => s,
      setState: (v) => { s = v >>> 0; },
      int: (a, b) => a + Math.floor(next() * (b - a + 1)),
      pick: (arr) => arr[Math.floor(next() * arr.length)],
      chance: (p) => next() < p,
      weighted(items, wf) {
        let tot = 0;
        const ws = items.map((it) => { const w = Math.max(0, wf(it)); tot += w; return w; });
        if (tot <= 0) return null;
        let x = next() * tot;
        for (let i = 0; i < items.length; i++) { x -= ws[i]; if (x <= 0) return items[i]; }
        return items[items.length - 1];
      },
    };
  };

  // Грамматика Летописца: [вариант|вариант] — случайный выбор, {имя} — подстановка переменной.
  R.expand = function (str, vars, rng) {
    if (typeof str !== 'string') return '';
    let out = str;
    const re = /\[([^\[\]]*)\]/;
    let guard = 0;
    while (re.test(out) && guard++ < 300) out = out.replace(re, (_, body) => rng.pick(body.split('|')));
    return out.replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] !== undefined ? vars[k] : m));
  };

  R.plural = function (n, forms) {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return forms[2];
    if (b > 1 && b < 5) return forms[1];
    if (b === 1) return forms[0];
    return forms[2];
  };

  const M1 = ['Ган', 'Бер', 'Ульф', 'Тор', 'Ред', 'Вил', 'Эд', 'Гер', 'Сиг', 'Хар', 'Лот', 'Ар', 'Бор', 'Кун', 'Дит', 'Ост', 'Фал', 'Яр', 'Мил', 'Рад'];
  const M2 = ['ольд', 'ик', 'ман', 'рих', 'вин', 'ер', 'берт', 'мар', 'о', 'ан', 'им', 'ош', 'ек'];
  const F1 = ['Аль', 'Бер', 'Гре', 'Ин', 'Лис', 'Мар', 'Эль', 'Хиль', 'Ур', 'Ве', 'Дан', 'Ро', 'Сан', 'Ти', 'Мил'];
  const F2 = ['та', 'да', 'ина', 'гит', 'ла', 'ве', 'са', 'ника', 'ена', 'рун'];
  const NICK = ['Кривой', 'Рыжий', 'Косой', 'Молчун', 'Тощий', 'Бородач', 'Хромой', 'Весельчак', 'Сова', 'Щербатый', 'Длинный', 'Лис'];
  R.nameM = (rng) => rng.pick(M1) + rng.pick(M2);
  R.nameF = (rng) => rng.pick(F1) + rng.pick(F2);
  R.nick = (rng) => rng.pick(NICK);
})();
