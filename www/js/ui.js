// DOM-интерфейс: HUD, кнопки действий, рюкзак, обыск, сообщения.
(function () {
  const $ = (id) => document.getElementById(id);
  let selected = null; // индекс слота рюкзака или 'weapon'
  let lootState = null;

  // --- HUD ---
  const hudCache = {};
  function setText(id, text) {
    if (hudCache[id] === text) return;
    hudCache[id] = text;
    $(id).textContent = text;
  }
  function setBar(id, value) {
    const v = Math.round(value);
    if (hudCache[id + 'w'] === v) return;
    hudCache[id + 'w'] = v;
    $(id).style.width = Math.max(0, Math.min(100, v)) + '%';
  }

  function updateHud(state, interact) {
    const p = state.player;
    setBar('bar-hp', p.hp);
    setBar('bar-food', p.food);
    setBar('bar-water', p.water);
    setText('val-hp', Math.ceil(p.hp));
    setText('val-food', Math.ceil(p.food));
    setText('val-water', Math.ceil(p.water));

    const h = Math.floor(state.hour), m = Math.floor((state.hour % 1) * 60);
    setText('clock', `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);

    const quests = Object.values(state.quests).filter((q) => q.active)
      .map((q) => (q.done ? '✓ ' : '• ') + q.title).join('\n');
    setText('quests', quests);

    const w = state.weapon;
    const G = window.Game;
    if (w) {
      const full = G.D.WEAPONS[w.id].durability;
      setText('wpn-name', w.dur > 0 ? G.D.ITEMS[w.id].name : 'Сломано');
      setBar('wpn-dur', w.dur / full * 100);
    } else {
      setText('wpn-name', 'Кулаки');
      setBar('wpn-dur', 0);
    }
    setText('heal-count', String(G.healCount()));
    const crouch = $('btn-crouch');
    if (crouch.classList.contains('on') !== state.crouch) crouch.classList.toggle('on', state.crouch);

    const btn = $('btn-interact');
    if (interact && !state.ui) {
      btn.classList.remove('hidden');
      setText('interact-label', interact.label);
    } else {
      btn.classList.add('hidden');
    }
  }

  // --- Сообщения ---
  function toast(text, seconds) {
    const box = $('toasts');
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    box.appendChild(el);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    setTimeout(() => el.classList.add('fade'), seconds * 1000);
    setTimeout(() => el.remove(), seconds * 1000 + 600);
  }

  // --- Ячейка предмета ---
  function itemCell(item, onClick, isSelected) {
    const G = window.Game;
    const el = document.createElement('button');
    el.className = 'cell' + (isSelected ? ' selected' : '');
    if (item) {
      const def = G.D.ITEMS[item.id];
      el.innerHTML = `<span class="swatch" style="background:${def.color}"></span>` +
        `<span class="cell-name">${def.short}</span>` +
        (item.count > 1 ? `<span class="cell-count">${item.count}</span>` : '');
      if (def.kind === 'weapon') {
        const pct = item.dur / G.D.WEAPONS[item.id].durability * 100;
        el.innerHTML += `<span class="cell-dur"><i style="width:${pct}%"></i></span>`;
      }
    } else {
      el.classList.add('empty');
    }
    el.addEventListener('click', onClick);
    return el;
  }

  // --- Рюкзак ---
  function openInventory() {
    const G = window.Game;
    if (G.state.ui || G.state.over || G.state.menu) return;
    G.state.ui = { type: 'inventory' };
    selected = null;
    $('inventory').classList.remove('hidden');
    renderInventory();
  }

  function closeOverlay() {
    $('inventory').classList.add('hidden');
    $('loot').classList.add('hidden');
    lootState = null;
    window.Game.closeUI();
  }

  function selectedItem() {
    const s = window.Game.state;
    if (selected === 'weapon') return s.weapon ? Object.assign({ count: 1 }, s.weapon) : null;
    return selected != null ? s.inventory[selected] : null;
  }

  function renderInventory() {
    const G = window.Game, s = G.state;
    const grid = $('inv-grid');
    grid.innerHTML = '';
    s.inventory.forEach((it, i) => {
      grid.appendChild(itemCell(it, () => { selected = i; renderInventory(); }, selected === i));
    });
    const ws = $('inv-weapon');
    ws.innerHTML = '';
    ws.appendChild(itemCell(s.weapon ? Object.assign({ count: 1 }, s.weapon) : null,
      () => { selected = 'weapon'; renderInventory(); }, selected === 'weapon'));
    renderDetails();
  }

  function renderDetails() {
    const G = window.Game, D = G.D;
    const box = $('inv-details');
    box.innerHTML = '';
    const it = selectedItem();
    if (!it) {
      box.innerHTML = '<p class="muted">Выберите предмет</p>';
      return;
    }
    const def = D.ITEMS[it.id];
    const title = document.createElement('h2');
    title.textContent = def.name;
    box.appendChild(title);

    const info = document.createElement('p');
    info.className = 'muted';
    const parts = [];
    if (def.heal) parts.push(`здоровье +${def.heal}`);
    if (def.food) parts.push(`сытость +${def.food}`);
    if (def.water) parts.push(`вода +${def.water}`);
    if (def.kind === 'weapon') {
      const wd = D.WEAPONS[it.id];
      parts.push(`урон ${wd.damage}`, wd.type === 'ranged' ? `дальность ${wd.range} м` : 'ближний бой');
    }
    if (def.kind === 'material') parts.push('материал');
    info.textContent = parts.join(' · ');
    box.appendChild(info);

    const actions = document.createElement('div');
    actions.className = 'actions';
    const button = (label, fn, disabled) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.disabled = !!disabled;
      b.addEventListener('click', () => { fn(); renderInventory(); });
      actions.appendChild(b);
    };

    if (def.kind === 'weapon') {
      const target = selected === 'weapon' ? G.state.weapon : G.state.inventory[selected];
      const full = D.WEAPONS[it.id].durability;
      const pct = Math.round(target.dur / full * 100);
      const dur = document.createElement('div');
      dur.className = 'durability';
      dur.innerHTML = `<span>Состояние: ${pct}%${target.dur <= 0 ? ' (сломано)' : ''}</span>` +
        `<div class="bar"><i style="width:${pct}%"></i></div>`;
      box.appendChild(dur);

      const cost = G.repairCost(target);
      const need = document.createElement('div');
      need.className = 'repair-cost';
      need.innerHTML = 'Для ремонта: ' + Object.entries(cost).map(([id, n]) => {
        const have = G.countItem(id);
        return `<span class="${have >= n ? 'ok' : 'bad'}">${D.ITEMS[id].name} ${Math.min(have, n)}/${n}</span>`;
      }).join(' ');
      box.appendChild(need);

      button('Починить', () => G.repair(target), !G.canRepair(target));
      if (selected === 'weapon') button('Убрать в рюкзак', () => { G.unequip(); selected = null; });
      else button('Взять в руки', () => { G.useSlot(selected); selected = 'weapon'; });
    } else if (def.kind !== 'material') {
      button('Использовать', () => {
        G.useSlot(selected);
        if (!G.state.inventory[selected]) selected = null;
      });
    }
    if (it.id === 'sporan' || it.id === 'water') {
      button('Сделать живчик', () => G.craftZhivchik(), G.countItem('sporan') < 1 || G.countItem('water') < 1);
    }
    if (selected !== 'weapon') button('Выбросить', () => { G.dropSlot(selected); selected = null; });
    box.appendChild(actions);
  }

  // --- Обыск ---
  function openLoot(ui) {
    lootState = ui;
    $('loot').classList.remove('hidden');
    renderLoot();
  }

  function renderLoot() {
    const G = window.Game;
    $('loot-title').textContent = lootState.name;
    const grid = $('loot-grid');
    grid.innerHTML = '';
    if (lootState.items.length === 0) {
      grid.innerHTML = '<p class="muted">Пусто</p>';
    }
    lootState.items.forEach((it, i) => {
      grid.appendChild(itemCell(it, () => { G.takeLoot(i); renderLoot(); }));
    });
    const bag = $('loot-bag');
    bag.innerHTML = '';
    G.state.inventory.forEach((it) => bag.appendChild(itemCell(it, () => {})));
  }

  // --- Конец игры ---
  function showGameOver(text) {
    $('gameover-text').textContent = text;
    $('gameover').classList.remove('hidden');
  }
  function hideGameOver() {
    $('gameover').classList.add('hidden');
  }

  // --- Главное меню ---
  function soundLabel() {
    const t = 'Звук: ' + (window.Sound.enabled ? 'вкл' : 'выкл');
    $('menu-sound').textContent = t;
    $('btn-sound').textContent = t;
  }
  function showMenu(hasSave) {
    $('menu-continue').classList.toggle('hidden', !hasSave);
    soundLabel();
    $('menu').classList.remove('hidden');
  }
  function hideMenu() {
    $('menu').classList.add('hidden');
  }

  // --- Кнопки ---
  function hold(el, on) {
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); on(true); });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) {
      el.addEventListener(ev, () => on(false));
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    hold($('btn-attack'), (v) => { window.Input.attackButton = v; window.Input.updateFire(); });
    const tap = (id, fn) => $(id).addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); fn(); });
    tap('btn-interact', () => window.Game.interact());
    tap('btn-bag', openInventory);
    tap('btn-heal', () => window.Game.quickHeal());
    tap('btn-crouch', () => window.Game.toggleCrouch());
    $('menu-continue').addEventListener('click', () => window.Game.continueGame());
    $('menu-new').addEventListener('click', () => window.Game.newGame());
    $('menu-sound').addEventListener('click', () => { window.Sound.toggle(); soundLabel(); });
    $('btn-sound').addEventListener('click', () => { window.Sound.toggle(); soundLabel(); });
    $('inv-close').addEventListener('click', closeOverlay);
    $('loot-close').addEventListener('click', closeOverlay);
    $('loot-all').addEventListener('click', () => { window.Game.takeAll(); renderLoot(); });
    $('btn-restart').addEventListener('click', () => window.Game.newGame());
    $('btn-newgame').addEventListener('click', () => { window.Game.newGame(); window.Platform.resume(); });
  });

  // «Назад» и Esc сначала закрывают открытое окно.
  window.Platform.onBack = () => {
    if (!$('menu').classList.contains('hidden')) return true;
    if (!$('inventory').classList.contains('hidden') || !$('loot').classList.contains('hidden')) {
      closeOverlay();
      return true;
    }
    return false;
  };

  window.UI = { updateHud, toast, openLoot, showGameOver, hideGameOver, openInventory, closeOverlay, showMenu, hideMenu };
})();
