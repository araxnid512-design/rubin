/* Сохранения: localStorage (автосейв + 3 ячейки), экспорт и импорт файла. */
(function (G) {
  'use strict';

  const Save = {};
  const PREFIX = 'kolrat.save.';
  Save.slots = ['auto', '1', '2', '3'];

  function storage() {
    try {
      const ls = globalThis.localStorage;
      if (!ls) return null;
      const k = PREFIX + '__test';
      ls.setItem(k, '1');
      ls.removeItem(k);
      return ls;
    } catch (e) {
      return null;
    }
  }
  Save.available = () => !!storage();

  Save.serialize = (s) => JSON.stringify(s);

  // Разбор и проверка сохранения; при необходимости — миграция старых версий
  Save.parse = function (text) {
    const s = JSON.parse(text);
    if (!s || typeof s !== 'object' || !s.res || !Array.isArray(s.units) || typeof s.day !== 'number') {
      throw new Error('Это не похоже на сохранение этой игры.');
    }
    return Save.migrate(s);
  };

  Save.migrate = function (s) {
    // Добавляем поля, появившиеся в новых версиях, не ломая старые сохранения
    const C = G.CONFIG;
    s.items = Object.assign({}, C.start.items, s.items || {});
    s.flags = s.flags || {};
    s.timers = s.timers || [];
    s.eventLog = s.eventLog || {};
    s.visitors = s.visitors || {};
    s.stats = Object.assign({ kills: 0, deaths: 0, battles: 0, victories: 0, defeats: 0, waterFound: 0, scrapFound: 0, deserted: 0, raids: 0 }, s.stats || {});
    for (const id in C.sections) if (!s.sections[id]) s.sections[id] = { level: C.sections[id].level, progress: 0, paid: false };
    for (const id in C.regions) {
      if (!s.regions[id]) s.regions[id] = { known: false, explored: 0, water: C.regions[id].waterPool || 0, scrap: C.regions[id].scrapPool || 0, visits: 0, cleared: false };
    }
    if (G.Save.migrateExtra) G.Save.migrateExtra(s);
    s.v = C.saveVersion;
    return s;
  };

  Save.write = function (slot, s) {
    const ls = storage();
    if (!ls) return false;
    try {
      ls.setItem(PREFIX + slot, Save.serialize(s));
      ls.setItem(PREFIX + slot + '.meta', JSON.stringify({ day: s.day, people: G.Units.people(s).length, time: Date.now(), over: !!s.over, difficulty: s.difficulty }));
      return true;
    } catch (e) {
      return false;
    }
  };

  Save.read = function (slot) {
    const ls = storage();
    if (!ls) return null;
    const t = ls.getItem(PREFIX + slot);
    if (!t) return null;
    try { return Save.parse(t); } catch (e) { return null; }
  };

  Save.meta = function (slot) {
    const ls = storage();
    if (!ls) return null;
    try { return JSON.parse(ls.getItem(PREFIX + slot + '.meta') || 'null'); } catch (e) { return null; }
  };

  Save.remove = function (slot) {
    const ls = storage();
    if (!ls) return;
    ls.removeItem(PREFIX + slot);
    ls.removeItem(PREFIX + slot + '.meta');
  };

  // Скачать сохранение файлом (только в браузере)
  Save.exportFile = function (s) {
    const blob = new Blob([Save.serialize(s)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'kolrat-den-' + s.day + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };

  G.Save = Save;
})(globalThis.G = globalThis.G || {});
