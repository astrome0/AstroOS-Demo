// AstroOS — výchozí aplikace (Nastavení ▸ Výchozí aplikace, Soubory ▸ Otevřít v programu)
//
// KANDIDATI = které aplikace umí soubor s danou příponou otevřít (mají opts.path). PRVNÍ = to, co by bez volby
// otevřela aplikacePro() v soubory.js — musí sedět, jinak by Nastavení ukazovalo něco jiného, než se otevře.
// Volba uživatele: State.vychoziAplikace = { přípona: id aplikace }. aplikacePro() v soubory.js se ptá tady.
// .webm se rozhoduje podle obsahu: video z Astro 3D umí jen Astro 3D, nahrávku jen Diktafon.

import { State } from './state.js';
import * as FS from './fs.js';

export const NAZVY = {
  notes: 'Poznámky', editor: 'Editor kódu', pismo: 'AstroPísmo', tabulky: 'AstroTabulky', prezentace: 'AstroPrezentace',
  photos: 'Fotky', malovani: 'Malování', recorder: 'Diktafon', astro3d: 'Astro 3D', browser: 'Nova Prohlížeč', archiv: 'Archiv ZIP',
};

const TEXT = ['notes', 'editor', 'pismo'];
const KOD = ['editor', 'notes'];
const OBRAZEK = ['photos', 'malovani'];
export const KANDIDATI = {
  txt: TEXT, md: TEXT, log: ['notes', 'editor'],
  csv: ['tabulky', 'notes', 'editor'], tsv: ['notes', 'tabulky', 'editor'],
  docx: ['pismo'], xlsx: ['tabulky'], pptx: ['prezentace'],
  html: ['browser', 'editor', 'pismo'], htm: ['browser', 'editor', 'pismo'],
  js: KOD, css: KOD, json: KOD,
  png: OBRAZEK, jpg: OBRAZEK, webp: OBRAZEK, svg: ['photos', 'malovani', 'editor'],
  mp3: ['recorder'], wav: ['recorder'], ogg: ['recorder'], m4a: ['recorder'], webm: ['recorder', 'astro3d'],
  a3d: ['astro3d'], obj: ['astro3d', 'editor'], zip: ['archiv'],
};

/** Skupiny pro stránku v Nastavení. */
export const SKUPINY = [
  ['Dokumenty', ['txt', 'md', 'docx', 'csv', 'tsv', 'xlsx', 'pptx', 'log']],
  ['Obrázky', ['png', 'jpg', 'webp', 'svg']],
  ['Web a kód', ['html', 'htm', 'js', 'css', 'json']],
  ['Zvuk a video', ['mp3', 'wav', 'ogg', 'm4a']],   // webm se rozhoduje podle obsahu (kandidatiPro)
  ['3D a archivy', ['a3d', 'obj', 'zip']],
];

export const pripona = (jm) => (jm.includes('.') ? jm.slice(jm.lastIndexOf('.') + 1).toLowerCase() : '');
const volby = () => State.get('vychoziAplikace') || {};

/** Aplikace, které umí tenhle konkrétní soubor otevřít (u .webm podle obsahu). */
export function kandidatiPro(cesta) {
  const ext = pripona(FS.basename(cesta));
  if (ext === 'webm') {
    let c = '';
    try { c = FS.read(cesta); } catch { /* nevadí */ }
    return c.startsWith('data:video/') ? ['astro3d'] : ['recorder'];
  }
  if (KANDIDATI[ext]) return KANDIDATI[ext];
  return FS.isText(FS.basename(cesta)) ? ['notes', 'editor'] : [];
}

/** Výchozí aplikace pro příponu (volba uživatele, jinak první kandidát). */
export const vychoziProPriponu = (ext) => {
  const k = KANDIDATI[ext] || [];
  return k.includes(volby()[ext]) ? volby()[ext] : k[0] || null;
};
export const jeZmenena = (ext) => !!volby()[ext] && volby()[ext] !== (KANDIDATI[ext] || [])[0];

/** Volba uživatele pro tenhle soubor — nebo null (pak platí výchozí logika aplikacePro). */
export function zvolenaPro(cesta) {
  const ext = pripona(FS.basename(cesta));
  const v = volby()[ext];
  return v && kandidatiPro(cesta).includes(v) ? v : null;
}

export function nastav(ext, appId) {
  const v = { ...volby() };
  if (!appId || appId === (KANDIDATI[ext] || [])[0]) delete v[ext]; else v[ext] = appId;
  State.set('vychoziAplikace', v);
}
export const obnovVse = () => State.set('vychoziAplikace', {});
