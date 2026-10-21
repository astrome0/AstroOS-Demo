// AstroOS — jedno místo, které přenáší nastavení vzhledu do CSS
//
// Vše jsou atributy na <html>, takže CSS si zbytek udělá samo.
// Volá se při startu a po každé změně stavu (viz os.js).

import { State, ACCENTS } from './state.js';

/** Výchozí hodnoty voleb vzhledu — používá je Nastavení i tenhle modul. */
export const VZHLED = {
  motiv: 'tmavy',          // tmavy | svetly | podle-systemu
  rohy: 'normal',          // ostre | normal | kulate
  sklo: 'silne',           // vyp | jemne | silne
  animace: 'plne',         // plne | min
  panel: 'normal',         // kompakt | normal | velky
  zarovnani: 'uprostred',  // uprostred | vlevo
  skrytPanel: false,
  ikony: 'stredni',        // male | stredni | velke
  pocetPloch: 2,
  hodiny24: true,
  sekundy: false,
  datumVPanelu: true,
  zobrazitPlochy: true,
  zobrazitZvonecek: true,
  zobrazitPlochuBtn: true,
  kurzor: 'system',        // system | astro | tecka | raketa | retro (viz kurzor.js)
  kurzorVelikost: 'stredni',
  kurzorStopa: 'zadna',     // zadna | jiskry | kometa
};

const hod = (klic) => State.get(klic) ?? VZHLED[klic];

const tmavyPodleSystemu = () =>
  !window.matchMedia?.('(prefers-color-scheme: light)').matches;

/** Který motiv se právě používá (rozhodne i „podle systému“). */
export function aktivniMotiv() {
  const m = hod('motiv');
  if (m === 'podle-systemu') return tmavyPodleSystemu() ? 'tmavy' : 'svetly';
  return m;
}

export function applyVzhled() {
  const r = document.documentElement;
  const nastav = (atr, hodnota) => {
    if (hodnota === null || hodnota === false) r.removeAttribute(atr);
    else r.setAttribute(atr, hodnota);
  };

  nastav('data-motiv', aktivniMotiv() === 'svetly' ? 'svetly' : null);
  nastav('data-rohy', hod('rohy') !== 'normal' ? hod('rohy') : null);
  nastav('data-sklo', hod('sklo') !== 'silne' ? hod('sklo') : null);
  nastav('data-animace', hod('animace') === 'min' ? 'min' : null);
  nastav('data-panel', hod('panel') !== 'normal' ? hod('panel') : null);
  nastav('data-zarovnani', hod('zarovnani') === 'vlevo' ? 'vlevo' : null);
  nastav('data-skryt-panel', hod('skrytPanel') ? '1' : null);
  nastav('data-ikony', hod('ikony') !== 'stredni' ? hod('ikony') : null);
}

/** Akcent — buď jeden z přednastavených, nebo vlastní barva. */
export function applyAccent(id = State.get('accent')) {
  const r = document.documentElement.style;
  if (id === 'vlastni') {
    const barva = State.get('accentVlastni') || '#46c36f';
    r.setProperty('--accent', barva);
    r.setProperty('--accent-deep', barva);
    r.setProperty('--accent-soft', barva + '33');
    r.setProperty('--accent-text', kontrastniText(barva));
    return;
  }
  const a = ACCENTS[id] || ACCENTS.green;
  r.setProperty('--accent', a.accent);
  r.setProperty('--accent-deep', a.deep);
  r.setProperty('--accent-text', a.text);
  r.setProperty('--accent-soft', a.accent + '33');
}

/** Černý nebo bílý text na barevném pozadí podle jeho jasu. */
export function kontrastniText(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (r * 0.299 + g * 0.587 + b * 0.114) > 150 ? '#0d1112' : '#ffffff';
}

/** Jas tapety a noční režim. */
export function applyDisplay() {
  const wp = document.getElementById('wallpaper');
  if (wp) wp.style.filter = `brightness(${0.45 + ((State.get('brightness') ?? 92) / 100) * 0.55})`;
  document.body.style.filter = State.get('night') ? 'sepia(0.32) saturate(1.1)' : '';
}

/** Kolik pixelů ubírá panel oknům (CSS je zdroj pravdy). */
export function panelMisto() {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--panel-misto');
  const cislo = parseInt(v, 10);
  return Number.isFinite(cislo) ? cislo : 50;
}

/** Rozměr buňky pro ikony na ploše. */
export function mrizkaIkon() {
  const s = getComputedStyle(document.documentElement);
  return {
    w: parseInt(s.getPropertyValue('--ikona-w'), 10) || 96,
    h: parseInt(s.getPropertyValue('--ikona-h'), 10) || 104,
  };
}

export function applyVse() {
  applyAccent();
  applyVzhled();
  applyDisplay();
}

// změna systémového motivu se projeví hned, když je zvoleno „podle systému“
window.matchMedia?.('(prefers-color-scheme: light)').addEventListener?.('change', () => {
  if (hod('motiv') === 'podle-systemu') applyVzhled();
});
