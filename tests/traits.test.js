'use strict';
const test = require('node:test');
const assert = require('node:assert');
const G = require('./load.js').load();

test('черты: у большинства людей есть черта, у дроидов — нет; одинаковы при одном зерне', () => {
  const a = G.Game.newGame({ seed: 31 }), b = G.Game.newGame({ seed: 31 });
  const people = G.Units.people(a);
  const withTrait = people.filter((u) => u.trait).length;
  assert.ok(withTrait > people.length * 0.5 && withTrait < people.length);
  for (const u of G.Units.droids(a)) assert.strictEqual(u.trait, null);
  assert.deepStrictEqual(a.units.map((u) => u.trait), b.units.map((u) => u.trait));
  for (const id in G.CONFIG.traits.list) assert.ok(G.TEXT.traits[id] && G.TEXT.traits[id].icon, id);
});

test('черты влияют на бой: точность, здоровье, стойкость, скорость, командир', () => {
  const s = G.Game.newGame({ seed: 4 });
  const u = G.Units.troopers(s)[0];
  const base = G.BattleFlow.unitEntry(s, Object.assign({}, u, { trait: null }));
  const eagle = G.BattleFlow.unitEntry(s, Object.assign({}, u, { trait: 'eagle' }));
  assert.strictEqual(eagle.accBonus - base.accBonus, G.CONFIG.traits.list.eagle.acc);
  const tough = G.BattleFlow.unitEntry(s, Object.assign({}, u, { trait: 'tough' }));
  assert.strictEqual(tough.hpBonus, G.CONFIG.traits.list.tough.hp);
  const lead = G.BattleFlow.unitEntry(s, Object.assign({}, u, { trait: 'leader' }));
  const B = G.BattleEngine.init({ v: 2, seed: 1, map: { type: 'desert' }, mode: 'field', army: 'tusken',
    sides: [{ units: [base, tough, lead], tactic: 'assault', orders: [] }, { units: [{ type: 'tusken' }], tactic: 'assault', orders: [] }] });
  assert.strictEqual(B.units[1].maxHp - B.units[0].maxHp, G.CONFIG.traits.list.tough.hp);
  assert.strictEqual(B.units[2].leader, true);
});

test('прозвище появляется после пяти побед и попадает в звание', () => {
  const s = G.Game.newGame({ seed: 9 });
  const u = G.Units.troopers(s)[2];
  u.kills = 4;
  assert.strictEqual(G.Units.checkNickname(s, u), null);
  u.kills = 5;
  const nick = G.Units.checkNickname(s, u);
  assert.ok(nick);
  assert.ok(G.Units.title(u).indexOf('«' + nick + '»') > 0);
  const v = G.Units.troopers(s)[3];
  v.kills = 6;
  assert.notStrictEqual(G.Units.checkNickname(s, v), nick, 'прозвища не повторяются');
});

test('старые сохранения получают черты', () => {
  const s = G.Game.newGame({ seed: 12 });
  for (const u of s.units) delete u.trait;
  const back = G.Save.migrate(JSON.parse(JSON.stringify(s)));
  assert.ok(back.units.every((u) => u.trait !== undefined));
  assert.ok(back.units.some((u) => u.trait));
});
