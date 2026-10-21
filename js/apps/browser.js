// AstroOS — Nova Prohlížeč (stránky uvnitř systému, adresy astro://)

import { el, cz, plural, bus } from '../util.js';
import { icon, logo, glyfAplikace } from '../icons.js';
import { State } from '../state.js';
import * as FS from '../fs.js';
import { toast, contextMenu } from '../ui.js';
import { jmenoWebu, adresaWebu, rozeberAdresu, nahrajSlozku, pripojMost, adresaPresProxy } from '../hostitel.js';
import { webAplikacePro } from '../webaplikace.js';
import { posudWeb, zapisWeb, firewallPovoli, zapisFirewall } from '../obrana.js';
import * as Sit from '../sit.js';
import { strankaKoupit } from '../aktivace.js';
import { getFocused } from '../wm.js';
import * as Nativni from '../nativni.js';
import { domovskaStranka, soukromaStranka, hledatNaWebu, zapisNavstevu } from './nova-domu.js';
import { strankaHesla } from './nova-hesla.js';
import * as Hesla from '../hesla.js';

const DOMU = 'astro://domu';
// V aplikaci (Electron, AstroOS/app) má každý panel s webem skutečnou kartu Chromia (nativni.js,
// app/web.js) — weby běží jako v Chromu, s adblockem. V prohlížeči dál iframe přes proxy.
const PRIMO = !!window.astroElectron?.novaPrimo;

// Proxy na skutečné weby běží na vedlejším portu (server.js + webproxy.js) — jiný původ,
// takže stránka z internetu nesáhne na localStorage AstroOS.
const WEB = `${location.protocol}//${location.hostname}:${Number(location.port || 80) + 1}`;

const jeWeb = (url) => /^https?:\/\//i.test(url);

// Soubory z virtuálního disku jako stránky — file:///domov/uzivatel/projekty/web/index.html.
// Složka se nahraje na server (hostitel.js) a vydá jako skutečný web, takže fungují
// relativní odkazy, obrázky, fetch() i podstránky, přesně jako HTML otevřené ve Windows.
const jeSoubor = (url) => /^file:\/\//i.test(url);
function cestaZUrl(url) {
  let p = url.replace(/^file:\/\//i, '').split(/[?#]/)[0];
  try { p = decodeURI(p); } catch { /* nechat jak je */ }
  return FS.normalize(p || '/');
}
const hashZUrl = (url) => (url.includes('#') ? url.slice(url.indexOf('#')) : '');
export const souborNaUrl = (cesta) => 'file://' + FS.normalize(cesta);
/** Adresa, kterou vydala naše proxy (…/web/… nebo subdoména www.x.cz.localhost:8148). */
function jeZProxy(url) {
  try {
    const u = new URL(url), w = new URL(WEB);
    return u.port === w.port && (u.hostname === w.hostname || u.hostname.endsWith('.localhost'));
  } catch { return false; }
}
const naProxy = adresaPresProxy;

// ---------------------------------------------------------------- adresy
/** „astro://soubory/domov/uzivatel?q=x“ → { stranka, cesta, dotaz } */
function rozeber(url) {
  const bezSchematu = url.replace(/^astro:\/\//, '');
  const [cesta, hledani] = bezSchematu.split('?');
  const casti = cesta.split('/').filter(Boolean);
  const dotaz = new URLSearchParams(hledani || '').get('q') || '';
  return { stranka: casti[0] || 'domu', cesta: '/' + casti.slice(1).join('/'), dotaz };
}

/** Co uživatel napsal do adresního řádku. */
function normalizuj(vstup) {
  const t = vstup.trim();
  if (!t) return DOMU;
  if (t.startsWith('astro://')) return t;
  if (jeWeb(t)) return t;
  if (jeSoubor(t)) return t;
  if (/^(~|\/)/.test(t) && !/^\/\//.test(t)) return souborNaUrl(t.replace(/^~(?=\/|$)/, FS.HOME));
  if (!/\s/.test(t) && /^[\w-]+(\.[\w-]+)+(:\d+)?([/?#]|$)/.test(t)) return 'https://' + t;
  if (STRANKY[t.toLowerCase()]) return 'astro://' + t.toLowerCase();
  // Text bez adresy jde rovnou do vyhledávače (Google / DuckDuckGo). Hledání v systému + odpověď
  // AstroAI zůstalo na astro://hledat — z domovské stránky přes „Zeptat se AI“.
  return hledatNaWebu(t);
}

// ---------------------------------------------------------------- stránky
// Nákaza z Mince Generátoru (nakaza.js) přepne domovskou stránku Novy na falešnou a do
// výsledků hledání přidá „sponzorovaný“ odkaz. Nic to nerozbije, jen obtěžuje; vrátí to Defender.
const jeUnos = () => !!State.get('nkNovaUnos');
function unosDomu(ctx) {
  const pole = el('input.nb-hledani-pole', { placeholder: 'Hledej mince, mince, nebo mince…', spellcheck: 'false' });
  pole.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter' && pole.value.trim()) ctx.jdi(normalizuj(pole.value)); };
  const dl = (nad, pod) => { const b = el('button.nb-tile.nb-unos-tile', {}, el('div.nb-tile-ic', { text: '🪙' }), el('div', {}, el('b', { text: nad }), el('span', { text: pod }))); b.onclick = () => ctx.jdi('astro://hledat?q=mince+zdarma'); return b; };
  setTimeout(() => pole.focus(), 60);
  return el('div.nb-domu.nb-unos', {},
    el('div.nb-unos-znak', { text: '🪙' }),
    el('h1', { text: 'Mincdvakrát Search™' }),
    el('p.nb-pozdrav', { text: 'Tvůj NOVÝ a VYLEPŠENÝ vyhledávač! (nastaveno Mince Generátorem 2000)' }),
    el('div.nb-hledani', {}, icon('search'), pole, el('button.nb-hledani-btn', {}, icon('search'))),
    el('div.nb-dlazdice', {}, dl('MINCE ZDARMA', 'Klikni a získej 1 000 000 mincí!'), dl('iPhone ZDARMA', 'Jsi 1 000 000. návštěvník!'), dl('Stáhni si RAM', 'Zrychli počítač jedním klikem'), dl('Antivirus ZDARMA', 'Tvůj počítač je v nebezpečí!')),
    el('p.nb-unos-pozn', { text: 'Chceš zpátky normální Novu? Spusť Astro Defender.' }));
}
const STRANKY = {};
const stranka = (id, def) => { STRANKY[id] = def; };

const odkaz = (text, url, ctx, ikona) => {
  const a = el('a.nb-link', { href: '#' }, ikona ? icon(ikona) : null, el('span', { text }));
  a.onclick = (e) => { e.preventDefault(); ctx.jdi(url); };
  return a;
};

// --- správce hesel (nova-hesla.js, trezor v hesla.js) ---
stranka('hesla', { titulek: 'Hesla', ikona: 'key', vykresli: (ctx, arg) => strankaHesla(ctx, arg) });

// --- obchod s licencemi AstroOS (aktivace.js) ---
stranka('koupit', { titulek: 'AstroOS Store', ikona: 'key', vykresli: (_ctx, arg) => strankaKoupit(arg) });

// --- domovská ---
stranka('domu', {
  titulek: 'Nova',
  ikona: 'home',
  vykresli(ctx) {
    if (ctx.soukrome) return soukromaStranka({ ...ctx, normalizuj });
    if (jeUnos()) return unosDomu(ctx);
    return domovskaStranka({ ...ctx, normalizuj });   // nova-domu.js
  },
});

// --- hledání ---
stranka('hledat', {
  titulek: (a) => `${a.dotaz} — hledání`,
  ikona: 'search',
  vykresli(ctx, arg) {
    const q = arg.dotaz;
    const wrap = el('div.nb-str', {},
      el('h2.nb-nadpis', { text: `Výsledky pro „${q}“` }),
      el('div.nb-chipy', { style: { marginBottom: '20px' } },
        el('button.nb-chip.nb-chip-web', { onclick: () => ctx.jdi(hledatNaWebu(q)) },
          icon('globe'), el('span', { text: `Hledat „${q}“ na internetu` })),
        el('button.nb-chip', { onclick: () => ctx.jdi('https://cs.wikipedia.org/w/index.php?search=' + encodeURIComponent(q)) },
          icon('book'), el('span', { text: 'na Wikipedii' }))));
    if (jeUnos()) wrap.append(el('div.nb-unos-reklama', {}, el('span.nb-unos-znacka', { text: 'SPONZOROVÁNO' }), el('div', {}, el('b', { text: '🪙 MINCE ZDARMA — klikni teď!' }), el('span', { text: 'mince-zdarma-100-legalni.astro · ověřeno (ne)' }))));
    const nizky = q.toLowerCase();

    // 1) stránky prohlížeče
    const strankyShoda = Object.entries(STRANKY)
      .filter(([id, s]) => id.includes(nizky) || (typeof s.titulek === 'string' && s.titulek.toLowerCase().includes(nizky)))
      .slice(0, 4);

    // 2) soubory na disku
    const soubory = [];
    const projdi = (cesta, hloubka = 0) => {
      if (hloubka > 5) return;
      let polozky = [];
      try { polozky = FS.list(cesta); } catch { return; }
      for (const p of polozky) {
        if (p.name.toLowerCase().includes(nizky)) soubory.push(p);
        if (p.dir) projdi(p.path, hloubka + 1);
      }
    };
    projdi('/');

    if (strankyShoda.length) {
      wrap.append(el('div.nb-vysledky', {}, strankyShoda.map(([id, s]) =>
        el('div.nb-vysledek', {},
          odkaz(typeof s.titulek === 'function' ? id : s.titulek, 'astro://' + id, ctx, s.ikona),
          el('div.nb-url', { text: 'astro://' + id }),
        ))));
    }

    if (soubory.length) {
      wrap.append(el('div.nb-sekce', {},
        el('h3', { text: plural(soubory.length, ['soubor na disku', 'soubory na disku', 'souborů na disku']) }),
        el('div.nb-vysledky', {}, soubory.slice(0, 12).map((s) =>
          el('div.nb-vysledek', {},
            odkaz(s.name, 'astro://soubory' + s.path, ctx, s.dir ? 'folder' : FS.fileInfo(s.name).icon),
            el('div.nb-url', { text: s.path }),
          ))),
      ));
    }

    // 3) odpověď od AstroAI
    const odpoved = el('div.nb-ai-text', {}, el('span.nb-psani', {}, el('i'), el('i'), el('i')));
    const znacka = el('div.nb-ai-znacka', { text: 'ptám se modelu…' });
    wrap.append(el('div.nb-ai', {},
      el('div.nb-ai-hlava', {}, icon('ai'), el('b', { text: 'Odpověď od AstroAI' })),
      odpoved, znacka,
    ));

    (async () => {
      try {
        const AI = await import('../ai.js');
        let text = '';
        // holé slovo z vyhledávání model mate — přibalíme mu, že jde o hledaný pojem
        const jeOtazka = /[?]\s*$/.test(q) || /^(co|jak|proč|kdo|kdy|kde|kolik|jaký|jaká|jaké|umíš|můžeš)\b/i.test(q);
        const promptText = jeOtazka ? q : `Stručně, ve dvou až třech větách, vysvětli pojem „${q}“. Pokud ho neznáš, napiš to rovnou.`;
        const { rezim } = await AI.send([{ role: 'user', content: promptText }], {
          zdroj: 'nova',
          signal: ctx.signal,
          onToken: (kus) => {
            text += kus;
            odpoved.textContent = text;
            },
        });
        if (!text) odpoved.textContent = '(model neodpověděl)';
        znacka.textContent = rezim === 'server'
          ? `odpověděl model ${State.get('aiModel') || ''} v LM Studiu`
          : 'místní režim — lokální model není dostupný';
      } catch (e) {
        if (e.name === 'AbortError') return;
        odpoved.textContent = 'Odpověď se nepovedlo načíst: ' + e.message;
        znacka.textContent = '';
      }
    })();

    if (!strankyShoda.length && !soubory.length) {
      wrap.insertBefore(el('p.nb-nic', { text: 'Uvnitř systému se nic takového nenašlo. Zkus internet nahoře nebo AstroAI níž.' }), wrap.children[2]);
    }
    return wrap;
  },
});

// --- soubory jako web ---
stranka('soubory', {
  titulek: (a) => (a.cesta === '/' ? 'Můj disk' : FS.basename(a.cesta)),
  ikona: 'hdd',
  vykresli(ctx, arg) {
    const cesta = FS.normalize(arg.cesta || '/');
    const uzel = FS.get(cesta);
    const wrap = el('div.nb-str');

    // drobečky
    const casti = cesta === '/' ? [] : cesta.slice(1).split('/');
    const drobky = el('div.nb-drobky', {}, odkaz('Disk', 'astro://soubory/', ctx, 'hdd'));
    let acc = '';
    casti.forEach((c) => {
      acc += '/' + c;
      drobky.append(el('span.nb-drobek-sep', { text: '/' }), odkaz(c, 'astro://soubory' + acc, ctx));
    });
    wrap.append(drobky);

    if (!uzel) {
      wrap.append(el('p.nb-nic', { text: 'Tahle cesta na disku není.' }));
      return wrap;
    }

    if (FS.isDir(uzel)) {
      const polozky = FS.list(cesta);
      wrap.append(el('h2.nb-nadpis', { text: cesta === FS.HOME ? 'Domovská složka' : FS.basename(cesta) || 'Disk' }));
      if (!polozky.length) return wrap.append(el('p.nb-nic', { text: 'Prázdná složka.' })), wrap;
      wrap.append(el('div.nb-seznam', {}, polozky.map((p) => {
        const info = p.dir ? { icon: 'folder', color: '#e0b25c', kind: 'Složka' } : FS.fileInfo(p.name);
        const r = el('button.nb-radek', {},
          el('span.nb-radek-ic', { style: { color: info.color } }, icon(info.icon)),
          el('span.nb-radek-n', { text: p.name }),
          el('span.nb-radek-k', { text: info.kind }),
          el('span.nb-radek-v', { text: p.dir ? plural(p.count, ['položka', 'položky', 'položek']) : FS.humanSize(p.size) }),
        );
        r.onclick = () => ctx.jdi('astro://soubory' + p.path);
        return r;
      })));
      return wrap;
    }

    // soubor
    const jmeno = FS.basename(cesta);
    const info = FS.fileInfo(jmeno);
    wrap.append(el('div.nb-soubor-hlava', {},
      el('div.nb-soubor-ic', { style: { color: info.color } }, icon(info.icon)),
      el('div', {}, el('h2', { text: jmeno }),
        el('span', { text: `${info.kind} · ${FS.humanSize(FS.size(uzel))} · změněno ${cz.datumKratky(new Date(uzel.m || Date.now()))}` })),
      el('div.nb-soubor-akce', {},
        /\.html?$/i.test(jmeno) ? el('button.btn.primary', {
          text: 'Zobrazit jako stránku',
          onclick: () => ctx.jdi(souborNaUrl(cesta)),
        }) : null,
        el('button.btn', {
          text: 'Otevřít v aplikaci',
          onclick: () => import('../apps.js').then(({ openApp }) =>
            openApp(FS.isImage(jmeno) ? 'photos' : /\.(html?|css|js|json)$/i.test(jmeno) ? 'editor' : 'notes', { path: cesta })),
        })),
    ));

    const src = FS.imageSrc(cesta);
    if (src) wrap.append(el('div.nb-obraz', {}, el('img', { src, alt: jmeno })));
    else if (info.text) wrap.append(el('pre.nb-kod', {}, el('code', { text: FS.read(cesta) })));
    else wrap.append(el('p.nb-nic', { text: 'Tenhle typ souboru se tady zobrazit nedá.' }));

    return wrap;
  },
});

// --- nápověda ---
stranka('napoveda', {
  titulek: 'Nápověda',
  ikona: 'book',
  vykresli(ctx) {
    const zkratky = [
      ['Win', 'nabídka Start'],
      ['Win + L', 'uzamknout systém'],
      ['Win + D', 'zobrazit plochu'],
      ['Alt + Tab', 'přepnout okno'],
      ['Alt + F4', 'zavřít okno'],
      ['Esc', 'zavřít nabídku nebo panel'],
      ['F2', 'přejmenovat ikonu nebo soubor'],
      ['Delete', 'vyhodit soubor do koše'],
    ];
    const tipy = [
      ['Okna', 'Tažením k okraji obrazovky se okno přichytí na půlku, nahoru na celou plochu.'],
      ['Ikony', 'Označ jich víc rámečkem nebo Ctrl+klikem a táhni je najednou.'],
      ['Terminál', 'Napiš „help“ pro seznam příkazů. Tabulátor doplňuje názvy souborů.'],
      ['Fotky', 'U obrázku klikni na „Tapeta“ a hned ho máš na ploše.'],
      ['AstroAI', 'Když neběží lokální model, přepne se do místního režimu a ovládá systém.'],
    ];
    return el('div.nb-str', {},
      el('h2.nb-nadpis', { text: 'Jak AstroOS funguje' }),
      el('div.nb-sekce', {},
        el('h3', { text: 'Klávesové zkratky' }),
        el('div.nb-zkratky', {}, zkratky.map(([k, v]) =>
          el('div.nb-zkratka', {}, el('kbd', { text: k }), el('span', { text: v })))),
      ),
      el('div.nb-sekce', {},
        el('h3', { text: 'Tipy' }),
        el('div.nb-tipy', {}, tipy.map(([t, p]) =>
          el('div.nb-tip', {}, el('b', { text: t }), el('span', { text: p })))),
      ),
      el('div.nb-sekce', {},
        el('h3', { text: 'Kam dál' }),
        el('div.nb-chipy', {},
          odkaz('Můj disk', 'astro://soubory' + FS.HOME, ctx, 'hdd'),
          odkaz('O systému', 'astro://onas', ctx, 'info'),
          odkaz('Domů', DOMU, ctx, 'home')),
      ),
    );
  },
});

// --- o systému ---
stranka('onas', {
  titulek: 'O systému',
  ikona: 'info',
  vykresli(ctx) {
    const u = FS.usage();
    const radky = [
      ['Systém', 'AstroOS 1.0 „Nova“'],
      ['Sestavení', '2026.09.20'],
      ['Jádro', 'nova 6.9.2-astro'],
      ['Prohlížeč', 'Nova 1.0'],
      ['Uživatel', State.get('user').name],
      ['Disk', `${FS.humanSize(u.used)} z 2 TB`],
    ];
    return el('div.nb-str', {},
      el('div.nb-onas', {}, logo('nb-znak-velky'),
        el('div', {}, el('h2', { text: 'AstroOS' }),
          el('p', { text: 'Operační systém napsaný od nuly — v prohlížeči, od bootu po správce oken.' }))),
      el('div.nb-tabulka', {}, radky.map(([k, v]) =>
        el('div.nb-tr', {}, el('span', { text: k }), el('b', { text: v })))),
      el('div.nb-sekce', {}, el('h3', { text: 'Dál v systému' }),
        el('div.nb-chipy', {}, odkaz('Nápověda', 'astro://napoveda', ctx, 'book'), odkaz('Domů', DOMU, ctx, 'home'))),
    );
  },
});

// --- rozcestník na AstroAI ---
stranka('ai', {
  titulek: 'AstroAI',
  ikona: 'ai',
  vykresli(ctx) {
    const pole = el('input.nb-hledani-pole', { placeholder: 'Na co se chceš zeptat?', spellcheck: 'false' });
    pole.onkeydown = (e) => {
      e.stopPropagation();
      if (e.key === 'Enter' && pole.value.trim()) ctx.jdi('astro://hledat?q=' + encodeURIComponent(pole.value.trim()));
    };
    setTimeout(() => pole.focus(), 60);
    return el('div.nb-str.nb-stred', {},
      el('div.nb-ai-velky', {}, icon('ai')),
      el('h2', { text: 'Zeptej se AstroAI' }),
      el('p.nb-nic', { text: 'Odpověď hledá lokální model. Když neodpovídá, zaskočí místní režim.' }),
      el('div.nb-hledani', { style: { maxWidth: '520px', margin: '18px auto 0' } }, icon('search'), pole),
      el('div.nb-chipy', { style: { justifyContent: 'center', marginTop: '18px' } },
        el('button.nb-chip', { text: 'Otevřít celou aplikaci', onclick: () => import('../apps.js').then(({ openApp }) => openApp('astroai')) })),
    );
  },
});

// --- příručka pro vlastní aplikace ---
stranka('vyvojari', {
  titulek: 'Aplikace pro AstroOS',
  ikona: 'code',
  vykresli(ctx) {
    const kod = (text) => el('pre.nb-kod', {}, el('code', { text }));
    const api = [
      ['astro.info()', 'Promise s { rezim, uzivatel, aplikace, motiv } — rezim je „aplikace“, „web“ (stránka v Nově) nebo „nahled“ (Editor).'],
      ['astro.oznameni(titulek, text)', 'Oznámení v rohu obrazovky a v centru oznámení. Funguje všude.'],
      ['astro.fs.cti(cesta)', 'Přečte soubor jako text. „data.txt“ = ve složce aplikace, „~/Dokumenty/x.txt“ = domovská složka.'],
      ['astro.fs.zapis(cesta, text)', 'Zapíše soubor (chybějící složky založí).'],
      ['astro.fs.seznam(cesta)', 'Pole { nazev, cesta, slozka, velikost, zmeneno }.'],
      ['astro.fs.existuje(cesta) · slozka(cesta) · smaz(cesta)', 'Smazaný soubor jde do koše.'],
      ['astro.ai.zeptej(otazka, kus => …)', 'Zeptá se AstroAI, odpověď chodí po kouscích, na konci celý text.'],
      ['astro.okno.titulek(t) · velikost(š, v) · maximalizuj() · zavri()', 'Ovládání vlastního okna.'],
      ['astro.otevri(„notes“ | adresa)', 'Otevře jinou aplikaci nebo adresu v Nově.'],
      ['astro.web(url)', 'Jako fetch(), jen jde přes proxy AstroOS — z internetu jde stáhnout cokoli bez CORS.'],
      ['astro.na(„motiv“, m => …)', 'Zavolá se, když se přepne světlý/tmavý motiv nebo barva systému.'],
    ];
    return el('div.nb-str', {},
      el('h2.nb-nadpis', { text: 'Jak napsat aplikaci pro AstroOS' }),
      el('p.nb-nic', { text: 'Aplikace je obyčejná webová stránka ve složce. Když ji nainstaluješ, dostane vlastní okno, ikonu ve Startu, na ploše i v panelu — a objekt window.astro, přes který mluví se systémem.' }),
      el('div.nb-sekce', {},
        el('h3', { text: '1. Založ ji' }),
        el('p.nb-nic', { text: 'Editor kódu → Nový → Aplikace pro AstroOS. Vznikne složka s těmito soubory:' }),
        kod('moje-aplikace/\n  index.html   stránka (můstek window.astro se přidá sám)\n  styl.css     tvůj vzhled\n  app.js       tvůj kód\n  app.json     název, ikona, barva a velikost okna'),
      ),
      el('div.nb-sekce', {},
        el('h3', { text: '2. Zkoušej ji' }),
        el('p.nb-nic', { text: 'Náhled v Editoru se obnovuje při psaní. Tlačítko „V Nově“ otevře stránku jako file:// adresu — jako HTML otevřené ve Windows; po uložení se sama načte znovu. Na disk ale smí jen nainstalovaná aplikace.' }),
      ),
      el('div.nb-sekce', {},
        el('h3', { text: '3. Nainstaluj ji' }),
        el('p.nb-nic', { text: 'V Editoru tlačítko „Nainstalovat“ (nebo pravým tlačítkem na složku v Souborech). Vybereš ikonu, barvu a velikost okna — zapíšou se do app.json. Potom se tlačítko změní na „Spustit“; F5 v běžící aplikaci ji načte s novými soubory.' }),
        kod('{\n  "nazev": "Moje aplikace",\n  "ikona": "star",\n  "barva": "#46c36f",\n  "kategorie": "tools",\n  "sirka": 520,\n  "vyska": 460\n}'),
      ),
      el('div.nb-sekce', {},
        el('h3', { text: 'window.astro' }),
        el('div.nb-tipy', {}, api.map(([k, v]) => el('div.nb-tip', {}, el('b', { text: k }), el('span', { text: v })))),
        kod("const info = await astro.info();\nastro.oznameni('Ahoj', 'Jsem ' + info.uzivatel);\n\nconst pozn = await astro.fs.cti('~/Dokumenty/cti-me.txt');\nawait astro.fs.zapis('zaloha.txt', pozn);\n\nconst odpoved = await astro.ai.zeptej('Vymysli jméno pro kočku');"),
      ),
      el('div.nb-sekce', {},
        el('h3', { text: 'Vzhled systému' }),
        el('p.nb-nic', { text: 'Přidej <link rel="stylesheet" href="/__astro/styl.css"> a stránka dostane písmo, tlačítka (třída hlavni), pole a karty (třída karta) jako AstroOS. Barvy ber z proměnných — přepnou se s motivem samy:' }),
        kod('--astro-akcent   --astro-pozadi   --astro-karta   --astro-pole\n--astro-okraj    --astro-text     --astro-text-2  --astro-rohy'),
      ),
      el('div.nb-sekce', {},
        el('h3', { text: 'Dobré vědět' }),
        el('div.nb-tipy', {},
          el('div.nb-tip', {}, el('b', { text: 'Vlastní localStorage' }), el('span', { text: 'Každá aplikace běží na vlastní adrese, takže má svoje localStorage a do systému nevidí.' })),
          el('div.nb-tip', {}, el('b', { text: 'Relativní cesty' }), el('span', { text: 'img/logo.png, data.json, druha.html — všechno ve složce aplikace funguje jako na webu, i fetch().' })),
          el('div.nb-tip', {}, el('b', { text: 'Ukázky' }), el('span', { text: 'Obchod → Aplikace: Úkoly a Stopky. Tlačítko „Zdrojový kód“ je otevře v Editoru.' })),
        ),
      ),
      el('div.nb-chipy', {},
        el('button.nb-chip', { text: 'Nová aplikace', onclick: () => import('../apps.js').then(({ openApp }) => openApp('editor', { novaAplikace: true })) }),
        el('button.nb-chip', { text: 'Obchod s ukázkami', onclick: () => import('../apps.js').then(({ openApp }) => openApp('store')) }),
      ),
    );
  },
});

// --- stránka mimo systém ---
stranka('mimo', {
  titulek: (a) => a.dotaz || 'Stránka není dostupná',
  ikona: 'globe',
  vykresli(ctx, arg) {
    return el('div.nb-str.nb-stred', {},
      el('div.nb-chyba-ic', {}, icon('wifiOff')),
      el('h2', { text: 'Tahle stránka je mimo AstroOS' }),
      el('p.nb-nic', {}, el('code', { text: arg.dotaz }), el('br'),
        'AstroOS je uzavřený systém a ven na internet se nedostane. Hledat se ale dá uvnitř.'),
      el('div.nb-chipy', { style: { justifyContent: 'center', marginTop: '18px' } },
        el('button.nb-chip', {
          text: `Hledat „${arg.dotaz}“ v systému`,
          onclick: () => ctx.jdi('astro://hledat?q=' + encodeURIComponent(arg.dotaz)),
        }),
        el('button.nb-chip', { text: 'Domů', onclick: () => ctx.jdi(DOMU) })),
    );
  },
});

// ---------------------------------------------------------------- aplikace
export const browserApp = {
  id: 'browser', name: 'Nova Prohlížeč', icon: 'globe', color: 'linear-gradient(145deg,#4aa3e8,#2563a8)',
  cat: 'net', width: 1020, height: 680,

  mount(body, win) {
    const st = { taby: [], i: 0 };
    // Soukromé okno: nic do historie ani zkratek, v aplikaci vlastní relace jen v paměti (app/web.js),
    // která se při zavření okna smaže. Nové panely v něm zůstávají soukromé.
    const soukrome = !!win.opts?.soukrome;
    const idRelace = soukrome ? 'p' + win.id : null;
    const NAZEV = soukrome ? 'Nova · soukromé okno' : 'Nova';

    const panelTabu = el('div.nb-taby');
    const adresa = el('input.nb-adresa', { spellcheck: 'false' });
    const obsah = el('div.nb-obsah');
    const web = el('div.nb-web-vrstva', { hidden: true });   // iframy panelů se skutečnými weby
    const zamek = el('span.nb-zamek', {}, icon('lock'));

    const tlacitko = (ic, titulek, fn) => {
      const b = el('button.nb-tool', { title: titulek, onclick: fn }, icon(ic));
      return b;
    };
    const bZpet = tlacitko('chevronLeft', 'Zpět', () => zpet());
    const bVpred = tlacitko('chevronRight', 'Vpřed', () => vpred());
    const bObnovit = tlacitko('refresh', 'Obnovit', () => vykresli(true));
    const bDomu = tlacitko('home', 'Domovská stránka', () => jdi(DOMU));
    const bNovy = el('button.nb-novy', { title: 'Nový panel', onclick: () => novyTab() }, icon('plus'));

    adresa.onkeydown = (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') jdi(normalizuj(adresa.value));
      if (e.key === 'Escape') { adresa.value = tab()?.url || ''; adresa.blur(); }
    };
    adresa.onfocus = () => adresa.select();

    // Web, ze kterého je v systému aplikace (Mapy, Monkeytype…) — jako „Otevřít v aplikaci“ v Chromu
    const bAplikace = el('button.nb-v-aplikaci', { hidden: true });
    bAplikace.onclick = () => {
      const t = tab(), a = t && webAplikacePro(t.url);
      if (a) import('../apps.js').then(({ openApp }) => openApp(a.id, { url: t.url }));
    };
    function ukazAplikaci() {
      const t = tab(), a = t && jeWeb(t.url) ? webAplikacePro(t.url) : null;
      bAplikace.hidden = !a;
      if (!a || bAplikace.dataset.id === a.id) return;
      bAplikace.dataset.id = a.id;
      bAplikace.title = `Otevřít v aplikaci ${a.name}`;
      bAplikace.replaceChildren(glyfAplikace(a, 'span.nb-v-aplikaci-ic'),
        el('span', { text: `Otevřít v aplikaci` }));
    }

    // Klíček v adrese: pro tenhle web máš uložené heslo → správce hesel
    const bKlic = el('button.nb-klic', { hidden: true, title: 'Uložená hesla pro tento web' }, icon('key'));
    bKlic.onclick = () => { const t = tab(); if (t) novyTab('astro://hesla?q=' + encodeURIComponent(Hesla.domena(Hesla.hostZ(t.url)))); };
    function ukazKlic() {
      const t = tab();
      bKlic.hidden = !(t && jeWeb(t.url) && Hesla.odemceno() && Hesla.proWeb(t.url).length);
    }
    const offHesla = bus.on('hesla:zmena', () => { ukazKlic(); kresliHesloListu(); });

    // Nabídka ⋮ jako v Chromu
    const bMenu = tlacitko('dots', 'Nabídka', (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      const okno = (o) => import('../wm.js').then(({ openWindow }) => openWindow(browserApp, o));
      contextMenu([
        { icon: 'plus', label: 'Nový panel', key: 'Ctrl+T', onClick: () => novyTab() },
        { icon: 'square', label: 'Nové okno', onClick: () => okno({}) },
        { icon: 'eyeOff', label: 'Nové soukromé okno', key: 'Ctrl+Shift+N', onClick: () => okno({ soukrome: true }) },
        '-',
        { icon: 'key', label: 'Hesla', onClick: () => novyTab('astro://hesla') },
        { icon: 'home', label: 'Domovská stránka', onClick: () => jdi(DOMU) },
      ], { x: r.right - 230, y: r.bottom + 4 });
    });

    const lista = el('div.nb-panel', {}, bZpet, bVpred, bObnovit, bDomu,
      el('div.nb-adresa-box', {}, zamek, adresa, bAplikace, bKlic), bMenu);
    const hesloLista = el('div.nb-heslo-lista', { hidden: true });
    body.append(el('div.nb', {}, lista, hesloLista, obsah, web));
    // Panely sedí přímo v záhlaví okna jako v Chromu (o řádek míň). Okno se dál táhne za volné místo
    // vedle panelů; klik a dvojklik na panel okno nehýbe ani nemaximalizuje.
    win.node.classList.add('nb-okno');
    const zahlavi = win.node.querySelector('.win-bar');
    const liste = el('div.nb-liste', {}, panelTabu, bNovy);
    for (const ev of ['pointerdown', 'dblclick']) liste.addEventListener(ev, (e) => { if (e.target.closest('.nb-tab, .nb-novy')) e.stopPropagation(); });
    zahlavi.insertBefore(liste, zahlavi.querySelector('.drag'));
    if (soukrome) {
      win.node.classList.add('nb-soukrome');
      zahlavi.insertBefore(el('span.nb-soukrome-znak', { title: 'Historie, cookies ani přihlášení z tohohle okna se neukládají' },
        icon('eyeOff'), el('span', { text: 'Soukromé' })), zahlavi.querySelector('.win-ctl'));
    }

    // ---------- panely ----------
    const tab = () => st.taby[st.i];

    function novyTab(url = DOMU) {
      st.taby.push({ id: 't' + Date.now().toString(36) + st.taby.length, url, titulek: 'Nový panel', ikona: 'globe', hist: [], hi: -1 });
      st.i = st.taby.length - 1;
      jdi(url);
    }

    function zavriTab(i) {
      st.taby[i]?.signal?.abort();
      odpojSoubor(st.taby[i]);
      st.taby[i]?.frame?.remove();
      zrusKartu(st.taby[i]);
      st.taby.splice(i, 1);
      if (!st.taby.length) return novyTab();
      st.i = Math.min(st.i, st.taby.length - 1);
      vykresli();
    }

    function kresliTaby() {
      panelTabu.innerHTML = '';
      st.taby.forEach((t, i) => {
        const zavrit = el('span.nb-tab-x', {}, icon('x'));
        zavrit.onclick = (e) => { e.stopPropagation(); zavriTab(i); };
        let znak = icon(t.ikona);
        if (t.nacita) znak = el('span.nb-tab-toc');
        else if (t.favicon) {
          znak = el('img.nb-fav', { src: t.favicon, alt: '' });
          znak.onerror = () => { t.favicon = null; znak.replaceWith(icon(t.ikona)); };
        }
        const b = el('div.nb-tab' + (i === st.i ? '.on' : ''), { title: t.titulek },
          znak, el('span.nb-tab-t', { text: t.titulek }), st.taby.length > 1 ? zavrit : null);
        b.onclick = () => { st.i = i; vykresli(); };
        b.oncontextmenu = (e) => {
          e.preventDefault();
          contextMenu([
            { icon: 'refresh', label: 'Obnovit', onClick: () => { st.i = i; vykresli(true); } },
            { icon: 'plus', label: 'Nový panel', onClick: () => novyTab() },
            '-',
            { icon: 'x', label: 'Zavřít panel', danger: true, disabled: st.taby.length < 2, onClick: () => zavriTab(i) },
          ], { x: e.clientX, y: e.clientY });
        };
        panelTabu.append(b);
      });
    }

    // ---------- navigace ----------
    function jdi(url, zapsat = true) {
      const t = tab();
      if (!t) return;
      const znovu = t.url === url;   // Enter na stejné adrese = obnovit
      if (zapsat && t.url !== url) {
        t.hist = t.hist.slice(0, t.hi + 1);
        t.hist.push(url);
        t.hi = t.hist.length - 1;
      } else if (zapsat && t.hi < 0) {
        t.hist = [url];
        t.hi = 0;
      }
      t.url = url;
      vykresli(znovu);
    }
    function zpet() { const t = tab(); if (t && t.hi > 0) { t.hi--; t.url = t.hist[t.hi]; vykresli(); } }
    function vpred() { const t = tab(); if (t && t.hi < t.hist.length - 1) { t.hi++; t.url = t.hist[t.hi]; vykresli(); } }

    function zapisHistorii(url, titulek) {
      if (url === DOMU || soukrome) return;
      const h = (State.get('nbHistorie') || []).filter((x) => x.url !== url);
      h.unshift({ url, titulek, cas: Date.now() });
      State.set('nbHistorie', h.slice(0, 20));
    }

    // ---------- vykreslení ----------
    function vykresli(obnovit = false) {
      const t = tab();
      if (!t) return;
      t.signal?.abort?.();
      const ac = new AbortController();
      t.signal = ac;

      adresa.value = t.url;
      for (const x of st.taby) if (x.frame) x.frame.hidden = x !== t;
      for (const x of st.taby) if (x.karta) x.karta.hidden = x !== t || !jeWeb(x.url);

      if (!jeSoubor(t.url)) odpojSoubor(t);
      const blok = jeWeb(t.url) ? blokaceWebu(t) : null;
      if (t.karta && (!jeWeb(t.url) || blok)) t.karta.hidden = true;
      if (blok) {
        if (t.frame) { t.frame.remove(); t.frame = null; t.frameUrl = null; t.favicon = null; }
        t.nacita = false;
        web.hidden = true;
        obsah.hidden = false;
        obsah.replaceChildren(blok);
      } else if (jeWeb(t.url)) {
        vykresliWeb(t, obnovit);
      } else if (jeSoubor(t.url)) {
        vykresliSoubor(t, obnovit);
      } else {
        if (t.frame) { t.frame.remove(); t.frame = null; t.favicon = null; t.nacita = false; }
        web.hidden = true;
        obsah.hidden = false;
        vykresliAstro(t, ac);
      }

      zamek.classList.toggle('nezabezpeceno', /^http:/i.test(t.url));
      zamek.replaceChildren(icon(jeSoubor(t.url) ? 'hdd' : 'lock'));
      zamek.title = /^http:/i.test(t.url) ? 'Spojení není zabezpečené' : jeWeb(t.url) ? 'Zabezpečené spojení'
        : jeSoubor(t.url) ? 'Soubor z disku AstroOS' : 'Stránka AstroOS';
      lista.classList.toggle('nacita', !!t.nacita);
      bZpet.disabled = !(t.hi > 0);
      bVpred.disabled = !(t.hi < t.hist.length - 1);
      win.title = NAZEV;
      ukazAplikaci();
      ukazKlic();
      kresliHesloListu();
      kresliTaby();
    }

    /** Astro Defender: brána firewall a SmartScreen. Vrací stránku s varováním, nebo null. */
    function blokaceWebu(t) {
      let host = t.url;
      try { host = new URL(t.url).hostname; } catch { /* necháme adresu */ }
      const otevriDefender = (stranka) => import('../apps.js').then(({ openApp }) => openApp('defender', { stranka }));

      if (!Sit.online()) {
        t.titulek = 'Bez připojení';
        t.ikona = Sit.letadlo() ? 'letadlo' : 'wifiOff';
        return el('div.nb-str.nb-stred', {},
          el('div.nb-chyba-ic', {}, icon(t.ikona)),
          el('h2', { text: Sit.letadlo() && !Sit.wifiZapnuta() ? 'Jsi v režimu Letadlo' : 'Nejsi připojený k internetu' }),
          el('p.nb-nic', { text: Sit.letadlo() && !Sit.wifiZapnuta()
            ? 'Wi-Fi je vypnutá, takže se Nova nikam nedostane. Stránky astro:// a soubory z disku fungují dál.'
            : 'Zapni Wi-Fi nebo se připoj k síti. Stránky astro:// a soubory z disku fungují i offline.' }),
          el('div.nb-chipy', { style: { justifyContent: 'center', marginTop: '18px' } },
            Sit.letadlo()
              ? el('button.nb-chip', { text: 'Vypnout režim Letadlo', onclick: () => { Sit.nastavLetadlo(false); vykresli(true); } })
              : el('button.nb-chip', { text: Sit.wifiZapnuta() ? 'Připojit k AstroNet' : 'Zapnout Wi-Fi', onclick: async () => {
                if (!Sit.wifiZapnuta()) Sit.nastavWifi(true); else await Sit.pripoj('astronet');
                vykresli(true);
              } }),
            el('button.nb-chip', { text: 'Sítě v dosahu', onclick: () => import('../taskbar.js').then((m) => m.otevriSite()) }),
            el('button.nb-chip', { text: 'Zkusit znovu', onclick: () => vykresli(true) })));
      }

      if (!firewallPovoli('browser')) {
        t.titulek = 'Připojení zablokováno';
        t.ikona = 'wall';
        if (t.blokZapsan !== t.url) { t.blokZapsan = t.url; zapisFirewall('browser', 'Nova Prohlížeč'); }
        return el('div.nb-str.nb-stred', {},
          el('div.nb-chyba-ic', {}, icon('wall')),
          el('h2', { text: 'Brána firewall zablokovala připojení' }),
          el('p.nb-nic', { text: 'Astro Defender nepouští Novu na internet. Povolit ji můžeš v Bráně firewall a ochraně sítě.' }),
          el('div.nb-chipy', { style: { justifyContent: 'center', marginTop: '18px' } },
            el('button.nb-chip', { text: 'Otevřít nastavení brány firewall', onclick: () => otevriDefender('firewall') }),
            el('button.nb-chip', { text: 'Zkusit znovu', onclick: () => vykresli(true) })));
      }

      const posudek = t.smartOk === host ? null : posudWeb(t.url);
      if (!posudek) return PRIMO ? null : bezProxy(t, host);
      t.titulek = 'Nebezpečný web';
      t.ikona = 'shieldX';
      if (t.blokZapsan !== t.url) { t.blokZapsan = t.url; zapisWeb(t.url, posudek); }
      const nadpis = { phishing: 'Tento web byl nahlášen jako nebezpečný', malware: 'Tento web může poškodit tvůj počítač', podvod: 'Tento web vypadá jako podvod' }[posudek.typ];
      const dalsi = el('div.df-ss-dalsi', { hidden: true },
        el('p', { text: 'Když budeš pokračovat, můžeš přijít o heslo nebo účet. Astro Defender to nedoporučuje.' }),
        el('button.df-ss-odkaz', {
          text: 'Přesto pokračovat na nebezpečný web (nedoporučuje se)',
          onclick: () => { t.smartOk = host; vykresli(true); },
        }));
      return el('div.df-smartscreen', {},
        el('div.df-ss-karta', {},
          el('div.df-ss-ic', {}, icon('shieldX')),
          el('h2', { text: nadpis }),
          el('p', { text: posudek.duvod }),
          el('code', { text: host }),
          el('p.df-ss-mdl', { text: 'Astro Defender SmartScreen tě chrání před podvodnými weby, které se snaží získat osobní údaje nebo hesla.' }),
          el('div.df-ss-akce', {},
            el('button.df-ss-zpet', { text: 'Zpět do bezpečí', onclick: () => (t.hi > 0 ? zpet() : jdi(DOMU)) }),
            el('button.df-ss-vic', { text: 'Další informace', onclick: () => { dalsi.hidden = !dalsi.hidden; } })),
          dalsi));
    }

    /**
     * Ukázková verze nemá proxy (server.js), takže skutečné weby se v Nově zobrazit nedají —
     * většina webů do rámu cizí stránky nepustí. Nabídne se otevření v opravdovém prohlížeči.
     */
    function bezProxy(t, host) {
      t.titulek = host;
      t.ikona = 'globe';
      return el('div.nb-str.nb-stred', {},
        el('div.nb-chyba-ic', {}, icon('globe')),
        el('h2', { text: 'Weby v ukázkové verzi nejdou' }),
        el('p.nb-nic', { text: 'Plná verze AstroOS otevírá weby přes vlastní server. Ukázka běží jen v prohlížeči, takže sem web nevloží. Stránky astro:// a soubory z disku fungují normálně.' }),
        el('code', { text: host }),
        el('div.nb-chipy', { style: { justifyContent: 'center', marginTop: '18px' } },
          el('button.nb-chip', { text: 'Otevřít v novém panelu prohlížeče', onclick: () => window.open(t.url, '_blank', 'noopener') }),
          el('button.nb-chip', { text: 'Domů', onclick: () => jdi(DOMU) })));
    }

    /** Skutečný web v iframu přes proxy. Iframe patří panelu, přepnutí panelu ho nenačítá znovu. */
    function vykresliWeb(t, obnovit) {
      obsah.hidden = true;
      web.hidden = false;
      if (PRIMO) return vykresliKartu(t, obnovit);
      ram(t);
      t.frame.hidden = false;
      if (obnovit || t.frameUrl !== t.url) {
        t.frameUrl = t.url;
        t.cekam = true;          // první zpráva ze stránky jen upřesní adresu (přesměrování), nepřidá krok historie
        t.nacita = true;
        try { t.titulek = new URL(t.url).hostname; } catch { t.titulek = t.url; }
        t.ikona = 'globe';
        t.frame.src = PRIMO ? t.url : naProxy(t.url);
      }
    }

    // ---------- skutečná karta Chromia (jen v aplikaci) ----------
    function vykresliKartu(t, obnovit) {
      if (t.frame) { t.frame.remove(); t.frame = null; }
      if (!t.karta) {
        t.karta = el('div.nb-nativni');
        web.append(t.karta);
        Nativni.sleduj(t.id, t.karta, {
          naStav: (s) => zeKarty(t, s),
          naNovy: (url) => novyTab(url),
          naFokus: () => import('../wm.js').then((wm) => wm.focus(win)),
          naHeslo: (typ, d) => naHeslo(t, typ, d),
          relace: idRelace,
        });
      }
      t.karta.hidden = false;
      if (obnovit && t.frameUrl === t.url) { Nativni.prikaz(t.id, 'reload'); return; }
      if (t.frameUrl !== t.url) {
        t.frameUrl = t.url;
        t.cekam = true;          // první zpráva z karty jen upřesní adresu (přesměrování), nepřidá krok historie
        t.nacita = true;
        try { t.titulek = new URL(t.url).hostname; } catch { t.titulek = t.url; }
        t.ikona = 'globe';
        Nativni.jdi(t.id, t.url);
      }
    }

    function zrusKartu(t) {
      if (!t?.karta) return;
      Nativni.pust(t.id);
      t.karta.remove();
      t.karta = null;
    }

    /** Stav z karty (adresa, titulek, ikona, načítání) — stejně jako zprávy můstku proxy. */
    function zeKarty(t, s) {
      const nacitaDriv = t.nacita;
      t.nacita = !!s.nacita;
      if (t === tab()) lista.classList.toggle('nacita', t.nacita);
      if (!/^https?:/i.test(s.url || '')) { if (nacitaDriv !== t.nacita) kresliTaby(); return; }
      zeStranky(t, { typ: s.nacita ? 'stav' : 'nacteno', url: s.url, titulek: s.titulek, ikona: s.ikona });
    }

    // ---------- správce hesel: lišta „Uložit heslo?“ pod adresou ----------
    // Lišta je řádek nad obsahem (ne bublina) — bublina přes web by kartu Chromia zakryla a zmrazila na snímek.
    function naHeslo(t, typ, d) {
      if (typ === 'spravovat') return novyTab('astro://hesla?q=' + encodeURIComponent(Hesla.domena(Hesla.hostZ(t.url))));
      if (typ === 'odemknout') t.hesloNavrh = { typ: 'odemknout' };
      else if (typ === 'navrh') {
        const stav = Hesla.odemceno() ? Hesla.coSOdeslanym(d.url, d.jmeno, d.heslo) : Hesla.nikdyPro(Hesla.hostZ(d.url)) ? 'nikdy' : 'nove';
        if (stav === 'stejne' || stav === 'nikdy') return;
        t.hesloNavrh = { typ: 'navrh', stav, ...d };
      }
      if (t === tab()) kresliHesloListu();
    }

    function kresliHesloListu() {
      const t = tab();
      const n = t?.hesloNavrh;
      hesloLista.hidden = !n;
      if (!n) return hesloLista.replaceChildren();
      const zavri = () => { t.hesloNavrh = null; kresliHesloListu(); };
      const stop = (e) => e.stopPropagation();
      const chyba = el('span.nb-hl-chyba');
      // zamčený trezor → heslo účtu přímo v liště (účet bez hesla se odemkne sám)
      const ucet = !Hesla.odemceno() && State.get('user')?.password
        ? el('input.nb-hl-pole.nb-hl-ucet', { type: 'password', placeholder: 'Heslo účtu AstroOS', onkeydown: stop }) : null;
      const odemkni = async () => {
        if (Hesla.odemceno()) return true;
        const heslo = ucet ? ucet.value : '';
        if (heslo !== (State.get('user')?.password || '') || !(await Hesla.odemkni(heslo))) {
          chyba.textContent = 'Heslo účtu nesedí.';
          ucet?.select();
          return false;
        }
        return true;
      };
      const host = Hesla.hostZ(n.url || t.url);

      if (n.typ === 'odemknout') {
        const bOdemknout = el('button.nb-hl-tl.hlavni', { type: 'button', text: 'Odemknout' });
        bOdemknout.onclick = async () => {
          if (!(await odemkni())) return;
          zavri();
          toast({ title: 'Hesla odemčená', body: 'Klikni znovu do přihlašovacího pole.', icon: 'key' });
        };
        ucet?.addEventListener('keydown', (e) => { if (e.key === 'Enter') bOdemknout.click(); });
        hesloLista.replaceChildren(...[el('span.nb-hl-ic', {}, icon('lock')),
          el('span.nb-hl-text', { text: 'Hesla jsou zamčená. Odemkni je heslem účtu AstroOS.' }),
          ucet, chyba, el('span.nb-hl-mezera'), bOdemknout,
          el('button.nb-hl-x', { type: 'button', title: 'Zavřít', onclick: zavri }, icon('x'))].filter(Boolean));   // replaceChildren(null) = text „null“
        setTimeout(() => ucet?.focus(), 30);
        return;
      }

      const zmena = n.stav === 'zmena';
      const jmeno = el('input.nb-hl-pole', { value: n.jmeno || '', placeholder: 'Jméno', spellcheck: 'false', onkeydown: stop, 'data-no-i18n': true });
      const heslo = el('span.nb-hl-heslo', { text: '•'.repeat(Math.min(12, n.heslo.length)), 'data-no-i18n': true });
      const oko = el('button.nb-hl-oko', { type: 'button', title: 'Zobrazit heslo' }, icon('eye'));
      oko.onclick = () => {
        const vidim = heslo.textContent === n.heslo;
        heslo.textContent = vidim ? '•'.repeat(Math.min(12, n.heslo.length)) : n.heslo;
        oko.replaceChildren(icon(vidim ? 'eye' : 'eyeOff'));
      };
      const bUlozit = el('button.nb-hl-tl.hlavni', { type: 'button', text: zmena ? 'Aktualizovat' : 'Uložit' });
      bUlozit.onclick = async () => {
        if (!(await odemkni())) return;
        const stav = Hesla.coSOdeslanym(n.url, jmeno.value.trim(), n.heslo);
        if (stav !== 'stejne') await Hesla.ulozHeslo({ url: n.url, jmeno: jmeno.value.trim(), heslo: n.heslo });
        zavri();
        toast({ title: stav === 'zmena' ? 'Heslo aktualizováno' : 'Heslo uloženo', body: host, icon: 'key' });
      };
      for (const p of [jmeno, ucet]) p?.addEventListener('keydown', (e) => { if (e.key === 'Enter') bUlozit.click(); });
      hesloLista.replaceChildren(...[el('span.nb-hl-ic', {}, icon('key')),
        el('span.nb-hl-text', {}, zmena ? 'Aktualizovat heslo pro ' : 'Uložit heslo pro ', el('b', { text: host, 'data-no-i18n': true }), '?'),
        jmeno, el('span.nb-hl-heslo-obal', {}, heslo, oko), ucet, chyba,
        el('span.nb-hl-mezera'),
        bUlozit,
        zmena ? null : el('button.nb-hl-tl', { type: 'button', text: 'Nikdy pro tento web', onclick: () => { Hesla.nastavNikdy(host); zavri(); } }),
        el('button.nb-hl-x', { type: 'button', title: 'Zavřít', onclick: zavri }, icon('x'))].filter(Boolean));
    }

    // ---------- soubory z disku (file://) ----------
    function odpojSoubor(t) {
      if (!t?.soubor) return;
      t.soubor.odpoj();
      t.soubor = null;
    }

    function chybaSouboru(t, nadpis, text) {
      if (t !== tab()) return;
      web.hidden = true;
      obsah.hidden = false;
      t.nacita = false;
      lista.classList.remove('nacita');
      obsah.replaceChildren(el('div.nb-str.nb-stred', {},
        el('div.nb-chyba-ic', {}, icon('info')),
        el('h2', { text: nadpis }),
        el('p.nb-nic', {}, el('code', { text }), el('br'), 'Soubor můžeš najít v Souborech nebo na stránce Můj disk.'),
        el('div.nb-chipy', { style: { justifyContent: 'center', marginTop: '18px' } },
          el('button.nb-chip', { text: 'Můj disk', onclick: () => jdi('astro://soubory' + FS.HOME) }),
          el('button.nb-chip', { text: 'Zkusit znovu', onclick: () => vykresli(true) })),
      ));
      kresliTaby();
    }

    function vykresliSoubor(t, obnovit) {
      const cesta = cestaZUrl(t.url);
      const uzel = FS.get(cesta);
      if (!uzel) {
        t.titulek = FS.basename(cesta) || 'Soubor';
        t.ikona = 'info';
        return chybaSouboru(t, 'Soubor na disku není', cesta);
      }

      // Kořen webu = složka otevřeného souboru. Při proklikání do podsložky zůstává stejný.
      const uvnitr = t.soubor && (cesta === t.soubor.koren || cesta.startsWith(t.soubor.koren.replace(/\/$/, '') + '/'));
      const koren = uvnitr ? t.soubor.koren : FS.isDir(uzel) ? cesta : FS.dirname(cesta);
      const rel = cesta === koren ? '' : cesta.slice(koren === '/' ? 1 : koren.length + 1) + (FS.isDir(uzel) ? '/' : '');

      obsah.hidden = true;
      web.hidden = false;
      ram(t);
      t.frame.hidden = false;

      if (!t.soubor || t.soubor.koren !== koren) {
        odpojSoubor(t);
        const idWebu = jmenoWebu('f', koren);
        t.soubor = {
          koren, web: idWebu,
          odpoj: pripojMost(t.frame, {
            rezim: 'web', web: idWebu, koren,
            onStav: (d) => zeSouboru(t, d),
            onObnov: () => { if (t === tab()) vykresli(true); else t.frameUrl = null; },
            onOdkaz: (url) => { st.i = Math.max(0, st.taby.indexOf(t)); jdi(url); },
          }),
        };
        t.frameUrl = null;
      }

      if (obnovit || t.frameUrl !== t.url) {
        t.frameUrl = t.url;
        t.cekam = true;
        t.nacita = true;
        t.favicon = null;
        t.titulek = FS.basename(cesta) || 'Disk';
        t.ikona = FS.isDir(uzel) ? 'folder' : 'code';
        const s = t.soubor;
        const cil = adresaWebu(s.web, rel) + hashZUrl(t.url);
        nahrajSlozku(s.web, s.koren).then(() => {
          if (t.soubor !== s || t.frameUrl !== t.url) return;     // mezitím se šlo jinam
          t.frame.src = cil;
        }).catch((e) => {
          if (t.soubor === s) chybaSouboru(t, 'Stránku se nepodařilo otevřít', e.message);
        });
      }
    }

    /** Můstek hlásí adresu a název stránky — z adresy na serveru se stane zase file://. */
    function zeSouboru(t, d) {
      const r = rozeberAdresu(String(d.url || ''));
      if (!r || !t.soubor || r.web !== t.soubor.web) return;
      const cesta = FS.normalize(t.soubor.koren + '/' + r.rel);
      const url = souborNaUrl(cesta) + (r.hash || '');
      if (url !== t.url) {
        if (t.cekam) t.hist[t.hi] = url;
        else {
          t.hist = t.hist.slice(0, t.hi + 1);
          t.hist.push(url);
          t.hi = t.hist.length - 1;
        }
        t.url = url;
      }
      t.frameUrl = t.url;
      if (d.typ === 'stav') t.cekam = false;
      t.titulek = String(d.titulek || '').trim().slice(0, 120) || FS.basename(cesta) || 'Disk';
      zapisHistorii(t.url, t.titulek);
      if (t === tab()) {
        if (document.activeElement !== adresa) adresa.value = t.url;
        bZpet.disabled = !(t.hi > 0);
        bVpred.disabled = !(t.hi < t.hist.length - 1);
        win.title = NAZEV;
      }
      kresliTaby();
    }

    // Živé obnovení: uložíš soubor ze složky, kterou má panel otevřenou, a stránka se načte znovu.
    const hlidejDisk = bus.on('fs:change', (zmena) => {
      for (const t of st.taby) {
        if (!t.soubor || !jeSoubor(t.url)) continue;
        const k = t.soubor.koren;
        if (zmena !== k && !String(zmena).startsWith(k === '/' ? '/' : k + '/')) continue;
        clearTimeout(t.zive);
        t.zive = setTimeout(() => { if (t === tab()) vykresli(true); else t.frameUrl = null; }, 250);
      }
    });

    /** Iframe panelu (jeden na panel, pro weby i soubory z disku). */
    function ram(t) {
      if (!t.frame) {
        // Od disku a nastavení AstroOS stránku odděluje jiný port proxy (jiný původ).
        // Sandbox jí bere hlavně `top.location = …` — weby s ochranou proti rámům by jinak
        // přepsaly celé AstroOS. allow-same-origin je tu bezpečné, protože „vlastní původ“
        // je port proxy; bez něj některé vložené prohlížeče blokují všechny požadavky
        // stránky (ERR_BLOCKED_BY_CLIENT). Stahování souborů schválně povolené není.
        t.frame = el('iframe.nb-web', {
          sandbox: 'allow-scripts allow-forms allow-same-origin allow-modals allow-presentation allow-pointer-lock',
          // vložené přehrávače (YouTube) potřebují automatické spuštění a celou obrazovku
          allow: 'autoplay; fullscreen; encrypted-media; picture-in-picture',
          allowfullscreen: true,
        });
        t.frame.addEventListener('load', () => {
          t.nacita = false;
          if (t === tab()) lista.classList.remove('nacita');
          kresliTaby();
        });
        web.append(t.frame);
      }
      return t.frame;
    }

    /** Zpráva od můstku, který proxy vkládá do každé stránky. */
    function zpravaZeStranky(e) {
      const d = e.data;
      if (!d || d.astroWeb !== 1) return;
      const t = st.taby.find((x) => x.frame && x.frame.contentWindow === e.source);
      if (!t) return;

      if (d.typ === 'novyPanel') {
        if (typeof d.url === 'string' && jeWeb(d.url)) novyTab(d.url);
        return;
      }
      zeStranky(t, d);
    }

    function zeStranky(t, d) {
      if (typeof d.url !== 'string' || !jeWeb(d.url)) return;

      if (d.url !== t.url) {
        if (t.cekam) t.hist[t.hi] = d.url;         // přesměrování — nahradí aktuální krok
        else {
          t.hist = t.hist.slice(0, t.hi + 1);
          t.hist.push(d.url);
          t.hi = t.hist.length - 1;
        }
        t.url = d.url;
      }
      t.frameUrl = t.url;
      if (d.typ === 'nacteno') t.cekam = false;
      if (d.titulek) t.titulek = String(d.titulek).trim().slice(0, 120) || t.titulek;
      if (typeof d.ikona === 'string' && (jeZProxy(d.ikona) || (PRIMO && /^https:\/\//i.test(d.ikona)))) t.favicon = d.ikona;
      zapisHistorii(t.url, t.titulek);
      if (d.typ === 'nacteno' && !soukrome) zapisNavstevu(t.url, t.favicon);   // nejnavštěvovanější weby = zkratky na domovské stránce

      if (t === tab()) {
        if (document.activeElement !== adresa) adresa.value = t.url;
        zamek.classList.toggle('nezabezpeceno', /^http:/i.test(t.url));
        bZpet.disabled = !(t.hi > 0);
        bVpred.disabled = !(t.hi < t.hist.length - 1);
        win.title = NAZEV;
        ukazAplikaci();
        ukazKlic();
      }
      kresliTaby();
    }
    window.addEventListener('message', zpravaZeStranky);

    // klik do iframu se ke správci oken nedostane — okno vytáhneme dopředu, když iframe získá fokus
    const priBlur = () => setTimeout(() => {
      if (st.taby.some((x) => x.frame && document.activeElement === x.frame)) {
        import('../wm.js').then((wm) => wm.focus(win));
      }
    }, 0);
    window.addEventListener('blur', priBlur);

    function vykresliAstro(t, ac) {
      const arg = rozeber(t.url);
      const def = STRANKY[arg.stranka];
      t.favicon = null;

      obsah.innerHTML = '';
      if (!def) {
        t.titulek = 'Stránka nenalezena';
        t.ikona = 'info';
        obsah.append(el('div.nb-str.nb-stred', {},
          el('div.nb-chyba-ic', {}, icon('info')),
          el('h2', { text: 'Taková stránka tu není' }),
          el('p.nb-nic', {}, el('code', { text: t.url })),
          el('div.nb-chipy', { style: { justifyContent: 'center', marginTop: '18px' } },
            el('button.nb-chip', { text: 'Domů', onclick: () => jdi(DOMU) })),
        ));
      } else {
        t.titulek = typeof def.titulek === 'function' ? def.titulek(arg) : def.titulek;
        t.ikona = def.ikona;
        const ctx = { jdi, novyTab, signal: ac.signal, soukrome };
        try {
          obsah.append(def.vykresli(ctx, arg));
        } catch (e) {
          obsah.append(el('div.nb-str', {}, el('p.nb-nic', { text: 'Stránku se nepovedlo vykreslit: ' + e.message })));
        }
        zapisHistorii(t.url, t.titulek);
      }
      obsah.scrollTop = 0;
    }

    // ---------- start ----------
    novyTab(normalizuj(win.opts?.url || DOMU));   // adresa zvenčí (Jirka, odkaz) může být holé „youtube.com“
    // Zkratky jako v Chromu. Chodí jen z aplikace (electron.js) — v prohlížeči by je sebral prohlížeč.
    const offZkratky = bus.on('zkratka', (k) => {
      if (getFocused() !== win || win.minimized) return;
      if (k === 'ctrl+t') novyTab();
      else if (k === 'ctrl+w') { if (st.taby.length > 1) zavriTab(st.i); else win.close(); }
      else if (k === 'ctrl+l') { adresa.focus(); adresa.select(); }
      else if (k === 'ctrl+tab' || k === 'ctrl+shift+tab') {
        st.i = (st.i + (k === 'ctrl+tab' ? 1 : -1) + st.taby.length) % st.taby.length;
        vykresli();
      } else if (k === 'ctrl+r' || k === 'f5') vykresli(true);
      else if (k === 'ctrl+shift+n') import('../wm.js').then(({ openWindow }) => openWindow(browserApp, { soukrome: true }));
    });
    win.onClose = () => {
      offZkratky();
      offHesla();
      window.removeEventListener('message', zpravaZeStranky);
      window.removeEventListener('blur', priBlur);
      hlidejDisk();
      st.taby.forEach((t) => { t.signal?.abort?.(); odpojSoubor(t); t.frame?.remove(); zrusKartu(t); });
      if (idRelace) Nativni.zahodRelaci(idRelace);   // cookies, přihlášení a cache soukromého okna pryč
    };
    win.jdiNa = (url) => { novyTab(normalizuj(String(url))); };
  },

  unmount(win) { win.onClose?.(); },
  reopen(win, opts) { if (opts?.url) win.jdiNa?.(opts.url); },
};
