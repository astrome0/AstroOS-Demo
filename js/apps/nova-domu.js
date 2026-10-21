// AstroOS — Nova: domovská stránka (nový panel)
//
// Jako nový panel v Brave: přes celou stránku fotka dne z Bingu (náhodná z posledních ~16 dní,
// s autorem vlevo dole), nahoře zkratky po stránkách, pod nimi hledání (Google, DuckDuckGo na výběr)
// a dole skleněné karty — počasí, statistiky blokování, naposledy otevřené soubory a weby.
// Otázka pro AstroAI jde z pole přes ✦ / Ctrl+Enter a odpověď se ukáže pod ním.

import { el, pad, pred } from '../util.js';
import { icon } from '../icons.js';
import { State } from '../state.js';
import * as FS from '../fs.js';
import { contextMenu } from '../ui.js';
import { tx } from '../i18n.js';

const PRIMO = !!window.astroElectron?.novaPrimo;
const openApp = (id, o) => import('../apps.js').then((m) => m.openApp(id, o));
// Data z cizích webů (Bing, open-meteo) jdou přes proxy Novy, která k odpovědi přidá CORS (jako Počasí).
// ukázková verze nemá proxy — jde napřímo (Commons povoluje CORS, Bing ne → záloha tapety AstroOS)
const pres = (url) => url;

// ---------------------------------------------------------------- vyhledávač
export const VYHLEDAVACE = {
  google: { nazev: 'Google', url: 'https://www.google.com/search?q=' },
  // bez JS přes proxy jede DuckDuckGo nejlíp v HTML podobě
  ddg: { nazev: 'DuckDuckGo', url: PRIMO ? 'https://duckduckgo.com/?q=' : 'https://html.duckduckgo.com/html/?q=' },
};
// Google přes proxy (Nova v obyčejném prohlížeči) chce JavaScript a kontrolu robota a vrátí jen
// „Pokud máte potíže s přístupem…“ → tam se hledá přes DuckDuckGo. V aplikaci je Google skutečná karta.
const jdeGoogle = PRIMO;
export const vyhledavac = () => {
  const v = State.get('nbVyhledavac');
  if (v === 'ddg' || !jdeGoogle) return 'ddg';
  return 'google';
};
export const hledatNaWebu = (q) => VYHLEDAVACE[vyhledavac()].url + encodeURIComponent(q);

const ZNAK_VYHLEDAVACE = {
  google: '<svg viewBox="0 0 24 24"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.9-1.75 2.98-4.32 2.98-7.35z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.42l-3.24-2.5c-.9.6-2.04.95-3.38.95-2.6 0-4.8-1.75-5.59-4.11H3.07v2.58A10 10 0 0 0 12 22z"/><path fill="#FBBC05" d="M6.41 13.92a6 6 0 0 1 0-3.84V7.5H3.07a10 10 0 0 0 0 9l3.34-2.58z"/><path fill="#EA4335" d="M12 5.97c1.47 0 2.79.5 3.83 1.5l2.87-2.88A10 10 0 0 0 3.07 7.5l3.34 2.58C7.2 7.72 9.4 5.97 12 5.97z"/></svg>',
  ddg: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#DE5833"/><circle cx="12" cy="12" r="7.3" fill="none" stroke="#fff" stroke-width="1.2"/><path fill="#fff" d="M10 7.6c1.9-.7 4 .4 4.3 2.3.2 1.1-.3 2-1.1 2.6l.7 4.6h-2.8l.4-4.6c-1-.6-1.6-1.8-1.1-3.1z"/><circle cx="12.4" cy="9.7" r=".6" fill="#2d4f8e"/></svg>',
};

// ---------------------------------------------------------------- návštěvy (pro zkratky)
const jenHost = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };
const ZNAME = {
  'youtube.com': 'YouTube', 'cs.wikipedia.org': 'Wikipedie', 'en.wikipedia.org': 'Wikipedia', 'seznam.cz': 'Seznam',
  'github.com': 'GitHub', 'mapy.com': 'Mapy', 'mapy.cz': 'Mapy', 'google.com': 'Google', 'duckduckgo.com': 'DuckDuckGo',
  'reddit.com': 'Reddit', 'monkeytype.com': 'Monkeytype', 'novinky.cz': 'Novinky', 'idnes.cz': 'iDNES', 'chatgpt.com': 'ChatGPT',
};
/** „cs.wikipedia.org“ → „Wikipedie“, „alza.cz“ → „Alza“ */
function jmenoWebu(host) {
  if (ZNAME[host]) return ZNAME[host];
  const casti = host.split('.');
  const hlavni = casti.length > 1 ? casti[casti.length - 2] : casti[0];
  return hlavni ? hlavni[0].toUpperCase() + hlavni.slice(1) : host;
}

/** Volá prohlížeč u každé načtené webové stránky — ze součtů vznikají nejnavštěvovanější zkratky. */
export function zapisNavstevu(url, ikona) {
  const host = jenHost(url);
  if (!host || /^(localhost|127\.|\[)/.test(host) || host.endsWith('.localhost')) return;
  const v = { ...(State.get('nbNavstevy') || {}) };
  const z = v[host] || { n: 0 };
  // Jedna stránka = jedna návštěva, i když se během načítání ohlásí několikrát
  const nova = z.posledni !== url;
  v[host] = { n: z.n + (nova ? 1 : 0), cas: Date.now(), posledni: url, ikona: ikona || z.ikona || null };
  const klice = Object.keys(v);
  if (klice.length > 80) {
    klice.sort((a, b) => v[a].n - v[b].n || v[a].cas - v[b].cas).slice(0, klice.length - 80).forEach((k) => delete v[k]);
  }
  if (nova || ikona) State.set('nbNavstevy', v);
}

const VYCHOZI_ZKRATKY = [
  ['https://www.youtube.com/', 'YouTube'],
  ['https://cs.wikipedia.org/', tx('Wikipedie', 'Wikipedia')],
  ['https://www.seznam.cz/', 'Seznam'],
  ['https://github.com/', 'GitHub'],
  ['https://mapy.com/', 'Mapy'],
];
const MAX_VLASTNICH = 24;   // po přesunu tažením se celý seznam (vlastní + automatické) uloží jako vlastní
const NA_STRANKU = 8;

/** Vlastní (připnuté) zkratky, pak výchozí. */
function zkratky() {
  const skryte = new Set(State.get('nbZkratkySkryte') || []);
  const vlastni = (State.get('nbZkratky') || []).map((z) => ({ ...z, vlastni: true }));
  const vysledek = [...vlastni];
  const mam = new Set(vlastni.map((z) => jenHost(z.url)));
  const automaticke = Math.min(vlastni.length + 10, MAX_VLASTNICH);   // k vlastním nejvýš 10 automatických
  const pridej = (url, nazev, ikona) => {
    const h = jenHost(url);
    if (!h || mam.has(h) || skryte.has(h) || vysledek.length >= automaticke) return;
    mam.add(h);
    vysledek.push({ url, nazev, ikona });
  };
  // Navštěvované weby se do zkratek samy nepřidávají — jen vlastní a výchozí (návštěvy se dál počítají pro ikonky).
  const navstevy = State.get('nbNavstevy') || {};
  VYCHOZI_ZKRATKY.forEach(([url, nazev]) => pridej(url, nazev, navstevy[jenHost(url)]?.ikona));
  return vysledek;
}

/** Ikonka webu: favicon, a když nejde načíst, písmeno v barvě odvozené z adresy. */
export function znakWebu(url, ikona, cls = 'nd-fav') {
  const host = jenHost(url) || url;
  let odstin = 0;
  for (const ch of host) odstin = (odstin * 31 + ch.charCodeAt(0)) % 360;
  const pismeno = el(`span.${cls}-pismeno`, { text: (jmenoWebu(host)[0] || '?').toUpperCase(), style: { background: `hsl(${odstin} 42% 46%)` } });
  const obal = el(`span.${cls}`, {}, pismeno);
  const zdroje = [ikona, `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`].filter(Boolean);
  const zkus = (i) => {
    if (i >= zdroje.length) return;
    const img = el('img', { alt: '', draggable: 'false' });
    img.onload = () => { if (img.naturalWidth > 1) { pismeno.remove(); obal.replaceChildren(img); } };
    img.onerror = () => zkus(i + 1);
    img.src = zdroje[i];
  };
  zkus(0);
  return obal;
}

// ---------------------------------------------------------------- fotka na pozadí (Bing)
// Bing dává fotku dne bez klíče; archiv má 8 + 8 dní zpátky. Každá země má trochu jiné fotky dne,
// takže se berou archivy víc zemí (jen latinkou psané popisky) → zhruba 40–60 různých fotek.
// Seznam se drží v nastavení a obnoví se po 12 hodinách, každý nový panel vybere náhodně jinou fotku.
const OBNOVIT_FOTKY = 12 * 3600e3;
const ZEME_FOTEK = ['cs-CZ', 'en-US', 'en-GB', 'de-DE', 'fr-FR', 'it-IT', 'es-ES', 'en-CA', 'en-AU', 'en-IN', 'pt-BR'];
// Bing víc než ~37 různých fotek nedá (archiv jen 16 dní) → k tomu Fotka dne z Wikimedia Commons za 30 dní,
// jen ty na šířku (ptáci zblízka a portréty na výšku vypadnou), to je zhruba dalších 20.
async function fotkyCommons() {
  const dny = Array.from({ length: 30 }, (_, i) => 'Template:Potd/' + new Date(Date.now() - (i + 1) * 864e5).toISOString().slice(0, 10));
  const r = await fetch(pres('https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=images&gimlimit=50'
    + '&prop=imageinfo&iiprop=url|size|extmetadata&iiextmetadatafilter=ObjectName|Artist&iiurlwidth=1920&titles='
    + encodeURIComponent(dny.join('|'))));
  if (!r.ok) return [];
  const bezHtml = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  return Object.values((await r.json()).query?.pages || {})
    .map((p) => p.imageinfo?.[0])
    .filter((i) => i?.thumburl && i.width / i.height >= 1.3)
    .map((i) => ({
      url: i.thumburl,
      // „Zona arqueológica de Cantona, Puebla, México, 2013-10-11, DD 43“ → bez data a čísla snímku
      misto: bezHtml(i.extmetadata?.ObjectName?.value).replace(/,?\s*\d{4}-\d{2}-\d{2}.*$/, '').replace(/[\s_-]+\d+$/, ''),
      autor: bezHtml(i.extmetadata?.Artist?.value).slice(0, 40),
      odkaz: i.descriptionurl || '',
    }));
}

async function seznamFotek() {
  const ulozene = State.get('nbFotky');
  if (ulozene?.v === 3 && ulozene.seznam?.length && Date.now() - ulozene.cas < OBNOVIT_FOTKY) return ulozene.seznam;
  try {
    // čeština (nebo angličtina) první → u fotek, které má víc zemí, vyhraje její popisek
    const zeme = [tx('cs-CZ', 'en-US'), ...ZEME_FOTEK.filter((z) => z !== tx('cs-CZ', 'en-US'))];
    const davky = await Promise.all(zeme.flatMap((mkt) => [0, 8].map((idx) =>
      fetch(pres(`https://www.bing.com/HPImageArchive.aspx?format=js&idx=${idx}&n=8&mkt=${mkt}`))
        .then((r) => (r.ok ? r.json() : { images: [] })).catch(() => ({ images: [] })))));
    // stejná fotka má v každé zemi jiné id („OHR.Plitvice_ROW123“ / „OHR.Plitvice_DE-DE456“) → podle jména
    const jmeno = (i) => String(i.urlbase).replace(/^.*OHR\./, '').replace(/_[^_]*$/, '');
    const videne = new Set();
    const seznam = davky.flatMap((d) => d.images || []).filter((i) => i.urlbase && !videne.has(jmeno(i)) && videne.add(jmeno(i)))
      .map((i) => {
        // „Plitvice Lakes National Park, Croatia (© Jan Wlodarczyk/Alamy)“ → místo + autor
        const m = String(i.copyright || '').match(/^(.*?)\s*\(©\s*([^/)]+)/);
        return { url: 'https://www.bing.com' + i.urlbase + '_1920x1080.jpg', misto: m ? m[1] : i.copyright || '', autor: m ? m[2].trim() : '', odkaz: i.copyrightlink || '' };
      });
    seznam.push(...await fotkyCommons().catch(() => []));
    if (seznam.length) State.set('nbFotky', { v: 3, cas: Date.now(), seznam });
    return seznam.length ? seznam : (ulozene?.seznam || []);
  } catch {
    return ulozene?.seznam || [];
  }
}
// Tapety AstroOS (img/*.webp) — záloha, když Bing ani Commons neodpoví (třeba offline).
const VLASTNI_FOTKY = [
  ['vlny.webp', 'Vlny'],
  ['oblouky.webp', 'Oblouky'],
  ['hedvabi.webp', 'Temné hedvábí'],
  ['mesic.webp', 'Měsíc nad vodou'],
  ['krivky.webp', 'Světelné křivky'],
].map(([soubor, misto]) => ({ url: 'img/' + soubor, misto, autor: 'AstroOS', odkaz: '' }));

function vyberFotku(bing) {
  const seznam = !bing.length ? VLASTNI_FOTKY : bing;
  const minula = State.get('nbFotkaPosledni');
  const kandidati = seznam.length > 1 ? seznam.filter((f) => f.url !== minula) : seznam;
  const f = kandidati[Math.floor(Math.random() * kandidati.length)];
  if (f) State.set('nbFotkaPosledni', f.url);
  return f;
}

// ---------------------------------------------------------------- blokování (Brave)
async function blokovanoOdStartu() {
  try {
    if (window.astroElectron?.blokovano) return Number(await window.astroElectron.blokovano()) || 0;
    return null;   // ukázková verze nemá proxy s blokováním reklam
  } catch { return null; }
}
/** Počítadlo serveru začíná po restartu od nuly — tady se sčítá do celkového součtu. */
async function blokovanoCelkem() {
  const ted = await blokovanoOdStartu();
  const s = State.get('nbBlok') || { celkem: 0, posledni: 0 };
  if (ted === null) return s.celkem;
  const pribylo = ted >= s.posledni ? ted - s.posledni : ted;
  if (pribylo || ted !== s.posledni) State.set('nbBlok', { celkem: s.celkem + pribylo, posledni: ted });
  return s.celkem + pribylo;
}
const cislo = (n, des = 0) => n.toLocaleString(tx('cs-CZ', 'en-US'), { maximumFractionDigits: des }).replace(/ /g, ' ');
// Odhady jako v Brave: ~50 ms a ~25 kB na jeden zablokovaný požadavek.
function usetrenyCas(n) {
  const s = n * 0.05;
  if (s < 60) return [cislo(Math.round(s)), 's'];
  if (s < 3600) return [cislo(s / 60, 1), 'min'];
  if (s < 86400) return [cislo(s / 3600, 1), tx('hodin', 'hours')];
  return [cislo(s / 86400, 1), tx('dní', 'days')];
}
function usetrenaData(n) {
  const kb = n * 25;
  if (kb < 1024) return [cislo(kb), 'kB'];
  if (kb < 1024 * 1024) return [cislo(kb / 1024, 1), 'MB'];
  return [cislo(kb / 1024 / 1024, 2), 'GB'];
}

// ---------------------------------------------------------------- počasí
let pocasiCache = null;   // { cas, m, p } — předpověď stačí jednou za 10 minut
async function nactiPocasi(signal) {
  const P = await import('./pocasi.js');
  const m = P.mestoPocasi();
  if (pocasiCache && Date.now() - pocasiCache.cas < 10 * 60e3 && pocasiCache.m.name === m.name) return { ...pocasiCache, P };
  const p = await P.predpoved(m, signal);
  pocasiCache = { cas: Date.now(), m, p };
  return { ...pocasiCache, P };
}

const SVG_POCASI = {
  slunce: '<circle cx="12" cy="12" r="4.2" class="wx-sl"/><g class="wx-sl-p"><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></g>',
  mesic: '<path class="wx-me" d="M19.5 14.6A7.8 7.8 0 0 1 9.4 4.5a7.8 7.8 0 1 0 10.1 10.1z"/>',
  oblak: '<path class="wx-ob" d="M7.2 19h9.9a4.1 4.1 0 0 0 .6-8.15A6 6 0 0 0 6.2 11.5 3.75 3.75 0 0 0 7.2 19z"/>',
  polojasno: '<circle cx="8.5" cy="8.5" r="3.3" class="wx-sl"/><path class="wx-sl-p" d="M8.5 2.6v1.2M2.6 8.5h1.2M4.3 4.3l.9.9M12.7 4.3l-.9.9"/><path class="wx-ob" d="M9.2 20h8.3a3.6 3.6 0 0 0 .5-7.15 5.2 5.2 0 0 0-9.7 1.1A3.05 3.05 0 0 0 9.2 20z"/>',
  dest: '<path class="wx-ob" d="M7.2 15.5h9.9a4.1 4.1 0 0 0 .6-8.15A6 6 0 0 0 6.2 8 3.75 3.75 0 0 0 7.2 15.5z"/><path class="wx-de" d="M8.5 18l-1 2.5M12.5 18l-1 2.5M16.5 18l-1 2.5"/>',
  snih: '<path class="wx-ob" d="M7.2 15.5h9.9a4.1 4.1 0 0 0 .6-8.15A6 6 0 0 0 6.2 8 3.75 3.75 0 0 0 7.2 15.5z"/><g class="wx-sn"><circle cx="8.5" cy="19" r=".9"/><circle cx="12" cy="20.5" r=".9"/><circle cx="15.5" cy="19" r=".9"/></g>',
  bourka: '<path class="wx-ob" d="M7.2 15.5h9.9a4.1 4.1 0 0 0 .6-8.15A6 6 0 0 0 6.2 8 3.75 3.75 0 0 0 7.2 15.5z"/><path class="wx-bl" d="M12.8 14.5l-2.3 3.6h2.6l-1.6 3.4"/>',
  mlha: '<path class="wx-ob" d="M4 9h16M6 13h12M4 17h16"/>',
};
function druhPocasi(k, noc) {
  if (k <= 1) return noc ? 'mesic' : 'slunce';
  if (k === 2) return 'polojasno';
  if (k === 3) return 'oblak';
  if (k === 45 || k === 48) return 'mlha';
  if (k >= 95) return 'bourka';
  if ((k >= 71 && k <= 77) || k === 85 || k === 86) return 'snih';
  return 'dest';
}
const ikonaPocasi = (k, noc, cls = 'nd-wx') => el(`span.${cls}`, {
  html: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${SVG_POCASI[druhPocasi(k, noc)]}</svg>`,
});

// ---------------------------------------------------------------- poslední soubory
function posledniSoubory(kolik) {
  const vse = [];
  const projdi = (cesta, uzel, hloubka) => {
    if (hloubka > 7) return;
    for (const [jmeno, n] of Object.entries(uzel.d || {})) {
      if (jmeno.startsWith('.')) continue;
      const p = cesta + '/' + jmeno;
      if (FS.isDir(n)) projdi(p, n, hloubka + 1);
      else if (n.m) vse.push({ jmeno, cesta: p, m: n.m });
    }
  };
  const domov = FS.get(FS.HOME);
  if (domov) projdi(FS.HOME, domov, 0);
  return vse.sort((a, b) => b.m - a.m).slice(0, kolik);
}

// ---------------------------------------------------------------- odpověď AstroAI (jednoduchý Markdown)
function textOdpovedi(cil, text) {
  cil.replaceChildren();
  for (const blok of text.replace(/\r/g, '').split(/\n{2,}/)) {
    const radky = blok.split('\n');
    const jeSeznam = radky.every((r) => /^\s*([-*•]|\d+[.)])\s+/.test(r) || !r.trim());
    const kontejner = jeSeznam ? el('ul') : el('p');
    for (const r of radky) {
      if (!r.trim()) continue;
      const cast = jeSeznam ? el('li') : kontejner;
      if (!jeSeznam && kontejner.childNodes.length) kontejner.append(el('br'));
      // **tučně** a `kód`, zbytek jako text
      r.replace(/^\s*([-*•]|\d+[.)])\s+/, jeSeznam ? '' : '$&').split(/(\*\*[^*]+\*\*|`[^`]+`)/).forEach((kus) => {
        if (/^\*\*.+\*\*$/.test(kus)) cast.append(el('b', { text: kus.slice(2, -2) }));
        else if (/^`.+`$/.test(kus)) cast.append(el('code', { text: kus.slice(1, -1) }));
        else if (kus) cast.append(kus.replace(/^#+\s*/, ''));
      });
      if (jeSeznam) kontejner.append(cast);
    }
    if (kontejner.childNodes.length) cil.append(kontejner);
  }
}

// ---------------------------------------------------------------- soukromé okno
/** Domovská stránka soukromého okna: co se neukládá, co je vidět dál, a hledání (bez návrhů z historie). */
export function soukromaStranka(ctx) {
  const pole = el('input.ns-pole', { spellcheck: 'false', autocomplete: 'off',
    placeholder: vyhledavac() === 'google' ? 'Hledej na Googlu nebo napiš adresu' : 'Hledej na DuckDuckGo nebo napiš adresu' });
  pole.onkeydown = (e) => {
    e.stopPropagation();
    if (e.key === 'Enter' && pole.value.trim()) ctx.jdi(ctx.normalizuj(pole.value));
  };
  const seznam = (polozky) => el('ul', {}, polozky.map((t) => el('li', { text: t })));
  setTimeout(() => pole.focus(), 60);
  return el('div.ns', {},
    el('div.ns-stred', {},
      el('div.ns-znak', {}, icon('eyeOff')),
      el('h1', { text: 'Jsi v soukromém okně' }),
      el('p.ns-pod', { text: 'Nova si z tohohle okna nic nezapamatuje. Kdo bude u počítače po tobě, neuvidí, kde jsi byl.' }),
      el('div.ns-hledani', {}, el('span.ns-vyhledavac', { html: ZNAK_VYHLEDAVACE[vyhledavac()] }), pole),
      el('div.ns-karty', {},
        el('div.ns-karta', {}, el('b', { text: 'Nova neuloží' }), seznam([
          'historii prohlížení a hledání',
          'cookies a přihlášení na webech — smažou se, až okno zavřeš',
          'navštívené weby do zkratek na domovské stránce',
        ])),
        el('div.ns-karta', {}, el('b', { text: 'Vidět to pořád může' }), seznam([
          'web, na který jdeš',
          'škola, práce nebo poskytovatel internetu',
          'Astro Defender — firewall a SmartScreen hlídají dál',
        ]))),
      el('p.ns-pozn', { text: PRIMO
        ? 'Uložená hesla Nova nabídne vyplnit. Když nějaké uložíš, zůstane ve správci hesel.'
        : 'Tady v prohlížeči sdílí soukromé okno cookies s běžnými okny. Úplně oddělené je jen v aplikaci AstroOS.' })));
}

// ---------------------------------------------------------------- stránka
/**
 * ctx z prohlížeče: { jdi, novyTab, normalizuj, signal }.
 * Vrací kořen stránky; rozběhnuté věci (AI, počasí) se zastaví, když prohlížeč stránku opustí (signal).
 */
export function domovskaStranka(ctx) {
  const signal = ctx.signal;
  const koren = el('div.nd');

  // --- pozadí: fotka dne ---
  const pozadi = el('div.nd-pozadi');
  const kredit = el('a.nd-kredit', { href: '#', 'data-no-i18n': true });
  const bezFotky = State.get('nbPozadi') === 'bez';
  koren.classList.toggle('bez-fotky', bezFotky);
  function ukazFotku(f) {
    if (!f) return;
    const img = new Image();
    img.onload = () => {
      if (signal?.aborted) return;
      pozadi.style.backgroundImage = `url("${f.url}")`;
      pozadi.classList.add('nacteno');
      kredit.replaceChildren(el('span', { text: tx('Fotka: ', 'Photo: ') }), el('b', { text: f.autor || 'Bing' }),
        f.misto ? el('span.nd-kredit-misto', { text: ' · ' + f.misto }) : null);
      kredit.title = f.misto;
      kredit.onclick = (e) => { e.preventDefault(); if (f.odkaz) ctx.novyTab?.(f.odkaz); };
      kredit.hidden = false;
    };
    img.src = f.url;
  }
  kredit.hidden = true;
  const dalsiFotka = () => seznamFotek().then((s) => ukazFotku(vyberFotku(s)));
  if (!bezFotky) dalsiFotka();

  // --- ozubené kolo: nastavení stránky ---
  const bNastaveni = el('button.nd-nastaveni', { type: 'button', title: tx('Přizpůsobit', 'Customize') }, icon('settings'));
  bNastaveni.onclick = (e) => {
    const r = bNastaveni.getBoundingClientRect();
    contextMenu([
      { icon: 'refresh', label: 'Další fotka', disabled: State.get('nbPozadi') === 'bez', onClick: () => { pozadi.classList.remove('nacteno'); dalsiFotka(); } },
      { icon: 'image', label: State.get('nbPozadi') === 'bez' ? 'Zapnout fotky na pozadí' : 'Vypnout fotky na pozadí', onClick: () => {
        const bez = State.get('nbPozadi') !== 'bez';
        State.set('nbPozadi', bez ? 'bez' : 'fotky');
        koren.classList.toggle('bez-fotky', bez);
        if (!bez) dalsiFotka();
      } },
      '-',
      { icon: 'search', label: 'Vyhledávač', sub: Object.entries(VYHLEDAVACE).map(([id, v]) => ({
        label: id === 'google' && !jdeGoogle ? tx('Google (jen v aplikaci AstroOS)', 'Google (AstroOS app only)') : v.nazev,
        icon: vyhledavac() === id ? 'check' : null,
        disabled: id === 'google' && !jdeGoogle,
        onClick: () => { State.set('nbVyhledavac', id); kresliVyhledavac(); },
      })) },
    ], { x: r.right - 240, y: r.bottom + 6 });
    e.stopPropagation();
  };

  // --- zkratky po stránkách ---
  const pas = el('div.nd-zk-pas');
  const tecky = el('div.nd-zk-tecky');
  let strana = 0;
  function kresliZkratky() {
    const seznam = zkratky();
    const polozky = seznam.map((z) => {
      const b = el('a.nd-zkratka', { href: z.url, title: `${z.nazev}\n${z.url}`, draggable: 'false' },
        el('span.nd-zkratka-dlazdice', {}, znakWebu(z.url, z.ikona)),
        el('span.nd-zkratka-t', { text: z.nazev, 'data-no-i18n': true }));   // „Seznam“ je web, ne „List“
      b._z = z;
      b.onclick = (e) => { e.preventDefault(); if (e.ctrlKey) ctx.novyTab?.(z.url); else ctx.jdi(z.url); };
      b.onpointerdown = (e) => zacniTazeni(e, b);
      b.ondragstart = (e) => e.preventDefault();
      b.onauxclick = (e) => { if (e.button === 1) { e.preventDefault(); ctx.novyTab?.(z.url); } };
      b.oncontextmenu = (e) => {
        e.preventDefault();
        contextMenu([
          { icon: 'plus', label: 'Otevřít v novém panelu', onClick: () => ctx.novyTab?.(z.url) },
          { icon: 'pencil', label: 'Upravit zkratku', onClick: () => dialogZkratky(z) },
          '-',
          { icon: 'x', label: 'Odebrat', danger: true, onClick: () => odeber(z) },
        ], { x: e.clientX, y: e.clientY });
      };
      return b;
    });
    if ((State.get('nbZkratky') || []).length < MAX_VLASTNICH) {
      polozky.push(el('button.nd-zkratka.nd-zkratka-pridat', { type: 'button', onclick: () => dialogZkratky(null) },
        el('span.nd-zkratka-dlazdice', {}, icon('plus')), el('span.nd-zkratka-t', { text: 'Přidat' })));
    }
    const stranky = [];
    for (let i = 0; i < polozky.length; i += NA_STRANKU) stranky.push(el('div.nd-zk-strana', {}, polozky.slice(i, i + NA_STRANKU)));
    strana = Math.min(strana, stranky.length - 1);
    pas.replaceChildren(...stranky);
    tecky.replaceChildren(...(stranky.length > 1 ? stranky.map((_, i) => el('button', {
      type: 'button', title: tx(`Stránka ${i + 1}`, `Page ${i + 1}`), onclick: () => posun(i),
    })) : []));
    posun(strana);
  }
  function posun(i) {
    strana = i;
    pas.style.transform = `translateX(${-100 * i}%)`;
    [...tecky.children].forEach((t, j) => t.classList.toggle('on', j === i));
  }
  // kolečko myši nad zkratkami listuje stránkami jako v Brave
  let kolecko = 0;
  pas.addEventListener('wheel', (e) => {
    const n = pas.children.length;
    if (n < 2 || Math.abs(e.deltaX || e.deltaY) < 8 || Date.now() - kolecko < 350) return;
    kolecko = Date.now();
    posun(Math.max(0, Math.min(n - 1, strana + ((e.deltaX || e.deltaY) > 0 ? 1 : -1))));
  }, { passive: true });

  // --- přesouvání zkratek tažením (jako v Brave / na iPhonu) ---
  // Levým tlačítkem chytneš zkratku a táhneš. Místa („sloty“) zkratek se změří jednou na začátku a během
  // tažení se DOM nemění — ostatní zkratky jen plynule dojíždějí na nová místa přes `transform` (CSS
  // přechod se dá kdykoli přesměrovat, takže ani rychlé škubnutí myší nic nerozhodí). Kopie pod kurzorem
  // jede přes translate3d po snímcích. Po puštění kopie doplachtí na své místo a teprve pak se seznam
  // přestaví a uloží. Přes levý/pravý okraj se po chvilce přejde na sousední stránku.
  // Uložené pořadí = celý seznam jako vlastní zkratky (stejně jako v Brave po prvním přesunu).
  let poTazeni = 0;
  koren.addEventListener('click', (e) => {   // klik hned po puštění nesmí otevřít web pod kurzorem
    if (Date.now() - poTazeni < 400) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  const PRECHOD = 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)';

  function zacniTazeni(e, b) {
    if (e.button !== 0 || koren.classList.contains('tahne')) return;
    const sx = e.clientX, sy = e.clientY;
    let klon = null, ox = 0, oy = 0, hrana = 0, snimek = 0, posledni = null;
    let stranaEl, polozky, sloty, kam;

    // Sloty = středy a rohy zkratek vůči jejich stránce → nezávislé na posunu stránek i na animacích
    function zmer() {
      stranaEl = b.parentElement;
      for (const d of stranaEl.children) { d.style.transition = 'none'; d.style.transform = ''; }
      const p = stranaEl.getBoundingClientRect();
      polozky = [...stranaEl.querySelectorAll('.nd-zkratka:not(.nd-zkratka-pridat)')];
      sloty = polozky.map((d) => {
        const r = d.getBoundingClientRect();
        return { x: r.left - p.left, y: r.top - p.top, cx: r.left - p.left + r.width / 2, cy: r.top - p.top + r.height / 2 };
      });
      kam = polozky.indexOf(b);
      stranaEl.getBoundingClientRect();
      for (const d of polozky) d.style.transition = PRECHOD;
    }

    /** Ostatní zkratky plynule na místa podle toho, kam tažená zrovna míří. */
    function rozestav() {
      const poradi = polozky.filter((d) => d !== b);
      poradi.splice(kam, 0, b);
      poradi.forEach((d, i) => {
        if (d === b) return;
        const z = sloty[polozky.indexOf(d)], na = sloty[i];
        d.style.transform = i === polozky.indexOf(d) ? '' : `translate(${na.x - z.x}px, ${na.y - z.y}px)`;
      });
      return poradi;
    }

    function snimku() {
      snimek = 0;
      const ev = posledni;
      const k = koren.getBoundingClientRect();
      klon.style.transform = `translate3d(${ev.clientX - k.left - ox}px, ${ev.clientY - k.top - oy}px, 0)`;

      // přes okraj na sousední stránku zkratek
      const okno = pas.parentElement.getBoundingClientRect();
      const smer = ev.clientX < okno.left + 28 ? -1 : ev.clientX > okno.right - 28 ? 1 : 0;
      const cil = pas.children[strana + smer];
      if (smer && cil) {
        if (!hrana) hrana = Date.now();
        else if (Date.now() - hrana > 450) {
          hrana = 0;
          // pořadí na opouštěné stránce zapsat do DOM, taženou zkratku přesunout na novou stránku
          for (const d of rozestav()) stranaEl.insertBefore(d, stranaEl.querySelector('.nd-zkratka-pridat'));
          if (smer > 0) cil.insertBefore(b, cil.firstChild);
          else cil.insertBefore(b, cil.querySelector('.nd-zkratka-pridat'));
          posun(strana + smer);
          zmer();
        }
        return;
      }
      hrana = 0;

      // nejbližší slot ke kurzoru (podle změřených míst, ne podle animovaných zkratek)
      const p = stranaEl.getBoundingClientRect();
      const mx = ev.clientX - p.left, my = ev.clientY - p.top;
      let nej = kam, nejD = Infinity;
      sloty.forEach((s, i) => { const d = Math.hypot(mx - s.cx, my - s.cy); if (d < nejD) { nejD = d; nej = i; } });
      if (nejD < 80 && nej !== kam) { kam = nej; rozestav(); }
    }

    const pohyb = (ev) => {
      if (!klon) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;   // malý pohyb = obyčejný klik
        const r = b.getBoundingClientRect();
        ox = sx - r.left; oy = sy - r.top;
        zmer();
        klon = b.cloneNode(true);
        klon.classList.add('nd-zkratka-klon');
        // Kopie vznikne rovnou pod kurzorem a bez přechodu — jinak by zdědila `transition` ze zkratky
        // a přiletěla by z levého horního rohu stránky.
        const k = koren.getBoundingClientRect();
        klon.style.transition = 'none';
        klon.style.transform = `translate3d(${ev.clientX - k.left - ox}px, ${ev.clientY - k.top - oy}px, 0)`;
        koren.append(klon);
        b.classList.add('tazena');
        koren.classList.add('tahne');
      }
      posledni = ev;
      if (!snimek) snimek = requestAnimationFrame(snimku);
    };

    const konec = () => {
      removeEventListener('pointermove', pohyb);
      removeEventListener('pointerup', konec);
      removeEventListener('pointercancel', konec);
      if (!klon) return;
      cancelAnimationFrame(snimek);
      poTazeni = Date.now();
      // kopie doplachtí na své nové místo, pak se seznam přestaví (bez skoku)
      const p = stranaEl.getBoundingClientRect(), k = koren.getBoundingClientRect();
      const cil = sloty[kam];
      klon.style.transition = PRECHOD;
      klon.style.transform = `translate3d(${p.left - k.left + cil.x}px, ${p.top - k.top + cil.y}px, 0)`;
      const poradiStrany = rozestav();
      setTimeout(() => {
        const vse = [];
        for (const s of pas.children) {
          vse.push(...(s === stranaEl ? poradiStrany : [...s.querySelectorAll('.nd-zkratka:not(.nd-zkratka-pridat)')]));
        }
        klon.remove();
        koren.classList.remove('tahne');
        State.set('nbZkratky', vse.map((x) => x._z).slice(0, MAX_VLASTNICH)
          .map(({ url, nazev, ikona }) => (ikona ? { url, nazev, ikona } : { url, nazev })));
        kresliZkratky();
      }, 260);
    };
    addEventListener('pointermove', pohyb);
    addEventListener('pointerup', konec);
    addEventListener('pointercancel', konec);
  }

  function odeber(z) {
    if (z.vlastni) State.set('nbZkratky', (State.get('nbZkratky') || []).filter((x) => x.url !== z.url));
    else State.set('nbZkratkySkryte', [...new Set([...(State.get('nbZkratkySkryte') || []), jenHost(z.url)])]);
    kresliZkratky();
  }
  function dialogZkratky(z) {
    const nazev = el('input.nd-dlg-pole', { value: z?.nazev || '', placeholder: 'Třeba Wikipedie', spellcheck: 'false' });
    const adresa = el('input.nd-dlg-pole', { value: z?.url || '', placeholder: 'cs.wikipedia.org', spellcheck: 'false' });
    const chyba = el('p.nd-dlg-chyba');
    const zavri = () => vrstva.remove();
    const uloz = () => {
      let url = adresa.value.trim();
      if (!url) { chyba.textContent = 'Napiš adresu webu.'; adresa.focus(); return; }
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
      let host;
      try { host = new URL(url).hostname; } catch { /* níž */ }
      if (!host || !host.includes('.')) { chyba.textContent = 'Tohle nevypadá jako adresa webu.'; adresa.focus(); return; }
      const nova = { url, nazev: nazev.value.trim() || jmenoWebu(host.replace(/^www\./, '')) };
      const vlastni = (State.get('nbZkratky') || []).filter((x) => !(z?.vlastni && x.url === z.url) && jenHost(x.url) !== jenHost(url));
      // upravená výchozí/navštěvovaná zkratka se stane vlastní a původní se skryje
      const skryte = new Set(State.get('nbZkratkySkryte') || []);
      if (z && !z.vlastni) skryte.add(jenHost(z.url));
      skryte.delete(jenHost(url));
      State.set('nbZkratkySkryte', [...skryte]);
      State.set('nbZkratky', [...vlastni, nova].slice(0, MAX_VLASTNICH));
      zavri();
      kresliZkratky();
    };
    for (const p of [nazev, adresa]) {
      p.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') uloz(); if (e.key === 'Escape') zavri(); };
    }
    const vrstva = el('div.nd-dlg-vrstva', { onmousedown: (e) => { if (e.target === vrstva) zavri(); } },
      el('div.nd-dlg', {},
        el('h3', { text: z ? 'Upravit zkratku' : 'Přidat zkratku' }),
        el('label', {}, el('span', { text: 'Název' }), nazev),
        el('label', {}, el('span', { text: 'Adresa' }), adresa),
        chyba,
        el('div.nd-dlg-tl', {},
          el('button.nd-tl', { type: 'button', text: 'Zrušit', onclick: zavri }),
          el('button.nd-tl.nd-tl-hlavni', { type: 'button', text: 'Uložit', onclick: uloz }))));
    koren.append(vrstva);
    setTimeout(() => (z ? adresa : nazev).focus(), 30);
  }
  kresliZkratky();

  // --- hledání ---
  const pole = el('input.nd-pole', { spellcheck: 'false', autocomplete: 'off' });
  const bVyhledavac = el('button.nd-vyhledavac', { type: 'button' });
  function kresliVyhledavac() {
    const v = vyhledavac();
    bVyhledavac.innerHTML = ZNAK_VYHLEDAVACE[v];
    bVyhledavac.title = tx(`Vyhledávač: ${VYHLEDAVACE[v].nazev}`, `Search engine: ${VYHLEDAVACE[v].nazev}`);
    pole.placeholder = v === 'google' ? 'Hledej na Googlu nebo napiš adresu' : 'Hledej na DuckDuckGo nebo napiš adresu';
  }
  kresliVyhledavac();
  bVyhledavac.onclick = (e) => {
    const r = bVyhledavac.getBoundingClientRect();
    contextMenu(Object.entries(VYHLEDAVACE).map(([id, v]) => ({
      label: id === 'google' && !jdeGoogle ? tx('Google (jen v aplikaci AstroOS)', 'Google (AstroOS app only)') : v.nazev,
      icon: vyhledavac() === id ? 'check' : null,
      disabled: id === 'google' && !jdeGoogle,
      onClick: () => { State.set('nbVyhledavac', id); kresliVyhledavac(); pole.focus(); },
    })), { x: r.left, y: r.bottom + 8 });
    e.stopPropagation();
  };
  const bAI = el('button.nd-pole-ai', { type: 'button', title: tx('Zeptat se AstroAI (Ctrl+Enter)', 'Ask AstroAI (Ctrl+Enter)') }, icon('ai'));

  const navrhy = el('div.nd-navrhy', { role: 'listbox' });
  const hledaniObal = el('div.nd-hledani-obal', {}, el('div.nd-hledani', {}, bVyhledavac, pole, bAI), navrhy);
  let vybrany = 0, polozky = [];

  const jdiNa = (vstup) => { if (vstup.trim()) ctx.jdi(ctx.normalizuj(vstup)); };
  function kresliNavrhy() {
    const q = pole.value.trim();
    const nizky = q.toLowerCase();
    polozky = [];
    if (q) {
      polozky.push({ ic: 'search', text: q, pozn: tx(`Hledat — ${VYHLEDAVACE[vyhledavac()].nazev}`, `Search — ${VYHLEDAVACE[vyhledavac()].nazev}`), akce: () => jdiNa(q) });
      const videne = new Set();
      for (const h of (State.get('nbHistorie') || []).filter((x) => /^https?:/i.test(x.url))) {
        if (polozky.length >= 5) break;
        if (videne.has(h.url) || !(h.url.toLowerCase().includes(nizky) || String(h.titulek).toLowerCase().includes(nizky))) continue;
        videne.add(h.url);
        polozky.push({ web: h.url, text: h.titulek || jenHost(h.url), pozn: jenHost(h.url), akce: () => ctx.jdi(h.url) });
      }
      polozky.push({ ic: 'ai', text: q, pozn: 'Zeptat se AstroAI', ai: true, akce: () => zeptejSe(q) });
    }
    vybrany = 0;
    navrhy.replaceChildren(...polozky.map((p, i) => {
      const r = el('button.nd-navrh' + (i === vybrany ? '.on' : '') + (p.ai ? '.nd-navrh-ai' : ''), { type: 'button', role: 'option' },
        p.web ? znakWebu(p.web, null, 'nd-navrh-fav') : el('span.nd-navrh-ic', {}, icon(p.ic)),
        el('span.nd-navrh-t', { text: p.text, 'data-no-i18n': true }),
        el('span.nd-navrh-p', { text: p.pozn }));
      r.onmousedown = (e) => e.preventDefault();   // fokus zůstane v poli
      r.onclick = () => { zavriNavrhy(); p.akce(); };
      r.onmouseenter = () => oznac(i);
      return r;
    }));
    hledaniObal.classList.toggle('otevreno', polozky.length > 0 && document.activeElement === pole);
  }
  function oznac(i) {
    vybrany = (i + polozky.length) % polozky.length;
    [...navrhy.children].forEach((r, j) => r.classList.toggle('on', j === vybrany));
  }
  const zavriNavrhy = () => hledaniObal.classList.remove('otevreno');

  pole.oninput = kresliNavrhy;
  pole.onfocus = kresliNavrhy;
  pole.onblur = () => setTimeout(zavriNavrhy, 120);
  pole.onkeydown = (e) => {
    e.stopPropagation();   // ať zkratky systému nekradou psaní
    if (e.key === 'ArrowDown' && polozky.length) { e.preventDefault(); hledaniObal.classList.add('otevreno'); oznac(vybrany + 1); }
    else if (e.key === 'ArrowUp' && polozky.length) { e.preventDefault(); oznac(vybrany - 1); }
    else if (e.key === 'Escape') { if (hledaniObal.classList.contains('otevreno')) zavriNavrhy(); else pole.value = ''; }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const q = pole.value.trim();
      if (!q) return;
      zavriNavrhy();
      if (e.ctrlKey) return zeptejSe(q);
      const p = polozky.length && document.activeElement === pole ? polozky[vybrany] : null;
      if (p) p.akce(); else jdiNa(q);
    }
  };
  bAI.onclick = () => { const q = pole.value.trim(); if (q) zeptejSe(q); else { pole.focus(); pole.placeholder = tx('Napiš otázku a stiskni Ctrl+Enter', 'Type a question and press Ctrl+Enter'); } };

  // --- odpověď AstroAI pod polem ---
  const aiOdpoved = el('div.nd-ai-odpoved');
  const aiPozn = el('span.nd-ai-pozn', { 'data-no-i18n': true });
  const aiPanel = el('div.nd-ai-panel', { hidden: true },
    el('div.nd-ai-hlava', {},
      el('span.nd-ai-znak', {}, icon('ai')), el('b', { text: 'AstroAI' }), aiPozn,
      el('button.nd-ai-chat', { type: 'button', text: 'Otevřít chat', onclick: () => openApp('astroai') }),
      el('button.nd-ai-x', { type: 'button', title: tx('Zavřít', 'Close'), onclick: () => { aiBezi?.abort(); aiPanel.hidden = true; } }, icon('x'))),
    el('p.nd-ai-otazka', { 'data-no-i18n': true }),
    aiOdpoved);
  let aiBezi = null;
  async function zeptejSe(q) {
    aiPanel.hidden = false;
    aiPanel.querySelector('.nd-ai-otazka').textContent = q;
    aiBezi?.abort();
    const ac = new AbortController();
    aiBezi = ac;
    signal?.addEventListener('abort', () => ac.abort());
    aiOdpoved.replaceChildren(el('span.nb-psani', {}, el('i'), el('i'), el('i')));
    aiPozn.textContent = '';
    let text = '';
    try {
      const AI = await import('../ai.js');
      const { rezim } = await AI.send([{ role: 'user', content: q }], {
        zdroj: 'nova', signal: ac.signal,
        onToken: (kus) => { text += kus; textOdpovedi(aiOdpoved, text); },
      });
      if (!text) aiOdpoved.textContent = tx('(model neodpověděl)', '(the model didn’t answer)');
      aiPozn.textContent = rezim === 'server' ? (State.get('aiModel') || 'LM Studio') : tx('místní režim', 'local mode');
    } catch (e) {
      if (e.name === 'AbortError') return;
      aiOdpoved.replaceChildren(el('p.nd-ai-chyba', { text: e.message }));
    }
  }

  // --- spodní karty ---
  // Statistiky
  const statBunka = (cls, popis) => {
    const n = el('b'), j = el('small');
    return { bunka: el(`div.nd-stat.${cls}`, {}, el('div.nd-stat-n', {}, n, j), el('span', { text: popis })), n, j };
  };
  const sBlok = statBunka('nd-stat-blok', 'reklam a sledovačů zablokováno');
  const sData = statBunka('nd-stat-data', 'dat ušetřeno');
  const sCas = statBunka('nd-stat-cas', 'času ušetřeno');
  const kresliStaty = (n) => {
    sBlok.n.textContent = cislo(n); sBlok.j.textContent = '';
    [sData.n.textContent, sData.j.textContent] = usetrenaData(n);
    [sCas.n.textContent, sCas.j.textContent] = usetrenyCas(n);
  };
  kresliStaty((State.get('nbBlok') || {}).celkem || 0);
  blokovanoCelkem().then(kresliStaty);
  const karStaty = el('div.nd-karta.nd-staty', {},
    el('div.nd-karta-hlava', {}, el('span', { text: 'Statistiky' })),
    el('div.nd-staty-radek', {}, sBlok.bunka, sData.bunka, sCas.bunka));

  // Počasí
  const posledni = State.get('pocasiPosledni');
  const karPocasi = el('button.nd-karta.nd-pocasi', { type: 'button', title: tx('Otevřít Počasí', 'Open Weather'), onclick: () => openApp('weather') },
    el('div.nd-karta-hlava', {}, el('span', { text: 'Počasí' }), el('span.nd-karta-pozn', { text: posledni?.misto || '' })),
    el('div.nd-pocasi-ted', {}, el('b.nd-pocasi-t', { text: posledni ? posledni.teplota + '°' : '–' }),
      el('span.nd-pocasi-p', { text: posledni?.popis || 'Načítám předpověď…' })));
  nactiPocasi(signal).then(({ m, p, P }) => {
    if (signal?.aborted) return;
    const ted = p.current.time.slice(0, 13);
    const od = Math.max(0, p.hourly.time.findIndex((t) => t.slice(0, 13) === ted));
    karPocasi.replaceChildren(
      el('div.nd-karta-hlava', {}, el('span', { text: 'Počasí' }), el('span.nd-karta-pozn', { text: m.name })),
      el('div.nd-pocasi-ted', {},
        ikonaPocasi(p.current.weather_code, !p.current.is_day),
        el('b.nd-pocasi-t', { text: Math.round(p.current.temperature_2m) + '°' }),
        el('div.nd-pocasi-info', {},
          el('span.nd-pocasi-p', { text: P.popisPocasi(p.current.weather_code) }),
          el('span.nd-pocasi-mm', { text: `${Math.round(p.daily.temperature_2m_max[0])}° / ${Math.round(p.daily.temperature_2m_min[0])}°` }))),
      el('div.nd-hodiny-pruh', {}, [2, 4, 6, 8].map((k) => od + k).filter((i) => i < p.hourly.time.length).map((i) => el('div.nd-hod', {},
        el('span', { text: pad(new Date(p.hourly.time[i]).getHours()) }),
        ikonaPocasi(p.hourly.weather_code[i], !p.hourly.is_day[i], 'nd-wx-mini'),
        el('b', { text: Math.round(p.hourly.temperature_2m[i]) + '°' })))));
  }).catch((e) => {
    if (e.name === 'AbortError') return;
    karPocasi.querySelector('.nd-pocasi-p').textContent = posledni ? tx('naposledy ', 'last ') + pred(posledni.cas) : 'Předpověď teď nejde načíst';
  });

  // Naposledy: soubory / weby
  const seznam = el('div.nd-seznam');
  const prepinac = el('div.nd-prepinac', { role: 'tablist' });
  let karta = State.get('nbDomuKarta') === 'weby' ? 'weby' : 'soubory';
  function kresliSeznam() {
    [...prepinac.children].forEach((b) => b.classList.toggle('on', b.dataset.k === karta));
    if (karta === 'soubory') {
      const s = posledniSoubory(3);
      if (!s.length) return seznam.replaceChildren(el('p.nd-prazdno', { text: 'Zatím tu nic není. Co uložíš, objeví se tady.' }));
      seznam.replaceChildren(...s.map((f) => {
        const info = FS.fileInfo(f.jmeno);
        const r = el('button.nd-radek', { type: 'button', title: f.cesta },
          el('span.nd-radek-ic', { style: { color: info.color } }, icon(info.icon)),
          el('span.nd-radek-t', { text: f.jmeno, 'data-no-i18n': true }),
          el('span.nd-radek-cas', { text: pred(f.m) }));
        r.onclick = () => import('../soubory.js').then((m) => m.otevri(f.cesta));
        return r;
      }));
    } else {
      const h = (State.get('nbHistorie') || []).filter((x) => /^https?:/i.test(x.url)).slice(0, 3);
      if (!h.length) return seznam.replaceChildren(el('p.nd-prazdno', { text: 'Historie je prázdná. Weby, které navštívíš, budou tady.' }));
      seznam.replaceChildren(...h.map((x) => {
        const r = el('button.nd-radek', { type: 'button', title: x.url },
          znakWebu(x.url, (State.get('nbNavstevy') || {})[jenHost(x.url)]?.ikona, 'nd-radek-fav'),
          el('span.nd-radek-t', { text: x.titulek || jenHost(x.url), 'data-no-i18n': true }),
          el('span.nd-radek-cas', { text: x.cas ? pred(x.cas) : '' }));
        r.onclick = () => ctx.jdi(x.url);
        return r;
      }));
    }
  }
  for (const [k, text] of [['soubory', 'Soubory'], ['weby', 'Weby']]) {
    prepinac.append(el('button', { type: 'button', role: 'tab', dataset: { k }, text, onclick: () => { karta = k; State.set('nbDomuKarta', k); kresliSeznam(); } }));
  }
  kresliSeznam();
  const karSeznam = el('div.nd-karta.nd-nedavne', {},
    el('div.nd-karta-hlava', {}, el('span', { text: 'Naposledy' }), prepinac),
    seznam);

  koren.append(
    pozadi, el('div.nd-zavoj'),
    bNastaveni,
    el('div.nd-horni', {},
      el('div.nd-zk-okno', {}, pas), tecky,
      el('div.nd-hledani-misto', {}, hledaniObal, aiPanel)),
    el('div.nd-spodek', {}, karPocasi, karStaty, karSeznam),
    kredit);
  setTimeout(() => { if (!koren.querySelector('.nd-dlg-vrstva')) pole.focus(); }, 60);
  return koren;
}
