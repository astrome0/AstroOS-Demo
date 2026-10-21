// AstroOS — limit tokenů AI na straně stránky. Stav drží server (limit.js v kořeni), tady se jen
// ptáme, hlásíme spotřebu a rozesíláme změny (bus 'limit'). Používá ho ai.js a okénko Využití.

import { bus } from './util.js';
import { State } from './state.js';

let posledni = null;

// Ukázková verze nemá AI ani server s limitem — dotazy rovnou selžou (volající to už umí).
async function api() {
  throw new Error('limit AI v ukázkové verzi není');
}

function oznam(st) {
  const predtim = posledni;
  posledni = st;
  bus.emit('limit', st);
  // jedno upozornění na 80 % a jedno při vyčerpání, ne u každé zprávy
  const pomer = st.okno.pouzito / st.limit;
  const stejneOkno = predtim && predtim.okno.start === st.okno.start;
  if (stejneOkno && predtim.okno.pouzito / predtim.limit < 0.8 && pomer >= 0.8 && !st.vycerpano) {
    import('./ui.js').then(({ toast }) => toast({ title: 'Využito 80 % limitu AI', body: `Okno se obnoví v ${cas(st.okno.konec)}.`, icon: 'blesk' }));
  }
  if (stejneOkno && !predtim.vycerpano && st.vycerpano) {
    import('./ui.js').then(({ toast }) => toast({ title: 'Limit AI vyčerpán', body: `Obnoví se v ${cas(st.okno.konec)}.`, icon: 'blesk' }));
  }
  return st;
}

/** Aktuální stav (s počtem tokenů konverzace chat, když je daný). */
export async function stav(chat = null) {
  try { return oznam(await api(chat ? `?chat=${encodeURIComponent(chat)}` : '')); } catch { return posledni; }
}

export const posledniStav = () => posledni;

/** Přičte spotřebu. Astro Studio (zdroj 'studio') se nepočítá — běží samo na pozadí. */
export async function pricti({ zdroj = 'astroai', tokeny, chat = null, tah = null }) {
  if (zdroj === 'studio' || !(tokeny > 0)) return posledni;
  try { return oznam(await api('/pricti', { zdroj, tokeny, chat, tah })); } catch { return posledni; }
}

/** Když je limit vyčerpaný, vrátí text, který AI „odpoví“. Jinak null. */
export async function blokace(zdroj = 'astroai') {
  if (zdroj === 'studio') return null;
  const st = await stav();
  return st?.vycerpano ? zpravaVycerpano(st) : null;
}

export const cas = (t) => new Date(t).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
export const cislo = (n) => Math.round(n).toLocaleString('cs-CZ');

// ---------------------------------------------------------------- tarify AI (předplatné na 7 dní)
export const TARIFY = {
  free: { nazev: 'AstroAI Free', kratce: 'Free', tokeny: 20000, cena: 0 },
  plus: { nazev: 'AstroAI Plus', kratce: 'Plus', tokeny: 100000, cena: 249 },
  max5: { nazev: 'AstroAI Max 5×', kratce: 'Max 5×', tokeny: 250000, cena: 590 },
  max20: { nazev: 'AstroAI Max 20×', kratce: 'Max 20×', tokeny: 1000000, cena: 1490 },
};
export const TYDEN = 7 * 24 * 3600 * 1000;
export const datum = (t) => new Date(t).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Koupený tarif, který ještě platí (jinak 'free'). */
export function mujTarif() {
  const t = State.get('aiTarif');
  return t in TARIFY && t !== 'free' && State.get('aiTarifDo') > Date.now() ? t : 'free';
}

export function zpravaVycerpano(st) {
  const min = Math.max(1, Math.ceil((st.okno.konec - Date.now()) / 60000));
  return `Dosáhl jsi limitu ${cislo(st.limit)} tokenů na 10 minut. Obnoví se v ${cas(st.okno.konec)} (za ${min} min).`
    + (st.dalsi ? ` Víc tokenů má ${TARIFY[st.dalsi].nazev} (Obchod v Nově, astro://koupit/ai).` : '');
}

/** Odhad, když model počet tokenů nevrátí (~3,5 znaku na token v češtině). */
export const odhad = (...texty) => Math.ceil(texty.reduce((n, t) => n + (t ? String(t).length : 0), 0) / 3.5);

/** Nové id tahu = jedna zpráva uživatele (může mít víc volání modelu). */
export const novyTah = () => 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// Tarif AI určuje limit — edice systému na něj vliv nemá. Placené tarify platí 7 dní od nákupu;
// po vypršení se vrátí Free a přijde mail. Starší nákup bez data (dřív „navždy“) dostane 7 dní od teď.
if (State.get('aiTarif') in TARIFY && State.get('aiTarif') !== 'free' && !State.get('aiTarifDo')) {
  State.set('aiTarifDo', Date.now() + TYDEN);
}
function hlidejPlatnost() {
  const t = State.get('aiTarif');
  if (!(t in TARIFY) || t === 'free' || State.get('aiTarifDo') > Date.now()) return;
  State.patch({ aiTarif: 'free', aiTarifDo: null });
  import('./ui.js').then(({ toast }) => toast({ title: `${TARIFY[t].nazev} skončil`, body: 'Předplatné vypršelo, limit AI je zase 20 000 tokenů za 10 minut.', icon: 'blesk', onClick: () => import('./apps.js').then(({ openApp }) => openApp('browser', { url: 'astro://koupit/ai' })) }));
  import('./aktivace.js').then((a) => a.mailKonecTarifu(t));   // mail do Pošty
}
const posliTarif = () => {
  hlidejPlatnost();
  return api('/tarif', { tarif: mujTarif(), do: State.get('aiTarifDo') || null }).then(oznam).catch(() => {});
};
posliTarif();
bus.on('state:aiTarif', posliTarif);
bus.on('state:aiTarifDo', posliTarif);
setInterval(hlidejPlatnost, 60000);
