// Движок: рендерер WebGL2.
// Проходы: карта теней солнца → непрозрачная геометрия (земля, мир, растительность, персонажи) → аддитивные эффекты.
import { V3, mat4, frustumPlanes, sphereInFrustum } from './math.js';
import { VS, DEPTH_VS, DEPTH_FS, FS_WORLD, FS_GROUND, FS_FOLIAGE, FS_CHAR, FX_VS, FX_FS, FS_TERRAIN, FS_GHOST } from './shaders.js';

const FS_BY_KIND = { world: FS_WORLD, ground: FS_GROUND, foliage: FS_FOLIAGE, char: FS_CHAR, terrain: FS_TERRAIN, ghost: FS_GHOST };

export class RenderObject {
  constructor(mesh, kind = 'world') {
    this.mesh = mesh; this.kind = kind; this.model = mat4.ident(); this.visible = true; this.shadow = true;
    this.bones = null; this.hit = 0; this.tint = [1, 1, 1]; this.maxDist = Infinity; this.cutout = kind === 'world' || kind === 'foliage';
    this.wc = new V3(); this.wr = mesh ? mesh.radius : 1; this.dynamicBounds = false; this.updateBounds();
  }
  setXf(xf) { xf.toMat4(this.model); this.updateBounds(); }
  updateBounds() {
    if (!this.mesh) return;
    this.wc = mat4.xformPoint(this.model, this.mesh.center);
    const m = this.model; this.wr = this.mesh.radius * Math.max(Math.hypot(m[0], m[1], m[2]), Math.hypot(m[4], m[5], m[6]), Math.hypot(m[8], m[9], m[10]));
  }
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true, alpha: false });
    if (!gl) throw new Error('WebGL2 не поддерживается этим устройством/браузером');
    this.gl = gl;
    this.programs = new Map();
    this.objects = [];
    this.instanced = [];
    this.lights = [];
    this.renderScale = 1;
    this.shadowSize = 2048;
    this.shadowsOn = true;
    this.shadowDist = 40;
    this.fogStart = 45; this.fogEnd = 160;
    this.env = { sunDir: new V3(0.3, 0.8, 0.4).norm(), sunCol: [1.2, 1.15, 1.05], sky: [0.45, 0.5, 0.58], ground: [0.28, 0.26, 0.22], fog: [0.62, 0.63, 0.6], clear: [0.62, 0.63, 0.6] };
    this.uniforms = { power: 0, time: 0, detail: 1, playerPos: new V3() };
    this.grade = [0.78, 1.05, 1.0, 0.0];
    this.stats = { drawCalls: 0, tris: 0 };
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.frontFace(gl.CCW);
    this._initShadow();
    this._initFx();
    this.noiseTex = null; this.detailTex = null; this.splatTex = null;
    this._camRight = new V3(1, 0, 0); this._camUp = new V3(0, 1, 0); this.camPos = new V3(0, 20, 20);
  }
  setCamera(cam) { this.camPos = cam.pos; this._camRight = cam.right; this._camUp = cam.up; }

  // ------------------------------------------------------------------ ресурсы
  program(kind, defines = []) {
    const key = kind + '|' + defines.join(',');
    if (this.programs.has(key)) return this.programs.get(key);
    const gl = this.gl;
    const pre = defines.map((d) => '#define ' + d.replace('=', ' ')).join('\n') + '\n';
    let vs, fs;
    if (kind === 'depth') { vs = DEPTH_VS; fs = DEPTH_FS; }
    else if (kind === 'fx') { vs = FX_VS; fs = FX_FS; }
    else { vs = VS; fs = FS_BY_KIND[kind]; }
    const inject = (src) => src.replace('#version 300 es\n', '#version 300 es\n' + pre);
    const sh = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, inject(src)); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('Шейдер ' + key + ': ' + gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Программа ' + key + ': ' + gl.getProgramInfoLog(p));
    const loc = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); const name = info.name.replace('[0]', ''); loc[name] = gl.getUniformLocation(p, info.name); }
    const prog = { p, loc };
    this.programs.set(key, prog);
    return prog;
  }

  createMesh(d) {
    const gl = this.gl;
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const buf = (data, loc, size, type, norm, integer = false) => {
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc);
      if (integer) gl.vertexAttribIPointer(loc, size, type, 0, 0); else gl.vertexAttribPointer(loc, size, type, norm, 0, 0);
      return b;
    };
    buf(d.pos, 0, 3, gl.FLOAT, false); buf(d.nrm, 1, 3, gl.FLOAT, false); buf(d.col, 2, 4, gl.UNSIGNED_BYTE, true);
    if (d.bones) { buf(d.bones, 3, 4, d.bones instanceof Uint16Array ? gl.UNSIGNED_SHORT : gl.UNSIGNED_BYTE, false, true); buf(d.weights, 4, 4, gl.UNSIGNED_BYTE, true); }
    if (d.uv) buf(d.uv, 6, 2, gl.FLOAT, false);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, d.idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao, count: d.count, skinned: !!d.bones, uv: !!d.uv, center: d.center, radius: d.radius, tris: d.count / 3 };
  }

  createInstanced(d, inst, kind = 'foliage') {
    // inst: Float32Array [x, z, rot, scale] × n
    const mesh = this.createMesh(d);
    const gl = this.gl;
    gl.bindVertexArray(mesh.vao);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, inst, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(5); gl.vertexAttribPointer(5, 4, gl.FLOAT, false, 0, 0); gl.vertexAttribDivisor(5, 1);
    gl.bindVertexArray(null);
    let cx = 0, cz = 0; const n = inst.length / 4;
    for (let i = 0; i < n; i++) { cx += inst[i * 4]; cz += inst[i * 4 + 1]; }
    cx /= Math.max(n, 1); cz /= Math.max(n, 1);
    let r = 0; for (let i = 0; i < n; i++) r = Math.max(r, Math.hypot(inst[i * 4] - cx, inst[i * 4 + 1] - cz));
    const o = { mesh, kind, n, visibleCount: n, wc: new V3(cx, 0.5, cz), wr: r + 2, maxDist: Infinity, visible: true };
    this.instanced.push(o);
    return o;
  }

  texture(data, w, h, { format = 'rgba', mip = true, repeat = true } = {}) {
    const gl = this.gl;
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    if (format === 'r') gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, w, h, 0, gl.RED, gl.UNSIGNED_BYTE, data);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    const wrap = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    if (mip) gl.generateMipmap(gl.TEXTURE_2D);
    return t;
  }

  // текстура из картинки (GLB): sRGB-данные как есть, мип-карты
  textureImage(img, repeat = true) {
    const gl = this.gl, t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, img);
    const wrap = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);
    return t;
  }
  // матрицы костей скелета GLB: RGBA32F, 4 текселя на кость
  boneTexture(n) {
    const gl = this.gl, t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 4, n, 0, gl.RGBA, gl.FLOAT, null);
    for (const k of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, k, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return { tex: t, n, data: new Float32Array(n * 16), dirty: true, frame: -1 };
  }
  add(obj) { this.objects.push(obj); return obj; }
  remove(obj) { const i = this.objects.indexOf(obj); if (i >= 0) this.objects.splice(i, 1); }
  clear() { this.objects = []; this.instanced = []; this.lights = []; }

  // ------------------------------------------------------------------ тени
  _initShadow() {
    const gl = this.gl;
    this.shadowTex = gl.createTexture();
    this._allocShadow(this.shadowSize);
    this.shadowFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shadowTex, 0);
    gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.shadowMat = mat4.ident();
  }
  _allocShadow(size) {
    const gl = this.gl; this.shadowSize = size;
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, size, size, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
  }
  setShadowSize(s) { if (s !== this.shadowSize) this._allocShadow(s); }

  // ------------------------------------------------------------------ эффекты
  _initFx() {
    const gl = this.gl;
    this.fxMax = 3000; // квадратов
    this.fxData = new Float32Array(this.fxMax * 6 * 9);
    this.fxCount = 0;
    this.fxVao = gl.createVertexArray(); gl.bindVertexArray(this.fxVao);
    this.fxBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.fxBuf); gl.bufferData(gl.ARRAY_BUFFER, this.fxData.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 36, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 36, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 36, 20);
    gl.bindVertexArray(null);
  }
  // Квадрат из 4 точек; uv: если solid — сплошной (трассер), иначе круглое пятно
  fxQuad(a, b, c, d, color, solid = false) {
    if (this.fxCount >= this.fxMax) return;
    const u0 = solid ? -1 : 0, u1 = solid ? -1 : 1;
    const v = [[a, u0, 0], [b, u1, 0], [c, u1, 1], [a, u0, 0], [c, u1, 1], [d, u0, 1]];
    let o = this.fxCount * 54;
    for (const [p, u, w] of v) { const f = this.fxData; f[o++] = p.x; f[o++] = p.y; f[o++] = p.z; f[o++] = u; f[o++] = w; f[o++] = color[0]; f[o++] = color[1]; f[o++] = color[2]; f[o++] = color[3]; }
    this.fxCount++;
  }
  fxBillboard(p, size, color) {
    const r = this._camRight.mul(size * 0.5), u = this._camUp.mul(size * 0.5);
    this.fxQuad(p.sub(r).sub(u), p.add(r).sub(u), p.add(r).add(u), p.sub(r).add(u), color);
  }
  fxLine(a, b, width, color) {
    const d = b.sub(a), view = a.sub(this.camPos);
    let s = d.cross(view).norm().mul(width * 0.5);
    this.fxQuad(a.sub(s), b.sub(s), b.add(s), a.add(s), color, true);
  }
  fxGround(p, size, color) {
    const h = size * 0.5, y = p.y + 0.05;
    this.fxQuad(new V3(p.x - h, y, p.z - h), new V3(p.x - h, y, p.z + h), new V3(p.x + h, y, p.z + h), new V3(p.x + h, y, p.z - h), color);
  }

  // ------------------------------------------------------------------ кадр
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr || 2);
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr * this.renderScale));
    const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr * this.renderScale));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
  }

  _common(prog, viewProj) {
    const gl = this.gl, L = prog.loc, e = this.env, u = this.uniforms;
    gl.uniformMatrix4fv(L.uViewProj, false, viewProj);
    if (L.uShadowMat) gl.uniformMatrix4fv(L.uShadowMat, false, this.shadowMat);
    if (L.uTime) gl.uniform1f(L.uTime, u.time);
    if (!L.uCamPos) return;
    gl.uniform3f(L.uCamPos, this.camPos.x, this.camPos.y, this.camPos.z);
    gl.uniform3f(L.uSunDir, e.sunDir.x, e.sunDir.y, e.sunDir.z);
    gl.uniform3fv(L.uSunCol, e.sunCol); gl.uniform3fv(L.uSkyCol, e.sky); gl.uniform3fv(L.uGroundCol, e.ground); gl.uniform3fv(L.uFogCol, e.fog);
    gl.uniform2f(L.uFog, this.fogStart, this.fogEnd);
    gl.uniform1f(L.uShadowOn, this.shadowsOn ? 1 : 0);
    gl.uniform1f(L.uShadowTexel, 1 / this.shadowSize);
    gl.uniform1f(L.uDetailLevel, u.detail);
    gl.uniform3f(L.uPlayerPos, u.playerPos.x, u.playerPos.y, u.playerPos.z);
    gl.uniform1f(L.uPower, u.power);
    if (L.uGrade) gl.uniform4fv(L.uGrade, this.grade);
    gl.uniform1i(L.uNumLights, this._lightN);
    if (this._lightN) { gl.uniform4fv(L.uLights, this._lightPos); gl.uniform4fv(L.uLightCols, this._lightCol); }
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.shadowTex); gl.uniform1i(L.uShadowMap, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.noiseTex); gl.uniform1i(L.uNoise, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.detailTex); gl.uniform1i(L.uDetail, 2);
    if (L.uSplat) { gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.splatTex); gl.uniform1i(L.uSplat, 3); }
  }

  _defines(o, depth = false) {
    const d = [];
    if (o.mesh.skinned) d.push('SKINNED');
    if (o.mesh.skinned && o.boneTex) d.push('BONETEX');
    if (!depth && o.mesh.uv && o.tex) d.push('TEXTURED');
    if (o.clipY != null) d.push('CLIPY');
    if (o.instanced) d.push('INSTANCED');
    if (!depth && o.kind === 'foliage') d.push(o.instanced ? 'SWAY=0.5' : 'SWAY=0.06');
    if (depth && o.kind === 'foliage' && !o.instanced) d.push('SWAY=0.06');
    return d;
  }

  render(cam) {
    const gl = this.gl;
    this.resize();
    this.camPos = cam.pos;
    this._camRight = cam.right; this._camUp = cam.up;
    const viewProj = mat4.mul(cam.proj, cam.view);
    const planes = frustumPlanes(viewProj);
    this.stats.drawCalls = 0; this.stats.tris = 0;
    // точечные источники: ближайшие к фокусу камеры
    const focus = cam.focus || cam.pos;
    const ls = this.lights.filter((l) => l.on !== false && l.energy > 0.01).map((l) => [l, l.pos.distSq(focus)]).sort((a, b) => a[1] - b[1]).slice(0, 8);
    this._lightN = ls.length; this._lightPos = new Float32Array(32); this._lightCol = new Float32Array(32);
    ls.forEach(([l], i) => { this._lightPos.set([l.pos.x, l.pos.y, l.pos.z, l.range], i * 4); this._lightCol.set([l.color[0], l.color[1], l.color[2], l.energy], i * 4); });
    // видимые объекты
    const vis = [];
    for (const o of this.objects) {
      if (!o.visible || !o.mesh) continue;
      if (o.dynamicBounds) o.updateBounds();
      const d = o.wc.dist(cam.pos);
      if (d - o.wr > o.maxDist) continue;
      if (!sphereInFrustum(planes, o.wc.x, o.wc.y, o.wc.z, o.wr)) continue;
      vis.push(o);
    }
    const ivis = this.instanced.filter((o) => o.visible && o.visibleCount > 0 && o.wc.dist(cam.pos) - o.wr < o.maxDist && sphereInFrustum(planes, o.wc.x, o.wc.y, o.wc.z, o.wr));
    // ---- тени
    if (this.shadowsOn) {
      const sd = this.shadowDist, sun = this.env.sunDir;
      const center = focus.clone();
      const lv = mat4.lookAt(center.add(sun.mul(120)), center, Math.abs(sun.y) > 0.98 ? new V3(0, 0, 1) : new V3(0, 1, 0));
      // привязка к текселям — без «дрожания» теней
      const texel = (2 * sd) / this.shadowSize;
      const cs = mat4.xformPoint(lv, center);
      const ox = cs.x - Math.round(cs.x / texel) * texel, oy = cs.y - Math.round(cs.y / texel) * texel;
      const lp = mat4.ortho(-sd + ox, sd + ox, -sd + oy, sd + oy, 1, 260);
      const lvp = mat4.mul(lp, lv);
      this.shadowMat = lvp; // в NDC света; шейдер сам переводит в [0..1]
      const sp = frustumPlanes(lvp);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
      gl.viewport(0, 0, this.shadowSize, this.shadowSize);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.cullFace(gl.FRONT);
      gl.colorMask(false, false, false, false);
      for (const o of this.objects) {
        if (!o.visible || !o.shadow || !o.mesh) continue;
        if (!sphereInFrustum(sp, o.wc.x, o.wc.y, o.wc.z, o.wr)) continue;
        if (o.wc.dist(cam.pos) - o.wr > o.maxDist) continue;
        const prog = this.program('depth', this._defines(o, true));
        gl.useProgram(prog.p);
        gl.uniformMatrix4fv(prog.loc.uViewProj, false, lvp);
        if (prog.loc.uTime) gl.uniform1f(prog.loc.uTime, this.uniforms.time);
        this._draw(prog, o);
      }
      gl.colorMask(true, true, true, true);
      gl.cullFace(gl.BACK);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    // ---- основной проход
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    const c = this.env.clear;
    gl.clearColor(Math.pow(c[0], 1 / 2.2), Math.pow(c[1], 1 / 2.2), Math.pow(c[2], 1 / 2.2), 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const order = { ground: 0, terrain: 0, world: 1, foliage: 2, char: 3, ghost: 4 };
    vis.sort((a, b) => order[a.kind] - order[b.kind] || (a.mesh.skinned - b.mesh.skinned));
    let cur = null;
    for (const o of vis) {
      const prog = this.program(o.kind, this._defines(o));
      if (prog !== cur) { gl.useProgram(prog.p); this._common(prog, viewProj); cur = prog; }
      if (o.kind === 'foliage' || o.doubleSided || o.kind === 'ghost') gl.disable(gl.CULL_FACE); else gl.enable(gl.CULL_FACE);
      if (o.kind === 'ghost') { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); }
      if (prog.loc.uCutout) gl.uniform1f(prog.loc.uCutout, o.cutout ? 1 : 0);
      if (prog.loc.uHitFlash) gl.uniform1f(prog.loc.uHitFlash, o.hit || 0);
      if (prog.loc.uTint) gl.uniform3fv(prog.loc.uTint, o.tint);
      this._draw(prog, o);
      if (o.kind === 'ghost') { gl.disable(gl.BLEND); gl.depthMask(true); }
    }
    gl.disable(gl.CULL_FACE);
    for (const o of ivis) {
      const prog = this.program('foliage', ['INSTANCED', 'SWAY=0.5']);
      gl.useProgram(prog.p); this._common(prog, viewProj); cur = prog;
      gl.uniformMatrix4fv(prog.loc.uModel, false, mat4.ident());
      if (prog.loc.uCutout) gl.uniform1f(prog.loc.uCutout, 0);
      gl.bindVertexArray(o.mesh.vao);
      gl.drawElementsInstanced(gl.TRIANGLES, o.mesh.count, gl.UNSIGNED_INT, 0, o.visibleCount);
      this.stats.drawCalls++; this.stats.tris += o.mesh.tris * o.visibleCount;
    }
    gl.enable(gl.CULL_FACE);
    // ---- эффекты
    if (this.fxCount > 0) {
      const prog = this.program('fx');
      gl.useProgram(prog.p);
      gl.uniformMatrix4fv(prog.loc.uViewProj, false, viewProj);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.disable(gl.CULL_FACE);
      gl.bindVertexArray(this.fxVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.fxBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.fxData, 0, this.fxCount * 54);
      gl.drawArrays(gl.TRIANGLES, 0, this.fxCount * 6);
      this.stats.drawCalls++;
      gl.depthMask(true); gl.disable(gl.BLEND); gl.enable(gl.CULL_FACE);
    }
    this.fxCount = 0;
    gl.bindVertexArray(null);
  }

  _draw(prog, o) {
    const gl = this.gl;
    gl.uniformMatrix4fv(prog.loc.uModel, false, o.model);
    if (o.mesh.skinned && o.boneTex) {
      const bt = o.boneTex; gl.activeTexture(gl.TEXTURE6); gl.bindTexture(gl.TEXTURE_2D, bt.tex);
      if (bt.dirty) { gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 4, bt.n, gl.RGBA, gl.FLOAT, bt.data); bt.dirty = false; }
      gl.uniform1i(prog.loc.uBoneTex, 6);
    } else if (o.mesh.skinned && o.bones) gl.uniformMatrix4fv(prog.loc.uBones, false, o.bones);
    if (o.tex && prog.loc.uAlbedo) { gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, o.tex); gl.uniform1i(prog.loc.uAlbedo, 5); }
    if (o.clipY != null && prog.loc.uClipY) gl.uniform1f(prog.loc.uClipY, o.clipY);
    gl.bindVertexArray(o.mesh.vao);
    gl.drawElements(gl.TRIANGLES, o.mesh.count, gl.UNSIGNED_INT, 0);
    this.stats.drawCalls++; this.stats.tris += o.mesh.tris;
  }
}
