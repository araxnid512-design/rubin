// Движок «Долг»: шина событий (подписка/рассылка).
export class EventBus {
  constructor() { this.h = new Map(); }
  on(name, fn) { if (!this.h.has(name)) this.h.set(name, new Set()); this.h.get(name).add(fn); return () => this.off(name, fn); }
  off(name, fn) { this.h.get(name)?.delete(fn); }
  emit(name, ...args) { const s = this.h.get(name); if (s) for (const fn of [...s]) { try { fn(...args); } catch (e) { console.error('event', name, e); } } }
  clear() { this.h.clear(); }
}
