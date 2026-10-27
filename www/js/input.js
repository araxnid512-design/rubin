// Управление: правая кнопка — газ, левая — тормоз/задний ход, отдельная — нитро.
// Мультитач: можно держать газ и нитро одновременно. Клавиатура — для отладки.
(function () {
  const Input = { gas: false, brake: false, nitro: false };
  const held = { gas: new Set(), brake: new Set(), nitro: new Set() };
  const keys = new Set();

  function refresh() {
    Input.gas = held.gas.size > 0 || keys.has('ArrowRight') || keys.has('KeyD');
    Input.brake = held.brake.size > 0 || keys.has('ArrowLeft') || keys.has('KeyA');
    Input.nitro = held.nitro.size > 0 || keys.has('Space') || keys.has('ShiftLeft');
    for (const k of ['gas', 'brake', 'nitro']) {
      const el = document.getElementById('btn-' + k);
      if (el) el.classList.toggle('down', Input[k]);
    }
  }

  function bind(name) {
    const el = document.getElementById('btn-' + name);
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      held[name].add(e.pointerId);
      refresh();
    });
    const up = (e) => { held[name].delete(e.pointerId); refresh(); };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') e.preventDefault();
    keys.add(e.code);
    refresh();
  });
  window.addEventListener('keyup', (e) => { keys.delete(e.code); refresh(); });

  Input.reset = function () {
    for (const s of Object.values(held)) s.clear();
    keys.clear();
    refresh();
  };

  window.addEventListener('DOMContentLoaded', () => ['gas', 'brake', 'nitro'].forEach(bind));
  window.Platform.on('pause', () => Input.reset());

  window.Input = Input;
})();
