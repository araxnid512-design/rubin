// Настройки: качество графики, дальность прорисовки, звук, управление. Хранятся в localStorage.
export const PRESETS = [
  { name: 'Низкое', shadows: false, shadowSize: 1024, shadowDist: 24, scale: 0.6, grass: 0.25, draw: 70, fps: 30, detail: 0, lights: false, fog: true },
  { name: 'Среднее', shadows: true, shadowSize: 1024, shadowDist: 30, scale: 0.75, grass: 0.55, draw: 95, fps: 30, detail: 1, lights: true, fog: true },
  { name: 'Высокое', shadows: true, shadowSize: 2048, shadowDist: 42, scale: 1.0, grass: 1.0, draw: 140, fps: 60, detail: 1, lights: true, fog: true },
];
const KEY = 'dolg_settings';
const isTouchDevice = () => (typeof window !== 'undefined') && (('ontouchstart' in window) || navigator.maxTouchPoints > 0);

export class Settings {
  constructor() {
    this.quality = isTouchDevice() ? 1 : 2;
    this.applyPreset(this.quality);
    this.volume = 0.8; this.touch = -1; this.joystickSize = 1; this.cameraZoom = isTouchDevice() ? 0.8 : 1; this.dayLength = 24; this.showFps = false; this.listeners = [];
    try { Object.assign(this, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* без сохранённых настроек */ }
  }
  applyPreset(q) {
    this.quality = Math.max(0, Math.min(2, q)); const p = PRESETS[this.quality];
    this.shadows = p.shadows; this.renderScale = p.scale; this.grassDensity = p.grass; this.drawDistance = p.draw; this.fpsLimit = p.fps; this.lights = p.lights;
  }
  preset() { return PRESETS[this.quality]; }
  useTouch() { return this.touch === -1 ? isTouchDevice() : this.touch === 1; }
  onChange(fn) { this.listeners.push(fn); }
  save() {
    const o = {}; for (const k of ['quality', 'shadows', 'renderScale', 'grassDensity', 'drawDistance', 'fpsLimit', 'lights', 'volume', 'touch', 'joystickSize', 'cameraZoom', 'dayLength', 'showFps']) o[k] = this[k];
    try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* приватный режим */ }
    for (const f of this.listeners) f(this);
  }
}
