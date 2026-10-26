// Сетка карты: клетка 1×1 м. Проходимость, поля потоков (путь к цели для любого
// числа юнитов сразу), линия видимости, выталкивание из препятствий.
(function () {
  const EMPTY = 0, BUILDING = 1, OBSTACLE = 2, WALL = 3;
  const INF = 1e9;

  class Grid {
    constructor(w, h) {
      this.w = w;
      this.h = h;
      this.type = new Uint8Array(w * h);
      this.wallHp = new Float32Array(w * h);
      this.wallMax = new Float32Array(w * h);
      this.version = 0; // растёт при разрушении стен — поля потоков пересчитываются
    }

    idx(x, y) { return y * this.w + x; }
    inside(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }

    fill(x0, y0, w, h, t) {
      for (let y = Math.max(0, Math.floor(y0)); y < Math.min(this.h, Math.ceil(y0 + h)); y++) {
        for (let x = Math.max(0, Math.floor(x0)); x < Math.min(this.w, Math.ceil(x0 + w)); x++) {
          this.type[this.idx(x, y)] = t;
        }
      }
    }

    setWall(x, y, hp) {
      const i = this.idx(x, y);
      this.type[i] = WALL;
      this.wallHp[i] = hp;
      this.wallMax[i] = hp;
    }

    // Клетка мешает движению?
    solid(x, y) {
      if (!this.inside(x, y)) return true;
      const t = this.type[this.idx(x, y)];
      return t === BUILDING || t === OBSTACLE || t === WALL;
    }

    // Клетка закрывает обзор? Стены и машины невысокие — через них стреляют.
    opaque(x, y) {
      if (!this.inside(x, y)) return true;
      return this.type[this.idx(x, y)] === BUILDING;
    }

    damageWall(x, y, amount) {
      const i = this.idx(x, y);
      if (this.type[i] !== WALL) return false;
      this.wallHp[i] -= amount;
      if (this.wallHp[i] <= 0) {
        this.wallHp[i] = 0;
        this.type[i] = EMPTY;
        this.version++;
        return true;
      }
      return false;
    }

    // Дейкстра от набора точек-источников. wallCost > 0 — стены проходимы,
    // но «дорого» (заражённые идут ломать их, если обхода нет).
    // Куча на типизированных массивах: без мусора, ~1 мс на карту 96×64.
    flow(sources, wallCost) {
      const w = this.w, h = this.h, n = w * h, type = this.type;
      const dist = new Float32Array(n).fill(INF);
      const cap = n * 8 + 16;
      if (!heapIdx || heapIdx.length < cap) { heapIdx = new Int32Array(cap); heapPri = new Float32Array(cap); }
      const hi = heapIdx, hp = heapPri;
      let size = 0;
      const push = (i, p) => {
        let k = size++;
        while (k > 0) {
          const parent = (k - 1) >> 1;
          if (hp[parent] <= p) break;
          hi[k] = hi[parent]; hp[k] = hp[parent];
          k = parent;
        }
        hi[k] = i; hp[k] = p;
      };
      for (const s of sources) {
        const x = Math.floor(s.x), y = Math.floor(s.y);
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const i = y * w + x;
        if (dist[i] === 0) continue;
        dist[i] = 0;
        push(i, 0);
      }
      while (size) {
        const i = hi[0], d = hp[0];
        // pop
        size--;
        if (size) {
          const li = hi[size], lp = hp[size];
          let k = 0;
          for (;;) {
            const l = k * 2 + 1;
            if (l >= size) break;
            const r = l + 1;
            const m = r < size && hp[r] < hp[l] ? r : l;
            if (hp[m] >= lp) break;
            hi[k] = hi[m]; hp[k] = hp[m];
            k = m;
          }
          hi[k] = li; hp[k] = lp;
        }
        if (d > dist[i]) continue;
        const x = i % w, y = (i - x) / w;
        for (let k = 0; k < 8; k++) {
          const nx = x + DX[k], ny = y + DY[k];
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const ni = ny * w + nx;
          const t = type[ni];
          if (t === BUILDING || t === OBSTACLE) continue;
          let step = k < 4 ? 1 : 1.414;
          if (t === WALL) { if (!wallCost) continue; step += wallCost; }
          // Не срезаем углы по диагонали.
          if (k >= 4) {
            const a = type[y * w + nx], b = type[ny * w + x];
            if (a === BUILDING || a === OBSTACLE || b === BUILDING || b === OBSTACLE) continue;
            if (!wallCost && (a === WALL || b === WALL)) continue;
          }
          const nd = d + step;
          if (nd < dist[ni]) { dist[ni] = nd; push(ni, nd); }
        }
      }
      return dist;
    }

    // Куда шагнуть из (x, y) по полю dist: центр соседней клетки с меньшим расстоянием.
    nextStep(dist, x, y) {
      const cx = Math.floor(x), cy = Math.floor(y);
      if (!this.inside(cx, cy)) return null;
      let best = dist[this.idx(cx, cy)], bx = -1, by = -1;
      for (let k = 0; k < 8; k++) {
        const nx = cx + DX[k], ny = cy + DY[k];
        if (!this.inside(nx, ny)) continue;
        const d = dist[this.idx(nx, ny)];
        if (d < best) { best = d; bx = nx; by = ny; }
      }
      if (bx < 0) return null;
      return { x: bx + 0.5, y: by + 0.5, wall: this.type[this.idx(bx, by)] === WALL, cx: bx, cy: by };
    }

    // Линия видимости между точками: обход клеток (DDA).
    los(x0, y0, x1, y1) {
      let cx = Math.floor(x0), cy = Math.floor(y0);
      const ex = Math.floor(x1), ey = Math.floor(y1);
      const dx = x1 - x0, dy = y1 - y0;
      const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
      const tdx = dx !== 0 ? Math.abs(1 / dx) : INF;
      const tdy = dy !== 0 ? Math.abs(1 / dy) : INF;
      let tx = dx !== 0 ? ((sx > 0 ? cx + 1 - x0 : x0 - cx) * tdx) : INF;
      let ty = dy !== 0 ? ((sy > 0 ? cy + 1 - y0 : y0 - cy) * tdy) : INF;
      for (let guard = 0; guard < 200; guard++) {
        if (cx === ex && cy === ey) return true;
        if (tx < ty) { tx += tdx; cx += sx; } else { ty += tdy; cy += sy; }
        if (cx === ex && cy === ey) return true;
        if (this.opaque(cx, cy)) return false;
      }
      return true;
    }

    // Выталкивает круг радиуса r из твёрдых клеток.
    collide(e, r) {
      const x0 = Math.floor(e.x - r), x1 = Math.floor(e.x + r);
      const y0 = Math.floor(e.y - r), y1 = Math.floor(e.y + r);
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          if (!this.solid(x, y)) continue;
          const nx = Math.max(x, Math.min(e.x, x + 1));
          const ny = Math.max(y, Math.min(e.y, y + 1));
          let dx = e.x - nx, dy = e.y - ny;
          const d = Math.hypot(dx, dy);
          if (d >= r) continue;
          if (d > 1e-6) {
            e.x += dx / d * (r - d);
            e.y += dy / d * (r - d);
          } else {
            // Центр внутри клетки: выталкиваем к ближайшему краю.
            const l = e.x - x, rr = x + 1 - e.x, t = e.y - y, b = y + 1 - e.y;
            const m = Math.min(l, rr, t, b);
            if (m === l) e.x = x - r; else if (m === rr) e.x = x + 1 + r;
            else if (m === t) e.y = y - r; else e.y = y + 1 + r;
          }
        }
      }
      e.x = Math.max(r, Math.min(this.w - r, e.x));
      e.y = Math.max(r, Math.min(this.h - r, e.y));
    }

    // Ближайшая свободная клетка к точке (для расстановки юнитов).
    freeNear(x, y, maxR) {
      const cx = Math.floor(x), cy = Math.floor(y);
      for (let r = 0; r <= (maxR || 10); r++) {
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            if (!this.solid(cx + dx, cy + dy)) return { x: cx + dx + 0.5, y: cy + dy + 0.5 };
          }
        }
      }
      return { x, y };
    }
  }

  const DX = [1, -1, 0, 0, 1, 1, -1, -1];
  const DY = [0, 0, 1, -1, 1, -1, 1, -1];

  let heapIdx = null, heapPri = null; // общий буфер кучи для flow()

  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  window.Grid = Grid;
  window.Cell = { EMPTY, BUILDING, OBSTACLE, WALL, INF };
  window.rng = rng;
})();
