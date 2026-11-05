/* Прокачка и техника: специализации бойцов, машины, укрепления, работы инженеров, дроиды. */
(function (G) {
  'use strict';
  const U = G.U;
  const F = U.FORMS;

  const P = {};
  const say = (s, t, k) => G.Game.say(s, t, k);

  // ================= СПЕЦИАЛИЗАЦИИ =================
  P.specIds = () => Object.keys(G.CONFIG.specs);

  P.vehiclesOf = (s, type, okOnly) => (s.vehicles || []).filter((v) => v.type === type && (!okOnly || v.ok));
  P.scoutCount = (s) => G.Units.troopers(s).filter((u) => u.spec === 'scout' || (u.status === 'training' && u.trainSpec === 'scout')).length;

  // Почему боец не может пройти подготовку (null — может)
  P.specReq = function (s, u, spec) {
    const c = G.CONFIG.specs[spec];
    if (!c) return 'неизвестная специализация';
    if (u.kind !== 'trooper') return 'только для штурмовиков';
    if (u.spec === spec) return 'уже освоена';
    if (u.status !== 'ok') return 'боец занят';
    if (s.phase !== 'orders' || s.pending) return 'сейчас нельзя';
    if (G.Game.busyIds(s).has(u.id)) return 'боец получил приказ на сегодня';
    if (G.Units.woundLevel(u) === 2) return 'боец тяжело ранен';
    if (G.Units.rankIndex(u) < c.minRank) return 'нужно звание не ниже «' + G.TEXT.ranks[G.CONFIG.ranks[c.minRank].id].name.toLowerCase() + '»';
    if (u.missions < c.minMissions) return 'нужно вылазок: ' + c.minMissions + ' (сейчас ' + u.missions + ')';
    if (c.needSection && s.sections[c.needSection[0]].level < c.needSection[1]) return 'нужен отсек «' + G.TEXT.sections[c.needSection[0]].name + '»';
    if (c.needVehicle === 'speeder' && P.vehiclesOf(s, 'speeder', true).length <= P.scoutCount(s)) return 'нужен свободный исправный спидер';
    if (!G.Res.canPay(s, c.cost)) return 'нужно: ' + G.Res.costText(c.cost);
    return null;
  };

  P.train = function (s, u, spec) {
    const err = P.specReq(s, u, spec);
    if (err) return err;
    const c = G.CONFIG.specs[spec];
    G.Res.pay(s, c.cost);
    u.status = 'training';
    u.trainSpec = spec;
    u.trainUntil = s.day + c.days;
    G.Game.chron(s, s.day, U.cap(G.Units.fullTitle(u)) + ' отправлен на подготовку: «' + G.TEXT.specs[spec].name + '».', 'info');
    return null;
  };

  P.clearSpec = function (s, u) {
    if (u.status !== 'ok' || !u.spec) return;
    u.spec = null;
  };

  // На рассвете: завершение подготовки
  P.dawn = function (s) {
    for (const u of s.units) {
      if (u.status === 'training' && u.trainUntil <= s.day + 1) {
        u.status = 'ok';
        u.spec = u.trainSpec;
        delete u.trainSpec;
        delete u.trainUntil;
        say(s, U.cap(G.Units.title(u)) + ' завершил подготовку: теперь он ' + G.TEXT.specs[u.spec].name.toLowerCase() + '.', 'good');
      }
    }
  };

  P.countSpec = (s, spec, fitOnly) => G.Units.troopers(s).filter((u) => u.spec === spec && u.status === 'ok' && (!fitOnly || G.Units.isFit(s, u))).length;

  // ================= ТЕХНИКА =================
  P.addVehicle = function (s, rng, type, ok) {
    s.vehicles = s.vehicles || [];
    s.vehicleSeq = (s.vehicleSeq || 0) + 1;
    const v = { id: s.vehicleSeq, type: type, ok: !!ok, health: ok ? 100 : 0 };
    s.vehicles.push(v);
    return v;
  };
  P.vehicleName = function (v) {
    return G.TEXT.vehicles[v.type].name + ' №' + v.id;
  };

  P.energyUpkeep = function (s) {
    const up = G.CONFIG.vehicles.upkeep;
    let e = 0;
    for (const v of s.vehicles || []) if (v.ok) e += up[v.type] || 0;
    return e;
  };

  // ================= ИНЖЕНЕРНЫЕ РАБОТЫ =================
  // Ключ работы: 'wall', 'droid_repair', 'droid_build' или 'fix:<id машины>'
  P.projectCfg = function (key) {
    const C = G.CONFIG.projects;
    if (key.indexOf('fix:') === 0) return null;
    return C[key];
  };
  P.projectKind = function (s, key) {
    if (key.indexOf('fix:') === 0) {
      const v = (s.vehicles || []).find((x) => x.id === Number(key.slice(4)));
      return v ? 'fix_' + v.type : null;
    }
    return key;
  };

  P.projectState = function (s, key) {
    s.projects = s.projects || {};
    if (!s.projects[key]) s.projects[key] = { progress: 0, paid: false };
    return s.projects[key];
  };

  P.projectTargets = function (s) {
    const out = [];
    s.fort = s.fort || { walls: 0 };
    if (s.fort.walls < G.CONFIG.projects.wall.max) out.push('wall');
    for (const v of s.vehicles || []) if (!v.ok) out.push('fix:' + v.id);
    if (G.Units.droids(s).some((d) => d.health < 100)) out.push('droid_repair');
    out.push('droid_build');
    return out;
  };

  P.projectLock = function (s, key) {
    const kind = P.projectKind(s, key);
    const c = G.CONFIG.projects[kind];
    if (!c) return 'неизвестная работа';
    if (c.needSection && s.sections[c.needSection[0]].level < c.needSection[1]) {
      return 'нужен отсек «' + G.TEXT.sections[c.needSection[0]].name + '» (уровень ' + c.needSection[1] + ')';
    }
    if (key === 'wall' && (s.fort.walls || 0) >= c.max) return 'укрепления достроены';
    if (key === 'droid_repair' && !G.Units.droids(s).some((d) => d.health < 100)) return 'дроиды исправны';
    const st = P.projectState(s, key);
    if (!st.paid && !G.Res.canPay(s, c.cost)) return 'не хватает: ' + G.Res.costText(c.cost);
    return null;
  };

  P.projectName = function (s, key) {
    const kind = P.projectKind(s, key);
    if (key.indexOf('fix:') === 0) {
      const v = s.vehicles.find((x) => x.id === Number(key.slice(4)));
      return 'Починить: ' + (v ? P.vehicleName(v) : 'машина');
    }
    return G.TEXT.projects[kind].name;
  };

  P.projectInfo = function (s, key) {
    const kind = P.projectKind(s, key);
    const c = G.CONFIG.projects[kind];
    const st = P.projectState(s, key);
    const extra = key === 'wall' ? ' · построено ' + (s.fort.walls || 0) + '/' + c.max : '';
    return (st.paid ? 'материалы заложены' : 'нужно: ' + G.Res.costText(c.cost)) + ' · работы ' + Math.floor(st.progress) + '/' + c.work + extra;
  };

  // Вклад работ; возвращает текст
  P.work = function (s, rng, key, points) {
    const kind = P.projectKind(s, key);
    const c = G.CONFIG.projects[kind];
    if (!c) return 'Работы отменены: цель больше не существует.';
    const st = P.projectState(s, key);
    const name = P.projectName(s, key);
    let pre = '';
    if (!st.paid) {
      if (!G.Res.pay(s, c.cost)) return name + ': работы сорваны — не хватило материалов.';
      st.paid = true;
      pre = 'Материалы заложены (' + G.Res.costText(c.cost) + '). ';
    }
    st.progress += points;
    if (st.progress < c.work) return pre + name + ': выполнено ' + Math.floor((st.progress / c.work) * 100) + '%.';
    // Завершено
    delete s.projects[key];
    if (kind === 'wall') {
      s.fort.walls = (s.fort.walls || 0) + 1;
      return pre + 'Ещё одна секция баррикад перед лагерем готова (' + s.fort.walls + '/' + c.max + ').';
    }
    if (kind === 'droid_repair') {
      for (const d of G.Units.droids(s)) d.health = Math.min(100, d.health + c.heal);
      return pre + 'Техники перебрали сервоприводы и заменили броневые пластины: дроиды отремонтированы.';
    }
    if (kind === 'droid_build') {
      const d = G.Units.createDroid(s, rng, { origin: 'built' });
      return pre + 'В сборочном цехе собран новый боевой дроид: ' + d.num + ' ' + d.name + '.';
    }
    const v = s.vehicles.find((x) => x.id === Number(key.slice(4)));
    if (v) { v.ok = true; v.health = 100; }
    return pre + (v ? P.vehicleName(v) : 'Машина') + ' снова в строю!';
  };

  // ================= ЕЖЕДНЕВНОЕ =================
  // Мастерская сама понемногу чинит дроидов
  P.evening = function (s) {
    const R = G.CONFIG.droidSelfRepair;
    const per = R.perDay[s.sections.workshop.level] || 0;
    if (!per || s.droidsOffline) return;
    for (const d of G.Units.droids(s)) {
      if (d.health >= 100 || s.res.energy < R.energy) continue;
      G.Res.add(s, 'energy', -R.energy);
      d.health = Math.min(100, d.health + per);
    }
  };

  G.Progress = P;
})(globalThis.G = globalThis.G || {});
