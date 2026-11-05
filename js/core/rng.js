/*
 * Детерминированный генератор случайных чисел (mulberry32).
 * Состояние хранится во внешнем объекте { s: число } — поэтому оно
 * сохраняется вместе с игрой, а бой с тем же зерном всегда идёт одинаково.
 */
(function (G) {
  'use strict';

  function Rng(holder) {
    this.h = holder;
    if (typeof holder.s !== 'number') holder.s = 1;
  }

  Rng.prototype.next = function () {
    let t = (this.h.s = (this.h.s + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
  // [0, 1)
  Rng.prototype.float = function () { return this.next() / 4294967296; };
  // целое в [a, b] включительно
  Rng.prototype.int = function (a, b) { return a + Math.floor(this.float() * (b - a + 1)); };
  Rng.prototype.range = function (a, b) { return a + this.float() * (b - a); };
  Rng.prototype.chance = function (p) { return this.float() < p; };
  Rng.prototype.pick = function (arr) { return arr.length ? arr[Math.floor(this.float() * arr.length)] : undefined; };
  Rng.prototype.shuffle = function (arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.float() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };
  // Выбор по весам: wf(элемент) → вес
  Rng.prototype.weighted = function (items, wf) {
    let total = 0;
    for (const it of items) total += Math.max(0, wf(it));
    if (total <= 0) return null;
    let r = this.float() * total;
    for (const it of items) {
      r -= Math.max(0, wf(it));
      if (r < 0) return it;
    }
    return items[items.length - 1];
  };

  Rng.make = (seed) => new Rng({ s: seed | 0 });

  Rng.hashString = function (str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };

  G.Rng = Rng;
})(globalThis.G = globalThis.G || {});
