// AstroOS — kdo je zrovna přihlášený (víc uživatelů na jednom počítači)
//
// Bez závislostí: čtou to state.js a fs.js hned při načtení, ještě než existuje cokoli jiného.
// Hlavní účet (id '') má klíče jako dřív (astroos.v1, astroos.fs.v1 …), takže se nic nestěhuje.
// Další účty mají ke každému klíči příponu „.u.<id>“ a vlastní domovskou složku /domov/<slozka>.
// Přepnutí uživatele = zapsat AKTIVNI a obnovit stránku (ucty.js) — moduly si klíče přečtou znovu.

const REGISTR = 'astroos.ucty';    // [{ id, jmeno, slozka, typ, vytvoreno }] — jen DALŠÍ účty, hlavní ne
const AKTIVNI = 'astroos.ucet';    // id přihlášeného účtu ('' = hlavní)

const cti = (k) => { try { return localStorage.getItem(k); } catch { return null; } };

export function registr() {
  try { const r = JSON.parse(cti(REGISTR) || '[]'); return Array.isArray(r) ? r : []; } catch { return []; }
}
export function ulozRegistr(r) { try { localStorage.setItem(REGISTR, JSON.stringify(r)); } catch { /* plné úložiště */ } }

/** id přihlášeného účtu; když účet mezitím zmizel (reset, smazání), je to hlavní účet. */
export function aktivniId() {
  const id = cti(AKTIVNI) || '';
  return id && registr().some((u) => u.id === id) ? id : '';
}
export function nastavAktivni(id) { try { localStorage.setItem(AKTIVNI, id || ''); } catch { /* nevadí */ } }

/** Klíč úložiště pro účet: hlavní beze změny, ostatní s příponou. */
export const klic = (zaklad, id = aktivniId()) => (id ? `${zaklad}.u.${id}` : zaklad);

/** Domovská složka účtu na jeho disku. */
export function home(id = aktivniId()) {
  if (!id) return '/domov/uzivatel';
  return '/domov/' + (registr().find((u) => u.id === id)?.slozka || id);
}
