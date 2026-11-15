// Nova 2.5D — проекция, спрайты в 8 направлениях, мир из клеток, частицы, ввод.
import { Renderer, Mat, Tex, paint } from './gfx'

// ---------------- проекция ----------------
// 1 м = 64 px по горизонтали; глубина и высота сжаты в K (вид сверху под 45°): клетка 1×1 м = 64×45 px.
export const PPM = 64
export const K = 0.70710678
export const TILE = { x: 64, y: 45 }
export const WALL_H = 113
export const LOW = 40

export const cellCenter = (cx: number, cy: number) => ({ x: (cx + 0.5) * TILE.x, y: (cy + 0.5) * TILE.y })
export const toGround = (dx: number, dy: number) => ({ x: dx, y: dy / K })
/** индекс направления: 0 — к зрителю, дальше по часовой на экране (n = 8 или 16) */
export function dirIndex(dx: number, dy: number, n = 8): number {
  const g = toGround(dx, dy)
  const a = Math.atan2(-g.x, g.y)
  return ((Math.round(a / (Math.PI * 2 / n)) % n) + n) % n
}

// ---------------- рисуемое ----------------
export interface Drawable { y: number; draw(r: Renderer): void }

export interface SpriteInfo { anchor: [number, number]; frame_w: number; frame_h: number; dirs: number; fps: number
  clips: Record<string, { frames: number; loop: boolean; native_fps?: number; dirs?: number }> }

/** набор атласов персонажа: <папка>/<имя>.json + <клип>.png + <клип>_n.png */
export class SpriteSet {
  info!: SpriteInfo
  mats: Record<string, Mat> = {}
  static async load(r: Renderer, folder: string, clips: string[]): Promise<SpriteSet> {
    const s = new SpriteSet()
    const name = folder.split('/').pop()
    s.info = await (await fetch(`${folder}/${name}.json`)).json()
    for (const c of clips) {
      const [d, n] = await Promise.all([r.load(`${folder}/${c}.png`), r.load(`${folder}/${c}_n.png`)])
      s.mats[c] = { diffuse: d, normal: n }
    }
    return s
  }
}

/** персонаж или предмет со спрайтом: позиция — точка на полу (ноги) */
export class Actor implements Drawable {
  x = 0
  y = 0
  dir = 0
  clip = 'idle'
  t = 0
  lift = 0           // подъём над полом, px (дрон)
  tint: [number, number, number, number] = [1, 1, 1, 1]
  constructor(public set: SpriteSet) {}
  update(dt: number) { this.t += dt }
  draw(r: Renderer) {
    const ci = this.set.info.clips[this.clip]
    const m = this.set.mats[this.clip]
    if (!ci || !m) return
    const fw = this.set.info.frame_w, fh = this.set.info.frame_h
    const dirs = ci.dirs ?? this.set.info.dirs
    const fps = ci.loop && ci.native_fps ? ci.native_fps : this.set.info.fps
    let f = Math.floor(this.t * fps)
    f = ci.loop ? f % ci.frames : Math.min(f, ci.frames - 1)
    const d = dirs === 8 ? this.dir : Math.round(this.dir * dirs / 8) % dirs
    const [ax, ay] = this.set.info.anchor
    const tw = m.diffuse.w, th = m.diffuse.h
    const u0 = (f * fw) / tw, v0 = (d * fh) / th
    // тень
    r.quad(shadowMat(r), 'lit', this.x - 22, this.y - 8, 44, 16, 0, 0, 1, 1, [0, 0, 0, 0.45])
    r.quad(m, 'lit', this.x - ax, this.y - ay - this.lift, fw, fh, u0, v0, u0 + fw / tw, v0 + fh / th, this.tint)
  }
}

let _shadow: Mat | null = null
function shadowMat(r: Renderer): Mat {
  if (!_shadow) {
    _shadow = { diffuse: paint(r, 64, 32, (c) => {
      const g = c.createRadialGradient(32, 16, 2, 32, 16, 30)
      g.addColorStop(0, 'rgba(255,255,255,0.9)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      c.fillStyle = g
      c.scale(1, 0.5)
      c.fillRect(0, 0, 64, 64)
    }), normal: null }
  }
  return _shadow
}

// ---------------- мир из клеток ----------------
export type Cell = 'floor' | 'wall' | 'door'

export interface Room { x: number; y: number; w: number; h: number; floor: string }

/** корабль: отсеки → клетки пола, стены по краю, двери; пол и стены рисуются тайлами с картами нормалей */
export class Grid {
  cells = new Map<string, Cell>()
  floorOf = new Map<string, string>()
  key = (x: number, y: number) => `${x},${y}`
  get = (x: number, y: number): Cell | undefined => this.cells.get(this.key(x, y))

  addRoom(r: Room) {
    for (let x = r.x; x < r.x + r.w; x++) for (let y = r.y; y < r.y + r.h; y++) {
      this.cells.set(this.key(x, y), 'floor')
      this.floorOf.set(this.key(x, y), r.floor)
    }
  }

  buildWalls(doors: [number, number][]) {
    for (const k of [...this.cells.keys()]) {
      const [x, y] = k.split(',').map(Number)
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        if (!this.cells.has(this.key(x + dx, y + dy))) this.cells.set(this.key(x + dx, y + dy), 'wall')
      }
    }
    for (const [x, y] of doors) {
      this.cells.set(this.key(x, y), 'door')
      this.floorOf.set(this.key(x, y), 'floor_hazard_s')
    }
  }

  solid(px: number, py: number): boolean {
    const c = this.get(Math.floor(px / TILE.x), Math.floor(py / TILE.y))
    return c === undefined || c === 'wall'
  }
}

/** стена: верх (тёмный металл) и лицевая сторона; высокая — внешний борт, низкая — в разрезе */
export class WallPiece implements Drawable {
  constructor(public cx: number, public cy: number, public tall: boolean, public face: boolean,
    public faceMat: Mat, public capMat: Mat) {}
  get y() { return (this.cy + 1) * TILE.y }
  draw(r: Renderer) {
    const x = this.cx * TILE.x
    const base = (this.cy + 1) * TILE.y
    const h = this.tall ? WALL_H : LOW
    r.quad(this.capMat, 'lit', x, this.cy * TILE.y - h, TILE.x, TILE.y)
    if (this.face) {
      const v0 = this.tall ? 0 : (WALL_H - LOW) / WALL_H
      r.quad(this.faceMat, 'lit', x, base - h, TILE.x, h, 0, v0, 1, 1)
    }
  }
}

// ---------------- частицы ----------------
export interface Part { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number
  col: [number, number, number]; kind: 'glow' | 'spark' | 'bolt'; len?: number }

export class Particles implements Drawable {
  parts: Part[] = []
  y = 1e9            // поверх всего
  onEnd: ((p: Part) => void) | null = null   // заряд долетел (попадание)
  constructor(public glow: Mat) {}
  add(p: Part) { if (this.parts.length < 800) this.parts.push(p) }
  update(dt: number) {
    for (const p of this.parts) {
      p.life -= dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      if (p.kind === 'spark') p.vy += 500 * dt
    }
    for (const p of this.parts) if (p.life <= 0 && p.kind === 'bolt' && this.onEnd) this.onEnd(p)
    this.parts = this.parts.filter((p) => p.life > 0)
  }
  draw(r: Renderer) {
    for (const p of this.parts) {
      const k = Math.max(0, p.life / p.max)
      if (p.kind === 'bolt') {
        // заряд: вытянутое свечение вдоль скорости
        const len = p.len ?? 26
        const sp = Math.hypot(p.vx, p.vy) || 1
        const nx = p.vx / sp, ny = p.vy / sp
        for (let i = 0; i < 5; i++) {
          const s = p.size * (1 - i * 0.15)
          r.quad(this.glow, 'add', p.x - nx * i * len / 5 - s, p.y - ny * i * len / 5 - s, s * 2, s * 2, 0, 0, 1, 1, [...p.col, 0.9 - i * 0.15])
        }
        r.quad(this.glow, 'add', p.x - p.size * 0.5, p.y - p.size * 0.5, p.size, p.size, 0, 0, 1, 1, [1, 1, 1, 1])
      } else {
        const s = p.size * (p.kind === 'glow' ? 1 + (1 - k) * 0.6 : 1)
        r.quad(this.glow, 'add', p.x - s, p.y - s, s * 2, s * 2, 0, 0, 1, 1, [...p.col, k])
      }
    }
  }
}

export function glowTex(r: Renderer): Tex {
  return paint(r, 64, 64, (c) => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.25, 'rgba(255,255,255,0.55)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    c.fillStyle = g
    c.fillRect(0, 0, 64, 64)
  })
}

// ---------------- ввод ----------------
export class Input {
  keys = new Set<string>()
  joy = { x: 0, y: 0 }
  constructor() {
    addEventListener('keydown', (e) => this.keys.add(e.code))
    addEventListener('keyup', (e) => this.keys.delete(e.code))
  }
  move(): { x: number; y: number } {
    let x = this.joy.x, y = this.joy.y
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y -= 1
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y += 1
    const l = Math.hypot(x, y)
    return l > 1 ? { x: x / l, y: y / l } : { x, y }
  }
}
