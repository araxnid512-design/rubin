// Игровой интерфейс для горизонтального экрана телефона и ПК: состояние генерала, трекер задания, мини-карта,
// слоты оружия и быстрые слоты, лента сообщений, подсказка действия, полоса удержания,
// сенсорное управление (джойстик, огонь, перезарядка, действие, бег), подписи в мире и маркер цели.
import { V3 } from '../../engine/math.js';
import { Game, events, MSG } from '../state.js';
import { weapon, itemName } from '../items.js';
import { h, btn, bar, clear, short } from './dom.js';
import { MapView } from './mapview.js';

const ARROWS = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];

export class HUD {
  constructor(root, app) {
    this.root = root; this.app = app; this.feedItems = []; this.vig = 0; this.trackerT = 0; this.slotsT = 0; this.fpsT = 0;
    this.build();
    events.on('message', (t, k) => this.onMessage(t, k));
    events.on('player_hit', (a) => { this.vig = Math.min(1, this.vig + a / 30); });
    events.on('hold_progress', (p, l) => this.onHold(p, l));
    events.on('inventory', () => this.refreshSlots());
    events.on('equipment', () => this.refreshSlots());
  }
  build() {
    const app = this.app, inp = app.input;
    this.vignette = h('div.vignette');
    this.overlay = h('canvas.overlay');
    // состояние
    this.hpBar = bar(100, 'var(--hp)', 'hp'); this.stBar = bar(100, 'var(--stam)', 'thin'); this.radBar = bar(0, 'var(--rad)', 'thin');
    this.hpText = h('b.num', {}, '100'); this.armorText = h('span.dim', {}, '');
    this.status = h('div.panel.status', {}, h('div.row', {}, h('span.title', {}, 'Генерал «Долга»'), h('span.grow'), this.armorText),
      h('div.row', {}, h('span.lab', {}, 'ЗД'), this.hpBar, this.hpText), h('div.row', {}, h('span.lab', {}, 'ВЫН'), this.stBar), this.radRow = h('div.row', {}, h('span.lab.rad', {}, 'РАД'), this.radBar));
    this.feed = h('div.feed');
    // трекер
    this.trTitle = h('span.tr-title'); this.trArrow = h('span.tr-arrow'); this.trList = h('div.tr-list');
    this.tracker = h('div.panel.tracker', { onclick: () => app.open('journal') }, h('div.row', {}, this.trTitle, h('span.grow'), this.trArrow), this.trList);
    // мини-карта
    this.mmCanvas = h('canvas.minimap', { onclick: () => app.open('map') });
    this.minimap = new MapView(this.mmCanvas, { meters: 110, round: true });
    this.clock = h('div.clock');
    const side = h('div.side', {}, this.mmCanvas, this.clock,
      h('div.btn-grid', {}, btn('Карта', () => app.open('map'), 'sm'), btn('Журнал', () => app.open('journal'), 'sm'), btn('Меню', () => app.open('pause'), 'sm'),
        btn('Рюкзак', () => app.open('inventory'), 'sm'), btn('Отряд', () => app.open('squad'), 'sm'), btn('Стройка', () => app.open('build'), 'sm')));
    // слоты
    this.weaponBox = h('div.slots'); this.quickBox = h('div.slots');
    this.bottom = h('div.bottom', {}, this.weaponBox, h('span.gap'), this.quickBox);
    // действие и удержание
    this.interactLabel = h('div.interact-label');
    this.holdLabel = h('div.hold-label'); this.holdBar = bar(0, 'var(--warn)', 'hold');
    this.holdBox = h('div.hold', { hidden: true }, this.holdLabel, this.holdBar);
    this.fps = h('div.fps', { hidden: true });
    // сенсорное управление
    this.joyBase = h('div.joy-base', {}, this.joyKnob = h('div.joy-knob'));
    this.joyZone = h('div.joy-zone', {}, this.joyBase);
    const press = (el, on, off) => {
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.setPointerCapture?.(e.pointerId); el.classList.add('down'); on(); });
      const up = (e) => { el.classList.remove('down'); off(); };
      el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
    };
    this.fireBtn = h('div.tbtn.fire', {}, h('b', {}, 'ОГОНЬ'), this.fireSub = h('small'));
    press(this.fireBtn, () => { inp.touch.fire = true; }, () => { inp.touch.fire = false; });
    this.reloadBtn = h('div.tbtn.reload', {}, h('b', {}, 'R'), h('small', {}, 'перезар.'));
    press(this.reloadBtn, () => app.world.player && app.world.player.startReload(), () => {});
    this.useBtn = h('div.tbtn.use', {}, h('b', {}, '✋'), h('small', {}, 'действие'));
    press(this.useBtn, () => { inp.touch.interact = true; }, () => { inp.touch.interact = false; });
    this.sprintBtn = h('div.tbtn.sprint', {}, h('b', {}, '»'), h('small', {}, 'бег'));
    press(this.sprintBtn, () => { inp.touch.sprint = !inp.touch.sprint; }, () => {});
    this.touch = h('div.touch', {}, this.joyZone, this.fireBtn, this.reloadBtn, this.useBtn, this.sprintBtn);
    this.setupJoystick();
    clear(this.root).append(this.overlay, this.vignette, this.status, this.feed, this.tracker, side, this.bottom, this.interactLabel, this.holdBox, this.touch, this.fps);
    this.applySettings();
  }
  setupJoystick() {
    const z = this.joyZone, inp = this.app.input; let id = null, cx = 0, cy = 0;
    const R = () => this.joyBase.offsetWidth * 0.5 || 60;
    const set = (x, y) => {
      const r = R(); let dx = x - cx, dy = y - cy; const l = Math.hypot(dx, dy); if (l > r) { dx *= r / l; dy *= r / l; }
      this.joyKnob.style.transform = `translate(${dx}px, ${dy}px)`; inp.touch.move = [dx / r, dy / r];
    };
    z.addEventListener('pointerdown', (e) => {
      if (id !== null) return; id = e.pointerId; z.setPointerCapture?.(e.pointerId);
      const zr = z.getBoundingClientRect(); cx = e.clientX; cy = e.clientY;
      this.joyBase.style.left = (cx - zr.left) + 'px'; this.joyBase.style.top = (cy - zr.top) + 'px'; this.joyBase.classList.add('active'); set(e.clientX, e.clientY); e.preventDefault();
    });
    z.addEventListener('pointermove', (e) => { if (e.pointerId === id) set(e.clientX, e.clientY); });
    const end = (e) => { if (e.pointerId !== id) return; id = null; inp.touch.move = [0, 0]; this.joyKnob.style.transform = ''; this.joyBase.classList.remove('active'); this.joyBase.style.left = ''; this.joyBase.style.top = ''; };
    z.addEventListener('pointerup', end); z.addEventListener('pointercancel', end); z.addEventListener('lostpointercapture', end);
  }
  applySettings() {
    const s = this.app.settings;
    this.touch.hidden = !s.useTouch() || !!this.app.win;
    this.fps.hidden = !s.showFps;
    this.root.style.setProperty('--joy', s.joystickSize);
    this.root.classList.toggle('touch-mode', s.useTouch());
  }
  setPlaying(on) { this.root.hidden = !on; }
  onWindow(open) { this.touch.hidden = open || !this.app.settings.useTouch(); if (open) { const t = this.app.input.touch; t.fire = false; t.interact = false; t.move = [0, 0]; } }
  // ---------------- обновление кадра
  update(dt, stats) {
    const p = this.app.world && this.app.world.player; if (!p) return;
    this.hpBar.set(p.hp); this.hpText.textContent = Math.ceil(p.hp); this.stBar.set(p.stamina); this.radBar.set(p.radiation);
    this.radRow.hidden = p.radiation < 0.5; this.armorText.textContent = `броня ${Math.round(p.armor * 100)}%`;
    const f = p.focus, touch = this.app.settings.useTouch();
    this.interactLabel.textContent = f && !p.holding ? f.prompt() + (touch ? '' : '  [E]') : '';
    this.useBtn.classList.toggle('off', !(f || p.holding));
    this.sprintBtn.classList.toggle('on', !!this.app.input.touch.sprint);
    this.fireSub.textContent = p.weaponId ? `${p.mag} / ${p.availableReserve()}` : 'нет оружия';
    this.vig = Math.max(0, this.vig - dt * 0.8);
    const low = p.hp < 30 ? 0.35 + Math.sin(performance.now() * 0.006) * 0.1 : 0;
    this.vignette.style.opacity = Math.max(this.vig, low).toFixed(3);
    this.clock.textContent = `${Game.timeStr()}  ${Game.powerOn ? '⚡ питание' : '— нет питания'}`;
    this.trackerT -= dt; if (this.trackerT <= 0) { this.trackerT = 0.5; this.refreshTracker(); }
    this.slotsT -= dt; if (this.slotsT <= 0) { this.slotsT = 0.4; this.refreshSlots(); }
    this.minimap.world = this.app.world; this.minimap.quest = this.app.quest; this.minimap.draw();
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
    if (p <= -2) { this.holdBox.hidden = true; return; }
    this.holdBox.hidden = false; this.holdLabel.textContent = label;
    this.holdBar.set((p >= 0 ? p : (performance.now() / 1000) % 1) * 100);
  }
  // ---------------- подписи в мире и маркер цели
  drawOverlay() {
    const c = this.overlay, dpr = Math.min(2, devicePixelRatio || 1), W = Math.round(c.clientWidth * dpr), H = Math.round(c.clientHeight * dpr);
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const ctx = c.getContext('2d'); ctx.clearRect(0, 0, W, H);
    const world = this.app.world, cam = this.app.cam, pl = world.player; if (!pl) return;
    ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    const proj = (p) => { const s = cam.project(p, W, H); return s && s.inside ? s : null; };
    ctx.font = `600 ${Math.round(12.5 * dpr)}px 'PT Sans Narrow', 'Arial Narrow', sans-serif`;
    for (const lb of world.labels) {
      const d = lb.pos.dist2(pl.pos); if (d > 30) continue;
      const s = proj(lb.pos); if (!s) continue;
      ctx.globalAlpha = Math.min(1, (30 - d) / 8);
      ctx.lineWidth = 3.5 * dpr; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.strokeText(lb.text, s.x, s.y);
      ctx.fillStyle = lb.color; ctx.fillText(lb.text, s.x, s.y);
    }
    ctx.globalAlpha = 1;
    // позывные бойцов рядом
    ctx.font = `${Math.round(11 * dpr)}px 'PT Sans Narrow', 'Arial Narrow', sans-serif`;
    for (const so of world.soldiers) {
      if (!so.alive || so.pos.dist(pl.pos) > 14) continue;
      const s = proj(so.pos.add(new V3(0, 2.15, 0))); if (!s) continue;
      ctx.lineWidth = 3 * dpr; ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.strokeText(so.def.call, s.x, s.y); ctx.fillStyle = '#c9f2d3'; ctx.fillText(so.def.call, s.x, s.y);
      const w = 30 * dpr; ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(s.x - w / 2, s.y + 3 * dpr, w, 3.5 * dpr);
      ctx.fillStyle = so.hp < so.maxHp * 0.3 ? '#e2412e' : '#5fcf6e'; ctx.fillRect(s.x - w / 2, s.y + 3 * dpr, w * so.hp / so.maxHp, 3.5 * dpr);
    }
    // маркер цели: ромб над точкой или стрелка у края экрана
    const m = this.app.quest && this.app.quest.marker();
    if (m) {
      const top = new V3(m.x, 2.4 + Math.sin(performance.now() / 300) * 0.15, m.z), s = cam.project(top, W, H), r = 8 * dpr;
      ctx.fillStyle = '#ffd23a'; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.lineWidth = 2 * dpr;
      if (s && s.inside) { ctx.beginPath(); ctx.moveTo(s.x, s.y - r); ctx.lineTo(s.x + r, s.y); ctx.lineTo(s.x, s.y + r); ctx.lineTo(s.x - r, s.y); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      else {
        const ps = cam.project(pl.pos.add(new V3(0, 1, 0)), W, H); if (!ps) return;
        const ang = Math.atan2(m.x - pl.pos.x, -(m.z - pl.pos.z));
        const x = W / 2 + Math.sin(ang) * (W * 0.42), y = H / 2 - Math.cos(ang) * (H * 0.36);
        ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
        ctx.beginPath(); ctx.moveTo(0, -r * 1.5); ctx.lineTo(r, r * 0.6); ctx.lineTo(-r, r * 0.6); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      }
    }
  }
}
