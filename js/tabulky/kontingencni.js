// AstroTabulky — kontingenční tabulky (PivotTable). Ukázková verze: jen čtení zdroje dat (pro analýzu),
// samotné kontingenční tabulky jsou v plné verzi AstroOS.
//
// Definice žije v list.kontingencni: { id, nazev, zdroj: 'List1!$A$1:$D$50', r, c,
// radky: [pole], sloupce: [pole], hodnoty: [{ pole, fn }], filtry: [{ pole, hodnota }] }.
// Výstup se zapisuje do buněk jako hodnoty (jako Excel — tabulka se obnovuje tlačítkem Aktualizovat).

import { rozeberOblast, klic } from './adresy.js';
import { slozStyl } from './sesit.js';
import { jeChyba, formatuj } from './format.js';
import { porovnej } from './vzorce.js';

export const FUNKCE_HODNOT = {
  SUMA: { nazev: 'Součet', fn: (x) => x.reduce((a, b) => a + b, 0) },
  POČET: { nazev: 'Počet', fn: (x, vse) => vse.length, vse: true },
  PRŮMĚR: { nazev: 'Průměr', fn: (x) => (x.length ? x.reduce((a, b) => a + b, 0) / x.length : null) },
  MAX: { nazev: 'Maximum', fn: (x) => (x.length ? Math.max(...x) : null) },
  MIN: { nazev: 'Minimum', fn: (x) => (x.length ? Math.min(...x) : null) },
  SOUČIN: { nazev: 'Součin', fn: (x) => (x.length ? x.reduce((a, b) => a * b, 1) : null) },
};

/** Pole zdroje: [{ nazev, c, cisla }] a řádky dat. */
export function zdrojKontingencni(S, def) {
  const o = rozeberOblast(def.zdroj.replace(/\$/g, ''));
  if (!o) return null;
  const l = o.list ? S.listPodleJmena(o.list) : S.list;
  if (!l) return null;
  const u = S.rozsah(l);
  const r2 = Math.min(o.r2, u.r);
  const pole = [];
  for (let c = o.c1; c <= o.c2; c++) pole.push({ nazev: String(S.hodnota(l, o.r1, c) ?? `Sloupec${c - o.c1 + 1}`), c, nf: S.stylBunky(l, o.r1 + 1, c)?.nf });
  const radky = [];
  for (let r = o.r1 + 1; r <= r2; r++) {
    const radek = pole.map((p) => S.hodnota(l, r, p.c));
    if (radek.every((v) => v === null)) continue;
    radky.push(radek);
  }
  pole.forEach((p, i) => { p.cisla = radky.filter((r) => typeof r[i] === 'number').length > radky.length / 2; p.i = i; });
  return { pole, radky, list: l, oblast: o };
}


export const JEN_PLNA = 'Kontingenční tabulky jsou jen v plné verzi AstroOS.';

/** Ukázková verze kontingenční tabulky nesestavuje. */
export function vytvorKontingencni() {
  throw new Error(JEN_PLNA);
}

export function kontingencniV(list, r, c) {
  return (list.kontingencni || []).find((k) => k.vystup && r >= k.vystup.r1 && r <= k.vystup.r2 && c >= k.vystup.c1 && c <= k.vystup.c2) || null;
}