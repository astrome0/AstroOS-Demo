// AstroOS — štítky souborů a barvy složek (Soubory)
//
// Jako v macOS: 7 barevných štítků, položka jich může mít víc (`uzel.tagy = ['cervena', …]`), názvy jdou
// přejmenovat (State.stitkyNazvy). Barva složky (`uzel.barva`) jen přebarví ikonu složky — v Souborech i na ploše.
// Obojí žije přímo v uzlu disku, takže přežije přesun, kopii, přejmenování i uložení souboru (fs.js write).

import { State } from './state.js';
import * as FS from './fs.js';
import { bus } from './util.js';

export const STITKY = [
  { id: 'cervena', nazev: 'Červená', barva: '#ef5350' },
  { id: 'oranzova', nazev: 'Oranžová', barva: '#f59a3c' },
  { id: 'zluta', nazev: 'Žlutá', barva: '#f2c94c' },
  { id: 'zelena', nazev: 'Zelená', barva: '#4fc46a' },
  { id: 'modra', nazev: 'Modrá', barva: '#4aa3e8' },
  { id: 'fialova', nazev: 'Fialová', barva: '#a077f0' },
  { id: 'seda', nazev: 'Šedá', barva: '#8a97a0' },
];

/** Barvy ikony složky: zadní díl, přední díl, světlá hrana (výchozí = žlutá z soubory.js). */
export const BARVY_SLOZEK = [
  { id: 'cervena', nazev: 'Červená', tecka: '#ef6b62', zad: '#c24640', pred: '#ef6b62', hrana: '#ffb3ad' },
  { id: 'oranzova', nazev: 'Oranžová', tecka: '#f59a3c', zad: '#cf7424', pred: '#f59a3c', hrana: '#ffd29e' },
  { id: 'zelena', nazev: 'Zelená', tecka: '#5cc46f', zad: '#3b9550', pred: '#5cc46f', hrana: '#b9f2c3' },
  { id: 'modra', nazev: 'Modrá', tecka: '#4aa3e8', zad: '#2c78bd', pred: '#4aa3e8', hrana: '#b8ddff' },
  { id: 'fialova', nazev: 'Fialová', tecka: '#a077f0', zad: '#764dc4', pred: '#a077f0', hrana: '#dccaff' },
  { id: 'ruzova', nazev: 'Růžová', tecka: '#f07f9c', zad: '#c24d76', pred: '#f07f9c', hrana: '#ffc6d5' },
  { id: 'seda', nazev: 'Šedá', tecka: '#95a2ab', zad: '#69767f', pred: '#95a2ab', hrana: '#d9e0e4' },
  { id: 'cerna', nazev: 'Grafitová', tecka: '#4a545b', zad: '#2b3237', pred: '#4a545b', hrana: '#88949c' },
];

export const stitek = (id) => STITKY.find((s) => s.id === id);
export const nazevStitku = (id) => (State.get('stitkyNazvy') || {})[id] || stitek(id)?.nazev || id;
export const barvaSlozky = (id) => BARVY_SLOZEK.find((b) => b.id === id) || null;
export const stitkyUzlu = (uzel) => (Array.isArray(uzel?.tagy) ? uzel.tagy.filter((t) => stitek(t)) : []);

export function prejmenujStitek(id, nazev) {
  const vse = { ...(State.get('stitkyNazvy') || {}) };
  if (nazev && nazev !== stitek(id)?.nazev) vse[id] = nazev; else delete vse[id];
  State.set('stitkyNazvy', vse);
  bus.emit('fs:change', '/');   // ať se překreslí boční lišta i tečky
}

/** Mají všechny cesty daný štítek? (pro fajfku v nabídce) */
export const majiVsechny = (cesty, id) => cesty.length > 0 && cesty.every((c) => stitkyUzlu(FS.get(c)).includes(id));

/** Přepne štítek: když ho mají všechny, odebere ho všem, jinak ho všem přidá. */
export function prepniStitek(cesty, id) {
  const odebrat = majiVsechny(cesty, id);
  for (const c of cesty) {
    const u = FS.get(c);
    if (!u) continue;
    const t = stitkyUzlu(u).filter((x) => x !== id);
    if (!odebrat) t.push(id);
    if (t.length) u.tagy = STITKY.map((s) => s.id).filter((x) => t.includes(x)); else delete u.tagy;
  }
  FS.save(FS.dirname(cesty[0]));
}

export function nastavBarvu(cesty, id) {
  for (const c of cesty) {
    const u = FS.get(c);
    if (!FS.isDir(u)) continue;
    if (id) u.barva = id; else delete u.barva;
  }
  FS.save(FS.dirname(cesty[0]));
}

/** Kolik položek na disku má štítek (pro boční lištu). */
export function pocty() {
  const p = {};
  const walk = (u, koren = false) => {
    for (const [jm, n] of Object.entries(u.d)) {
      if (koren && '/' + jm === FS.TRASH) continue;   // co je v koši, se nepočítá
      for (const t of stitkyUzlu(n)) p[t] = (p[t] || 0) + 1;
      if (FS.isDir(n)) walk(n);
    }
  };
  walk(FS.get('/'), true);
  return p;
}
