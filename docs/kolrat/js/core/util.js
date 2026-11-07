/* Вспомогательные функции: числа, склонения, шаблоны. */
(function (G) {
  'use strict';

  const U = {};

  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // Русские склонения: plural(5, ['боец', 'бойца', 'бойцов']) → 'бойцов'
  U.plural = function (n, forms) {
    n = Math.abs(Math.trunc(n)) % 100;
    const n1 = n % 10;
    if (n > 10 && n < 20) return forms[2];
    if (n1 > 1 && n1 < 5) return forms[1];
    if (n1 === 1) return forms[0];
    return forms[2];
  };
  U.pl = (n, forms) => n + ' ' + U.plural(n, forms);
  U.cap = (str) => (str ? str.charAt(0).toUpperCase() + str.slice(1) : str);
  U.signed = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n);

  // Подстановка {ключ} в шаблон
  U.fill = (tpl, vars) => String(tpl).replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] !== undefined ? vars[k] : m));

  U.clone = (o) => JSON.parse(JSON.stringify(o));

  U.sum = (arr, f) => arr.reduce((a, x) => a + (f ? f(x) : x), 0);

  // Случайное целое из диапазона [a, b], заданного массивом
  U.rollRange = (rng, r) => (Array.isArray(r) ? rng.int(r[0], r[1]) : r);

  U.FORMS = {
    trooper: ['штурмовик', 'штурмовика', 'штурмовиков'],
    fighter: ['боец', 'бойца', 'бойцов'],
    droid: ['дроид', 'дроида', 'дроидов'],
    day: ['день', 'дня', 'дней'],
    liter: ['литр', 'литра', 'литров'],
    unit: ['единица', 'единицы', 'единиц'],
    credit: ['кредит', 'кредита', 'кредитов'],
    man: ['человек', 'человека', 'человек'],
    wounded: ['раненый', 'раненых', 'раненых'],
    pack: ['медпакет', 'медпакета', 'медпакетов'],
  };

  G.U = U;
})(globalThis.G = globalThis.G || {});
