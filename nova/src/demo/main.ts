// Демо Nova 2.5D: отсек корабля — мостик, коридор, реактор; герой, пират, робот, дроны, турель; свет с картами
// нормалей, заряды, искры, звёзды за бортом; интерфейс поверх (HTML). Управление: WASD / стрелки, джойстик.
import { Renderer, Mat, paint, Light } from '../engine/gfx'
import { Grid, WallPiece, Actor, SpriteSet, Particles, glowTex, Input, Drawable, TILE, cellCenter, dirIndex } from '../engine/core'

const A = 'assets'
const shot = new URLSearchParams(location.search).has('shot')

async function main() {
  const canvas = document.getElementById('view') as HTMLCanvasElement
  const r = new Renderer(canvas)
  const input = new Input()

  // ---------- материалы ----------
  const tile = async (n: string): Promise<Mat> => {
    const [d, nm] = await Promise.all([r.load(`${A}/tiles/${n}.png`, true), r.load(`${A}/tiles/${n}_n.png`, true)])
    return { diffuse: d, normal: nm }
  }
  const floors: Record<string, Mat> = {}
  for (const n of ['floor_plate_a', 'floor_plate_b', 'floor_plate_c', 'floor_grating', 'floor_hazard_s', 'floor_reactor']) floors[n] = await tile(n)
  const walls: Mat[] = []
  for (const n of ['wall_plain', 'wall_pipes', 'wall_vent', 'wall_window', 'wall_console']) walls.push(await tile(n))
  const cap: Mat = {
    diffuse: paint(r, 64, 45, (c) => {
      c.fillStyle = '#242a31'; c.fillRect(0, 0, 64, 45)
      c.fillStyle = '#76889a'; c.fillRect(0, 0, 64, 1)
      c.fillStyle = '#4c5a66'; c.fillRect(0, 1, 64, 1)
      c.fillStyle = '#29505f'; c.fillRect(0, 22, 64, 1)
      c.fillStyle = '#121418'; c.fillRect(0, 43, 64, 2); c.fillRect(0, 0, 1, 45)
      c.fillStyle = '#6a7580'; for (const [x, y] of [[6, 7], [57, 7], [6, 37], [57, 37]]) c.fillRect(x, y, 1, 1)
    }),
    normal: paint(r, 1, 1, (c) => { c.fillStyle = 'rgb(128,218,218)'; c.fillRect(0, 0, 1, 1) }),
  }
  const glow: Mat = { diffuse: glowTex(r), normal: null }
  const stars: Mat = {
    diffuse: paint(r, 1024, 1024, (c) => {
      c.fillStyle = '#000'; c.fillRect(0, 0, 1024, 1024)
      for (const [x, y, rr, col] of [[300, 400, 380, 'rgba(60,40,120,0.18)'], [800, 750, 300, 'rgba(20,80,120,0.16)']] as const) {
        const g = c.createRadialGradient(x, y, 0, x, y, rr); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)')
        c.fillStyle = g; c.fillRect(0, 0, 1024, 1024)
      }
      let s = 7
      const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
      for (let i = 0; i < 900; i++) {
        const b = rnd(); c.fillStyle = `rgba(${200 + rnd() * 55},${210 + rnd() * 45},255,${0.25 + b * 0.75})`
        const z = b > 0.97 ? 2 : 1; c.fillRect(rnd() * 1024, rnd() * 1024, z, z)
      }
    }, true),
    normal: null,
  }

  // ---------- корабль ----------
  const g = new Grid()
  g.addRoom({ x: 1, y: 3, w: 11, h: 8, floor: 'floor_plate_c' })     // мостик
  g.addRoom({ x: 13, y: 6, w: 9, h: 3, floor: 'floor_plate_a' })     // коридор
  g.addRoom({ x: 14, y: 1, w: 7, h: 4, floor: 'floor_reactor' })     // реактор
  g.buildWalls([[12, 7], [17, 5]])
  const world: Drawable[] = []
  let seed = 11
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (const [k, c] of g.cells) {
    if (c !== 'wall') continue
    const [x, y] = k.split(',').map(Number)
    const south = g.get(x, y + 1)
    const tall = g.get(x, y - 1) === undefined && south === 'floor'
    const face = south !== 'wall'
    const fm = tall ? walls[Math.floor(rnd() * walls.length)] : walls[0]
    world.push(new WallPiece(x, y, tall, face, fm, cap))
  }

  // ---------- персонажи ----------
  const [heroS, pirS, robS, droneS, workS] = await Promise.all([
    SpriteSet.load(r, `${A}/sprites/hero`, ['idle', 'walk', 'shoot']),
    SpriteSet.load(r, `${A}/sprites/pirate`, ['idle', 'walk', 'shoot']),
    SpriteSet.load(r, `${A}/sprites/robot`, ['idle', 'walk']),
    SpriteSet.load(r, `${A}/sprites/drone_combat`, ['idle']),
    SpriteSet.load(r, `${A}/sprites/drone_worker`, ['idle']),
  ])
  const at = (a: Actor, cx: number, cy: number) => { a.x = cx * TILE.x; a.y = cy * TILE.y; return a }
  const hero = at(new Actor(heroS), 8.6, 7.6); hero.dir = 6; hero.clip = 'shoot'
  const pirate = at(new Actor(pirS), 17.4, 7.4); pirate.dir = 2; pirate.clip = 'shoot'
  const robot = at(new Actor(robS), 20.3, 8.2); robot.dir = 2; robot.clip = 'walk'
  const drone = at(new Actor(droneS), 7.2, 6.4); drone.dir = 6
  const worker = at(new Actor(workS), 16.2, 3.4); worker.dir = 1
  const actors = [hero, pirate, robot, drone, worker]
  world.push(...actors)

  // турель: основание + голова (16 направлений) — наводится на пирата
  const tset = '/sprites/turret_gun'
  const [tb, tbn, th, thn] = await Promise.all(['base', 'base_n', 'head', 'head_n'].map((n) => r.load(`${A}${tset}/${n}.png`)))
  const turret = { x: 11 * TILE.x, y: 5.4 * TILE.y, aim: 0,
    get yy() { return this.y },
    draw(rr: Renderer) {
      rr.quad({ diffuse: tb, normal: tbn }, 'lit', this.x - 64, this.y - 100, 128, 128)
      const f = dirIndex(pirate.x - this.x, pirate.y - this.y, 16)
      rr.quad({ diffuse: th, normal: thn }, 'lit', this.x - 64, this.y - 100, 128, 128, 0, f / 16, 1, (f + 1) / 16)
    } }
  world.push({ get y() { return turret.y }, draw: (rr) => turret.draw(rr) })

  // ---------- свет ----------
  const L = (cx: number, cy: number, rad: number, col: [number, number, number], e: number, h = 70): Light =>
    ({ ...cellCenter(cx, cy), r: rad, color: col, energy: e, h })
  const lights: Light[] = [
    L(4, 5, 420, [1.0, 0.92, 0.8], 1.05),
    L(9, 9, 380, [0.75, 0.85, 1.0], 0.9),
    L(17, 7, 300, [0.55, 0.85, 1.0], 0.8),
    L(17, 2.5, 330, [0.35, 0.85, 1.0], 1.5),
    L(21, 6.5, 260, [1.0, 0.25, 0.2], 1.0),
  ]
  const flash: Light = { x: 0, y: 0, h: 50, r: 200, color: [1.0, 0.6, 0.3], energy: 0 }
  lights.push(flash)
  r.lights = lights

  // ---------- эффекты ----------
  const fx = new Particles(glow)
  world.push(fx)
  const bolt = (from: Actor | { x: number; y: number }, tx: number, ty: number, col: [number, number, number], speed = 900) => {
    const sx = from.x, sy = from.y - 48
    const d = Math.hypot(tx - sx, ty - 48 - sy) || 1
    fx.add({ x: sx + (tx - sx) / d * 18, y: sy + (ty - 48 - sy) / d * 18, vx: (tx - sx) / d * speed, vy: (ty - 48 - sy) / d * speed,
      life: Math.max(0.05, (d - 40) / speed), max: 0.6, size: 7, col, kind: 'bolt', len: 30 })
    fx.add({ x: sx + (tx - sx) / d * 20, y: sy, vx: 0, vy: 0, life: 0.09, max: 0.09, size: 18, col, kind: 'glow' })
  }
  const sparks = (x: number, y: number, col: [number, number, number]) => {
    for (let i = 0; i < 14; i++) {
      const a = -Math.PI * Math.random()
      const sp = 120 + Math.random() * 260
      fx.add({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.3 + Math.random() * 0.3, max: 0.6, size: 2.5, col, kind: 'spark' })
    }
    fx.add({ x, y, vx: 0, vy: 0, life: 0.2, max: 0.2, size: 26, col, kind: 'glow' })
  }

  fx.onEnd = (p) => sparks(p.x, p.y, p.col)

  // ---------- цикл ----------
  let t = 0
  let shotT = 0
  let frames = 0
  const step = (dt: number) => {
    t += dt
    shotT -= dt
    // управление героем
    const m = input.move()
    if (!shot && (m.x || m.y)) {
      const sp = 3.4 * 64 * dt
      const nx = hero.x + m.x * sp, ny = hero.y + m.y * sp * 0.7071
      if (!g.solid(nx, hero.y) && !g.solid(nx + Math.sign(m.x) * 12, hero.y)) hero.x = nx
      if (!g.solid(hero.x, ny) && !g.solid(hero.x, ny + Math.sign(m.y) * 6)) hero.y = ny
      hero.dir = dirIndex(m.x, m.y * 0.7071)
      hero.clip = 'walk'
    } else if (!shot) {
      hero.clip = 'idle'
    }
    // перестрелка
    if (shotT <= 0) {
      shotT = 0.55
      bolt(hero, pirate.x, pirate.y, [0.4, 1.0, 0.55])
      bolt(pirate, hero.x, hero.y, [1.0, 0.35, 0.2], 750)
      bolt({ x: turret.x, y: turret.y + 10 }, pirate.x, pirate.y, [1.0, 0.85, 0.3], 1100)
      flash.x = pirate.x - 20; flash.y = pirate.y - 48; flash.energy = 1.6
    }
    flash.energy = Math.max(0, flash.energy - dt * 8)
    lights[4].energy = 0.7 + 0.5 * Math.abs(Math.sin(t * 3))      // тревога мигает
    drone.lift = 6 + Math.sin(t * 3) * 3
    worker.lift = 4 + Math.sin(t * 2.6 + 1) * 3
    for (const a of actors) a.update(dt)
    fx.update(dt)
    // камера следует за героем
    r.camX += (hero.x + 120 - r.camX) * Math.min(1, dt * 5)
    r.camY += (hero.y - 70 - r.camY) * Math.min(1, dt * 5)
  }

  const render = () => {
    r.begin([0, 0, 0])
    const [vw, vh] = r.viewSize()
    // звёзды (медленный параллакс)
    const sx = r.camX * 0.85, sy = r.camY * 0.85
    r.quad(stars, 'add', r.camX - vw / 2, r.camY - vh / 2, vw, vh, (r.camX - sx - vw / 2) / 1024, (r.camY - sy - vh / 2) / 1024, (r.camX - sx + vw / 2) / 1024, (r.camY - sy + vh / 2) / 1024)
    // пол
    for (const [k, f] of g.floorOf) {
      const [x, y] = k.split(',').map(Number)
      r.quad(floors[f], 'lit', x * TILE.x, y * TILE.y, TILE.x, TILE.y)
    }
    // пятна света на полу (мягкое свечение у источников)
    for (const l of lights) {
      if (l.energy <= 0.05) continue
      const rr = l.r * 0.55
      r.quad(glow, 'add', l.x - rr, l.y - rr * 0.7, rr * 2, rr * 1.4, 0, 0, 1, 1, [l.color[0], l.color[1], l.color[2], 0.10 * l.energy])
    }
    // стены, персонажи, турель — по высоте экрана; частицы — поверх
    world.sort((a, b) => a.y - b.y)
    for (const d of world) d.draw(r)
    r.flush()
    frames++
    const st = document.getElementById('stats')
    if (st) st.textContent = `Nova 2.5D · WebGL2 · вызовов ${r.drawCalls} · частиц ${fx.parts.length}`
  }

  r.zoom = 1.0
  r.camX = hero.x + 120
  r.camY = hero.y - 70
  if (shot) {
    // для снимка: ровно 0.35 с игры — заряды в полёте, искры у цели
    for (let i = 0; i < 21; i++) step(1 / 60)
    render()
    ;(window as any).__ready = true
    return
  }
  let last = performance.now()
  const loop = (now: number) => {
    step(Math.min(0.05, (now - last) / 1000))
    last = now
    render()
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
  ;(window as any).__ready = true
}

main().catch((e) => {
  document.body.insertAdjacentHTML('beforeend', `<pre style="color:#f66;position:fixed;top:0;left:0">${e}</pre>`)
  ;(window as any).__ready = true
})
