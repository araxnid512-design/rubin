// «Долг: Возрождение» — точка входа: меню, загрузка локации, игровой цикл, окна, сохранения, настройки.
// Собственный веб-движок (WebGL2), без сторонних библиотек.
import { Renderer } from './engine/renderer.js';
import { V3 } from './engine/math.js';
import { audio } from './engine/audio.js';
import { GameWorld } from './game/world.js';
import { SPLAT } from './game/world_builder.js';
import { spawnActors } from './game/actors.js';
import { Input } from './game/input.js';
import { FollowCamera } from './game/follow_camera.js';
import { DayNight } from './game/daynight.js';
import { Settings, PRESETS } from './game/settings.js';
import { Quest } from './game/quest.js';
import { Game, events, msg, MSG } from './game/state.js';
import { HUD } from './game/ui/hud.js';
import { createWindow } from './game/ui/windows.js';
import { buildMapBase } from './game/ui/mapview.js';
import { h, btn, clear } from './game/ui/dom.js';

const $ = (s) => document.querySelector(s);

class App {
  constructor() {
    this.canvas = $('#game');
    this.settings = new Settings();
    try { this.r = new Renderer(this.canvas); } catch (e) { this.fatal(e.message); return; }
    this.input = new Input(this.canvas);
    this.input.uiBlocks = () => !!this.win;
    this.cam = new FollowCamera(this.settings);
    this.world = null; this.quest = null; this.hud = null; this.win = null; this.winKind = ''; this.playing = false; this.loading = false;
    this.stats = { fps: 0, ms: 0, logic: 0, dc: 0, tris: 0, w: 0, h: 0 }; this._fpsAcc = 0; this._fpsN = 0; this.lastT = performance.now(); this._lastDraw = 0;
    this.applySettings();
    this.showMenu();
    addEventListener('wheel', (e) => { if (this.playing && !this.win) this.cam.setZoom(this.cam.zoom + Math.sign(e.deltaY) * 0.08); }, { passive: true });
    document.addEventListener('pointerdown', () => audio.unlock(), { capture: true });
    document.addEventListener('keydown', () => audio.unlock(), { capture: true });
    requestAnimationFrame((t) => this.frame(t));
  }
  fatal(text) {
    $('#menu').hidden = false;
    clear($('#menu-actions')).append(h('p.err', {}, 'Не удалось запустить игру: ' + text), h('p.dim', {}, 'Нужен браузер с поддержкой WebGL2 (Chrome, Edge, Firefox, Safari 15+, современный Android).'));
  }
  // ---------------------------------------------------------------- меню
  showMenu() {
    this.playing = false; $('#hud').hidden = true; $('#menu').hidden = false; $('#loading').hidden = true;
    const box = clear($('#menu-actions')), latest = Game.latestSlot();
    box.append(
      btn('Новая игра', () => this.start(null), 'primary big'),
      btn('Продолжить', () => this.loadSlot(latest), 'big', latest < 0),
      btn('Загрузить', () => this.openMenuPanel('load'), 'big'),
      btn('Настройки', () => this.openMenuPanel('settings'), 'big'),
      btn('Во весь экран', () => { const el = document.documentElement; (el.requestFullscreen ? el.requestFullscreen() : Promise.reject()).then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => msg('Полноэкранный режим недоступен в этом окне.')); }, 'big'));
    $('#menu-info').textContent = `Этап 1 из многих: база «Долга», 300 × 300 м. Сохранения хранятся в этом браузере. Качество: ${PRESETS[this.settings.quality].name}.`;
  }
  openMenuPanel(kind) { this.open(kind === 'load' ? 'saveload' : 'settings', kind === 'load' ? 'load' : 'menu'); }
  toMenu() { this.close(); this.showMenu(); }
  // ---------------------------------------------------------------- загрузка локации
  async start(save) {
    if (this.loading) return;
    this.loading = true; this.close(); audio.unlock();
    $('#menu').hidden = true; $('#loading').hidden = false; $('#hud').hidden = true;
    const bar = $('#load-bar'), txt = $('#load-text');
    const progress = (p, t) => { bar.style.width = Math.round(p * 100) + '%'; txt.textContent = t; };
    progress(0.02, 'Подготовка…');
    await new Promise((r) => setTimeout(r, 30));
    const t0 = performance.now();
    // полный сброс прошлой сессии
    events.clear(); this.r.clear(); this.world = null;
    if (save) Game.apply(save); else Game.newGame();
    const w = new GameWorld(this.r, this.settings);
    const q = new Quest(); q.world = w; w.quest = q; q.loadData(save ? save.quest : null);
    w.input = this.input; w.cam = this.cam; w.onSpawn = spawnActors;
    this.world = w; this.quest = q;
    Game.world = w;
    try { await w.build(progress); }
    catch (e) { console.error(e); this.loading = false; this.fatal(e.message); return; }
    buildMapBase(w.wb.splat, SPLAT);
    this.dayNight = new DayNight(this.r, this.settings); w.dayNight = this.dayNight;
    this.hud = new HUD($('#hud'), this);
    this.bindEvents();
    Game.updatePower(); this.r.uniforms.power = Game.powerOn ? 1 : 0;
    this.applySettings();
    this.cam.snap(); this.cam.setZoom(this.settings.cameraZoom || 1);
    this.loadMs = Math.round(performance.now() - t0);
    console.log('[Main] локация загружена за', this.loadMs, 'мс');
    $('#loading').hidden = true; $('#hud').hidden = false;
    this.playing = true; this.loading = false; this.lastT = performance.now();
    audio.setAmbient('amb_wind');
    if (!save) this.open('dialog', 'intro');
    else msg('Игра загружена.', MSG.GOOD);
    this.hud.refreshSlots(); this.hud.refreshTracker();
  }
  bindEvents() {
    events.on('ui', (kind, data) => this.open(kind, data));
    events.on('autosave', () => this.saveGame(0, true));
    events.on('shake', (k) => this.cam.shake(k));
    events.on('sfx', (n) => audio.play(n));
    events.on('sfx3d', (n, p) => audio.playAt(n, p));
    events.on('power', (on) => { this.r.uniforms.power = on ? 1 : 0; });
    events.on('visited', (id) => { if (id === 'open_armory_cache' || id.startsWith('took_')) this.hud && this.hud.refreshSlots(); });
  }
  loadSlot(i) {
    const d = Game.read(i);
    if (!d) { msg('Сохранение не найдено.', MSG.ALERT); return; }
    this.start(d);
  }
  saveGame(slot, quiet = false) {
    if (!this.world || !this.playing) return false;
    const q = this.quest, summary = `${Game.timeStr()} · ${q.currentTitle()}`;
    if (quiet) { try { localStorage.setItem('dolg_save_' + slot, JSON.stringify(Game.collect(q.saveData(), summary))); return true; } catch (e) { return false; } }
    return Game.save(slot, q.saveData(), summary);
  }
  // ---------------------------------------------------------------- окна
  open(kind, data) {
    if (this.win) {
      if (this.winKind === kind && kind !== 'dialog' && kind !== 'saveload' && kind !== 'settings') { this.close(); return; }
      this.close(true);
    }
    const w = createWindow(this, kind, data);
    if (!w) return;
    this.win = w; this.winKind = kind;
    $('#windows').append(w.root);
    if (this.hud) this.hud.onWindow(true);
    audio.play('ui', -4);
  }
  close(switching = false) {
    if (!this.win) return;
    if (this.win.onClose) this.win.onClose();
    this.win.root.remove(); this.win = null; this.winKind = '';
    if (!switching && this.hud) { this.hud.onWindow(false); this.hud.refreshSlots(); }
  }
  // ---------------------------------------------------------------- настройки
  applySettings() {
    const s = this.settings, p = PRESETS[s.quality], r = this.r;
    if (!r) return;
    r.renderScale = s.renderScale; r.maxDpr = [1.25, 1.5, 2][s.quality]; r.shadowsOn = s.shadows; r.shadowDist = p.shadowDist; r.setShadowSize(p.shadowSize);
    r.fogEnd = Math.min(170, s.drawDistance + 30); r.fogStart = r.fogEnd * 0.32; r.uniforms.detail = p.detail;
    audio.setVolume(s.volume); globalThis.__vibrate = s.vibration;
    if (this.world) { this.world.applyQuality(); this.world.fx.lightsOn = s.lights; }
    if (this.hud) this.hud.applySettings();
    s.save();
  }
  // ---------------------------------------------------------------- кадр
  frame(t) {
    requestAnimationFrame((tt) => this.frame(tt));
    if (!this.r) return;
    const minDt = this.settings.fpsLimit >= 60 ? 0 : 1 / 30 - 0.004;
    if ((t - this._lastDraw) / 1000 < minDt) return;
    const dt = Math.min(0.1, (t - this.lastT) / 1000); this.lastT = t; this._lastDraw = t;
    if (!this.playing || !this.world) { this.input.endFrame(); return; }
    const w = this.world, t0 = performance.now();
    this.handleKeys();
    const paused = !!this.win;
    if (!paused) {
      w.update(dt); this.quest.update(dt); this.dayNight.update(dt); Game.playTime += dt;
      this.r.uniforms.time += dt;
    }
    const pl = w.player;
    this.cam.follow(pl.pos, pl.vel, dt); this.cam.update(this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight));
    this.r.setCamera(this.cam);
    w.updateVisuals(paused ? 0 : dt, this.cam);
    audio.setListener(pl.pos, this.cam.right);
    const t1 = performance.now();
    this.r.render(this.cam);
    if (this.win && this.win.tick) this.win.tick();
    this.hud.update(dt, this.stats);
    this.input.endFrame();
    // замеры
    this._fpsAcc += dt; this._fpsN++;
    if (this._fpsAcc >= 0.5) { this.stats.fps = this._fpsN / this._fpsAcc; this._fpsAcc = 0; this._fpsN = 0; }
    this.stats.ms = performance.now() - t0; this.stats.logic = t1 - t0; this.stats.dc = this.r.stats.drawCalls; this.stats.tris = this.r.stats.tris; this.stats.w = this.canvas.width; this.stats.h = this.canvas.height;
  }
  handleKeys() {
    const i = this.input;
    if (i.pressed('fps')) { this.settings.showFps = !this.settings.showFps; this.applySettings(); }
    if (i.pressed('quicksave')) this.saveGame(1);
    if (i.pressed('quickload') && Game.hasSave(1)) { this.loadSlot(1); return; }
    if (this.win) {
      if (i.pressed('pause') && !this.win.dialog && this.winKind !== 'death') this.close();
      else if (i.pressed('inventory') && this.winKind === 'inventory') this.close();
      return;
    }
    for (const [a, k] of [['inventory', 'inventory'], ['map', 'map'], ['squad', 'squad'], ['build', 'build'], ['journal', 'journal'], ['pause', 'pause']]) if (i.pressed(a)) { this.open(k); return; }
    if (i.pressed('tactical')) { this.cam.mode = this.cam.mode === 'follow' ? 'tactical' : 'follow'; msg(this.cam.mode === 'tactical' ? 'Тактический обзор (заготовка режима для следующих этапов).' : 'Обычный обзор.'); }
  }
}

const app = new App();
window.__app = app; window.__Game = Game; window.V3 = V3;
