'use strict';
const test = require('node:test');
const assert = require('node:assert');
const G = require('./load.js').load();

const newGame = (seed) => G.Game.newGame({ seed: seed || 7 });

test('фракции: у каждой есть название, иконка и стартовое отношение', () => {
  for (const f of G.Factions.list) {
    assert.ok(G.TEXT.factions[f] && G.TEXT.factions[f].name, f);
    assert.ok(G.TEXT.factions[f].icon, f);
    assert.strictEqual(typeof newGame().relations[f], 'number', f);
    assert.ok(G.Factions.perks(newGame(), f).length > 0, f);
  }
});

test('переговоры с новыми фракциями открываются после разведки и закрываются враждой', () => {
  const s = newGame();
  const dip = () => G.Actions.defs.diplomacy.targets(s);
  assert.ok(dip().indexOf('farmers') < 0);
  s.regions.anchorhead.known = true; s.regions.anchorhead.explored = 20;
  assert.ok(dip().indexOf('farmers') >= 0);
  s.flags.contact_deserters = true;
  assert.ok(dip().indexOf('deserters') >= 0);
  G.Factions.setHostile(s, 'deserters');
  assert.ok(dip().indexOf('deserters') < 0);
  assert.strictEqual(s.relations.deserters, G.CONFIG.factions.attackRelation);
});

test('свалка: торговля только при мире с падальщиками', () => {
  const s = newGame();
  s.regions.junkyard.known = true; s.regions.junkyard.explored = 50;
  s.relations.scavengers = -10;
  assert.strictEqual(G.Regions.canTrade(s, 'junkyard'), false);
  s.relations.scavengers = 5;
  assert.strictEqual(G.Regions.canTrade(s, 'junkyard'), true);
  s.regions.junkyard.cleared = true;
  assert.strictEqual(G.Regions.canTrade(s, 'junkyard'), false);
});

test('нападение на свалку делает падальщиков врагами', () => {
  const s = newGame(31);
  s.regions.junkyard.known = true; s.regions.junkyard.explored = 50;
  assert.ok(G.Actions.defs.attack.targets(s).indexOf('junkyard') >= 0);
  assert.strictEqual(G.Game.addOrder(s, G.Game.makeOrder(s, 'attack', 'junkyard', 24, 2)), null);
  G.Game.endDay(s);
  assert.ok(s.pending && s.pending.kind === 'battle');
  assert.strictEqual(s.flags.hostile_scavengers, true);
  G.Game.act(s, { action: 'quick' });
  assert.strictEqual(s.pending.kind, 'battleResult');
});

test('помощь фермерам: ополченцы воюют на нашей стороне', () => {
  const s = newGame(12);
  s.regions.anchorhead.known = true;
  G.Events.trigger(s, G.Game.rng(s), 'farm_plea', {});
  G.Events.choose(s, G.Game.rng(s), 'help');
  G.Events.choose(s, G.Game.rng(s), 'continue');
  assert.strictEqual(s.pending.kind, 'battle');
  const setup = G.BattleFlow.toSetup(s, s.pending);
  const allies = setup.sides[0].units.filter((u) => u.kind === 'ally');
  assert.strictEqual(allies.length, G.CONFIG.events.list.farm_plea.allies);
  assert.ok(allies.every((u) => u.type === 'farmer' && u.uid === null));
  G.Game.act(s, { action: 'quick' });
  G.Game.act(s, { action: 'close' });
  assert.ok(s.flags.contact_farmers);
});

test('дружба с фермерами даёт воду, награда гильдии снимается дружбой', () => {
  const s = newGame();
  const base = G.Base.waterProduction(s);
  s.relations.farmers = G.CONFIG.factions.farmersWater[1][0];
  assert.strictEqual(G.Base.waterProduction(s) - base, G.CONFIG.factions.farmersWater[1][1]);
  s.flags.bounty = true;
  assert.strictEqual(G.Factions.bounty(s), true);
  s.relations.guild = G.CONFIG.factions.guildSafe;
  assert.strictEqual(G.Factions.bounty(s), false);
});

test('дезертиры возвращаются под знамёна', () => {
  const s = newGame(5);
  s.regions.outpost.known = true;
  const before = G.Units.people(s).length;
  G.Events.trigger(s, G.Game.rng(s), 'deserter_return', {});
  G.Events.choose(s, G.Game.rng(s), 'accept');
  assert.ok(G.Units.people(s).length > before);
  assert.ok(G.Units.people(s).some((u) => u.origin === 'defector'));
  assert.strictEqual(s.regions.outpost.cleared, true);
  assert.ok(G.TEXT.origins.defector);
});

test('у новых бойцов противника есть фигурки и имена в логе', () => {
  for (const t of ['bounty_hunter', 'assassin_droid', 'scavenger', 'scav_droid', 'scav_boss', 'deserter', 'deserter_heavy', 'deserter_captain', 'farmer']) {
    assert.ok(G.CONFIG.battle.types[t], 'нет параметров: ' + t);
    assert.ok(G.BattleText.nom(t) !== t, 'нет имени: ' + t);
  }
});
