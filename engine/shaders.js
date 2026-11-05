// Движок «Долг»: шейдеры GLSL ES 3.00. Варианты собираются из флагов (#define).

const COMMON_VS = `
uniform mat4 uViewProj;
uniform mat4 uModel;
uniform mat4 uShadowMat;
uniform float uTime;
#ifdef SKINNED
uniform mat4 uBones[20];
layout(location=3) in uvec4 aBones;
layout(location=4) in vec4 aWeights;
#endif
#ifdef INSTANCED
layout(location=5) in vec4 aInst; // x, z, поворот, масштаб
#endif
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=2) in vec4 aCol;
`;

export const VS = `#version 300 es
precision highp float;
${COMMON_VS}
out vec3 vWorld;
out vec3 vNrm;
out vec4 vCol;
out vec3 vLocal;
out vec4 vShadow;
void main() {
  vec4 p = vec4(aPos, 1.0);
  vec3 n = aNrm;
#ifdef SKINNED
  mat4 sk = uBones[aBones.x] * aWeights.x + uBones[aBones.y] * aWeights.y + uBones[aBones.z] * aWeights.z + uBones[aBones.w] * aWeights.w;
  p = sk * p;
  n = mat3(sk) * n;
#endif
  vLocal = aPos;
  vec4 w = uModel * p;
  vec3 wn = mat3(uModel) * n;
#ifdef INSTANCED
  float c = cos(aInst.z), s = sin(aInst.z);
  vec3 lp = aPos * aInst.w;
  w = vec4(c * lp.x + s * lp.z + aInst.x, lp.y, -s * lp.x + c * lp.z + aInst.y, 1.0);
  wn = vec3(c * n.x + s * n.z, n.y, -s * n.x + c * n.z);
#endif
#ifdef SWAY
  float h = max(aPos.y, 0.0);
  vec3 o = (uModel * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
#ifdef INSTANCED
  o = vec3(aInst.x, 0.0, aInst.y);
  h *= aInst.w;
#endif
  float ph = o.x * 0.37 + o.z * 0.23 + w.x * 0.05;
  float k = SWAY * h * h * 0.15;
  w.x += sin(uTime * 1.7 + ph) * k;
  w.z += cos(uTime * 1.3 + ph * 1.3) * k * 0.6;
#endif
  vWorld = w.xyz;
  vNrm = normalize(wn);
  vCol = aCol;
  vShadow = uShadowMat * w;
  gl_Position = uViewProj * w;
}`;

export const DEPTH_VS = `#version 300 es
precision highp float;
${COMMON_VS}
void main() {
  vec4 p = vec4(aPos, 1.0);
#ifdef SKINNED
  mat4 sk = uBones[aBones.x] * aWeights.x + uBones[aBones.y] * aWeights.y + uBones[aBones.z] * aWeights.z + uBones[aBones.w] * aWeights.w;
  p = sk * p;
#endif
  vec4 w = uModel * p;
#ifdef INSTANCED
  float c = cos(aInst.z), s = sin(aInst.z);
  vec3 lp = aPos * aInst.w;
  w = vec4(c * lp.x + s * lp.z + aInst.x, lp.y, -s * lp.x + c * lp.z + aInst.y, 1.0);
#endif
  gl_Position = uViewProj * w;
}`;

export const DEPTH_FS = `#version 300 es
precision mediump float;
out vec4 o;
void main() { o = vec4(1.0); }`;

const LIGHTING = `
uniform vec3 uCamPos;
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform vec3 uSkyCol;
uniform vec3 uGroundCol;
uniform vec3 uFogCol;
uniform vec2 uFog;
uniform float uShadowOn;
uniform highp sampler2DShadow uShadowMap;
uniform float uShadowTexel;
uniform vec4 uLights[8];
uniform vec4 uLightCols[8];
uniform int uNumLights;
uniform sampler2D uNoise;
uniform sampler2D uDetail;
uniform float uDetailLevel;
uniform vec3 uPlayerPos;
uniform float uCutout;
uniform float uPower;
uniform vec4 uGrade; // x — насыщенность, y — контраст, z — экспозиция, w — тёплый/холодный сдвиг
uniform float uTime;
in vec3 vWorld;
in vec3 vNrm;
in vec4 vCol;
in vec3 vLocal;
in vec4 vShadow;
out vec4 outColor;

float shadowAt(vec3 n) {
  if (uShadowOn < 0.5) return 1.0;
  vec3 s = vShadow.xyz / vShadow.w * 0.5 + 0.5;
  if (s.x < 0.0 || s.x > 1.0 || s.y < 0.0 || s.y > 1.0 || s.z > 1.0) return 1.0;
  float bias = 0.0015 + 0.002 * (1.0 - max(dot(n, uSunDir), 0.0));
  float z = s.z - bias;
  float t = uShadowTexel;
  float r = texture(uShadowMap, vec3(s.xy + vec2(-t, -t) * 0.6, z));
  r += texture(uShadowMap, vec3(s.xy + vec2(t, -t) * 0.6, z));
  r += texture(uShadowMap, vec3(s.xy + vec2(-t, t) * 0.6, z));
  r += texture(uShadowMap, vec3(s.xy + vec2(t, t) * 0.6, z));
  return r * 0.25;
}

vec3 shade(vec3 albedo, vec3 n, float rough, float metal, float shadow) {
  vec3 v = normalize(uCamPos - vWorld);
  float ndl = max(dot(n, uSunDir), 0.0);
  vec3 h = normalize(uSunDir + v);
  float gloss = mix(48.0, 4.0, rough);
  float spec = pow(max(dot(n, h), 0.0), gloss) * (1.0 - rough) * 0.6;
  vec3 amb = mix(uGroundCol, uSkyCol, n.y * 0.5 + 0.5);
  vec3 c = albedo * (amb + uSunCol * ndl * shadow) + uSunCol * spec * shadow * mix(0.25, 1.0, metal);
  for (int i = 0; i < 8; i++) {
    if (i >= uNumLights) break;
    vec3 L = uLights[i].xyz - vWorld;
    float d = length(L);
    float att = clamp(1.0 - d / uLights[i].w, 0.0, 1.0);
    att *= att;
    c += albedo * uLightCols[i].rgb * uLightCols[i].a * att * (max(dot(n, L / max(d, 0.001)), 0.0) * 0.8 + 0.2);
  }
  return c;
}

vec3 finish(vec3 c) {
  float d = distance(uCamPos, vWorld);
  c = mix(c, uFogCol, smoothstep(uFog.x, uFog.y, d) * 0.85);
  c *= uGrade.z;
  c = c * (2.51 * c + 0.03) / (c * (2.43 * c + 0.59) + 0.14);
  c = clamp(c, 0.0, 1.0);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uGrade.x);
  c = (c - 0.5) * uGrade.y + 0.5 + vec3(uGrade.w, uGrade.w * 0.4, -uGrade.w) * 0.5;
  return pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2));
}

float triTex(sampler2D t, vec3 p, vec3 n, float s) {
  vec3 b = abs(n);
  b /= (b.x + b.y + b.z + 0.0001);
  return texture(t, p.zy * s).r * b.x + texture(t, p.xz * s).r * b.y + texture(t, p.xy * s).r * b.z;
}

void cutoutTest() {
  if (uCutout < 0.5 || vWorld.y < 0.4) return;
  vec3 tp = uPlayerPos + vec3(0.0, 1.0, 0.0) - uCamPos;
  float dp = length(tp);
  vec3 dir = tp / max(dp, 0.001);
  vec3 tf = vWorld - uCamPos;
  float t = dot(tf, dir);
  if (t < dp - 0.8) {
    float perp = length(tf - dir * t);
    float rad = 3.4 * clamp(t / dp, 0.0, 1.0) + 0.2;
    float fade = 1.0 - smoothstep(rad * 0.6, rad, perp);
    float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    if (fade * 0.94 > ign) discard;
  }
}
`;

// Статичная геометрия мира: цвет вершины + код материала
export const FS_WORLD = `#version 300 es
precision highp float;
${LIGHTING}
void main() {
  cutoutTest();
  int mid = int(vCol.a * 10.0 + 0.5);
  vec3 base = pow(vCol.rgb, vec3(2.2));
  vec3 n = normalize(vNrm);
  if (!gl_FrontFacing) n = -n;
  float big = triTex(uNoise, vWorld, n, 0.07);
  float fine = mix(0.5, triTex(uDetail, vWorld, n, 0.85), uDetailLevel);
  float rough = 0.92, metal = 0.0;
  vec3 emis = vec3(0.0);
  vec3 col = base * (0.8 + 0.4 * big) * (0.84 + 0.32 * fine);
  if (mid <= 1) {
    float streak = texture(uNoise, vec2(vWorld.x * 0.8 + vWorld.z * 0.8, vWorld.y * 0.06)).r;
    col *= mix(1.0, 0.72, smoothstep(0.55, 0.8, streak) * (1.0 - abs(n.y)));
  } else if (mid == 2) {
    float r = smoothstep(0.58, 0.72, big * 0.55 + fine * 0.5);
    col = mix(col, vec3(0.16, 0.06, 0.025) * (0.7 + 0.6 * fine), r);
    rough = mix(0.5, 0.88, r); metal = mix(0.3, 0.1, r);
  } else if (mid == 3) {
    col = mix(col, col * vec3(1.15, 0.78, 0.55), fine); rough = 0.82; metal = 0.25;
  } else if (mid == 4) {
    float g = texture(uDetail, vec2(vWorld.x + vWorld.z, vWorld.y) * vec2(0.25, 3.0)).r;
    col *= 0.8 + 0.4 * g; rough = 0.86;
  } else if (mid == 5) { rough = 1.0; }
  else if (mid == 7) { rough = 0.1; metal = 0.7; col = base * 0.5; }
  else if (mid == 8) { emis = base * 3.0 * uPower; col = base * (0.3 + 0.7 * uPower); rough = 0.4; }
  else if (mid == 9) { rough = 0.65; }
  float gd = 1.0 - smoothstep(0.0, 0.9, vWorld.y);
  col = mix(col, col * vec3(0.5, 0.45, 0.38), gd * 0.55);
  vec3 c = shade(col, n, rough, metal, shadowAt(n)) + emis;
  outColor = vec4(finish(c), 1.0);
}`;

// Земля: карта смешивания R — асфальт, G — трава, B — бетон, A — сырость
export const FS_GROUND = `#version 300 es
precision highp float;
${LIGHTING}
uniform sampler2D uSplat;
void main() {
  vec2 uv = (vWorld.xz + 150.0) / 300.0;
  float big = texture(uNoise, vWorld.xz * 0.031).r;
  float mid = texture(uNoise, vWorld.xz * 0.16).r;
  float mid2 = texture(uNoise, vWorld.xz * 0.16 + vec2(0.37, 0.71)).r;
  float fine = mix(0.5, texture(uDetail, vWorld.xz * 0.75).r, uDetailLevel);
  float fine2 = mix(0.5, texture(uDetail, vWorld.xz * 2.3).r, uDetailLevel);
  vec4 s = texture(uSplat, uv + (vec2(mid, mid2) - 0.5) * 0.0035);
  vec3 dirt = mix(vec3(0.37, 0.34, 0.28), vec3(0.47, 0.44, 0.37), big) * (0.78 + 0.44 * fine);
  vec3 grass = mix(vec3(0.27, 0.31, 0.15), vec3(0.40, 0.38, 0.20), mid) * (0.72 + 0.5 * fine2);
  vec3 asphalt = vec3(0.34, 0.34, 0.33) * (0.8 + 0.4 * fine) * (0.9 + 0.2 * big);
  float crack = smoothstep(0.0, 0.03, abs(fine - 0.5));
  asphalt *= mix(1.0, mix(0.6, 1.0, crack), step(0.45, big));
  vec3 conc = vec3(0.50, 0.49, 0.46) * (0.82 + 0.3 * fine) * (0.9 + 0.2 * big);
  vec2 g = fract(vWorld.xz / vec2(2.0, 6.0));
  float seam = max(1.0 - smoothstep(0.0, 0.02, min(g.x, 1.0 - g.x)), 1.0 - smoothstep(0.0, 0.008, min(g.y, 1.0 - g.y)));
  conc *= 1.0 - 0.45 * seam;
  vec3 col = dirt;
  col = mix(col, grass, smoothstep(0.25, 0.75, s.g + (mid - 0.5) * 0.6));
  col = mix(col, asphalt, smoothstep(0.35, 0.65, s.r + (mid2 - 0.5) * 0.25));
  col = mix(col, conc, smoothstep(0.35, 0.65, s.b + (mid - 0.5) * 0.2));
  float wet = smoothstep(0.5, 0.7, s.a + (big - 0.5) * 0.5 + (fine - 0.5) * 0.15);
  float damp = smoothstep(0.15, 0.45, s.a + (big - 0.5) * 0.4);
  col = mix(col, col * 0.62, damp * 0.6);
  col = mix(col, vec3(0.16, 0.155, 0.13), wet * 0.75);
  vec3 n = vec3(0.0, 1.0, 0.0);
  vec3 c = shade(pow(col, vec3(2.2)), n, mix(0.95, 0.18, wet), 0.0, shadowAt(n));
  outColor = vec4(finish(c), 1.0);
}`;

// Растительность
export const FS_FOLIAGE = `#version 300 es
precision highp float;
${LIGHTING}
void main() {
  if (vWorld.y > 1.2) cutoutTest();
  vec3 base = pow(vCol.rgb, vec3(2.2)) * (0.85 + 0.3 * clamp(vWorld.y * 0.15, 0.0, 1.0));
  vec3 n = normalize(vNrm);
  if (!gl_FrontFacing) n = -n;
  vec3 c = shade(base, n, 0.9, 0.0, shadowAt(n)) + base * vec3(0.15, 0.18, 0.05) * max(dot(-n, uSunDir), 0.0);
  outColor = vec4(finish(c), 1.0);
}`;

// Персонажи и оружие
export const FS_CHAR = `#version 300 es
precision highp float;
${LIGHTING}
uniform float uHitFlash;
uniform vec3 uTint;
void main() {
  int mid = int(vCol.a * 10.0 + 0.5);
  vec3 base = pow(vCol.rgb, vec3(2.2)) * uTint;
  float fine = mix(0.5, texture(uDetail, vLocal.xy * 1.7 + vLocal.zz * 0.9).r, uDetailLevel);
  float rough = 0.8, metal = 0.0;
  if (mid == 2) { rough = 0.6; metal = 0.3; }
  else if (mid == 3) { rough = 0.7; metal = 0.3; }
  else if (mid == 4) { rough = 0.6; }
  else if (mid == 5) { rough = 0.95; }
  else if (mid == 7) { rough = 0.1; metal = 0.6; }
  else if (mid == 9) { rough = 0.55; }
  vec3 col = base * (0.95 + 0.3 * fine);
  vec3 n = normalize(vNrm);
  vec3 c = shade(col, n, rough, metal, shadowAt(n)) + vec3(1.0, 0.25, 0.15) * uHitFlash;
  // контурный свет: фигуры читаются на тёмной земле при виде сверху
  float rim = pow(1.0 - max(dot(n, normalize(uCamPos - vWorld)), 0.0), 2.5);
  c += rim * (uSkyCol * 0.55 + vec3(0.05)) * (0.6 + 0.4 * col / max(max(col.r, col.g), max(col.b, 0.05)));
  outColor = vec4(finish(c), 1.0);
}`;

// Эффекты: аддитивные квадраты (трассеры, вспышки, частицы, аномалии)
export const FX_VS = `#version 300 es
precision highp float;
uniform mat4 uViewProj;
layout(location=0) in vec3 aPos;
layout(location=1) in vec2 aUV;
layout(location=2) in vec4 aCol;
out vec2 vUV;
out vec4 vCol;
void main() { vUV = aUV; vCol = aCol; gl_Position = uViewProj * vec4(aPos, 1.0); }`;

export const FX_FS = `#version 300 es
precision mediump float;
in vec2 vUV;
in vec4 vCol;
out vec4 o;
void main() {
  float r = length(vUV - 0.5) * 2.0;
  float a = vUV.x < -0.5 ? 1.0 : (1.0 - smoothstep(0.0, 1.0, r));
  // a > 0 — свечение (аддитивно), a < 0 — непрозрачная частица (дым, кровь, пыль)
  if (vCol.a < 0.0) { float op = -vCol.a * a; o = vec4(vCol.rgb * op, op); }
  else o = vec4(vCol.rgb * vCol.a * a, 0.0);
}`;

// Рельеф: цвет вершины (биом), A — склонность к скальным выходам на крутых склонах
export const FS_TERRAIN = `#version 300 es
precision highp float;
${LIGHTING}
void main() {
  vec3 n = normalize(vNrm);
  vec3 base = pow(vCol.rgb, vec3(2.2));
  float big = texture(uNoise, vWorld.xz * 0.028).r;
  float mid = texture(uNoise, vWorld.xz * 0.13 + vec2(0.31, 0.77)).r;
  float fine = mix(0.5, texture(uDetail, vWorld.xz * 0.9).r, uDetailLevel);
  float fine2 = mix(0.5, texture(uDetail, vWorld.xz * 3.1).r, uDetailLevel);
  vec3 col = base * (0.8 + 0.4 * big) * (0.78 + 0.3 * fine + 0.14 * fine2);
  float slope = 1.0 - n.y;
  float rock = smoothstep(0.2, 0.36, slope + (mid - 0.5) * 0.14) * vCol.a;
  vec3 rockCol = vec3(0.31, 0.3, 0.28) * (0.7 + 0.5 * fine) * (0.8 + 0.4 * big);
  col = mix(col, rockCol, rock);
  vec3 c = shade(col, n, 0.95, 0.0, shadowAt(n));
  outColor = vec4(finish(c), 1.0);
}`;

// Полупрозрачный «призрак» здания в режиме размещения (зелёный — можно, красный — нельзя)
export const FS_GHOST = `#version 300 es
precision highp float;
${LIGHTING}
uniform vec3 uTint;
void main() {
  vec3 n = normalize(vNrm);
  if (!gl_FrontFacing) n = -n;
  float l = 0.55 + 0.45 * max(dot(n, uSunDir), 0.0);
  float rim = pow(1.0 - abs(dot(n, normalize(uCamPos - vWorld))), 2.0);
  vec3 c = uTint * l + rim * 0.35;
  outColor = vec4(c * 0.85, 0.38 + rim * 0.35);
}`;
