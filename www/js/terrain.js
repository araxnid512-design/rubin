// Трасса: строит линию земли из сегментов конфига и статическое тело Planck.
(function () {
  const pl = window.planck;
  const STEP = 1; // шаг точек по x, м

  class Terrain {
    constructor(world, def, startY) {
      this.points = [];   // [x, y], y вверх
      this.marks = [];    // особые места (для отрисовки и логики)
      let x = 0, y = startY || 0;
      this.points.push([-30, y + 20], [-30, y], [0, y]); // стена слева
      for (const seg of def.segments) {
        const r = this['seg_' + seg.type](x, y, seg);
        x = r.x; y = r.y;
      }
      this.points.push([x + 60, y], [x + 60, y + 30]); // конец трассы
      this.length = x;
      this.body = world.createBody();
      const verts = this.points.map(([px, py]) => pl.Vec2(px, py));
      this.body.createFixture(pl.Chain(verts, false), { friction: window.CONFIG.PHYSICS.groundFriction });
      this.body.setUserData({ kind: 'ground' });
    }

    add(x, y) { this.points.push([x, y]); }

    seg_flat(x, y, s) {
      for (let i = STEP; i <= s.length; i += STEP) this.add(x + i, y);
      return { x: x + s.length, y };
    }

    // Холмы: плавные волны выше текущего уровня, начинаются и кончаются полого.
    seg_hills(x, y, s) {
      let ny = y;
      for (let i = STEP; i <= s.length; i += STEP) {
        const t = i / s.wave;
        const fade = Math.min(1, i / s.wave, (s.length - i) / s.wave);
        ny = y + s.amp * (1 - Math.cos(t * Math.PI * 2)) / 2 * fade + (s.drift || 0) * i;
        this.add(x + i, ny);
      }
      return { x: x + s.length, y: ny };
    }

    // Трамплин: подъём и резкий обрыв обратно.
    seg_ramp(x, y, s) {
      for (let i = STEP; i <= s.length; i += STEP) {
        const t = i / s.length;
        this.add(x + i, y + s.height * t * t * 0.4 + s.height * t * 0.6);
      }
      this.add(x + s.length + 0.05, y);
      this.marks.push({ type: 'ramp', x: x + s.length, y: y + s.height });
      return { x: x + s.length + 0.05, y };
    }

    // Яма: отвесные края, дно ниже на depth.
    seg_gap(x, y, s) {
      this.add(x + 0.05, y - s.depth);
      this.add(x + s.length - 0.05, y - s.depth);
      this.add(x + s.length, y);
      this.marks.push({ type: 'gap', x, w: s.length, y, depth: s.depth });
      return { x: x + s.length, y };
    }

    // Высота поверхности в точке x (линейная интерполяция по точкам).
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
