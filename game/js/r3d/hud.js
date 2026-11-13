'use strict';
/* 3D-бой: интерфейс поля. На земле (3D): клетки хода (синие — 1 ОД, жёлтые — 2 ОД) с контуром, зона дозора,
   зона обнаружения, кольцо выбранного бойца, круг гранаты. Поверх (2D): путь с щитами укрытия у цели, прицел и
   шанс попадания, полоски здоровья, значки, реплики, всплывающие числа урона. Данные — DW.TR.overlay (bscene). */
(function (DW) {
  const R3 = DW.R3, THREE = R3.THREE, U = DW.U, ART = DW.ART;
  if (!THREE) return;
  const T = R3.T, LV = R3.LV;
  const HUD = R3.hud = {};
  const V = function (x, y, z) { return new THREE.Vector3(x || 0, y || 0, z || 0); };
  let group = null, reachMesh = null, reachKey = '', zoneMesh = null, zoneKey = '', ring = null, aoeMesh = null;

  HUD.init = function () {
    if (group) R3.scene.remove(group);
    group = new THREE.Group(); group.renderOrder = 5;
    R3.scene.add(group);
    reachMesh = zoneMesh = aoeMesh = null; reachKey = zoneKey = '';
    ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.52, 40), new THREE.MeshBasicMaterial({ color: 0x5ab4ff, transparent: true, opacity: 0.85, depthWrite: false, fog: false }));
    ring.rotation.x = -Math.PI / 2; ring.renderOrder = 6; ring.visible = false;
    group.add(ring);
  };
  /* клетки поля: quads + контур, цвет на клетку (rgba) */
  function tileMesh(B, colorOf, edge) {
    const P = [], C = [], I = [];
    const quad = function (a, b, c, d, col) {
      const o = P.length / 3;
      P.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], d[0], d[1], d[2]);
      for (let k = 0; k < 4; k++) C.push(col[0], col[1], col[2], col[3]);
      I.push(o, o + 1, o + 2, o, o + 2, o + 3);
    };
    const inset = 0;
    for (let y = 0; y < B.h; y++) for (let x = 0; x < B.w; x++) {
      const c = colorOf(x, y);
      if (!c) continue;
      const h = B.hgt[y * B.w + x] * LV + 0.035;
      const x0 = x * T + inset, x1 = (x + 1) * T - inset, z0 = y * T + inset, z1 = (y + 1) * T - inset;
      quad([x0, h, z1], [x1, h, z1], [x1, h, z0], [x0, h, z0], c);
      if (edge) {
        // контур по границе области одного цвета
        const lw = 0.06;
        const same = function (xx, yy) { const q = colorOf(xx, yy); return q && q[4] === c[4]; };
        const ec = [c[0], c[1], c[2], Math.min(0.95, c[3] * 11)];
        if (!same(x, y - 1)) quad([x * T, h + 0.002, z0 + lw], [(x + 1) * T, h + 0.002, z0 + lw], [(x + 1) * T, h + 0.002, y * T], [x * T, h + 0.002, y * T], ec);
        if (!same(x, y + 1)) quad([x * T, h + 0.002, (y + 1) * T], [(x + 1) * T, h + 0.002, (y + 1) * T], [(x + 1) * T, h + 0.002, z1 - lw], [x * T, h + 0.002, z1 - lw], ec);
        if (!same(x - 1, y)) quad([x * T, h + 0.002, (y + 1) * T], [x0 + lw, h + 0.002, (y + 1) * T], [x0 + lw, h + 0.002, y * T], [x * T, h + 0.002, y * T], ec);
        if (!same(x + 1, y)) quad([x1 - lw, h + 0.002, (y + 1) * T], [(x + 1) * T, h + 0.002, (y + 1) * T], [(x + 1) * T, h + 0.002, y * T], [x1 - lw, h + 0.002, y * T], ec);
      }
    }
    if (!I.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(C, 4));
    g.setIndex(I);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, fog: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4 }));
    m.renderOrder = 4;
    return m;
  }
  function drop(m) { if (m) { group.remove(m); m.geometry.dispose(); } return null; }

  /* обновить 3D-части по DW.TR.overlay */
  HUD.update3d = function (t) {
    const B = DW.BT.get(), ov = DW.TR.overlay || {};
    if (!B || !group) return;
    // клетки хода
    const rk = ov.reach ? (ov.reach.__id || (ov.reach.__id = Math.random())) + '_' + ov.m1 + '_' + ov.m2 : '';
    if (rk !== reachKey) {
      reachKey = rk; reachMesh = drop(reachMesh);
      if (ov.reach) {
        const R = ov.reach;
        reachMesh = tileMesh(B, function (x, y) {
          if (x < 0 || y < 0 || x >= B.w || y >= B.h) return null;
          const i = y * B.w + x, c = R.cost[i];
          if (c === Infinity || R.occ[i] === 2) return null;
          if (c <= ov.m1 + 0.01) return [0.25, 0.6, 1, 0.1, 1];
          if (c <= ov.m2 + 0.01) return [1, 0.72, 0.12, 0.08, 2];
          return null;
        }, true);
        if (reachMesh) group.add(reachMesh);
      }
    }
    // зона дозора врагов и зона обнаружения (скрытность)
    const zk = (ov.owz ? 'o' + (ov.owz.__id || (ov.owz.__id = Math.random())) : '') + (ov.dz && B.concealed ? 'd' + (ov.dz.__id || (ov.dz.__id = Math.random())) : '');
    if (zk !== zoneKey) {
      zoneKey = zk; zoneMesh = drop(zoneMesh);
      if (zk) {
        zoneMesh = tileMesh(B, function (x, y) {
          if (x < 0 || y < 0 || x >= B.w || y >= B.h) return null;
          const i = y * B.w + x;
          if (ov.dz && B.concealed && ov.dz[i]) return [1, 0.55, 0.15, 0.13, 3];
          if (ov.owz && ov.owz[i]) return [1, 0.3, 0.25, 0.1, 4];
          return null;
        }, true);
        if (zoneMesh) group.add(zoneMesh);
      }
    }
    // кольцо выбранного
    if (ov.sel && ov.sel.alive) {
      const a = R3.units.anchor(ov.sel, false);
      ring.position.set(a.x, a.y + 0.04, a.z);
      ring.visible = true;
      const k = 1 + Math.sin(t / 200) * 0.06;
      ring.scale.set(k, k, k);
      ring.material.opacity = 0.65 + Math.sin(t / 200) * 0.2;
    } else ring.visible = false;
    // круг гранаты
    const ak = ov.aoe && ov.aoe.x !== undefined ? ov.aoe.x + ',' + ov.aoe.y + ',' + ov.aoe.r : '';
    if (ak !== (HUD._ak || '')) {
      HUD._ak = ak; aoeMesh = drop(aoeMesh);
      if (ak) {
        const r = (ov.aoe.r + 0.5) * T;
        aoeMesh = new THREE.Mesh(new THREE.CircleGeometry(r, 48), new THREE.MeshBasicMaterial({ color: 0xff6a30, transparent: true, opacity: 0.25, depthWrite: false, fog: false }));
        aoeMesh.rotation.x = -Math.PI / 2;
        aoeMesh.position.set((ov.aoe.x + 0.5) * T, R3.hAt(ov.aoe.x, ov.aoe.y) + 0.05, (ov.aoe.y + 0.5) * T);
        aoeMesh.renderOrder = 6;
        group.add(aoeMesh);
      }
    }
  };

  /* ---------- 2D поверх ---------- */
  const scr = function (p) { return R3.toScreen(p); };
  const tileScr = function (x, y, lift) { return R3.toScreen(V((x + 0.5) * T, R3.hAt(x, y) + (lift || 0), (y + 0.5) * T)); };
  function headScr(u, up) { return scr(R3.units.anchor(u, true).add(V(0, up || 0, 0))); }
  function groundEllipse(g, X, Y, Z, r, n) {
    g.beginPath();
    for (let i = 0; i <= (n || 28); i++) {
      const a = i / (n || 28) * Math.PI * 2;
      const s = scr(V(X + Math.cos(a) * r, Y, Z + Math.sin(a) * r));
      if (!s) continue;
      if (i) g.lineTo(s[0], s[1]); else g.moveTo(s[0], s[1]);
    }
  }
  let vig = null, vigK = '';
  HUD.draw2d = function (g, W, H) {
    const B = DW.BT.get(), ov = DW.TR.overlay || {};
    if (!B) return;
    // виньетка — края кадра чуть темнее (как в кино)
    if (vigK !== W + 'x' + H) {
      vigK = W + 'x' + H;
      vig = document.createElement('canvas'); vig.width = Math.ceil(W / 4); vig.height = Math.ceil(H / 4);
      const vg = vig.getContext('2d'), w = vig.width, h = vig.height;
      const gr = vg.createRadialGradient(w / 2, h * 0.48, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.72);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(8,6,4,0.42)');
      vg.fillStyle = gr; vg.fillRect(0, 0, w, h);
    }
    g.drawImage(vig, 0, 0, W, H);
    const tr = DW.TR2, t = tr.now();
    // путь
    if (ov.path && ov.sel) {
      const pts = [[ov.sel.x, ov.sel.y]].concat(ov.path).map(function (p) { return tileScr(p[0], p[1], 0.05); }).filter(Boolean);
      const pc = ov.pathDash ? '255,210,90' : '150,215,255';
      const line = function () { g.beginPath(); pts.forEach(function (s, i) { if (i) g.lineTo(s[0], s[1]); else g.moveTo(s[0], s[1]); }); };
      g.lineCap = 'round'; g.lineJoin = 'round';
      line(); g.strokeStyle = 'rgba(' + pc + ',0.3)'; g.lineWidth = 9; g.stroke();
      line(); g.strokeStyle = 'rgba(' + pc + ',0.95)'; g.lineWidth = 3; g.setLineDash([8, 6]); g.lineDashOffset = -t / 40; g.stroke();
      g.setLineDash([]); g.lineDashOffset = 0;
      const dd = ov.path[ov.path.length - 1];
      if (dd) {
        const X = (dd[0] + 0.5) * T, Z = (dd[1] + 0.5) * T, Y = R3.hAt(dd[0], dd[1]) + 0.05;
        const pulse = 0.5 + Math.sin(t / 220) * 0.5;
        groundEllipse(g, X, Y, Z, 0.45, 32); g.strokeStyle = '#fff'; g.lineWidth = 2.6; g.stroke();
        groundEllipse(g, X, Y, Z, 0.55 + pulse * 0.08, 32); g.strokeStyle = 'rgba(' + pc + ',' + (0.35 + pulse * 0.4) + ')'; g.lineWidth = 1.6; g.stroke();
        // столб света
        const a = scr(V(X, Y, Z)), b = scr(V(X, Y + 1.7, Z));
        if (a && b) {
          const gr = g.createLinearGradient(0, b[1], 0, a[1]); gr.addColorStop(0, 'rgba(' + pc + ',0)'); gr.addColorStop(1, 'rgba(' + pc + ',' + (0.2 + pulse * 0.1) + ')');
          g.fillStyle = gr; g.beginPath(); g.moveTo(a[0] - 12, a[1]); g.lineTo(b[0] - 8, b[1]); g.lineTo(b[0] + 8, b[1]); g.lineTo(a[0] + 12, a[1]); g.closePath(); g.fill();
        }
        (ov.shields || []).forEach(function (s) {
          const p = scr(V(X + s.dx * 0.5 * T, Y + 0.9, Z + s.dy * 0.5 * T));
          if (p) tr.drawShield(g, p[0], p[1], s.c === 2, s.c === 2 ? '#5ab4ff' : '#9fd3ff');
        });
      }
    }
    (ov.seeMarks || []).forEach(function (m) {
      const p = headScr(m.u, 0.35);
      if (!p) return;
      g.fillStyle = m.flank ? '#ffd25a' : '#ff6b5b';
      ART.poly(g, [[p[0] - 7, p[1] - 9], [p[0] + 7, p[1] - 9], [p[0], p[1]]]);
    });
    if (ov.targets && ov.sel) {
      ov.targets.forEach(function (tg) {
        const u = tg.u, base = R3.units.anchor(u, false), cur = ov.target === u;
        const k = tr.unitScale(u) / 1.13;
        groundEllipse(g, base.x, base.y + 0.04, base.z, 0.55 * k, 28);
        g.strokeStyle = cur ? '#ff4a3a' : 'rgba(255,110,90,0.75)'; g.lineWidth = cur ? 3 : 2; g.stroke();
        const ch = scr(base.clone().add(V(0, 1.05 * k, 0)));
        if (cur && ch) {
          const r = 13 + Math.sin(t / 150) * 2;
          g.beginPath(); g.arc(ch[0], ch[1], r, 0, Math.PI * 2); g.stroke();
          g.beginPath(); g.moveTo(ch[0] - r - 6, ch[1]); g.lineTo(ch[0] - r + 4, ch[1]); g.moveTo(ch[0] + r - 4, ch[1]); g.lineTo(ch[0] + r + 6, ch[1]);
          g.moveTo(ch[0], ch[1] - r - 6); g.lineTo(ch[0], ch[1] - r + 4); g.moveTo(ch[0], ch[1] + r - 4); g.lineTo(ch[0], ch[1] + r + 6); g.stroke();
          const m = R3.units.muzzle(ov.sel), ms = m && scr(m);
          if (ms) { g.strokeStyle = 'rgba(255,80,60,0.6)'; g.lineWidth = 2; g.setLineDash([6, 6]); g.beginPath(); g.moveTo(ms[0], ms[1]); g.lineTo(ch[0], ch[1]); g.stroke(); g.setLineDash([]); }
        }
        if (tg.hit !== undefined) {
          const hp = headScr(u, 0.55);
          if (hp) {
            g.font = 'bold 13px sans-serif'; g.textAlign = 'center';
            g.fillStyle = 'rgba(0,0,0,0.78)'; g.fillRect(hp[0] - 20, hp[1] - 12, 40, 16);
            g.fillStyle = cur ? '#ffd25a' : '#fff'; g.fillText(tg.hit + '%', hp[0], hp[1] + 1);
          }
        }
      });
    }
    (ov.allies || []).forEach(function (a) {
      const b = R3.units.anchor(a, false);
      groundEllipse(g, b.x, b.y + 0.04, b.z, 0.6, 28);
      g.strokeStyle = 'rgba(127,208,106,' + (0.6 + Math.sin(t / 180) * 0.3) + ')'; g.lineWidth = 3; g.stroke();
    });
    if (ov.aoe && ov.sel) {
      const b = R3.units.anchor(ov.sel, false);
      groundEllipse(g, b.x, b.y + 0.05, b.z, ov.aoe.range * T, 48);
      g.strokeStyle = 'rgba(255,200,80,0.45)'; g.lineWidth = 2; g.setLineDash([8, 6]); g.stroke(); g.setLineDash([]);
    }
    // полоски здоровья, значки, укрытие
    B.units.forEach(function (u) {
      if (!u.alive || u.evac || (u.side === 'e' && !u.seen)) return;
      const p = headScr(u, 0.28);
      if (!p || p[0] < -40 || p[0] > W + 40 || p[1] < -40 || p[1] > H + 40) return;
      const showBar = u.side === 'e' || u.kind === 'turret' || ov.sel === u || u.hp < u.maxHp || (ov.allies && ov.allies.indexOf(u) >= 0);
      if (showBar) tr.drawHp(g, u, p[0], p[1]);
      tr.drawStatus(g, u, p[0], p[1] - 10);
      const cvl = tr.coverLevel(u);
      if (cvl && !u.hunker) {
        const bw = showBar ? Math.min(70, u.maxHp * 5.4) / 2 + 12 : 0;
        tr.drawShield(g, p[0] - bw - (showBar ? 2 : 0), p[1] + 2, cvl === 2, u.side === 'p' ? (cvl === 2 ? '#5ab4ff' : '#9fd3ff') : (cvl === 2 ? '#ff7a5a' : '#ffb09a'));
      }
      if (u.side === 'e' && !u.active) { g.fillStyle = '#cfc7b8'; g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.fillText('?', p[0] + 24, p[1] + 5); }
    });
    // реплики
    const fx = tr.fxState();
    const placed = [];
    g.font = '12px sans-serif'; g.textAlign = 'center';
    (fx.barks || []).forEach(function (b) {
      const u = b.u;
      if (t - b.t0 > b.life || t < b.t0 || !u) return;
      if (u.side === 'e' && !u.seen) return;
      const p = headScr(u, 0.75);
      if (!p) return;
      const k = (t - b.t0) / b.life;
      const a = k < 0.1 ? k / 0.1 : (k > 0.85 ? (1 - k) / 0.15 : 1);
      let Y = p[1] - (k < 0.1 ? (1 - k / 0.1) * 6 : 0);
      const w = g.measureText(b.text).width + 14;
      for (let tries = 0; tries < 4; tries++) {
        let hit = false;
        for (let i = 0; i < placed.length; i++) { const q = placed[i]; if (Math.abs(q.x - p[0]) < (q.w + w) / 2 + 2 && Math.abs(q.y - Y) < 21) { Y = q.y - 22; hit = true; } }
        if (!hit) break;
      }
      placed.push({ x: p[0], y: Y, w: w });
      g.globalAlpha = a;
      g.fillStyle = b.bad ? 'rgba(60,14,10,0.9)' : 'rgba(250,244,228,0.95)';
      const x0 = p[0] - w / 2, y0 = Y - 16;
      g.beginPath(); g.moveTo(x0 + 6, y0); g.lineTo(x0 + w - 6, y0); g.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + 6); g.lineTo(x0 + w, y0 + 12); g.quadraticCurveTo(x0 + w, y0 + 18, x0 + w - 6, y0 + 18);
      g.lineTo(p[0] + 5, y0 + 18); g.lineTo(p[0], y0 + 24); g.lineTo(p[0] - 3, y0 + 18); g.lineTo(x0 + 6, y0 + 18); g.quadraticCurveTo(x0, y0 + 18, x0, y0 + 12); g.lineTo(x0, y0 + 6); g.quadraticCurveTo(x0, y0, x0 + 6, y0); g.closePath(); g.fill();
      g.fillStyle = b.bad ? '#ffd8cc' : '#2a2016'; g.fillText(b.text, p[0], y0 + 13);
      g.globalAlpha = 1;
    });
    // всплывающие числа
    (fx.floats || []).forEach(function (f) {
      const kk = (t - f.t0) / f.life;
      if (kk < 0 || kk > 1) return;
      const p = tileScr(f.tx, f.ty, 1.9 + kk * 0.7);
      if (!p) return;
      const off = (f.y0 !== undefined ? 0 : 0);
      g.globalAlpha = kk > 0.7 ? (1 - kk) / 0.3 : 1;
      g.font = (f.big ? 'bold 20px' : 'bold 15px') + ' sans-serif'; g.textAlign = 'center';
      g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.85)'; g.strokeText(f.text, p[0], p[1] + off);
      g.fillStyle = f.color; g.fillText(f.text, p[0], p[1] + off);
      g.globalAlpha = 1;
    });
  };
})(window.DW);
