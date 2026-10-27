// Трасса уровня: линия земли из сегментов конфига, эстакады развилок, отметки
// (чекпоинты, стаб, мосты, вода) и точки расстановки объектов.
(function () {
  const pl = window.planck;
  const STEP = 1; // шаг точек по x, м

  class Terrain {
    constructor(world, level) {
      this.world = world;
      this.points = [];     // [x, y], y вверх
      this.marks = [];      // особые места: ramp, gap, bridge, water, checkpoint, stab, fork
      this.platforms = [];  // эстакады развилок: { x, y, w, h }
      this.objects = [];    // что поставить на трассу: { type, x, y?, ...параметры }
      this.checkpoints = [];
      let x = 0, y = 0;
      this.points.push([-30, y + 20], [-30, y], [0, y]); // стена слева
      for (const seg of level.segments) {
        const fn = this['seg_' + seg.type];
        if (!fn) throw new Error('Неизвестный сегмент трассы: ' + seg.type);
        const start = { x, y };
        const r = fn.call(this, x, y, seg);
        for (const o of seg.objects || []) this.objects.push(Object.assign({}, o, { x: start.x + o.dx }));
        x = r.x; y = r.y;
      }
      this.points.push([x + 80, y], [x + 80, y + 30]); // конец трассы
      this.length = x;
      this.body = world.createBody();
      const verts = this.points.map(([px, py]) => pl.Vec2(px, py));
      this.body.createFixture(pl.Chain(verts, false), { friction: window.CONFIG.PHYSICS.groundFriction, filterCategoryBits: window.CONFIG.COLLIDE.ground });
      this.body.setUserData({ kind: 'ground' });
      for (const p of this.platforms) this.addPlatformBody(p);
    }

    add(x, y) { this.points.push([x, y]); }

    seg_flat(x, y, s) {
      for (let i = STEP; i <= s.length; i += STEP) this.add(x + i, y);
      return { x: x + s.length, y };
    }

    // Наклон: подъём (rise > 0) или спуск, с плавными краями.
    seg_slope(x, y, s) {
      let ny = y;
      for (let i = STEP; i <= s.length; i += STEP) {
        const t = i / s.length;
        ny = y + s.rise * (t * t * (3 - 2 * t));
        this.add(x + i, ny);
      }
      return { x: x + s.length, y: y + s.rise };
    }

    // Холмы: плавные волны выше текущего уровня.
    seg_hills(x, y, s) {
      let ny = y;
      for (let i = STEP; i <= s.length; i += STEP) {
        const t = i / s.wave;
        const fade = Math.min(1, i / s.wave, (s.length - i) / s.wave);
        ny = y + s.amp * (1 - Math.cos(t * Math.PI * 2)) / 2 * fade;
        this.add(x + i, ny);
      }
      return { x: x + s.length, y: ny };
    }

    // Битый асфальт: мелкие кочки и выбоины.
    seg_rubble(x, y, s) {
      for (let i = STEP; i <= s.length; i += STEP) {
        const h = Math.sin((x + i) * 0.9) * Math.sin((x + i) * 0.37) * (s.amp || 0.15);
        this.add(x + i, y + (i < s.length ? h : 0));
      }
      return { x: x + s.length, y };
    }

    // Трамплин: подъём и резкий обрыв обратно.
    seg_ramp(x, y, s) {
      for (let i = STEP; i <= s.length; i += STEP) {
        const t = i / s.length;
        this.add(x + i, y + s.height * (t * t * 0.4 + t * 0.6));
      }
      this.add(x + s.length + 0.05, y);
      this.marks.push({ type: 'ramp', x, w: s.length, y, h: s.height });
      return { x: x + s.length + 0.05, y };
    }

    // Яма с отвесными краями.
    seg_gap(x, y, s) {
      this.add(x + 0.05, y - s.depth);
      this.add(x + s.length - 0.05, y - s.depth);
      this.add(x + s.length, y);
      this.marks.push({ type: 'gap', x, w: s.length, y, depth: s.depth });
      return { x: x + s.length, y };
    }

    // Обрыв: земля уходит вниз ступенью.
    seg_drop(x, y, s) {
      this.add(x + 0.05, y - s.height);
      this.marks.push({ type: 'drop', x, y, h: s.height });
      return { x: x + 0.05, y: y - s.height };
    }

    // Разрушенный мост над рекой: настил, задранный обломок перед провалом, вода внизу.
    seg_bridge(x, y, s) {
      const deck = s.deckBefore, broken = s.broken, after = s.deckAfter;
      for (let i = STEP; i <= deck - 3; i += STEP) this.add(x + i, y);
      this.add(x + deck - 1.5, y + s.lip * 0.5);
      this.add(x + deck, y + s.lip);            // обломок задран — работает как трамплин
      this.add(x + deck + 0.05, y - s.depth);   // провал до воды
      this.add(x + deck + broken - 0.05, y - s.depth);
      this.add(x + deck + broken, y);
      for (let i = STEP; i <= after; i += STEP) this.add(x + deck + broken + i, y);
      const total = deck + broken + after;
      this.marks.push({ type: 'bridge', x, w: total, y, gapX: x + deck, gapW: broken, depth: s.depth });
      this.marks.push({ type: 'water', x: x + deck, w: broken, y: y - s.depth + 1.2 });
      return { x: x + total, y };
    }

    // Развилка: трамплин на эстакаду (верхняя дорога) или проезд под ней (нижняя).
    seg_fork(x, y, s) {
      let r = this.seg_ramp(x, y, { length: s.kicker.length, height: s.kicker.height });
      const lowerStart = r.x;
      for (let i = STEP; i <= s.length; i += STEP) this.add(lowerStart + i, y);
      const px = lowerStart + s.upper.gap;
      const p = { x: px, y: y + s.upper.height, w: s.upper.length, h: 0.7 };
      this.platforms.push(p);
      for (const o of s.upper.objects || []) this.objects.push(Object.assign({}, o, { x: px + o.dx, y: p.y, upper: true }));
      for (const o of s.lower.objects || []) this.objects.push(Object.assign({}, o, { x: lowerStart + o.dx }));
      this.marks.push({ type: 'fork', x, upper: p, lowerX: lowerStart, w: s.length });
      return { x: lowerStart + s.length, y };
    }

    // Брод: пологая низина, залитая водой. Без шноркеля мотор в ней захлёбывается.
    seg_ford(x, y, s) {
      for (let i = STEP; i <= s.length; i += STEP) {
        const t = i / s.length;
        this.add(x + i, y - s.depth * Math.sin(Math.PI * t));
      }
      this.marks.push({ type: 'ford', x, w: s.length, y: y - 0.1, depth: s.depth });
      return { x: x + s.length, y };
    }

    seg_checkpoint(x, y, s) {
      this.checkpoints.push(x + 4);
      this.marks.push({ type: 'checkpoint', x: x + 4, y, index: this.checkpoints.length });
      return this.seg_flat(x, y, { length: s.length || 14 });
    }

    // Стаб в конце уровня: ворота и стены.
    seg_stab(x, y, s) {
      this.stab = { x: x + 10, y, name: s.name };
      this.marks.push({ type: 'stab', x: x + 10, y, name: s.name });
      return this.seg_flat(x, y, { length: s.length || 50 });
    }

    addPlatformBody(p) {
      const b = this.world.createBody({ position: pl.Vec2(p.x + p.w / 2, p.y - p.h / 2) });
      b.createFixture(pl.Box(p.w / 2, p.h / 2), { friction: window.CONFIG.PHYSICS.groundFriction, filterCategoryBits: window.CONFIG.COLLIDE.ground });
      b.setUserData({ kind: 'ground', platform: true });
    }

    // Высота поверхности в точке x (по основной земле).
    heightAt(x) {
      const p = this.points;
      let lo = 2, hi = p.length - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (p[mid][0] <= x) lo = mid; else hi = mid;
      }
      const a = p[lo], b = p[hi];
      if (b[0] === a[0]) return Math.max(a[1], b[1]);
      const t = Math.max(0, Math.min(1, (x - a[0]) / (b[0] - a[0])));
      return a[1] + (b[1] - a[1]) * t;
    }
  }

  window.Terrain = Terrain;
})();
