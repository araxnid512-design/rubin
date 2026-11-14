'use strict';
/* Генератор тактических карт */
(function (DW) {
  const U = DW.U, D = DW.D;
  const MG = {};

  function M(w, h, g) {
    return {
      w: w, h: h,
      ground: new Array(w * h).fill(g), obj: new Array(w * h).fill(0), objHp: new Array(w * h).fill(0), hgt: new Array(w * h).fill(0),
      decor: [], props: [], items: [], itemList: [], deploy: [], evac: [], pods: [], spawn: [], turrets: [],
      anchor: null, post: null, kind: 'normal'
    };
  }
  function I(m, x, y) { return y * m.w + x; }
  function inb(m, x, y) { return x >= 0 && y >= 0 && x < m.w && y < m.h; }
  function setO(m, x, y, o) {
    if (!inb(m, x, y)) return;
    const i = I(m, x, y);
    m.obj[i] = o; m.objHp[i] = o ? D.OBJ[o].hp : 0;
  }
  function setG(m, x, y, g) { if (inb(m, x, y)) m.ground[I(m, x, y)] = g; }
  function walkG(m, x, y) { return D.GROUND[m.ground[I(m, x, y)]].walk; }
  function free(m, x, y) { return inb(m, x, y) && !m.obj[I(m, x, y)] && walkG(m, x, y); }

  function groundNoise(m, list, scale) {
    const seed = U.rand(1, 99999);
    const sc = scale || 0.13;
    for (let y = 0; y < m.h; y++) {
      for (let x = 0; x < m.w; x++) {
        const n = U.fbm(x * sc, y * sc, seed, 3);
        let g = list[list.length - 1][1];
        for (let k = 0; k < list.length; k++) { if (n < list[k][0]) { g = list[k][1]; break; } }
        m.ground[I(m, x, y)] = g;
      }
    }
  }
  function scatter(m, obj, count, minX, maxX) {
    const mx = maxX === undefined ? m.w - 1 : maxX;
    for (let i = 0; i < count; i++) {
      for (let t = 0; t < 30; t++) {
        const x = U.rand(minX, mx), y = U.rand(0, m.h - 1);
        if (free(m, x, y)) { setO(m, x, y, obj); break; }
      }
    }
  }
  function lines(m, obj, count, minX) {
    for (let i = 0; i < count; i++) {
      const x = U.rand(minX, m.w - 2), y = U.rand(1, m.h - 2);
      const hor = Math.random() < 0.5;
      const len = U.rand(2, 4);
      for (let k = 0; k < len; k++) {
        const xx = hor ? x + k : x, yy = hor ? y : y + k;
        if (free(m, xx, yy)) setO(m, xx, yy, obj);
      }
    }
  }
  function cluster(m, cx, cy, n, obj) {
    let x = cx, y = cy;
    for (let i = 0; i < n; i++) {
      if (free(m, x, y)) setO(m, x, y, obj);
      const d = U.pick([[1, 0], [-1, 0], [0, 1], [0, -1]]);
      x = U.clamp(x + d[0], 0, m.w - 1); y = U.clamp(y + d[1], 0, m.h - 1);
    }
  }
  function pool(m, cx, cy, n, g) {
    let x = cx, y = cy;
    for (let i = 0; i < n; i++) {
      if (inb(m, x, y) && !m.obj[I(m, x, y)]) setG(m, x, y, g);
      const d = U.pick([[1, 0], [-1, 0], [0, 1], [0, -1]]);
      x = U.clamp(x + d[0], 1, m.w - 2); y = U.clamp(y + d[1], 1, m.h - 2);
    }
  }
  function decor(m, t, count, minX) {
    for (let i = 0; i < count; i++) m.decor.push({ x: U.randf(minX || 0, m.w), y: U.randf(0, m.h), t: t, r: Math.random() });
  }
  function props(m, t, count, minX) {
    for (let i = 0; i < count; i++) {
      for (let k = 0; k < 20; k++) {
        const x = U.rand(minX || 0, m.w - 1), y = U.rand(0, m.h - 1);
        if (!free(m, x, y)) continue;
        m.props.push({ x: x + 0.25 + Math.random() * 0.5, y: y + 0.25 + Math.random() * 0.5, t: t });
        break;
      }
    }
  }
  function building(m, x0, y0, w, h, wallObj, floorG) {
    (m.rooms = m.rooms || []).push([x0, y0, x0 + w - 1, y0 + h - 1]);
    const perim = [];
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        setG(m, x, y, floorG);
        const edge = x === x0 || y === y0 || x === x0 + w - 1 || y === y0 + h - 1;
        if (edge) {
          setO(m, x, y, wallObj);
          const corner = (x === x0 || x === x0 + w - 1) && (y === y0 || y === y0 + h - 1);
          if (!corner) perim.push([x, y]);
        } else {
          setO(m, x, y, 0);
        }
      }
    }
    U.shuffle(perim);
    // двери: снаружи должна быть проходимая клетка, двери не рядом друг с другом
    const doors = U.rand(2, 3);
    const outOf = function (x, y) { return x === x0 ? [x - 1, y] : (x === x0 + w - 1 ? [x + 1, y] : (y === y0 ? [x, y - 1] : [x, y + 1])); };
    const used = [];
    perim.sort(function (a, b) { const oa = outOf(a[0], a[1]), ob = outOf(b[0], b[1]); return (inb(m, ob[0], ob[1]) && walkG(m, ob[0], ob[1]) ? 1 : 0) - (inb(m, oa[0], oa[1]) && walkG(m, oa[0], oa[1]) ? 1 : 0); });
    let k = 0;
    for (let n = 0; n < doors && k < perim.length; k++) {
      const d = perim[k], o = outOf(d[0], d[1]);
      if (!inb(m, o[0], o[1]) || !walkG(m, o[0], o[1])) continue;
      if (used.some(function (u) { return Math.abs(u[0] - d[0]) + Math.abs(u[1] - d[1]) < 3; })) continue;
      setO(m, d[0], d[1], 0); setO(m, o[0], o[1], 0); used.push(d); n++;
    }
    perim.splice(0, k);
    // окна: не рядом с дверями и другими окнами (иначе получается дыра без рамы и перемычки)
    const near = function (p) { return used.some(function (u) { return Math.abs(u[0] - p[0]) + Math.abs(u[1] - p[1]) < 2; }); };
    const wins = U.rand(1, 3);
    for (let n = 0, j = 0; n < wins && j < perim.length; j++) {
      const p = perim[j];
      if (!p || near(p)) continue;
      setO(m, p[0], p[1], 1); used.push(p); perim[j] = null; n++;
    }
    // редкие проломы — в руинах
    for (let j = 0; j < perim.length; j++) {
      const p = perim[j];
      if (p && !near(p) && Math.random() < 0.06) { setO(m, p[0], p[1], 0); setG(m, p[0], p[1], 8); used.push(p); }
    }
    // обстановка: мебель вдоль стен (не у дверей), шкафы в углах, немного ящиков и обломков
    const iw = w - 2, ih = h - 2;
    const wallAt = function (x, y) { return inb(m, x, y) && m.obj[I(m, x, y)] && m.obj[I(m, x, y)] !== 21 && m.obj[I(m, x, y)] !== 22; };
    const doorNear = function (x, y) {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const X = x + dx, Y = y + dy;
        const edge = X === x0 || Y === y0 || X === x0 + w - 1 || Y === y0 + h - 1;
        if (edge && inb(m, X, Y) && !m.obj[I(m, X, Y)]) return true;
      }
      return false;
    };
    for (let y = y0 + 1; y < y0 + h - 1; y++) {
      for (let x = x0 + 1; x < x0 + w - 1; x++) {
        const r = Math.random();
        const byWall = wallAt(x - 1, y) || wallAt(x + 1, y) || wallAt(x, y - 1) || wallAt(x, y + 1);
        const corner = (x === x0 + 1 || x === x0 + w - 2) && (y === y0 + 1 || y === y0 + h - 2);
        if (iw >= 3 && ih >= 2 && byWall && !doorNear(x, y)) {
          if (corner && r < 0.4) { setO(m, x, y, 22); continue; }
          if (r < 0.32) { setO(m, x, y, 21); continue; }
        }
        if (r < 0.05) setO(m, x, y, 4);
        else if (r < 0.08) setO(m, x, y, 8);
      }
    }
  }
  function cellular(m, fill, iters, obj) {
    let wall = new Array(m.w * m.h);
    for (let y = 0; y < m.h; y++) {
      for (let x = 0; x < m.w; x++) {
        const edge = x === 0 || y === 0 || x === m.w - 1 || y === m.h - 1;
        wall[I(m, x, y)] = edge ? (Math.random() < 0.7) : Math.random() < fill;
      }
    }
    for (let it = 0; it < iters; it++) {
      const nw = wall.slice();
      for (let y = 0; y < m.h; y++) {
        for (let x = 0; x < m.w; x++) {
          let n = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const xx = x + dx, yy = y + dy;
            if (!inb(m, xx, yy) || wall[I(m, xx, yy)]) n++;
          }
          nw[I(m, x, y)] = n >= 5 || (n === 0 && Math.random() < 0.3);
        }
      }
      wall = nw;
    }
    for (let i = 0; i < wall.length; i++) if (wall[i]) { m.obj[i] = obj; m.objHp[i] = D.OBJ[obj].hp; }
  }

  /* Связность: прорубаем коридоры от изолированных областей к основной */
  function regions(m) {
    const reg = new Int32Array(m.w * m.h).fill(-1);
    const list = [];
    for (let i = 0; i < reg.length; i++) {
      const x = i % m.w, y = (i / m.w) | 0;
      if (reg[i] >= 0 || !free(m, x, y)) continue;
      const id = list.length;
      const tiles = [];
      const st = [i]; reg[i] = id;
      while (st.length) {
        const c = st.pop(); tiles.push(c);
        const cx = c % m.w, cy = (c / m.w) | 0;
        const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (let k = 0; k < 4; k++) {
          const nx = cx + nb[k][0], ny = cy + nb[k][1];
          if (!free(m, nx, ny)) continue;
          const ni = I(m, nx, ny);
          if (reg[ni] >= 0) continue;
          reg[ni] = id; st.push(ni);
        }
      }
      list.push(tiles);
    }
    return { reg: reg, list: list };
  }
  function carve(m, x, y) {
    if (!inb(m, x, y)) return;
    if (m.obj[I(m, x, y)] === 15) return;
    setO(m, x, y, 0);
    if (!walkG(m, x, y)) setG(m, x, y, 8);
  }
  function connect(m, cx, cy) {
    for (let guard = 0; guard < 150; guard++) {
      const R = regions(m);
      const main = R.reg[I(m, cx, cy)];
      if (main < 0) { carve(m, cx, cy); continue; }
      if (R.list.length <= 1) return;
      let other = -1;
      for (let k = 0; k < R.list.length; k++) if (k !== main) { other = k; break; }
      if (other < 0) return;
      const tiles = R.list[other];
      const a = tiles[Math.floor(Math.random() * tiles.length)];
      const ax = a % m.w, ay = (a / m.w) | 0;
      let best = null, bd = 1e9;
      const mt = R.list[main];
      for (let k = 0; k < mt.length; k++) {
        const bx = mt[k] % m.w, by = (mt[k] / m.w) | 0;
        const d = Math.abs(bx - ax) + Math.abs(by - ay);
        if (d < bd) { bd = d; best = [bx, by]; }
      }
      if (!best) return;
      let x = ax, y = ay;
      const horFirst = Math.random() < 0.5;
      if (horFirst) {
        while (x !== best[0]) { x += Math.sign(best[0] - x); carve(m, x, y); }
        while (y !== best[1]) { y += Math.sign(best[1] - y); carve(m, x, y); }
      } else {
        while (y !== best[1]) { y += Math.sign(best[1] - y); carve(m, x, y); }
        while (x !== best[0]) { x += Math.sign(best[0] - x); carve(m, x, y); }
      }
    }
  }
  function flood(m, sx, sy) {
    const r = new Uint8Array(m.w * m.h);
    if (!free(m, sx, sy)) return r;
    const LE = {}, ST = stairIndex(m);
    (m.ladders || []).forEach(function (l) { const a = I(m, l.x, l.y), b = I(m, l.rx, l.ry); LE[a + '>' + b] = 1; LE[b + '>' + a] = 1; });
    const st = [I(m, sx, sy)]; r[st[0]] = 1;
    while (st.length) {
      const c = st.pop();
      const cx = c % m.w, cy = (c / m.w) | 0;
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (let k = 0; k < 4; k++) {
        const nx = cx + nb[k][0], ny = cy + nb[k][1];
        if (!free(m, nx, ny)) continue;
        const ni = I(m, nx, ny);
        if (r[ni]) continue;
        if (m.hgt[ni] !== m.hgt[c] && !LE[c + '>' + ni]) continue;
        if (!stairStep(ST, c, ni)) continue;
        r[ni] = 1; st.push(ni);
      }
    }
    return r;
  }

  function setupDeploy(m) {
    const cy = m.h >> 1;
    for (let y = cy - 4; y <= cy + 4; y++) {
      for (let x = 0; x <= 4; x++) {
        if (!inb(m, x, y)) continue;
        setO(m, x, y, 0);
        if (!walkG(m, x, y)) setG(m, x, y, 0);
      }
    }
    const dep = [];
    for (let y = cy - 3; y <= cy + 3; y++) for (let x = 1; x <= 3; x++) dep.push([x, y]);
    dep.sort(function (a, b) { return ((a[0] + a[1]) % 2) - ((b[0] + b[1]) % 2) || U.dist(a[0], a[1], 2, cy) - U.dist(b[0], b[1], 2, cy); });
    m.deploy = dep;
    m.evac = [];
    for (let y = cy - 2; y <= cy + 2; y++) for (let x = 0; x <= 2; x++) m.evac.push([x, y]);
    m.center = [2, cy];
    // немного укрытий перед зоной высадки
    const covers = [[5, cy - 3], [5, cy - 2], [6, cy + 1], [5, cy + 3], [6, cy + 4], [6, cy - 5]];
    covers.forEach(function (c) {
      if (Math.random() < 0.7 && free(m, c[0], c[1])) setO(m, c[0], c[1], U.pick([1, 4, 6, 4]));
    });
  }

  function placePods(m, pods, reach) {
    const cx = m.center[0], cy = m.center[1];
    const minX = m.kind === 'defense' ? 0 : Math.floor(m.w * 0.38);
    const occupied = {};
    m.deploy.forEach(function (d) { occupied[d[0] + ',' + d[1]] = 1; });
    const cands = [];
    for (let y = 0; y < m.h; y++) for (let x = minX; x < m.w; x++) {
      if (reach[I(m, x, y)] && free(m, x, y)) cands.push([x, y]);
    }
    U.shuffle(cands);
    const centers = [];
    for (let p = 0; p < pods.length; p++) {
      const pod = pods[p];
      let c = null;
      if (pod.anchor && m.anchor) {
        let bd = 1e9;
        cands.forEach(function (t) {
          const d = U.dist(t[0], t[1], m.anchor.x, m.anchor.y);
          if (d < bd && !occupied[t[0] + ',' + t[1]]) { bd = d; c = t; }
        });
      }
      for (let pass = 0; pass < 3 && !c; pass++) {
        const minSep = [6, 4, 2][pass], minFar = [12, 9, 6][pass];
        for (let k = 0; k < cands.length; k++) {
          const t = cands[k];
          if (occupied[t[0] + ',' + t[1]]) continue;
          if (U.dist(t[0], t[1], cx, cy) < minFar) continue;
          if (centers.some(function (q) { return U.dist(q[0], q[1], t[0], t[1]) < minSep; })) continue;
          c = t; break;
        }
      }
      if (!c) return false;
      centers.push(c);
      const near = cands.filter(function (t) { return U.dist(t[0], t[1], c[0], c[1]) <= 3 && !occupied[t[0] + ',' + t[1]]; });
      near.sort(function (a, b) { return U.dist(a[0], a[1], c[0], c[1]) - U.dist(b[0], b[1], c[0], c[1]); });
      const members = [];
      for (let k = 0; k < pod.types.length; k++) {
        const t = near[k];
        if (!t) break;
        occupied[t[0] + ',' + t[1]] = 1;
        members.push({ type: pod.types[k], x: t[0], y: t[1] });
      }
      if (!members.length) return false;
      m.pods.push({ members: members });
    }
    m._occupied = occupied;
    return true;
  }
  function placeItems(m, reach) {
    const occ = m._occupied || {};
    const cands = [];
    for (let y = 0; y < m.h; y++) for (let x = 6; x < m.w; x++) {
      if (reach[I(m, x, y)] && free(m, x, y) && !occ[x + ',' + y]) cands.push([x, y]);
    }
    U.shuffle(cands);
    const placed = [];
    m.itemList.forEach(function (it) {
      for (let pass = 0; pass < 2; pass++) {
        const sep = pass === 0 ? 3.5 : 1.5;
        for (let k = 0; k < cands.length; k++) {
          const t = cands[k];
          if (occ[t[0] + ',' + t[1]]) continue;
          if (placed.some(function (p) { return U.dist(p[0], p[1], t[0], t[1]) < sep; })) continue;
          occ[t[0] + ',' + t[1]] = 1;
          placed.push(t);
          m.items.push({ x: t[0], y: t[1], kind: it.kind, amt: it.amt });
          return;
        }
      }
    });
  }

  /* ---------- Высоты ---------- */
  function heights(m, sc, t1, t2, minX) {
    const seed = U.rand(1, 99999);
    for (let y = 0; y < m.h; y++) for (let x = (minX || 0); x < m.w; x++) {
      const n = U.fbm(x * sc, y * sc, seed, 3);
      m.hgt[I(m, x, y)] = n > t2 ? 2 : (n > t1 ? 1 : 0);
    }
  }
  function raise(m, x0, y0, x1, y1, h) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inb(m, x, y)) m.hgt[I(m, x, y)] = Math.max(m.hgt[I(m, x, y)], h);
  }
  function smoothH(m) {
    for (let i = 0; i < m.hgt.length; i++) if (!walkG(m, i % m.w, (i / m.w) | 0) && m.ground[i] === 7) m.hgt[i] = 0;
    for (let it = 0; it < 4; it++) {
      let changed = false;
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
        const i = I(m, x, y);
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
          const nx = x + d[0], ny = y + d[1];
          if (!inb(m, nx, ny)) return;
          const j = I(m, nx, ny);
          if (m.hgt[i] - m.hgt[j] > 1) { m.hgt[i] = m.hgt[j] + 1; changed = true; }
        });
      }
      if (!changed) break;
    }
  }
  /* ---------- Шаблоны построек ---------- */
  const PREFABS = {
    gas: ['########.', '#k.c.k..#', '#.....o.#', '##.###..#', '....=.k.k', '....=....'],
    checkpoint: ['.bbb.bbb.', 'b.......b', 'b..C.o..b', 'b..C....b', '.bbb.bbb.'],
    depot: ['MMMMMMMM', 'M.CC.c.M', 'M......M', 'M.cc.CCM', 'MMM..MMM'],
    pillbox: ['.SSSS.', 'S....S', '=.c..=', 'S....S', '.SS.S.'],
    convoy: ['v.v.v', '.....', 'c.o.c'],
    outpost: ['.c..c.', 'cbbbbc', '.b..b.', '.b..b.', 'cb..bc'],
    // жилые дома и казарма: двери, окна, мебель внутри (заходить и прятаться за обстановкой)
    house: ['##=###.', '#f..F#.', '=....#.', '#f.....', '#F.f.f#', '###=###'],
    house2: ['#=##=##', '#F...f#', '#.....=', '..f.F.#', '#f....#', '##.####'],
    barracks: ['MMMMMMMMM', 'Mf.f.f.FM', 'M.......=', '....f.f.M', 'MFf.....M', 'MMMM.MMMM']
  };
  const PF = { '#': 2, 'M': 11, 'S': 14, '=': 1, 'b': 6, 'c': 4, 'o': 9, 'k': 12, 'C': 18, 'T': 5, 'r': 8, 'v': 7, 'f': 21, 'F': 22 };
  const ROOMS = { house: 1, house2: 1, barracks: 1, depot: 1 };
  /* Проходимость дверей: у каждого проёма в стене (пустая клетка между двумя стенами) по обе стороны —
     свободные клетки на той же высоте ±1, иначе в дом не войти */
  function fixDoors(m) {
    const wall = function (x, y) { if (!inb(m, x, y)) return false; const o = m.obj[I(m, x, y)]; return o === 2 || o === 11 || o === 14; };
    for (let y = 1; y < m.h - 1; y++) for (let x = 1; x < m.w - 1; x++) {
      const i = I(m, x, y);
      if (m.obj[i] || !walkG(m, x, y)) continue;
      let sides = null;
      if (wall(x - 1, y) && wall(x + 1, y)) sides = [[x, y - 1], [x, y + 1]];
      else if (wall(x, y - 1) && wall(x, y + 1)) sides = [[x - 1, y], [x + 1, y]];
      if (!sides) continue;
      sides.forEach(function (sd) {
        if (!inb(m, sd[0], sd[1])) return;
        const j = I(m, sd[0], sd[1]);
        if (m.obj[j] && !wall(sd[0], sd[1])) { m.obj[j] = 0; m.objHp[j] = 0; }
        if (!walkG(m, sd[0], sd[1])) setG(m, sd[0], sd[1], m.ground[i]);
        if (m.hgt[j] !== m.hgt[i] && m.ground[j] !== 12) m.hgt[j] = m.hgt[i];
      });
    }
  }
  function prefab(m, name, minX, floor) {
    const pf = PREFABS[name];
    const ph = pf.length, pw = pf[0].length;
    for (let t = 0; t < 30; t++) {
      const x0 = U.rand(minX, m.w - pw - 1), y0 = U.rand(1, m.h - ph - 1);
      let busy = 0;
      for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) if (m.obj[I(m, x0 + x, y0 + y)]) busy++;
      if (busy > pw * ph * 0.15) continue;
      const hh = m.hgt[I(m, x0, y0)];
      if (ROOMS[name]) (m.rooms = m.rooms || []).push([x0, y0, x0 + pw - 1, y0 + ph - 1]);
      for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
        const ch = pf[y][x], X = x0 + x, Y = y0 + y;
        m.hgt[I(m, X, Y)] = hh;
        if (ch === ' ') continue;
        setO(m, X, Y, PF[ch] || 0);
        if (!walkG(m, X, Y)) setG(m, X, Y, 0);
        if (floor !== undefined && ch === '.') setG(m, X, Y, floor);
      }
      return true;
    }
    return false;
  }

  /* Техника на 2–3 клетки в ряд: все клетки свободны, проходимы и на одной высоте; models — индексы D.VEHICLES */
  function vehicles(m, n, minX, models) {
    m.vehicles = m.vehicles || [];
    for (let k = 0; k < n; k++) {
      for (let t = 0; t < 40; t++) {
        const mi = U.pick(models), len = D.VEHICLES[mi][1], wd = D.VEHICLES[mi][2] || 1, d = U.rand(0, 1);
        const x = U.rand(minX || 0, m.w - 1 - (d === 0 ? len : wd)), y = U.rand(1, m.h - 2 - (d === 1 ? len : wd));
        let ok = true;
        const h0 = m.hgt[I(m, x, y)];
        // клетки машины и кольцо вокруг: проход вокруг машины
        for (let j = -1; j <= len && ok; j++) for (let s = -1; s <= wd && ok; s++) {
          const X = d === 0 ? x + j : x + s, Y = d === 0 ? y + s : y + j;
          const inside = j >= 0 && j < len && s >= 0 && s < wd;
          if (!inb(m, X, Y)) { if (inside) ok = false; continue; }
          if (inside && (!free(m, X, Y) || m.hgt[I(m, X, Y)] !== h0 || m.ground[I(m, X, Y)] === 9)) ok = false;
          if (!inside && m.obj[I(m, X, Y)] === 23) ok = false;
        }
        if (!ok) continue;
        for (let j = 0; j < len; j++) for (let s = 0; s < wd; s++) setO(m, d === 0 ? x + j : x + s, d === 0 ? y + s : y + j, 23);
        m.vehicles.push({ x: x, y: y, len: len, wd: wd, d: d, m: mi, o: U.rand(0, 1) });
        break;
      }
    }
  }

  /* ---------- Генераторы по типам ---------- */
  const GEN = {};
  GEN.landing = function (o) {
    const m = M(26, 16, 1);
    groundNoise(m, [[0.4, 1], [0.65, 0], [1, 2]]);
    for (let i = 0; i < 6; i++) cluster(m, U.rand(8, m.w - 2), U.rand(1, m.h - 2), U.rand(3, 6), 3);
    scatter(m, 5, 6, 6); scatter(m, 4, 3, 7); scatter(m, 7, 2, 9); lines(m, 1, 3, 7);
    decor(m, 'scorch', 6, 3); decor(m, 'crack', 14); decor(m, 'bones', 4, 8);
    m.post = function (mm) {
      const cy = mm.h >> 1;
      setO(mm, 2, cy - 5, 15);
      setO(mm, 1, cy + 5, 4); setO(mm, 2, cy + 5, 4);
    };
    m.itemList = [{ kind: 'gems', amt: U.rand(3, 5) }, { kind: 'gems', amt: U.rand(3, 5) }, { kind: 'ammo', amt: U.rand(15, 25) }];
    props(m, 'tuft', 14); props(m, 'bush', 6); props(m, 'skull', 2); props(m, 'bones', 3, 6); props(m, 'bricks', 2, 6); decor(m, 'puddle', 2, 4);
    heights(m, 0.11, 0.6, 0.8, 6); if (Math.random() < 0.6) prefab(m, 'convoy', 8);
    vehicles(m, U.rand(1, 2), 8, [0, 1, 2, 3, 4]);
    if (Math.random() < 0.7) prefab(m, U.pick(['house', 'house2']), 9, 11);
    return m;
  };
  GEN.ruins = function (o) {
    const m = M(28, 18, 0);
    groundNoise(m, [[0.42, 2], [0.62, 0], [1, 8]]);
    const ry = U.rand(3, m.h - 5);
    for (let x = 0; x < m.w; x++) { setG(m, x, ry, 3); setG(m, x, ry + 1, 3); }
    m.decor.push({ x: 0, y: ry, w: m.w, t: 'road', r: 0 });
    const rects = [];
    for (let t = 0; t < 50 && rects.length < 5; t++) {
      const w = U.rand(4, 7), h = U.rand(4, 6);
      const x = U.rand(7, m.w - w - 1), y = U.rand(1, m.h - h - 1);
      if (rects.some(function (r) { return x < r.x + r.w + 1 && x + w + 1 > r.x && y < r.y + r.h + 1 && y + h + 1 > r.y; })) continue;
      rects.push({ x: x, y: y, w: w, h: h });
      building(m, x, y, w, h, 2, Math.random() < 0.55 ? 11 : 3);
    }
    scatter(m, 7, 3, 6); scatter(m, 5, 4, 5); scatter(m, 9, 4, 5); scatter(m, 8, 4, 6); scatter(m, 4, 4, 5);
    lines(m, 1, 4, 6);
    decor(m, 'crack', 18); decor(m, 'scorch', 4, 6); decor(m, 'grass', 10);
    const d = o.diff || 1;
    m.itemList = [
      { kind: 'gems', amt: U.rand(2, 4) + d }, { kind: 'gems', amt: U.rand(2, 4) + d },
      { kind: 'materials', amt: U.rand(3, 6) }, { kind: 'materials', amt: U.rand(2, 5) },
      { kind: 'food', amt: U.rand(4, 8) }, { kind: 'ammo', amt: U.rand(15, 30) }
    ];
    props(m, 'tuft', 10); props(m, 'pipe', 5); props(m, 'sign', 3); props(m, 'bush', 4);
    props(m, 'tire', 3); props(m, 'bricks', 5); props(m, 'can', 3); props(m, 'papers', 4); props(m, 'rebar', 2); decor(m, 'puddle', 3); props(m, 'lamp', 3); props(m, 'wire', 3);
    heights(m, 0.13, 0.68, 0.9, 6); prefab(m, U.pick(['gas', 'checkpoint', 'pillbox']), 8, 3);
    vehicles(m, U.rand(1, 2), 8, [0, 0, 1, 2, 4]);
    if (Math.random() < 0.5) prefab(m, U.pick(['house', 'house2']), 8, 11);
    return m;
  };
  GEN.vein = function (o) {
    const m = M(28, 18, 1);
    groundNoise(m, [[0.45, 1], [0.7, 2], [1, 0]]);
    for (let i = 0; i < 9; i++) cluster(m, U.rand(7, m.w - 2), U.rand(1, m.h - 2), U.rand(4, 8), 3);
    for (let i = 0; i < 3; i++) pool(m, U.rand(9, m.w - 3), U.rand(2, m.h - 3), U.rand(4, 8), 7);
    scatter(m, 5, 3, 6); scatter(m, 4, 2, 6);
    decor(m, 'crystal', 22, 5); decor(m, 'crack', 10);
    const d = o.diff || 1;
    const n = U.rand(7, 9);
    for (let i = 0; i < n; i++) m.itemList.push({ kind: 'gems', amt: U.rand(2, 4) + d });
    props(m, 'shards', 14, 4); props(m, 'bush', 3); props(m, 'skull', 2, 6); props(m, 'stalag', 3, 4);
    heights(m, 0.12, 0.52, 0.74, 5);
    return m;
  };
  GEN.camp = function (o) {
    const m = M(28, 18, 0);
    groundNoise(m, [[0.5, 0], [0.75, 2], [1, 8]]);
    const cx = 19, cy = 9;
    const gaps = [U.randf(0, Math.PI * 2), U.randf(0, Math.PI * 2), Math.PI];
    for (let y = cy - 5; y <= cy + 5; y++) {
      for (let x = cx - 5; x <= cx + 5; x++) {
        const d = U.dist(x, y, cx, cy);
        if (Math.abs(d - 4.3) < 0.55) {
          const a = Math.atan2(y - cy, x - cx);
          const inGap = gaps.some(function (g) { let da = Math.abs(a - g) % (Math.PI * 2); if (da > Math.PI) da = Math.PI * 2 - da; return da < 0.42; });
          if (!inGap) setO(m, x, y, 6);
        } else if (d < 3.8) {
          setG(m, x, y, 0);
          setO(m, x, y, 0);
        }
      }
    }
    const inner = [[cx - 2, cy - 2], [cx + 2, cy - 2], [cx - 2, cy + 2], [cx + 2, cy + 2], [cx, cy - 3], [cx, cy + 3], [cx + 3, cy], [cx - 3, cy]];
    U.shuffle(inner);
    setO(m, inner[0][0], inner[0][1], 10); setO(m, inner[1][0], inner[1][1], 10); setO(m, inner[2][0], inner[2][1], 10);
    setO(m, inner[3][0], inner[3][1], 4); setO(m, inner[4][0], inner[4][1], 9); setO(m, inner[5][0], inner[5][1], 4);
    m.decor.push({ x: cx + 0.5, y: cy + 0.5, t: 'fire', r: 0.5 });
    for (let i = 0; i < 3; i++) cluster(m, U.rand(7, m.w - 2), U.rand(1, m.h - 2), U.rand(3, 5), 3);
    scatter(m, 7, 3, 7); lines(m, 1, 3, 7); scatter(m, 5, 3, 6); scatter(m, 9, 3, 8);
    decor(m, 'crack', 12); decor(m, 'scorch', 5, 10); decor(m, 'bones', 3, 8);
    m.anchor = { x: cx, y: cy };
    const d = o.diff || 1;
    m.itemList = [
      { kind: 'ammo', amt: U.rand(20, 35) }, { kind: 'ammo', amt: U.rand(15, 30) }, { kind: 'food', amt: U.rand(6, 10) },
      { kind: 'gems', amt: U.rand(3, 5) + d }, { kind: 'gems', amt: U.rand(3, 5) + d }, { kind: 'gems', amt: U.rand(2, 4) + d }
    ];
    props(m, 'tuft', 8); props(m, 'bones', 3); props(m, 'sign', 2, 8); props(m, 'pipe', 2);
    props(m, 'tire', 3); props(m, 'can', 4); props(m, 'papers', 3); props(m, 'bricks', 2); props(m, 'lamp', 2); props(m, 'wire', 3);
    heights(m, 0.12, 0.66, 0.9, 6); raise(m, 15, 5, 23, 13, 1); if (Math.random() < 0.6) prefab(m, 'outpost', 7);
    vehicles(m, 1, 6, [3, 5]);
    if (Math.random() < 0.5) prefab(m, 'barracks', 6, 11);
    return m;
  };
  GEN.lair = function (o) {
    const m = M(28, 18, 5);
    cellular(m, 0.44, 4, 3);
    groundNoise(m, [[0.55, 5], [0.8, 1], [1, 6]]);
    // освободить место для логова
    for (let y = 6; y <= 11; y++) for (let x = 20; x <= 24; x++) { if (U.dist(x, y, 22, 8.5) < 2.6) setO(m, x, y, 0); }
    m.anchor = { x: 22, y: 9 };
    scatter(m, 16, 8, 6);
    decor(m, 'bones', 18, 5); decor(m, 'blood', 6, 8);
    const d = o.diff || 1;
    for (let i = 0; i < 5; i++) m.itemList.push({ kind: 'gems', amt: U.rand(3, 5) + d });
    props(m, 'bones', 10); props(m, 'skull', 6, 5); props(m, 'shroom', 9, 4);
    return m;
  };
  GEN.vault = function (o) {
    const m = M(28, 18, 4);
    for (let y = 0; y < m.h; y++) for (let x = 0; x < 6; x++) setG(m, x, y, U.chance(0.3) ? 2 : 0);
    const vx = [6, 13, 20], hy = [6, 12];
    vx.forEach(function (x) { for (let y = 0; y < m.h; y++) setO(m, x, y, 11); });
    hy.forEach(function (y) { for (let x = 6; x < m.w; x++) setO(m, x, y, 11); });
    // проходы
    const cy = m.h >> 1;
    setO(m, 6, cy - 1, 0); setO(m, 6, cy, 0); setO(m, 6, cy + 1, 0);
    [[0, 5], [7, 11], [13, 17]].forEach(function (seg) {
      [13, 20].forEach(function (x) {
        const y = U.rand(seg[0], seg[1]);
        if (y !== 6 && y !== 12) { setO(m, x, y, 0); if (Math.random() < 0.5 && y + 1 <= seg[1] && y + 1 !== 6 && y + 1 !== 12) setO(m, x, y + 1, 0); }
      });
    });
    [[7, 12], [14, 19], [21, 27]].forEach(function (seg) {
      hy.forEach(function (y) {
        const x = U.rand(seg[0], seg[1]);
        if (vx.indexOf(x) < 0) setO(m, x, y, 0);
      });
    });
    for (let i = 0; i < m.obj.length; i++) {
      if (m.obj[i] === 11 && Math.random() < 0.06) { m.obj[i] = 0; m.objHp[i] = 0; m.ground[i] = 8; }
    }
    scatter(m, 12, 8, 7); scatter(m, 4, 5, 7); scatter(m, 3, 3, 0, 4);
    decor(m, 'crack', 8); decor(m, 'scorch', 3, 7);
    const d = o.diff || 3;
    m.itemList = [
      { kind: 'gems', amt: U.rand(6, 10) + d }, { kind: 'gems', amt: U.rand(6, 10) + d }, { kind: 'gems', amt: U.rand(6, 10) + d },
      { kind: 'gems', amt: U.rand(5, 8) + d }, { kind: 'meds', amt: 2 }, { kind: 'materials', amt: U.rand(4, 7) }, { kind: 'materials', amt: U.rand(4, 7) }
    ];
    props(m, 'pipe', 7, 7); props(m, 'bones', 2, 7); props(m, 'tuft', 5, 0); props(m, 'papers', 4, 5); props(m, 'rebar', 2, 5); props(m, 'can', 2, 5); props(m, 'lamp', 3, 4); props(m, 'wire', 3, 4);
    return m;
  };
  GEN.site = function (o) {
    const m = M(28, 18, 0);
    groundNoise(m, [[0.45, 2], [0.7, 0], [1, 8]]);
    const x0 = 15, y0 = 4, w = 9, h = 10;
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        setG(m, x, y, 3);
        const edge = x === x0 || y === y0 || x === x0 + w - 1 || y === y0 + h - 1;
        setO(m, x, y, edge ? 14 : 0);
      }
    }
    const cy = y0 + (h >> 1);
    setO(m, x0, cy - 1, 0); setO(m, x0, cy, 0);
    setO(m, x0 + w - 1, cy, 0); setO(m, x0 + 4, y0, 0); setO(m, x0 + 4, y0 + h - 1, 0);
    setO(m, x0, cy - 3, 1); setO(m, x0, cy + 2, 1); setO(m, x0 + 2, y0, 1); setO(m, x0 + 6, y0 + h - 1, 1);
    setG(m, x0 + 1, y0 + 1, 9); setG(m, x0 + w - 2, y0 + h - 2, 9);
    setO(m, x0 + 3, cy + 2, 4); setO(m, x0 + 6, cy - 2, 4); setO(m, x0 + 5, cy + 1, 4);
    // брошенная обстановка: шкаф, нары, стол у стен
    setO(m, x0 + 1, y0 + 2, 22); setO(m, x0 + w - 2, y0 + 2, 21); setO(m, x0 + 1, y0 + h - 3, 21); setO(m, x0 + w - 2, y0 + h - 3, 22);
    scatter(m, 8, 5, 5, 13); lines(m, 1, 3, 6); scatter(m, 5, 4, 5, 13); scatter(m, 7, 2, 6, 13);
    decor(m, 'crack', 14); decor(m, 'grass', 8);
    m.anchor = { x: x0 + 4, y: cy };
    const d = o.diff || 1;
    m.itemList = [
      { kind: 'materials', amt: U.rand(5, 8) }, { kind: 'materials', amt: U.rand(4, 7) }, { kind: 'food', amt: U.rand(5, 8) },
      { kind: 'gems', amt: U.rand(3, 5) + d }, { kind: 'gems', amt: U.rand(3, 5) + d }
    ];
    props(m, 'tuft', 12); props(m, 'bush', 5); props(m, 'sign', 2); props(m, 'bricks', 3); props(m, 'tire', 2); props(m, 'can', 2);
    heights(m, 0.12, 0.62, 0.9, 6); raise(m, 14, 3, 24, 14, 1); raise(m, 16, 5, 16, 5, 2); raise(m, 22, 12, 22, 12, 2);
    return m;
  };
  GEN.nest = function (o) {
    const m = M(30, 20, 6);
    cellular(m, 0.36, 3, 3);
    groundNoise(m, [[0.45, 6], [0.75, 5], [1, 6]]);
    for (let i = 0; i < 4; i++) pool(m, U.rand(8, m.w - 4), U.rand(2, m.h - 3), U.rand(4, 7), 7);
    const ax = m.w - 5, ay = m.h >> 1;
    for (let y = ay - 3; y <= ay + 3; y++) for (let x = ax - 3; x <= ax + 3; x++) {
      if (U.dist(x, y, ax, ay) < 3.2) { setO(m, x, y, 0); setG(m, x, y, 6); }
    }
    scatter(m, 16, 14, 6);
    decor(m, 'bones', 22, 5); decor(m, 'blood', 10, 6); decor(m, 'veins', 16, 4);
    m.anchor = { x: ax, y: ay };
    for (let i = 0; i < 6; i++) m.itemList.push({ kind: 'gems', amt: U.rand(5, 8) + 4 });
    props(m, 'shroom', 12, 4); props(m, 'bones', 8); props(m, 'skull', 5);
    heights(m, 0.14, 0.58, 0.8, 5);
    return m;
  };
  GEN.defense = function (o) {
    const m = M(30, 20, 0);
    m.kind = 'defense';
    groundNoise(m, [[0.5, 0], [0.75, 2], [1, 1]]);
    const b = o.buildings || {};
    const x0 = 3, y0 = 4, x1 = 17, y1 = 15;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { setG(m, x, y, (x + y) % 7 === 0 ? 8 : 0); setO(m, x, y, 0); }
    const wl = b.walls || 0;
    const wallObj = wl >= 2 ? 14 : (wl === 1 ? 13 : 0);
    const raid = o.raid || {}, dir = raid.dir || 'e', prep = o.prep || {};
    m.wallTiles = [];
    const gates = {};
    [[x1, 9], [x1, 10], [10, y0], [11, y0], [10, y1], [11, y1], [x0, 9], [x0, 10]].forEach(function (g) { gates[g[0] + ',' + g[1]] = 1; });
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const edge = x === x0 || y === y0 || x === x1 || y === y1;
        if (!edge) continue;
        // ворота при набеге закрыты: та же стена, ломать придётся
        if (wallObj) { if (!gates[x + ',' + y]) setO(m, x, y, wallObj); m.wallTiles.push([x, y, wallObj, gates[x + ',' + y] ? 1 : 0]); }
        else if (!gates[x + ',' + y] && Math.random() < 0.3) setO(m, x, y, U.pick([4, 6, 6]));
      }
    }
    // штаб
    setO(m, 4, 9, 17); setO(m, 5, 9, 17); setO(m, 4, 10, 17); setO(m, 5, 10, 17);
    const slots = [[6, 5], [10, 5], [14, 5], [6, 13], [10, 13], [14, 13]];
    let si = 0;
    ['infirmary', 'workshop', 'farm', 'beacon'].forEach(function (k) {
      if (!b[k] || si >= slots.length) return;
      const s = slots[si++];
      setO(m, s[0], s[1], 17); setO(m, s[0] + 1, s[1], 17); setO(m, s[0], s[1] + 1, 17); setO(m, s[0] + 1, s[1] + 1, 17);
    });
    if (b.tower) { setG(m, x1 - 2, y0 + 2, 9); setG(m, x1 - 2, y1 - 2, 9); setO(m, x1 - 2, y0 + 2, 0); setO(m, x1 - 2, y1 - 2, 0); }
    [[9, 8], [12, 11], [8, 11], [13, 8]].forEach(function (c) { if (Math.random() < 0.75) setO(m, c[0], c[1], U.pick([4, 6])); });
    for (let i = 0; i < 5; i++) cluster(m, U.rand(20, m.w - 2), U.rand(1, m.h - 2), U.rand(3, 5), 3);
    scatter(m, 5, 5, 19); scatter(m, 7, 3, 20); lines(m, 1, 3, 20); scatter(m, 3, 3, 0, 2);
    decor(m, 'crack', 14); decor(m, 'grass', 8);
    m.center = [10, 9];
    const dep = [];
    for (let y = 7; y <= 12; y++) for (let x = 7; x <= 14; x++) if (free(m, x, y)) dep.push([x, y]);
    dep.sort(function (a, c) { return ((a[0] + a[1]) % 2) - ((c[0] + c[1]) % 2) || U.dist(a[0], a[1], 11, 9.5) - U.dist(c[0], c[1], 11, 9.5); });
    m.deploy = dep;
    m.evac = [];
    const tur = [];
    for (let i = 0; i < (b.turret || 0); i++) {
      const t = i === 0 ? [x1 - 1, 8] : [x1 - 1, 11];
      setO(m, t[0], t[1], 0);
      tur.push(t);
    }
    m.turrets = tur;
    // откуда удар: восток — правый край, север/юг — верхний/нижний край за стенами
    if (dir === 'n') for (let x = 6; x < m.w; x++) { m.spawn.push([x, 0]); m.spawn.push([x, 1]); }
    else if (dir === 's') for (let x = 6; x < m.w; x++) { m.spawn.push([x, m.h - 1]); m.spawn.push([x, m.h - 2]); }
    else for (let y = 0; y < m.h; y++) { m.spawn.push([m.w - 1, y]); m.spawn.push([m.w - 2, y]); }
    m.dir = dir;
    // подготовка: мешки у стены со стороны удара, колючка и мины снаружи, посты у стены
    const inner = [], wireT = [], mineT = [];
    if (dir === 'e') { for (let y = y0 + 1; y < y1; y++) { inner.push([x1 - 1, y]); wireT.push([x1 + 2, y]); for (let x = x1 + 4; x <= x1 + 8; x++) mineT.push([x, y]); } }
    else if (dir === 'n') { for (let x = x0 + 1; x < x1; x++) { inner.push([x, y0 + 1]); if (y0 - 2 >= 0) wireT.push([x, y0 - 2]); mineT.push([x, 0]); mineT.push([x, 1]); } }
    else { for (let x = x0 + 1; x < x1; x++) { inner.push([x, y1 - 1]); if (y1 + 2 < m.h) wireT.push([x, y1 + 2]); mineT.push([x, m.h - 2]); mineT.push([x, m.h - 3]); } }
    m.posts = inner.filter(function (p) { return free(m, p[0], p[1]); });
    U.shuffle(inner);
    let nb = prep.bags || 0;
    for (let k = 0; k < inner.length && nb > 0; k++) { const p = inner[k]; if (free(m, p[0], p[1]) && (p[0] + p[1]) % 2) { setO(m, p[0], p[1], 6); nb--; } }
    m.posts = m.posts.filter(function (p) { return free(m, p[0], p[1]); });
    m.wire = []; U.shuffle(wireT);
    for (let k = 0, n = (prep.wire || 0) * 2; k < wireT.length && n > 0; k++) { const p = wireT[k]; if (free(m, p[0], p[1])) { m.wire.push(p); m.props.push({ x: p[0] + 0.5, y: p[1] + 0.5, t: 'wire' }); n--; } }
    m.mines = []; U.shuffle(mineT);
    for (let k = 0, n = prep.mines || 0; k < mineT.length && n > 0; k++) { const p = mineT[k]; if (free(m, p[0], p[1])) { m.mines.push(p); n--; } }
    props(m, 'tuft', 10); props(m, 'bush', 4, 18); props(m, 'sign', 2, 18); props(m, 'can', 3); props(m, 'tire', 2); props(m, 'bricks', 3); props(m, 'lamp', 3); props(m, 'wire', 3);
    raise(m, 3, 4, 17, 15, 1);
    return m;
  };

  GEN.factory = function (o) {
    const m = M(28, 18, 3);
    groundNoise(m, [[0.45, 3], [0.7, 8], [1, 4]]);
    const x0 = 8, y0 = 2, w = 16, h = 13;
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      setG(m, x, y, 4);
      const edge = x === x0 || y === y0 || x === x0 + w - 1 || y === y0 + h - 1;
      setO(m, x, y, edge ? 11 : 0);
    }
    [[x0, y0 + 5], [x0, y0 + 6], [x0, y0 + 7], [x0 + 6, y0], [x0 + 7, y0], [x0 + 6, y0 + h - 1], [x0 + 7, y0 + h - 1], [x0 + w - 1, y0 + 4], [x0 + w - 1, y0 + 9]].forEach(function (g) { setO(m, g[0], g[1], 0); });
    for (let i = 0; i < m.obj.length; i++) if (m.obj[i] === 11 && Math.random() < 0.08) { m.obj[i] = 0; m.objHp[i] = 0; m.ground[i] = 8; }
    for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) if (Math.random() < 0.75) setO(m, x0 + 3 + k * 3, y0 + 3 + r * 3, U.pick([12, 12, 18, 4]));
    raise(m, x0 + 1, y0 + 1, x0 + w - 2, y0 + 1, 1); raise(m, x0 + 1, y0 + h - 2, x0 + w - 2, y0 + h - 2, 1);
    scatter(m, 18, 4, 6, x0 - 1); scatter(m, 9, 4, 5); scatter(m, 4, 4, 5); lines(m, 1, 2, 5);
    prefab(m, 'depot', 18);
    vehicles(m, U.rand(1, 2), 6, [5, 5, 6, 3]);
    if (Math.random() < 0.6) prefab(m, 'barracks', 7, 3);
    props(m, 'pipe', 9, 5); props(m, 'sign', 3, 5); props(m, 'tuft', 6, 0); props(m, 'tire', 3); props(m, 'can', 4); props(m, 'rebar', 4); props(m, 'papers', 3); decor(m, 'puddle', 4); props(m, 'lamp', 4); props(m, 'wire', 3);
    decor(m, 'crack', 12); decor(m, 'scorch', 4, 8);
    const d = o.diff || 1;
    m.itemList = [{ kind: 'materials', amt: U.rand(5, 9) }, { kind: 'materials', amt: U.rand(5, 9) }, { kind: 'ammo', amt: U.rand(20, 35) }, { kind: 'gems', amt: U.rand(3, 5) + d }, { kind: 'gems', amt: U.rand(3, 5) + d }, { kind: 'meds', amt: 1 }];
    return m;
  };
  GEN.forest = function (o) {
    const m = M(28, 18, 1);
    groundNoise(m, [[0.42, 1], [0.7, 2], [1, 0]]);
    heights(m, 0.1, 0.55, 0.78, 5);
    scatter(m, 5, 34, 5); scatter(m, 19, 9, 5); for (let i = 0; i < 4; i++) cluster(m, U.rand(7, m.w - 2), U.rand(1, m.h - 2), U.rand(2, 4), 3);
    props(m, 'bush', 16); props(m, 'tuft', 14); props(m, 'bones', 4, 6); props(m, 'skull', 2, 8); props(m, 'stump', 6); decor(m, 'puddle', 3);
    decor(m, 'grass', 16); decor(m, 'crack', 6);
    const d = o.diff || 1;
    m.itemList = [{ kind: 'food', amt: U.rand(6, 10) }, { kind: 'materials', amt: U.rand(4, 7) }, { kind: 'gems', amt: U.rand(3, 5) + d }, { kind: 'gems', amt: U.rand(3, 5) + d }, { kind: 'ammo', amt: U.rand(10, 20) }];
    return m;
  };
  GEN.crystalcave = function (o) {
    const m = M(28, 18, 5);
    cellular(m, 0.42, 4, 3);
    groundNoise(m, [[0.55, 5], [0.85, 1], [1, 5]]);
    heights(m, 0.13, 0.6, 0.85, 6);
    scatter(m, 20, 12, 5);
    props(m, 'shards', 16, 4); props(m, 'bones', 4, 5); props(m, 'shroom', 4, 5); props(m, 'stalag', 8, 3);
    decor(m, 'crystal', 30, 4);
    const d = o.diff || 1;
    const n = U.rand(8, 10);
    for (let i = 0; i < n; i++) m.itemList.push({ kind: 'gems', amt: U.rand(3, 5) + d });
    return m;
  };
  GEN.swamp = function (o) {
    const m = M(28, 18, 6);
    groundNoise(m, [[0.42, 6], [0.62, 1], [1, 2]]);
    for (let i = 0; i < 11; i++) pool(m, U.rand(6, m.w - 2), U.rand(1, m.h - 2), U.rand(5, 11), 7);
    scatter(m, 5, 10, 5); scatter(m, 16, 6, 6); scatter(m, 19, 4, 5); for (let i = 0; i < 3; i++) cluster(m, U.rand(8, m.w - 2), U.rand(1, m.h - 2), U.rand(2, 4), 3);
    props(m, 'reeds', 22, 3); props(m, 'bones', 6, 5); props(m, 'shroom', 5, 5); props(m, 'stump', 4); decor(m, 'puddle', 6);
    decor(m, 'blood', 4, 8); decor(m, 'veins', 6, 6);
    m.anchor = { x: 22, y: 9 };
    const d = o.diff || 1;
    for (let i = 0; i < 5; i++) m.itemList.push({ kind: 'gems', amt: U.rand(3, 5) + d });
    return m;
  };

  /* ---------- Сложные карты: панельный квартал, ТЭЦ, товарная станция, карьер, мост через овраг ----------
     Многокомнатные дома (двери между комнатами), галереи и платформы на уровень выше, высокие крыши с лестницами,
     техника и вагоны-контейнеры на заданных местах, рельсы, овраг с переправами. Крыши и техника ставятся в m.late —
     после сглаживания высот, когда список лестниц уже пуст. */
  function box(m, x0, y0, x1, y1, fn) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inb(m, x, y)) fn(x, y, I(m, x, y)); }
  const SOFT = { 4: 1, 6: 1, 7: 1, 8: 1, 9: 1, 12: 1, 18: 1, 21: 1, 22: 1 };
  /* в доме все свободные клетки достижимы от наружных дверей: мешающую мебель убрать */
  function unblock(m, x0, y0, x1, y1) {
    for (let guard = 0; guard < 40; guard++) {
      const seen = {}, q = [];
      box(m, x0, y0, x1, y1, function (x, y, i) { if ((x === x0 || y === y0 || x === x1 || y === y1) && free(m, x, y)) { seen[i] = 1; q.push(i); } });
      for (let k = 0; k < q.length; k++) {
        const c = q[k], cx = c % m.w, cy = (c / m.w) | 0;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
          const nx = cx + d[0], ny = cy + d[1];
          if (nx < x0 || ny < y0 || nx > x1 || ny > y1 || !free(m, nx, ny)) return;
          const j = I(m, nx, ny); if (!seen[j]) { seen[j] = 1; q.push(j); }
        });
      }
      let lost = false, fixed = false;
      box(m, x0 + 1, y0 + 1, x1 - 1, y1 - 1, function (x, y, i) {
        if (fixed || !free(m, x, y) || seen[i]) return;
        lost = true;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { if (!fixed && inb(m, x + d[0], y + d[1]) && SOFT[m.obj[I(m, x + d[0], y + d[1])]]) { setO(m, x + d[0], y + d[1], 0); fixed = true; } });
      });
      if (!lost || !fixed) return;
    }
  }
  /* Дом из нескольких комнат: внешние стены, перегородки, двери между соседними комнатами (все связаны), наружные
     двери (o.doors — стороны 'n','s','w','e', можно повторять), окна, мебель у стен. cw / rh — внутренние размеры. */
  function roomGrid(m, x0, y0, cw, rh, o) {
    o = o || {};
    const wallObj = o.wall || 2, floorG = o.floor === undefined ? 11 : o.floor;
    const xs = [x0]; cw.forEach(function (c) { xs.push(xs[xs.length - 1] + c + 1); });
    const ys = [y0]; rh.forEach(function (r) { ys.push(ys[ys.length - 1] + r + 1); });
    const x1 = xs[xs.length - 1], y1 = ys[ys.length - 1];
    (m.rooms = m.rooms || []).push([x0, y0, x1, y1]);
    box(m, x0, y0, x1, y1, function (x, y, i) { m.ground[i] = floorG; m.obj[i] = 0; m.objHp[i] = 0; });
    xs.forEach(function (x) { for (let y = y0; y <= y1; y++) setO(m, x, y, wallObj); });
    ys.forEach(function (y) { for (let x = x0; x <= x1; x++) setO(m, x, y, wallObj); });
    const doors = [], wins = [];
    for (let k = 1; k < xs.length - 1; k++) for (let j = 0; j < rh.length; j++) { const y = U.rand(ys[j] + 1, ys[j + 1] - 1); setO(m, xs[k], y, 0); doors.push([xs[k], y]); }
    for (let k = 1; k < ys.length - 1; k++) for (let j = 0; j < cw.length; j++) { const x = U.rand(xs[j] + 1, xs[j + 1] - 1); setO(m, x, ys[k], 0); doors.push([x, ys[k]]); }
    const outer = [];
    (o.doors || ['s']).forEach(function (sd) {
      const cand = [];
      if (sd === 'n' || sd === 's') { const y = sd === 'n' ? y0 : y1, oy = sd === 'n' ? y0 - 1 : y1 + 1; for (let x = x0 + 1; x < x1; x++) if (xs.indexOf(x) < 0) cand.push([x, y, x, oy]); }
      else { const x = sd === 'w' ? x0 : x1, ox = sd === 'w' ? x0 - 1 : x1 + 1; for (let y = y0 + 1; y < y1; y++) if (ys.indexOf(y) < 0) cand.push([x, y, ox, y]); }
      const ok = cand.filter(function (c) { return inb(m, c[2], c[3]) && !outer.some(function (d) { return Math.abs(d[0] - c[0]) + Math.abs(d[1] - c[1]) < 3; }); });
      if (!ok.length) return;
      const c = U.pick(ok);
      setO(m, c[0], c[1], 0); doors.push([c[0], c[1]]); outer.push([c[0], c[1], c[2], c[3]]);
      if (m.obj[I(m, c[2], c[3])] !== 23) setO(m, c[2], c[3], 0);
      if (!walkG(m, c[2], c[3])) setG(m, c[2], c[3], 8);
    });
    const per = [];
    for (let x = x0 + 1; x < x1; x++) if (xs.indexOf(x) < 0) { per.push([x, y0]); per.push([x, y1]); }
    for (let y = y0 + 1; y < y1; y++) if (ys.indexOf(y) < 0) { per.push([x0, y]); per.push([x1, y]); }
    U.shuffle(per);
    let nw = o.windows === undefined ? Math.max(2, cw.length * rh.length) : o.windows;
    for (let k = 0; k < per.length && nw > 0; k++) {
      const p = per[k];
      if (doors.concat(wins).some(function (d) { return Math.abs(d[0] - p[0]) + Math.abs(d[1] - p[1]) < 2; })) continue;
      setO(m, p[0], p[1], 1); wins.push(p); nw--;
    }
    // обстановка: у стен, не у дверей; в углах — шкафы
    for (let j = 0; j < rh.length; j++) for (let k = 0; k < cw.length; k++) {
      const rx0 = xs[k] + 1, rx1 = xs[k + 1] - 1, ry0 = ys[j] + 1, ry1 = ys[j + 1] - 1;
      const tiles = [];
      box(m, rx0, ry0, rx1, ry1, function (x, y) { tiles.push([x, y]); });
      U.shuffle(tiles);
      let n = Math.max(1, Math.round(tiles.length * (o.furn === undefined ? 0.3 : o.furn)));
      tiles.forEach(function (t) {
        const x = t[0], y = t[1];
        if (n <= 0 || !(x === rx0 || x === rx1 || y === ry0 || y === ry1)) return;
        if (doors.some(function (d) { return Math.abs(d[0] - x) <= 1 && Math.abs(d[1] - y) <= 1; })) return;
        const corner = (x === rx0 || x === rx1) && (y === ry0 || y === ry1);
        setO(m, x, y, o.items ? U.pick(o.items) : (corner && Math.random() < 0.45 ? 22 : 21)); n--;
      });
    }
    unblock(m, x0, y0, x1, y1);
    return { x0: x0, y0: y0, x1: x1, y1: y1, doors: doors, outer: outer };
  }
  /* Высокий глухой дом: крыша на up уровней выше земли, мешки на западном краю, приставная лестница с востока
     или юга (видна камере). Вокруг — ровная полоса на высоте основания. Только в m.late. */
  function roofBlock(m, x0, y0, w, h, up, east) {
    const base = m.hgt[I(m, x0, y0)];
    box(m, x0 - 1, y0 - 1, x0 + w, y0 + h, function (x, y, i) { if (m.obj[i] === 23) return; m.hgt[i] = base; m.obj[i] = 0; m.objHp[i] = 0; if (!walkG(m, x, y)) m.ground[i] = 8; });
    box(m, x0, y0, x0 + w - 1, y0 + h - 1, function (x, y, i) { m.hgt[i] = base + up; m.ground[i] = 12; });
    const lx = east ? x0 + w : x0 + U.rand(0, w - 1), ly = east ? y0 + U.rand(0, h - 1) : y0 + h;
    const rx = east ? lx - 1 : lx, ry = east ? ly : ly - 1;
    const sb = U.shuffle([0, 1, 2, 3].slice(0, h)).slice(0, Math.min(2, h));
    sb.forEach(function (k) { if (!(rx === x0 && ry === y0 + k)) setO(m, x0, y0 + k, 6); });
    if (w >= 3) setO(m, x0 + 1 + U.rand(0, w - 3), y0, 6);
    m.ladders.push({ x: lx, y: ly, rx: rx, ry: ry, d: east ? 0 : 1 });
  }
  /* машина / вагон на заданном месте: все клетки свободны и на одной высоте */
  function vehicleAt(m, x, y, d, mi) {
    const len = D.VEHICLES[mi][1], wd = D.VEHICLES[mi][2] || 1;
    if (!inb(m, x, y)) return false;
    const h0 = m.hgt[I(m, x, y)];
    for (let j = 0; j < len; j++) for (let s = 0; s < wd; s++) {
      const X = d === 0 ? x + j : x + s, Y = d === 0 ? y + s : y + j;
      if (!free(m, X, Y) || m.hgt[I(m, X, Y)] !== h0 || m.ground[I(m, X, Y)] === 9) return false;
    }
    for (let j = 0; j < len; j++) for (let s = 0; s < wd; s++) setO(m, d === 0 ? x + j : x + s, d === 0 ? y + s : y + j, 23);
    (m.vehicles = m.vehicles || []).push({ x: x, y: y, len: len, wd: wd, d: d, m: mi, o: U.rand(0, 1) });
    return true;
  }
  function vehicleTry(m, d, mi, x0, x1, y0, y1, tries) {
    for (let t = 0; t < (tries || 25); t++) if (vehicleAt(m, U.rand(x0, x1), U.rand(y0, y1), d, mi)) return true;
    return false;
  }
  function scatterIn(m, obj, n, x0, y0, x1, y1) { for (let k = 0; k < n; k++) for (let t = 0; t < 30; t++) { const x = U.rand(x0, x1), y = U.rand(y0, y1); if (free(m, x, y)) { setO(m, x, y, obj); break; } } }
  function lamp(m, x, y) { if (free(m, x, y)) m.props.push({ x: x + 0.5, y: y + 0.5, t: 'lamp' }); }
  const CONTAINER = 7;   // индекс D.VEHICLES: морской контейнер 5×2

  /* Панельный квартал: перекрёсток, гаражи, панельный дом из шести квартир, ларёк, высокий дом с крышей (снайпер),
     двор на возвышении, баррикада и разбитые машины на дорогах */
  GEN.district = function (o) {
    const m = M(30, 20, 3);
    groundNoise(m, [[0.3, 8], [0.62, 3], [0.82, 0], [1, 2]]);
    const cy = m.h >> 1;
    box(m, 0, cy - 1, m.w - 1, cy, function (x, y, i) { m.ground[i] = 3; });
    box(m, 15, 0, 16, m.h - 1, function (x, y, i) { m.ground[i] = 3; });
    m.decor.push({ x: 0, y: cy - 1, w: m.w, t: 'road', r: 0 });
    m.decor.push({ x: 15, y: 0, w: m.h, t: 'road', r: 0, v: 1 });
    scatter(m, 8, 4, 6); scatter(m, 4, 3, 6); scatter(m, 9, 2, 8);
    box(m, 0, cy - 1, m.w - 1, cy, function (x, y, i) { m.obj[i] = 0; m.objHp[i] = 0; });
    // гаражи: три бокса, ворота на улицу
    const gx = 5, gy = 2;
    box(m, gx, gy, gx + 9, gy + 4, function (x, y, i) { m.ground[i] = 3; m.obj[i] = 0; m.objHp[i] = 0; });
    for (let k = 0; k < 3; k++) (m.rooms = m.rooms || []).push([gx + k * 3, gy, gx + k * 3 + 3, gy + 4]);
    for (let x = gx; x <= gx + 9; x++) setO(m, x, gy, 2);
    for (let k = 0; k <= 3; k++) for (let y = gy; y <= gy + 4; y++) setO(m, gx + k * 3, y, 2);
    for (let k = 0; k < 3; k++) { const x = gx + k * 3 + 1 + U.rand(0, 1); setO(m, x, gy + 1, U.pick([7, 9, 4, 12])); if (Math.random() < 0.5) setO(m, gx + k * 3 + 1 + U.rand(0, 1), gy + 2, U.pick([4, 9])); }
    // панельный дом: 3×2 квартиры, подъезды на улицу и к перекрёстку
    const apt = roomGrid(m, 18, 1, [3, 2, 3], [3, 2], { wall: 2, floor: 11, doors: ['s', 's', 'w'] });
    // ларёк у высокого дома
    roomGrid(m, 18, 13, [2], [2], { wall: 2, floor: 11, doors: ['w'], windows: 1, items: [4, 21] });
    // двор на возвышении: деревья, клумбы, мусорные баки, баррикада из мешков
    box(m, 6, 13, 13, 18, function (x, y, i) { m.hgt[i] = 1; if (m.ground[i] === 3) m.ground[i] = U.pick([0, 2, 2]); });
    scatterIn(m, 5, 4, 7, 13, 12, 18); scatterIn(m, 18, 2, 6, 13, 13, 18); scatterIn(m, 6, 2, 7, 13, 13, 14);
    for (let k = 0; k < 2; k++) { const x = U.rand(7, 10), y = U.rand(15, 17); if (free(m, x, y) && free(m, x + 1, y)) { setO(m, x, y, 1); setO(m, x + 1, y, 1); } }
    for (let k = 0; k < 4; k++) m.props.push({ x: U.randf(7, 13), y: U.randf(13.5, 18.5), t: U.pick(['tire', 'bush', 'tuft', 'sign']) });
    // баррикада на улице: ряды мешков вразбежку, проход змейкой
    setO(m, 24, cy - 1, 6); setO(m, 25, cy - 1, 6); setO(m, 26, cy, 6); setO(m, 27, cy, 6); setO(m, 22, cy + 1, 6);
    [[6, cy - 2], [12, cy - 2], [19, cy + 1], [27, cy - 2], [14, 3], [17, 15], [14, 17]].forEach(function (p) { lamp(m, p[0], p[1]); });
    m.anchor = { x: Math.round((apt.x0 + apt.x1) / 2), y: Math.round((apt.y0 + apt.y1) / 2) };
    m.late = function (mm) {
      roofBlock(mm, 23, 13, 5, 4, 3, Math.random() < 0.5);
      vehicleTry(mm, 0, 4, 7, 11, cy - 1, cy - 1);                  // автобус поперёк улицы
      vehicleTry(mm, 1, U.rand(0, 3), 15, 16, 1, 4);                 // машина на поперечной улице
      vehicleTry(mm, 1, U.rand(0, 3), 15, 16, 13, 16);
      vehicleTry(mm, 0, U.rand(0, 2), 18, 26, cy, cy);
    };
    decor(m, 'crack', 16); decor(m, 'puddle', 4, 6); decor(m, 'scorch', 3, 8); decor(m, 'grass', 6, 6);
    props(m, 'tuft', 10); props(m, 'papers', 6, 5); props(m, 'can', 4); props(m, 'tire', 3, 5); props(m, 'bricks', 4); props(m, 'wire', 3); props(m, 'sign', 2, 6); props(m, 'rebar', 3);
    const d = o.diff || 1;
    m.itemList = [{ kind: 'materials', amt: U.rand(4, 7) }, { kind: 'materials', amt: U.rand(3, 6) }, { kind: 'food', amt: U.rand(5, 9) },
      { kind: 'ammo', amt: U.rand(15, 30) }, { kind: 'meds', amt: 1 }, { kind: 'gems', amt: U.rand(3, 5) + d }, { kind: 'gems', amt: U.rand(2, 4) + d }];
    return m;
  };

  /* Мёртвая ТЭЦ: машинный зал с турбинами и галереей на уровень выше, пультовая, разрушенная градирня, отвалы
     золы, трансформаторный двор за оградой, трубопровод */
  GEN.powerplant = function (o) {
    const m = M(30, 20, 3);
    groundNoise(m, [[0.35, 8], [0.62, 3], [0.82, 1], [1, 0]]);
    const hx0 = 12, hy0 = 1, hx1 = 27, hy1 = 11;
    box(m, hx0, hy0, hx1, hy1, function (x, y, i) { m.ground[i] = 3; m.obj[i] = 0; m.objHp[i] = 0; });
    for (let x = hx0; x <= hx1; x++) { setO(m, x, hy0, 2); setO(m, x, hy1, 2); }
    for (let y = hy0; y <= hy1; y++) { setO(m, hx0, y, 2); setO(m, hx1, y, 2); }
    (m.rooms = m.rooms || []).push([hx0, hy0, hx1, hy1]);
    // галерея вдоль северной стены (на уровень выше), ящики у края
    box(m, hx0 + 1, hy0 + 1, hx1 - 1, hy0 + 2, function (x, y, i) { m.hgt[i] = 1; m.ground[i] = 4; });
    for (let k = 0; k < 3; k++) setO(m, U.rand(hx0 + 2, hx1 - 2), hy0 + 2, U.pick([4, 4, 9]));
    // ворота с запада, двери с юга и востока
    setO(m, hx0, 5, 0); setO(m, hx0, 6, 0); setO(m, 16, hy1, 0); setO(m, 21, hy1, 0); setO(m, hx1, 4, 0);
    // турбины и насосы
    [[15, 5], [20, 5]].forEach(function (t) { box(m, t[0], t[1], t[0] + 2, t[1] + 1, function (x, y) { setO(m, x, y, 12); }); });
    setO(m, 18, 8, 12); setO(m, 14, 9, 4); setO(m, 19, 9, 1); setO(m, 19, 8, 1);
    // пультовая в углу зала: металлические переборки
    roomGrid(m, 23, 7, [3], [3], { wall: 11, floor: 4, doors: ['w'], windows: 1, items: [21, 21, 22, 12] });
    // градирня: скруглённое кольцо стен с двумя проломами, внутри зола и лужа кислоты
    const tx = 5, ty = 13;
    const ring = ['.#####.', '##...##', '#.....#', '#.....#', '#.....#', '##...##', '.#####.'];
    for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
      const X = tx + x, Y = ty + y; if (!inb(m, X, Y)) continue;
      if (ring[y][x] === '#') setO(m, X, Y, 14); else if (ring[y][x] === '.' && (x > 0 && x < 6 && y > 0 && y < 6)) { setO(m, X, Y, 0); setG(m, X, Y, 1); }
    }
    setO(m, tx + 6, ty + 3, 0); setO(m, tx + 3, ty, 0); setG(m, tx + 3, ty + 3, 7); setO(m, tx + 2, ty + 4, 8);
    // отвалы золы на северо-западе: холм в два уровня
    box(m, 5, 0, 11, 5, function (x, y, i) { const dd = U.dist(x, y, 8, 1.5); m.ground[i] = 1; m.hgt[i] = dd < 1.7 ? 2 : (dd < 3.4 ? 1 : 0); m.obj[i] = 0; m.objHp[i] = 0; });
    // трансформаторный двор: низкая ограда с проходами, трансформаторы рядами
    const yx0 = 17, yy0 = 13, yx1 = 28, yy1 = 19;
    for (let x = yx0; x <= yx1; x++) if (x !== 20 && x !== 25) setO(m, x, yy0, 1);
    for (let y = yy0; y <= yy1; y++) if (y !== 16) setO(m, yx0, y, 1);
    for (let r = 0; r < 2; r++) for (let k = 0; k < 3; k++) if (Math.random() < 0.85) setO(m, yx0 + 3 + k * 3, yy0 + 2 + r * 3, 12);
    scatter(m, 9, 3, yx0 + 1);
    // трубопровод между залом и двором
    for (let x = 6; x <= 27; x += 1) if (Math.random() < 0.45) m.props.push({ x: x + 0.5, y: 12.5, t: 'pipe' });
    setO(m, 13, 12, 12); setO(m, 22, 12, 12);
    scatter(m, 8, 5, 6, 11); scatter(m, 4, 3, 6, 11); scatter(m, 9, 2, 6);
    m.anchor = { x: 19, y: 7 };
    m.late = function (mm) {
      vehicleTry(mm, 0, 5, 18, 23, 16, 16, 40) || vehicleTry(mm, 0, U.rand(0, 3), 18, 25, 14, 19, 40);
      vehicleTry(mm, 1, U.rand(0, 3), 2, 3, 0, 3);
    };
    decor(m, 'crack', 14); decor(m, 'scorch', 5, 6); decor(m, 'puddle', 4, 8);
    props(m, 'pipe', 6, 6); props(m, 'rebar', 4); props(m, 'wire', 4); props(m, 'papers', 3, 12); props(m, 'can', 3); props(m, 'tuft', 8); props(m, 'lamp', 3, 6); props(m, 'sign', 2, 12);
    const d = o.diff || 1;
    m.itemList = [{ kind: 'materials', amt: U.rand(5, 9) }, { kind: 'materials', amt: U.rand(5, 9) }, { kind: 'materials', amt: U.rand(4, 7) },
      { kind: 'ammo', amt: U.rand(15, 30) }, { kind: 'meds', amt: 1 }, { kind: 'gems', amt: U.rand(3, 5) + d }, { kind: 'gems', amt: U.rand(3, 5) + d }];
    return m;
  };

  /* Товарная станция: три пути с составами контейнеров (проходы между вагонами), перрон на уровень выше с вокзалом,
     пакгауз, будка стрелочника с крышей */
  GEN.railyard = function (o) {
    const m = M(30, 20, 8);
    groundNoise(m, [[0.5, 8], [0.78, 0], [1, 2]]);
    const tracks = [4, 12, 15];   // верхний ряд пути (путь — два ряда)
    tracks.forEach(function (r) { box(m, 0, r, m.w - 1, r + 1, function (x, y, i) { m.ground[i] = 8; }); m.decor.push({ x: 0, y: r + 1, w: m.w, t: 'rail', r: 0 }); });
    // пакгауз (склад) у северного края
    const store = roomGrid(m, 17, 0, [5, 5], [2], { wall: 11, floor: 4, doors: ['s', 's', 'w'], windows: 0, items: [4, 4, 9, 18], furn: 0.35 });
    // перрон: ряды 7–10, на уровень выше; вокзал посередине
    box(m, 7, 7, 28, 10, function (x, y, i) { m.hgt[i] = 1; m.ground[i] = 3; m.obj[i] = 0; m.objHp[i] = 0; });
    const st = roomGrid(m, 14, 7, [3, 3], [2], { wall: 2, floor: 11, doors: ['w', 'e'], windows: 3 });
    for (let k = 0; k < 4; k++) { const x = U.pick([U.rand(8, 12), U.rand(24, 27)]), y = U.rand(8, 9); if (free(m, x, y)) setO(m, x, y, U.pick([4, 6, 9, 21])); }
    [[9, 8], [26, 9], [11, 9]].forEach(function (p) { lamp(m, p[0], p[1]); });
    // между путями и на юге — щебень, ящики, бочки
    scatter(m, 4, 4, 7); scatter(m, 9, 3, 7); scatter(m, 8, 3, 7);
    m.anchor = { x: Math.round((st.x0 + st.x1) / 2), y: 8 };
    const avoid = {};
    store.outer.forEach(function (d) { avoid[d[2]] = 1; avoid[d[2] - 1] = 1; avoid[d[2] + 1] = 1; });
    m.late = function (mm) {
      roofBlock(mm, 24, 17, 3, 2, 2, true);
      tracks.forEach(function (r) {
        let x = U.rand(6, 9);
        while (x + 5 <= mm.w - 1) {
          const blocked = r === tracks[0] && [0, 1, 2, 3, 4].some(function (k) { return avoid[x + k]; });
          if (!blocked && Math.random() < 0.8) vehicleAt(mm, x, r, 0, CONTAINER);
          x += 5 + U.rand(2, 4);
        }
      });
      vehicleTry(mm, 0, U.rand(0, 3), 7, 20, 17, 19);
    };
    decor(m, 'crack', 8); decor(m, 'puddle', 3, 6); decor(m, 'grass', 8, 5);
    props(m, 'tuft', 12); props(m, 'rebar', 3); props(m, 'tire', 2); props(m, 'papers', 3, 7); props(m, 'can', 3); props(m, 'wire', 3); props(m, 'sign', 2, 7);
    const d = o.diff || 1;
    m.itemList = [{ kind: 'food', amt: U.rand(6, 10) }, { kind: 'food', amt: U.rand(4, 8) }, { kind: 'materials', amt: U.rand(4, 7) }, { kind: 'materials', amt: U.rand(4, 7) },
      { kind: 'ammo', amt: U.rand(15, 30) }, { kind: 'gems', amt: U.rand(3, 5) + d }, { kind: 'gems', amt: U.rand(2, 4) + d }];
    return m;
  };

  /* Старый карьер: террасы до трёх уровней вокруг дна, съезд с запада (простреливается сверху), кристаллы на дне,
     валуны на краях уступов, грузовики, бытовка на верхнем уступе */
  GEN.quarry = function (o) {
    const m = M(30, 20, 2);
    groundNoise(m, [[0.38, 8], [0.68, 2], [1, 5]]);
    const bx = 18, by = 10, seed = U.rand(1, 99999);
    box(m, 0, 0, m.w - 1, m.h - 1, function (x, y, i) {
      const dd = Math.hypot((x - bx) / 1.45, y - by) + U.fbm(x * 0.22, y * 0.22, seed, 2) * 1.6 - 0.8;
      m.hgt[i] = dd < 3.4 ? 0 : (dd < 5.4 ? 1 : (dd < 7.4 ? 2 : 3));
      if (m.hgt[i] === 0) m.ground[i] = U.chance(0.6) ? 5 : 8;
    });
    box(m, 0, 8, bx - 4, 12, function (x, y, i) { m.hgt[i] = 0; m.ground[i] = 8; });
    // бытовка на верхнем уступе (северо-восток)
    const hb = 3;
    box(m, 23, 0, 29, 5, function (x, y, i) { m.hgt[i] = hb; m.obj[i] = 0; m.objHp[i] = 0; });
    roomGrid(m, 24, 1, [3], [2], { wall: 2, floor: 11, doors: ['s', 'w'], windows: 2, items: [21, 22, 4] });
    // кристаллы на дне и нижнем уступе, лужа кислоты
    pool(m, bx + 1, by, 4, 7);
    for (let i = 0; i < 7; i++) { const x = U.rand(bx - 4, bx + 5), y = U.rand(by - 3, by + 3); if (free(m, x, y) && m.hgt[I(m, x, y)] <= 1) setO(m, x, y, 20); }
    // валуны на краях уступов — укрытия наверху
    for (let k = 0, t = 0; k < 14 && t < 400; t++) {
      const x = U.rand(6, m.w - 1), y = U.rand(0, m.h - 1), i = I(m, x, y);
      if (!free(m, x, y)) continue;
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (d) { return inb(m, x + d[0], y + d[1]) && m.hgt[I(m, x + d[0], y + d[1])] < m.hgt[i]; });
      if (edge) { setO(m, x, y, U.pick([3, 3, 8])); k++; }
    }
    scatter(m, 12, 3, 9); scatter(m, 4, 3, 7); scatter(m, 9, 2, 7);
    m.anchor = { x: bx, y: by };
    m.late = function (mm) {
      vehicleTry(mm, 0, 5, 6, bx + 3, by - 2, by + 1, 60) || vehicleTry(mm, 1, 5, bx - 4, bx + 4, by - 3, by - 1, 40);
      vehicleTry(mm, 1, 5, 6, 26, 0, 14);
    };
    decor(m, 'crystal', 26, 8); decor(m, 'crack', 10); decor(m, 'scorch', 2, 10);
    props(m, 'shards', 12, 8); props(m, 'tuft', 8); props(m, 'rebar', 2); props(m, 'tire', 2, 8); props(m, 'bones', 3, 8); props(m, 'stalag', 3, 10);
    const d = o.diff || 1;
    const n = U.rand(7, 9);
    for (let i = 0; i < n; i++) m.itemList.push({ kind: 'gems', amt: U.rand(2, 4) + d });
    m.itemList.push({ kind: 'ammo', amt: U.rand(10, 20) });
    return m;
  };

  /* Мост через овраг: провал поперёк карты, три переправы — автомобильный мост с парапетами (разбитая машина
     на полосе), мостки на севере, завал на юге; на том берегу — блокпост: бетонные стены, мешки змейкой,
     казарма, вышка, БТР */
  GEN.bridge = function (o) {
    const m = M(30, 20, 0);
    groundNoise(m, [[0.45, 0], [0.72, 2], [1, 8]]);
    heights(m, 0.16, 0.6, 2, 17);
    const cy = m.h >> 1, ph = U.randf(0, 6.28);
    const rc = [];
    for (let y = 0; y < m.h; y++) {
      const c = 13 + Math.round(Math.sin(y * 0.42 + ph) * 1.4); rc.push(c);
      for (let x = c - 2; x <= c + 2; x++) { m.hgt[I(m, x, y)] = 0; if (x >= c - 1 && x <= c + 1) { setG(m, x, y, 10); setO(m, x, y, 0); } }
    }
    // дорога и мост с парапетами
    box(m, 0, cy - 1, m.w - 1, cy, function (x, y, i) { m.hgt[i] = 0; if (m.ground[i] !== 10) m.ground[i] = 3; m.obj[i] = 0; m.objHp[i] = 0; });
    m.decor.push({ x: 0, y: cy - 1, w: m.w, t: 'road', r: 0 });
    let b0 = 99, b1 = -1;
    for (let y = cy - 2; y <= cy + 1; y++) { b0 = Math.min(b0, rc[y] - 1); b1 = Math.max(b1, rc[y] + 1); }
    for (let y = cy - 2; y <= cy + 1; y++) for (let x = b0 - 1; x <= b1 + 1; x++) {
      const i = I(m, x, y); m.hgt[i] = 0;
      if (y === cy - 2 || y === cy + 1) { if (m.ground[i] === 10) { m.ground[i] = 3; setO(m, x, y, 1); } else if (x === b0 - 1 || x === b1 + 1) setO(m, x, y, 1); }
      else m.ground[i] = 3;
    }
    // мостки на севере и завал на юге
    const ny = U.rand(2, 4), sy = U.rand(15, 16);
    for (let x = rc[ny] - 1; x <= rc[ny] + 1; x++) setG(m, x, ny, 11);
    for (let y = sy; y <= sy + 1; y++) for (let x = rc[y] - 1; x <= rc[y] + 1; x++) setG(m, x, y, 8);
    for (let x = rc[sy] - 1; x <= rc[sy] + 1; x++) if (Math.random() < 0.6) setO(m, x, sy, U.pick([3, 8]));
    // блокпост: бетонный забор с проходами, мешки по фронту и змейкой на дороге
    const fx0 = 19, fy0 = 3, fx1 = 28, fy1 = 16;
    box(m, fx0, fy0, fx1, fy1, function (x, y, i) { m.hgt[i] = 0; m.obj[i] = 0; m.objHp[i] = 0; if (m.ground[i] === 2) m.ground[i] = 8; });
    for (let x = fx0; x <= fx1; x++) { if (x !== 22) setO(m, x, fy0, 14); if (x !== 22) setO(m, x, fy1, 14); }
    for (let y = fy0 + 1; y < fy1; y++) if (y < cy - 2 || y > cy + 1) setO(m, fx0, y, (y === fy0 + 3 || y === fy1 - 3) ? 0 : 6);
    setO(m, fx0 + 2, cy - 1, 6); setO(m, fx0 + 4, cy, 6); setO(m, fx0 + 2, cy - 2, 6); setO(m, fx0 + 4, cy + 1, 6);
    roomGrid(m, 24, fy0 + 1, [3], [3], { wall: 2, floor: 11, doors: ['s', 'w'], windows: 2 });
    setO(m, 26, cy + 4, 12); setO(m, 21, cy + 5, 9); setO(m, 20, cy + 3, 4); setO(m, 22, fy0 + 2, 18);
    // западный берег: развалины дома, деревья, камни
    building(m, 4, 1, 5, 5, 2, 11);
    scatter(m, 5, 4, 5, 10); scatter(m, 3, 4, 5, 10); scatter(m, 8, 3, 5, 10); scatter(m, 7, 1, 5, 10);
    m.anchor = { x: 23, y: cy - 3 };
    m.late = function (mm) {
      roofBlock(mm, 21, cy + 3, 2, 2, 2, false);
      vehicleAt(mm, b0, cy, 0, U.rand(0, 2)) || vehicleAt(mm, b0 + 1, cy, 0, U.rand(0, 2));
      vehicleTry(mm, 0, 6, 23, 23, cy + 1, cy + 2) || vehicleTry(mm, 0, 3, 23, 25, cy + 1, cy + 2);
      vehicleTry(mm, 0, U.rand(0, 3), 6, 8, cy - 1, cy - 1);
    };
    decor(m, 'crack', 12); decor(m, 'scorch', 4, 6); decor(m, 'grass', 10); decor(m, 'bones', 3, 6);
    props(m, 'tuft', 12); props(m, 'bush', 5); props(m, 'can', 3, 17); props(m, 'wire', 4, 17); props(m, 'tire', 2); props(m, 'sign', 2, 17); props(m, 'lamp', 2, 19); props(m, 'bricks', 3);
    const d = o.diff || 1;
    m.itemList = [{ kind: 'ammo', amt: U.rand(20, 35) }, { kind: 'ammo', amt: U.rand(15, 30) }, { kind: 'meds', amt: 1 }, { kind: 'food', amt: U.rand(4, 8) },
      { kind: 'gems', amt: U.rand(3, 5) + d }, { kind: 'gems', amt: U.rand(3, 5) + d }, { kind: 'gems', amt: U.rand(2, 4) + d }];
    return m;
  };

  /* Дом с плоской крышей: глухой кирпичный блок на 2 уровня (3 м) выше земли, наверх — по лестнице с восточной
     или южной стороны (видны камере). На крыше мешки с песком: стрелку сверху +15 к меткости. */
  const ROOFY = { ruins: 1, landing: 1, factory: 1, camp: 1, site: 1 };
  function roofHouses(m, n) {
    m.ladders = m.ladders || [];
    for (let k = 0, tries = 0; k < n && tries < 120; tries++) {
      const w = U.rand(3, 4), h = U.rand(3, 4);
      const x0 = U.rand(9, m.w - w - 3), y0 = U.rand(2, m.h - h - 3);
      // место: ровное, без воды и стен; мелкие предметы убираются
      let ok = true, busy = 0; const base = m.hgt[I(m, x0, y0)];
      for (let y = y0 - 1; y <= y0 + h && ok; y++) for (let x = x0 - 1; x <= x0 + w && ok; x++) {
        if (!inb(m, x, y) || !walkG(m, x, y) || m.hgt[I(m, x, y)] !== base || m.ground[I(m, x, y)] === 9) ok = false;
        else if (m.obj[I(m, x, y)]) { const o = m.obj[I(m, x, y)]; if (o === 2 || o === 11 || o === 14 || o === 15 || o === 23) ok = false; else busy++; }
      }
      if (!ok || busy > 4) continue;
      for (let y = y0 - 1; y <= y0 + h; y++) for (let x = x0 - 1; x <= x0 + w; x++) m.obj[I(m, x, y)] = 0;
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const i = I(m, x, y); m.hgt[i] = base + 2; m.ground[i] = 12; }
      // мешки на краю крыши
      for (let q = 0; q < 2; q++) { const x = x0 + U.rand(0, w - 1), y = q ? y0 + h - 1 : y0 + U.rand(0, h - 1); if (!m.obj[I(m, x, y)]) setO(m, q ? x : x0 + w - 1, y, 6); }
      // лестница: клетка у стены снаружи (на востоке или юге)
      const east = Math.random() < 0.5;
      const lx = east ? x0 + w : x0 + U.rand(0, w - 1), ly = east ? y0 + U.rand(0, h - 1) : y0 + h;
      const rx = east ? lx - 1 : lx, ry = east ? ly : ly - 1;
      if (m.obj[I(m, rx, ry)]) m.obj[I(m, rx, ry)] = 0;
      m.ladders.push({ x: lx, y: ly, rx: rx, ry: ry, d: east ? 0 : 1 });
      k++;
    }
  }

  /* Подъём на высоту — только по лестнице: ступени между уровнями рельефа (перепад 1) и приставные лестницы
     на крыши. Мелкие бугры и ямы сглаживаются; ступени ставятся так, чтобы любая площадка была достижима,
     на длинных перепадах — несколько, вразброс. Ступень: { x, y — нижняя клетка, rx, ry — верхняя, st: 1 } */
  function flattenSmall(m) {
    for (let pass = 0; pass < 3; pass++) {
      const comp = new Int32Array(m.w * m.h).fill(-1);
      let changed = false;
      for (let i0 = 0; i0 < comp.length; i0++) {
        if (comp[i0] >= 0 || !walkG(m, i0 % m.w, (i0 / m.w) | 0) || m.ground[i0] === 12 || m.obj[i0] === 23) continue;
        const h = m.hgt[i0], tiles = [i0], nbH = {};
        comp[i0] = i0;
        for (let q = 0; q < tiles.length; q++) {
          const c = tiles[q], cx = c % m.w, cy = (c / m.w) | 0;
          [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
            const nx = cx + d[0], ny = cy + d[1];
            if (!inb(m, nx, ny)) return;
            const j = I(m, nx, ny);
            if (!walkG(m, nx, ny) || m.ground[j] === 12 || m.obj[j] === 23) return;
            if (m.hgt[j] !== h) { nbH[m.hgt[j]] = (nbH[m.hgt[j]] || 0) + 1; return; }
            if (comp[j] < 0) { comp[j] = i0; tiles.push(j); }
          });
        }
        if (tiles.length >= 6) continue;
        let best = null, bc = 0;
        for (const k in nbH) if (nbH[k] > bc) { bc = nbH[k]; best = +k; }
        if (best === null) continue;
        tiles.forEach(function (t) { m.hgt[t] = best; });
        changed = true;
      }
      if (!changed) break;
      // перепад между соседями — не больше уровня (крыши не трогаем)
      for (let it = 0; it < 4; it++) for (let i = 0; i < m.hgt.length; i++) {
        if (m.ground[i] === 12 || m.obj[i] === 23) continue;
        const x = i % m.w, y = (i / m.w) | 0;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
          const nx = x + d[0], ny = y + d[1];
          if (!inb(m, nx, ny)) return;
          const j = I(m, nx, ny);
          if (m.ground[j] !== 12 && m.obj[j] !== 23 && m.hgt[i] - m.hgt[j] > 1) m.hgt[i] = m.hgt[j] + 1;
        });
      }
    }
  }
  /* крыши: обе клетки лестницы свободны, мешки на крыше не отрезают её часть от лестницы */
  function roofClear(m) {
    (m.ladders || []).forEach(function (l) {
      [[l.x, l.y], [l.rx, l.ry]].forEach(function (p) { const i = I(m, p[0], p[1]); if (m.obj[i] && m.obj[i] !== 2 && m.obj[i] !== 11) { m.obj[i] = 0; if (m.objHp) m.objHp[i] = 0; } });
      // от верхней клетки — по крыше: всё, что не достать в обход мешков, освобождаем
      const top = I(m, l.rx, l.ry), h = m.hgt[top];
      const seen = {}, q = [top]; seen[top] = 1;
      const roof = [];
      for (let k = 0; k < q.length; k++) {
        const c = q[k], x = c % m.w, y = (c / m.w) | 0; roof.push(c);
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
          const nx = x + d[0], ny = y + d[1]; if (!inb(m, nx, ny)) return;
          const j = I(m, nx, ny); if (seen[j] || m.hgt[j] !== h || m.ground[j] !== 12) return;
          seen[j] = 1; q.push(j);
        });
      }
      const reach = {}, q2 = [top]; reach[top] = 1;
      for (let k = 0; k < q2.length; k++) {
        const c = q2[k], x = c % m.w, y = (c / m.w) | 0;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
          const j = I(m, x + d[0], y + d[1]); if (!seen[j] || reach[j] || m.obj[j]) return;
          reach[j] = 1; q2.push(j);
        });
      }
      roof.forEach(function (i) { if (!reach[i] && m.obj[i] === 6) { m.obj[i] = 0; if (m.objHp) m.objHp[i] = 0; } });
    });
  }
  /* лестница-марш: клетка lo перед уступом (8 ступеней на всю клетку), наверх — клетка hi; заход только спереди
     (клетка front той же высоты) и сверху, по прямой; ход в бою — те же правила (BT.stairOk) */
  function stairIndex(m) {
    const ST = {};
    (m.ladders || []).forEach(function (l) { if (l.st) ST[I(m, l.x, l.y)] = { hi: I(m, l.rx, l.ry), front: I(m, 2 * l.x - l.rx, 2 * l.y - l.ry) }; });
    return ST;
  }
  function stairStep(ST, a, b) {
    const p = ST[a], q = ST[b];
    if (p && b !== p.hi && b !== p.front) return false;
    if (q && a !== q.hi && a !== q.front) return false;
    return true;
  }
  function reachCount(m, cx, cy) { const r = flood(m, cx, cy); let n = 0; for (let i = 0; i < r.length; i++) n += r[i]; return { r: r, n: n }; }
  function stairs(m, cx, cy) {
    m.ladders = m.ladders || [];
    const n = m.w * m.h;
    const isStair = function (i) { return m.ladders.some(function (l) { return l.st && (I(m, l.x, l.y) === i || I(m, 2 * l.x - l.rx, 2 * l.y - l.ry) === i); }); };
    const ladTile = {};
    m.ladders.forEach(function (l) { ladTile[I(m, l.x, l.y)] = 1; ladTile[I(m, l.rx, l.ry)] = 1; });
    // кандидаты: lo — свободна, hi на уровень выше, front — свободна и на уровне lo
    const cand = [];
    for (let i = 0; i < n; i++) {
      const x = i % m.w, y = (i / m.w) | 0;
      if (!free(m, x, y) || ladTile[i]) continue;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        const hx = x + d[0], hy = y + d[1], fx = x - d[0], fy = y - d[1];
        if (!free(m, hx, hy) || !free(m, fx, fy)) return;
        const hi = I(m, hx, hy), fr = I(m, fx, fy);
        if (m.hgt[hi] !== m.hgt[i] + 1 || m.hgt[fr] !== m.hgt[i] || ladTile[hi] || ladTile[fr]) return;
        cand.push({ lo: i, hi: hi, fr: fr, x: x, y: y, hx: hx, hy: hy, d: d });
      });
    }
    U.shuffle(cand);
    const all = function () { let k = 0; for (let i = 0; i < n; i++) if (free(m, i % m.w, (i / m.w) | 0)) k++; return k; };
    const total = all();
    let cur = reachCount(m, cx, cy);
    const placed = [];
    const tooClose = function (c) { return placed.some(function (p) { return Math.abs(p.x - c.x) + Math.abs(p.y - c.y) < 4; }); };
    const tryAdd = function (c) {
      if (isStair(c.lo) || isStair(c.hi) || isStair(c.fr)) return false;
      const l = { x: c.x, y: c.y, rx: c.hx, ry: c.hy, d: c.d[0] ? 0 : 1, st: 1 };
      m.ladders.push(l);
      const nx = reachCount(m, cx, cy);
      // ступень полезна, если открыла новое, и не отрезала уже доступное
      let lost = false;
      for (let i = 0; i < n && !lost; i++) if (cur.r[i] && !nx.r[i] && i !== c.lo) lost = true;
      if (lost || nx.n <= cur.n) { m.ladders.pop(); return false; }
      cur = nx; placed.push(c);
      return true;
    };
    // 1) связать все площадки: пока что-то недоступно — ставить ступень, открывающую новое
    for (let guard = 0; guard < 60 && cur.n < total; guard++) {
      let ok = false;
      for (let k = 0; k < cand.length && !ok; k++) {
        const c = cand[k];
        if (!cur.r[c.fr] || cur.r[c.hi] || tooClose(c)) continue;
        ok = tryAdd(c);
      }
      if (!ok) for (let k = 0; k < cand.length && !ok; k++) {
        const c = cand[k];
        if (!(cur.r[c.fr] ^ cur.r[c.hi])) continue;
        // сверху вниз: верх доступен, низ нет — та же ступень
        ok = tryAdd(c);
      }
      if (!ok) break;
    }
    // 2) лишние площадки, до которых не добраться, — опустить до соседнего уровня (без лестницы туда не попасть)
    for (let pass = 0; pass < 30 && cur.n < total; pass++) {
      for (let i = 0; i < n; i++) {
        const x = i % m.w, y = (i / m.w) | 0;
        if (!free(m, x, y) || cur.r[i] || m.ground[i] === 12) continue;
        let best = null;
        // сосед, на которого можно шагнуть сбоку (не марш лестницы)
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { const nx2 = x + d[0], ny2 = y + d[1]; if (free(m, nx2, ny2) && cur.r[I(m, nx2, ny2)] && !isStair(I(m, nx2, ny2))) best = m.hgt[I(m, nx2, ny2)]; });
        if (best !== null && !isStair(i)) m.hgt[i] = best;
      }
      cur = reachCount(m, cx, cy);
    }
    // 2б) тупики сбоку от марша (одна-две клетки, куда не зайти) — занять ящиком, бочкой, валуном
    if (cur.n < total) {
      for (let i = 0; i < n; i++) {
        const x = i % m.w, y = (i / m.w) | 0;
        if (!free(m, x, y) || cur.r[i] || m.ground[i] === 12) continue;
        const g = m.ground[i];
        setO(m, x, y, g === 5 ? 3 : (g === 6 ? 16 : U.pick([4, 9, 4])));
      }
      cur = reachCount(m, cx, cy);
    }
    // 3) ещё по ступени на длинные перепады (не обходить полкарты)
    let extra = 0;
    for (let k = 0; k < cand.length && extra < Math.round(total / 60); k++) {
      const c = cand[k];
      if (tooClose(c) || placed.some(function (p) { return Math.abs(p.x - c.x) + Math.abs(p.y - c.y) < 7; })) continue;
      if (isStair(c.lo) || isStair(c.hi) || isStair(c.fr)) continue;
      m.ladders.push({ x: c.x, y: c.y, rx: c.hx, ry: c.hy, d: c.d[0] ? 0 : 1, st: 1 });
      const nx = reachCount(m, cx, cy);
      if (nx.n < cur.n) { m.ladders.pop(); continue; }
      cur = nx; placed.push(c); extra++;
    }
  }

  MG.generate = function (type, o) {
    o = o || {};
    const gen = GEN[type] || GEN.ruins;
    let m = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      m = gen(o);
      if (m.kind !== 'defense') setupDeploy(m);
      if (m.post) m.post(m);
      if (m.kind !== 'defense') { const cy = m.h >> 1; for (let y = cy - 4; y <= cy + 4; y++) for (let x = 0; x <= 4; x++) if (inb(m, x, y)) m.hgt[I(m, x, y)] = 0; }
      smoothH(m);
      m.ladders = [];
      if (ROOFY[type] && m.kind !== 'defense') roofHouses(m, U.rand(1, 2));
      if (m.late) { m.late(m); m.late = null; }
      flattenSmall(m);
      fixDoors(m);
      m.post = null;
      // спавн и туррели должны быть свободны
      const c = m.center;
      if (!free(m, c[0], c[1])) carve(m, c[0], c[1]);
      connect(m, c[0], c[1]);
      roofClear(m);
      stairs(m, c[0], c[1]);
      const reach = flood(m, c[0], c[1]);
      if (m.kind === 'defense') {
        m.deploy = m.deploy.filter(function (d) { return reach[I(m, d[0], d[1])]; });
        m.spawn = m.spawn.filter(function (s) { return reach[I(m, s[0], s[1])] && free(m, s[0], s[1]); });
        if (m.deploy.length >= 8 && m.spawn.length >= 6) {
          // ворота закрываются уже после проверки проходов: снаружи к бойцам — только через пролом
          (m.wallTiles || []).forEach(function (t) { if (t[3] && free(m, t[0], t[1])) setO(m, t[0], t[1], t[2]); });
          m.wire = (m.wire || []).filter(function (p) { return reach[I(m, p[0], p[1])]; });
          m.mines = (m.mines || []).filter(function (p) { return free(m, p[0], p[1]); });
          m._occupied = {}; return m;
        }
        continue;
      }
      m.deploy = m.deploy.filter(function (d) { return reach[I(m, d[0], d[1])]; });
      if (m.deploy.length < 6) continue;
      if (!placePods(m, o.pods || [], reach)) continue;
      placeItems(m, reach);
      return m;
    }
    return m;
  };

  DW.MapGen = MG;
})(window.DW);
