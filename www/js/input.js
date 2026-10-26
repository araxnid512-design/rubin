// Ввод: виртуальный стик (левая половина экрана), стрельба (правая половина),
// клавиатура для отладки в браузере (WASD/стрелки, пробел — огонь, Esc — пауза).
(function () {
  const Input = {
    move: { x: 0, y: 0 },
    fire: false,
    stick: null, // { id, ox, oy, x, y } — для отрисовки
  };

  const RADIUS = 60;
  const keys = new Set();
  const firePointers = new Set();

  function updateFire() {
    Input.fire = keys.has('Space') || firePointers.size > 0;
  }

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
      window.Platform.paused ? window.Platform.resume() : window.Platform.pause();
      return;
    }
    keys.add(e.code);
    updateFromKeys();
    updateFire();
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
    updateFromKeys();
    updateFire();
  });

  window.addEventListener('pointerdown', (e) => {
    if (e.target.tagName === 'BUTTON') return;
    if (e.clientX > window.innerWidth / 2) {
      firePointers.add(e.pointerId);
      updateFire();
      return;
    }
    if (Input.stick) return;
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
    if (firePointers.delete(e.pointerId)) {
      updateFire();
      return;
    }
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
    firePointers.clear();
    Input.stick = null;
    Input.move.x = 0;
    Input.move.y = 0;
    Input.fire = false;
  });

  Input.RADIUS = RADIUS;
  window.Input = Input;
})();
