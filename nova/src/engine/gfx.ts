// Nova 2.5D — отрисовка на WebGL2.
// Спрайты собираются в пакеты (один вызов отрисовки на подряд идущие спрайты с одной текстурой).
// Освещённые спрайты: цвет × (окружение + Σ точечных источников), направление света берётся из карты
// нормалей (RGB = n·0.5+0.5, Y вверх по экрану) — тот же формат, что у запечённых атласов «Дрейфа».
// Аддитивный режим — вспышки, заряды, звёзды: цвета складываются, свет на них не влияет.

export interface Tex { tex: WebGLTexture; w: number; h: number }
export interface Mat { diffuse: Tex; normal: Tex | null }
export interface Light { x: number; y: number; h: number; r: number; color: [number, number, number]; energy: number }

const MAX_QUADS = 6000
const MAX_LIGHTS = 16
const FLOATS = 8 // x, y, u, v, r, g, b, a

const VS = `#version 300 es
in vec2 a_pos; in vec2 a_uv; in vec4 a_col;
uniform vec2 u_cam; uniform float u_zoom; uniform vec2 u_view;
out vec2 v_uv; out vec4 v_col; out vec2 v_world;
void main() {
  vec2 p = (a_pos - u_cam) * u_zoom / (u_view * 0.5);
  gl_Position = vec4(p.x, -p.y, 0.0, 1.0);
  v_uv = a_uv; v_col = a_col; v_world = a_pos;
}`

const FS_LIT = `#version 300 es
precision mediump float;
in vec2 v_uv; in vec4 v_col; in vec2 v_world;
uniform sampler2D u_tex; uniform sampler2D u_nrm;
uniform vec3 u_amb; uniform int u_n;
uniform vec4 u_lp[${MAX_LIGHTS}]; uniform vec4 u_lc[${MAX_LIGHTS}];
out vec4 o;
void main() {
  vec4 b = texture(u_tex, v_uv) * v_col;
  if (b.a < 0.02) discard;
  vec3 n = normalize(texture(u_nrm, v_uv).rgb * 2.0 - 1.0);
  vec3 acc = u_amb;
  for (int i = 0; i < ${MAX_LIGHTS}; i++) {
    if (i >= u_n) break;
    vec2 d = u_lp[i].xy - v_world;
    float att = clamp(1.0 - length(d) / u_lp[i].w, 0.0, 1.0);
    att *= att;
    vec3 L = normalize(vec3(d.x, -d.y, u_lp[i].z));
    acc += u_lc[i].rgb * u_lc[i].a * (0.25 + 0.75 * max(dot(n, L), 0.0)) * att;
  }
  o = vec4(b.rgb * acc, b.a);
}`

const FS_ADD = `#version 300 es
precision mediump float;
in vec2 v_uv; in vec4 v_col; in vec2 v_world;
uniform sampler2D u_tex;
out vec4 o;
void main() {
  vec4 b = texture(u_tex, v_uv) * v_col;
  o = vec4(b.rgb * b.a, 0.0);
}`

function compile(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const mk = (type: number, src: string) => {
    const s = gl.createShader(type)!
    gl.shaderSource(s, src)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader')
    return s
  }
  const p = gl.createProgram()!
  gl.attachShader(p, mk(gl.VERTEX_SHADER, vs))
  gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs))
  gl.bindAttribLocation(p, 0, 'a_pos')
  gl.bindAttribLocation(p, 1, 'a_uv')
  gl.bindAttribLocation(p, 2, 'a_col')
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link')
  return p
}

export class Renderer {
  gl: WebGL2RenderingContext
  canvas: HTMLCanvasElement
  camX = 0
  camY = 0
  zoom = 1
  ambient: [number, number, number] = [0.32, 0.35, 0.42]
  lights: Light[] = []
  drawCalls = 0
  private lit: WebGLProgram
  private add: WebGLProgram
  private data = new Float32Array(MAX_QUADS * 4 * FLOATS)
  private n = 0
  private mat: Mat | null = null
  private mode: 'lit' | 'add' = 'lit'
  private flat: Tex
  private vbo: WebGLBuffer

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false })
    if (!gl) throw new Error('WebGL2 недоступен')
    this.gl = gl
    this.lit = compile(gl, VS, FS_LIT)
    this.add = compile(gl, VS, FS_ADD)
    const vao = gl.createVertexArray()
    gl.bindVertexArray(vao)
    this.vbo = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo)
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW)
    const st = FLOATS * 4
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, st, 0)
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, st, 8)
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, st, 16)
    const idx = new Uint16Array(MAX_QUADS * 6 > 65535 ? 0 : MAX_QUADS * 6)
    // индексы: 4 вершины на четырёхугольник (6000 × 4 < 65536)
    for (let i = 0; i < MAX_QUADS; i++) {
      idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6)
    }
    const ib = gl.createBuffer()
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW)
    this.flat = this.texFromPixels(1, 1, new Uint8Array([128, 128, 255, 255]))
    gl.enable(gl.BLEND)
  }

  texFromPixels(w: number, h: number, px: Uint8Array): Tex {
    const gl = this.gl
    const t = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, t)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, px)
    this.params(true)
    return { tex: t, w, h }
  }

  texFromSource(src: TexImageSource, w: number, h: number, repeat = false): Tex {
    const gl = this.gl
    const t = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, t)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src)
    this.params(repeat)
    return { tex: t, w, h }
  }

  private params(repeat: boolean) {
    const gl = this.gl
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    const w = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, w)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, w)
  }

  async load(url: string, repeat = false): Promise<Tex> {
    const img = new Image()
    img.src = url
    await img.decode()
    return this.texFromSource(img, img.width, img.height, repeat)
  }

  begin(clear: [number, number, number]) {
    const gl = this.gl
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = Math.floor(this.canvas.clientWidth * dpr)
    const h = Math.floor(this.canvas.clientHeight * dpr)
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w
      this.canvas.height = h
    }
    gl.viewport(0, 0, w, h)
    gl.clearColor(clear[0], clear[1], clear[2], 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    this.drawCalls = 0
    this.n = 0
    this.mat = null
  }

  /** ширина и высота экрана в пикселях мира */
  viewSize(): [number, number] {
    return [this.canvas.width / this.zoomPx(), this.canvas.height / this.zoomPx()]
  }

  private zoomPx(): number {
    return this.zoom * Math.min(window.devicePixelRatio || 1, 2)
  }

  /** четырёхугольник: x, y — левый верхний угол в пикселях мира; uv — доля текстуры */
  quad(m: Mat, mode: 'lit' | 'add', x: number, y: number, w: number, h: number,
    u0 = 0, v0 = 0, u1 = 1, v1 = 1, c: [number, number, number, number] = [1, 1, 1, 1]) {
    if (this.mat !== m || this.mode !== mode || this.n >= MAX_QUADS) {
      this.flush()
      this.mat = m
      this.mode = mode
    }
    const d = this.data
    let o = this.n * 4 * FLOATS
    const put = (px: number, py: number, u: number, v: number) => {
      d[o++] = px; d[o++] = py; d[o++] = u; d[o++] = v
      d[o++] = c[0]; d[o++] = c[1]; d[o++] = c[2]; d[o++] = c[3]
    }
    put(x, y, u0, v0)
    put(x + w, y, u1, v0)
    put(x + w, y + h, u1, v1)
    put(x, y + h, u0, v1)
    this.n++
  }

  flush() {
    if (this.n === 0 || !this.mat) return
    const gl = this.gl
    const p = this.mode === 'lit' ? this.lit : this.add
    gl.useProgram(p)
    const u = (name: string) => gl.getUniformLocation(p, name)
    gl.uniform2f(u('u_cam'), this.camX, this.camY)
    gl.uniform1f(u('u_zoom'), this.zoomPx())
    gl.uniform2f(u('u_view'), this.canvas.width, this.canvas.height)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.mat.diffuse.tex)
    gl.uniform1i(u('u_tex'), 0)
    if (this.mode === 'lit') {
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, (this.mat.normal || this.flat).tex)
      gl.uniform1i(u('u_nrm'), 1)
      gl.uniform3f(u('u_amb'), ...this.ambient)
      const ls = this.lights.slice(0, MAX_LIGHTS)
      const lp = new Float32Array(MAX_LIGHTS * 4)
      const lc = new Float32Array(MAX_LIGHTS * 4)
      ls.forEach((l, i) => {
        lp.set([l.x, l.y, l.h, l.r], i * 4)
        lc.set([l.color[0], l.color[1], l.color[2], l.energy], i * 4)
      })
      gl.uniform1i(u('u_n'), ls.length)
      gl.uniform4fv(u('u_lp'), lp)
      gl.uniform4fv(u('u_lc'), lc)
    } else {
      gl.blendFunc(gl.ONE, gl.ONE)
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data, 0, this.n * 4 * FLOATS)
    gl.drawElements(gl.TRIANGLES, this.n * 6, gl.UNSIGNED_SHORT, 0)
    this.drawCalls++
    this.n = 0
  }
}

/** картинка, нарисованная кодом (Canvas 2D) → текстура */
export function paint(r: Renderer, w: number, h: number, fn: (c: CanvasRenderingContext2D) => void, repeat = false): Tex {
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  fn(cv.getContext('2d')!)
  return r.texFromSource(cv, w, h, repeat)
}
