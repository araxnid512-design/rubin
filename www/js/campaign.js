// Кампания: состояние части между боями, смена дней, итоги вылазок и обороны.
(function () {
  const D = window.GameData;
  const SAVE_KEY = 'garrison-save-v1';

  function create() {
    const s = D.START;
    const c = {
      day: 1,
      soldiers: s.soldiers,      // здоровые бойцы с автоматами
      wounded: [],               // [{ days }] — раненые бойцы, автомат при них
      civilians: s.civilians,
      spareRifles: s.spareRifles,
      ammo: s.ammo,
      food: s.food,
      meds: s.meds,
      materials: s.materials,
      buildings: {},
      wallIntegrity: 1,
      threat: 10,
      tired: 0,                  // бойцы, уже ходившие на вылазку сегодня
      districts: {},
      stats: { kills: 0, lost: 0, rescued: 0, sorties: 0, hordes: 0 },
      over: false,
    };
    for (const [k, b] of Object.entries(D.BUILDINGS)) c.buildings[k] = b.start;
    for (const d of D.DISTRICTS) c.districts[d.id] = { cleared: 0, lootTaken: 0, visits: 0 };
    return c;
  }

  const people = (c) => c.soldiers + c.wounded.length + c.civilians;
  const available = (c) => Math.max(0, c.soldiers - c.tired);
  const rifles = (c) => c.soldiers + c.wounded.length + c.spareRifles;

  // --- Вылазка ---
  function planSortie(c, districtId, count, ammoPer) {
    const def = D.DISTRICTS.find((d) => d.id === districtId);
    if (!def) return { error: 'Нет такого района' };
    if (count < 1) return { error: 'Нужен хотя бы один боец' };
    if (count > available(c)) return { error: 'Столько свободных бойцов нет' };
    if (count * ammoPer > c.ammo) return { error: 'Не хватает патронов на складе' };
    c.ammo -= count * ammoPer;
    const st = c.districts[districtId];
    return {
      def,
      visit: st.visits,
      battle: { soldiers: count, ammoPer, clearedFraction: st.cleared, lootTaken: st.lootTaken },
    };
  }

  function applySortie(c, plan, res) {
    const def = plan.def;
    const st = c.districts[def.id];
    const report = { kind: 'sortie', district: def.name, outcome: res.outcome, sent: res.sent };

    c.ammo += res.ammoLeft + res.haul.ammo;
    c.soldiers -= res.dead;
    c.spareRifles += res.rifleRecovered + res.haul.rifles;
    let wounded = 0;
    for (const hp of res.hp) {
      if (hp < 60) {
        c.wounded.push({ days: Math.ceil((100 - hp) / 20) });
        c.soldiers -= 1;
        wounded++;
      }
    }
    c.tired += res.sent - res.dead - wounded;
    c.civilians += res.survivors;
    c.food += res.haul.food;
    c.meds += res.haul.meds;
    c.materials += res.haul.materials;

    st.visits++;
    st.cleared = 1 - (1 - st.cleared) * (1 - res.killedFraction);
    st.lootTaken = 1 - (1 - st.lootTaken) * (1 - (res.lootFraction || 0));
    c.threat += res.shots / 1000 * D.HORDE.threatPer1000Rounds;

    c.stats.sorties++;
    c.stats.kills += res.kills;
    c.stats.lost += res.dead;
    c.stats.rescued += res.survivors;

    Object.assign(report, {
      dead: res.dead, wounded, kills: res.kills, maraudersKilled: res.maraudersKilled,
      ammoSpent: res.shots, ammoBack: res.ammoLeft, haul: res.haul, survivors: res.survivors,
      riflesLost: res.dead - res.rifleRecovered, cleared: Math.round(st.cleared * 100),
    });
    checkOver(c);
    return report;
  }

  // --- Оборона ---
  function hordeSize(c) {
    const H = D.HORDE;
    return Math.round((H.baseSize + c.day * H.sizePerDay) * (0.85 + Math.random() * 0.3));
  }

  function hordeMix(c) {
    const brute = Math.min(0.2, 0.04 + c.day * 0.006);
    const runner = Math.min(0.35, 0.15 + c.day * 0.01);
    return { walker: 1 - brute - runner, runner, brute };
  }

  function applyDefense(c, res) {
    const report = { kind: 'defense', outcome: res.outcome, kills: res.kills, dead: res.dead, ammoSpent: res.shots };
    c.soldiers -= res.dead;
    c.spareRifles += res.dead; // автоматы павших остаются на базе
    let wounded = 0;
    for (const hp of res.hp) {
      if (hp < 60) { c.wounded.push({ days: Math.ceil((100 - hp) / 20) }); c.soldiers -= 1; wounded++; }
    }
    c.wallIntegrity = Math.max(0, res.wallIntegrity);
    c.threat = 0;
    c.stats.hordes++;
    c.stats.kills += res.kills;
    c.stats.lost += res.dead;
    report.wounded = wounded;
    report.walls = Math.round(c.wallIntegrity * 100);
    if (res.outcome === 'overrun') c.over = true;
    checkOver(c);
    return report;
  }

  // --- Смена дня ---
  function endDay(c) {
    const r = { kind: 'day', day: c.day, lines: [] };
    const garden = c.buildings.garden ? Math.floor(c.civilians * D.gardenYield(c.buildings.garden)) : 0;
    const eat = people(c);
    c.food += garden - eat;
    r.lines.push(`Съедено пайков: ${eat}` + (garden ? `, огород дал: ${garden}` : ''));
    if (c.food < 0) {
      let leave = Math.ceil(-c.food / 4);
      c.food = 0;
      const civ = Math.min(c.civilians, leave);
      c.civilians -= civ; leave -= civ;
      const sol = Math.min(c.soldiers, leave);
      c.soldiers -= sol; c.spareRifles += sol;
      r.lines.push(`Голод! Ушли из части: ${civ + sol} чел.`);
      r.bad = true;
    }

    const medMult = 1 + 0.5 * (c.buildings.medbay - 1);
    let healed = 0;
    for (const w of c.wounded) {
      let rate = medMult;
      if (c.meds > 0) { c.meds--; rate *= 1.5; }
      w.days -= rate;
    }
    healed = c.wounded.filter((w) => w.days <= 0).length;
    c.wounded = c.wounded.filter((w) => w.days > 0);
    c.soldiers += healed;
    if (healed) r.lines.push(`Вернулись в строй после ранения: ${healed}`);

    const cap = D.capacity(c.buildings.barracks);
    if (people(c) > cap) {
      const extra = Math.min(c.civilians, people(c) - cap);
      c.civilians -= extra;
      if (extra) { r.lines.push(`В казарме нет мест — ушли гражданские: ${extra}`); r.bad = true; }
    }

    for (const st of Object.values(c.districts)) {
      st.cleared = Math.max(0, st.cleared - 0.1);
      st.lootTaken = Math.max(0, st.lootTaken - 0.05);
    }

    c.threat += D.HORDE.dailyThreat + Math.random() * 5;
    c.tired = 0;
    c.day++;
    r.threat = Math.round(c.threat);
    if (c.threat >= D.HORDE.attackAt) {
      r.horde = hordeSize(c);
      r.lines.push(`Разведка: на часть идёт орда — около ${r.horde} заражённых!`);
    } else if (c.threat >= D.HORDE.warnAt) {
      r.lines.push('Разведка: заражённые собираются в орду. Готовьте оборону.');
    }
    checkOver(c);
    return r;
  }

  // --- Строительство и личный состав ---
  function buildCost(c, key) {
    const b = D.BUILDINGS[key], lvl = c.buildings[key];
    return lvl >= b.max ? null : b.cost[lvl];
  }

  function build(c, key) {
    const cost = buildCost(c, key);
    if (cost == null || c.materials < cost) return false;
    c.materials -= cost;
    c.buildings[key]++;
    return true;
  }

  function repairCost(c) {
    return Math.ceil((1 - c.wallIntegrity) * 30 * c.buildings.walls);
  }

  function repairWalls(c) {
    const cost = repairCost(c);
    if (!cost || c.materials < cost) return false;
    c.materials -= cost;
    c.wallIntegrity = 1;
    return true;
  }

  function armCivilians(c, n) {
    n = Math.min(n, c.civilians, c.spareRifles);
    if (n <= 0) return 0;
    c.civilians -= n;
    c.spareRifles -= n;
    c.soldiers += n;
    return n;
  }

  function checkOver(c) {
    if (c.soldiers + c.wounded.length + c.civilians <= 0) c.over = true;
  }

  // --- Сохранение (может быть недоступно — тогда игра идёт без него) ---
  function save(c) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(c)); } catch (e) { /* нет хранилища */ }
  }
  function load() {
    try {
      const c = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (!c || !c.buildings) return null;
      return Object.assign(create(), c);
    } catch (e) { return null; }
  }
  function clear() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* нет хранилища */ }
  }
  function hasSave() {
    try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
  }

  window.Campaign = {
    create, people, available, rifles, planSortie, applySortie, hordeSize, hordeMix, applyDefense, endDay,
    buildCost, build, repairCost, repairWalls, armCivilians, save, load, clear, hasSave,
  };
})();
