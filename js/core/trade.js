/* Торговля: открывается как окно-взаимодействие (pending) во время исполнения приказов. */
(function (G) {
  'use strict';

  const Trade = {};

  // Множитель цены по отношениям: чем лучше отношения, тем дешевле покупка и дороже продажа
  Trade.factor = function (s, partner) {
    const t = G.CONFIG.trade[partner];
    const rel = s.relations[t.faction] || 0;
    return 1 - rel * G.CONFIG.diplomacy.priceFactorPerPoint;
  };

  Trade.buyPrice = (s, partner, good) =>
    Math.max(1, Math.round(G.CONFIG.trade[partner].buy[good] * Trade.factor(s, partner)));
  Trade.sellPrice = (s, partner, good) =>
    Math.max(1, Math.round(G.CONFIG.trade[partner].sell[good] / Trade.factor(s, partner)));

  Trade.locked = function (s, partner, good) {
    const t = G.CONFIG.trade[partner];
    const need = t.needRelation && t.needRelation[good];
    if (need == null) return null;
    const rel = s.relations[t.faction] || 0;
    return rel >= need ? null : 'Нужны отношения ' + need + ' (сейчас ' + rel + ')';
  };

  Trade.make = function (s, partner) {
    const t = G.CONFIG.trade[partner];
    return { kind: 'trade', partner: partner, stock: G.U.clone(t.stock), bought: {}, sold: {} };
  };
  Trade.open = function (s, partner) {
    s.pending = Trade.make(s, partner);
  };

  const isRes = (k) => k === 'water' || k === 'scrap' || k === 'energy' || k === 'credits';
  const have = (s, k) => (isRes(k) ? s.res[k] : s.items[k] || 0);
  const give = (s, k, n) => (isRes(k) ? G.Res.add(s, k, n) : G.Res.addItem(s, k, n));

  // Купить n единиц; возвращает фактическое количество
  Trade.buy = function (s, good, n) {
    const p = s.pending;
    if (!p || p.kind !== 'trade') return 0;
    if (Trade.locked(s, p.partner, good)) return 0;
    const price = Trade.buyPrice(s, p.partner, good);
    n = Math.min(n, p.stock[good] || 0, Math.floor(s.res.credits / price));
    if (n <= 0) return 0;
    G.Res.add(s, 'credits', -n * price);
    give(s, good, n);
    p.stock[good] -= n;
    p.bought[good] = (p.bought[good] || 0) + n;
    return n;
  };

  Trade.sell = function (s, good, n) {
    const p = s.pending;
    if (!p || p.kind !== 'trade') return 0;
    const price = Trade.sellPrice(s, p.partner, good);
    n = Math.min(n, have(s, good));
    if (n <= 0) return 0;
    give(s, good, -n);
    G.Res.add(s, 'credits', n * price);
    p.sold[good] = (p.sold[good] || 0) + n;
    return n;
  };

  Trade.close = function (s) {
    const p = s.pending;
    for (const k in p.bought) if (p.bought[k]) { s.stats.trades = (s.stats.trades || 0) + 1; break; }
    if (!Object.keys(p.bought).some((k) => p.bought[k])) for (const k in p.sold) if (p.sold[k]) { s.stats.trades = (s.stats.trades || 0) + 1; break; }
    const parts = [];
    const name = (k) => (isRes(k) ? G.TEXT.res[k].name.toLowerCase() : G.TEXT.items[k].name.toLowerCase());
    for (const k in p.bought) if (p.bought[k]) parts.push('куплено: ' + name(k) + ' ×' + p.bought[k]);
    for (const k in p.sold) if (p.sold[k]) parts.push('продано: ' + name(k) + ' ×' + p.sold[k]);
    const who = G.TEXT.tradePartners[p.partner];
    G.Game.say(s, who + (parts.length ? ': ' + parts.join(', ') + '.' : ': сделок не было.'), 'info');
    s.pending = null;
  };

  G.Trade = Trade;
})(globalThis.G = globalThis.G || {});
