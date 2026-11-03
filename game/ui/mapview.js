// Карта локации (2D canvas): подложка из карты смешивания земли + слои (здания по состоянию, бойцы, враги рядом,
// цель задания, выходы, аномалии, проломы). Используется для мини-карты (следует за генералом) и полной карты.
import { V3, smoothstep } from '../../engine/math.js';
import { Game } from '../state.js';
import * as L from '../layout.js';

let baseCanvas = null;
export function buildMapBase(splat, n) {
  const c = document.createElement('canvas'); c.width = c.height = n;
  const ctx = c.getContext('2d'), img = ctx.createImageData(n, n);
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const dirt = [84, 79, 66], grass = [61, 74, 41], asph = [51, 51, 51], conc = [117, 115, 107], wet = [41, 51, 56];
  for (let i = 0; i < n * n; i++) {
    const r = splat[i * 4] / 255, g = splat[i * 4 + 1] / 255, b = splat[i * 4 + 2] / 255, a = splat[i * 4 + 3] / 255;
    let col = mix(dirt, grass, smoothstep(0.35, 0.7, g)); col = mix(col, asph, smoothstep(0.4, 0.6, r)); col = mix(col, conc, smoothstep(0.4, 0.6, b)); col = mix(col, wet, smoothstep(0.55, 0.75, a) * 0.7);
    img.data[i * 4] = col[0]; img.data[i * 4 + 1] = col[1]; img.data[i * 4 + 2] = col[2]; img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const px = (x) => (x + 150) / 300 * n;
  ctx.strokeStyle = '#bdb8ad'; ctx.lineWidth = Math.max(1, n / 300);
  ctx.strokeRect(px(L.WALL_MIN[0]), px(L.WALL_MIN[1]), px(L.WALL_MAX[0]) - px(L.WALL_MIN[0]), px(L.WALL_MAX[1]) - px(L.WALL_MIN[1]));
  ctx.strokeStyle = '#cc4b33'; ctx.lineWidth = Math.max(2, n / 150);
  for (const br of L.BREACHES) {
    const a = br.at - br.w / 2, b = br.at + br.w / 2; ctx.beginPath();
    if (br.side === 'n') { ctx.moveTo(px(a), px(L.WALL_MIN[1])); ctx.lineTo(px(b), px(L.WALL_MIN[1])); }
    if (br.side === 'w') { ctx.moveTo(px(L.WALL_MIN[0]), px(a)); ctx.lineTo(px(L.WALL_MIN[0]), px(b)); }
    if (br.side === 'e') { ctx.moveTo(px(L.WALL_MAX[0]), px(a)); ctx.lineTo(px(L.WALL_MAX[0]), px(b)); }
    ctx.stroke();
  }
  ctx.fillStyle = '#333'; ctx.fillRect(px(-L.GATE_HALF), px(L.WALL_MAX[1]) - 1, px(L.GATE_HALF) - px(-L.GATE_HALF), 3);
  ctx.fillStyle = '#4d4033'; ctx.fillRect(0, px(-128.8), n, 1); ctx.fillRect(0, px(-127.2), n, 1);
  ctx.fillStyle = '#453e38';
  for (const r of L.RUINS) ctx.fillRect(px(r.pos[0] - r.size[0] / 2), px(r.pos[1] - r.size[1] / 2), r.size[0] / 300 * n, r.size[1] / 300 * n);
  baseCanvas = c;
}

const STATE_COL = (id) => (Game.job(id) ? '#d9a63a' : ['#8c2a1f', '#7f8a80', '#5aa55a'][Math.min(2, Game.level(id))]);

export class MapView {
  constructor(canvas, opts = {}) {
    this.c = canvas; this.ctx = canvas.getContext('2d'); this.follow = opts.follow ?? true; this.meters = opts.meters || 110; this.center = new V3();
    this.labels = !!opts.labels; this.selected = ''; this.world = null; this.quest = null; this.round = !!opts.round;
  }
  resize() {
    const r = this.c.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width * dpr)), hh = Math.max(1, Math.round(r.height * dpr));
    if (this.c.width !== w || this.c.height !== hh) { this.c.width = w; this.c.height = hh; }
  }
  scale() { return this.c.width / this.meters; }
  w2m(x, z) { const s = this.scale(); return [this.c.width / 2 + (x - this.center.x) * s, this.c.height / 2 + (z - this.center.z) * s]; }
  m2w(mx, my) { const s = this.scale(); return new V3(this.center.x + (mx - this.c.width / 2) / s, 0, this.center.z + (my - this.c.height / 2) / s); }
  draw() {
    this.resize();
    const ctx = this.ctx, W = this.c.width, H = this.c.height, s = this.scale(), dpr = Math.min(2, devicePixelRatio || 1), world = this.world;
    if (this.follow && world && world.player) this.center = world.player.pos;
    ctx.save();
    ctx.fillStyle = '#141412'; ctx.fillRect(0, 0, W, H);
    if (this.round) { ctx.beginPath(); ctx.arc(W / 2, H / 2, Math.min(W, H) / 2, 0, Math.PI * 2); ctx.clip(); }
    if (baseCanvas) { const [ax, ay] = this.w2m(-150, -150); ctx.imageSmoothingEnabled = true; ctx.drawImage(baseCanvas, ax, ay, 300 * s, 300 * s); }
    // здания
    ctx.font = `${Math.round(11 * dpr)}px 'PT Sans Narrow', 'Arial Narrow', sans-serif`; ctx.textAlign = 'center';
    for (const d of L.BUILDINGS) {
      const [x, y] = this.w2m(d.pos[0] - d.size[0] / 2, d.pos[1] - d.size[1] / 2), w = d.size[0] * s, hh = d.size[1] * s;
      ctx.globalAlpha = d.open ? 0.5 : 1; ctx.fillStyle = STATE_COL(d.id); ctx.fillRect(x, y, w, hh); ctx.globalAlpha = 1;
      ctx.strokeStyle = d.id === this.selected ? '#ffe066' : 'rgba(0,0,0,.6)'; ctx.lineWidth = d.id === this.selected ? 2.5 * dpr : 1; ctx.strokeRect(x, y, w, hh);
      if (this.labels && d.kind !== 'tower') { ctx.lineWidth = 3 * dpr; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.strokeText(d.name, x + w / 2, y + hh / 2 + 4 * dpr); ctx.fillStyle = '#f7f1e3'; ctx.fillText(d.name, x + w / 2, y + hh / 2 + 4 * dpr); }
    }
    // аномалии
    for (const a of L.ANOMALIES) {
      const [x, y] = this.w2m(a.pos[0], a.pos[2]);
      ctx.strokeStyle = a.kind === 'rad' ? 'rgba(170,230,70,.8)' : a.kind === 'electro' ? 'rgba(120,180,255,.9)' : 'rgba(255,140,40,.9)';
      ctx.lineWidth = 1.5 * dpr; ctx.beginPath(); ctx.arc(x, y, Math.max(3 * dpr, a.r * s), 0, Math.PI * 2); ctx.stroke();
    }
    // выходы
    for (const e of L.EXITS) {
      const [x, y] = this.w2m(e.pos[0], e.pos[2]); ctx.fillStyle = '#4c9bff'; ctx.beginPath(); ctx.arc(x, y, 5 * dpr, 0, Math.PI * 2); ctx.fill();
      if (this.labels) { ctx.lineWidth = 3 * dpr; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.strokeText('→ ' + e.name, x, y - 9 * dpr); ctx.fillStyle = '#a8d1ff'; ctx.fillText('→ ' + e.name, x, y - 9 * dpr); }
    }
    if (world) {
      // противники рядом с генералом (до 35 м) — как на радаре
      const pl = world.player;
      for (const e of world.enemies) {
        if (!e.alive || e.dormant || !pl || e.pos.dist(pl.pos) > 35) continue;
        const [x, y] = this.w2m(e.pos.x, e.pos.z); ctx.fillStyle = '#f0402f'; ctx.beginPath(); ctx.arc(x, y, 3.2 * dpr, 0, Math.PI * 2); ctx.fill();
      }
      for (const so of world.soldiers) {
        const [x, y] = this.w2m(so.pos.x, so.pos.z); ctx.fillStyle = so.alive ? '#4fe37a' : '#555'; ctx.beginPath(); ctx.arc(x, y, 3.4 * dpr, 0, Math.PI * 2); ctx.fill();
        if (this.labels && so.alive) { ctx.fillStyle = '#c5f5d1'; ctx.fillText(so.def.call, x, y - 6 * dpr); }
      }
      const m = this.quest && this.quest.marker();
      if (m) {
        const [x, y] = this.w2m(m.x, m.z), r = 6 * dpr;
        ctx.fillStyle = '#ffd23a'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      if (pl) {
        const [x, y] = this.w2m(pl.pos.x, pl.pos.z), r = 7 * dpr;
        ctx.save(); ctx.translate(x, y); ctx.rotate(-pl.yaw);
        ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r * 0.65, r * 0.7); ctx.lineTo(0, r * 0.35); ctx.lineTo(-r * 0.65, r * 0.7); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
    }
    ctx.restore();
    if (this.round) { ctx.strokeStyle = '#5a1a14'; ctx.lineWidth = 3 * dpr; ctx.beginPath(); ctx.arc(W / 2, H / 2, Math.min(W, H) / 2 - 1.5 * dpr, 0, Math.PI * 2); ctx.stroke(); }
  }
}
