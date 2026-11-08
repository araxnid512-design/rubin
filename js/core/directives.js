/*
 * Директивы командования: время от времени штаб сектора присылает шифровку с заданием на срок —
 * захватить точки, расширить контроль, разгромить лагерь, создать запас сухарей или разведать округу.
 * Выполнено — награда (ветераны шаттлом, кредиты, бакта, дисциплина); провалено — дисциплина падает.
 * Задания генерируются от зерна и дня — основную случайность игры не сбивают.
 */
(function (G) {
  'use strict';
  const D = {};
  const C = () => G.CONFIG.directives;
  const say = (s, t, tone) => G.Game.say(s, t, tone);

  D.ensure = function (s) {
    if (s.directiveNext == null) s.directiveNext = C().firstDay;
    if (s.directive === undefined) s.directive = null;
    s.stats.directives = s.stats.directives || 0;
  };

  const knownCount = (s) => Object.keys(s.regions).filter((id) => s.regions[id].known).length;

  D.make = function (s, day) {
    const rng = G.Rng.make((s.seed * 31 + day * 977) | 0);
    const T = G.Territory;
    const pool = [];
    const points = T.points(s).filter((id) => s.regions[id].known && !T.owned(s, id));
    if (points.length) pool.push({ type: 'points', need: T.pointsOwned(s) + 1 });
    pool.push({ type: 'territory', need: T.count(s) + 2 });
    const bases = Object.keys(G.CONFIG.regions).filter((id) => G.CONFIG.regions[id].kind === 'hostile' && s.regions[id].known && !s.regions[id].cleared && id !== 'krayt_lair' && id !== 'hutt_palace');
    if (bases.length) pool.push({ type: 'destroy', target: rng.pick(bases), need: 1 });
    pool.push({ type: 'stock', need: Math.round((Math.max(300, s.res.water + 150)) / 10) * 10 });
    if (knownCount(s) < Object.keys(s.regions).length) pool.push({ type: 'recon', need: knownCount(s) + 2 });
    const d = rng.pick(pool);
    d.deadline = day + C().days;
    d.reward = rng.pick(['veterans', 'credits', 'bacta']);
    return d;
  };

  D.progress = function (s, d) {
    const T = G.Territory;
    switch (d.type) {
      case 'points': return [T.pointsOwned(s), d.need];
      case 'territory': return [T.count(s), d.need];
      case 'destroy': return [s.regions[d.target].cleared || T.owned(s, d.target) ? 1 : 0, 1];
      case 'stock': return [Math.min(d.need, s.res.water), d.need];
      case 'recon': return [knownCount(s), d.need];
    }
    return [0, 1];
  };

  D.title = function (d) {
    const X = G.TEXT.directives.types[d.type];
    return X.replace('{n}', d.need).replace('{place}', d.target ? G.TEXT.regions[d.target].name : '');
  };
  D.rewardText = (d) => G.TEXT.directives.rewards[d.reward];

  D.accept = function (s, d) { D.ensure(s); s.directive = d; };
  D.decline = function (s) { D.ensure(s); s.directive = null; s.directiveNext = s.day + C().every; };

  function grant(s, d, day) {
    if (d.reward === 'veterans') {
      const t = G.Terminal.ensure(s);
      t.orders.push({ id: ++t.seq, good: 'veterans', eta: day + 2, ordered: day, price: 0 });
    } else if (d.reward === 'credits') G.Res.add(s, 'credits', C().credits);
    else G.Res.addItem(s, 'bacta', 3);
    G.Res.discipline(s, C().okDisc);
  }

  // Рассвет: проверка текущей директивы и, если пора, новая шифровка
  D.dawn = function (s) {
    D.ensure(s);
    const day = s.day + 1;
    const d = s.directive;
    if (d) {
      const [a, b] = D.progress(s, d);
      if (a >= b) {
        grant(s, d, day);
        s.stats.directives++;
        say(s, 'Директива командования выполнена: ' + D.title(d) + '. Награда: ' + D.rewardText(d) + '.', 'good');
        G.Game.chron(s, day, 'Выполнена директива: ' + D.title(d) + '.', 'good');
        s.directive = null; s.directiveNext = day + C().every;
      } else if (day > d.deadline) {
        G.Res.discipline(s, C().failDisc);
        say(s, 'Срок директивы истёк: ' + D.title(d) + '. Командование недовольно — дисциплина падает.', 'bad');
        G.Game.chron(s, day, 'Провалена директива: ' + D.title(d) + '.', 'bad');
        s.directive = null; s.directiveNext = day + C().every;
      }
      return;
    }
    if (day >= s.directiveNext && G.Events && G.Events.defs.directive) {
      s.directiveNext = day + C().every;
      G.Events.queueNow(s, 'directive', { d: D.make(s, day) });
    }
  };

  G.Directives = D;
})(globalThis.G = globalThis.G || {});
