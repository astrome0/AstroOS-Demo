// AstroOS — uživatelské účty (Nastavení ▸ Účet ▸ Další uživatelé, zámek, Start)
//
// Každý účet má vlastní nastavení, disk, tapetu i Astro Studio (klíče podle profil.js). Společné pro
// celý počítač zůstává jazyk systému a historie verzí (ta je ale označená účtem, viz verze.js).
// Hlavní účet je vždy správce a nejde smazat. Přepnutí = obnovení stránky rovnou na zámek nového účtu.

import { State, ACCENTS } from './state.js';
import * as P from './profil.js';

export const TYPY = [['spravce', 'Správce'], ['standardni', 'Standardní']];

const nactiStav = (id) => {
  try { return JSON.parse(localStorage.getItem(P.klic('astroos.v1', id)) || '{}'); } catch { return {}; }
};

/** Všechny účty včetně hlavního: [{ id, jmeno, avatar, typ, hlavni, heslo, aktivni }]. */
export function vsichni() {
  const ted = P.aktivniId();
  const user = (id) => (id === ted ? State.get('user') : nactiStav(id).user) || {};
  const h = user('');
  return [
    { id: '', jmeno: h.name || 'Uživatel', avatar: h.avatar, typ: 'spravce', hlavni: true, heslo: h.password !== '', aktivni: ted === '' },
    ...P.registr().map((u) => {
      const d = user(u.id);
      return { ...u, jmeno: d.name || u.jmeno, avatar: d.avatar, heslo: !!d.password, aktivni: ted === u.id };
    }),
  ];
}
export const ja = () => vsichni().find((u) => u.aktivni);
export const jsemSpravce = () => ja()?.typ === 'spravce';
export const avatarPismeno = (u) => (u.avatar || u.jmeno?.[0] || '?').toUpperCase();

const slug = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'uzivatel';

/** Založí účet. Vrací id. Disk se mu vytvoří sám při prvním přihlášení (fs.js defaultTree). */
export function pridej({ jmeno, heslo = '', napoveda = '', typ = 'standardni' }) {
  jmeno = String(jmeno || '').trim().slice(0, 32);
  if (!jmeno) throw new Error('Zadej jméno.');
  if (vsichni().some((u) => u.jmeno.toLowerCase() === jmeno.toLowerCase())) throw new Error('Účet s tímhle jménem už existuje.');
  const r = P.registr();
  const zabrane = new Set(['uzivatel', ...r.map((u) => u.slozka)]);
  let slozka = slug(jmeno), n = 2;
  while (zabrane.has(slozka)) slozka = `${slug(jmeno)}-${n++}`;
  const id = 'u' + Date.now().toString(36);
  const barvy = Object.keys(ACCENTS || {});
  const stav = {
    user: { name: jmeno, password: heslo, hint: napoveda.trim() || 'žádná nápověda', avatar: jmeno[0].toUpperCase() },
    oobeHotovo: true, firstRun: true, installed: Date.now(),
    ...(barvy.length ? { accent: barvy[Math.floor(Math.random() * barvy.length)] } : {}),
  };
  try { localStorage.setItem(P.klic('astroos.v1', id), JSON.stringify(stav)); }
  catch { throw new Error('Na disku není místo pro další účet.'); }
  P.ulozRegistr([...r, { id, jmeno, slozka, typ: typ === 'spravce' ? 'spravce' : 'standardni', vytvoreno: Date.now() }]);
  return id;
}

export function zmenTyp(id, typ) {
  P.ulozRegistr(P.registr().map((u) => (u.id === id ? { ...u, typ } : u)));
}

/** Smaže účet i se vším, co mu patří (nastavení, disk, studio, tapeta, historie verzí). */
export async function odeber(id) {
  if (!id || id === P.aktivniId()) throw new Error('Tenhle účet teď smazat nejde.');
  for (const z of ['astroos.v1', 'astroos.fs.v1', 'astroos.studio.v1']) {
    try { localStorage.removeItem(P.klic(z, id)); } catch { /* nevadí */ }
  }
  P.ulozRegistr(P.registr().filter((u) => u.id !== id));
  try {
    await new Promise((ok) => {
      const r = indexedDB.open('astroos-tapety', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('obrazky');
      r.onsuccess = () => { const tx = r.result.transaction('obrazky', 'readwrite'); tx.objectStore('obrazky').delete(P.klic('pc', id)); tx.oncomplete = tx.onerror = () => { r.result.close(); ok(); }; };
      r.onerror = () => ok();
    });
    const { smazVerzeUctu } = await import('./verze.js');
    await smazVerzeUctu(id);
  } catch { /* bez IndexedDB není co mazat */ }
}

/** Přepne na jiný účet: obnoví stránku rovnou na jeho zámek (bez bootu). */
export function prepni(id) {
  State.save?.();
  P.nastavAktivni(id);
  try { sessionStorage.setItem('astroos-prepnuti', '1'); } catch { /* nevadí */ }
  location.reload();
}
