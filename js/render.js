'use strict';
// ===== Отрисовка мира =====
function shade(hex, f) {
  const n = parseInt(hex.slice(1, 7), 16), r = clamp(((n >> 16) & 255) * f, 0, 255) | 0, g = clamp(((n >> 8) & 255) * f, 0, 255) | 0, b = clamp((n & 255) * f, 0, 255) | 0;
  return `rgb(${r},${g},${b})`;
}
function poly(pts, fill) { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }
function cube(hw, hh, h, col, oy = 0) {
  poly([-hw, -h + oy, 0, hh - h + oy, 0, hh + oy, -hw, oy], shade(col, .72));
  poly([hw, -h + oy, 0, hh - h + oy, 0, hh + oy, hw, oy], shade(col, .5));
  poly([0, -hh - h + oy, hw, -h + oy, 0, hh - h + oy, -hw, -h + oy], col);
  ctx.strokeStyle = '#ffffff1c'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-hw, -h + oy); ctx.lineTo(0, hh - h + oy); ctx.lineTo(hw, -h + oy); ctx.stroke();
}
function ell(x, y, rx, ry, fill) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 6.283); ctx.fillStyle = fill; ctx.fill(); }
function rr(x, y, w, h, r, fill) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fillStyle = fill; ctx.fill(); }

let fogSprite = null;
function mkFogSprite(c) {
  const s = document.createElement('canvas'); s.width = s.height = 128;
  const g = s.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},.55)`); gr.addColorStop(.5, `rgba(${c[0]},${c[1]},${c[2]},.22)`); gr.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); fogSprite = s;
}

function drawNode(n) {
  const v = n.v;
  if (n.sh > 0) ctx.translate(Math.sin(n.sh * 70) * 3 * n.sh / .25, 0);
  switch (n.k) {
    case 'tree': {
      ell(6, 3, 20, 8, '#0004');
      const sway = Math.sin(time * 1.3 + v * 20) * 1.5;
      if (v > .72) {
        ctx.strokeStyle = '#3d2e22'; ctx.lineWidth = 4.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1, -40); ctx.moveTo(0, -22); ctx.lineTo(-13 + sway, -38); ctx.moveTo(1, -30); ctx.lineTo(12 + sway, -46); ctx.moveTo(1, -40); ctx.lineTo(-5 + sway, -58); ctx.stroke();
      } else {
        const s = .9 + v * .45; ctx.fillStyle = '#3d2e22'; ctx.fillRect(-3.5, -16, 7, 18); ctx.fillStyle = '#2a1f16'; ctx.fillRect(0, -16, 3.5, 18);
        const c1 = v < .35 ? '#3d4d2b' : '#2c4a2e', c2 = v < .35 ? '#55662f' : '#3d6239', c3 = v < .35 ? '#6a7a3a' : '#4d7848';
        for (const [w, y0, y1, k] of [[19, -12, -40, .3], [15, -28, -55, .6], [10, -44, -70, 1]]) {
          const o = sway * k;
          poly([-w * s, y0, w * s, y0, o, y1 * s], c1); poly([0, y0, w * s, y0, o, y1 * s], c2); poly([w * s * .35, y0, w * s, y0, o, y1 * s], c3);
        }
      }
      break;
    }
    case 'rock': case 'orev': case 'coal': {
      ell(2, 4, 22, 9, '#0005');
      poly([-18, 0, -13, -15, 1, -21, 15, -12, 19, 1, 5, 8, -9, 7], '#55575b');
      poly([-13, -15, 1, -21, 15, -12, 3, -7, -8, -6], '#84878c'); poly([3, -7, 15, -12, 19, 1, 5, 8], '#3e4044');
      if (n.k !== 'rock') { const c = n.k === 'orev' ? '#e09a50' : '#0c0c10'; for (let i = 0; i < 7; i++) ell(-11 + (i * 37 * (v + .3)) % 24, -14 + (i * 53 * (v + .5)) % 16, 2.8, 2.1, c); if (n.k === 'orev') ell(-4, -12, 1.2, 1.2, '#fff8'); }
      break;
    }
    case 'ruby': {
      const g = .5 + .5 * Math.sin(time * 3 + v * 9);
      const gr = ctx.createRadialGradient(0, -12, 2, 0, -12, 46); gr.addColorStop(0, `rgba(255,50,90,${.28 + g * .15})`); gr.addColorStop(1, 'rgba(255,50,90,0)');
      ctx.fillStyle = gr; ctx.fillRect(-46, -58, 92, 92);
      poly([-12, 2, -16, -18, -9, -28, -4, -6], '#b01030'); poly([-9, -28, -4, -6, -2, -20], '#ff5070');
      poly([-3, 4, -5, -30, 3, -42, 9, -26, 8, 3], '#d01840'); poly([3, -42, 9, -26, 8, 3, 3, -4], '#ff7090');
      poly([8, 4, 11, -14, 17, -20, 19, 0], '#b01030'); poly([17, -20, 19, 0, 14, -6], '#ff5070');
      break;
    }
    case 'sticks': ctx.strokeStyle = '#6a5034'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-12, 2); ctx.lineTo(10, -5); ctx.moveTo(-8, -5); ctx.lineTo(12, 4); ctx.moveTo(-3, 5); ctx.lineTo(4, -8); ctx.stroke(); break;
    case 'stones': ell(-6, 1, 7, 4.5, '#77797d'); ell(5, -2, 6, 4, '#8c8e92'); ell(4, 5, 5, 3, '#66686c'); ell(-7, 0, 3, 1.5, '#a0a2a6'); break;
    case 'bush': case 'berry': {
      const sw = Math.sin(time * 1.6 + v * 20);
      ell(2, 4, 18, 7, '#0005');
      ell(-8, -6, 10, 9, '#2f4a26'); ell(7, -7 + sw * .5, 11, 10, '#3a5a2e'); ell(0, -14 + sw, 10, 9, '#4a6f38'); ell(-2, -17 + sw, 5, 4, '#5d8546');
      if (n.k === 'berry') for (let i = 0; i < 7; i++) ell(-11 + (i * 41 * (v + .4)) % 22, -17 + (i * 29 * (v + .6)) % 14, 2, 2, i % 2 ? '#8a60e0' : '#6a40c0');
      break;
    }
    case 'puddle': ell(0, 0, 22, 9, '#2f5a50cc'); ell(0, 0, 19, 7, '#3f7566cc'); ell(-5 + Math.sin(time + v * 9) * 2, -2, 9, 2.5, '#a0d8c044'); break;
    case 'scrapp':
      ell(2, 4, 21, 8, '#0005');
      poly([-17, 2, -10, -10, 2, -6, 6, 6], '#6a5a4a'); poly([-4, 4, 3, -16, 14, -9, 16, 3], '#7c7f84'); poly([-12, 5, -6, -3, 6, 2, 0, 9], '#8a4a30'); poly([3, -16, 14, -9, 9, -7], '#a4a7ac');
      ctx.strokeStyle = '#9a9da2'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-2, -4); ctx.lineTo(10, -22); ctx.stroke();
      break;
    case 'car': {
      const c = v < .33 ? '#7a4a35' : v < .66 ? '#4a5a6a' : '#6a6a3a';
      ell(2, 5, 32, 13, '#0006'); cube(27, 13, 10, c); cube(16, 8, 9, shade(c, .85), -10);
      poly([-14, -18, -1, -11.5, -1, -5.5, -14, -12], '#141a1e'); poly([14, -18, 1, -11.5, 1, -5.5, 14, -12], '#0c1114');
      ell(-17, 1, 4, 5, '#111'); ell(-5, 9, 4, 5, '#111'); ell(16, 2, 3, 4.5, '#0a0a0a');
      ell(-24, -5, 2, 2.5, '#d8d0a044');
      break;
    }
    case 'crate': ell(2, 4, 19, 8, '#0005'); cube(15, 7.5, 15, '#8a6a3c'); ctx.strokeStyle = '#4a3618'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-15, -7); ctx.lineTo(0, .5); ctx.lineTo(15, -7); ctx.moveTo(-8, -3.5); ctx.lineTo(-8, -18.5); ctx.moveTo(8, -3.5); ctx.lineTo(8, -18.5); ctx.stroke(); break;
    case 'milcrate': ell(2, 4, 21, 9, '#0005'); cube(17, 8.5, 13, '#4c5c38'); poly([-5, -17, 5, -17, 0, -13.5], '#d8d2b0'); ctx.fillStyle = '#2a3420'; ctx.fillRect(-10, -8, 4, 3); break;
    case 'cache': {
      const g = .5 + .5 * Math.sin(time * 4);
      ell(0, 2, 26, 12, `rgba(255,210,90,${.12 + g * .14})`); ell(2, 4, 21, 9, '#0005');
      cube(17, 8.5, 14, '#3a4250'); poly([-17, -9, 0, -.5, 0, 2.5, -17, -6], '#e0b040'); poly([17, -9, 0, -.5, 0, 2.5, 17, -6], '#a07820');
      ell(-8, -6, 2.5, 3, '#ffe890');
      break;
    }
    case 'barrel':
      ell(2, 3, 13, 6, '#0005'); ell(0, 0, 14, 6, `rgba(160,230,60,${.12 + .06 * Math.sin(time * 2 + v * 9)})`);
      ctx.fillStyle = '#9a8a26'; ctx.fillRect(-9, -22, 18, 22); ctx.fillStyle = '#6a5e18'; ctx.fillRect(2, -22, 7, 22); ell(0, 0, 9, 4.5, '#6a5e18'); ell(0, -22, 9, 4.5, '#c8b838');
      ctx.fillStyle = '#1a1a1a'; ctx.fillRect(-9, -14, 18, 4); ell(1, -22, 4.5, 2.2, '#90f040');
      break;
    case 'bag': { const b = Math.sin(time * 4 + v * 9) * 1.5; ell(0, 2, 9, 4, '#0005'); ell(0, -5 + b, 8, 7, '#b0935e'); ell(-2, -7 + b, 3, 2.5, '#c8ad78'); ctx.fillStyle = '#6a5434'; ctx.fillRect(-3, -13 + b, 6, 3); break; }
    case 'mod': drawMod(n.mod); break;
  }
}
function drawMod(id) {
  const m = MODS[id], lv = modLv(id);
  if (!lv) {
    ctx.setLineDash([5, 4]); ctx.strokeStyle = '#d8c98a66'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(28, 0); ctx.lineTo(0, 14); ctx.lineTo(-28, 0); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
    ctx.globalAlpha = .35; ctx.font = '20px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(m.i, 0, 4); ctx.globalAlpha = 1;
    return;
  }
  if (id === 'hatch') {
    const g = ctx.createLinearGradient(0, -100, 0, 0); g.addColorStop(0, '#d8f0a000'); g.addColorStop(1, '#d8f0a050');
    poly([-14, -100, 14, -100, 28, 8, -28, 8], g);
    cube(24, 12, 4, '#4a5560');
    ctx.strokeStyle = '#9aa0a8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-8, -2); ctx.lineTo(-8, -94); ctx.moveTo(8, -2); ctx.lineTo(8, -94);
    for (let y = -10; y > -94; y -= 12) { ctx.moveTo(-8, y); ctx.lineTo(8, y); } ctx.stroke();
    return;
  }
  ell(2, 5, 29, 12, '#0006');
  cube(25, 12.5, m.h, m.col);
  for (let i = 1; i < lv; i++) cube(25 - i * 5, 12.5 - i * 2.5, 4, shade(m.col, 1.15 + i * .1), -m.h - (i - 1) * 4);
  const top = m.h + (lv - 1) * 4;
  if (id === 'reactor') {
    const g = .5 + .5 * Math.sin(time * 2.5), gr = ctx.createRadialGradient(0, -top - 12, 2, 0, -top - 12, 50);
    gr.addColorStop(0, `rgba(255,50,90,${.35 + g * .25})`); gr.addColorStop(1, 'rgba(255,50,90,0)'); ctx.fillStyle = gr; ctx.fillRect(-50, -top - 62, 100, 100);
    const b = Math.sin(time * 2) * 2;
    poly([0, -top - 30 + b, 9, -top - 14 + b, 0, -top + b, -9, -top - 14 + b], '#ff3060'); poly([0, -top - 30 + b, 9, -top - 14 + b, 0, -top - 12 + b], '#ffa0b8');
    return;
  }
  if (id === 'bed') cube(10, 5, 3, '#d8d0c0', -top - 5);
  if (id === 'furnace') { ell(-11, -m.h / 2 + 4, 6, 7, `rgba(255,${120 + 60 * Math.sin(time * 9)},30,.95)`); ell(-11, -m.h / 2 + 5, 3, 4, '#ffe080'); }
  if (id === 'gen') ell(0, -top - 2, 5, 2.5, `rgba(255,230,80,${.5 + .5 * Math.sin(time * 12)})`);
  if (id === 'radio') { ctx.strokeStyle = '#9aa0a8'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(10, -top); ctx.lineTo(14, -top - 26); ctx.stroke(); ell(14, -top - 26, 2, 2, Math.sin(time * 5) > 0 ? '#ff5050' : '#602020'); }
  ctx.font = '19px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(m.i, 0, -top + 6);
}

function drawChar(o) {
  const s = o.sz, wd = o.wide || 1;
  ell(0, 0, 11 * s * wd, 5 * s, '#0007');
  ctx.save(); ctx.scale(o.fx * s * wd, s * (o.sneak ? .84 : 1));
  if (o.kind === 'runner') ctx.rotate(.18);
  const sw = Math.sin(o.walk) * 3.5, bob = Math.abs(Math.sin(o.walk)) * 1.5, H = o.hit;
  ctx.fillStyle = H ? '#fff' : o.kind === 'player' ? '#2a2c34' : shade(o.body, .55);
  ctx.fillRect(-5 + sw, -10, 4.5, 10); ctx.fillRect(.5 - sw, -10, 4.5, 10);
  ctx.fillStyle = '#131418'; ctx.fillRect(-5 + sw, -2, 5.5, 2); ctx.fillRect(.5 - sw, -2, 5.5, 2);
  ctx.translate(0, -bob);
  if (o.kind === 'player') { rr(-11.5, -25, 6.5, 14, 2.5, '#5a4a30'); ctx.fillStyle = '#3a301e'; ctx.fillRect(-11.5, -19, 6.5, 1.5); }
  if (o.spikes) poly([-7, -24, -13, -31, -7, -19, -13, -22, -7, -14, -11, -14, -7, -10], '#2a1418');
  // дальняя рука
  const zomb = o.kind !== 'player';
  let ang = zomb ? -1.25 + Math.sin(o.walk * .7) * .15 : .25 + Math.sin(o.walk) * .5;
  ctx.save(); ctx.translate(-3, -22); ctx.rotate(zomb ? ang + .25 : -ang * .8); ctx.fillStyle = H ? '#fff' : shade(o.body, .6); ctx.fillRect(-2, 0, 4, 11); ctx.restore();
  // торс
  rr(-7, -25, 14, 17, 4, H ? '#fff' : o.body);
  if (!H) { ctx.fillStyle = '#ffffff14'; ctx.fillRect(-1, -24, 7, 15); ctx.fillStyle = '#00000030'; ctx.fillRect(-7, -12, 14, 2); }
  if (o.kind === 'bloater') { ell(-2, -14, 2.8, 2.8, '#e0e870'); ell(3, -19, 2.2, 2.2, '#e0e870'); ell(1, -10, 1.8, 1.8, '#c8d050'); }
  if (o.kind === 'zombie' && !H) { ctx.fillStyle = '#3a2420'; ctx.fillRect(-4, -20, 5, 3); }
  // голова
  ell(0, -30, 6.5, 6.5, H ? '#fff' : o.skin);
  if (o.kind === 'player') {
    ctx.fillStyle = shade(o.body, .85); ctx.beginPath(); ctx.arc(0, -30, 7.2, Math.PI * .92, Math.PI * 1.98); ctx.fill();
    rr(-1, -33.5, 8.5, 8.5, 3, '#1c1e20'); ell(4.2, -30.5, 2.3, 2.3, '#5ab0b0'); ell(4.8, -31, 1, 1, '#c0ffff');
    ctx.fillStyle = o.low ? '#d04030' : '#6a7a52'; ctx.fillRect(5, -27.5, 5.5, 5); ctx.fillStyle = '#00000040'; ctx.fillRect(5, -25, 5.5, 2.5);
  } else {
    ell(3.5, -31, 1.5, 1.5, o.boss || o.elite ? '#ffe040' : o.dark ? '#60e0ff' : '#ff3030');
    if (o.kind === 'spitter') { ctx.fillStyle = '#301838'; ctx.fillRect(1, -28, 6, 3 + (o.atk > 0 ? 3 : 0)); }
    else if (o.kind === 'screamer') ell(4, -27, 2.2, 2.8, '#200808');
    else { ctx.fillStyle = '#00000050'; ctx.fillRect(2, -27.5, 4, 1.2); }
  }
  // ближняя рука и оружие
  ctx.save(); ctx.translate(2, -22);
  if (o.atk > 0) ang = zomb ? -1.9 + (1 - o.atk) * 1.4 : -2.3 + (1 - o.atk) * 2.9;
  ctx.rotate(ang);
  ctx.fillStyle = H ? '#fff' : shade(o.body, .82); ctx.fillRect(-2, 0, 4, 11);
  ell(0, 11, 2.5, 2.5, zomb ? o.skin : '#3a3a40');
  if (o.spikes) poly([-2.5, 11, 0, 18, 2.5, 11], '#e8e0d0');
  if (o.wpn) drawWeapon(o.wpn);
  ctx.restore(); ctx.restore();
}
function drawWeapon(id) {
  ctx.save(); ctx.translate(0, 11); ctx.rotate(-1.35);
  const L = (c, w, l) => { ctx.fillStyle = c; ctx.fillRect(-2, -w / 2, l, w); };
  if (id === 'spear') { L('#7a5a3a', 2, 26); poly([24, -3, 31, 0, 24, 3], '#b8bcc0'); }
  else if (id === 'bat') { L('#8a6a44', 3.5, 20); ctx.fillStyle = '#c8ccd0'; for (let i = 0; i < 3; i++) ctx.fillRect(10 + i * 3, -4, 1, 8); }
  else if (id === 'machete') { L('#3a2a1a', 3, 6); poly([4, -2.5, 22, -2, 24, 2, 4, 2], '#c8ccd0'); }
  else if (id === 'axe' || id === 'saxe') { L('#7a5a3a', 2.5, 17); poly([11, -6, 17, -6, 18, 0, 11, 0], id === 'saxe' ? '#c8d0d8' : '#8a8d92'); }
  else if (id === 'pick' || id === 'spick') { L('#7a5a3a', 2.5, 17); poly([14, -8, 17, -2, 14, 8, 13, 0], id === 'spick' ? '#c8d0d8' : '#8a8d92'); }
  else if (id === 'bow') { ctx.rotate(1.35); ctx.strokeStyle = '#8a6a44'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(-2, 0, 12, -1.1, 1.1); ctx.stroke(); ctx.strokeStyle = '#d8d0c0'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(3.4, -10.7); ctx.lineTo(3.4, 10.7); ctx.stroke(); }
  else if (id === 'pistol') { ctx.rotate(1.25); ctx.fillStyle = '#26282c'; ctx.fillRect(-1, -2, 10, 3.5); ctx.fillRect(-1, 0, 3, 5); }
  else if (id === 'shotgun') { ctx.rotate(1.25); ctx.fillStyle = '#5a4028'; ctx.fillRect(-6, -1.5, 8, 4); ctx.fillStyle = '#26282c'; ctx.fillRect(1, -2, 17, 3); }
  ctx.restore();
}

// ---------- свет ----------
const lm = document.createElement('canvas'), lctx = lm.getContext('2d');
function drawLight(dark, tint, lights) {
  const s = .25, w = Math.ceil(W * s), h = Math.ceil(H * s);
  if (lm.width !== w || lm.height !== h) { lm.width = w; lm.height = h; }
  lctx.globalCompositeOperation = 'source-over'; lctx.clearRect(0, 0, w, h);
  lctx.fillStyle = `rgba(${tint},${dark})`; lctx.fillRect(0, 0, w, h);
  lctx.globalCompositeOperation = 'destination-out';
  for (const [x, y, r, a] of lights) {
    const g = lctx.createRadialGradient(x * s, y * s, 0, x * s, y * s, r * s);
    g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(.55, `rgba(0,0,0,${a * .55})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    lctx.fillStyle = g; lctx.fillRect((x - r) * s, (y - r) * s, 2 * r * s, 2 * r * s);
  }
  ctx.drawImage(lm, 0, 0, W, H);
}

const spores = Array.from({length: 50}, () => ({x: R(), y: R(), s: rnd(.6, 2.2), v: rnd(.01, .04)}));
function render(dt) {
  flash = Math.max(0, flash - dt * 1.6);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = loc.bg; ctx.fillRect(0, 0, W, H);
  const [px, py] = iso(P.x, P.y);
  const tx = px + (P.dx - P.dy) * 14, ty = py - 22 + (P.dx + P.dy) * 7;
  if (!camSet) { camX = tx; camY = ty; camSet = true; } else { const k = Math.min(1, dt * 7); camX += (tx - camX) * k; camY += (ty - camY) * k; }
  const cx = camX + (shake ? rnd(-shake, shake) : 0), cy = camY + (shake ? rnd(-shake, shake) : 0);
  const z = dpr * zoom, ox = W / 2 / zoom - cx, oy = H / 2 / zoom - cy;
  ctx.setTransform(z, 0, 0, z, z * ox, z * oy);
  ctx.drawImage(loc.gc, -loc.N * 32, -2);
  const vw = W / 2 / zoom + 80, vh = H / 2 / zoom + 110;
  const vis = (sx, sy) => Math.abs(sx - cx) < vw && Math.abs(sy - cy) < vh;
  const scr = (sx, sy) => [(sx - cx) * zoom + W / 2, (sy - cy) * zoom + H / 2];
  const lights = [], dk = loc.bunker ? 0 : darkness();

  // плоское: трупы, конусы зрения, выделения
  for (const f of loc.fx) {
    if (f.k === 'corpse') {
      const [sx, sy] = iso(f.x, f.y), e = f.e, d = e.def, k = f.t / f.T;
      ell(sx, sy, 16 * d.sz, 8 * d.sz, `rgba(50,70,25,${.5 * (1 - k)})`);
      ctx.save(); ctx.translate(sx, sy - 3); ctx.globalAlpha = Math.min(1, (1 - k) * 2.5); ctx.rotate(e.fx * Math.min(1.5, f.t * 9));
      drawChar({sz: d.sz, wide: d.wide, fx: e.fx, body: shade(d.body, .7), skin: shade(d.skin, .7), walk: 0, atk: 0, kind: e.t, spikes: d.spikes}); ctx.restore(); ctx.globalAlpha = 1;
    } else if (f.k === 'ring') { const [sx, sy] = iso(f.x, f.y), k = f.t / f.T; ctx.strokeStyle = `rgba(${f.c},${1 - k})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(sx, sy, 200 * k, 100 * k, 0, 0, 6.283); ctx.stroke(); }
  }
  if (P.sneak) for (const e of loc.en) if (!e.aggro) {
    const [sx, sy] = iso(e.x, e.y); if (!vis(sx, sy)) continue;
    const a0 = Math.atan2(e.fdy, e.fdx), rr2 = e.def.ag * .45;
    ctx.beginPath(); ctx.moveTo(sx, sy);
    for (let i = -5; i <= 5; i++) { const a = a0 + i * .28, p = iso(e.x + Math.cos(a) * rr2, e.y + Math.sin(a) * rr2); ctx.lineTo(p[0], p[1]); }
    ctx.closePath(); ctx.fillStyle = `rgba(255,${200 - e.alert * 160},60,${.07 + e.alert * .12})`; ctx.fill();
  }
  const near = promptNode, tgt = P.auto && P.auto.t === 'enemy' ? P.auto.e : null;
  const ring = (x, y, r, c) => { const [sx, sy] = iso(x, y); ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(sx, sy, r, r / 2, 0, 0, 6.283); ctx.stroke(); };
  if (near && !near.gone) ring(near.x + .5, near.y + .5, 26 + Math.sin(time * 5) * 1.5, '#f0e090aa');
  if (tgt && !tgt.dead) ring(tgt.x, tgt.y, 18 * tgt.def.sz, '#ff5040cc');
  if (P.auto && P.auto.t === 'move') ring(P.auto.x, P.auto.y, 8, '#ffffff66');
  for (const f of loc.fx) if (f.k === 'ghost') { const [sx, sy] = iso(f.x, f.y); ell(sx, sy - 16, 8, 16, `rgba(160,220,255,${.25 * (1 - f.t / f.T)})`); }

  // объекты с сортировкой по глубине
  const list = [];
  for (const w of loc.walls) { const [sx, sy] = iso(w.x + .5, w.y + .5); if (vis(sx, sy)) list.push({d: w.x + w.y + 1, sx, sy, w}); }
  for (const n of loc.nodes) {
    const [sx, sy] = iso(n.x + .5, n.y + .5); if (!vis(sx, sy)) continue;
    list.push({d: n.x + n.y + (n.k !== 'mod' && !NODES[n.k].solid ? .2 : 1), sx, sy, n});
    if (n.k === 'ruby') lights.push([sx, sy - 14, 110, .7]); else if (n.k === 'barrel' || n.k === 'cache') lights.push([sx, sy - 10, 70, .45]);
    else if (n.k === 'mod' && modLv(n.mod)) lights.push([sx, sy - 20, n.mod === 'reactor' ? 240 : n.mod === 'furnace' || n.mod === 'hatch' ? 170 : 95, n.mod === 'reactor' ? .95 : .6]);
  }
  for (const e of loc.en) { const [sx, sy] = iso(e.x, e.y); if (vis(sx, sy)) list.push({d: e.x + e.y, sx, sy, e}); }
  list.push({d: P.x + P.y, sx: px, sy: py, p: 1});
  list.sort((a, b) => a.d - b.d);
  for (const o of list) {
    ctx.save(); ctx.translate(o.sx, o.sy);
    if (o.w) {
      const w = o.w, h = w.h;
      if (w.bunk) {
        cube(32, 16, h, '#39404a'); ctx.fillStyle = '#20242a'; ctx.fillRect(-32, -h * .45, 1, 0);
        ctx.strokeStyle = '#59626e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-32, -h * .6); ctx.lineTo(0, 16 - h * .6); ctx.lineTo(32, -h * .6); ctx.stroke();
        if ((w.x + w.y) % 3 === 0) { const on = modLv('gen'); ell(w.x === 0 ? 14 : -14, -h * .78 + 9, 3.5, 3.5, on ? '#fff0b0' : '#6a6040'); lights.push([o.sx + (w.x === 0 ? 14 : -14), o.sy - h * .5, on ? 230 : 120, on ? .9 : .45]); }
      } else {
        cube(32, 16, h, w.v < .5 ? '#77756e' : '#6c6a64');
        ctx.strokeStyle = '#00000022'; ctx.lineWidth = 1; ctx.beginPath();
        for (let y = 8; y < h; y += 8) { ctx.moveTo(-32, -y); ctx.lineTo(0, 16 - y); ctx.lineTo(32, -y); } ctx.stroke();
        if (w.win && h > 26) { poly([-24, -h + 12, -8, -h + 20, -8, -h + 32, -24, -h + 24], '#14181c'); poly([24, -h + 12, 8, -h + 20, 8, -h + 32, 24, -h + 24], '#0c1012'); }
        if (w.v > .8) { ctx.fillStyle = '#3a5a2e99'; ctx.fillRect(-30, -h * .3, 9, h * .3); }
      }
    } else if (o.n) drawNode(o.n);
    else if (o.e) {
      const e = o.e, d = e.def;
      if (d.dark) ctx.globalAlpha = clamp(1.4 - dist(e, P) / 4.5, .18, 1);
      if (d.boss) ell(0, 0, 30, 14, `rgba(255,30,60,${.15 + .1 * Math.sin(time * 4)})`);
      if (e.elite) ell(0, 0, 20 * d.sz, 10 * d.sz, `rgba(255,200,60,${.25 + .12 * Math.sin(time * 5)})`);
      drawChar({sz: d.sz * (e.elite ? 1.15 : 1), wide: d.wide, fx: e.fx, body: d.body, skin: d.skin, walk: e.walk, atk: e.atk > 0 ? e.atk / .38 : 0, kind: e.t, hit: e.hit > 0, spikes: d.spikes, boss: d.boss, elite: e.elite, dark: d.dark});
      const top = -44 * d.sz * (e.elite ? 1.15 : 1);
      if (e.hp < e.mhp) { const w = 26 * d.sz; rr(-w / 2 - 1, top - 1, w + 2, 6, 2, '#000b'); rr(-w / 2, top, w * e.hp / e.mhp, 4, 1.5, d.boss ? '#ff3060' : e.elite ? '#ffc040' : '#d04a38'); }
      ctx.font = '700 15px system-ui,sans-serif'; ctx.textAlign = 'center';
      if (!e.aggro && e.alert > .05) { ctx.globalAlpha = .4 + e.alert * .6; ctx.fillStyle = '#ffd040'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.strokeText('?', 0, top - 6); ctx.fillText('?', 0, top - 6); }
      else if (e.bang > 0) { ctx.fillStyle = '#ff4030'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.strokeText('!', 0, top - 6 - e.bang * 6); ctx.fillText('!', 0, top - 6 - e.bang * 6); }
      ctx.globalAlpha = 1;
    } else if (!demo) {
      const a = G.p.eq.armor, w = G.p.eq.weapon;
      const body = a ? {jacket: '#5a4a34', plate: '#6a6e74', hazmat: '#c8a020'}[a.id] : '#3d5a4a';
      if (P.sneak) ctx.globalAlpha = .72;
      if (P.inv > 0 && P.dash <= 0) ctx.globalAlpha = .6;
      const tool = P.gather && P.gather.n.k !== 'bag' && NODES[P.gather.n.k].tool, tw = tool && findTool(tool);
      drawChar({sz: 1, fx: P.fx, body, skin: '#d0a888', walk: P.walk, atk: P.atk > 0 ? P.atk / .22 : 0, kind: 'player', hit: P.hurt > .15, sneak: P.sneak, wpn: tw ? tw[0].id : w && w.id, low: G.p.filter <= 0 && !loc.bunker});
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  // снаряды и эффекты
  for (const p of loc.proj) { const [sx, sy] = iso(p.x, p.y); ell(sx, sy, 5, 2.5, '#0005'); ell(sx, sy - 20, 5, 5, '#90d838'); ell(sx - 1, sy - 21, 2.2, 2.2, '#e8ffa0'); lights.push([sx, sy - 20, 50, .5]); }
  for (const f of loc.fx) {
    const [sx, sy] = iso(f.x, f.y), k = f.t / f.T;
    if (f.k === 'p') { ctx.globalAlpha = 1 - k * k; ctx.fillStyle = f.c; ctx.fillRect(sx - f.s / 2, sy - f.h - f.s / 2, f.s, f.s); ctx.globalAlpha = 1; }
    else if (f.k === 'tracer') {
      const [ex, ey] = iso(f.x2, f.y2), x0 = sx + P.fx * 10, y0 = sy - 22;
      if (f.arrow) { const xx = x0 + (ex - x0) * k, yy = y0 + (ey - 20 - y0) * k, l = Math.hypot(ex - x0, ey - 20 - y0) || 1, ux = (ex - x0) / l, uy = (ey - 20 - y0) / l; ctx.strokeStyle = '#d8c8a0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(xx - ux * 12, yy - uy * 12); ctx.lineTo(xx, yy); ctx.stroke(); }
      else { ctx.strokeStyle = `rgba(255,230,140,${1 - k})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(ex, ey - 20); ctx.stroke(); }
    } else if (f.k === 'flash') { ell(sx + P.fx * 13, sy - 22, 7, 7, `rgba(255,230,140,${1 - k})`); lights.push([sx, sy - 20, 260, .9]); }
    else if (f.k === 'cloud') ell(sx, sy - 10, 75 * k + 20, 38 * k + 10, `rgba(170,210,50,${.5 * (1 - k)})`);
  }
  // прочность объекта, который добываем
  if (P.gather && !P.gather.n.gone && P.gather.n.k !== 'bag') {
    const n = P.gather.n, d = NODES[n.k], [sx, sy] = iso(n.x + .5, n.y + .5), w = 7, tot = d.hp * (w + 2) - 2;
    for (let i = 0; i < d.hp; i++) rr(sx - tot / 2 + i * (w + 2), sy - 78, w, 5, 1.5, i < n.hp ? '#e0e070' : '#000a');
  }
  if (near && !near.gone) {
    const [sx, sy] = iso(near.x + .5, near.y + .5);
    const nm = near.k === 'mod' ? MODS[near.mod].n + (modLv(near.mod) ? (MODS[near.mod].lv && MODS[near.mod].lv.length > 1 ? ` · ур. ${modLv(near.mod)}` : '') : ' (не построено)') : NODES[near.k].n;
    ctx.font = '600 11px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#000c'; ctx.fillStyle = '#f0e8c0';
    const yy = sy - (near.k === 'mod' ? MODS[near.mod].h + 34 : 66); ctx.strokeText(nm, sx, yy); ctx.fillText(nm, sx, yy);
  }
  ctx.textAlign = 'center';
  for (const t of loc.txt) {
    const [sx, sy] = iso(t.x, t.y), e = 1 - Math.pow(1 - t.t, 3);
    ctx.globalAlpha = Math.min(1, (1 - t.t) * 2.2); ctx.font = `800 ${t.big ? 17 : 13}px system-ui,sans-serif`;
    ctx.lineWidth = 3.5; ctx.strokeStyle = '#000'; ctx.fillStyle = t.c; ctx.strokeText(t.s, sx, sy - t.h - e * 24); ctx.fillText(t.s, sx, sy - t.h - e * 24);
  }
  ctx.globalAlpha = 1;
  // ядовитый туман
  if (!loc.bunker && fogSprite) {
    const a = clamp(loc.def.tox / 1.6, .5, 1.5) * .5;
    for (const f of loc.fog) { const [sx, sy] = iso(f.x, f.y), w = 560 * f.s; if (Math.abs(sx - cx) > vw + w / 2 || Math.abs(sy - cy) > vh + w / 4) continue; ctx.globalAlpha = Math.min(1, a * f.a * (.8 + .2 * Math.sin(time * .5 + f.s * 9))); ctx.drawImage(fogSprite, sx - w / 2, sy - w / 4 - 16, w, w / 2); }
    ctx.globalAlpha = 1;
  }

  // ---- экранные слои ----
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const L2 = lights.map(l => { const p = scr(l[0], l[1]); return [p[0], p[1], l[2] * zoom, l[3]]; });
  const pp = scr(px, py - 20);
  if (loc.bunker) {
    L2.push([pp[0], pp[1], 170 * zoom, .7]);
    drawLight(modLv('gen') ? .72 : .86, '3,4,9', L2);
    if (modLv('gen')) { ctx.fillStyle = 'rgba(255,200,120,.035)'; ctx.fillRect(0, 0, W, H); }
  } else {
    const f = loc.def.fog; ctx.fillStyle = `rgba(${f[0]},${f[1]},${f[2]},${.05 + .02 * loc.def.tox})`; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = `rgba(${f[0] + 40},${f[1] + 30},${f[2] + 30},.4)`;
    for (const s of spores) {
      const x = ((s.x * W - camX * zoom * .6 + time * 14 * s.s) % W + W) % W, y = ((s.y * H - camY * zoom * .6 + Math.sin(time * s.v * 20 + s.x * 9) * 20) % H + H) % H;
      ctx.fillRect(x, y, s.s, s.s);
    }
    if (dk > 0 && dk < 1) { ctx.fillStyle = `rgba(255,110,40,${Math.sin(dk * Math.PI) * .13})`; ctx.fillRect(0, 0, W, H); }
    if (dk > .02) {
      const fl = Math.hypot(P.dx - P.dy, (P.dx + P.dy) / 2) || 1, fx = (P.dx - P.dy) / fl, fy = (P.dx + P.dy) / 2 / fl;
      L2.push([pp[0], pp[1], 150 * zoom, .95], [pp[0] + fx * 95 * zoom, pp[1] + fy * 95 * zoom, 175 * zoom, .85]);
      drawLight(dk * .9, '6,10,28', L2);
    }
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .32, W / 2, H / 2, Math.max(W, H) * .72);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(8,12,4,${P.sneak ? .88 : .7})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (G.p.filter <= 0) { ctx.fillStyle = `rgba(150,200,30,${.12 + .1 * Math.sin(time * 5)})`; ctx.fillRect(0, 0, W, H); }
  }
  if (G.p.hp < maxHp() * .3) {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .25, W / 2, H / 2, Math.max(W, H) * .65);
    g.addColorStop(0, 'rgba(160,0,0,0)'); g.addColorStop(1, `rgba(160,0,0,${.35 + .15 * Math.sin(time * 6)})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  if (P.hurt > 0) { ctx.fillStyle = `rgba(200,20,20,${P.hurt * 1.1})`; ctx.fillRect(0, 0, W, H); }
  if (flash > 0) { ctx.fillStyle = `rgba(0,0,0,${Math.min(1, flash)})`; ctx.fillRect(0, 0, W, H); }
  if (joy.id != null) {
    ctx.strokeStyle = '#ffffff44'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(joy.sx, joy.sy, 48, 0, 6.283); ctx.stroke();
    ctx.fillStyle = '#ffffff22'; ctx.fill();
    ctx.fillStyle = '#ffffff77'; ctx.beginPath(); ctx.arc(joy.sx + joy.x * 48, joy.sy + joy.y * 48, 21, 0, 6.283); ctx.fill();
  }
}

// ---------- миникарта ----------
const MINI_COL = {tree: '#3f7a3a', bush: '#5a8a4a', berry: '#8a60e0', rock: '#8a8c90', orev: '#e09a50', coal: '#444', ruby: '#ff4060', crate: '#d8b060', milcrate: '#a8c060', cache: '#ffd850',
  car: '#8a7a6a', scrapp: '#8a7a6a', barrel: '#b0d040', bag: '#ffffff', puddle: '#4a9ab0', sticks: '#6a5a40', stones: '#6a6a6a'};
function drawMini() {
  const c = $('#mini'), m = c.getContext('2d'), S = c.width, N = loc.N, k = S / 2 / N;
  m.clearRect(0, 0, S, S);
  const pt = (x, y) => [(x - y) * k + S / 2, (x + y) * k];
  const dia = (a, b) => { m.beginPath(); let p = pt(a, a); m.moveTo(p[0], p[1]); p = pt(b, a); m.lineTo(p[0], p[1]); p = pt(b, b); m.lineTo(p[0], p[1]); p = pt(a, b); m.lineTo(p[0], p[1]); m.closePath(); };
  dia(0, N); m.fillStyle = '#e8d07030'; m.fill();
  dia(2, N - 2); m.fillStyle = '#10140cdd'; m.fill();
  for (const w of loc.walls) { const p = pt(w.x + .5, w.y + .5); m.fillStyle = '#6a6862'; m.fillRect(p[0] - 1.5, p[1] - 1.5, 3, 3); }
  for (const n of loc.nodes) { const p = pt(n.x + .5, n.y + .5), big = n.k === 'cache' || n.k === 'ruby'; m.fillStyle = MINI_COL[n.k] || '#888'; m.fillRect(p[0] - (big ? 2.5 : 1), p[1] - (big ? 2.5 : 1), big ? 5 : 2, big ? 5 : 2); }
  for (const e of loc.en) if (e.aggro || dist(e, P) < 9) { const p = pt(e.x, e.y); m.fillStyle = e.elite || e.def.boss ? '#ffc040' : '#ff4030'; m.beginPath(); m.arc(p[0], p[1], e.def.boss ? 3.5 : 2, 0, 6.283); m.fill(); }
  const p = pt(P.x, P.y); m.fillStyle = '#fff'; m.beginPath(); m.arc(p[0], p[1], 3, 0, 6.283); m.fill(); m.strokeStyle = '#000'; m.lineWidth = 1; m.stroke();
}
