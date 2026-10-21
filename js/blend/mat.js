// Astro 3D — vektory a matice
//
// Matice 4×4 jsou po sloupcích (m[sloupec*4 + řádek]), stejně jako je chce WebGL.
// Svět je jako v Blenderu: osa Z míří nahoru, X doprava, Y dozadu.
// Otočení objektů je Eulerovo XYZ ve stupních (R = Rz · Ry · Rx).

export const DEG = Math.PI / 180;

// ---------------------------------------------------------------- vektory
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// ---------------------------------------------------------------- matice 4×4
export const ident = () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

export function mul4(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return o;
}

export function perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
  const o = new Float32Array(16);
  o[0] = f / aspect; o[5] = f; o[10] = (far + near) * nf; o[11] = -1; o[14] = 2 * far * near * nf;
  return o;
}

export function ortho(l, r, b, t, n, f) {
  const o = ident();
  o[0] = 2 / (r - l); o[5] = 2 / (t - b); o[10] = -2 / (f - n);
  o[12] = -(r + l) / (r - l); o[13] = -(t + b) / (t - b); o[14] = -(f + n) / (f - n);
  return o;
}

export function lookAt(eye, target, up) {
  const z = norm(sub(eye, target));
  let x = cross(up, z);
  if (len(x) < 1e-6) x = cross([0, 1, 0], z);
  x = norm(x);
  const y = cross(z, x);
  return new Float32Array([
    x[0], y[0], z[0], 0,
    x[1], y[1], z[1], 0,
    x[2], y[2], z[2], 0,
    -dot(x, eye), -dot(y, eye), -dot(z, eye), 1,
  ]);
}

export function invert(m) {
  const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = m;
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det) return ident();
  det = 1 / det;
  return new Float32Array([
    (a11 * b11 - a12 * b10 + a13 * b09) * det, (a02 * b10 - a01 * b11 - a03 * b09) * det,
    (a31 * b05 - a32 * b04 + a33 * b03) * det, (a22 * b04 - a21 * b05 - a23 * b03) * det,
    (a12 * b08 - a10 * b11 - a13 * b07) * det, (a00 * b11 - a02 * b08 + a03 * b07) * det,
    (a32 * b02 - a30 * b05 - a33 * b01) * det, (a20 * b05 - a22 * b02 + a23 * b01) * det,
    (a10 * b10 - a11 * b08 + a13 * b06) * det, (a01 * b08 - a00 * b10 - a03 * b06) * det,
    (a30 * b04 - a31 * b02 + a33 * b00) * det, (a21 * b02 - a20 * b04 - a23 * b00) * det,
    (a11 * b07 - a10 * b09 - a12 * b06) * det, (a00 * b09 - a01 * b07 + a02 * b06) * det,
    (a31 * b01 - a30 * b03 - a32 * b00) * det, (a20 * b03 - a21 * b01 + a22 * b00) * det,
  ]);
}

/** Bod (w = 1) přes matici, s dělením w. */
export function bod(m, p) {
  const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12];
  const y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13];
  const z = m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14];
  const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
  return [x / w, y / w, z / w, w];
}

/** Směr (w = 0) přes matici. */
export const smer = (m, d) => [
  m[0] * d[0] + m[4] * d[1] + m[8] * d[2],
  m[1] * d[0] + m[5] * d[1] + m[9] * d[2],
  m[2] * d[0] + m[6] * d[1] + m[10] * d[2],
];

/** Normálová matice 3×3 (inverzní transponovaná) z modelové matice. */
export function normalova(m) {
  const i = invert(m);
  return new Float32Array([i[0], i[4], i[8], i[1], i[5], i[9], i[2], i[6], i[10]]);
}

// ---------------------------------------------------------------- otočení
/** Rotační matice 3×3 po řádcích z Eulera XYZ ve stupních. */
export function rotace(rot) {
  const [x, y, z] = rot.map((r) => r * DEG);
  const cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y), cz = Math.cos(z), sz = Math.sin(z);
  return [
    [cy * cz, sx * sy * cz - cx * sz, cx * sy * cz + sx * sz],
    [cy * sz, sx * sy * sz + cx * cz, cx * sy * sz - sx * cz],
    [-sy, sx * cy, cx * cy],
  ];
}

/** Zpět z rotační matice (po řádcích) na Euler XYZ ve stupních. */
export function euler(R) {
  const sy = -Math.max(-1, Math.min(1, R[2][0]));
  let x, z;
  const y = Math.asin(sy);
  if (Math.abs(sy) < 0.99999) {
    x = Math.atan2(R[2][1], R[2][2]);
    z = Math.atan2(R[1][0], R[0][0]);
  } else {
    x = Math.atan2(-R[1][2], R[1][1]);
    z = 0;
  }
  return [x / DEG, y / DEG, z / DEG];
}

export const mul3 = (a, b) => a.map((row) => [0, 1, 2].map((c) => row[0] * b[0][c] + row[1] * b[1][c] + row[2] * b[2][c]));
export const aplikuj3 = (R, v) => R.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);

/** Otočení kolem libovolné osy (Rodrigues), řádková 3×3. */
export function kolemOsy(osa, uhel) {
  const [x, y, z] = norm(osa), c = Math.cos(uhel), s = Math.sin(uhel), t = 1 - c;
  return [
    [t * x * x + c, t * x * y - s * z, t * x * z + s * y],
    [t * x * y + s * z, t * y * y + c, t * y * z - s * x],
    [t * x * z - s * y, t * y * z + s * x, t * z * z + c],
  ];
}

/** Modelová matice z polohy, otočení (°) a měřítka. */
export function trs(poz, rot, mer) {
  const R = rotace(rot);
  return new Float32Array([
    R[0][0] * mer[0], R[1][0] * mer[0], R[2][0] * mer[0], 0,
    R[0][1] * mer[1], R[1][1] * mer[1], R[2][1] * mer[1], 0,
    R[0][2] * mer[2], R[1][2] * mer[2], R[2][2] * mer[2], 0,
    poz[0], poz[1], poz[2], 1,
  ]);
}

// ---------------------------------------------------------------- paprsky
/** Průsečík paprsku s trojúhelníkem (Möller–Trumbore), vrací t nebo -1. */
export function paprsekTroj(o, d, a, b, c) {
  const e1 = sub(b, a), e2 = sub(c, a);
  const p = cross(d, e2);
  const det = dot(e1, p);
  if (Math.abs(det) < 1e-9) return -1;
  const inv = 1 / det;
  const s = sub(o, a);
  const u = dot(s, p) * inv;
  if (u < 0 || u > 1) return -1;
  const q = cross(s, e1);
  const v = dot(d, q) * inv;
  if (v < 0 || u + v > 1) return -1;
  const t = dot(e2, q) * inv;
  return t > 1e-6 ? t : -1;
}

/** Parametr t bodu na přímce (bod p, směr a) nejbližšího paprsku (o, d). */
export function nejblizsiNaPrimce(p, a, o, d) {
  const w = sub(p, o);
  const aa = dot(a, a), ad = dot(a, d), dd = dot(d, d), aw = dot(a, w), dw = dot(d, w);
  const den = aa * dd - ad * ad;
  if (Math.abs(den) < 1e-9) return 0;
  return (ad * dw - dd * aw) / den;
}
