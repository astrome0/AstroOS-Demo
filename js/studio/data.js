// AstroOS — Astro Studio: data
//
// Vlastní hry publikované do Obchodu, profil studia a všechno, co se kolem nich
// „děje“ (zhlédnutí, stažení, recenze botů, události). Leží ve vlastním klíči
// localStorage, ať se neukládá s každou změnou nastavení (simulace píše často).
//
// Čas: jeden herní den = jedna skutečná hodina. Den 1 začíná vydáním hry.

import { bus } from '../util.js';
import * as FS from '../fs.js';
import { klic } from '../profil.js';

const KLIC = klic('astroos.studio.v1');   // každý účet má vlastní studio (profil.js)
export const DEN_MS = 3600e3;

// posun hodin jen pro testování z konzole (AstroOS.studio.posun(h)) — neukládá se
let posun = 0;
export const ted = () => Date.now() + posun;
export const posunCas = (ms) => { posun += ms; };

const PRAZDNE = () => ({ verze: 1, firma: null, hry: [], odznaky: {} });

function nacti() {
  try {
    const d = JSON.parse(localStorage.getItem(KLIC) || 'null');
    return d && d.verze === 1 ? { ...PRAZDNE(), ...d } : PRAZDNE();
  } catch {
    return PRAZDNE();
  }
}

export const S = nacti();

let ulozCasovac = 0;
/** Uloží (s malým zpožděním, ať se víc změn spojí do jednoho zápisu) a dá vědět aplikacím. */
export function ulozit({ hned = false } = {}) {
  clearTimeout(ulozCasovac);
  const zapis = () => {
    try { localStorage.setItem(KLIC, JSON.stringify(S)); } catch { /* plné úložiště — data zůstanou v paměti */ }
  };
  if (hned) zapis(); else ulozCasovac = setTimeout(zapis, 400);
  bus.emit('studio', S);
}

export const hra = (id) => S.hry.find((h) => h.id === id);
/** Všechny hry v Obchodě — tvoje i konkurence (sdílejí trh). */
export const vydane = () => S.hry.filter((h) => h.stav === 'vydano');
/** Jen tvoje hry (bez konceptů). */
export const moje = () => S.hry.filter((h) => !h.rival && h.stav !== 'koncept');

/** Index herního dne (0 = den vydání). */
export const denHry = (h, cas = ted()) => Math.max(0, Math.floor((cas - h.vydano) / DEN_MS));
/** Kolik ms zbývá do dalšího herního dne. */
export const doDalsihoDne = (h, cas = ted()) => DEN_MS - ((cas - h.vydano) % DEN_MS);

export function prumer(h) {
  const n = h.hvezdy.reduce((a, b) => a + b, 0);
  if (!n) return 0;
  return h.hvezdy.reduce((s, c, i) => s + c * (i + 1), 0) / n;
}
export const pocetHodnoceni = (h) => h.hvezdy.reduce((a, b) => a + b, 0);

export const KATEGORIE = [
  { id: 'hry', nazev: 'Hry' },
  { id: 'hudba', nazev: 'Hudba a tvoření' },
  { id: 'relax', nazev: 'Pohoda' },
  { id: 'nastroje', nazev: 'Užitečné' },
];

export const gradient = (b) => {
  const n = parseInt(String(b).slice(1), 16) || 0x46c36f;
  const k = (x) => Math.round(x * 0.62).toString(16).padStart(2, '0');
  return `linear-gradient(145deg,${b},#${k((n >> 16) & 255)}${k((n >> 8) & 255)}${k(n & 255)})`;
};

export function novaHra(udaje) {
  return {
    id: 'h' + ted().toString(36) + Math.random().toString(36).slice(2, 5),
    slozka: FS.normalize(udaje.slozka),
    nazev: udaje.nazev, kratce: udaje.kratce, popis: udaje.popis, kategorie: udaje.kategorie,
    ikona: udaje.ikona, barva: udaje.barva, vek: udaje.vek || '3+',
    verze: '1.0', novinky: 'První vydání.',
    vytvoreno: ted(), vydano: 0, stav: 'koncept',
    kontrola: null,
    nalada: null,             // co si o hře myslí Qwen (0–1), null = ještě nehodnotil
    dny: [],                  // uzavřené dny: { z, s, h } (zhlédnutí, stažení, hodnocení)
    dnes: null,               // rozpracovaný den: { den, cil:{z,s,h}, hotovo:{z,s,h}, nasobek }
    celkem: { z: 0, s: 0 },
    hvezdy: [0, 0, 0, 0, 0],
    sledujici: 0,
    recenze: [],              // zveřejněné
    zasoba: [],               // připravené od Qwenu, čekají na zveřejnění
    reakce: [],               // připravené reakce botů na odpovědi vývojáře: { na, text, kdy }
    udalosti: [],             // { den, cas, typ, text }
    efekt: null,              // { typ, do (den), nasobek }
    posledniUdalost: -99,
    aktualizovanoDen: 0,
    potrebujeQwen: true,
  };
}

/** Hra jako položka pro Obchod (stejný tvar jako katalog v js/obchod/katalog.js). */
export function proObchod(h) {
  const n = pocetHodnoceni(h);
  return {
    id: 'st-' + h.id, komunita: true, rival: !!h.rival, studioId: h.studio || null, hraId: h.id, slozka: h.slozka,
    name: h.nazev, icon: h.ikona, color: gradient(h.barva), kratce: h.kratce,
    popis: h.popis, novinky: h.novinky, autor: h.rival ? h.autor : (S.firma?.nazev || 'Nezávislý vývojář'),
    vcera: h.dny.at(-1)?.z || 0,
    sekce: h.kategorie, vek: h.vek, velikost: velikostSlozky(h.slozka),
    hodnoceni: n ? prumer(h) : 0, hodnoceniPocet: n, stazeni: h.celkem.s, zhlednuti: h.celkem.z,
    hvezdy: h.hvezdy,
    vyberRedakce: h.efekt?.typ === 'vyber' && denHry(h) <= h.efekt.do,
    recenze: [...h.recenze].reverse().slice(0, 30).map((r) => [r.bot, r.hvezdy, r.text, false, r.odpoved?.text || null, r.reakce?.kdy <= ted() ? r.reakce.text : null]),
    vydano: h.vydano,
  };
}

export function velikostSlozky(slozka) {
  let b = 0;
  const projdi = (c) => {
    for (const it of FS.list(c, { hidden: true })) {
      if (it.dir) projdi(it.path);
      else b += it.size || 0;
    }
  };
  try { projdi(slozka); } catch { /* složka zmizela */ }
  return b < 1024 ? `${b} B` : `${Math.max(1, Math.round(b / 1024))} kB`;
}

/** Složky v domově, ze kterých jde vydat hru (obsahují index.html). */
export function kandidati() {
  const out = [];
  const projdi = (cesta, hloubka) => {
    let it;
    try { it = FS.list(cesta); } catch { return; }
    if (it.some((x) => !x.dir && x.name === 'index.html') && cesta !== FS.HOME) out.push(cesta);
    if (hloubka >= 4) return;
    for (const x of it) if (x.dir) projdi(x.path, hloubka + 1);
  };
  projdi(FS.HOME, 0);
  return out;
}

/** Zdrojové soubory hry jako text (pro Qwena) — html, js, css, ořezané na limit. */
export function zdrojak(slozka, limit = 9000) {
  const soubory = [];
  const projdi = (c, rel) => {
    for (const it of FS.list(c, { hidden: false })) {
      if (it.dir) { projdi(it.path, rel + it.name + '/'); continue; }
      if (!/\.(html?|js|css|json)$/i.test(it.name) || it.name === 'app.json') continue;
      let t = '';
      try { t = FS.read(it.path); } catch { continue; }
      if (typeof t !== 'string' || t.startsWith('data:')) continue;
      soubory.push({ jmeno: rel + it.name, text: t });
    }
  };
  try { projdi(slozka, ''); } catch { return ''; }
  // index.html první, pak js, nakonec css (z css se o hře dozví nejmíň)
  const poradi = (j) => (/index\.html?$/i.test(j) ? 0 : /\.js$/i.test(j) ? 1 : /\.html?$/i.test(j) ? 2 : 3);
  soubory.sort((a, b) => poradi(a.jmeno) - poradi(b.jmeno));
  let out = '';
  for (const s of soubory) {
    const zbyva = limit - out.length;
    if (zbyva < 200) break;
    const telo = s.text.length > zbyva - 60 ? s.text.slice(0, zbyva - 80) + '\n…(zkráceno)' : s.text;
    out += `--- ${s.jmeno} ---\n${telo}\n`;
  }
  return out;
}

// ---------------------------------------------------------------- odznaky
export const ODZNAKY = [
  { id: 'prvni-hra', nazev: 'První hra', popis: 'Vydal jsi svoji první hru.', ikona: 'raketa' },
  { id: 's10', nazev: '10 stažení', popis: 'Prvních deset lidí si tvoji hru stáhlo.', ikona: 'download' },
  { id: 's100', nazev: '100 stažení', popis: 'Stovka hráčů!', ikona: 'download' },
  { id: 's1000', nazev: '1 000 stažení', popis: 'Tisícovka. Tohle už je komunita.', ikona: 'pohar' },
  { id: 's10000', nazev: '10 000 stažení', popis: 'Hit! O tvé hře se mluví.', ikona: 'diamant' },
  { id: 'pet', nazev: 'První pětka', popis: 'Někdo ti dal 5 hvězdiček a napsal proč.', ikona: 'star' },
  { id: 'featured', nazev: 'Výběr redakce', popis: 'Redakce Obchodu tvoji hru doporučila.', ikona: 'heart' },
  { id: 'viral', nazev: 'Virál', popis: 'Hra se rozšířila jako lavina.', ikona: 'blesk' },
  { id: 'update', nazev: 'Pečlivý vývojář', popis: 'Vydal jsi aktualizaci.', ikona: 'refresh' },
  { id: 'odpoved', nazev: 'Mluvím s hráči', popis: 'Odpověděl jsi na recenzi.', ikona: 'send' },
  { id: 'bez-chyb', nazev: 'Bez chyb', popis: 'Hra prošla kontrolou bez jediné chyby.', ikona: 'check' },
  { id: 'tri-hry', nazev: 'Studio', popis: 'Máš venku tři hry.', ikona: 'grid' },
];

/** Udělí odznak (jen jednou). Vrací true, když je nový. */
export function udelOdznak(id) {
  if (S.odznaky[id]) return false;
  S.odznaky[id] = ted();
  bus.emit('studio:odznak', ODZNAKY.find((o) => o.id === id));
  return true;
}

export const cislo = (n) => Math.round(n).toLocaleString('cs-CZ');
export function kratke(n) {
  n = Math.round(n);
  if (n < 10000) return cislo(n);
  if (n < 1e6) return `${(n / 1000).toFixed(n < 1e5 ? 1 : 0).replace('.', ',').replace(',0', '')} tis.`;
  return `${(n / 1e6).toFixed(1).replace('.', ',')} mil.`;
}
