// Astro 3D — kreslení přes WebGL2
//
// Pořadí snímku: pozadí (přechod) → mřížka → objekty → obrys vybraných.
// Obrys dělá maska: vybrané objekty se nakreslí do vlastní textury (aktivní = 1,
// ostatní vybrané = 0,6, zbytek scény = 0 kvůli zakrytí) a celoobrazovkový průchod
// pak obarví pixely na okraji masky — stejný trik, jaký používá Blender.
// Gizma a popisky kreslí aplikace do 2D plátna nad tímhle.

import { mul4, trs, normalova, lookAt, perspective, ortho, bod as bodM } from './mat.js';
import { priprav } from './sit.js';

const VS_SIT = `#version 300 es
in vec3 aPos; in vec3 aNor;
uniform mat4 uVP, uM; uniform mat3 uN;
out vec3 vW; out vec3 vN;
void main() {
  vec4 w = uM * vec4(aPos, 1.0);
  vW = w.xyz; vN = uN * aNor;
  gl_Position = uVP * w;
}`;

const FS_SIT = `#version 300 es
precision highp float;
in vec3 vW; in vec3 vN;
uniform vec3 uOko, uBarva, uL1, uL2;
uniform float uDrs, uKov;
out vec4 o;
void main() {
  vec3 N = normalize(vN);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(uOko - vW);
  vec3 base = pow(uBarva, vec3(2.2));
  float d1 = max(dot(N, uL1), 0.0), d2 = max(dot(N, uL2), 0.0);
  vec3 amb = mix(vec3(0.10, 0.095, 0.09), vec3(0.30, 0.32, 0.36), N.z * 0.5 + 0.5);
  vec3 dif = base * (d1 * vec3(1.0, 0.96, 0.9) * 0.95 + d2 * vec3(0.55, 0.62, 0.75) * 0.32 + amb);
  vec3 R = reflect(-V, N);
  vec3 env = mix(vec3(0.12, 0.11, 0.1), vec3(0.85, 0.88, 0.95), smoothstep(-0.4, 0.7, R.z));
  vec3 kov = base * env * 1.15;
  vec3 c = mix(dif, kov, uKov);
  float lesk = mix(220.0, 6.0, uDrs);
  vec3 H = normalize(uL1 + V);
  float sp = pow(max(dot(N, H), 0.0), lesk) * (1.0 - uDrs) * mix(0.45, 1.3, uKov) * step(0.0, d1);
  c += mix(vec3(1.0), base, uKov) * sp;
  float fr = pow(1.0 - max(dot(N, V), 0.0), 5.0) * 0.12 * (1.0 - uDrs * 0.7) * (1.0 - uKov);
  c += vec3(fr);
  o = vec4(pow(c, vec3(1.0 / 2.2)), 1.0);
}`;

const VS_CARA = `#version 300 es
in vec3 aPos; in vec4 aBarva;
uniform mat4 uVP, uM; uniform float uBod;
out vec4 vB; out vec3 vW;
void main() {
  vec4 w = uM * vec4(aPos, 1.0);
  vB = aBarva; vW = w.xyz;
  gl_Position = uVP * w;
  gl_PointSize = uBod;
}`;

// mizení do dálky se počítá po pixelech — konce čar mřížky jsou daleko, takže
// po vrcholech by zmizela celá čára
const FS_CARA = `#version 300 es
precision highp float;
in vec4 vB; in vec3 vW;
uniform vec4 uBarva; uniform vec3 uStred; uniform float uDosah, uBod;
out vec4 o;
void main() {
  if (uBod > 0.0 && length(gl_PointCoord - 0.5) > 0.5) discard;
  if (uBarva.a > 0.0) { o = uBarva; return; }
  float f = uDosah > 0.0 ? 1.0 - smoothstep(uDosah * 0.35, uDosah, length(vW - uStred)) : 1.0;
  o = vec4(vB.rgb, vB.a * f);
}`;

const VS_MASKA = `#version 300 es
in vec3 aPos; uniform mat4 uVP, uM;
void main() { gl_Position = uVP * uM * vec4(aPos, 1.0); }`;

const FS_MASKA = `#version 300 es
precision mediump float; uniform float uHodnota; out vec4 o;
void main() { o = vec4(uHodnota, 0.0, 0.0, 1.0); }`;

const VS_CELA = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = p; gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FS_POZADI = `#version 300 es
precision mediump float; in vec2 vUv;
uniform vec3 uHore, uDole; out vec4 o;
void main() { o = vec4(mix(uDole, uHore, smoothstep(0.0, 1.0, vUv.y)), 1.0); }`;

const FS_OBRYS = `#version 300 es
precision mediump float; in vec2 vUv;
uniform sampler2D uMaska; uniform vec2 uPx; out vec4 o;
void main() {
  float c = texture(uMaska, vUv).r, m = c;
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.785398;
    vec2 d = vec2(cos(a), sin(a));
    m = max(m, texture(uMaska, vUv + d * uPx).r);
    m = max(m, texture(uMaska, vUv + d * uPx * 2.0).r);
  }
  if (m <= c + 0.05) discard;
  o = m > 0.8 ? vec4(1.0, 0.68, 0.25, 1.0) : vec4(0.93, 0.45, 0.1, 1.0);
}`;

// ---------------------------------------------------------------- render se světly a stíny
// Až 4 světla (bodové = kostková stínová mapa, slunce a reflektor = 2D). Samplery se v GLSL ES 3.0
// nesmí indexovat proměnnou, takže se kód pro každé světlo vygeneruje zvlášť.
export const MAX_SVETEL = 4;

const FS_STIN = `#version 300 es
precision mediump float;
void main() {}`;

function fsRender() {
  const kazde = (fn) => Array.from({ length: MAX_SVETEL }, (_, i) => fn(i)).join('\n');
  return `#version 300 es
precision highp float;
precision highp sampler2DShadow;
precision highp samplerCubeShadow;
in vec3 vW; in vec3 vN;
uniform vec3 uOko, uBarva, uSvet;
uniform float uDrs, uKov, uZare;
uniform int uPocet;
uniform int uDruh[${MAX_SVETEL}];
uniform vec3 uPoz[${MAX_SVETEL}], uSmer[${MAX_SVETEL}], uSvBarva[${MAX_SVETEL}];
uniform float uKuzelVen[${MAX_SVETEL}], uKuzelDov[${MAX_SVETEL}], uStin[${MAX_SVETEL}];
uniform float uBlizko[${MAX_SVETEL}], uDaleko[${MAX_SVETEL}], uTexel[${MAX_SVETEL}], uOdsun[${MAX_SVETEL}], uMekce[${MAX_SVETEL}];
uniform mat4 uStinVP[${MAX_SVETEL}];
${kazde((i) => `uniform sampler2DShadow uMapa${i};\nuniform samplerCubeShadow uKostka${i};`)}
out vec4 o;
const float PI = 3.14159265;
const vec3 ROZPTYL[8] = vec3[](vec3(1,1,1), vec3(1,-1,-1), vec3(-1,1,-1), vec3(-1,-1,1),
  vec3(1,0,0.4), vec3(-1,0.3,0), vec3(0,1,-0.5), vec3(0.2,-1,0));

vec3 brdf(vec3 N, vec3 V, vec3 L, vec3 base, float drs, float kov) {
  float NL = max(dot(N, L), 0.0);
  if (NL <= 0.0) return vec3(0.0);
  vec3 H = normalize(L + V);
  float NH = max(dot(N, H), 0.0), NV = max(dot(N, V), 1e-4), VH = max(dot(V, H), 0.0);
  float a = max(drs * drs, 0.002), a2 = a * a;
  float d = NH * NH * (a2 - 1.0) + 1.0;
  float D = a2 / (PI * d * d);
  float k = (drs + 1.0) * (drs + 1.0) / 8.0;
  float G = NL / (NL * (1.0 - k) + k) * NV / (NV * (1.0 - k) + k);
  vec3 F0 = mix(vec3(0.04), base, kov);
  vec3 F = F0 + (1.0 - F0) * pow(1.0 - VH, 5.0);
  vec3 spec = D * G * F / (4.0 * NL * NV + 1e-4);
  vec3 kd = (1.0 - F) * (1.0 - kov);
  return (kd * base / PI + spec) * NL;
}

${kazde((i) => `float stin${i}(vec3 P, vec3 N) {
  if (uStin[${i}] < 0.5) return 1.0;
  if (uDruh[${i}] == 0) {
    vec3 d = P - uPoz[${i}];
    d += N * uOdsun[${i}] * length(d);
    float z = max(abs(d.x), max(abs(d.y), abs(d.z)));
    float n = uBlizko[${i}], f = uDaleko[${i}];
    float ref = ((f + n) / (f - n) - 2.0 * f * n / ((f - n) * z)) * 0.5 + 0.5;
    float r = z * uTexel[${i}] * (1.0 + uMekce[${i}] * 6.0);
    float s = 0.0;
    for (int j = 0; j < 8; j++) s += texture(uKostka${i}, vec4(d + ROZPTYL[j] * r, ref - 0.0004));
    return s / 8.0;
  }
  vec4 q = uStinVP[${i}] * vec4(P + N * uOdsun[${i}], 1.0);
  vec3 p = q.xyz / q.w * 0.5 + 0.5;
  if (p.z >= 1.0 || p.x < 0.0 || p.y < 0.0 || p.x > 1.0 || p.y > 1.0) return 1.0;
  float r = uTexel[${i}] * (1.0 + uMekce[${i}] * 5.0);
  float s = 0.0;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) s += texture(uMapa${i}, vec3(p.xy + vec2(x, y) * r, p.z - 0.0006));
  return s / 9.0;
}`)}

vec3 aces(vec3 x) { return clamp(x * (2.51 * x + 0.03) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }

void main() {
  vec3 N = normalize(vN);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(uOko - vW);
  vec3 base = pow(uBarva, vec3(2.2));
  // okolí ze „světa“: rozptyl + u kovů odlesk
  // odraz světa je nahoře světlejší (jako obloha), ať kovy nejsou jen černé
  vec3 R = reflect(-V, N);
  vec3 odraz = uSvet * (0.5 + 1.5 * smoothstep(-0.3, 0.8, R.z));
  vec3 c = uSvet * base * (1.0 - uKov) + odraz * mix(vec3(0.04), base, uKov) * (1.0 - uDrs * 0.5);
${kazde((i) => `  if (${i} < uPocet) {
    vec3 L; vec3 rad;
    if (uDruh[${i}] == 1) { L = -uSmer[${i}]; rad = uSvBarva[${i}]; }
    else {
      vec3 d = uPoz[${i}] - vW;
      float r2 = max(dot(d, d), 1e-4);
      L = d * inversesqrt(r2);
      rad = uSvBarva[${i}] / (4.0 * PI * r2);
      if (uDruh[${i}] == 2) rad *= smoothstep(uKuzelVen[${i}], uKuzelDov[${i}], dot(-L, uSmer[${i}]));
    }
    vec3 b = brdf(N, V, L, base, uDrs, uKov) * rad;
    if (dot(b, vec3(1.0)) > 1e-5) c += b * stin${i}(vW, N);
  }`)}
  c += base * uZare;
  o = vec4(pow(aces(c), vec3(1.0 / 2.2)), 1.0);
}`;
}

/** Stejný tonemapping jako ve shaderu — pro barvu pozadí (vstup lineární). */
export const naDisplej = (rgb) => rgb.map((x) => Math.min(1, Math.max(0, x * (2.51 * x + 0.03) / (x * (2.43 * x + 0.59) + 0.14))) ** (1 / 2.2));

// strany kostkové mapy: směr a „nahoru“ (stejně jako v OpenGL)
const STRANY_KOSTKY = [
  [[1, 0, 0], [0, -1, 0]], [[-1, 0, 0], [0, -1, 0]], [[0, 1, 0], [0, 0, 1]],
  [[0, -1, 0], [0, 0, -1]], [[0, 0, 1], [0, -1, 0]], [[0, 0, -1], [0, -1, 0]],
];

function program(gl, vs, fs) {
  const p = gl.createProgram();
  for (const [typ, zdroj] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const s = gl.createShader(typ);
    gl.shaderSource(s, zdroj);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('Shader: ' + gl.getShaderInfoLog(s));
    gl.attachShader(p, s);
  }
  // stejné umístění atributů ve všech programech → jedna VAO poslouží všem
  gl.bindAttribLocation(p, 0, 'aPos');
  gl.bindAttribLocation(p, 1, vs.includes('aNor') ? 'aNor' : 'aBarva');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Program: ' + gl.getProgramInfoLog(p));
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const jm = gl.getActiveUniform(p, i).name; u[jm] = gl.getUniformLocation(p, jm); }
  return { p, u, a: (jm) => gl.getAttribLocation(p, jm) };
}

/** Mřížka v jedné ze tří rovin, osy barevně jako v Blenderu (X červená, Y zelená, Z modrá). */
function mrizkaData(rovina) {
  const N = 60, d = [];
  const osy = { xy: [0, 1], xz: [0, 2], yz: [1, 2] }[rovina];
  const barvaOsy = [[0.93, 0.27, 0.32], [0.48, 0.78, 0.16], [0.2, 0.52, 0.96]];
  const bod = (u, w) => { const p = [0, 0, 0]; p[osy[0]] = u; p[osy[1]] = w; return p; };
  for (let i = -N; i <= N; i++) {
    for (const [smer, druha] of [[0, 1], [1, 0]]) {
      let b;
      if (i === 0) b = [...barvaOsy[osy[druha]], 1];
      else b = i % 10 === 0 ? [0.62, 0.62, 0.62, 0.75] : [0.52, 0.52, 0.53, 0.55];
      const a = smer === 0 ? bod(-N, i) : bod(i, -N);
      const z = smer === 0 ? bod(N, i) : bod(i, N);
      d.push(...a, ...b, ...z, ...b);
    }
  }
  return new Float32Array(d);
}

export class Renderer {
  constructor(canvas) {
    const gl = canvas.getContext('webgl2', { antialias: true, preserveDrawingBuffer: false, alpha: false });
    if (!gl) throw new Error('Tenhle prohlížeč neumí WebGL2.');
    this.gl = gl;
    this.canvas = canvas;
    this.pSit = program(gl, VS_SIT, FS_SIT);
    this.pCara = program(gl, VS_CARA, FS_CARA);
    this.pMaska = program(gl, VS_MASKA, FS_MASKA);
    this.pPozadi = program(gl, VS_CELA, FS_POZADI);
    this.pObrys = program(gl, VS_CELA, FS_OBRYS);
    this.pStin = program(gl, VS_MASKA, FS_STIN);
    this.pRender = program(gl, VS_SIT, fsRender());
    this.mapy2D = [];                 // [{ tex, vel }] po světlech
    this.mapyKostka = [];
    this.stinFbo = null;
    this.prazdnyVao = gl.createVertexArray();
    this.cache = new Map();           // síť → { hladke, vao…, pick }
    this.mrizky = {};
    for (const r of ['xy', 'xz', 'yz']) this.mrizky[r] = this.caraVao(mrizkaData(r));
    this.fbo = null; this.fboW = 0; this.fboH = 0;
  }

  caraVao(data) {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const ap = this.pCara.a('aPos'), ab = this.pCara.a('aBarva');
    gl.enableVertexAttribArray(ap); gl.vertexAttribPointer(ap, 3, gl.FLOAT, false, 28, 0);
    gl.enableVertexAttribArray(ab); gl.vertexAttribPointer(ab, 4, gl.FLOAT, false, 28, 12);
    gl.bindVertexArray(null);
    return { vao, buf, pocet: data.length / 7 };
  }

  /** GPU data pro síť; počítá se jednou pro každou síť a způsob stínování. */
  data(obj) {
    const gl = this.gl;
    let c = this.cache.get(obj.sit);
    if (c && c.hladke === obj.hladke) return c;
    if (c) this.uvolni(c);
    const p = priprav(obj.sit, obj.hladke);

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, p.tri, gl.STATIC_DRAW);
    for (const prog of [this.pSit, this.pMaska]) {
      const ap = prog.a('aPos');
      gl.enableVertexAttribArray(ap); gl.vertexAttribPointer(ap, 3, gl.FLOAT, false, 24, 0);
    }
    const an = this.pSit.a('aNor');
    gl.enableVertexAttribArray(an); gl.vertexAttribPointer(an, 3, gl.FLOAT, false, 24, 12);

    const vaoH = gl.createVertexArray();
    gl.bindVertexArray(vaoH);
    const bufH = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufH);
    gl.bufferData(gl.ARRAY_BUFFER, p.hrany, gl.STATIC_DRAW);
    const apc = this.pCara.a('aPos');
    gl.enableVertexAttribArray(apc); gl.vertexAttribPointer(apc, 3, gl.FLOAT, false, 12, 0);
    gl.vertexAttrib4f(this.pCara.a('aBarva'), 0, 0, 0, 1);
    gl.bindVertexArray(null);

    c = { hladke: obj.hladke, vao, buf, vaoH, bufH, pocet: p.tri.length / 6, pocetH: p.hrany.length / 3, pick: p.pick };
    this.cache.set(obj.sit, c);
    return c;
  }

  uvolni(c) {
    const gl = this.gl;
    gl.deleteVertexArray(c.vao); gl.deleteBuffer(c.buf);
    gl.deleteVertexArray(c.vaoH); gl.deleteBuffer(c.bufH);
  }

  /** Zahodí GPU data sítí, které už nikdo nepoužívá (scéna ani historie). */
  uklid(zive) {
    for (const [sit, c] of this.cache) if (!zive.has(sit)) { this.uvolni(c); this.cache.delete(sit); }
  }

  maska(w, h) {
    const gl = this.gl;
    if (this.fbo && this.fboW === w && this.fboH === h) return;
    if (this.fbo) { gl.deleteFramebuffer(this.fbo); gl.deleteTexture(this.tex); gl.deleteRenderbuffer(this.rb); }
    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST],
      [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    this.rb = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.rb);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
    this.fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tex, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.rb);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.fboW = w; this.fboH = h;
  }

  /**
   * Nakreslí scénu.
   * pohled: { vp, oko, stred, vpravo, nahoru, dozadu, dosah, rovina }
   * volby: { drat, mrizka, obrys, vybrane: Set, aktivni, cisty }
   */
  kresli(objekty, pohled, volby) {
    const gl = this.gl, W = this.canvas.width, H = this.canvas.height;
    const viditelne = objekty.filter((o) => !o.skryty && o.sit);
    const rend = volby.render;
    const modely = new Map();
    for (const o of viditelne) modely.set(o, trs(o.poz, o.rot, o.mer));
    const svetla = rend ? this.stiny(rend.svetla, viditelne, modely) : null;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.useProgram(this.pPozadi.p);
    let [hore, dole] = volby.cisty ? [[0.33, 0.35, 0.39], [0.13, 0.135, 0.15]] : [[0.27, 0.27, 0.28], [0.19, 0.19, 0.2]];
    if (rend) { const b = naDisplej(rend.svet); hore = b; dole = b.map((x) => x * 0.82); }
    gl.uniform3fv(this.pPozadi.u.uHore, hore);
    gl.uniform3fv(this.pPozadi.u.uDole, dole);
    gl.bindVertexArray(this.prazdnyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.clear(gl.DEPTH_BUFFER_BIT);

    // světla se drží kamery (jako „Studio“ osvětlení v Blenderu), ať je model vždy čitelný
    const { vpravo, nahoru, dozadu } = pohled;
    const smes = (a, b, c) => {
      const v = [0, 1, 2].map((i) => vpravo[i] * a + nahoru[i] * b + dozadu[i] * c);
      const l = Math.hypot(...v);
      return v.map((x) => x / l);
    };
    const L1 = smes(-0.45, 0.75, 0.55), L2 = smes(0.85, -0.15, 0.35);

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    if (!volby.drat) {
      const prog = rend ? this.pRender : this.pSit;
      gl.useProgram(prog.p);
      const u = prog.u;
      gl.uniformMatrix4fv(u.uVP, false, pohled.vp);
      gl.uniform3fv(u.uOko, pohled.oko);
      if (rend) this.nastavSvetla(svetla, rend.svet);
      else { gl.uniform3fv(u.uL1, L1); gl.uniform3fv(u.uL2, L2); }
      gl.enable(gl.POLYGON_OFFSET_FILL);
      gl.polygonOffset(1, 1);
      for (const o of viditelne) {
        const d = this.data(o), M = modely.get(o);
        gl.uniformMatrix4fv(u.uM, false, M);
        gl.uniformMatrix3fv(u.uN, false, normalova(M));
        gl.uniform3fv(u.uBarva, hexNaRgb(o.barva));
        gl.uniform1f(u.uDrs, o.drs);
        gl.uniform1f(u.uKov, o.kov);
        if (rend) gl.uniform1f(u.uZare, o.zare || 0);
        gl.bindVertexArray(d.vao);
        gl.drawArrays(gl.TRIANGLES, 0, d.pocet);
      }
      gl.disable(gl.POLYGON_OFFSET_FILL);
    }

    if (!volby.cisty && volby.mrizka) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.useProgram(this.pCara.p);
      const u = this.pCara.u;
      const m = this.mrizky[pohled.rovina];
      gl.uniformMatrix4fv(u.uVP, false, pohled.vp);
      gl.uniformMatrix4fv(u.uM, false, new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]));
      gl.uniform3fv(u.uStred, pohled.stredMrizky);
      gl.uniform1f(u.uDosah, pohled.dosah);
      gl.uniform1f(u.uBod, 0);
      gl.uniform4f(u.uBarva, 0, 0, 0, 0);
      gl.bindVertexArray(m.vao);
      gl.drawArrays(gl.LINES, 0, m.pocet);
      gl.depthMask(true);
    }

    // hrany: v drátovém režimu všechny objekty, jinak jen nic (obrys stačí)
    if (!volby.cisty && volby.drat) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.disable(gl.DEPTH_TEST);
      gl.useProgram(this.pCara.p);
      const u = this.pCara.u;
      gl.uniformMatrix4fv(u.uVP, false, pohled.vp);
      gl.uniform1f(u.uDosah, 0);
      gl.uniform1f(u.uBod, 0);
      for (const o of viditelne) {
        if (o.id === volby.uprava?.id) continue;
        const d = this.data(o);
        const barva = o.id === volby.aktivni ? [1, 0.68, 0.25, 1] : volby.vybrane.has(o.id) ? [0.93, 0.45, 0.1, 1] : [0.05, 0.05, 0.05, 0.85];
        gl.uniformMatrix4fv(u.uM, false, modely.get(o));
        gl.uniform4fv(u.uBarva, barva);
        gl.bindVertexArray(d.vaoH);
        gl.drawArrays(gl.LINES, 0, d.pocetH);
      }
      gl.enable(gl.DEPTH_TEST);
    }

    if (!volby.cisty && volby.uprava) this.kresliUpravu(volby.uprava, pohled, volby.drat);
    if (!volby.cisty && !volby.drat && volby.vybrane.size) this.kresliObrys(viditelne, modely, pohled, volby);
    gl.bindVertexArray(null);
  }

  kresliObrys(viditelne, modely, pohled, volby) {
    const gl = this.gl, W = this.canvas.width, H = this.canvas.height;
    this.maska(W, H);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
    gl.useProgram(this.pMaska.p);
    const u = this.pMaska.u;
    gl.uniformMatrix4fv(u.uVP, false, pohled.vp);
    for (const o of viditelne) {
      const d = this.data(o);
      gl.uniformMatrix4fv(u.uM, false, modely.get(o));
      gl.uniform1f(u.uHodnota, o.id === volby.aktivni ? 1 : volby.vybrane.has(o.id) ? 0.6 : 0);
      gl.bindVertexArray(d.vao);
      gl.drawArrays(gl.TRIANGLES, 0, d.pocet);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.pObrys.p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.uniform1i(this.pObrys.u.uMaska, 0);
    const px = Math.max(1, Math.round(window.devicePixelRatio || 1));
    gl.uniform2f(this.pObrys.u.uPx, px / W, px / H);
    gl.bindVertexArray(this.prazdnyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST);
  }

  // ---------------------------------------------------------------- stíny
  hloubkovaTex(cil, vel) {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(cil, t);
    gl.texStorage2D(cil, 1, gl.DEPTH_COMPONENT24, vel, vel);
    gl.texParameteri(cil, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(cil, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(cil, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(cil, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (cil === gl.TEXTURE_CUBE_MAP) gl.texParameteri(cil, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
    gl.texParameteri(cil, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(cil, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    return t;
  }

  /** Stínová textura pro světlo i (založí ji, nebo vymění při jiné velikosti). */
  mapa(seznam, i, cil, vel) {
    const m = seznam[i];
    if (m && m.vel === vel) return m.tex;
    if (m) this.gl.deleteTexture(m.tex);
    seznam[i] = { tex: this.hloubkovaTex(cil, vel), vel };
    return seznam[i].tex;
  }

  /** Nakreslí hloubku sítí z pohledu světla do připojené textury. */
  kresliHloubku(vp, site, modely, vel) {
    const gl = this.gl;
    gl.viewport(0, 0, vel, vel);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.uniformMatrix4fv(this.pStin.u.uVP, false, vp);
    for (const o of site) {
      gl.uniformMatrix4fv(this.pStin.u.uM, false, modely.get(o));
      const d = this.data(o);
      gl.bindVertexArray(d.vao);
      gl.drawArrays(gl.TRIANGLES, 0, d.pocet);
    }
  }

  /** Obálka scény (střed, poloměr, min, max) z lokálních obálek sítí. */
  obalka(site, modely) {
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    if (!this.obalky) this.obalky = new WeakMap();
    for (const o of site) {
      let b = this.obalky.get(o.sit);
      if (!b) {
        b = [[Infinity, Infinity, Infinity], [-Infinity, -Infinity, -Infinity]];
        const v = o.sit.v;
        for (let i = 0; i < v.length; i += 3) for (let k = 0; k < 3; k++) { b[0][k] = Math.min(b[0][k], v[i + k]); b[1][k] = Math.max(b[1][k], v[i + k]); }
        this.obalky.set(o.sit, b);
      }
      const M = modely.get(o);
      for (let r = 0; r < 8; r++) {
        const p = bodM(M, [b[r & 1][0], b[(r >> 1) & 1][1], b[(r >> 2) & 1][2]]);
        for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], p[k]); mx[k] = Math.max(mx[k], p[k]); }
      }
    }
    if (!site.length) return { stred: [0, 0, 0], polomer: 1, mn: [-1, -1, -1], mx: [1, 1, 1] };
    const stred = mn.map((a, k) => (a + mx[k]) / 2);
    return { stred, polomer: Math.max(0.5, Math.hypot(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) / 2), mn, mx };
  }

  /**
   * Stínové mapy všech světel. svetla: [{ druh 0 bod | 1 slunce | 2 reflektor, poz, smer, barva (lineární),
   * sila, uhel, mekkost, stiny, polomer }] → doplní matice a parametry pro shader.
   */
  stiny(svetla, site, modely) {
    const gl = this.gl;
    if (!this.stinFbo) {
      this.stinFbo = gl.createFramebuffer();
      this.prazdna2D = this.hloubkovaTex(gl.TEXTURE_2D, 1);
      this.prazdnaKostka = this.hloubkovaTex(gl.TEXTURE_CUBE_MAP, 1);
    }
    const sc = this.obalka(site, modely);
    const nejdal = (poz) => {
      let dal = 1;
      for (let r = 0; r < 8; r++) {
        const p = [r & 1 ? sc.mx[0] : sc.mn[0], r & 2 ? sc.mx[1] : sc.mn[1], r & 4 ? sc.mx[2] : sc.mn[2]];
        dal = Math.max(dal, Math.hypot(p[0] - poz[0], p[1] - poz[1], p[2] - poz[2]));
      }
      return dal * 1.05 + 0.5;
    };
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.stinFbo);
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);
    gl.useProgram(this.pStin.p);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.enable(gl.POLYGON_OFFSET_FILL);
    gl.polygonOffset(2, 4);
    const vysl = svetla.map((sv, i) => {
      const u = { ...sv, vp: new Float32Array(16), blizko: 0.05, daleko: 10, texel: 0, odsun: 0 };
      if (!sv.stiny || !site.length) { u.stiny = false; return u; }
      if (sv.druh === 0) {
        const vel = 1024;
        const tex = this.mapa(this.mapyKostka, i, gl.TEXTURE_CUBE_MAP, vel);
        u.daleko = nejdal(sv.poz);
        const P = perspective(Math.PI / 2, 1, u.blizko, u.daleko);
        STRANY_KOSTKY.forEach(([smer, nahoru], f) => {
          gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_CUBE_MAP_POSITIVE_X + f, tex, 0);
          const V = lookAt(sv.poz, [sv.poz[0] + smer[0], sv.poz[1] + smer[1], sv.poz[2] + smer[2]], nahoru);
          this.kresliHloubku(mul4(P, V), site, modely, vel);
        });
        u.texel = 2 / vel;
        u.odsun = 3 / vel;
        return u;
      }
      const vel = sv.druh === 1 ? 2048 : 1024;
      const tex = this.mapa(this.mapy2D, i, gl.TEXTURE_2D, vel);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, tex, 0);
      const s = sv.smer;
      const nahoru = Math.abs(s[2]) > 0.95 ? [0, 1, 0] : [0, 0, 1];
      let vp;
      if (sv.druh === 1) {
        const R = sc.polomer;
        const oko = [sc.stred[0] - s[0] * R * 2, sc.stred[1] - s[1] * R * 2, sc.stred[2] - s[2] * R * 2];
        vp = mul4(ortho(-R, R, -R, R, 0.01, R * 4), lookAt(oko, sc.stred, nahoru));
        u.odsun = 2 * R / vel * 1.5;
      } else {
        const dal = nejdal(sv.poz);
        const uhel = Math.min(Math.PI * 0.95, sv.uhel + 0.1);
        vp = mul4(perspective(uhel, 1, 0.05, dal), lookAt(sv.poz, [sv.poz[0] + s[0], sv.poz[1] + s[1], sv.poz[2] + s[2]], nahoru));
        u.odsun = dal * Math.tan(uhel / 2) * 2 / vel;
      }
      this.kresliHloubku(vp, site, modely, vel);
      u.vp = vp;
      u.texel = 1 / vel;
      return u;
    });
    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return vysl;
  }

  /** Uniformy světel + navázání stínových map pro render shader (program už je aktivní). */
  nastavSvetla(svetla, svet) {
    const gl = this.gl, p = this.pRender;
    if (!p.pole) p.pole = new Map();
    const loc = (jm) => { if (!p.pole.has(jm)) p.pole.set(jm, gl.getUniformLocation(p.p, jm)); return p.pole.get(jm); };
    gl.uniform1i(loc('uPocet'), svetla.length);
    gl.uniform3fv(loc('uSvet'), svet);
    for (let i = 0; i < MAX_SVETEL; i++) {
      const sv = svetla[i];
      gl.activeTexture(gl.TEXTURE1 + i);
      gl.bindTexture(gl.TEXTURE_2D, sv?.stiny && sv.druh !== 0 ? this.mapy2D[i].tex : this.prazdna2D);
      gl.uniform1i(loc('uMapa' + i), 1 + i);
      gl.activeTexture(gl.TEXTURE1 + MAX_SVETEL + i);
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, sv?.stiny && sv.druh === 0 ? this.mapyKostka[i].tex : this.prazdnaKostka);
      gl.uniform1i(loc('uKostka' + i), 1 + MAX_SVETEL + i);
      if (!sv) continue;
      const a = (jm) => loc(`${jm}[${i}]`);
      gl.uniform1i(a('uDruh'), sv.druh);
      gl.uniform3fv(a('uPoz'), sv.poz);
      gl.uniform3fv(a('uSmer'), sv.smer);
      gl.uniform3fv(a('uSvBarva'), sv.barva.map((x) => x * sv.sila));
      gl.uniform1f(a('uKuzelVen'), Math.cos(sv.uhel / 2));
      gl.uniform1f(a('uKuzelDov'), Math.cos(sv.uhel / 2 * (1 - sv.mekkost)) + 1e-4);
      gl.uniform1f(a('uStin'), sv.stiny ? 1 : 0);
      gl.uniform1f(a('uBlizko'), sv.blizko);
      gl.uniform1f(a('uDaleko'), sv.daleko);
      gl.uniform1f(a('uTexel'), sv.texel);
      gl.uniform1f(a('uOdsun'), sv.odsun);
      gl.uniform1f(a('uMekce'), sv.polomer);
      gl.uniformMatrix4fv(a('uStinVP'), false, sv.vp);
    }
    gl.activeTexture(gl.TEXTURE0);
  }


  /**
   * Režim úprav: vybrané plochy (průsvitně), hrany a body (vrcholy nebo středy ploch).
   * u = { id, M, verze, plochy, cary, body } — pole poloha(3) + barva(4); nahrává se jen při změně verze.
   */
  kresliUpravu(u, pohled, xray) {
    const gl = this.gl;
    if (!this.upr) {
      this.upr = {};
      for (const jm of ['plochy', 'cary', 'body']) {
        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        const ap = this.pCara.a('aPos'), ab = this.pCara.a('aBarva');
        gl.enableVertexAttribArray(ap); gl.vertexAttribPointer(ap, 3, gl.FLOAT, false, 28, 0);
        gl.enableVertexAttribArray(ab); gl.vertexAttribPointer(ab, 4, gl.FLOAT, false, 28, 12);
        this.upr[jm] = { vao, buf, pocet: 0 };
      }
      gl.bindVertexArray(null);
    }
    if (this.upr.verze !== u.verze) {
      for (const jm of ['plochy', 'cary', 'body']) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.upr[jm].buf);
        gl.bufferData(gl.ARRAY_BUFFER, u[jm], gl.DYNAMIC_DRAW);
        this.upr[jm].pocet = u[jm].length / 7;
      }
      this.upr.verze = u.verze;
    }
    gl.useProgram(this.pCara.p);
    const un = this.pCara.u;
    gl.uniformMatrix4fv(un.uVP, false, pohled.vp);
    gl.uniformMatrix4fv(un.uM, false, u.M);
    gl.uniform1f(un.uDosah, 0);
    gl.uniform4f(un.uBarva, 0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    if (xray) gl.disable(gl.DEPTH_TEST); else { gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); }
    const dpr = window.devicePixelRatio || 1;
    gl.uniform1f(un.uBod, 0);
    gl.bindVertexArray(this.upr.plochy.vao);
    gl.drawArrays(gl.TRIANGLES, 0, this.upr.plochy.pocet);
    gl.bindVertexArray(this.upr.cary.vao);
    gl.drawArrays(gl.LINES, 0, this.upr.cary.pocet);
    gl.uniform1f(un.uBod, 6 * dpr);
    gl.bindVertexArray(this.upr.body.vao);
    gl.drawArrays(gl.POINTS, 0, this.upr.body.pocet);
    gl.uniform1f(un.uBod, 0);
    gl.depthMask(true);
    gl.enable(gl.DEPTH_TEST);
  }

  /** Zahodí GPU data jedné sítě (mezikroky při tažení v režimu úprav). */
  zapomen(sit) {
    const c = this.cache.get(sit);
    if (c) { this.uvolni(c); this.cache.delete(sit); }
  }

  /** Trojúhelníky sítě v lokálních souřadnicích (pro výběr kliknutím). */
  pick(obj) { return this.data(obj).pick; }

  znic() {
    for (const c of this.cache.values()) this.uvolni(c);
    this.cache.clear();
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}

const rgbCache = new Map();
export function hexNaRgb(hex) {
  let c = rgbCache.get(hex);
  if (!c) {
    const n = parseInt(String(hex).replace('#', ''), 16) || 0;
    c = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    rgbCache.set(hex, c);
  }
  return c;
}

export { mul4 };
