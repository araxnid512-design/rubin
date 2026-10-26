// Ввод: виртуальный стик (левая половина экрана) и кнопки действий (ui.js).
// Клавиатура для отладки в браузере: WASD/стрелки, пробел — атака, E — действие,
// I — рюкзак, H — лечение, C — присесть, Esc — пауза.
(function () {
  const Input = {
    move: { x: 0, y: 0 },
    fire: false,
    attackButton: false,
    attackQueued: false, // короткий тап быстрее кадра не должен теряться
    stick: null, // { id, ox, oy, x, y } — для отрисовки
  };

  const RADIUS = 60;
  const keys = new Set();

  Input.updateFire = function () {
    Input.fire = keys.has('Space') || Input.attackButton;
    if (Input.fire) Input.attackQueued = true;
  };

  function updateFromKeys() {
    if (Input.stick) return;
    let x = 0, y = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
    const len = Math.hypot(x, y) || 1;
    Input.move.x = x / len;
    Input.move.y = y / len;
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') {
      if (window.Platform.onBack && window.Platform.onBack()) return;
      window.Platform.paused ? window.Platform.resume() : window.Platform.pause();
      return;
    }
    if (e.repeat) return;
    if (e.code === 'KeyE') window.Game.interact();
    if (e.code === 'KeyI') window.UI.openInventory();
    if (e.code === 'KeyH') window.Game.quickHeal();
    if (e.code === 'KeyC') window.Game.toggleCrouch();
    keys.add(e.code);
    updateFromKeys();
    Input.updateFire();
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
    updateFromKeys();
    Input.updateFire();
  });

  const canvas = document.getElementById('game');
  canvas.addEventListener('pointerdown', (e) => {
    if (Input.stick || e.clientX > window.innerWidth * 0.55) return;
    Input.stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
  });

  window.addEventListener('pointermove', (e) => {
    const s = Input.stick;
    if (!s || s.id !== e.pointerId) return;
    let dx = e.clientX - s.ox, dy = e.clientY - s.oy;
    const len = Math.hypot(dx, dy);
    if (len > RADIUS) { dx = dx / len * RADIUS; dy = dy / len * RADIUS; }
    s.x = s.ox + dx;
    s.y = s.oy + dy;
    Input.move.x = dx / RADIUS;
    Input.move.y = dy / RADIUS;
  });

  function release(e) {
    if (!Input.stick || Input.stick.id !== e.pointerId) return;
    Input.stick = null;
    Input.move.x = 0;
    Input.move.y = 0;
    updateFromKeys();
  }
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);

  window.Platform.on('pause', () => {
    keys.clear();
    Input.stick = null;
    Input.move.x = 0;
    Input.move.y = 0;
    Input.attackButton = false;
    Input.attackQueued = false;
    Input.fire = false;
  });

  Input.RADIUS = RADIUS;
  window.Input = Input;
})();
