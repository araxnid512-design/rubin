// Интерфейс «Линии снабжения» (русский, крупные кнопки, горизонтальный телефон + ПК).
import { V3, M3, Xf } from '../engine/math.js';
import { Renderer, RenderObject } from '../engine/renderer.js';
import { Camera } from '../engine/camera.js';
import { noiseTexture } from '../engine/noise.js';
import { audio } from '../engine/audio.js';
import { SECTORS } from './sim/campaign.js';
import * as M from './world/models.js';

const $ = (s) => document.querySelector(s);
const v = (x, y, z) => new V3(x, y, z);
export function h(tag, props = {}, ...kids) {
  const [t, ...cls] = tag.split('.'); const el = document.createElement(t || 'div'); if (cls.length) el.className = cls.join(' ');
  for (const [k, val] of Object.entries(props || {})) {
    if (val === undefined || val === null || val === false) continue;
    if (k === 'style') Object.assign(el.style, val); else if (k.startsWith('on')) el.addEventListener(k.slice(2), val); else if (k === 'text') el.textContent = val; else el.setAttribute(k, val === true ? '' : val);
  }
  for (const c of kids.flat(9)) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}
const btn = (text, cb, cls = '', dis = false) => { const b = h('button.btn' + (cls ? '.' + cls.split(' ').join('.') : ''), { type: 'button', disabled: dis }, text); b.addEventListener('click', (e) => { e.stopPropagation(); if (!b.disabled) { audio.play('ui', -8); cb(e); } }); return b; };
const clear = (el) => { while (el.firstChild) el.firstChild.remove(); return el; };
const CAT_NAMES = { vehicles: 'ТЕХНИКА', weapons: 'ОРУЖИЕ', ammunition: 'БОЕПРИПАСЫ', military_support: 'ВОЕННОЕ' };
const SECTOR_NAMES = ['№1 Наша территория', '№2 Поле боя', '№3 Вражеская территория'];
const ORDER_NAMES = { follow: 'Следовать', hold_position: 'Стоять', move: 'Идти в точку', patrol: 'Патруль', defend: 'Оборона', mine_scrap: 'Добывать металл', haul_scrap: 'Носить металл', repair: 'Ремонтировать', attack_target: 'Атаковать цель', garrison_bunker: 'Гарнизон бункера' };
const TOOL_NAMES = { tool_hammer: 'Молоток', tool_wrench: 'Гаечный ключ' };

export class UI {
  static mmss(s) { s = Math.max(0, Math.ceil(s)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }
  constructor(app) {
    this.app = app; this.win = null; this.winKind = ''; this.floats = []; this.thumbs = {}; this.tab = 'vehicles';
    this.build();
  }
  // ---------------------------------------------------------------- каркас HUD
  build() {
    const app = this.app, inp = app.input;
    this.hud = $('#hud');
    this.sectorName = h('div.sector-name'); this.scrapVal = h('b.scrap-val', {}, '0'); this.toolName = h('div.tool-name'); this.crew = h('div.crew', { hidden: true });
    const status = h('div.panel.status', {}, this.sectorName, h('div.scrap', {}, h('i.scrap-ico'), h('span', {}, 'МЕТАЛЛОЛОМ'), this.scrapVal), this.toolName, this.crew);
    this.phase = h('div.phase', {}, this.phaseTitle = h('b'), this.phaseSub = h('small'));
    this.mm = h('canvas.minimap'); this.mmBase = document.createElement('canvas');
    const side = h('div.side', {}, this.mm, h('div.side-btns', {}, btn('СКЛАД', () => this.open('storage'), 'sm'), btn('МЕНЮ', () => this.open('pause'), 'sm')));
    this.feed = h('div.feed'); this.fps = h('div.fps', { hidden: true });
    // нижняя панель: 10 ячеек инвентаря
    this.hotbar = h('div.hotbar');
    this.slots = [];
    for (let i = 0; i < 10; i++) { const s = h('button.slot', { type: 'button', onclick: () => { if (app.c.select(i)) { audio.play('ui', -8); this.refreshTool(); } } }); this.slots.push(s); this.hotbar.append(s); }
    this.hotbar.append(btn('ИНВЕНТАРЬ', () => this.open('inventory'), 'inv'));
    // правый кластер: контекстное действие и кнопка инструмента
    this.actBtn = h('button.act', { type: 'button' }, h('b', {}, 'ДЕЙСТВИЕ'), h('small'));
    this.actBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); this.doAction(); });
    this.buildBtn = h('button.act.build', { type: 'button', hidden: true }, h('b', {}, 'СТРОЙКА'), h('small', {}, 'гаечный ключ'));
    this.buildBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); this.open('build'); });
    // джойстик
    this.joyBase = h('div.joy-base', {}, this.joyKnob = h('div.joy-knob'));
    this.joyZone = h('div.joy-zone', {}, this.joyBase);
    this.setupJoystick();
    // режим размещения
    this.placeLayer = h('div.place-layer', { hidden: true });
    this.placeLayer.addEventListener('pointerdown', (e) => { this._drag = e.pointerId; try { this.placeLayer.setPointerCapture(e.pointerId); } catch (_) { /* нет захвата */ } app.moveGhostTo(e.clientX, e.clientY); });
    this.placeLayer.addEventListener('pointermove', (e) => { if (this._drag === e.pointerId || e.pointerType === 'mouse') app.moveGhostTo(e.clientX, e.clientY); });
    this.placeLayer.addEventListener('pointerup', () => { this._drag = null; });
    this.placeInfo = h('div.place-info'); this.placeTitle = h('b'); this.placeWhy = h('small');
    this.confirmBtn = btn('ПОСТРОИТЬ', () => app.confirmPlacement(), 'build-ok');
    this.placeBar = h('div.place-bar', { hidden: true },
      h('div.place-head', {}, this.placeTitle, this.placeWhy),
      h('div.steps', {}, h('span', {}, '1 Перетащите постройку пальцем'), h('span', {}, '→ 2 Поверните'), h('span', {}, '→ 3 Подтвердите')),
      h('div.place-btns', {}, btn('↶ ПОВЕРНУТЬ', () => app.rotate(-90)), btn('ПОВЕРНУТЬ ↷', () => app.rotate(90)), this.confirmBtn, btn('ОТМЕНА', () => app.cancelPlacement(), 'cancel')));
    this.overlay = h('div.floats');
    clear(this.hud).append(this.placeLayer, this.joyZone, this.overlay, status, this.phase, side, this.feed, this.hotbar, this.actBtn, this.buildBtn, this.placeBar, this.fps);
    app.canvas.addEventListener('mousemove', (e) => { if (app.placing) app.moveGhostTo(e.clientX, e.clientY); });
  }
  setupJoystick() {
    const z = this.joyZone, inp = this.app.input; let id = null, cx = 0, cy = 0;
    const R = () => this.joyBase.offsetWidth * 0.5 || 60;
    const set = (x, y) => { const r = R(); let dx = x - cx, dy = y - cy; const l = Math.hypot(dx, dy); if (l > r) { dx *= r / l; dy *= r / l; } this.joyKnob.style.transform = `translate(${dx}px, ${dy}px)`; const m = Math.min(1, l / r), k = m < 0.1 ? 0 : (m - 0.1) / 0.9 / Math.max(m, 1e-4); inp.touch.move = [dx / r * k, dy / r * k]; this.joyBase.classList.toggle('run', m > 0.93); };
    z.addEventListener('pointerdown', (e) => { if (id !== null) return; id = e.pointerId; try { z.setPointerCapture(e.pointerId); } catch (_) { /* нет захвата */ } const zr = z.getBoundingClientRect(); cx = e.clientX; cy = e.clientY; this.joyBase.style.left = (cx - zr.left) + 'px'; this.joyBase.style.top = (cy - zr.top) + 'px'; this.joyBase.classList.add('active'); set(cx, cy); e.preventDefault(); });
    z.addEventListener('pointermove', (e) => { if (e.pointerId === id) set(e.clientX, e.clientY); });
    const end = (e) => { if (e.pointerId !== id) return; id = null; inp.touch.move = [0, 0]; this.joyKnob.style.transform = ''; this.joyBase.classList.remove('active', 'run'); this.joyBase.style.left = ''; this.joyBase.style.top = ''; };
    z.addEventListener('pointerup', end); z.addEventListener('pointercancel', end);
  }
  showMenu(hasSave) {
    $('#hud').hidden = true; $('#menu').hidden = false;
    const box = clear($('#menu-actions'));
    box.append(btn('Новая кампания', () => this.app.start(false), 'primary big'), btn('Продолжить', () => this.app.start(true), 'big', !hasSave),
      btn('Настройки', () => this.open('settings'), 'big'),
      btn('Во весь экран', () => { const el = document.documentElement; (el.requestFullscreen ? el.requestFullscreen() : Promise.reject()).then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => this.toast('Полноэкранный режим недоступен.')); }, 'big'));
    $('#menu-info').textContent = hasSave ? 'Есть сохранённая кампания.' : 'Сохранения хранятся в этом браузере.';
  }
  showGame() { $('#menu').hidden = true; $('#hud').hidden = false; this.close(); this.refreshTool(); this.applySettings(); }
  applySettings() { if (this.fps) this.fps.hidden = !this.app.settings.showFps; this.hud && this.hud.classList.toggle('touch', ('ontouchstart' in window) || navigator.maxTouchPoints > 0); }
  onSector() {
    const s = this.app.sector, n = 150, img = new ImageData(s.terrain.mapImage(n), n, n);
    this.mmBase.width = this.mmBase.height = n; this.mmBase.getContext('2d').putImageData(img, 0, 0);
    this.sectorName.textContent = SECTOR_NAMES[this.app.c.sector_index];
    this.toast(`Сектор: ${SECTOR_NAMES[this.app.c.sector_index]}`, 'info', 3);
  }
  refreshTool() {
    const c = this.app.c, tool = c.selectedTool();
    this.toolName.textContent = 'Инструмент: ' + (TOOL_NAMES[tool] || '—');
    this.slots.forEach((s, i) => { const it = c.inventory.slots[i]; s.textContent = it ? (TOOL_NAMES[it.id] || it.id).replace('Гаечный ключ', 'Ключ') : ''; s.classList.toggle('sel', i === c.inventory.selected); s.classList.toggle('empty', !it); });
    this.buildBtn.hidden = tool !== 'tool_wrench';
    if (this.app.player) this.app.player.setTool(tool);
  }
  // ---------------------------------------------------------------- действие (ДОБЫТЬ / ИСПОЛЬЗОВАТЬ)
  context() {
    const app = this.app; if (!app.sector || app.placing) return null;
    const b = app.nearestBuilding();
    if (b) return { kind: 'use', label: 'ИСПОЛЬЗОВАТЬ', sub: app.c.bdefs[b.rec.id].name_ru, b };
    const np = app.nearestPile();
    if (np && np.d <= app.c.node.interaction_radius_m) {
      const ok = app.c.selectedTool() === 'tool_hammer', n = app.c.sector_index === 0 ? app.c.nodes[np.pile.i].d : 0;
      return { kind: 'mine', label: 'ДОБЫТЬ', sub: ok ? `куча ${n}/${app.c.node.durability_units}` : 'нужен молоток', ok };
    }
    return null;
  }
  doAction() {
    const ctx = this.context(); if (!ctx) return;
    if (ctx.kind === 'mine') this.app.mine();
    if (ctx.kind === 'use') this.open('building', ctx.b.rec.uid);
  }
  keys() {
    const i = this.app.input, app = this.app;
    if (i.pressed('fps')) { app.settings.showFps = !app.settings.showFps; app.applySettings(); }
    if (app.placing) {
      if (i.edges.has('KeyQ')) app.rotate(-90); if (i.edges.has('KeyR')) app.rotate(90);
      if (i.edges.has('Enter')) app.confirmPlacement(); if (i.pressed('pause')) app.cancelPlacement();
      return;
    }
    if (this.win) { if (i.pressed('pause') || (i.pressed('inventory') && this.winKind === 'inventory')) this.close(); return; }
    if (i.pressed('pause')) { this.open('pause'); return; }
    if (i.pressed('inventory')) { this.open('inventory'); return; }
    if (i.pressed('interact')) this.doAction();
    if (i.pressed('build')) { if (app.c.selectedTool() === 'tool_wrench') this.open('build'); else this.toast('Выберите гаечный ключ (клавиша 2).', 'alert'); }
    for (let k = 0; k < 10; k++) if (i.edges.has('Digit' + ((k + 1) % 10))) { if (app.c.select(k)) this.refreshTool(); }
  }
  // ---------------------------------------------------------------- кадр HUD
  update(dt) {
    const app = this.app, c = app.c;
    this.scrapVal.textContent = c.scrap;
    const left = c.prepLeft();
    if (left > 0) { this.phaseTitle.textContent = `ПОДГОТОВКА ${UI.mmss(left)}`; this.phaseSub.textContent = 'поле боя закрыто для обеих сторон'; this.phase.className = 'phase prep'; }
    else { this.phaseTitle.textContent = 'ПОЛЕ БОЯ ОТКРЫТО'; this.phaseSub.textContent = c.sector_index === 0 ? 'проход — северная граница карты' : 'север — вражеская база: вход запрещён'; this.phase.className = 'phase open'; }
    const hasBarracks = c.buildings.some((b) => b.id === 'military_barracks');
    this.crew.hidden = !hasBarracks;
    if (hasBarracks) this.crew.textContent = `Рабочие ${c.count('npc_scrap_worker')} · Механики ${c.count('npc_mechanic')} · Солдаты ${c.count('npc_infantry')}`;
    const ctx = this.context();
    this.actBtn.classList.toggle('off', !ctx); this.actBtn.classList.toggle('warn', !!ctx && ctx.ok === false);
    this.actBtn.firstChild.textContent = ctx ? ctx.label : 'ДЕЙСТВИЕ'; this.actBtn.lastChild.textContent = ctx ? ctx.sub : 'подойдите к объекту';
    if (this.win && this.win.tick) this.win.tick();
    this.drawMinimap();
    for (let k = this.floats.length - 1; k >= 0; k--) { const f = this.floats[k]; f.t -= dt; const s = app.cam.project(f.p.add(v(0, (1 - f.t) * 1.2, 0)), innerWidth, innerHeight); if (s) { f.el.style.transform = `translate(${s.x}px, ${s.y}px)`; } f.el.style.opacity = Math.min(1, f.t * 2); if (f.t <= 0) { f.el.remove(); this.floats.splice(k, 1); } }
    if (!this.fps.hidden) this.fps.textContent = `FPS ${app.stats.fps.toFixed(0)} · кадр ${app.stats.ms.toFixed(1)} мс · вызовов ${app.stats.dc} · треуг. ${Math.round((app.stats.tris || 0) / 1000)}k`;
  }
  floatText(text, p) { const el = h('div.float', {}, text); this.overlay.append(el); this.floats.push({ el, p, t: 1 }); }
  toast(text, kind = 'info', sec = 4.5) {
    const el = h('div.msg.' + kind, {}, text); this.feed.append(el);
    while (this.feed.children.length > 4) this.feed.firstChild.remove();
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 400); }, sec * 1000);
  }
  drawMinimap() {
    const cv = this.mm, dpr = Math.min(2, devicePixelRatio || 1), W = Math.round(cv.clientWidth * dpr) || 1;
    if (cv.width !== W) { cv.width = W; cv.height = W; }
    const g = cv.getContext('2d'), s = W / 300, app = this.app, c = app.c, P = (x, z) => [(x + 150) * s, (z + 150) * s];
    g.imageSmoothingEnabled = true; g.drawImage(this.mmBase, 0, 0, W, W);
    for (const p of app.sector.piles) { if (!p.o.visible) continue; const [x, y] = P(p.x, p.z); g.fillStyle = '#c9773a'; g.fillRect(x - 1.5 * dpr, y - 1.5 * dpr, 3 * dpr, 3 * dpr); }
    for (const [, e] of app.sector.buildings) { g.save(); const [x, y] = P(e.rec.x, e.rec.z); g.translate(x, y); g.rotate(-e.yaw); g.fillStyle = '#5fd36a'; g.strokeStyle = '#0b1a0c'; g.lineWidth = dpr; g.fillRect(-e.fw * s / 2, -e.fd * s / 2, e.fw * s, e.fd * s); g.strokeRect(-e.fw * s / 2, -e.fd * s / 2, e.fw * s, e.fd * s); g.restore(); }
    // выходы: север/юг
    const i = c.sector_index, northOpen = (i === 0 && c.prepDone()), north = i < 2;
    if (north) { g.fillStyle = northOpen ? '#7cf07a' : '#ff5a43'; g.fillRect(W / 2 - 8 * dpr, 0, 16 * dpr, 4 * dpr); }
    if (i === 1) { g.fillStyle = '#7cf07a'; g.fillRect(W / 2 - 8 * dpr, W - 4 * dpr, 16 * dpr, 4 * dpr); }
    if (app.placing) { const [x, y] = P(app.placing.x, app.placing.z); g.strokeStyle = app.placing.why ? '#ff5a43' : '#7cf07a'; g.lineWidth = 2 * dpr; g.strokeRect(x - 4 * dpr, y - 4 * dpr, 8 * dpr, 8 * dpr); }
    const [px, py] = P(app.player.pos.x, app.player.pos.z), r = 6 * dpr;
    g.save(); g.translate(px, py); g.rotate(-app.player.yaw); g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(0, -r); g.lineTo(r * 0.65, r * 0.7); g.lineTo(0, r * 0.35); g.lineTo(-r * 0.65, r * 0.7); g.closePath(); g.fill(); g.stroke(); g.restore();
  }
  onPlacement(on) {
    const app = this.app;
    this.placeBar.hidden = !on; this.placeLayer.hidden = !on; this.actBtn.hidden = on; this.buildBtn.hidden = on || app.c.selectedTool() !== 'tool_wrench';
    if (!on || !app.placing) return;
    const p = app.placing, b = app.c.bdefs[p.id];
    this.placeTitle.textContent = `${b.name_ru} · ${b.build_scrap_cost} металла · ${b.footprint_m[0]}×${b.footprint_m[1]} м · угол ${p.angle}°`;
    this.placeWhy.textContent = p.why || 'Площадка подходит — можно строить.'; this.placeWhy.className = p.why ? 'bad' : 'good';
    this.confirmBtn.disabled = !!p.why;
  }
  // ---------------------------------------------------------------- окна
  open(kind, data) {
    this.close();
    const w = this['w_' + kind] && this['w_' + kind](data); if (!w) return;
    this.win = w; this.winKind = kind; $('#windows').append(w.root);
    if (kind === 'pause') this.app.paused = true;
  }
  close() { if (!this.win) return; if (this.win.onClose) this.win.onClose(); this.win.root.remove(); this.win = null; this.winKind = ''; this.app.paused = false; }
  frame(title, size = 'l') {
    const body = h('div.win-body'), win = h('div.panel.win.' + size, {}, h('div.win-head', {}, h('h2', {}, title), btn('✕', () => this.close(), 'close')), body);
    return { root: h('div.win-wrap', { onpointerdown: (e) => { if (e.target === e.currentTarget) this.close(); } }, win), body };
  }
  w_inventory() {
    const f = this.frame('Инвентарь', 'm'), c = this.app.c;
    const grid = h('div.inv-grid');
    c.inventory.slots.forEach((s, i) => grid.append(btn(s ? (TOOL_NAMES[s.id] || s.id) : 'пусто', () => { if (c.select(i)) { this.refreshTool(); this.close(); } }, 'cell' + (i === c.inventory.selected ? ' sel' : ''), !s)));
    f.body.append(h('div.big', {}, `Металлолом: ${c.scrap} / 999`), grid,
      h('p.dim', {}, 'Молоток — добыча металлолома у кучи (кнопка «ДОБЫТЬ», 6 ударов по +5). Гаечный ключ — кнопка «СТРОЙКА»: 4 раздела по 3 здания. Инструменты не расходуются.'));
    return f;
  }
  // ---------------------------------------------------------------- меню стройки 4×3
  w_build() {
    const app = this.app, c = app.c, f = this.frame('Строительство', 'xl'), tabs = h('div.tabs'), cards = h('div.cards'), info = h('p.dim');
    const render = () => {
      clear(tabs); clear(cards);
      for (const cat of this.app.data.buildings.building_categories) tabs.append(btn(CAT_NAMES[cat], () => { this.tab = cat; render(); }, 'tab' + (cat === this.tab ? ' on' : '')));
      const list = this.app.data.buildings.buildings.filter((b) => b.category === this.tab).sort((a, b) => a.card_order - b.card_order);
      for (const b of list) {
        const can = c.scrap >= b.build_scrap_cost, why = c.canBuildHere(b.id);
        const img = h('img.thumb', { alt: b.name_ru, src: this.thumb(b.id) || '' });
        const what = b.recipes && b.recipes.length ? 'Производство: ' + b.recipes.map((r) => this.app.itemName(r.output_item_id)).join(', ') : b.id === 'military_barracks' ? 'Найм: рабочий, механик, солдат' : b.id === 'military_headquarters' ? 'Вход внутрь, управление людьми' : 'Вход внутрь, крыша скрывается';
        cards.append(h('div.card' + (can && !why ? '' : '.dis'), { onclick: () => { if (app.startPlacement(b.id)) this.close(); } },
          img, h('b', {}, b.name_ru), h('small', {}, what), h('div.cost' + (can ? '.ok' : '.no'), {}, h('i.scrap-ico'), String(b.build_scrap_cost)), why ? h('small.bad', {}, why) : null));
      }
      info.textContent = `Металлолом: ${c.scrap}. Списывается только после «ПОСТРОИТЬ»; «ОТМЕНА» — без затрат.`;
    };
    render(); f.body.append(tabs, cards, info);
    return f;
  }
  // миниатюра здания: отдельный небольшой рендер того же движка
  thumb(id) {
    if (this.thumbs[id]) return this.thumbs[id];
    try {
      if (!this.tr) {
        const cv = document.createElement('canvas'); cv.width = 320; cv.height = 200;
        const r = new Renderer(cv); r.resize = () => {}; r.shadowsOn = false; r.noiseTex = r.texture(noiseTexture(64, 4, 7), 64, 64, { format: 'r' }); r.detailTex = r.texture(noiseTexture(64, 8, 9), 64, 64, { format: 'r' });
        r.env.clear = [0.2, 0.22, 0.2]; r.env.fog = [0.2, 0.22, 0.2]; r.fogStart = 500; r.fogEnd = 900; this.tr = { r, cv };
      }
      const { r, cv } = this.tr; r.clear();
      const b = this.app.c.bdefs[id], m = M.buildingModel(id, ...b.footprint_m), size = Math.max(...b.footprint_m);
      for (const mb of [m.shell, m.roof]) if (mb) r.add(new RenderObject(r.createMesh(mb.data()), 'world')).cutout = false;
      const cam = new Camera(); cam.fov = 0.6; cam.pos = v(size * 1.15, size * 0.95, size * 1.45); cam.target = v(0, size * 0.12, 0); cam.focus = v(); cam.far = 400; cam.update(1.6); r.setCamera(cam); r.render(cam);
      this.thumbs[id] = cv.toDataURL('image/jpeg', 0.85);
    } catch (e) { this.thumbs[id] = ''; }
    return this.thumbs[id];
  }
  // ---------------------------------------------------------------- здание: производство / найм / штаб / бункер
  w_building(uid) {
    const app = this.app, c = app.c, ent = app.sector.buildings.get(uid); if (!ent) return null;
    const d = c.bdefs[ent.rec.id], f = this.frame(d.name_ru, 'l'), body = h('div.col');
    f.body.append(body);
    const qBox = h('div.col');
    const queueView = () => {
      clear(qBox); const q = c.queue(uid);
      if (!q.length) { qBox.append(h('p.dim', {}, 'Очередь пуста.')); return; }
      q.forEach((j, k) => {
        const p = Math.max(0, Math.min(1, (c.campaign_seconds - j.startAt) / j.seconds));
        qBox.append(h('div.job', {}, h('span', {}, `${k + 1}. ${j.kind === 'npc' ? app.roleName(j.out) : app.itemName(j.out)}${j.qty > 1 ? ' ×' + j.qty : ''}`), h('div.bar', {}, h('i', { style: { width: (p * 100).toFixed(1) + '%' } })), h('small', {}, k === 0 ? `${UI.mmss(j.finishAt - c.campaign_seconds)}` : 'в очереди')));
      });
    };
    const kind = d.interaction_type || 'production';
    if (kind === 'recruitment') {
      const cap = h('p'), list = h('div.col');
      const draw = () => {
        clear(list); cap.textContent = `Люди: ${c.recruits.length} + в найме ${c.pendingHires()} из ${c.barracksCapacity()}. Металлолом: ${c.scrap}.`;
        for (const r of d.recruitment) {
          const role = app.data.npcs.roles.find((x) => x.id === r.npc_role_id);
          list.append(h('div.recipe', {}, h('div', {}, h('b', {}, role.name_ru), h('small', {}, role.description_ru)), h('span.cost', {}, h('i.scrap-ico'), r.scrap_cost), h('span.dim', {}, `${r.seconds} с`),
            btn('НАНЯТЬ', () => { const res = c.hire(uid, r.npc_role_id); if (!res.ok) this.toast(res.reason, 'alert'); else this.toast(`${role.name_ru}: найм начат.`); draw(); queueView(); }, 'primary', c.scrap < r.scrap_cost)));
        }
      };
      draw();
      body.append(cap, list, h('h3', {}, 'Очередь найма'), qBox, h('p.dim', {}, 'Нанятые люди ждут у казармы. Их самостоятельная работа (добыча, ремонт, солдаты с произведённым оружием) и приказы из штаба — следующий этап.'));
    } else if (kind === 'squad_command') {
      const list = h('div.col');
      const draw = () => {
        clear(list);
        if (!c.recruits.length) list.append(h('p.dim', {}, 'Пока нет людей. Наймите их в казарме.'));
        for (const r of c.recruits) {
          const role = app.data.npcs.roles.find((x) => x.id === r.role), sel = h('select', { id: 'ord-' + r.uid });
          for (const o of role.allowed_orders) { const op = h('option', { value: o }, ORDER_NAMES[o] || o); if (o === r.order) op.selected = true; sel.append(op); }
          sel.addEventListener('change', () => { c.setOrder(r.uid, sel.value); this.toast(`${role.name_ru} №${r.uid}: приказ «${ORDER_NAMES[sel.value]}».`); });
          list.append(h('div.recipe', {}, h('b', {}, `${role.name_ru} №${r.uid}`), h('small.dim', {}, `нанят на ${UI.mmss(r.hiredAt)}`), sel));
        }
      };
      draw();
      body.append(h('p', {}, 'Тактический стол штаба: приказы своим людям (до 6 в отряде).'), list, h('p.dim', {}, 'Приказы сохраняются. Выполнение приказов людьми на карте — этап 6–7.'));
    } else if (kind === 'enterable_bunker') {
      body.append(h('p', {}, 'Бункер: зайдите внутрь через проход — крыша скрывается, при выходе снова видна. Вместимость — 8 человек.'), h('p.dim', {}, 'Гарнизон бункера из солдат — этап 7.'));
    } else {
      const list = h('div.col');
      const draw = () => {
        clear(list);
        for (const r of d.recipes) {
          const name = app.itemName(r.output_item_id), w = (app.data.items.weapons || []).find((x) => x.id === r.output_item_id);
          const ammo = w ? (w.ammo_id ? app.itemName(w.ammo_id) : (w.compatible_ammo_ids || []).map((a) => app.itemName(a)).join(' / ') || 'без патронов') : '';
          list.append(h('div.recipe', {}, h('div', {}, h('b', {}, `${name}${r.quantity > 1 ? ' ×' + r.quantity : ''}`), h('small', {}, w ? `Патроны: ${ammo}` : d.category === 'vehicles' ? 'Поступает на склад техники' : 'Боеприпасы на склад базы')),
            h('span.cost' + (c.scrap >= r.scrap_cost ? '.ok' : '.no'), {}, h('i.scrap-ico'), r.scrap_cost), h('span.dim', {}, `${r.seconds} с`),
            btn('СОЗДАТЬ', () => { const res = c.produce(uid, r.output_item_id); if (!res.ok) this.toast(res.reason, 'alert'); else audio.play('pickup', -6); draw(); queueView(); }, 'primary', c.scrap < r.scrap_cost || c.queue(uid).length >= 5)));
        }
      };
      draw();
      body.append(h('p.dim', {}, `Металлолом: ${c.scrap}. Изделия поступают на склад базы автоматически.`), list, h('h3', {}, 'Очередь (до 5)'), qBox);
      if (d.category === 'vehicles') body.append(h('p.dim', {}, 'Техника учитывается на складе техники. Управление машинами — отдельный следующий этап.'));
    }
    queueView();
    let t = 0;
    return { ...f, tick: () => { t += 1; if (t % 15 === 0) queueView(); } };
  }
  w_storage() {
    const app = this.app, c = app.c, f = this.frame('Склад базы', 'l'), it = app.data.items, st = c.storage;
    const sec = (title, rows) => [h('h3', {}, title), ...(rows.length ? rows : [h('p.dim', {}, 'Пусто.')])];
    const weapons = (it.weapons || []).filter((w) => st[w.id]).map((w) => {
      const ammoIds = w.ammo_id ? [w.ammo_id] : (w.compatible_ammo_ids || []), ammo = ammoIds.reduce((a, id) => a + (st[id] || 0), 0);
      const ready = w.class === 'throwable' || ammo > 0;
      return h('div.recipe', {}, h('b', {}, `${w.name_ru} ×${st[w.id]}`), h('small', {}, ammoIds.length ? `патроны: ${ammoIds.map((a) => app.itemName(a)).join(' / ')} — ${ammo}` : 'метательное'), h('span.' + (ready ? 'ok' : 'no'), {}, ready ? 'готово к бою' : 'нет патронов'));
    });
    const ammo = (it.ammunition || []).filter((a) => st[a.id]).map((a) => h('div.recipe', {}, h('b', {}, a.name_ru), h('span', {}, `${st[a.id]} шт.`)));
    const veh = (it.vehicles || []).filter((x) => st[x.id]).map((x) => h('div.recipe', {}, h('b', {}, `${x.name_ru} ×${st[x.id]}`), h('small.dim', {}, `груз: ${x.cargo_slots} мест`)));
    f.body.append(h('p', {}, `Металлолом: ${c.scrap} / 999. Добыто всего: ${c.totals.harvested}, потрачено: ${c.totals.spent}.`), ...sec('Оружие', weapons), ...sec('Боеприпасы', ammo), ...sec('Техника (склад техники)', veh));
    return f;
  }
  w_pause() {
    const f = this.frame('Пауза', 's'), app = this.app;
    f.body.append(btn('Продолжить', () => this.close(), 'primary big'), btn('Сохранить', () => { this.toast(app.save() ? 'Кампания сохранена.' : 'Не удалось сохранить.', 'good'); }, 'big'),
      btn('Настройки', () => this.open('settings'), 'big'), btn('Отчёт ИИ врага (отладка)', () => this.open('intel'), 'big'),
      btn('Новая кампания', () => this.open('confirm'), 'big'), btn('Главное меню', () => { app.save(); this.close(); app.playing = false; this.showMenu(true); }, 'big'),
      h('p.dim', {}, 'Время подготовки идёт только во время активной игры: пауза и закрытое приложение не считаются. Автосохранение каждые 10 секунд.'));
    return f;
  }
  w_confirm() {
    const f = this.frame('Начать заново?', 's');
    f.body.append(h('p', {}, 'Текущая кампания будет удалена: металлолом, здания, таймер подготовки и развитие врага.'), btn('Да, новая кампания', () => { this.close(); this.app.start(false); }, 'primary big'), btn('Отмена', () => this.close(), 'big'));
    return f;
  }
  w_intel() {
    const f = this.frame('Отчёт ИИ врага (отладка)', 'm'), r = this.app.c.enemy.report();
    const items = Object.entries(r.produced_items).map(([k, n]) => `${this.app.itemName(k)} ×${n}`).join(', ') || '—';
    f.body.append(h('p.dim', {}, 'Отладочные данные логической модели врага (на карте №3 он развивается сам за реально добытый металл).'),
      h('div.kv', {}, ...[['Время ИИ', UI.mmss(r.elapsed_seconds)], ['Металлолом', r.scrap_metal], ['Добыто / потрачено', `${r.total_harvested} / ${r.total_spent}`], ['Зданий', r.buildings], ['Рабочие · механики · солдаты', `${r.workers} · ${r.mechanics} · ${r.soldiers}`], ['Готовы к бою', r.battle_ready_soldiers], ['Произведено', items]].map(([k, val]) => [h('span', {}, k), h('b', {}, String(val))])));
    return f;
  }
  w_settings() {
    const f = this.frame('Настройки', 'm'), app = this.app, s = app.settings, body = h('div.col');
    const draw = () => {
      clear(body);
      body.append(h('h3', {}, 'Качество графики'), h('div.row', {}, ['Низкое', 'Среднее', 'Высокое'].map((n, q) => btn(n, () => { s.quality = q; app.applySettings(); draw(); }, q === s.quality ? 'on' : ''))),
        h('div.row', {}, btn(`Счётчик FPS: ${s.showFps ? 'вкл' : 'выкл'}`, () => { s.showFps = !s.showFps; app.applySettings(); draw(); })),
        h('label.slider', {}, 'Громкость', (() => { const r = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: s.volume, id: 'set-vol' }); r.addEventListener('input', () => { s.volume = +r.value; app.applySettings(); }); return r; })()),
        h('label.slider', {}, 'Масштаб камеры', (() => { const r = h('input', { type: 'range', min: 0.55, max: 1.7, step: 0.05, value: s.zoom, id: 'set-zoom' }); r.addEventListener('input', () => { s.zoom = +r.value; app.cam.setZoom(s.zoom); app.applySettings(); }); return r; })()),
        h('p.dim', {}, 'ПК: WASD — движение, Shift — бег, E — действие, Tab — инвентарь, 1–0 — ячейки, B — стройка (с ключом), мышь — положение постройки, колесо/Q/R — поворот, Enter — построить, Esc — отмена/пауза, F3 — FPS.'));
    };
    draw(); f.body.append(body);
    return f;
  }
}
