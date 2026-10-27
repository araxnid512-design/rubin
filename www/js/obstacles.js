// Физические препятствия: ящики, баррикады из мешков, бочки, завалы машин.
// Параметры (размеры, плотность) — в CONFIG.OBSTACLES.
(function () {
  const pl = window.planck;

  // Мусор не цепляется за колёса (иначе машина «садится» на ящики днищем),
  // брошенные машины — цепляются: через них можно переехать.
  function filter(heavy) {
    const K = window.CONFIG.COLLIDE;
    return heavy
      ? { filterCategoryBits: K.heavy, filterMaskBits: K.ground | K.body | K.wheel | K.debris | K.heavy | K.zombie }
      : { filterCategoryBits: K.debris, filterMaskBits: K.ground | K.body | K.debris | K.heavy | K.zombie };
  }

  function box(world, x, y, w, h, def, angle, heavy) {
    const b = world.createDynamicBody({ position: pl.Vec2(x, y), angle: angle || 0 });
    b.createFixture(pl.Box(w / 2, h / 2), Object.assign({ density: def.density, friction: def.friction, restitution: 0.05 }, filter(heavy)));
    b.setSleepingAllowed(true);
    b.setAwake(false);
    return b;
  }

  // Силуэт сплющенной машины (выпуклый): пологий багажник сзади, капот спереди.
  // Машина подъезжает слева — к багажнику.
  function wreckShape(d) {
    const w = d.w / 2, h = d.h / 2;
    return [[-w, -h], [w, -h], [w - d.w * 0.19, h * 0.2], [d.w * 0.1, h], [-d.w * 0.02, h]];
  }

  const BUILDERS = {
    crates(world, o, ground, C) {
      const d = C.crate, out = [];
      const n = o.count || 3;
      for (let i = 0; i < n; i++) {
        const row = i < 3 ? 0 : 1;
        const col = row ? i - 3 + 0.5 : i;
        const b = box(world, o.x + col * d.size * 1.02, ground + d.size * (row + 0.5) + 0.01, d.size, d.size, d);
        b.setUserData({ kind: 'obstacle', type: 'crate', w: d.size, h: d.size, shade: (i * 37) % 10 });
        out.push(b);
      }
      return out;
    },
    barricade(world, o, ground, C) {
      const d = C.sandbag, out = [];
      const rows = o.rows || 3, cols = o.cols || 2;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols - (r % 2 ? 1 : 0); c++) {
          const x = o.x + c * d.w + (r % 2 ? d.w / 2 : 0);
          const b = box(world, x, ground + d.h * (r + 0.5) + 0.01, d.w, d.h, d);
          b.setUserData({ kind: 'obstacle', type: 'sandbag', w: d.w, h: d.h });
          out.push(b);
        }
      }
      // Доски сверху.
      const p = C.plank;
      const b = box(world, o.x + (cols - 1) * d.w / 2, ground + d.h * rows + p.h / 2 + 0.02, p.w, p.h, p);
      b.setUserData({ kind: 'obstacle', type: 'plank', w: p.w, h: p.h });
      out.push(b);
      return out;
    },
    barrels(world, o, ground, C) {
      const d = C.barrel, out = [];
      for (let i = 0; i < (o.count || 3); i++) {
        const b = world.createDynamicBody({ position: pl.Vec2(o.x + i * d.r * 2.05, ground + d.r + 0.01) });
        b.createFixture(pl.Circle(d.r), Object.assign({ density: d.density, friction: d.friction, restitution: 0.1 }, filter(false)));
        b.setUserData({ kind: 'obstacle', type: 'barrel', r: d.r, rust: i % 3 });
        b.setAwake(false);
        out.push(b);
      }
      return out;
    },
    // Завал брошенных машин: сплющенные корпуса с пологими боками — машина
    // въезжает на них, как на горку; третий лежит сверху на первых двух.
    wrecks(world, o, ground, C) {
      const d = C.wreck, out = [];
      const colors = ['#5a6a72', '#7a5a3a', '#6a3a34', '#8a8a7a', '#3a4a3a'];
      const shape = wreckShape(d);
      const n = o.count || 2;
      for (let i = 0; i < n; i++) {
        const top = i >= 2;
        const x = o.x + (top ? d.w * 0.5 : i * d.w);
        const y = ground + d.h * (top ? 1.5 : 0.5) + 0.02;
        const b = world.createDynamicBody({ position: pl.Vec2(x, y) });
        b.createFixture(pl.Polygon(shape.map((p) => pl.Vec2(p[0], p[1]))), Object.assign({ density: d.density, friction: d.friction, restitution: 0.05 }, filter(true)));
        b.setSleepingAllowed(true);
        b.setAwake(false);
        b.setUserData({ kind: 'obstacle', type: 'wreck', heavy: true, w: d.w, h: d.h, shape, color: colors[((o.x | 0) + i) % colors.length] });
        out.push(b);
      }
      return out;
    },
  };

  // Брёвна (лес) и трубы (промзона): тяжёлые, колёса переезжают их как кочки.
  BUILDERS.logs = function (world, o, ground, C) {
    const d = C.log, out = [];
    for (let i = 0; i < (o.count || 3); i++) {
      const b = box(world, o.x + (i % 2) * 0.6, ground + d.h * (i + 0.5) + 0.02, d.w, d.h, d, 0, true);
      b.setUserData({ kind: 'obstacle', type: 'log', heavy: true, w: d.w, h: d.h, pipe: !!o.pipe });
      out.push(b);
    }
    return out;
  };
  // Забор из досок: мусор, разлетается от удара.
  BUILDERS.fence = function (world, o, ground, C) {
    const d = C.fencePlank, out = [];
    for (let i = 0; i < (o.count || 6); i++) {
      const b = box(world, o.x + i * (d.w + 0.04), ground + d.h / 2 + 0.01, d.w, d.h, d);
      b.setUserData({ kind: 'obstacle', type: 'plank', w: d.w, h: d.h });
      out.push(b);
    }
    return out;
  };

  // Бревно или ящик на склоне съезжает вниз и клинит машину:
  // переносим на ближайший гребень или ровное место (не в низину).
  function flatSpot(terrain, x) {
    const h = (x) => terrain.heightAt(x);
    const ok = (x) => Math.abs(h(x + 2) - h(x - 2)) < 0.3 && h(x) >= Math.min(h(x - 4), h(x + 4)) - 0.05;
    for (let d = 0; d <= 25; d += 0.5) {
      if (ok(x + d)) return x + d;
      if (ok(x - d)) return x - d;
    }
    return x;
  }

  // Ставит все препятствия уровня на трассу.
  function place(world, terrain) {
    const C = window.CONFIG.OBSTACLES;
    const bodies = [];
    for (const o of terrain.objects) {
      const build = BUILDERS[o.type];
      if (!build) continue; // остальные объекты (заражённые, канистры) — в своих модулях
      if (o.y == null) o.x = flatSpot(terrain, o.x);
      const ground = o.y != null ? o.y : terrain.heightAt(o.x);
      bodies.push(...build(world, o, ground, C));
    }
    return bodies;
  }

  window.Obstacles = { place };
})();
