// Astro 3D — sítě (meshe)
//
// Síť drží vrcholy (v: plochý seznam x,y,z) a plochy (f: seznam indexů, čtyřúhelníky
// i n-úhelníky) — stejně jako Blender. Pro kreslení se plochy rozloží na trojúhelníky.
// Sítě se nemění na místě: úprava vytvoří novou síť, takže zpět/vpřed i vyrovnávací
// paměť rendereru můžou držet staré odkazy.

import { sub, cross, norm, dot, add } from './mat.js';

const TAU = Math.PI * 2;

// ---------------------------------------------------------------- tvary
export const TVARY = [
  { id: 'krychle', nazev: 'Krychle', ikona: 'b3krychle' },
  { id: 'koule', nazev: 'Koule', ikona: 'b3koule' },
  { id: 'ikokoule', nazev: 'Ikosférická koule', ikona: 'b3koule' },
  { id: 'valec', nazev: 'Válec', ikona: 'b3valec' },
  { id: 'kuzel', nazev: 'Kužel', ikona: 'b3kuzel' },
  { id: 'rovina', nazev: 'Rovina', ikona: 'b3rovina' },
  { id: 'torus', nazev: 'Torus', ikona: 'b3torus' },
  { id: 'strecha', nazev: 'Stříška', ikona: 'b3strecha' },
  { id: 'jehlan', nazev: 'Jehlan', ikona: 'b3jehlan' },
];

/** Výchozí hladké stínování — oblé tvary hladké, hranaté ploché. */
export const HLADKY = { krychle: false, rovina: false, koule: true, ikokoule: true, valec: true, kuzel: true, torus: true, strecha: false, jehlan: false };

export function vytvor(typ) {
  switch (typ) {
    case 'krychle': return krychle();
    case 'koule': return koule(32, 16);
    case 'ikokoule': return ikokoule(2);
    case 'valec': return valec(32, 1, 1);
    case 'kuzel': return valec(32, 1, 0);
    case 'rovina': return { v: [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], f: [[0, 1, 2, 3]] };
    case 'torus': return torus(48, 12, 1, 0.25);
    // sedlová střecha: trojúhelník v rovině YZ protažený podél X (hřeben nahoře, z = 1)
    case 'strecha': return {
      v: [-1, -1, -1, -1, 1, -1, -1, 0, 1, 1, -1, -1, 1, 1, -1, 1, 0, 1],
      f: [[0, 1, 4, 3], [0, 2, 1], [3, 4, 5], [0, 3, 5, 2], [1, 2, 5, 4]],
    };
    case 'jehlan': return {
      v: [-1, -1, -1, 1, -1, -1, 1, 1, -1, -1, 1, -1, 0, 0, 1],
      f: [[0, 3, 2, 1], [0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4]],
    };
    default: return krychle();
  }
}

function krychle() {
  const v = [];
  for (const [x, y, z] of [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]) v.push(x, y, z);
  return { v, f: [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]] };
}

function koule(seg, prs) {
  const v = [0, 0, -1];
  for (let j = 1; j < prs; j++) {
    const th = Math.PI * j / prs - Math.PI / 2;
    for (let i = 0; i < seg; i++) {
      const ph = TAU * i / seg;
      v.push(Math.cos(th) * Math.cos(ph), Math.cos(th) * Math.sin(ph), Math.sin(th));
    }
  }
  v.push(0, 0, 1);
  const top = v.length / 3 - 1;
  const id = (j, i) => 1 + (j - 1) * seg + (i % seg);
  const f = [];
  for (let i = 0; i < seg; i++) f.push([0, id(1, i + 1), id(1, i)]);
  for (let j = 1; j < prs - 1; j++) {
    for (let i = 0; i < seg; i++) f.push([id(j, i), id(j, i + 1), id(j + 1, i + 1), id(j + 1, i)]);
  }
  for (let i = 0; i < seg; i++) f.push([id(prs - 1, i), id(prs - 1, i + 1), top]);
  return { v, f };
}

function ikokoule(deleni) {
  const t = (1 + Math.sqrt(5)) / 2;
  let body = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(norm);
  let f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  for (let k = 0; k < deleni; k++) {
    const cache = new Map();
    const stred = (a, b) => {
      const klic = a < b ? a + ',' + b : b + ',' + a;
      if (!cache.has(klic)) { cache.set(klic, body.length); body.push(norm(add(body[a], body[b]))); }
      return cache.get(klic);
    };
    const nove = [];
    for (const [a, b, c] of f) {
      const ab = stred(a, b), bc = stred(b, c), ca = stred(c, a);
      nove.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    f = nove;
  }
  return { v: body.flat(), f };
}

function valec(seg, rDole, rNahore) {
  const v = [];
  for (let i = 0; i < seg; i++) { const a = TAU * i / seg; v.push(Math.cos(a) * rDole, Math.sin(a) * rDole, -1); }
  const f = [];
  if (rNahore > 0) {
    for (let i = 0; i < seg; i++) { const a = TAU * i / seg; v.push(Math.cos(a) * rNahore, Math.sin(a) * rNahore, 1); }
    for (let i = 0; i < seg; i++) { const n = (i + 1) % seg; f.push([i, n, seg + n, seg + i]); }
    f.push([...Array(seg).keys()].map((i) => seg + i));
  } else {
    v.push(0, 0, 1);
    for (let i = 0; i < seg; i++) f.push([i, (i + 1) % seg, seg]);
  }
  f.push([...Array(seg).keys()].reverse());
  return { v, f };
}

function torus(seg, prs, R, r) {
  const v = [];
  for (let i = 0; i < seg; i++) {
    const a = TAU * i / seg;
    for (let j = 0; j < prs; j++) {
      const b = TAU * j / prs;
      const k = R + r * Math.cos(b);
      v.push(Math.cos(a) * k, Math.sin(a) * k, r * Math.sin(b));
    }
  }
  const f = [];
  const id = (i, j) => (i % seg) * prs + (j % prs);
  for (let i = 0; i < seg; i++) for (let j = 0; j < prs; j++) f.push([id(i, j), id(i + 1, j), id(i + 1, j + 1), id(i, j + 1)]);
  return { v, f };
}

// ---------------------------------------------------------------- pro kreslení
const bodSite = (v, i) => [v[i * 3], v[i * 3 + 1], v[i * 3 + 2]];

/** Normála plochy (Newellova metoda — funguje i pro n-úhelníky). */
function normalaPlochy(v, plocha) {
  let x = 0, y = 0, z = 0;
  for (let k = 0; k < plocha.length; k++) {
    const a = bodSite(v, plocha[k]), b = bodSite(v, plocha[(k + 1) % plocha.length]);
    x += (a[1] - b[1]) * (a[2] + b[2]);
    y += (a[2] - b[2]) * (a[0] + b[0]);
    z += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return norm([x, y, z]);
}

const AUTO_HLADKE = Math.cos(30 * Math.PI / 180);   // jako „Auto Smooth 30°“ v Blenderu

/**
 * Připraví síť pro GPU: trojúhelníky (poloha + normála), hrany jako úsečky
 * a trojúhelníky v lokálních souřadnicích pro výběr myší.
 * Hladké stínování průměruje normály sousedních ploch, ale jen do úhlu 30°,
 * takže válec má oblý plášť a ostré podstavy.
 */
export function priprav(sit, hladke) {
  const { v, f } = sit;
  const fn = f.map((pl) => normalaPlochy(v, pl));
  let kolem = null;
  if (hladke) {
    kolem = Array.from({ length: v.length / 3 }, () => []);
    f.forEach((pl, i) => pl.forEach((vi) => kolem[vi].push(i)));
  }

  const tri = [];
  const pick = [];
  f.forEach((pl, fi) => {
    const normaly = pl.map((vi) => {
      if (!hladke) return fn[fi];
      let s = [0, 0, 0];
      for (const j of kolem[vi]) if (dot(fn[j], fn[fi]) >= AUTO_HLADKE) s = add(s, fn[j]);
      return norm(s);
    });
    for (let k = 1; k < pl.length - 1; k++) {
      for (const c of [0, k, k + 1]) {
        const p = bodSite(v, pl[c]);
        tri.push(p[0], p[1], p[2], normaly[c][0], normaly[c][1], normaly[c][2]);
        pick.push(p);
      }
    }
  });

  const videno = new Set();
  const hrany = [];
  for (const pl of f) {
    for (let k = 0; k < pl.length; k++) {
      const a = pl[k], b = pl[(k + 1) % pl.length];
      const klic = a < b ? a * 1e6 + b : b * 1e6 + a;
      if (videno.has(klic)) continue;
      videno.add(klic);
      hrany.push(...bodSite(v, a), ...bodSite(v, b));
    }
  }

  return { tri: new Float32Array(tri), hrany: new Float32Array(hrany), pick, pocetHran: videno.size };
}

/** Počty pro stavový řádek. */
export function statistika(sit) {
  let troj = 0;
  for (const pl of sit.f) troj += pl.length - 2;
  return { vrcholy: sit.v.length / 3, plochy: sit.f.length, troj };
}

/** Zaokrouhlí souřadnice, ať je soubor menší. */
export const kUlozeni = (sit) => ({ v: sit.v.map((x) => Math.round(x * 1e5) / 1e5), f: sit.f });

export const platna = (sit) => sit && Array.isArray(sit.v) && Array.isArray(sit.f) && sit.v.length % 3 === 0
  && sit.f.every((pl) => Array.isArray(pl) && pl.length >= 3 && pl.every((i) => Number.isInteger(i) && i >= 0 && i < sit.v.length / 3));

export { sub, cross };
