// Astro 3D — operace v režimu úprav (Tab)
//
// Všechno pracuje s lokálními souřadnicemi sítě a vrací NOVOU síť — původní zůstane
// nedotčená pro zpět/vpřed. Hrana je klíč z dvojice vrcholů (menší·2²⁰ + větší).
// Výběr se vrací jako { v, e, f } (množiny vrcholů, klíčů hran, indexů ploch);
// co operace nevrátí, dopočítá aplikace podle režimu výběru.

const POSUN = 1048576;
export const klic = (a, b) => (a < b ? a * POSUN + b : b * POSUN + a);
export const vrcholyHrany = (k) => [Math.floor(k / POSUN), k % POSUN];

const bod = (v, i) => [v[i * 3], v[i * 3 + 1], v[i * 3 + 2]];
const stred = (v, idx) => {
  const s = [0, 0, 0];
  for (const i of idx) { s[0] += v[i * 3]; s[1] += v[i * 3 + 1]; s[2] += v[i * 3 + 2]; }
  return s.map((x) => x / (idx.length || 1));
};
const pridejBod = (v, p) => { v.push(p[0], p[1], p[2]); return v.length / 3 - 1; };

// ---------------------------------------------------------------- topologie
const cacheTopo = new WeakMap();

/** Hrany (s plochami, které je sdílí), plochy kolem vrcholů a sousedé vrcholů. Počítá se jednou na síť. */
export function topologie(sit) {
  let t = cacheTopo.get(sit);
  if (t) return t;
  const hrany = new Map();
  const nV = sit.v.length / 3;
  const vPlochy = Array.from({ length: nV }, () => []);
  const sousede = Array.from({ length: nV }, () => new Set());
  sit.f.forEach((pl, fi) => {
    for (let k = 0; k < pl.length; k++) {
      const a = pl[k], b = pl[(k + 1) % pl.length];
      const kl = klic(a, b);
      let h = hrany.get(kl);
      if (!h) { h = { a: Math.min(a, b), b: Math.max(a, b), plochy: [] }; hrany.set(kl, h); }
      h.plochy.push(fi);
      vPlochy[a].push(fi);
      sousede[a].add(b); sousede[b].add(a);
    }
  });
  t = { hrany, vPlochy, sousede };
  cacheTopo.set(sit, t);
  return t;
}

/** Hrany plochy jako klíče. */
export const hranyPlochy = (pl) => pl.map((a, k) => klic(a, pl[(k + 1) % pl.length]));

/** Trojúhelníky s indexem plochy (pro klikání na plochy). */
export function trojuhelniky(sit) {
  const out = [];
  sit.f.forEach((pl, fi) => {
    for (let k = 1; k < pl.length - 1; k++) out.push([pl[0], pl[k], pl[k + 1], fi]);
  });
  return out;
}

export function normalaPlochy(v, pl) {
  let x = 0, y = 0, z = 0;
  for (let k = 0; k < pl.length; k++) {
    const a = bod(v, pl[k]), b = bod(v, pl[(k + 1) % pl.length]);
    x += (a[1] - b[1]) * (a[2] + b[2]);
    y += (a[2] - b[2]) * (a[0] + b[0]);
    z += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}

export const stredPlochy = (sit, fi) => stred(sit.v, sit.f[fi]);

/**
 * Vyhodí nepoužité vrcholy, zdvojené indexy za sebou a plochy s méně než 3 vrcholy.
 * Vrací { sit, mapa } — mapa[stary] = novy nebo -1, mapaPloch[stara] = nova nebo -1.
 */
export function uklid(sit) {
  const f0 = [];
  const mapaPloch = [];
  sit.f.forEach((pl) => {
    const cista = pl.filter((x, k) => x !== pl[(k + 1) % pl.length]);
    if (cista.length >= 3 && new Set(cista).size === cista.length) { mapaPloch.push(f0.length); f0.push(cista); } else mapaPloch.push(-1);
  });
  const nV = sit.v.length / 3;
  const pouzite = new Uint8Array(nV);
  for (const pl of f0) for (const i of pl) pouzite[i] = 1;
  const mapa = new Int32Array(nV).fill(-1);
  const v = [];
  for (let i = 0; i < nV; i++) if (pouzite[i]) { mapa[i] = v.length / 3; v.push(sit.v[i * 3], sit.v[i * 3 + 1], sit.v[i * 3 + 2]); }
  return { sit: { v, f: f0.map((pl) => pl.map((i) => mapa[i])) }, mapa, mapaPloch };
}

/** Přepočítá výběr přes mapy z uklid(). */
export function premapuj(vyber, mapa, mapaPloch) {
  const out = { v: new Set(), e: new Set(), f: new Set() };
  for (const i of vyber.v || []) if (mapa[i] >= 0) out.v.add(mapa[i]);
  for (const k of vyber.e || []) { const [a, b] = vrcholyHrany(k); if (mapa[a] >= 0 && mapa[b] >= 0) out.e.add(klic(mapa[a], mapa[b])); }
  for (const fi of vyber.f || []) if (mapaPloch && mapaPloch[fi] >= 0) out.f.add(mapaPloch[fi]);
  return out;
}

function hotovo(sit, vyber) {
  const u = uklid(sit);
  return { sit: u.sit, vyber: premapuj(vyber, u.mapa, u.mapaPloch) };
}

// ---------------------------------------------------------------- vytažení (E)
/** Vytáhne souvislé oblasti vybraných ploch; bočnice vzniknou na okraji oblasti. */
export function vytahniPlochy(sit, plochy) {
  const S = new Set(plochy);
  const v = sit.v.slice();
  const kopie = new Map();
  const dup = (i) => { if (!kopie.has(i)) kopie.set(i, pridejBod(v, bod(sit.v, i))); return kopie.get(i); };
  const pocet = new Map(), smer = new Map();
  for (const fi of S) {
    const pl = sit.f[fi];
    for (let k = 0; k < pl.length; k++) {
      const a = pl[k], b = pl[(k + 1) % pl.length], kl = klic(a, b);
      pocet.set(kl, (pocet.get(kl) || 0) + 1);
      smer.set(kl, [a, b]);
    }
  }
  const f = sit.f.map((pl, fi) => (S.has(fi) ? pl.map(dup) : pl.slice()));
  for (const [kl, c] of pocet) {
    if (c !== 1) continue;
    const [a, b] = smer.get(kl);
    f.push([a, b, dup(b), dup(a)]);
  }
  // průměrná normála oblasti — po ní se pak táhne
  let n = [0, 0, 0];
  for (const fi of S) { const m = normalaPlochy(sit.v, sit.f[fi]); n = [n[0] + m[0], n[1] + m[1], n[2] + m[2]]; }
  const vysledek = hotovo({ v, f }, { v: [...kopie.values()], f: [...S] });
  return { ...vysledek, normala: n };
}

/** Vytáhne okrajové hrany (třeba okraj roviny) do nových čtyřúhelníků. */
export function vytahniHrany(sit, hrany) {
  const topo = topologie(sit);
  const v = sit.v.slice();
  const f = sit.f.map((pl) => pl.slice());
  const kopie = new Map();
  const dup = (i) => { if (!kopie.has(i)) kopie.set(i, pridejBod(v, bod(sit.v, i))); return kopie.get(i); };
  const noveHrany = [];
  for (const kl of hrany) {
    const h = topo.hrany.get(kl);
    if (!h || h.plochy.length !== 1) continue;
    const pl = sit.f[h.plochy[0]];
    const k = pl.findIndex((x, j) => klic(x, pl[(j + 1) % pl.length]) === kl);
    const a = pl[k], b = pl[(k + 1) % pl.length];
    f.push([b, a, dup(a), dup(b)]);
    noveHrany.push(klic(dup(a), dup(b)));
  }
  if (!noveHrany.length) return null;
  return hotovo({ v, f }, { v: [...kopie.values()], e: noveHrany });
}

// ---------------------------------------------------------------- duplikát (Shift+D)
export function duplikujPlochy(sit, plochy) {
  const v = sit.v.slice();
  const f = sit.f.map((pl) => pl.slice());
  const kopie = new Map();
  const dup = (i) => { if (!kopie.has(i)) kopie.set(i, pridejBod(v, bod(sit.v, i))); return kopie.get(i); };
  const nove = [];
  for (const fi of plochy) { nove.push(f.length); f.push(sit.f[fi].map(dup)); }
  return { sit: { v, f }, vyber: { v: new Set(kopie.values()), f: new Set(nove), e: new Set() } };
}

// ---------------------------------------------------------------- vsazení (I)
/** Každá vybraná plocha dostane menší kopii uvnitř a prstenec čtyřúhelníků kolem. t = 0…1. */
export function vsad(sit, plochy, t) {
  const v = sit.v.slice();
  const f = sit.f.map((pl) => pl.slice());
  const noveV = [];
  for (const fi of plochy) {
    const pl = sit.f[fi];
    const c = stred(sit.v, pl);
    const vnitrni = pl.map((i) => {
      const p = bod(sit.v, i);
      const j = pridejBod(v, [p[0] + (c[0] - p[0]) * t, p[1] + (c[1] - p[1]) * t, p[2] + (c[2] - p[2]) * t]);
      noveV.push(j);
      return j;
    });
    f[fi] = vnitrni;
    for (let k = 0; k < pl.length; k++) {
      const k2 = (k + 1) % pl.length;
      f.push([pl[k], pl[k2], vnitrni[k2], vnitrni[k]]);
    }
  }
  return { sit: { v, f }, vyber: { v: new Set(noveV), f: new Set(plochy), e: new Set() } };
}

// ---------------------------------------------------------------- mazání (X)
export function smaz(sit, druh, vyber) {
  let f;
  if (druh === 'vrcholy') f = sit.f.filter((pl) => !pl.some((i) => vyber.v.has(i)));
  else if (druh === 'hrany') f = sit.f.filter((pl) => !hranyPlochy(pl).some((k) => vyber.e.has(k)));
  else f = sit.f.filter((pl, fi) => !vyber.f.has(fi));
  return hotovo({ v: sit.v.slice(), f }, {});
}

// ---------------------------------------------------------------- spojení (M)
function spojSkupiny(sit, skupiny) {
  const v = sit.v.slice();
  const cil = new Map();
  for (const sk of skupiny) {
    if (sk.length < 2) continue;
    const c = stred(sit.v, sk);
    v[sk[0] * 3] = c[0]; v[sk[0] * 3 + 1] = c[1]; v[sk[0] * 3 + 2] = c[2];
    for (const i of sk) cil.set(i, sk[0]);
  }
  const f = sit.f.map((pl) => pl.map((i) => cil.get(i) ?? i));
  return hotovo({ v, f }, { v: [...new Set(cil.values())] });
}

export const spojDoStredu = (sit, vrcholy) => spojSkupiny(sit, [[...vrcholy]]);

export function spojPodleVzdalenosti(sit, vrcholy, vzd = 1e-4) {
  const idx = [...vrcholy];
  const rodic = new Map(idx.map((i) => [i, i]));
  const najdi = (i) => { while (rodic.get(i) !== i) i = rodic.get(i); return i; };
  for (let a = 0; a < idx.length; a++) {
    for (let b = a + 1; b < idx.length; b++) {
      const p = bod(sit.v, idx[a]), q = bod(sit.v, idx[b]);
      if (Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) <= vzd) rodic.set(najdi(idx[b]), najdi(idx[a]));
    }
  }
  const skupiny = new Map();
  for (const i of idx) { const r = najdi(i); if (!skupiny.has(r)) skupiny.set(r, []); skupiny.get(r).push(i); }
  const pred = sit.v.length / 3;
  const r = spojSkupiny(sit, [...skupiny.values()]);
  return { ...r, odebrano: pred - r.sit.v.length / 3 };
}

// ---------------------------------------------------------------- vyplnění (F)
/** Z vybraných okrajových hran udělá plochu (zalepí díru). */
export function vypln(sit, vrcholy) {
  const topo = topologie(sit);
  const dalsi = new Map();
  for (const [kl, h] of topo.hrany) {
    if (h.plochy.length !== 1 || !vrcholy.has(h.a) || !vrcholy.has(h.b)) continue;
    const pl = sit.f[h.plochy[0]];
    const k = pl.findIndex((x, j) => klic(x, pl[(j + 1) % pl.length]) === kl);
    // nová plocha jde po hraně opačně než sousední plocha
    dalsi.set(pl[(k + 1) % pl.length], pl[k]);
  }
  if (dalsi.size < 3) return null;
  const start = dalsi.keys().next().value;
  const smycka = [start];
  let x = dalsi.get(start);
  while (x !== undefined && x !== start && smycka.length <= dalsi.size) { smycka.push(x); x = dalsi.get(x); }
  if (x !== start || smycka.length < 3) return null;
  const f = sit.f.map((pl) => pl.slice());
  f.push(smycka);
  return { sit: { v: sit.v.slice(), f }, vyber: { v: new Set(smycka), f: new Set([f.length - 1]), e: new Set() } };
}

// ---------------------------------------------------------------- rozdělení (Subdivide)
/** Vybrané plochy se rozpadnou na čtyřúhelníky přes středy hran a střed plochy; sousedé dostanou nové body do obrysu. */
export function rozdel(sit, plochy) {
  const S = new Set(plochy);
  const v = sit.v.slice();
  const pul = new Map();
  const stredHrany = (a, b) => {
    const kl = klic(a, b);
    if (!pul.has(kl)) { const p = bod(sit.v, a), q = bod(sit.v, b); pul.set(kl, pridejBod(v, [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2])); }
    return pul.get(kl);
  };
  for (const fi of S) { const pl = sit.f[fi]; pl.forEach((a, k) => stredHrany(a, pl[(k + 1) % pl.length])); }
  const f = [];
  const nove = [];
  sit.f.forEach((pl, fi) => {
    if (S.has(fi)) {
      const c = pridejBod(v, stred(sit.v, pl));
      const n = pl.length;
      for (let k = 0; k < n; k++) {
        nove.push(f.length);
        f.push([pl[k], stredHrany(pl[k], pl[(k + 1) % n]), c, stredHrany(pl[(k - 1 + n) % n], pl[k])]);
      }
    } else {
      const obrys = [];
      pl.forEach((a, k) => {
        obrys.push(a);
        const kl = klic(a, pl[(k + 1) % pl.length]);
        if (pul.has(kl)) obrys.push(pul.get(kl));
      });
      f.push(obrys);
    }
  });
  const vv = new Set();
  for (const fi of nove) for (const i of f[fi]) vv.add(i);
  return { sit: { v, f }, vyber: { v: vv, f: new Set(nove), e: new Set() } };
}

// ---------------------------------------------------------------- vyhlazení (Catmull–Clark)
export function catmullClark(sit) {
  const topo = topologie(sit);
  const { v } = sit;
  const nV = v.length / 3;
  const fp = sit.f.map((pl) => stred(v, pl));
  const hranyIdx = new Map();
  const out = [];
  const okrajove = Array.from({ length: nV }, () => []);
  const kolem = Array.from({ length: nV }, () => ({ hrany: [], plochy: new Set() }));
  // nové polohy původních vrcholů
  for (const [kl, h] of topo.hrany) {
    for (const x of [h.a, h.b]) { kolem[x].hrany.push(h); for (const fi of h.plochy) kolem[x].plochy.add(fi); }
    if (h.plochy.length === 1) { okrajove[h.a].push(h.b); okrajove[h.b].push(h.a); }
    hranyIdx.set(kl, null);
  }
  for (let i = 0; i < nV; i++) {
    const P = bod(v, i);
    const k = kolem[i];
    if (!k.hrany.length) { out.push(...P); continue; }
    if (okrajove[i].length >= 2) {
      const a = bod(v, okrajove[i][0]), b = bod(v, okrajove[i][1]);
      out.push(...[0, 1, 2].map((j) => P[j] * 0.75 + (a[j] + b[j]) * 0.125));
      continue;
    }
    const n = k.hrany.length;
    const Q = [0, 0, 0], R = [0, 0, 0];
    for (const fi of k.plochy) for (let j = 0; j < 3; j++) Q[j] += fp[fi][j] / k.plochy.size;
    for (const h of k.hrany) { const a = bod(v, h.a), b = bod(v, h.b); for (let j = 0; j < 3; j++) R[j] += (a[j] + b[j]) / 2 / n; }
    out.push(...[0, 1, 2].map((j) => (Q[j] + 2 * R[j] + (n - 3) * P[j]) / n));
  }
  // body hran
  for (const [kl, h] of topo.hrany) {
    const a = bod(v, h.a), b = bod(v, h.b);
    let p;
    if (h.plochy.length === 2) {
      const f1 = fp[h.plochy[0]], f2 = fp[h.plochy[1]];
      p = [0, 1, 2].map((j) => (a[j] + b[j] + f1[j] + f2[j]) / 4);
    } else p = [0, 1, 2].map((j) => (a[j] + b[j]) / 2);
    hranyIdx.set(kl, out.length / 3);
    out.push(...p);
  }
  // body ploch a nové čtyřúhelníky
  const f = [];
  sit.f.forEach((pl, fi) => {
    const c = out.length / 3;
    out.push(...fp[fi]);
    const n = pl.length;
    for (let k = 0; k < n; k++) {
      f.push([pl[k], hranyIdx.get(klic(pl[k], pl[(k + 1) % n])), c, hranyIdx.get(klic(pl[(k - 1 + n) % n], pl[k]))]);
    }
  });
  return { v: out, f };
}

// ---------------------------------------------------------------- smyčky
/** Hrana naproti v čtyřúhelníku, nebo null. */
function protejsi(pl, kl) {
  if (pl.length !== 4) return null;
  for (let j = 0; j < 4; j++) if (klic(pl[j], pl[(j + 1) % 4]) === kl) return klic(pl[(j + 2) % 4], pl[(j + 3) % 4]);
  return null;
}

/** Prstenec hran napříč čtyřúhelníky (pro řez smyčkou a výběr pásu ploch). */
export function prstenec(sit, kl0) {
  const topo = topologie(sit);
  const h0 = topo.hrany.get(kl0);
  if (!h0) return null;
  const hrany = new Set([kl0]), plochy = new Set();
  for (const f0 of h0.plochy) {
    let kl = kl0, fi = f0;
    while (fi !== undefined && !plochy.has(fi)) {
      const op = protejsi(sit.f[fi], kl);
      if (op === null) break;
      plochy.add(fi);
      if (hrany.has(op)) break;          // uzavřený prstenec
      hrany.add(op);
      kl = op;
      fi = topo.hrany.get(op).plochy.find((x) => x !== fi);
    }
  }
  return { hrany, plochy };
}

/** Řez smyčkou (Ctrl+R): rozpůlí všechny hrany prstence a jeho čtyřúhelníky. */
export function rezSmyckou(sit, kl0, podil = 0.5) {
  const pr = prstenec(sit, kl0);
  if (!pr || !pr.plochy.size) return null;
  const v = sit.v.slice();
  const pul = new Map();
  for (const kl of pr.hrany) {
    const [a, b] = vrcholyHrany(kl);
    const p = bod(sit.v, a), q = bod(sit.v, b);
    pul.set(kl, pridejBod(v, [0, 1, 2].map((j) => p[j] + (q[j] - p[j]) * podil)));
  }
  const f = [];
  const nove = new Set();
  sit.f.forEach((pl, fi) => {
    if (pr.plochy.has(fi)) {
      // natočit tak, aby hrany prstence byly (p0,p1) a (p2,p3)
      let j = 0;
      while (!pul.has(klic(pl[j], pl[(j + 1) % 4])) || !pul.has(klic(pl[(j + 2) % 4], pl[(j + 3) % 4]))) j++;
      const [p0, p1, p2, p3] = [0, 1, 2, 3].map((x) => pl[(j + x) % 4]);
      const m01 = pul.get(klic(p0, p1)), m23 = pul.get(klic(p2, p3));
      f.push([p0, m01, m23, p3], [m01, p1, p2, m23]);
    } else {
      const obrys = [];
      pl.forEach((a, k) => {
        obrys.push(a);
        const kl = klic(a, pl[(k + 1) % pl.length]);
        if (pul.has(kl)) obrys.push(pul.get(kl));
      });
      f.push(obrys);
    }
  });
  for (const i of pul.values()) nove.add(i);
  const e = new Set();
  const noveSet = new Set(nove);
  f.forEach((pl) => hranyPlochy(pl).forEach((kl) => { const [a, b] = vrcholyHrany(kl); if (noveSet.has(a) && noveSet.has(b)) e.add(kl); }));
  return { sit: { v, f }, vyber: { v: nove, e, f: new Set() } };
}

/** Body pro náhled řezu — středy hran prstence po sobě (lokální souřadnice). */
export function nahledRezu(sit, kl0) {
  const pr = prstenec(sit, kl0);
  if (!pr) return null;
  const topo = topologie(sit);
  // seřadit: projít prstenec znovu od jednoho konce
  const body = [];
  for (const kl of pr.hrany) {
    const [a, b] = vrcholyHrany(kl);
    const p = bod(sit.v, a), q = bod(sit.v, b);
    body.push({ kl, p: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2] });
  }
  // úsečky mezi středy hran, které sdílí plochu prstence
  const usecky = [];
  for (const fi of pr.plochy) {
    const ks = hranyPlochy(sit.f[fi]).filter((kl) => pr.hrany.has(kl));
    if (ks.length === 2) usecky.push([body.find((x) => x.kl === ks[0]).p, body.find((x) => x.kl === ks[1]).p]);
  }
  return { usecky, pocet: pr.hrany.size, topo };
}

/** Smyčka hran (Alt+klik): pokračuje přes vrcholy se čtyřmi hranami „rovně“. */
export function smyckaHran(sit, kl0) {
  const topo = topologie(sit);
  const h0 = topo.hrany.get(kl0);
  if (!h0) return new Set();
  const vysledek = new Set([kl0]);
  for (const [od, k] of [[h0.a, h0.b], [h0.b, h0.a]]) {
    let u = od, w = k, kl = kl0;
    for (let krok = 0; krok < 10000; krok++) {
      if (topo.sousede[w].size !== 4) break;
      const plochyHrany = topo.hrany.get(kl).plochy;
      if (plochyHrany.length !== 2) break;
      const zakazane = new Set();
      for (const fi of plochyHrany) for (const x of sit.f[fi]) zakazane.add(x);
      const dalsi = [...topo.sousede[w]].filter((x) => !zakazane.has(x));
      if (dalsi.length !== 1) break;
      const nk = klic(w, dalsi[0]);
      if (vysledek.has(nk)) break;
      vysledek.add(nk);
      u = w; w = dalsi[0]; kl = nk;
    }
    void u;
  }
  return vysledek;
}

/** Vše propojené s danými vrcholy (L / Ctrl+L). */
export function propojene(sit, vrcholy) {
  const topo = topologie(sit);
  const videno = new Set(vrcholy);
  const fronta = [...vrcholy];
  while (fronta.length) {
    const i = fronta.pop();
    for (const j of topo.sousede[i]) if (!videno.has(j)) { videno.add(j); fronta.push(j); }
  }
  return videno;
}

/** Přidá tvar do sítě (Shift+A v režimu úprav). */
export function pripoj(sit, dalsi) {
  const posun = sit.v.length / 3;
  const f = sit.f.map((pl) => pl.slice());
  const nove = new Set();
  for (const pl of dalsi.f) { nove.add(f.length); f.push(pl.map((i) => i + posun)); }
  const vv = new Set();
  for (let i = 0; i < dalsi.v.length / 3; i++) vv.add(i + posun);
  return { sit: { v: [...sit.v, ...dalsi.v], f }, vyber: { v: vv, f: nove, e: new Set() } };
}
