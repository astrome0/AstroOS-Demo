// AstroOS — hostitel stránek z virtuálního disku (Nova file://, nainstalované aplikace)
//
// Ukázková verze běží bez serveru (stačí statický hosting, třeba GitHub Pages): složka se
// uloží do Cache API a vydá ji service worker (sw.js) na adrese <AstroOS>/disk/<web>/…
// Stránka dostane můstek sdk/most.js s objektem window.astro. Tady se na jeho
// volání odpovídá: oznámení, okno, soubory. Stránka v Nově (režim „web“)
// smí jen neškodné věci, nainstalovaná aplikace (režim „aplikace“) všechno.

import * as FS from './fs.js';
import { State } from './state.js';
import { toast } from './ui.js';
import { aktivniMotiv, panelMisto } from './vzhled.js';
import { clamp } from './util.js';
import { hlidejZapis } from './obrana.js';

const ZAKLAD = new URL('./', document.baseURI).href;   // kde leží index.html AstroOS
const DISK = ZAKLAD + 'disk/';
const SDK = ZAKLAD + 'sdk/';
const CACHE = 'astro-disk';

/** Service worker z sw.js — bez něj (třeba ze souboru file://) stránky z disku nepojedou. */
const sw = 'serviceWorker' in navigator
  ? navigator.serviceWorker.register(ZAKLAD + 'sw.js').then(() => navigator.serviceWorker.ready).catch(() => null)
  : Promise.resolve(null);

/** Krátké jméno webu z libovolného klíče (cesty ke složce) — jen [a-z0-9-]. */
export function jmenoWebu(predpona, klic) {
  let h = 0x811c9dc5;
  for (let i = 0; i < klic.length; i++) h = Math.imul(h ^ klic.charCodeAt(i), 0x01000193);
  return `${predpona}-${(h >>> 0).toString(36)}`;
}

const kodujCestu = (rel) => rel.split('/').map(encodeURIComponent).join('/');

/** Adresa souboru uvnitř webu: <AstroOS>/disk/<web>/<cesta> (vydává sw.js). */
export function adresaWebu(web, rel = '') {
  return `${DISK}${web}/${kodujCestu(rel)}`;
}

// Weby z disku mají stejný původ jako AstroOS (bez serveru jiný port není).
export const puvodWebu = () => location.origin;

/** Ukázková verze nemá proxy — skutečná adresa zůstane, jak je. */
export function adresaPresProxy(url) {
  return new URL(url).href;
}

/** Adresa z rámu → { web, rel }, nebo null když nepatří disku. */
export function rozeberAdresu(url) {
  let u;
  try { u = new URL(url); } catch { return null; }
  const bez = u.origin + u.pathname;
  if (!bez.startsWith(DISK)) return null;
  const m = bez.slice(DISK.length).match(/^([a-z0-9-]+)(\/.*)?$/);
  if (!m) return null;
  let rel = (m[2] || '/').replace(/^\/+/, '');
  try { rel = decodeURIComponent(rel); } catch { /* nechat jak je */ }
  return { web: m[1], rel, hash: u.hash };
}

const MIME = {
  html: 'text/html; charset=utf-8', htm: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8', txt: 'text/plain; charset=utf-8', md: 'text/plain; charset=utf-8',
  csv: 'text/csv; charset=utf-8', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg',
  jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', ico: 'image/x-icon',
  mp3: 'audio/mpeg', wav: 'audio/wav', webm: 'audio/webm', ogg: 'audio/ogg', m4a: 'audio/mp4',
  woff2: 'font/woff2',
};
const typ = (jmeno) => MIME[(jmeno.split('.').pop() || '').toLowerCase()] || 'application/octet-stream';

// Můstek jde jako první skript stránky; „/__astro/…“ (SDK v plné verzi) míří do sdk/ vedle AstroOS.
const MUSTEK = `<script src="${SDK}most.js"></script>`;
const presmerujSdk = (t) => t.replace(/(["'(])\/__astro\//g, `$1${SDK}`);
function vlozMustek(html) {
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => m + MUSTEK);
  if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, (m) => m + MUSTEK);
  return MUSTEK + html;
}

/** Obsah souboru z virtuálního disku → tělo odpovědi. Obrázky jsou dataURL nebo „astro-img:cesta“. */
async function naTelo(jmeno, obsah) {
  if (obsah.startsWith('data:') || obsah.startsWith('astro-img:')) {
    const r = await fetch(obsah.startsWith('data:') ? obsah : ZAKLAD + obsah.slice(10));
    return { typ: r.headers.get('Content-Type') || typ(jmeno), telo: await r.blob() };
  }
  const t = typ(jmeno);
  if (t.startsWith('text/html')) return { typ: t, telo: vlozMustek(presmerujSdk(obsah)) };
  if (t.startsWith('text/css')) return { typ: t, telo: presmerujSdk(obsah) };
  return { typ: t, telo: obsah };
}

/** Uloží celou složku (i s podsložkami) do cache, ze které ji sw.js vydává jako web. */
export async function nahrajSlozku(web, koren) {
  if (!(await sw) || !window.caches) {
    throw new Error('Stránky z disku potřebují service worker — otevři AstroOS přes http(s), ne jako soubor.');
  }
  const soubory = [];
  const projdi = (cesta, rel) => {
    for (const it of FS.list(cesta, { hidden: true })) {
      if (it.dir) projdi(it.path, rel + it.name + '/');
      else soubory.push([rel + it.name, it.node.c]);
    }
  };
  projdi(koren, '');
  const cache = await caches.open(CACHE);
  const zaklad = DISK + web + '/';
  for (const k of await cache.keys()) if (k.url.startsWith(zaklad)) await cache.delete(k);
  for (const [rel, obsah] of soubory) {
    if (typeof obsah !== 'string') continue;
    const { typ: t, telo } = await naTelo(rel, obsah);
    await cache.put(zaklad + kodujCestu(rel), new Response(telo, { headers: { 'Content-Type': t, 'Cache-Control': 'no-store' } }));
  }
}

// ---------------------------------------------------------------- motiv pro stránky
/** Barvy systému, které si stránka přebere do proměnných --astro-… */
export function motivProStranku() {
  const cs = getComputedStyle(document.documentElement);
  const v = (n) => cs.getPropertyValue(n).trim();
  return {
    nazev: aktivniMotiv() === 'svetly' ? 'svetly' : 'tmavy',
    barvy: {
      akcent: v('--accent'), akcentText: v('--accent-text'), pozadi: v('--bg-1'),
      karta: v('--glass-hi'), pole: v('--pole'), okraj: v('--stroke'), hover: v('--hover'),
      text: v('--txt'), text2: v('--txt-2'), text3: v('--txt-3'), rohy: v('--r-m'), okno: v('--okno'),
    },
  };
}

/** Zavolá fn(motiv) při každé změně motivu, barvy systému nebo rohů. Vrací odhlášení. */
export function sledujMotiv(fn) {
  const spojeni = { posli: (d) => { if (d.typ === 'motiv') fn(d.motiv); } };
  pripojene.add(spojeni);
  hlidejMotiv();
  return () => pripojene.delete(spojeni);
}

const pripojene = new Set();
let pozorovatel = null;
let cekaMotiv = 0;

function hlidejMotiv() {
  if (pozorovatel) return;
  // Motiv, barva systému i rohy se mění atributy a styly na <html> — stačí je sledovat.
  pozorovatel = new MutationObserver(() => {
    clearTimeout(cekaMotiv);
    cekaMotiv = setTimeout(() => {
      const m = motivProStranku();
      for (const p of pripojene) p.posli({ typ: 'motiv', motiv: m });
    }, 30);
  });
  pozorovatel.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motiv', 'data-rohy', 'style'] });
}

// ---------------------------------------------------------------- cesty pro astro.fs
/** „~/x“ → domov, relativní cesta → složka aplikace, absolutní zůstane. */
function cestaProAplikaci(cesta, koren) {
  if (typeof cesta !== 'string' || !cesta.trim()) throw new Error('Chybí cesta k souboru.');
  const c = cesta.trim();
  if (c === '~' || c.startsWith('~/')) return FS.normalize(FS.HOME + c.slice(1));
  return FS.normalize(c, koren);
}

const ikonaApp = (app) => app?.ikona || 'bell';

// ---------------------------------------------------------------- můstek
/**
 * Napojí rám na AstroOS. Vrací funkci, která spojení zruší.
 * o = { rezim: 'web'|'aplikace', web, koren, win?, app?, onStav?, onObnov?, onOdkaz?, onChyba? }
 */
export function pripojMost(ramec, o) {
  const puvod = puvodWebu();
  const ac = new AbortController();

  const spojeni = {
    posli(d) {
      try { ramec.contentWindow?.postMessage({ astroApi: 1, ...d }, puvod); } catch { /* rám zmizel */ }
    },
  };
  pripojene.add(spojeni);
  hlidejMotiv();

  const jenAplikace = (co) => {
    if (o.rezim !== 'aplikace') throw new Error(`${co} umí jen nainstalovaná aplikace, ne stránka otevřená v Nově.`);
  };

  async function vyrid(d) {
    const [a, b] = Array.isArray(d.args) ? d.args : [];
    const cesta = () => cestaProAplikaci(a, o.koren);
    switch (d.metoda) {
      case 'oznameni':
        toast({ title: a || o.app?.nazev || 'Stránka', body: b || '', icon: ikonaApp(o.app) });
        return true;

      case 'okno.titulek':
        jenAplikace('Měnit titulek okna');
        o.win.title = String(a).slice(0, 120);
        return true;
      case 'okno.velikost': {
        jenAplikace('Měnit velikost okna');
        const w = o.win;
        if (w.maximized) w.toggleMax();
        const s = w.node.style;
        const sirka = clamp(Number(a) || parseInt(s.width, 10), 320, innerWidth - 20);
        const vyska = clamp(Number(b) || parseInt(s.height, 10), 200, innerHeight - panelMisto() - 20);
        w.setBounds({
          left: clamp(parseInt(s.left, 10), 0, Math.max(0, innerWidth - sirka)),
          top: clamp(parseInt(s.top, 10), 0, Math.max(0, innerHeight - panelMisto() - vyska)),
          width: sirka, height: vyska,
        });
        return true;
      }
      case 'okno.maximalizuj':
        jenAplikace('Maximalizovat okno');
        if (!o.win.maximized) o.win.toggleMax();
        return true;
      case 'okno.zavri':
        jenAplikace('Zavřít okno');
        setTimeout(() => o.win.close(), 0);
        return true;

      case 'fs.cti':
        jenAplikace('Číst soubory z disku');
        return FS.read(cesta());
      case 'fs.zapis': {
        jenAplikace('Zapisovat na disk');
        const p = cesta();
        hlidejZapis(o.app, p);
        const slozka = FS.dirname(p);
        if (!FS.exists(slozka)) FS.mkdir(slozka, { parents: true });
        FS.write(p, b ?? '');
        return true;
      }
      case 'fs.seznam':
        jenAplikace('Procházet disk');
        return FS.list(cesta()).map((it) => ({
          nazev: it.name, cesta: it.path, slozka: it.dir, velikost: it.size, zmeneno: it.modified,
        }));
      case 'fs.existuje':
        jenAplikace('Procházet disk');
        return FS.exists(cesta());
      case 'fs.slozka': {
        jenAplikace('Zakládat složky');
        const p = cesta();
        hlidejZapis(o.app, p);
        if (!FS.exists(p)) FS.mkdir(p, { parents: true });
        return true;
      }
      case 'fs.smaz': {
        jenAplikace('Mazat soubory');
        const p = cesta();
        if (p === FS.HOME || p === o.koren || FS.HOME.startsWith(p + '/')) throw new Error('Tuhle složku aplikace smazat nesmí.');
        hlidejZapis(o.app, p);
        FS.remove(p);   // do koše, dá se obnovit
        return true;
      }

      case 'ai.zeptej': {
        const AI = await import('./ai.js');
        let text = '';
        await AI.send([{ role: 'user', content: String(a) }], {
          zdroj: 'aplikace',
          signal: ac.signal,
          onToken: (kus) => { text += kus; spojeni.posli({ typ: 'odpoved', id: d.id, kus }); },
        });
        return text;
      }

      case 'otevri': {
        jenAplikace('Otevírat aplikace');
        const { APPS, openApp } = await import('./apps.js');
        if (typeof a === 'string' && /^(https?|astro|file):/i.test(a)) { openApp('browser', { url: a }); return true; }
        if (!APPS[a]) throw new Error(`Aplikace „${a}“ v systému není.`);
        openApp(a, b && typeof b === 'object' ? b : undefined);
        return true;
      }
    }
    throw new Error(`Neznámé volání astro.${d.metoda}`);
  }

  const zprava = (e) => {
    if (e.source !== ramec.contentWindow || e.origin !== puvod) return;
    const d = e.data;
    if (!d || d.astroApi !== 1) return;
    switch (d.typ) {
      case 'ahoj':
        spojeni.posli({
          typ: 'info',
          info: {
            rezim: o.rezim,
            aplikace: o.app ? { id: o.app.id, nazev: o.app.nazev, slozka: o.koren } : null,
            slozka: o.rezim === 'aplikace' ? o.koren : null,
            uzivatel: State.get('user').name,
            motiv: motivProStranku(),
          },
        });
        o.onStav?.(d);
        break;
      case 'stav': o.onStav?.(d); break;
      case 'obnov': o.onObnov?.(); break;
      case 'chyba': o.onChyba?.({ zprava: String(d.zprava || ''), soubor: String(d.soubor || ''), radek: Number(d.radek) || 0 }); break;
      case 'odkaz': if (typeof d.url === 'string' && /^https?:\/\//i.test(d.url)) o.onOdkaz?.(d.url); break;
      case 'volani':
        Promise.resolve().then(() => vyrid(d)).then(
          (vysledek) => spojeni.posli({ typ: 'odpoved', id: d.id, vysledek }),
          (err) => spojeni.posli({ typ: 'odpoved', id: d.id, chyba: err?.message || String(err) }),
        );
        break;
    }
  };
  window.addEventListener('message', zprava);

  return () => {
    window.removeEventListener('message', zprava);
    ac.abort();
    pripojene.delete(spojeni);
  };
}
