/* Бои: точка входа. Пока — упрощённый расчёт стычек (на этапе 3 заменится автобоем). */
(function (G) {
  'use strict';
  const U = G.U;

  const Battle = {};

  function grantLoot(s, rng, lootCfg) {
    if (!lootCfg) return '';
    const parts = [];
    const mult = G.Res.diff(s).loot;
    for (const k of ['water', 'scrap', 'credits']) {
      if (lootCfg[k]) {
        const n = Math.round(U.rollRange(rng, lootCfg[k]) * mult);
        if (n > 0) { G.Res.add(s, k, n); parts.push(G.TEXT.res[k].name.toLowerCase() + ' +' + n); }
      }
    }
    if (lootCfg.items) for (const k in lootCfg.items) {
      const n = U.rollRange(rng, lootCfg.items[k]);
      if (n > 0) { G.Res.addItem(s, k, n); parts.push(G.TEXT.items[k].name + ' ×' + n); }
    }
    return parts.length ? ' Трофеи: ' + parts.join(', ') + '.' : '';
  }
  Battle.grantLoot = grantLoot;

  function losses(res) {
    const parts = [];
    if (res.killed.length) parts.push('погибли ' + res.killed.map((u) => G.Units.title(u)).join(', '));
    if (res.wounded.length) parts.push('ранены ' + U.pl(res.wounded.length, U.FORMS.fighter));
    return parts.length ? ' Потери: ' + parts.join('; ') + '.' : ' Потерь нет.';
  }

  // Атака на вражеский лагерь
  Battle.fromAttack = function (s, rng, order, squad) {
    const cfg = G.Regions.cfg(order.target);
    const name = G.Regions.name(order.target);
    const enemy = cfg.strength * G.Res.diff(s).enemy * rng.range(0.85, 1.15);
    const res = G.Actions.skirmish(s, rng, squad, enemy, name);
    if (res.won) {
      s.regions[order.target].cleared = true;
      G.Res.discipline(s, G.CONFIG.discipline.victory);
      G.Game.say(s, 'Атака на «' + name + '» удалась: противник рассеян.' + losses(res) +
        grantLoot(s, rng, G.CONFIG.loot[cfg.enemy]), 'battle');
    } else {
      G.Res.discipline(s, G.CONFIG.discipline.defeat);
      G.Game.say(s, 'Атака на «' + name + '» захлебнулась. Отряд отступил.' + losses(res), 'bad');
    }
  };

  // Ночной налёт на лагерь
  Battle.nightRaid = function (s, rng) {
    const R = G.CONFIG.raids;
    let enemy = (R.strengthBase + R.strengthPerDay * s.day) * G.Res.diff(s).enemy * rng.range(0.7, 1.3);
    const surprised = s.guards < R.alertGuards && s.sections.sensors.level === 0;
    if (surprised) enemy *= R.surpriseMult;
    const fit = G.Units.alive(s).filter((u) => G.Units.isFit(s, u));
    const squad = fit.slice(0, Math.min(fit.length, Math.max(s.guards, 8) + 8));
    s.stats.raids++;
    const res = G.Actions.skirmish(s, rng, squad, enemy, 'ночной налёт таскенов');
    const head = surprised ? 'Ночью таскены застали лагерь врасплох! ' : 'Ночью часовые заметили таскенов у периметра. ';
    if (res.won) {
      G.Res.discipline(s, 2);
      G.Game.say(s, head + 'Налёт отбит.' + losses(res), 'battle');
    } else {
      const w = Math.min(s.res.water, Math.round(enemy * R.lootWaterPerStrength));
      const m = Math.min(s.res.scrap, Math.round(enemy * R.lootScrapPerStrength));
      G.Res.add(s, 'water', -w);
      G.Res.add(s, 'scrap', -m);
      G.Res.discipline(s, -5);
      G.Game.say(s, head + 'Налётчики прорвались к складам и унесли ' + w + ' л воды и ' + m + ' ед. металла.' + losses(res), 'bad');
    }
  };

  G.Battle = Battle;
})(globalThis.G = globalThis.G || {});
