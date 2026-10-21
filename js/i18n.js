// AstroOS — jazyk systému (čeština / angličtina)
//
// Zdrojový jazyk je čeština a ta je zároveň klíčem slovníku: kód dál píše české texty
// a v angličtině je přeloží hlídač DOMu (MutationObserver). Překládá textové uzly a atributy
// title/placeholder/aria-label, jejichž text přesně odpovídá klíči ve slovníku js/i18n/en.js.
// Klíče s {proměnnými} jsou vzory („Plocha {n}“ → „Desktop {n}“), dosazené hodnoty se
// zkusí přeložit taky. Co ve slovníku není, zůstane česky — nic se tím nerozbije.
//
// Původní český text si každý přeložený uzel pamatuje, takže jazyk jde přepnout za běhu
// oběma směry. Uživatelský obsah (soubory, poznámky, terminál, dokumenty…) se nepřekládá.
//
// Jazyk se ukládá zvlášť do `astroos-jazyk` (bez tečky), aby přežil čistou instalaci,
// která maže všechny klíče „astroos.*“.

import { EN as EN_SYSTEM } from './i18n/en.js';
import { EN_APLIKACE } from './i18n/en-aplikace.js';
import { EN_OFFICE } from './i18n/en-office.js';
import { EN_VLNA3 } from './i18n/en-vlna3.js';
import { EN_OFFICE2 } from './i18n/en-office2.js';
import { EN_OBCHOD } from './i18n/en-obchod.js';
import { EN_3D } from './i18n/en-3d.js';
import { EN_AKTUALIZACE } from './i18n/en-aktualizace.js';

// systém má přednost: stejný klíč z aplikací ho nepřepíše a vzory systému se zkoušejí první
const EN = { ...EN_SYSTEM };
for (const slovnik of [EN_AKTUALIZACE, EN_APLIKACE, EN_OFFICE, EN_VLNA3, EN_OFFICE2, EN_OBCHOD, EN_3D]) {
  for (const [k, v] of Object.entries(slovnik)) if (!(k in EN)) EN[k] = v;
}

const KLIC = 'astroos-jazyk';
export const JAZYKY = [['cs', 'Čeština'], ['en', 'English']];

let jazyk = (() => {
  try { return localStorage.getItem(KLIC) === 'en' ? 'en' : 'cs'; } catch { return 'cs'; }
})();

export const jazykTed = () => jazyk;
export const anglicky = () => jazyk === 'en';

/** Co se nikdy nepřekládá: obsah psaný uživatelem nebo programem. */
const NEPREKLADAT = [
  '[data-no-i18n]', '[contenteditable]', 'textarea', 'input', 'script', 'style', 'pre', 'code',
  '.tm', '.ai-text', '.ai-mysleni-text', '.po-telo', '.po-uryvek', '.pr-sn',
  // Editor kódu: kód je v pre/code/textarea; z AI panelu se nepřekládají jen zprávy a ukázky kódu
  '.ceai-text', '.ceai-ja', '.ceai-rozdil', '.ceai-ukazka', '.ps-ai-text', '.ps-kom-text', '.tb-kom-zprava', '.oobe-licence',
  // obsah dokumentů v Office i jejich náhledy (šablony v galerii, náhled tisku) — je to obsah souboru
  '.ps-obsah', '.ps-miniatura', '.ps-zk-nahled', '.tb-miniatura',
].join(',');
const ATRIBUTY = ['title', 'placeholder', 'aria-label'];

// ---------------------------------------------------------------- slovník
const presne = new Map();
const vzory = [];
for (const [cs, en] of Object.entries(EN)) {
  if (!cs.includes('{')) { presne.set(cs, en); continue; }
  const jmena = [];
  // {n} je vždycky číslo (kvůli skloňování „3 položky“), ostatní proměnné cokoli
  const re = cs.replace(/[.*+?^$()|[\]\\]/g, '\\$&')
    .replace(/\{(\w+)\}/g, (_, j) => { jmena.push(j); return j === 'n' ? '(\\d[\\d\\u00a0 ,.]*)' : '(.+?)'; });
  vzory.push({ re: new RegExp('^' + re + '$'), jmena, en, pevne: cs.replace(/\{\w+\}/g, '').length });
}
// nejdřív nejkonkrétnější vzor (nejvíc pevného textu): „Řada „{x}“ Bod „{x}““ dřív než „Řada {x}“
vzory.sort((a, b) => b.pevne - a.pevne);
// dvouřádkové popisky velkých tlačítek („Titulní\nstránka“) mají i jednořádkovou podobu do title
for (const [cs, en] of [...presne]) {
  const jeden = cs.replace(/\n/g, ' ');
  if (jeden !== cs && !presne.has(jeden)) presne.set(jeden, en.replace(/\n/g, ' '));
}

function prelozCele(text) {
  const p = presne.get(text);
  if (p !== undefined) return p;
  for (const v of vzory) {
    const m = v.re.exec(text);
    if (!m) continue;
    // stejné jméno víckrát („{x} z {x}“) se páruje podle pořadí: druhé {x} v angličtině = druhé v češtině
    const kolikaty = {};
    return v.en.replace(/\{(\w+)\}/g, (cele, j) => {
      const k = kolikaty[j] = (kolikaty[j] ?? -1) + 1;
      let i = -1;
      for (let a = 0, pocet = 0; a < v.jmena.length; a++) {
        if (v.jmena[a] === j && pocet++ === k) { i = a; break; }
      }
      if (i < 0) i = v.jmena.indexOf(j);
      if (i < 0) return cele;
      const hodnota = m[i + 1];
      // hodnota může sama obsahovat oddělovače („3 · verze 1.2“), proto po kusech
      return prelozSlozene(hodnota) ?? hodnota;
    });
  }
  // tipy s klávesovou zkratkou: „Kopírovat (Ctrl+C)“ — přeloží se jen popis, zkratka zůstane
  const zkratka = /^(.+?)( \((?:Ctrl|Alt|Shift|Win|Esc|Tab|Enter|F\d)[^)]*\))$/.exec(text);
  if (zkratka) {
    const popis = prelozCele(zkratka[1]);
    if (popis !== null) return popis + zkratka[2].replace(/mezerník/i, 'Space').replace(/šipka/, 'Arrow');
  }
  // popisky „Velikost:“ a „Jinak…“ — stačí, když slovník zná slovo bez dvojtečky / trojtečky
  const konec = /(:|…|\.\.\.)$/.exec(text);
  if (konec && text.length > konec[0].length) {
    const zbytek = prelozCele(text.slice(0, -konec[0].length));
    if (zbytek !== null) return zbytek + konec[0];
  }
  return null;
}

// od nejhrubšího: nejdřív řádky, pak pomlčky a tečky, čárka až nakonec (ať nerozbije celou větu)
const ODDELOVACE = ['\n', ' — ', ' – ', ' · ', ': ', ', '];

/**
 * Celý text, nebo po kusech: „Nastavení — Vzhled“, „3 položky · 2 složky“. Rozdělí podle
 * nejhrubšího oddělovače, který v textu je, a kusy, které celé neznáme, dělí dál jemnějšími.
 */
function prelozSlozene(text, od = 0) {
  const cele = prelozCele(text);
  if (cele !== null) return cele;
  for (let i = od; i < ODDELOVACE.length; i++) {
    const s = ODDELOVACE[i];
    if (!text.includes(s)) continue;
    let zmena = false;
    const kusy = text.split(s).map((k) => {
      const jadro = k.trim();
      if (!jadro) return k;
      const p = prelozSlozene(jadro, i + 1);
      if (p === null) return k;
      zmena = true;
      return k.replace(jadro, p);
    });
    return zmena ? kusy.join(s) : null;
  }
  return null;
}

/** Přeloží text (zachová mezery na krajích); když nezná, vrátí ho beze změny. */
function prelozText(text) {
  const jadro = text.trim();
  if (!jadro || !/[A-Za-zÀ-ž]/.test(jadro)) return text;
  const out = prelozSlozene(jadro);
  if (out === null) return text;
  const zac = text.slice(0, text.indexOf(jadro[0]));
  return zac + out + text.slice(zac.length + jadro.length);
}

/**
 * Překlad pro kód: t('Uloženo') nebo t('Plocha {n}', { n: 2 }).
 * V češtině jen dosadí proměnné.
 */
export function t(cs, promenne) {
  let text = cs;
  if (jazyk === 'en') {
    const p = presne.get(cs);
    if (p !== undefined) text = p;
  }
  if (promenne) text = text.replace(/\{(\w+)\}/g, (cele, j) => (j in promenne ? String(promenne[j]) : cele));
  return text;
}

/**
 * Přeloží hotový text i se vzory a kusy („cd: x: není složka“) — pro místa, kam hlídač DOMu
 * nesahá (terminál, výzvy pro AI, document.title…).
 */
export const tt = (text) => (jazyk === 'en' ? prelozText(String(text)) : text);

/** Inline dvojice pro místa, kde stejné české slovo znamená v angličtině dvě různé věci. */
export const tx = (cs, en) => (jazyk === 'en' ? en : cs);

// ---------------------------------------------------------------- překlad DOMu
const puvodniText = new WeakMap();   // Text → { cs, en }
const puvodniAttr = new WeakMap();   // Element → { [atribut]: { cs, en } }

const zakazano = (prvek) => !prvek || !!prvek.closest(NEPREKLADAT);
// u polí se nepřekládá obsah, ale placeholder a title ano
const POLE = 'input, textarea';
const zakazanoAttr = (prvek) => (prvek.matches(POLE) ? zakazano(prvek.parentElement) : zakazano(prvek));

function uzelText(n) {
  const z = puvodniText.get(n);
  if (jazyk === 'cs') {
    if (z && n.data === z.en) n.data = z.cs;
    if (z) puvodniText.delete(n);
    return;
  }
  if (z && n.data === z.en) return;           // náš vlastní překlad
  const cs = n.data;
  const en = prelozText(cs);
  if (en === cs) { if (z) puvodniText.delete(n); return; }
  puvodniText.set(n, { cs, en });
  n.data = en;
}

function uzelAtributy(prvek) {
  let z = puvodniAttr.get(prvek);
  for (const a of ATRIBUTY) {
    if (!prvek.hasAttribute(a)) continue;
    const ted = prvek.getAttribute(a);
    const m = z?.[a];
    if (jazyk === 'cs') {
      if (m && ted === m.en) prvek.setAttribute(a, m.cs);
      if (m) delete z[a];
      continue;
    }
    if (m && ted === m.en) continue;
    const en = prelozText(ted);
    if (en === ted) { if (m) delete z[a]; continue; }
    if (!z) { z = {}; puvodniAttr.set(prvek, z); }
    z[a] = { cs: ted, en };
    prvek.setAttribute(a, en);
  }
}

// Popisek velkého tlačítka na pásu karet je víc textových uzlů oddělených <br> („Titulní“ <br> „stránka“).
// Překládá se celý najednou, jinak by slovník neznal ani jednu půlku; angličtina může mít jiný počet řádků.
const POPIS = '.ps-b-popis';
const puvodniPopis = new WeakMap();  // Element → { cs: [uzly], en: [uzly] }

function uzelPopis(prvek) {
  const radky = [...prvek.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE || n.nodeName === 'BR');
  const z = puvodniPopis.get(prvek);
  const nahrad = (stare, nove) => {
    const kam = stare[0] || prvek.firstChild;
    for (const n of nove) prvek.insertBefore(n, kam);
    for (const n of stare) n.remove();
  };
  if (jazyk === 'cs') {
    if (z && radky[0] === z.en[0]) nahrad(radky, z.cs);
    puvodniPopis.delete(prvek);
    return;
  }
  if (z && radky[0] === z.en[0]) return;           // už přeložené
  const cs = radky.map((n) => (n.nodeName === 'BR' ? '\n' : n.data)).join('');
  if (!cs.trim()) return;
  const en = prelozCele(cs) ?? prelozCele(cs.replace(/\n/g, ' ')) ?? prelozText(cs);
  if (en === cs) return;
  const nove = en.split('\n').flatMap((r, i) => (i ? [document.createElement('br'), document.createTextNode(r)] : [document.createTextNode(r)]));
  puvodniPopis.set(prvek, { cs: radky, en: nove });
  nahrad(radky, nove);
}

/** Projde podstrom a přeloží (nebo vrátí do češtiny) všechno, co jde. */
function prelozStrom(koren) {
  if (koren.nodeType === Node.TEXT_NODE) {
    const rodic = koren.parentElement;
    if (rodic?.matches(POPIS)) { if (!zakazano(rodic)) uzelPopis(rodic); return; }
    if (!zakazano(rodic)) uzelText(koren);
    return;
  }
  if (koren.nodeType !== Node.ELEMENT_NODE) return;
  if (zakazano(koren)) {
    if (koren.matches(POLE) && !zakazanoAttr(koren)) uzelAtributy(koren);
    return;
  }
  if (koren.matches(POPIS)) { uzelPopis(koren); return; }
  const w = document.createTreeWalker(koren, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => {
      if (n.nodeType !== Node.ELEMENT_NODE) return NodeFilter.FILTER_ACCEPT;
      if (n.matches(POPIS) && !n.matches(NEPREKLADAT)) { uzelPopis(n); return NodeFilter.FILTER_REJECT; }
      if (!n.matches(NEPREKLADAT)) return NodeFilter.FILTER_ACCEPT;
      if (n.matches(POLE)) uzelAtributy(n);
      return NodeFilter.FILTER_REJECT;
    },
  });
  for (let n = w.currentNode; n; n = w.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) uzelText(n);
    else uzelAtributy(n);
  }
}

let hlidac = null;
function zpracuj(zmeny) {
  if (jazyk === 'cs') return;
  for (const z of zmeny) {
    if (z.type === 'childList') z.addedNodes.forEach((n) => { if (n.isConnected) prelozStrom(n); });
    else if (z.type === 'characterData') {
      const rodic = z.target.parentElement;
      if (zakazano(rodic)) continue;
      if (rodic.matches(POPIS)) uzelPopis(rodic); else uzelText(z.target);
    }
    else if (z.type === 'attributes' && !zakazanoAttr(z.target)) uzelAtributy(z.target);
  }
}

/** Spustí hlídání DOMu. Volá se jednou při startu (main.js). */
export function spustPreklad() {
  document.documentElement.lang = jazyk;
  if (hlidac) return;
  hlidac = new MutationObserver(zpracuj);
  hlidac.observe(document.body, {
    childList: true, subtree: true, characterData: true,
    attributes: true, attributeFilter: ATRIBUTY,
  });
  if (jazyk !== 'cs') prelozStrom(document.body);
}

/** Přepne jazyk za běhu: uloží ho a přeloží všechno, co je zrovna vidět. */
export function nastavJazyk(novy) {
  novy = novy === 'en' ? 'en' : 'cs';
  if (novy === jazyk) return;
  jazyk = novy;
  try { localStorage.setItem(KLIC, novy); } catch { /* nevadí */ }
  document.documentElement.lang = novy;
  zpracuj(hlidac?.takeRecords() || []);
  prelozStrom(document.body);
  window.dispatchEvent(new CustomEvent('astro-jazyk', { detail: novy }));
}
