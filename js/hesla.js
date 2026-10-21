// AstroOS — správce hesel Novy
//
// Trezor je zašifrovaný heslem účtu AstroOS: klíč = PBKDF2 (SHA-256, 210 000 kol) z hesla a náhodné
// soli, data = AES-GCM 256. Na disku (stav účtu, klíč `nbHesla`) je jen šifra; odemčené položky a klíč
// žijí jen v paměti stránky. Odemyká se při přihlášení (lock.js zná zadané heslo), zamyká se se
// zámkem obrazovky. Když se přihlásí PINem, Nova si o heslo účtu řekne sama (jako Chrome ve Windows).
//
// Weby, kde se heslo nemá nabízet k uložení („Nikdy“), jsou v `nbHeslaNikdy` — to tajné není.

import { State } from './state.js';
import { bus } from './util.js';

const KOL = 210000;
let klic = null;          // CryptoKey, když je odemčeno
let sul = null;           // sůl trezoru (Uint8Array)
let polozky = [];         // [{ id, web, url, jmeno, heslo, vytvoreno, zmeneno, pouzito }]

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const zB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function odvodKlic(heslo, s) {
  const zaklad = await crypto.subtle.importKey('raw', new TextEncoder().encode(heslo), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: s, iterations: KOL, hash: 'SHA-256' },
    zaklad, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

async function desifruj(k, trezor) {
  const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: zB64(trezor.iv) }, k, zB64(trezor.data));
  return JSON.parse(new TextDecoder().decode(data));
}

async function uloz() {
  if (!klic) throw new Error('Hesla jsou zamčená.');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, klic, new TextEncoder().encode(JSON.stringify(polozky)));
  State.set('nbHesla', { v: 1, sul: b64(sul), iv: b64(iv), data: b64(data) });
  bus.emit('hesla:zmena');
}

export const odemceno = () => !!klic;
export const maTrezor = () => !!State.get('nbHesla');
export const pocet = () => polozky.length;

/** Odemkne trezor heslem účtu. Když trezor ještě není, připraví nový (prázdný). Vrací true/false. */
export async function odemkni(heslo) {
  const trezor = State.get('nbHesla');
  try {
    if (!trezor) {
      sul = crypto.getRandomValues(new Uint8Array(16));
      klic = await odvodKlic(heslo, sul);
      polozky = [];
    } else {
      const s = zB64(trezor.sul);
      const k = await odvodKlic(heslo, s);
      const p = await desifruj(k, trezor);
      sul = s; klic = k; polozky = Array.isArray(p) ? p : [];
    }
    bus.emit('hesla:zmena');
    return true;
  } catch {
    return false;   // špatné heslo (AES-GCM nesedí)
  }
}

export function zamkni() {
  if (!klic && !polozky.length) return;
  klic = null; sul = null; polozky = [];
  bus.emit('hesla:zmena');
}

/** Změna hesla účtu (Nastavení ▸ Účet): trezor se přešifruje novým heslem. */
export async function zmenaHeslaUctu(stare, nove) {
  const trezor = State.get('nbHesla');
  if (!trezor) return;
  if (!klic && !(await odemkni(stare))) return;
  sul = crypto.getRandomValues(new Uint8Array(16));
  klic = await odvodKlic(nove, sul);
  await uloz();
}

// ---------------------------------------------------------------- weby
/** „https://accounts.google.com/x“ → „accounts.google.com“ */
export const hostZ = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };
/** Hlavní doména — přihlášení na accounts.google.com platí i pro mail.google.com. */
export function domena(host) {
  const c = String(host).split('.');
  if (c.length <= 2 || /^\d+$/.test(c[c.length - 1])) return host;
  // co.uk, com.au… — druhá úroveň krátká a známá
  return /^(co|com|org|net|gov|ac|edu)$/.test(c[c.length - 2]) ? c.slice(-3).join('.') : c.slice(-2).join('.');
}
const stejnyWeb = (a, b) => domena(a) === domena(b);

export function seznam() {
  return [...polozky].sort((a, b) => a.web.localeCompare(b.web) || a.jmeno.localeCompare(b.jmeno));
}

/** Uložená hesla pro adresu (stránky stejné domény), naposledy použitá první. */
export function proWeb(url) {
  const h = hostZ(url);
  if (!h) return [];
  return polozky.filter((p) => stejnyWeb(p.web, h)).sort((a, b) => (b.pouzito || 0) - (a.pouzito || 0));
}

/** Co s heslem, které uživatel právě odeslal: 'nove' | 'zmena' | 'stejne' | 'nikdy'. */
export function coSOdeslanym(url, jmeno, heslo) {
  const h = hostZ(url);
  if (nikdyPro(h)) return 'nikdy';
  const p = polozky.find((x) => stejnyWeb(x.web, h) && x.jmeno === jmeno);
  if (!p) return 'nove';
  return p.heslo === heslo ? 'stejne' : 'zmena';
}

/** Uloží nebo aktualizuje (stejný web + stejné jméno). */
export async function ulozHeslo({ url, jmeno = '', heslo }) {
  const web = hostZ(url) || String(url).trim();
  const ted = Date.now();
  const p = polozky.find((x) => stejnyWeb(x.web, web) && x.jmeno === jmeno);
  if (p) Object.assign(p, { heslo, zmeneno: ted });
  else polozky.push({ id: ted.toString(36) + Math.random().toString(36).slice(2, 6), web, url: String(url), jmeno, heslo, vytvoreno: ted, zmeneno: ted, pouzito: 0 });
  nastavNikdy(web, false);
  await uloz();
}

export async function uprav(id, zmeny) {
  const p = polozky.find((x) => x.id === id);
  if (!p) return;
  Object.assign(p, zmeny, { zmeneno: Date.now() });
  if (zmeny.url) p.web = hostZ(zmeny.url) || p.web;
  await uloz();
}

export async function smaz(id) {
  polozky = polozky.filter((x) => x.id !== id);
  await uloz();
}

/** Vyplněno na webu → nahoru v nabídce. Do disku jen jednou za čas, ať se nešifruje při každém kliku. */
export function pouzito(id) {
  const p = polozky.find((x) => x.id === id);
  if (!p) return;
  const driv = p.pouzito || 0;
  p.pouzito = Date.now();
  if (p.pouzito - driv > 3600e3) uloz().catch(() => {});
}

/** Heslo použité u víc webů — v seznamu se ukáže varování. */
export function opakovane(heslo) {
  return polozky.filter((x) => x.heslo === heslo).length > 1;
}

// ---------------------------------------------------------------- „Nikdy pro tento web“
export const seznamNikdy = () => State.get('nbHeslaNikdy') || [];
export const nikdyPro = (host) => seznamNikdy().some((h) => stejnyWeb(h, host));
export function nastavNikdy(host, nikdy = true) {
  const d = domena(host);
  const s = seznamNikdy().filter((h) => domena(h) !== d);
  if (nikdy) s.push(d);
  if (s.length !== seznamNikdy().length || nikdy) State.set('nbHeslaNikdy', s);
  bus.emit('hesla:zmena');
}

/** Silné náhodné heslo (16 znaků, bez dvojznačných znaků). */
export function vygeneruj(delka = 16) {
  const znaky = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789-_!?@#';
  const r = crypto.getRandomValues(new Uint32Array(delka));
  return [...r].map((x) => znaky[x % znaky.length]).join('');
}
