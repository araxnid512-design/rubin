// Игровой интерфейс для горизонтального экрана телефона и ПК.
// Телефон: плавающий джойстик слева (до упора — бег), справа — кнопка огня-стик (нажать — огонь с автонаведением,
// сдвинуть пальцем — ручной прицел), перезарядка, смена оружия, граната (сдвинуть — дуга броска), контекстное действие
// с кольцом удержания, быстрое лечение, быстрые приказы отряду; щипок двумя пальцами — масштаб камеры.
import { V3 } from '../../engine/math.js';
import { Game, events, MSG } from '../state.js';
import { weapon, itemName, item } from '../items.js';
import { h, btn, bar, clear, short } from './dom.js';
import { MapView } from './mapview.js';
import { throwVelocity, trajectory, MAX_THROW } from '../mechanics.js';

const ARROWS = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
const verb = (p) => { const t = (p || '').split(':')[0].trim(); return t.length > 16 ? t.slice(0, 15) + '…' : t; };
const cap = (el, id) => { try { el.setPointerCapture(id); } catch (e) { /* указатель уже отпущен */ } };
const vib = (app, ms) => { if (!app.settings.vibration) return; try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* нет вибрации */ } };

export class HUD {
  constructor(root, app) {
    this.root = root; this.app = app; this.feedItems = []; this.vig = 0; this.trackerT = 0; this.slotsT = 0; this.fpsT = 0; this.holdP = -1;
    this.build();
    events.on('message', (t, k) => this.onMessage(t, k));
    events.on('player_hit', (a) => { this.vig = Math.min(1, this.vig + a / 30); vib(this.app, 35); });
    events.on('hold_progress', (p, l) => this.onHold(p, l));
    events.on('inventory', () => this.refreshSlots());
    events.on('equipment', () => this.refreshSlots());
  }
  build() {
    const app = this.app, inp = app.input;
    this.vignette = h('div.vignette');
    this.overlay = h('canvas.overlay');
    // состояние генерала
    this.hpBar = bar(100, 'var(--hp)', 'hp'); this.stBar = bar(100, 'var(--stam)', 'thin'); this.radBar = bar(0, 'var(--rad)', 'thin');
    this.foodBar = bar(80, 'var(--food)', 'thin'); this.waterBar = bar(80, 'var(--water)', 'thin');
    this.hpText = h('b.num', {}, '100'); this.armorText = h('span.dim', {}, '');
    this.bleedTag = h('span.tag.bleed', { hidden: true }, 'КРОВОТЕЧЕНИЕ');
    this.beltBox = h('span.belt');
    this.detector = h('div.detector', { hidden: true });
    this.status = h('div.panel.status', {},
      h('div.row', {}, h('span.title', {}, 'Генерал «Долга»'), h('span.grow'), this.armorText),
      h('div.row', {}, h('span.lab', {}, 'ЗД'), this.hpBar, this.hpText),
      h('div.row', {}, h('span.lab', {}, 'ВЫН'), this.stBar),
      h('div.row.needs', {}, h('span.lab', {}, 'ЕДА'), this.foodBar, h('span.lab', {}, 'ВОДА'), this.waterBar),
      this.radRow = h('div.row', {}, h('span.lab.rad', {}, 'РАД'), this.radBar),
      h('div.row', {}, this.bleedTag, this.beltBox),
      this.detector);
    this.feed = h('div.feed');
    // трекер и баннер набега
    this.trTitle = h('span.tr-title'); this.trArrow = h('span.tr-arrow'); this.trList = h('div.tr-list');
    this.tracker = h('div.panel.tracker', { onclick: () => app.open('journal') }, h('div.row', {}, this.trTitle, h('span.grow'), this.trArrow), this.trList);
    this.raidBanner = h('div.raid-banner', { hidden: true });
    // мини-карта и меню
    this.mmCanvas = h('canvas.minimap', { onclick: () => app.open('map') });
    this.minimap = new MapView(this.mmCanvas, { meters: 110, round: true });
    this.clock = h('div.clock');
    const side = h('div.side', {}, this.mmCanvas, this.clock,
      h('div.btn-grid', {}, btn('Карта', () => app.open('map'), 'sm'), btn('Журнал', () => app.open('journal'), 'sm'), btn('Меню', () => app.open('pause'), 'sm'),
        btn('Рюкзак', () => app.open('inventory'), 'sm'), btn('Отряд', () => app.open('squad'), 'sm'), btn('Стройка', () => app.open('build'), 'sm')));
    // слоты
    this.weaponBox = h('div.slots.weapon-slots'); this.quickBox = h('div.slots');
    this.bottom = h('div.bottom', {}, this.weaponBox, h('span.gap'), this.quickBox);
    this.interactLabel = h('div.interact-label');
    this.holdLabel = h('div.hold-label'); this.holdBar = bar(0, 'var(--warn)', 'hold');
    this.holdBox = h('div.hold', { hidden: true }, this.holdLabel, this.holdBar);
    this.fps = h('div.fps', { hidden: true });
    // ---------------- сенсорное управление
    this.pinch = h('div.pinch');
    this.joyBase = h('div.joy-base', {}, this.joyKnob = h('div.joy-knob'));
    this.joyZone = h('div.joy-zone', {}, this.joyBase);
    const tb = (cls, main, sub) => { const el = h('div.tbtn.' + cls, {}, h('b', {}, main), h('small', {}, sub || '')); return el; };
    this.fireBtn = tb('fire', 'ОГОНЬ', ''); this.fireKnob = h('i.stick'); this.fireBtn.append(this.fireKnob);
    this.reloadBtn = tb('reload', 'R', 'перезар.');
    this.swapBtn = tb('swap', '⇄', '');
    this.nadeBtn = tb('nade', 'ГРАН', ''); this.nadeKnob = h('i.stick'); this.nadeBtn.append(this.nadeKnob);
    this.useBtn = tb('use', '✋', 'действие');
    this.healBtn = tb('heal', '+', 'лечение');
    this.ordersBtn = tb('orders', 'ПРИКАЗ', 'отряд');
    this.sprintBtn = tb('sprint', '»', 'бег');
    this.ordersBar = h('div.orders-bar', { hidden: true },
      [['За мной', 'follow'], ['Стоять здесь', 'hold'], ['Оборона', 'defend'], ['Вольно', 'idle']].map(([t, o]) => btn(t, () => this.quickOrder(o), 'order')));
    this.touch = h('div.touch', {}, this.pinch, this.joyZone, this.fireBtn, this.reloadBtn, this.swapBtn, this.nadeBtn, this.useBtn, this.healBtn, this.ordersBtn, this.sprintBtn, this.ordersBar);
    const press = (el, on, off = () => {}) => {
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); cap(el, e.pointerId); el.classList.add('down'); on(e); });
      const up = (e) => { if (!el.classList.contains('down')) return; el.classList.remove('down'); off(e); };
      el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
    };
    const pl = () => app.world && app.world.player;
    // огонь: нажать — автонаведение; сдвинуть палец — ручной прицел в эту сторону
    this.stick(this.fireBtn, this.fireKnob, {
      down: () => { inp.touch.fire = true; inp.touch.aim = null; vib(app, 12); },
      move: (x, y, l) => { inp.touch.aim = l > 0.22 ? [x, y] : null; },
      up: () => { inp.touch.fire = false; inp.touch.aim = null; },
    });
    // граната: нажать и отпустить — бросок в цель или вперёд; сдвинуть — дуга броска, отпустить — бросок
    this.stick(this.nadeBtn, this.nadeKnob, {
      down: () => { const p = pl(); if (p) p.grenadeAim = null; },
      move: (x, y, l) => { const p = pl(); if (!p) return; p.grenadeAim = l > 0.2 ? this.stickToGround(p, x, y, l) : null; },
      up: () => { const p = pl(); if (!p) return; const t = p.grenadeAim || (p.previewTarget ? p.previewTarget.pos : null); p.grenadeAim = null; p.throwGrenade(t); },
    });
    press(this.reloadBtn, () => pl() && pl().startReload());
    press(this.swapBtn, () => { const p = pl(); if (p) p.switchSlot(1 - p.activeSlot); });
    press(this.useBtn, () => { inp.touch.interact = true; vib(app, 8); }, () => { inp.touch.interact = false; });
    press(this.healBtn, () => pl() && pl().quickHeal());
    press(this.ordersBtn, () => { this.ordersBar.hidden = !this.ordersBar.hidden; });
    press(this.sprintBtn, () => { inp.touch.sprint = !inp.touch.sprint; });
    this.setupJoystick(); this.setupPinch();
    clear(this.root).append(this.overlay, this.vignette, this.touch, this.status, this.feed, this.tracker, this.raidBanner, side, this.bottom, this.interactLabel, this.holdBox, this.fps);
    this.applySettings();
  }
  // кнопка-стик: смещение пальца от точки нажатия → вектор [-1..1]
  stick(el, knob, { down, move, up }) {
    let id = null, cx = 0, cy = 0;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault(); if (id !== null) return; id = e.pointerId; cap(el, e.pointerId); el.classList.add('down');
      const r = el.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; down();
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      const R = el.offsetWidth * 0.75; let dx = e.clientX - cx, dy = e.clientY - cy; const l = Math.hypot(dx, dy);
      if (l > R) { dx *= R / l; dy *= R / l; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`; el.classList.toggle('aiming', l > R * 0.22);
      move(dx / R, dy / R, Math.min(1, l / R));
    });
    const end = (e) => { if (e.pointerId !== id) return; id = null; el.classList.remove('down', 'aiming'); knob.style.transform = ''; up(); };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  }
  // направление стика на экране → точка на земле (дальность броска пропорциональна сдвигу)
  stickToGround(p, x, y, l) {
    const cam = this.app.cam, cr = cam.right, cf = new V3(cam.fwd.x, 0, cam.fwd.z).norm();
    const dir = new V3(cr.x * x - cf.x * y, 0, cr.z * x - cf.z * y).norm();
    return p.pos.add(dir.mul(4 + (MAX_THROW - 4) * Math.min(1, l)));
  }
  setupJoystick() {
    const z = this.joyZone, inp = this.app.input; let id = null, cx = 0, cy = 0;
    const R = () => this.joyBase.offsetWidth * 0.5 || 60;
    const set = (x, y) => {
      const r = R(); let dx = x - cx, dy = y - cy; const l = Math.hypot(dx, dy); if (l > r) { dx *= r / l; dy *= r / l; }
      this.joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
      const m = Math.min(1, l / r), dead = 0.1, k = m < dead ? 0 : (m - dead) / (1 - dead) / Math.max(m, 1e-4);
      inp.touch.move = [dx / r * k, dy / r * k];
      this.joyBase.classList.toggle('run', m > 0.93 && this.app.settings.autoSprint);
    };
    z.addEventListener('pointerdown', (e) => {
      if (id !== null) return; id = e.pointerId; cap(z, e.pointerId);
      const zr = z.getBoundingClientRect();
      if (this.app.settings.joyFloat) { cx = e.clientX; cy = e.clientY; this.joyBase.style.left = (cx - zr.left) + 'px'; this.joyBase.style.top = (cy - zr.top) + 'px'; }
      else { const br = this.joyBase.getBoundingClientRect(); cx = br.left + br.width / 2; cy = br.top + br.height / 2; }
      this.joyBase.classList.add('active'); set(e.clientX, e.clientY); e.preventDefault();
    });
    z.addEventListener('pointermove', (e) => { if (e.pointerId === id) set(e.clientX, e.clientY); });
    const end = (e) => { if (e.pointerId !== id) return; id = null; inp.touch.move = [0, 0]; this.joyKnob.style.transform = ''; this.joyBase.classList.remove('active', 'run'); this.joyBase.style.left = ''; this.joyBase.style.top = ''; };
    z.addEventListener('pointerup', end); z.addEventListener('pointercancel', end); z.addEventListener('lostpointercapture', end);
  }
  // щипок двумя пальцами по свободной части экрана — масштаб камеры
  setupPinch() {
    const pts = new Map(); let d0 = 0, z0 = 1;
    const dist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
    this.pinch.addEventListener('pointerdown', (e) => { pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); cap(this.pinch, e.pointerId); if (pts.size === 2) { d0 = dist(); z0 = this.app.cam.zoom; } });
    this.pinch.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2 && d0 > 10) this.app.cam.setZoom(z0 * d0 / Math.max(10, dist()));
    });
    const end = (e) => { pts.delete(e.pointerId); if (pts.size < 2 && d0) { d0 = 0; this.app.settings.save(); } };
    this.pinch.addEventListener('pointerup', end); this.pinch.addEventListener('pointercancel', end);
  }
  quickOrder(o) {
    const w = this.app.world, pl = w.player; let n = 0;
    for (const so of w.soldiers) {
      if (!so.alive || so.pos.dist(pl.pos) > 45) continue; // приказ — бойцам рядом с генералом
      if (o === 'hold') so.giveOrder('guard', so.pos.clone()); else so.giveOrder(o); n++;
    }
    const names = { follow: '«За мной»', hold: '«Стоять здесь»', defend: '«Занять оборону»', idle: '«Вольно»' };
    events.emit('message', n ? `Приказ ${names[o]}: ${n} бойц.` : 'Рядом нет бойцов (до 45 м).', n ? MSG.INFO : MSG.ALERT);
    this.ordersBar.hidden = true;
  }
  applySettings() {
    const s = this.app.settings;
    this.touch.hidden = !s.useTouch() || !!this.app.win;
    this.fps.hidden = !s.showFps;
    this.root.style.setProperty('--joy', s.joystickSize);
    this.root.style.setProperty('--bs', s.buttonScale || 1);
    this.root.classList.toggle('touch-mode', s.useTouch());
    this.touch.classList.toggle('lefty', !!s.lefty);
    this.sprintBtn.hidden = s.autoSprint !== false;
    this.joyBase.classList.toggle('fixed', !s.joyFloat);
  }
  setPlaying(on) { this.root.hidden = !on; }
  onWindow(open) {
    this.touch.hidden = open || !this.app.settings.useTouch();
    if (open) { const t = this.app.input.touch; t.fire = false; t.interact = false; t.move = [0, 0]; t.aim = null; this.ordersBar.hidden = true; }
  }
  // ---------------- обновление кадра
  update(dt, stats) {
    const app = this.app, p = app.world && app.world.player; if (!p) return;
    this.hpBar.set(p.hp); this.hpText.textContent = Math.ceil(p.hp); this.stBar.set(p.stamina); this.radBar.set(p.radiation);
    this.foodBar.set(p.hunger); this.waterBar.set(p.thirst);
    this.radRow.hidden = p.radiation < 0.5; this.armorText.textContent = `броня ${Math.round(Math.min(0.6, p.armor + p.beltFx().armor) * 100)}%`;
    this.bleedTag.hidden = !(p.bleed > 0);
    const beltKey = p.belt.join(',');
    if (beltKey !== this._belt) { this._belt = beltKey; clear(this.beltBox).append(...p.belt.map((id) => { const c = item(id).color; return h('i', { title: itemName(id), style: { background: `rgb(${c.map((x) => Math.round(x * 255)).join(',')})` } }); })); }
    const det = app.world.artifacts && app.world.artifacts.nearest;
    this.detector.hidden = !det;
    if (det) { const k = Math.max(1, Math.min(5, Math.round(5 - det.d / 6))); this.detector.textContent = `Детектор «Отклик»: ${'▮'.repeat(k)}${'▯'.repeat(5 - k)} ${Math.round(det.d)} м`; }
    const raids = app.world.raids;
    this.raidBanner.hidden = !(raids && raids.active);
    if (raids && raids.active) this.raidBanner.textContent = `НАБЕГ у ${raids.route.name} — противников: ${raids.alive()}`;
    // контекстная кнопка действия
    const f = p.focus, touch = app.settings.useTouch();
    this.interactLabel.textContent = f && !p.holding ? f.prompt() + (touch ? '' : '  [E]') : '';
    this.useBtn.classList.toggle('off', !(f || p.holding));
    this.useBtn.classList.toggle('ready', !!f && !p.holding);
    this.useBtn.lastChild.textContent = p.holding ? 'держите…' : f ? verb(f.prompt()) : 'действие';
    this.useBtn.style.setProperty('--p', p.holding && this.holdP >= 0 ? this.holdP : 0);
    this.sprintBtn.classList.toggle('on', !!app.input.touch.sprint);
    // огонь, перезарядка, оружие, гранаты, лечение
    const e = p.weaponEntry ? p.weaponEntry() : null, w = p.weaponId ? weapon(p.weaponId) : null;
    this.fireBtn.querySelector('small').textContent = w ? `${p.mag} / ${p.availableReserve()}` : 'нет оружия';
    this.fireBtn.classList.toggle('target', !!p.previewTarget);
    const lowMag = w && (p.mag <= Math.ceil(w.mag * 0.25)) && p.availableReserve() > 0;
    this.reloadBtn.classList.toggle('pulse', !!(p.jammed || lowMag) && !p.reloading);
    this.reloadBtn.firstChild.textContent = p.jammed ? '!' : 'R'; this.reloadBtn.lastChild.textContent = p.jammed ? 'заклинило' : p.reloading ? '…' : 'перезар.';
    const other = Game.equip[p.activeSlot === 0 ? 'pistol' : 'primary'];
    this.swapBtn.classList.toggle('off', !other);
    this.swapBtn.lastChild.textContent = w ? short(w.name) + (e && e.cond !== undefined ? ` ${Math.round(e.cond)}%` : '') : '—';
    const nades = Game.inv.count('grenade_rgd5') + Game.inv.count('grenade_f1');
    this.nadeBtn.classList.toggle('off', !nades); this.nadeBtn.querySelector('small').textContent = `×${nades}`;
    const meds = Game.inv.count('bandage') + Game.inv.count('medkit');
    this.healBtn.lastChild.textContent = `×${meds}`;
    this.healBtn.classList.toggle('pulse', p.bleed > 0 || p.hp < 40);
    if (app.input.pressed('orders')) this.ordersBar.hidden = !this.ordersBar.hidden;
    this.vig = Math.max(0, this.vig - dt * 0.8);
    const low = p.hp < 30 ? 0.35 + Math.sin(performance.now() * 0.006) * 0.1 : 0;
    this.vignette.style.opacity = Math.max(this.vig, low, p.bleed > 0 ? 0.12 : 0).toFixed(3);
    this.clock.textContent = `${Game.timeStr()}  ${Game.powerOn ? '⚡ питание' : '— нет питания'}`;
    this.trackerT -= dt; if (this.trackerT <= 0) { this.trackerT = 0.5; this.refreshTracker(); }
    this.slotsT -= dt; if (this.slotsT <= 0) { this.slotsT = 0.4; this.refreshSlots(); }
    this.minimap.world = app.world; this.minimap.quest = app.quest; this.minimap.draw();
    for (let i = this.feedItems.length - 1; i >= 0; i--) {
      const it = this.feedItems[i]; it.t -= dt;
      if (it.t < 1) it.el.style.opacity = Math.max(0, it.t);
      if (it.t <= 0) { it.el.remove(); this.feedItems.splice(i, 1); }
    }
    if (!this.fps.hidden && stats) { this.fpsT -= dt; if (this.fpsT <= 0) { this.fpsT = 0.5; this.fps.textContent = `FPS ${stats.fps.toFixed(0)} · кадр ${stats.ms.toFixed(1)} мс · логика ${stats.logic.toFixed(1)} мс · вызовов ${stats.dc} · треуг. ${(stats.tris / 1000).toFixed(0)}k · ${stats.w}×${stats.h}`; } }
    this.drawOverlay();
  }
  refreshTracker() {
    const q = this.app.quest; if (!q) return;
    this.trTitle.textContent = q.currentTitle();
    clear(this.trList);
    for (const o of q.objectives()) this.trList.append(h('div.obj' + (o.done ? '.done' : ''), {}, (o.done ? '✓ ' : '• ') + o.text));
    const m = q.marker(), pl = this.app.world.player;
    if (m && pl) { const dx = m.x - pl.pos.x, dz = m.z - pl.pos.z, ang = Math.atan2(dx, -dz); let i = Math.round(ang / (Math.PI / 4)) % 8; if (i < 0) i += 8; this.trArrow.textContent = `${ARROWS[i]} ${Math.round(Math.hypot(dx, dz))} м`; }
    else this.trArrow.textContent = '';
  }
  refreshSlots() {
    const p = this.app.world && this.app.world.player; if (!p) return;
    clear(this.weaponBox); clear(this.quickBox);
    for (const s of [0, 1]) {
      const e = Game.equip[s === 0 ? 'primary' : 'pistol'], active = p.activeSlot === s;
      let label = s === 0 ? 'основное —' : 'пистолет —';
      if (e) { const w = weapon(e.id); label = `${w.name}\n${active ? p.mag : e.ammo || 0}/${Game.inv.count(w.ammo)}`; }
      this.weaponBox.append(btn(label, () => p.switchSlot(s), 'slot' + (active ? ' active' : '')));
    }
    for (let i = 0; i < 4; i++) {
      const id = Game.quick[i] || '';
      this.quickBox.append(btn(id ? `${short(itemName(id))}\n×${Game.inv.count(id)}` : '+', () => (id ? p.useQuick(i) : this.app.open('inventory')), 'slot quick'));
    }
  }
  onMessage(text, kind) {
    const el = h('div.msg.k' + Math.max(0, Math.min(3, kind)), {}, text);
    this.feed.append(el); this.feedItems.push({ el, t: 6 });
    while (this.feedItems.length > 5) { this.feedItems[0].el.remove(); this.feedItems.shift(); }
    if (kind === MSG.RADIO && this.app.quest) this.app.quest.addLog(text);
  }
  onHold(p, label) {
    this.holdP = p;
    if (p <= -2) { this.holdBox.hidden = true; return; }
    this.holdBox.hidden = false; this.holdLabel.textContent = label;
    this.holdBar.set((p >= 0 ? p : (performance.now() / 1000) % 1) * 100);
  }
  // ---------------- подписи в мире, цель, прицел, дуга гранаты, маркер задания
  drawOverlay() {
    const c = this.overlay, dpr = Math.min(2, devicePixelRatio || 1), W = Math.round(c.clientWidth * dpr), H = Math.round(c.clientHeight * dpr);
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const ctx = c.getContext('2d'); ctx.clearRect(0, 0, W, H);
    const world = this.app.world, cam = this.app.cam, pl = world.player; if (!pl) return;
    ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    const proj = (p) => { const s = cam.project(p, W, H); return s && s.inside ? s : null; };
    const ring = (p, r, col, w = 2.5) => { // окружность на земле
      ctx.strokeStyle = col; ctx.lineWidth = w * dpr; ctx.beginPath();
      for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI * 2, s = cam.project(new V3(p.x + Math.cos(a) * r, 0.05, p.z + Math.sin(a) * r), W, H); if (!s) return; i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y); }
      ctx.stroke();
    };
    ctx.font = `600 ${Math.round(12.5 * dpr)}px 'PT Sans Narrow', 'Arial Narrow', sans-serif`;
    for (const lb of world.labels) {
      const d = lb.pos.dist2(pl.pos); if (d > 30) continue;
      const s = proj(lb.pos); if (!s) continue;
      ctx.globalAlpha = Math.min(1, (30 - d) / 8);
      ctx.lineWidth = 3.5 * dpr; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.strokeText(lb.text, s.x, s.y);
      ctx.fillStyle = lb.color; ctx.fillText(lb.text, s.x, s.y);
    }
    ctx.globalAlpha = 1;
    ctx.font = `${Math.round(11 * dpr)}px 'PT Sans Narrow', 'Arial Narrow', sans-serif`;
    for (const so of world.soldiers) {
      if (!so.alive || so.pos.dist(pl.pos) > 14) continue;
      const s = proj(so.pos.add(new V3(0, 2.15, 0))); if (!s) continue;
      ctx.lineWidth = 3 * dpr; ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.strokeText(so.def.call, s.x, s.y); ctx.fillStyle = '#c9f2d3'; ctx.fillText(so.def.call, s.x, s.y);
      const w = 30 * dpr; ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(s.x - w / 2, s.y + 3 * dpr, w, 3.5 * dpr);
      ctx.fillStyle = so.hp < so.maxHp * 0.3 ? '#e2412e' : '#5fcf6e'; ctx.fillRect(s.x - w / 2, s.y + 3 * dpr, w * so.hp / so.maxHp, 3.5 * dpr);
    }
    // цель автонаведения (жёлтая) / под огнём (красная) + полоска здоровья врага
    const tgt = this.app.input.touch.fire && pl.target && pl.target.alive ? pl.target : pl.previewTarget;
    if (tgt && tgt.alive) {
      const firing = this.app.input.touch.fire || this.app.input.mouse.left;
      ring(tgt.pos, tgt.isDog ? 0.6 : 0.7, firing ? 'rgba(240,64,47,.95)' : 'rgba(255,210,58,.85)');
      const s = proj(tgt.pos.add(new V3(0, tgt.isDog ? 1.1 : 2.1, 0)));
      if (s) { const w = 34 * dpr; ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(s.x - w / 2, s.y, w, 4 * dpr); ctx.fillStyle = '#f0402f'; ctx.fillRect(s.x - w / 2, s.y, w * tgt.hp / tgt.maxHp, 4 * dpr); }
    }
    // линия ручного прицела
    if (pl.manualAim) {
      const a = proj(pl.pos.add(new V3(0, 1.2, 0))), b = proj(pl.pos.add(pl.manualAim.mul(9)).add(new V3(0, 1.2, 0)));
      if (a && b) { ctx.strokeStyle = 'rgba(255,90,60,.8)'; ctx.setLineDash([8 * dpr, 6 * dpr]); ctx.lineWidth = 2 * dpr; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]); }
    }
    // дуга броска гранаты и зона поражения
    if (pl.grenadeAim) {
      const to = pl.clampThrow(pl.grenadeAim), from = pl.grenadeOrigin(), pts = trajectory(from, throwVelocity(from, to), world.phys);
      ctx.strokeStyle = 'rgba(255,220,120,.9)'; ctx.lineWidth = 2.5 * dpr; ctx.beginPath();
      pts.forEach((p, i) => { const s = cam.project(p, W, H); if (s) (i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y)); }); ctx.stroke();
      const land = pts[pts.length - 1], id = pl.grenadeId();
      ring(land, item(id || 'grenade_rgd5').radius || 5, 'rgba(255,120,60,.85)', 2);
    }
    // маркер цели задания: ромб над точкой или стрелка у края экрана
    const m = this.app.quest && this.app.quest.marker();
    if (m) {
      const top = new V3(m.x, 2.4 + Math.sin(performance.now() / 300) * 0.15, m.z), s = cam.project(top, W, H), r = 8 * dpr;
      ctx.fillStyle = '#ffd23a'; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.lineWidth = 2 * dpr;
      if (s && s.inside) { ctx.beginPath(); ctx.moveTo(s.x, s.y - r); ctx.lineTo(s.x + r, s.y); ctx.lineTo(s.x, s.y + r); ctx.lineTo(s.x - r, s.y); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      else {
        const ang = Math.atan2(m.x - pl.pos.x, -(m.z - pl.pos.z));
        const x = W / 2 + Math.sin(ang) * (W * 0.42), y = H / 2 - Math.cos(ang) * (H * 0.36);
        ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
        ctx.beginPath(); ctx.moveTo(0, -r * 1.5); ctx.lineTo(r, r * 0.6); ctx.lineTo(-r, r * 0.6); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      }
    }
  }
}
