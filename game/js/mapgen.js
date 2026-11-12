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
    const doors = U.rand(2, 3);
    let k = 0;
    for (let i = 0; i < doors && k < perim.length; i++, k++) setO(m, perim[k][0], perim[k][1], 0);
    const wins = U.rand(1, 3);
    for (let i = 0; i < wins && k < perim.length; i++, k++) setO(m, perim[k][0], perim[k][1], 1);
    for (; k < perim.length; k++) {
      if (Math.random() < 0.1) { setO(m, perim[k][0], perim[k][1], 0); setG(m, perim[k][0], perim[k][1], 8); }
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
  function prefab(m, name, minX, floor) {
    const pf = PREFABS[name];
    const ph = pf.length, pw = pf[0].length;
    for (let t = 0; t < 30; t++) {
      const x0 = U.rand(minX, m.w - pw - 1), y0 = U.rand(1, m.h - ph - 1);
      let busy = 0;
      for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) if (m.obj[I(m, x0 + x, y0 + y)]) busy++;
      if (busy > pw * ph * 0.15) continue;
      const hh = m.hgt[I(m, x0, y0)];
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
    props(m, 'tire', 3); props(m, 'bricks', 5); props(m, 'can', 3); props(m, 'papers', 4); props(m, 'rebar', 2); decor(m, 'puddle', 3); props(m, 'lamp', 3);
    heights(m, 0.13, 0.68, 0.9, 6); prefab(m, U.pick(['gas', 'checkpoint', 'pillbox']), 8, 3);
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
    props(m, 'tire', 3); props(m, 'can', 4); props(m, 'papers', 3); props(m, 'bricks', 2); props(m, 'lamp', 2);
    heights(m, 0.12, 0.66, 0.9, 6); raise(m, 15, 5, 23, 13, 1); if (Math.random() < 0.6) prefab(m, 'outpost', 7);
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
    props(m, 'pipe', 7, 7); props(m, 'bones', 2, 7); props(m, 'tuft', 5, 0); props(m, 'papers', 4, 5); props(m, 'rebar', 2, 5); props(m, 'can', 2, 5); props(m, 'lamp', 3, 4);
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
    const gates = {};
    [[x1, 9], [x1, 10], [10, y0], [11, y0], [10, y1], [11, y1], [x0, 9], [x0, 10]].forEach(function (g) { gates[g[0] + ',' + g[1]] = 1; });
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const edge = x === x0 || y === y0 || x === x1 || y === y1;
        if (!edge || gates[x + ',' + y]) continue;
        if (wallObj) setO(m, x, y, wallObj);
        else if (Math.random() < 0.3) setO(m, x, y, U.pick([4, 6, 6]));
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
    for (let y = 0; y < m.h; y++) { m.spawn.push([m.w - 1, y]); m.spawn.push([m.w - 2, y]); }
    for (let x = 20; x < m.w - 2; x++) { m.spawn.push([x, 0]); m.spawn.push([x, m.h - 1]); }
    props(m, 'tuft', 10); props(m, 'bush', 4, 18); props(m, 'sign', 2, 18); props(m, 'can', 3); props(m, 'tire', 2); props(m, 'bricks', 3); props(m, 'lamp', 3);
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
    if (Math.random() < 0.6) prefab(m, 'barracks', 7, 3);
    props(m, 'pipe', 9, 5); props(m, 'sign', 3, 5); props(m, 'tuft', 6, 0); props(m, 'tire', 3); props(m, 'can', 4); props(m, 'rebar', 4); props(m, 'papers', 3); decor(m, 'puddle', 4); props(m, 'lamp', 4);
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
      m.post = null;
      // спавн и туррели должны быть свободны
      const c = m.center;
      if (!free(m, c[0], c[1])) carve(m, c[0], c[1]);
      connect(m, c[0], c[1]);
      const reach = flood(m, c[0], c[1]);
      if (m.kind === 'defense') {
        m.deploy = m.deploy.filter(function (d) { return reach[I(m, d[0], d[1])]; });
        m.spawn = m.spawn.filter(function (s) { return reach[I(m, s[0], s[1])] && free(m, s[0], s[1]); });
        if (m.deploy.length >= 8 && m.spawn.length >= 6) { m._occupied = {}; return m; }
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
