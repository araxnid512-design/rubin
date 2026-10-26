// DOM-интерфейс: верхняя панель, окна вылазки, отчётов, личного состава и стройки.
(function () {
  const D = window.GameData;
  const C = window.Campaign;
  const $ = (id) => document.getElementById(id);
  const show = (id, on) => $(id).classList.toggle('hidden', !on);
  const fmt = (n) => Math.round(n).toLocaleString('ru-RU');

  // --- Сообщения ---
  function toast(text, kind, seconds) {
    const box = $('toasts');
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.textContent = text;
    box.appendChild(el);
    while (box.children.length > 4) box.removeChild(box.firstChild);
    const s = seconds || 3;
    setTimeout(() => el.classList.add('fade'), s * 1000);
    setTimeout(() => el.remove(), s * 1000 + 600);
  }

  // --- Верхняя панель ---
  const cache = {};
  function set(id, v) { if (cache[id] !== v) { cache[id] = v; $(id).textContent = v; } }

  function topbar(c) {
    set('r-day', `ДЕНЬ ${c.day}`);
    set('r-soldiers', String(c.soldiers));
    set('r-free', c.tired ? ` (своб. ${C.available(c)})` : '');
    set('r-wounded', String(c.wounded.length));
    set('r-civ', String(c.civilians));
    set('r-rifles', String(c.spareRifles));
    set('r-ammo', fmt(c.ammo));
    set('r-food', fmt(c.food));
    set('r-meds', fmt(c.meds));
    set('r-mat', fmt(c.materials));
    const t = Math.min(100, Math.round(c.threat));
    if (cache.threat !== t) { cache.threat = t; $('r-threat').style.width = t + '%'; }
  }

  // --- Планирование вылазки ---
  let selected = null;
  function openPlanner(c, onGo) {
    const map = $('citymap');
    map.querySelectorAll('.district').forEach((e) => e.remove());
    const colors = ['', '#3a4a2a', '#4a4a26', '#5a3e22', '#5a2a22', '#4a1a2a'];
    for (const d of D.DISTRICTS) {
      const st = c.districts[d.id];
      const el = document.createElement('button');
      el.className = 'district';
      el.style.left = d.x + '%';
      el.style.top = d.y + '%';
      el.style.width = d.w + '%';
      el.style.height = d.h + '%';
      el.style.background = colors[d.threat];
      el.innerHTML = `<span class="dn">${d.name}</span><span class="dt">${'●'.repeat(d.threat)}</span>` +
        `<span class="dc"><i style="width:${Math.round(st.cleared * 100)}%"></i></span>`;
      el.addEventListener('click', () => { selected = d.id; renderPlanner(c); });
      el.dataset.id = d.id;
      map.appendChild(el);
    }
    if (!selected) selected = D.DISTRICTS[0].id;
    $('p-go').onclick = () => onGo(selected, +$('p-count').value, +$('p-ammo').value);
    renderPlanner(c);
    show('planner', true);
  }

  function renderPlanner(c) {
    const d = D.DISTRICTS.find((x) => x.id === selected);
    const st = c.districts[d.id];
    document.querySelectorAll('.district').forEach((e) => e.classList.toggle('selected', e.dataset.id === d.id));
    $('p-name').textContent = d.name;
    $('p-about').textContent = d.about;
    const left = Math.round(d.zombies * (1 - st.cleared));
    $('p-facts').innerHTML =
      `<span>Опасность</span><span>${'●'.repeat(d.threat)}${'○'.repeat(5 - d.threat)}</span>` +
      `<span>Заражённых (оценка)</span><span>~${left}</span>` +
      `<span>Мародёры</span><span>${d.marauders ? 'замечены' : 'нет данных'}</span>` +
      `<span>Зачищено</span><span>${Math.round(st.cleared * 100)}%</span>` +
      `<span>Вылазок сюда</span><span>${st.visits}</span>`;
    const free = C.available(c);
    const count = $('p-count'), ammo = $('p-ammo');
    count.max = Math.max(1, free);
    if (+count.value > free || !count.dataset.touched) count.value = Math.min(free, Math.max(1, Math.min(12, free)));
    const update = () => {
      $('p-count-v').textContent = count.value;
      $('p-ammo-v').textContent = ammo.value;
      const need = count.value * ammo.value;
      $('p-total').textContent = `Возьмут патронов: ${fmt(need)} из ${fmt(c.ammo)} на складе`;
      $('p-go').disabled = free < 1 || need > c.ammo;
      if (free < 1) $('p-total').textContent = 'Свободных бойцов нет — завершите день';
    };
    count.oninput = () => { count.dataset.touched = '1'; update(); };
    ammo.oninput = update;
    update();
  }

  // --- Отчёт ---
  function report(title, lines, button, onOk) {
    $('rep-title').textContent = title;
    $('rep-body').innerHTML = lines.map((l) => {
      const [text, kind] = Array.isArray(l) ? l : [l, ''];
      return `<div class="line ${kind}">${text}</div>`;
    }).join('');
    $('rep-ok').textContent = button || 'Ясно';
    $('rep-ok').onclick = () => { show('report', false); onOk && onOk(); };
    show('report', true);
  }

  function sortieLines(r) {
    const titles = { extracted: 'Отряд вернулся', wiped: 'Отряд погиб' };
    const L = [];
    L.push(`Район: ${r.district}. Ушло бойцов: ${r.sent}`);
    if (r.dead) L.push([`Погибло: ${r.dead}` + (r.riflesLost > 0 ? `, автоматов потеряно: ${r.riflesLost}` : ''), 'bad']);
    if (r.wounded) L.push([`Ранено (в медпункт): ${r.wounded}`, 'bad']);
    L.push(`Уничтожено заражённых: ${r.kills}` + (r.maraudersKilled ? `, мародёров: ${r.maraudersKilled}` : ''));
    L.push(`Израсходовано патронов: ${fmt(r.ammoSpent)}, вернули на склад: ${fmt(r.ammoBack)}`);
    const h = r.haul, got = Object.entries(h).filter(([, n]) => n > 0).map(([k, n]) => `${D.LOOT_NAMES[k]} +${fmt(n)}`);
    if (got.length) L.push(['Добыча: ' + got.join(', '), 'good']);
    if (r.survivors) L.push([`Спасено выживших: ${r.survivors} — они в части`, 'good']);
    L.push(`Район зачищен на ${r.cleared}%`);
    return { title: titles[r.outcome] || 'Итог вылазки', lines: L };
  }

  function defenseLines(r) {
    const L = [];
    L.push(`Уничтожено заражённых: ${r.kills}`);
    L.push(`Израсходовано патронов: ${fmt(r.ammoSpent)}`);
    if (r.dead) L.push([`Погибло бойцов: ${r.dead}`, 'bad']);
    if (r.wounded) L.push([`Ранено: ${r.wounded}`, 'bad']);
    L.push(`Состояние стен: ${r.walls}%` + (r.walls < 100 ? ' — почините в «Стройке»' : ''));
    return { title: r.outcome === 'held' ? 'Орда отбита!' : 'Орда прорвалась', lines: L };
  }

  // --- Личный состав ---
  function openPersonnel(c, onArm) {
    const days = c.wounded.map((w) => Math.ceil(w.days));
    $('pers-body').innerHTML =
      `<span>Бойцов в строю</span><span>${c.soldiers}</span>` +
      `<span>Свободны для вылазки</span><span>${C.available(c)}</span>` +
      `<span>Раненых</span><span>${c.wounded.length}${days.length ? ` (до выздоровления ${Math.min(...days)}–${Math.max(...days)} дн.)` : ''}</span>` +
      `<span>Гражданских</span><span>${c.civilians}${c.buildings.garden ? ' (работают на огороде)' : ''}</span>` +
      `<span>АК-74 в оружейке</span><span>${c.spareRifles}</span>` +
      `<span>Мест в казарме</span><span>${C.people(c)} / ${D.capacity(c.buildings.barracks)}</span>`;
    const max = Math.min(c.civilians, c.spareRifles);
    const n = $('arm-n');
    n.max = max;
    n.value = max;
    $('arm-v').textContent = n.value;
    n.oninput = () => { $('arm-v').textContent = n.value; };
    $('arm-go').disabled = max < 1;
    $('arm-go').onclick = () => onArm(+n.value);
    show('personnel', true);
  }

  // --- Стройка ---
  function openBuild(c, onBuild, onRepair) {
    $('build-mat').textContent = `· материалов: ${fmt(c.materials)}`;
    const list = $('build-list');
    list.innerHTML = '';
    const rc = C.repairCost(c);
    if (rc > 0) {
      const row = document.createElement('div');
      row.className = 'build-row';
      row.innerHTML = `<b>Ремонт стен<span class="lv">${Math.round(c.wallIntegrity * 100)}%</span></b><p>Восстановить стены до 100%</p>`;
      const b = document.createElement('button');
      b.textContent = `Починить (${rc})`;
      b.disabled = c.materials < rc;
      b.onclick = onRepair;
      row.appendChild(b);
      list.appendChild(row);
    }
    for (const [key, B] of Object.entries(D.BUILDINGS)) {
      const lvl = c.buildings[key];
      const cost = C.buildCost(c, key);
      const row = document.createElement('div');
      row.className = 'build-row';
      row.innerHTML = `<b>${B.name}<span class="lv">${lvl ? 'ур. ' + lvl : 'нет'}</span></b><p>${B.about(Math.max(1, lvl))}</p>`;
      const b = document.createElement('button');
      if (cost == null) { b.textContent = 'Максимум'; b.disabled = true; }
      else { b.textContent = `${lvl ? 'Улучшить' : 'Построить'} (${cost})`; b.disabled = c.materials < cost; }
      b.onclick = () => onBuild(key);
      row.appendChild(b);
      list.appendChild(row);
    }
    show('build', true);
  }

  // --- Бой ---
  function battleHud(scene, title) {
    const alive = scene.soldiers.filter((s) => s.hp > 0);
    let text;
    if (scene.mode === 'sortie') {
      const ammo = alive.reduce((a, s) => a + s.ammo, 0);
      const found = scene.survivors.filter((v) => v.state === 'follow' && v.hp > 0).length;
      const hostiles = scene.zombies.length + scene.marauders.length;
      text = `Бойцов: ${alive.length}/${scene.soldiers.length}   Патронов: ${fmt(ammo)}\n` +
        `Заражённых: ${scene.zombies.length}` + (scene.marauders.length ? `   Мародёров: ${scene.marauders.length}` : '') +
        `\nВыживших с отрядом: ${found}` + (hostiles === 0 ? '\nРайон зачищен' : '');
    } else {
      const pool = scene.ammoPool ? scene.ammoPool.ammo : 0;
      text = `Защитников: ${alive.length}   Патронов на складе: ${fmt(pool)}\nОрда: ${scene.zombies.length} из ${scene.zombiesStart}`;
    }
    set('bh-title', title);
    set('bh-stats', text);
  }

  function setScreen(name) {
    show('topbar', name === 'base');
    show('base-actions', name === 'base');
    show('battle-hud', name === 'sortie' || name === 'defense');
    show('battle-actions', name === 'sortie' || name === 'defense');
    show('a-retreat', name === 'sortie');
    show('a-return', false);
    show('a-center', name === 'sortie');
  }

  function hint(text) {
    $('hint').textContent = text || '';
    show('hint', !!text);
  }

  function soundLabel() {
    const t = 'Звук: ' + (window.Sound.enabled ? 'вкл' : 'выкл');
    $('m-sound').textContent = t;
    $('btn-sound').textContent = t;
  }

  window.UI = {
    $, show, toast, topbar, openPlanner, report, sortieLines, defenseLines, openPersonnel, openBuild,
    battleHud, setScreen, hint, soundLabel, fmt,
  };
})();
