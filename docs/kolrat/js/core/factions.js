/* Фракции Татуина: отношения, статусы, бонусы за дружбу и последствия вражды. */
(function (G) {
  'use strict';

  const Fac = {};
  const FC = () => G.CONFIG.factions;

  // Порядок в интерфейсе
  Fac.list = ['farmers', 'jawa', 'hutt', 'scavengers', 'guild', 'deserters', 'tusken'];

  Fac.rel = (s, f) => s.relations[f] || 0;
  Fac.change = function (s, f, d) { s.relations[f] = Math.max(-100, Math.min(100, (s.relations[f] || 0) + d)); };

  // Есть ли связь с фракцией (можно вести переговоры)
  Fac.contact = function (s, f) {
    if (s.flags['contact_' + f]) return true;
    const D = G.CONFIG.diplomacy[f];
    if (!D || !D.needRegion) return false;
    const r = s.regions[D.needRegion];
    return !!(r && r.known && r.explored >= D.needExplored);
  };

  Fac.status = function (v) {
    if (v <= -50) return { word: 'враги', cls: 'bad' };
    if (v < -9) return { word: 'вражда', cls: 'bad' };
    if (v < 20) return { word: 'нейтралитет', cls: '' };
    if (v < 50) return { word: 'дружба', cls: 'good' };
    return { word: 'союз', cls: 'good' };
  };

  Fac.waterBonus = function (s) {
    let w = 0;
    for (const [need, l] of FC().farmersWater) if (Fac.rel(s, 'farmers') >= need) w = l;
    return w;
  };

  // Награда за голову генерала действует, пока гильдия не на нашей стороне
  Fac.bounty = (s) => !!s.flags.bounty && Fac.rel(s, 'guild') < FC().guildSafe;

  Fac.setHostile = function (s, f) {
    s.relations[f] = FC().attackRelation;
    s.flags['hostile_' + f] = true;
  };

  // Что даёт дружба — для интерфейса
  Fac.perks = function (s, f) {
    const v = Fac.rel(s, f);
    switch (f) {
      case 'farmers': {
        const w = Fac.waterBonus(s);
        return w ? 'привозят ' + w + ' сухарей в сутки' : 'от ' + FC().farmersWater[0][0] + ' — будут привозить провизию';
      }
      case 'guild': return !s.flags.bounty ? 'награды за генерала нет' : v >= FC().guildSafe ? 'убийц больше не присылают' : 'за голову генерала назначена награда';
      case 'scavengers': return s.flags.hostile_scavengers ? 'свалка разгромлена' : v >= FC().scavengersPeace ? 'не трогают обломки; торгуют деталями' : 'по ночам растаскивают обломки';
      case 'deserters': return s.regions.outpost.cleared ? 'аванпоста больше нет' : v >= FC().desertersJoin ? 'готовы вернуться под знамёна' : 'от 50 — могут вернуться в строй';
      case 'jawa': return s.flags.jawaHostile ? 'не торгуют с нами' : 'чем лучше отношения — тем ниже цены';
      case 'hutt': return v >= 25 ? 'продают модули связи' : v >= 10 ? 'продают детали гипердвигателя' : 'торгуют, но дорого';
      case 'tusken': return v >= 0 ? 'налёты реже' : 'считают нас врагами';
    }
    return '';
  };

  G.Factions = Fac;
})(globalThis.G = globalThis.G || {});
