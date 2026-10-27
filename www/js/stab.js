// Экран стаба: превью машины, улучшения (крупные карточки), заправка, станок, гараж, выезд.
(function () {
  const $ = (id) => document.getElementById(id);
  const C = () => window.CONFIG;
  let save, onGo, tab = 'upgrades', previewT = 0, rafId = 0;

  function open(s, go) {
    save = s;
    onGo = go;
    const notes = window.Shop.charity(save, save.car);
    window.Save.write(save);
    $('stab').classList.remove('hidden');
    render();
    for (const n of notes) flash(n);
    loopPreview();
  }

  function close() {
    $('stab').classList.add('hidden');
    cancelAnimationFrame(rafId);
  }

  function flash(text) {
    const el = $('stab-note');
    el.textContent = text;
    el.classList.remove('hidden');
    clearTimeout(flash.t);
    flash.t = setTimeout(() => el.classList.add('hidden'), 2500);
  }

  function render() {
    const lvl = C().LEVELS[Math.min(save.level, C().LEVELS.length - 1)];
    $('stab-name').textContent = lvl.from;
    $('w-sporans').textContent = save.sporans;
    $('w-peas').textContent = save.peas;
    $('w-pearls').textContent = save.pearls;
    const car = C().CARS[save.car];
    $('car-name').textContent = car.name;
    renderStats();
    document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    const body = $('stab-body');
    body.innerHTML = '';
    ({ upgrades: renderUpgrades, fuel: renderFuel, bench: renderBench, garage: renderGarage })[tab](body);
    renderDeparture();
  }

  // Полоски характеристик машины (с учётом улучшений).
  function renderStats() {
    const st = window.Shop.stats(save, save.car);
    const hp = window.Shop.hpOf(save, save.car), fuel = window.Shop.fuelOf(save, save.car);
    const bars = [
      ['Скорость', st.maxSpeed / 40, Math.round(st.maxSpeed * 3.6) + ' км/ч'],
      ['Тяга', st.torque * st.launch / 6000, ''],
      ['Прочность', hp / st.hp, Math.round(hp) + ' / ' + Math.round(st.hp)],
      ['Бензин', fuel / st.tank, fuel.toFixed(1) + ' / ' + st.tank.toFixed(1) + ' л'],
      ['Расход', 1 - st.fuelUse / 0.6, st.fuelUse.toFixed(2) + ' л/с'],
    ];
    $('car-stats').innerHTML = bars.map(([n, k, v]) =>
      `<div class="stat"><span>${n}</span><div class="bar"><i style="width:${Math.max(3, Math.min(100, k * 100))}%"></i></div><em>${v}</em></div>`).join('');
  }

  function price(cost) {
    if (!cost) return '<span class="max">МАКСИМУМ</span>';
    let s = `<span class="pr"><i class="ico sporan"></i>${cost.sporans}</span>`;
    if (cost.peas) s += `<span class="pr"><i class="ico peas"></i>${cost.peas}</span>`;
    if (cost.pearls) s += `<span class="pr"><i class="ico pearl"></i>${cost.pearls}</span>`;
    return s;
  }

  function renderUpgrades(body) {
    const car = C().CARS[save.car], cs = window.Shop.carSave(save, save.car);
    const groups = {};
    for (const id of car.upgrades) {
      const u = C().UPGRADES[id];
      (groups[u.group] = groups[u.group] || []).push(id);
    }
    for (const [g, ids] of Object.entries(groups)) {
      const h = document.createElement('h3');
      h.textContent = g;
      body.appendChild(h);
      const grid = document.createElement('div');
      grid.className = 'cards';
      for (const id of ids) {
        const u = C().UPGRADES[id];
        const lvl = cs.upgrades[id] || 0;
        const cost = window.Shop.upgradeCost(save.car, id, lvl);
        const ok = window.Shop.available(save.car, id, save);
        const can = ok && window.Shop.canPay(save, cost);
        const card = document.createElement('button');
        card.className = 'card' + (lvl ? ' owned' : '') + (cost ? '' : ' maxed');
        card.disabled = !can;
        card.innerHTML = `<b>${u.name}</b>
          <span class="pips">${Array.from({ length: u.levels }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</span>
          <span class="about">${u.about}</span>
          <span class="cost">${ok ? price(cost) : '<span class="lock">Сначала: ' + C().UPGRADES[u.requires].name + '</span>'}</span>`;
        card.onclick = () => {
          if (window.Shop.buyUpgrade(save, save.car, id)) {
            window.Save.write(save);
            window.Sound.pickup();
            flash(`${u.name}: уровень ${cs.upgrades[id]}`);
            render();
          }
        };
        grid.appendChild(card);
      }
      body.appendChild(grid);
    }
  }

  function renderFuel(body) {
    const st = window.Shop.stats(save, save.car);
    const have = window.Shop.fuelOf(save, save.car);
    const pr = window.Shop.fuelPrice(save.car);
    const need = st.tank - have;
    body.innerHTML = `<div class="service">
      <div class="gauge"><i style="width:${have / st.tank * 100}%"></i><span>${have.toFixed(1)} / ${st.tank.toFixed(1)} л</span></div>
      <p class="muted">Литр: <i class="ico sporan"></i> ${pr}. Неизрасходованный бензин остаётся в баке.</p>
      <div class="row" id="fuel-btns"></div></div>`;
    const btns = $('fuel-btns');
    for (const [label, l] of [['+1 л', 1], ['+5 л', 5], [`Полный бак (${Math.ceil(need * pr)})`, need]]) {
      const b = document.createElement('button');
      b.textContent = label;
      b.className = l === need ? 'primary' : '';
      b.disabled = need <= 0.05 || save.sporans < pr;
      b.onclick = () => {
        const got = window.Shop.buyFuel(save, save.car, l);
        if (got) { window.Save.write(save); flash(`Залито ${got} л`); render(); }
      };
      btns.appendChild(b);
    }
  }

  function renderBench(body) {
    const st = window.Shop.stats(save, save.car);
    const hp = window.Shop.hpOf(save, save.car);
    const cost = window.Shop.repairCost(save, save.car);
    const cs = window.Shop.carSave(save, save.car);
    let html = `<div class="service">
      <b>Кузов</b>
      <div class="gauge hp"><i style="width:${hp / st.hp * 100}%"></i><span>${Math.round(hp)} / ${Math.round(st.hp)}</span></div>
      <div class="row"><button id="rep-car" class="primary" ${cost && save.sporans > 0 ? '' : 'disabled'}>${cost ? `Отремонтировать (${cost})` : 'Кузов цел'}</button></div>`;
    const weapons = Object.keys(cs.weapons);
    if (weapons.length) {
      html += '<b>Оружие</b>';
      for (const w of weapons) {
        const d = cs.weapons[w];
        const wc = window.Shop.weaponRepairCost(save, save.car, w);
        html += `<div class="weapon-row"><span>${C().UPGRADES[w].name}</span>
          <div class="gauge small"><i style="width:${d}%"></i><span>${Math.round(d)}%</span></div>
          <button data-w="${w}" ${wc && save.sporans >= wc ? '' : 'disabled'}>${wc ? `Починить (${wc})` : 'Исправно'}</button></div>`;
      }
    } else {
      html += '<p class="muted">Оружия на машине нет. Пулемёт, огнемёт и пила ставятся во вкладке «Улучшения» на машинах, которые их выдерживают.</p>';
    }
    body.innerHTML = html + '</div>';
    $('rep-car').onclick = () => { if (window.Shop.repair(save, save.car)) { window.Save.write(save); flash('Кузов отремонтирован'); render(); } };
    body.querySelectorAll('[data-w]').forEach((b) => {
      b.onclick = () => { if (window.Shop.repairWeapon(save, save.car, b.dataset.w)) { window.Save.write(save); flash('Оружие исправно'); render(); } };
    });
  }

  function renderGarage(body) {
    const grid = document.createElement('div');
    grid.className = 'cards cars';
    for (const [id, car] of Object.entries(C().CARS)) {
      const cs = window.Shop.carSave(save, id);
      const card = document.createElement('button');
      const sel = save.car === id;
      card.className = 'card car' + (sel ? ' selected' : '') + (cs.owned ? ' owned' : '');
      const cost = { sporans: car.price.sporans || 0, peas: car.price.peas || 0, pearls: car.price.pearls || 0 };
      card.innerHTML = `<b>${car.name}</b><span class="about">${car.about}</span>
        <span class="cost">${cs.owned ? (sel ? '<span class="max">ВЫБРАНА</span>' : 'Выбрать') : price(cost)}</span>`;
      card.disabled = !cs.owned && !window.Shop.canPay(save, cost);
      card.onclick = () => {
        if (cs.owned) save.car = id;
        else if (window.Shop.buyCar(save, id)) flash(`Куплена: ${car.name}`);
        window.Save.write(save);
        render();
      };
      grid.appendChild(card);
    }
    body.appendChild(grid);
  }

  // Выезд: уровень и точка старта.
  function renderDeparture() {
    const box = $('depart');
    box.innerHTML = '';
    const fuel = window.Shop.fuelOf(save, save.car), hp = window.Shop.hpOf(save, save.car);
    const block = fuel < 0.5 ? 'Пустой бак — заправьтесь' : hp <= 0 ? 'Машина разбита — на станок' : '';
    C().LEVELS.forEach((lv, i) => {
      if (i > save.level) return;
      const ls = window.Save.levelState(save, lv.id);
      const row = document.createElement('div');
      row.className = 'route' + (i === save.level ? ' current' : '');
      row.innerHTML = `<b>${lv.name}</b><span class="muted">→ ${lv.to}${ls.done ? ' · пройден' : ''} · рекорд ${Math.round(ls.best)} м</span>`;
      const btns = document.createElement('div');
      btns.className = 'row';
      const add = (label, cp, primary) => {
        const b = document.createElement('button');
        b.textContent = label;
        if (primary) b.className = 'primary';
        b.disabled = !!block;
        b.onclick = () => { close(); onGo(i, cp); };
        btns.appendChild(b);
      };
      add('В путь от стаба', 0, i === save.level);
      for (let cp = 1; cp <= ls.checkpoint; cp++) add('С чекпоинта ' + cp, cp);
      row.appendChild(btns);
      box.appendChild(row);
    });
    $('depart-block').textContent = block;
  }

  // Превью машины крутит колёса и качает сканер.
  function loopPreview() {
    const cv = $('car-preview');
    const ctx = cv.getContext('2d');
    const draw = () => {
      previewT += 1 / 60;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = cv.clientWidth, h = cv.clientHeight;
      if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      const def = C().CARS[save.car];
      const k = Math.min(w / 6.2, h / 3.2) * dpr;
      ctx.setTransform(k, 0, 0, -k, cv.width / 2, cv.height * 0.72);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.ellipse(0, def.wheels.y - def.wheels.radius, 2.6, 0.12, 0, 0, Math.PI * 2); ctx.fill();
      window.CarDraw.preview(ctx, def, window.Shop.carSave(save, save.car).upgrades, previewT);
      rafId = requestAnimationFrame(draw);
    };
    cancelAnimationFrame(rafId);
    draw();
  }

  window.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.tab').forEach((b) => { b.onclick = () => { tab = b.dataset.tab; render(); }; });
  });

  window.Stab = { open, close, isOpen: () => !$('stab').classList.contains('hidden') };
})();
