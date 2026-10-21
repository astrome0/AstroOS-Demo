// AstroOS — historie verzí souborů (jako Historie souborů / Předchozí verze ve Windows)
//
// Před přepsáním souboru (FS.write) se jeho dosavadní obsah uloží jako verze — nejvýš jednou za INTERVAL
// na soubor, nejvýš MAX_VERZI na soubor. Verze leží v IndexedDB („astroos-verze“), ne v localStorage,
// takže nezabírají místo z 5 MB disku. Soubor dostane stabilní `id` (v uzlu), díky kterému historie přežije
// přejmenování i přesun; kopie dostane čistý start (fs.js copy). Skryté složky (.astroai, .posta…),
// /system, /dočasné a koš se nesledují — zapisují se často a uživatel jejich verze nehledá.

import { State } from './state.js';
import * as FS from './fs.js';
import { bus } from './util.js';
import { aktivniId } from './profil.js';

// každá verze nese účet (ucet), ať úklid jednoho uživatele nesmaže verze jiného (ucty.js)
const mojeVerze = (v) => (v.ucet || '') === aktivniId();

export const INTERVAL = 5 * 60e3;
export const MAX_VERZI = 30;
const DB = 'astroos-verze', STORE = 'verze';

export const zapnuto = () => State.get('historieVerzi') !== false;
export const nastavZapnuto = (v) => State.set('historieVerzi', !!v);

// ---------------------------------------------------------------- IndexedDB
let dbSlib = null;
function db() {
  if (!dbSlib) {
    dbSlib = new Promise((ok, chyba) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => {
        const s = r.result.createObjectStore(STORE, { keyPath: 'klic', autoIncrement: true });
        s.createIndex('soubor', 'soubor');
      };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => { dbSlib = null; chyba(r.error); };
    });
  }
  return dbSlib;
}
const pozadavek = (r) => new Promise((ok, chyba) => { r.onsuccess = () => ok(r.result); r.onerror = () => chyba(r.error); });
async function store(rezim = 'readonly') { return (await db()).transaction(STORE, rezim).objectStore(STORE); }

/** Verze souboru podle id, nejnovější první: [{ klic, soubor, cesta, c, m, ulozeno, velikost }]. */
export async function seznam(id) {
  if (!id) return [];
  try {
    const s = await store();
    const vse = await pozadavek(s.index('soubor').getAll(id));
    return vse.sort((a, b) => b.m - a.m);
  } catch { return []; }
}

export async function smazVerzi(klic) {
  const s = await store('readwrite');
  await pozadavek(s.delete(klic));
  bus.emit('verze');
}

async function uloz(zaznam) {
  try {
    const s = await store('readwrite');
    await pozadavek(s.add(zaznam));
    // nejstarší nad limit pryč
    const vse = (await seznam(zaznam.soubor));
    for (const v of vse.slice(MAX_VERZI)) await smazVerzi(v.klic);
    bus.emit('verze');
  } catch { /* bez IndexedDB (soukromé okno) se historie prostě nevede */ }
}

/** Kolik verzí a místa historie zabírá; `sirotci` = verze souborů, které už na disku nejsou. */
export async function statistika() {
  try {
    const s = await store();
    const vse = (await pozadavek(s.getAll())).filter(mojeVerze);
    const zive = zivaId();
    const sirotci = vse.filter((v) => !zive.has(v.soubor));
    return {
      pocet: vse.length, velikost: vse.reduce((a, v) => a + v.velikost, 0),
      souboru: new Set(vse.map((v) => v.soubor)).size,
      sirotku: sirotci.length, sirotciVelikost: sirotci.reduce((a, v) => a + v.velikost, 0),
    };
  } catch { return { pocet: 0, velikost: 0, souboru: 0, sirotku: 0, sirotciVelikost: 0, nedostupne: true }; }
}

/** Smaže verze souborů, které už na disku nejsou (smazané natrvalo). Vrací počet. */
export async function smazSirotky() {
  const s = await store('readwrite');
  const vse = await pozadavek(s.getAll());
  const zive = zivaId();
  let n = 0;
  for (const v of vse) if (mojeVerze(v) && !zive.has(v.soubor)) { s.delete(v.klic); n++; }
  bus.emit('verze');
  return n;
}

/** Smaže celou historii přihlášeného účtu (ostatních účtů se nedotkne). */
export async function smazVse() {
  const s = await store('readwrite');
  for (const v of await pozadavek(s.getAll())) if (mojeVerze(v)) s.delete(v.klic);
  bus.emit('verze');
}

/** Při smazání účtu (ucty.js). */
export async function smazVerzeUctu(ucet) {
  const s = await store('readwrite');
  for (const v of await pozadavek(s.getAll())) if ((v.ucet || '') === ucet) s.delete(v.klic);
}

/** id všech souborů na disku (i v koši — ty se ještě dají obnovit). */
function zivaId() {
  const ids = new Set();
  const walk = (u) => { for (const n of Object.values(u.d)) { if (n.id) ids.add(n.id); if (FS.isDir(n)) walk(n); } };
  walk(FS.get('/'));
  return ids;
}

// ---------------------------------------------------------------- sledování zápisů
export function sledovano(cesta) {
  if (!cesta.startsWith(FS.HOME + '/')) return false;   // /system, /dočasné, koš, kód aplikací z Obchodu
  return !cesta.slice(FS.HOME.length + 1).split('/').some((s) => s.startsWith('.'));
}
const noveId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

FS.nastavHlidaceZapisu((cesta, stary, o) => {
  if (!zapnuto() || !sledovano(cesta)) return null;
  if (!o.snimek && Date.now() - (stary.verzeCas || 0) < INTERVAL) return null;
  const id = stary.id || noveId();
  const zaznam = { soubor: id, ucet: aktivniId(), cesta, c: stary.c, m: stary.m || Date.now(), ulozeno: Date.now(), velikost: stary.c.length };
  return { meta: { id, verzeCas: Date.now() }, ulozit: () => uloz(zaznam) };
});

// ---------------------------------------------------------------- akce
/** Obnoví verzi: současný obsah se nejdřív sám uloží jako verze, takže jde obnovení vrátit. */
export function obnov(cesta, verze) {
  FS.write(cesta, verze.c, { snimek: true });
}

/** Uloží verzi vedle souboru jako kopii „název (verze 12. 10. 14.30).přípona“. */
export function ulozJakoKopii(cesta, verze) {
  const d = new Date(verze.m);
  const kdy = `${d.getDate()}. ${d.getMonth() + 1}. ${d.getHours()}.${String(d.getMinutes()).padStart(2, '0')}`;
  const jm = FS.basename(cesta);
  const tecka = jm.lastIndexOf('.');
  const nove = tecka > 0 ? `${jm.slice(0, tecka)} (verze ${kdy})${jm.slice(tecka)}` : `${jm} (verze ${kdy})`;
  const kam = FS.dirname(cesta);
  const cil = FS.join(kam, FS.exists(FS.join(kam, nove)) ? FS.freeName(kam, nove) : nove);
  FS.write(cil, verze.c);
  return cil;
}

// ---------------------------------------------------------------- rozdíly (řádky)
/** Rozdíl dvou textů po řádcích (LCS): [{ typ: '=' | '+' | '-', t }]. Pro obří texty null. */
export function rozdil(stary, novy) {
  const a = stary.split('\n'), b = novy.split('\n');
  if (a.length * b.length > 4e6) return null;
  const n = a.length, m = b.length;
  const L = new Uint32Array((n + 1) * (m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      L[i * (m + 1) + j] = a[i] === b[j] ? L[(i + 1) * (m + 1) + j + 1] + 1 : Math.max(L[(i + 1) * (m + 1) + j], L[i * (m + 1) + j + 1]);
    }
  }
  const out = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ typ: '=', t: a[i] }); i++; j++; }
    else if (L[(i + 1) * (m + 1) + j] >= L[i * (m + 1) + j + 1]) out.push({ typ: '-', t: a[i++] });
    else out.push({ typ: '+', t: b[j++] });
  }
  while (i < n) out.push({ typ: '-', t: a[i++] });
  while (j < m) out.push({ typ: '+', t: b[j++] });
  return out;
}
