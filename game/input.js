// Ввод: клавиатура и мышь (ПК), сенсорный джойстик и кнопки (телефон).
// Сенсорные элементы рисует HUD; сюда они пишут состояние (move, fire, sprint, interact).
export const KEYMAP = {
  up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft', 'ShiftRight'], interact: ['KeyE', 'KeyF'], reload: ['KeyR'], slot1: ['Digit1'], slot2: ['Digit2'],
  quick1: ['Digit3'], quick2: ['Digit4'], quick3: ['Digit5'], quick4: ['Digit6'], inventory: ['KeyI', 'Tab'], map: ['KeyM'], squad: ['KeyO'],
  build: ['KeyB'], journal: ['KeyJ'], pause: ['Escape'], inspect: ['KeyV'], quicksave: ['F5'], quickload: ['F9'], fps: ['F3'], tactical: ['KeyT'],
};

export class Input {
  constructor(canvas) {
    this.down = new Set(); this.edges = new Set(); this.mouse = { x: 0, y: 0, left: false, right: false, over: true, wheel: 0 };
    this.touch = { move: [0, 0], fire: false, sprint: false, interact: false };
    this.enabled = true; this.uiBlocks = () => false; this.lastDevice = 'kb';
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (['Tab', 'F3', 'F5', 'F9', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      this.down.add(e.code); this.edges.add(e.code); this.lastDevice = 'kb';
    });
    addEventListener('keyup', (e) => this.down.delete(e.code));
    addEventListener('blur', () => { this.down.clear(); this.mouse.left = this.mouse.right = false; });
    canvas.addEventListener('mousemove', (e) => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.over = true; });
    canvas.addEventListener('mousedown', (e) => { if (e.button === 0) this.mouse.left = true; if (e.button === 2) this.mouse.right = true; this.lastDevice = 'kb'; });
    addEventListener('mouseup', (e) => { if (e.button === 0) this.mouse.left = false; if (e.button === 2) this.mouse.right = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => { this.mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    canvas.addEventListener('touchstart', () => { this.lastDevice = 'touch'; }, { passive: true });
  }
  held(action) { return this.enabled && KEYMAP[action].some((k) => this.down.has(k)); }
  pressed(action) { return this.enabled && KEYMAP[action].some((k) => this.edges.has(k)); }
  keyMove() {
    if (!this.enabled) return [0, 0];
    const x = (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0), y = (this.held('down') ? 1 : 0) - (this.held('up') ? 1 : 0);
    const l = Math.hypot(x, y); return l > 0 ? [x / l, y / l] : [0, 0];
  }
  endFrame() { this.edges.clear(); this.mouse.wheel = 0; }
}
