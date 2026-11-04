// Управление: справа — газ и нитро, слева — джойстик наклона.
// Тормоза нет: отпустили газ — машина тормозит сама.
// tilt ∈ [-1, 1]: влево (−) — нос вверх, назад; вправо (+) — нос вниз, вперёд.
// Мультитач: газ, нитро и джойстик работают одновременно. Клавиатура — для браузера.
(function () {
  const Input = { gas: false, nitro: false, tilt: 0 };
  const held = { gas: new Set(), nitro: new Set() };
  const keys = new Set();
  const stick = { id: null, x0: 0, value: 0 };

  function refresh() {
    const C = window.CONFIG.CONTROLS;
    Input.gas = held.gas.size > 0 || keys.has('ArrowUp') || keys.has('KeyW');
    Input.nitro = held.nitro.size > 0 || keys.has('Space') || keys.has('ShiftLeft');
    const key = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
    // Чувствительность: мёртвая зона в центре, дальше — плавная кривая.
    const v = stick.value;
    const a = Math.max(0, (Math.abs(v) - C.stickDeadZone) / (1 - C.stickDeadZone));
    Input.tilt = key || Math.sign(v) * Math.pow(a, C.stickCurve);
    for (const k of ['gas', 'nitro']) {
      const el = document.getElementById('btn-' + k);
      if (el) el.classList.toggle('down', Input[k]);
    }
    const knob = document.getElementById('stick-knob');
    if (knob) knob.style.transform = `translateX(${v * C.stickRadius}px)`;
    const zone = document.getElementById('stick');
    if (zone) zone.classList.toggle('down', stick.id !== null);
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

  // Джойстик: центр — там, где коснулись; отклонение по горизонтали — сила наклона.
  function bindStick() {
    const el = document.getElementById('stick');
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (stick.id !== null) return;
      el.setPointerCapture(e.pointerId);
      stick.id = e.pointerId;
      stick.x0 = e.clientX;
      stick.value = 0;
      refresh();
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== stick.id) return;
      const R = window.CONFIG.CONTROLS.stickRadius;
      stick.value = Math.max(-1, Math.min(1, (e.clientX - stick.x0) / R));
      refresh();
    });
    const up = (e) => {
      if (e.pointerId !== stick.id) return;
      stick.id = null;
      stick.value = 0;
      refresh();
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    keys.add(e.code);
    refresh();
  });
  window.addEventListener('keyup', (e) => { keys.delete(e.code); refresh(); });

  Input.reset = function () {
    for (const s of Object.values(held)) s.clear();
    keys.clear();
    stick.id = null;
    stick.value = 0;
    refresh();
  };

  window.addEventListener('DOMContentLoaded', () => { ['gas', 'nitro'].forEach(bind); bindStick(); });
  window.Platform.on('pause', () => Input.reset());

  window.Input = Input;
})();
