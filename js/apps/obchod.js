// AstroOS — Obchod
//
// Objevovat: dvacet aplikací z katalogu (js/obchod/), které se „stáhnou“ a objeví
// ve Startu a na ploše. Systémové aplikace obchod jen ukazuje a otevírá.
// Kromě toho se instalují balíčky: nasypou soubory na virtuální disk
// (ukázkové projekty do Editoru, tapety do Fotek, šablony do Dokumentů).
// Seznam nainstalovaných balíčků drží nastavení, aby šly zase odinstalovat.

import { el, bus, cz } from '../util.js';
import { icon, glyfAplikace } from '../icons.js';
import * as FS from '../fs.js';
import { State } from '../state.js';
import { toast } from '../ui.js';
import { APPS, appList, openApp } from '../apps.js';
import { zaznamy, zaznamPro, nactiManifest, nainstaluj, odinstaluj } from '../aplikace.js';
import { UKAZKOVE, zapisUkazku } from '../ukazkoveAplikace.js';
import { KATALOG, SEKCE, PODLE_ID } from '../obchod/katalog.js';
import { jeNainstalovana, nainstalujAplikaci, odinstalujAplikaci } from '../obchod/sprava.js';
import { cislo } from '../obchod/spolecne.js';
import { online } from '../sit.js';
import { vydane, proObchod, hra as studioHra } from '../studio/data.js';

// hry vydané v Astro Studiu (js/studio/) — v Obchodě vedle katalogu, s živými čísly ze simulace
const komunitni = () => vydane().map(proObchod);
const polozka = (id) => PODLE_ID[id] || (String(id).startsWith('st-') ? komunitni().find((a) => a.id === id) : null);
const mamPolozku = (a) => (a.komunita ? !!zaznamPro(a.slozka) : jeNainstalovana(a.id));
function otevriPolozku(a) {
  if (!a.komunita) return openApp(a.id);
  const z = zaznamPro(a.slozka);
  if (z) openApp(z.id);
}
function nainstalujKomunitni(a) {
  const h = studioHra(a.hraId);
  const m = nactiManifest(a.slozka);
  nainstaluj(a.slozka, { ...m, nazev: a.name, popis: a.kratce, ikona: h?.ikona || m.ikona, barva: h?.barva || m.barva, kategorie: 'media' });
}

const KLIC = 'obchodBalicky';

const nainstalovane = () => State.get(KLIC) || [];
const jeNainstalovan = (id) => nainstalovane().includes(id);

function zapis(id, ano) {
  const nyni = nainstalovane().filter((x) => x !== id);
  State.set(KLIC, ano ? [...nyni, id] : nyni);
}

// ---------------------------------------------------------------- obsah balíčků
const PROJEKT_HODINY = {
  'index.html': `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="utf-8">
  <title>Hodiny</title>
  <link rel="stylesheet" href="styl.css">
</head>
<body>
  <div class="hodiny">
    <div id="cas">--:--:--</div>
    <div id="datum"></div>
  </div>
  <script src="skript.js"><\/script>
</body>
</html>
`,
  'styl.css': `body {
  margin: 0;
  height: 100vh;
  display: grid;
  place-items: center;
  font-family: system-ui, sans-serif;
  background: radial-gradient(circle at 50% 30%, #1d2b3a, #0a0f12);
  color: #eef3f5;
}

#cas {
  font-size: 68px;
  font-weight: 200;
  letter-spacing: 2px;
  font-variant-numeric: tabular-nums;
}

#datum {
  text-align: center;
  margin-top: 6px;
  color: #46c36f;
}
`,
  'skript.js': `const dny = ['neděle', 'pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota'];

function tik() {
  const ted = new Date();
  const dva = (n) => String(n).padStart(2, '0');

  document.getElementById('cas').textContent =
    dva(ted.getHours()) + ':' + dva(ted.getMinutes()) + ':' + dva(ted.getSeconds());

  document.getElementById('datum').textContent =
    dny[ted.getDay()] + ' ' + ted.getDate() + '. ' + (ted.getMonth() + 1) + '.';
}

tik();
setInterval(tik, 1000);
`,
};

const PROJEKT_BARVY = {
  'index.html': `<!DOCTYPE html>
<html lang="cs">
<head>
  <meta charset="utf-8">
  <title>Míchačka barev</title>
  <link rel="stylesheet" href="styl.css">
</head>
<body>
  <h1>Míchačka barev</h1>
  <div id="vzorek"></div>
  <p id="kod">#000000</p>

  <label>Červená <input type="range" id="r" min="0" max="255" value="70"></label>
  <label>Zelená <input type="range" id="g" min="0" max="255" value="195"></label>
  <label>Modrá <input type="range" id="b" min="0" max="255" value="111"></label>

  <script src="skript.js"><\/script>
</body>
</html>
`,
  'styl.css': `body {
  font-family: system-ui, sans-serif;
  background: #12181d;
  color: #eef3f5;
  display: grid;
  justify-items: center;
  gap: 12px;
  padding: 24px;
}

h1 { font-size: 20px; font-weight: 600; }

#vzorek {
  width: 200px;
  height: 120px;
  border-radius: 14px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, .45);
}

#kod { font-family: monospace; letter-spacing: 1px; }

label { display: flex; align-items: center; gap: 10px; font-size: 13px; }
`,
  'skript.js': `const posuvniky = ['r', 'g', 'b'].map((id) => document.getElementById(id));
const vzorek = document.getElementById('vzorek');
const kod = document.getElementById('kod');

function prekresli() {
  const [r, g, b] = posuvniky.map((p) => Number(p.value));
  const hex = '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('');
  vzorek.style.background = hex;
  kod.textContent = hex;
}

posuvniky.forEach((p) => p.addEventListener('input', prekresli));
prekresli();
`,
};

const TAPETY = {
  'mlhovina.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000">
  <defs>
    <radialGradient id="a" cx="30%" cy="30%"><stop offset="0" stop-color="#7a4fd0"/><stop offset="1" stop-color="#0a0a18"/></radialGradient>
    <radialGradient id="b" cx="70%" cy="70%"><stop offset="0" stop-color="#2f8fd0" stop-opacity=".8"/><stop offset="1" stop-color="#0a0a18" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1600" height="1000" fill="url(#a)"/>
  <rect width="1600" height="1000" fill="url(#b)"/>
  <g fill="#ffffff">
    ${Array.from({ length: 90 }, (_, i) => {
    const x = (i * 197) % 1600, y = (i * 349) % 1000, r = (i % 3) * 0.6 + 0.8;
    return `<circle cx="${x}" cy="${y}" r="${r}" opacity="${0.3 + (i % 5) / 8}"/>`;
  }).join('')}
  </g></svg>`,

  'duny.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000">
  <defs><linearGradient id="n" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0b95c"/><stop offset="1" stop-color="#8a3d2e"/></linearGradient></defs>
  <rect width="1600" height="1000" fill="url(#n)"/>
  <circle cx="1180" cy="240" r="110" fill="#fff3d0" fill-opacity=".9"/>
  <path d="M0 620 C 300 540 500 700 800 640 S 1300 540 1600 620 L1600 1000 L0 1000Z" fill="#7a3327"/>
  <path d="M0 760 C 380 690 620 830 900 770 S 1350 700 1600 770 L1600 1000 L0 1000Z" fill="#54211c"/>
  <path d="M0 890 C 420 840 700 940 1000 900 S 1400 850 1600 890 L1600 1000 L0 1000Z" fill="#331310"/></svg>`,

  'les.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000">
  <defs><linearGradient id="l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#173b3a"/><stop offset="1" stop-color="#0a1614"/></linearGradient></defs>
  <rect width="1600" height="1000" fill="url(#l)"/>
  <g>
    ${Array.from({ length: 26 }, (_, i) => {
    const x = 40 + i * 62, h = 260 + ((i * 137) % 220), o = 0.25 + ((i % 4) / 9);
    return `<path d="M${x} ${1000} L${x - 46} ${1000 - h * 0.55} L${x - 24} ${1000 - h * 0.55} L${x - 60} ${1000 - h} L${x + 60} ${1000 - h} L${x + 24} ${1000 - h * 0.55} L${x + 46} ${1000 - h * 0.55}Z" fill="#46c36f" fill-opacity="${o}"/>`;
  }).join('')}
  </g></svg>`,
};

const SABLONY = {
  'úkoly.md': '# Úkoly\n\n## Dnes\n- [ ] \n- [ ] \n\n## Tento týden\n- [ ] \n\n## Hotovo\n- [x] stáhnout šablony z Obchodu\n',
  'deník.md': '# Deník\n\n## Datum\n\n**Co se povedlo:**\n\n**Co mě zdrželo:**\n\n**Zítra chci:**\n',
  'recept.txt': 'Název receptu\n=============\n\nSuroviny\n- \n- \n\nPostup\n1. \n2. \n\nPoznámky:\n',
};

// ---------------------------------------------------------------- katalog balíčků
const BALICKY = [
  {
    id: 'projekty-ukazky', name: 'Ukázkové projekty', autor: 'AstroOS', ikona: 'code',
    barva: '#54d98a', velikost: '6 kB', kategorie: 'Pro Editor kódu',
    popis: 'Dvě malé hotové stránky, na kterých se dá učit: digitální hodiny a míchačka barev. '
      + 'Otevřou se rovnou v Editoru, můžeš je rozebrat a přepsat.',
    slozky: [FS.HOME + '/projekty/hodiny', FS.HOME + '/projekty/barvy'],
    instaluj() {
      zapisSoubory(FS.HOME + '/projekty/hodiny', PROJEKT_HODINY);
      zapisSoubory(FS.HOME + '/projekty/barvy', PROJEKT_BARVY);
    },
    otevri: () => openApp('editor', { path: FS.HOME + '/projekty/hodiny/index.html' }),
  },
  {
    id: 'tapety-nova', name: 'Balíček tapet Nova', autor: 'AstroOS', ikona: 'image',
    barva: '#a077f0', velikost: '9 kB', kategorie: 'Vzhled',
    popis: 'Tři tapety navíc — mlhovina, duny a les. Objeví se ve Fotkách, kde je pravým '
      + 'tlačítkem nastavíš jako pozadí plochy.',
    slozky: [FS.HOME + '/Obrázky/tapety'],
    instaluj() { zapisSoubory(FS.HOME + '/Obrázky/tapety', TAPETY); },
    odinstaluj() { smazSoubory(FS.HOME + '/Obrázky/tapety', Object.keys(TAPETY)); },
    otevri: () => openApp('photos', { path: FS.HOME + '/Obrázky/tapety' }),
  },
  {
    id: 'sablony', name: 'Šablony dokumentů', autor: 'AstroOS', ikona: 'fileText',
    barva: '#f0b95c', velikost: '1 kB', kategorie: 'Kancelář',
    popis: 'Připravené soubory do Dokumentů: seznam úkolů, deník a recept. Otevírají se '
      + 'v Poznámkách, takže je stačí přepsat.',
    slozky: [FS.HOME + '/Dokumenty/šablony'],
    instaluj() { zapisSoubory(FS.HOME + '/Dokumenty/šablony', SABLONY); },
    otevri: () => openApp('files', { path: FS.HOME + '/Dokumenty/šablony' }),
  },
];

function zapisSoubory(slozka, soubory) {
  if (!FS.exists(slozka)) FS.mkdir(slozka, { parents: true });
  for (const [jmeno, obsah] of Object.entries(soubory)) FS.write(`${slozka}/${jmeno}`, obsah);
}

function smazSoubory(slozka, jmena) {
  for (const j of jmena) {
    try { FS.remove(`${slozka}/${j}`); } catch { /* už tam není */ }
  }
}

/** Výchozí odinstalace: celá složka balíčku do koše. */
function odinstalujBalicek(b) {
  if (b.odinstaluj) return b.odinstaluj();
  for (const s of b.slozky) {
    try { FS.remove(s); } catch { /* už tam není */ }
  }
}

// ---------------------------------------------------------------- aplikace z katalogu
const tisice = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace('.', ',')} mil.` : n >= 10000 ? `${Math.round(n / 1000)} tis.` : cislo(n));
const hvezdicky = (h) => '★★★★★'.slice(0, Math.round(h)) + '☆☆☆☆☆'.slice(0, 5 - Math.round(h));
const mojeHodnoceni = () => State.get('oaHodnoceni') || {};

/** Rozložení hodnocení 5→1 hvězdička, aby sedělo k průměru (vymyšlené, jen pro graf). */
function rozlozeni(h) {
  const p = [0.62 + (h - 4.5) * 1.1, 0.2, 0.08 + (4.6 - h) * 0.08, 0.04, 0.05 + (4.6 - h) * 0.05].map((x) => Math.max(0.01, x));
  const s = p.reduce((a, b) => a + b, 0);
  return p.map((x) => x / s);
}

/** Aplikace dne — každý den jiná. */
function aplikaceDne() {
  const d = new Date();
  const den = Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86400e3);
  return KATALOG[(den * 7) % KATALOG.length];
}

const glyf = (a, trida = '') => glyfAplikace(a, 'div.ob-glyf' + trida);

export const obchodApp = {
  id: 'store', name: 'Obchod', icon: 'store', color: 'linear-gradient(145deg,#f0b95c,#c47f26)',
  cat: 'net', width: 1000, height: 700,

  mount(body, win) {
    const st = { zalozka: win.opts?.zalozka || 'objevovat', detail: win.opts?.detail || null, hledat: '' };
    const stahovani = new Map(); // id → procenta; běžící stahování přežije překreslení

    const obsah = el('div.ob-obsah');
    const hledani = el('input.ob-hledat', { type: 'search', placeholder: 'Hledat aplikace' });
    hledani.oninput = () => { st.hledat = hledani.value.trim(); st.detail = null; kresli(); };

    const zalozky = [
      ['objevovat', 'Objevovat'],
      ['knihovna', 'Knihovna'],
      ['vlastni', 'Pro vývojáře'],
      ['balicky', 'Balíčky'],
      ['aplikace', 'V systému'],
    ].map(([id, jmeno]) => {
      const b = el('button.ob-zalozka' + (id === st.zalozka ? '.on' : ''), { text: jmeno, dataset: { z: id } });
      b.onclick = () => prepniZalozku(id);
      return b;
    });

    function prepniZalozku(id) {
      st.zalozka = id; st.detail = null; st.hledat = ''; hledani.value = '';
      kresli();
      obsah.scrollTop = 0;
    }

    function kresli() {
      for (const z of zalozky) z.classList.toggle('on', z.dataset.z === st.zalozka && !st.hledat);
      const posun = obsah.scrollTop;
      let uzel;
      if (st.detail && !polozka(st.detail)) st.detail = null;   // hra mezitím zmizela z Obchodu
      if (st.detail) uzel = kresliDetail(polozka(st.detail));
      else if (st.hledat) uzel = kresliHledani();
      else uzel = ({ objevovat: kresliObjevovat, knihovna: kresliKnihovnu, balicky: kresliBalicky, vlastni: kresliVlastni }[st.zalozka] || kresliAplikace)();
      obsah.replaceChildren(uzel);
      obsah.scrollTop = posun;
    }
    const odhlasAplikace = bus.on('aplikace', () => kresli());
    // čísla her z Astro Studia rostou živě — překreslit, ale ne uprostřed psaní recenze
    let cekaStudio = 0;
    const odhlasStudio = bus.on('studio', () => {
      if (cekaStudio) return;
      cekaStudio = setTimeout(() => {
        cekaStudio = 0;
        const a = document.activeElement;
        if (a && obsah.contains(a) && /^(INPUT|TEXTAREA)$/.test(a.tagName)) return;
        if ((st.zalozka === 'objevovat' && !st.detail && !st.hledat) || String(st.detail).startsWith('st-')) kresli();
      }, 2000);
    });
    const odhlas = () => { odhlasAplikace(); odhlasStudio(); clearTimeout(cekaStudio); };

    function otevriDetail(id) {
      st.detail = id;
      kresli();
      obsah.scrollTop = 0;
    }

    // ---------- tlačítko Získat / průběh / Otevřít ----------
    function akcniTlacitko(a, velke = false) {
      const trida = velke ? '.ob-btn.velke' : '.ob-btn.male';
      if (stahovani.has(a.id)) {
        const pct = stahovani.get(a.id);
        return el('div.ob-prubeh' + (velke ? '.velke' : ''), {},
          el('div.ob-prubeh-vypln', { style: { width: pct + '%' } }),
          el('span', { text: pct >= 100 ? 'Instaluji…' : `${Math.round(pct)} %` }));
      }
      if (mamPolozku(a)) {
        return el('button' + trida, { text: 'Otevřít', onclick: (e) => { e.stopPropagation(); otevriPolozku(a); } });
      }
      return el('button' + trida + '.primary', { text: 'Získat', onclick: (e) => { e.stopPropagation(); stahni(a); } });
    }
    const obalAkce = (a, velke) => el('div.ob-akce-obal', { dataset: { prubeh: a.id } }, akcniTlacitko(a, velke));

    function stahni(a) {
      if (!online()) {
        toast({ title: 'Nejsi připojený k internetu', body: 'Obchod potřebuje síť. Zapni Wi-Fi v rychlém nastavení.', icon: 'wifiOff', timeout: 6000 });
        return;
      }
      const kB = parseFloat(a.velikost) || 50;
      const rychlost = 90 + Math.random() * 260; // kB/s
      const celkem = Math.max(900, (kB / rychlost) * 1000);
      const zacatek = performance.now();
      stahovani.set(a.id, 0);
      kresli();
      const krok = () => {
        if (!stahovani.has(a.id)) return;
        const pct = Math.min(100, ((performance.now() - zacatek) / celkem) * 100);
        stahovani.set(a.id, pct);
        // průběh překreslujeme na místě, ať se stránka necuká
        for (const v of obsah.querySelectorAll(`[data-prubeh="${a.id}"] .ob-prubeh`)) {
          v.firstChild.style.width = pct + '%';
          v.lastChild.textContent = pct >= 100 ? 'Instaluji…' : `${Math.round(pct)} %`;
        }
        if (pct < 100) { setTimeout(krok, 80); return; }
        setTimeout(() => {
          if (!stahovani.delete(a.id)) return;
          if (a.komunita) {
            try { nainstalujKomunitni(a); } catch (err) {
              toast({ title: 'Instalace selhala', body: err.message, icon: 'info', timeout: 6000 });
              kresli();
              return;
            }
          } else nainstalujAplikaci(a.id);
          toast({ title: `${a.name} je nainstalovaná`, body: 'Najdeš ji ve Startu i na ploše. Klikni a spusť ji.', icon: a.icon, onClick: () => otevriPolozku(a) });
          kresli();
        }, 700);
      };
      setTimeout(krok, 80);
    }

    // ---------- karta aplikace ----------
    function dlazdice(a) {
      const k = el('div.ob-dlazdice', { tabindex: 0 },
        glyf(a),
        el('div.ob-dl-text', {},
          el('b', { text: a.name }),
          el('span.ob-dl-kratce', { text: a.kratce }),
          a.hodnoceniPocet
            ? el('span.ob-dl-hodnoceni', {}, el('span.ob-hv', { text: '★' }), ` ${a.hodnoceni.toFixed(1).replace('.', ',')} · ${tisice(a.stazeni)}`)
            : el('span.ob-dl-hodnoceni', { text: `Nové · ${tisice(a.stazeni)} stažení` })),
        obalAkce(a));
      k.onclick = () => otevriDetail(a.id);
      k.onkeydown = (e) => { if (e.key === 'Enter') otevriDetail(a.id); };
      return k;
    }

    // ---------- Objevovat ----------
    function kresliObjevovat() {
      const dne = aplikaceDne();
      const hero = el('div.ob-hero', { style: { background: dne.color } },
        el('div.ob-hero-text', {},
          el('div.ob-hero-stitek', { text: 'Aplikace dne' }),
          el('h2', { text: dne.name }),
          el('p', { text: dne.kratce }),
          el('div.ob-hero-akce', {}, obalAkce(dne, true), el('button.ob-btn.svetle', { text: 'Více', onclick: () => otevriDetail(dne.id) }))),
        el('div.ob-hero-ikona', {}, icon(dne.icon)));

      const nezavisle = komunitni();
      const vyberRedakce = nezavisle.find((a) => a.vyberRedakce);
      if (vyberRedakce) {
        // hra z Astro Studia ve Výběru redakce dostane hlavní místo místo aplikace dne
        hero.style.background = vyberRedakce.color;
        hero.replaceChildren(
          el('div.ob-hero-text', {},
            el('div.ob-hero-stitek', { text: '⭐ Výběr redakce' }),
            el('h2', { text: vyberRedakce.name }),
            el('p', { text: vyberRedakce.kratce }),
            el('div.ob-hero-akce', {}, obalAkce(vyberRedakce, true), el('button.ob-btn.svetle', { text: 'Více', onclick: () => otevriDetail(vyberRedakce.id) }))),
          el('div.ob-hero-ikona', {}, icon(vyberRedakce.icon)));
      }
      const top = [...KATALOG, ...nezavisle].sort((a, b) => b.stazeni - a.stazeni).slice(0, 5);
      const zebricek = el('div.ob-zebricek', {}, ...top.map((a, i) => {
        const r = el('div.ob-zeb-radek', {},
          el('span.ob-zeb-poradi', { text: String(i + 1) }),
          glyf(a, '.male'),
          el('div.ob-dl-text', {}, el('b', { text: a.name }), el('span.ob-dl-kratce', { text: a.autor })),
          obalAkce(a));
        r.onclick = () => otevriDetail(a.id);
        return r;
      }));

      const pocet = KATALOG.filter((a) => jeNainstalovana(a.id)).length;
      return el('div.ob-objevovat', {},
        hero,
        el('div.ob-dva', {},
          el('div', {}, el('h2.ob-nadpis', { text: 'Nejstahovanější' }), zebricek),
          el('div.ob-souhrn', {},
            el('div.ob-souhrn-cislo', { text: `${pocet} / ${KATALOG.length}` }),
            el('div', { text: pocet === KATALOG.length ? 'Máš úplně všechno! Sběratel roku 🏆' : pocet ? 'aplikací máš staženo. Co zkusíš dál?' : 'Zatím nemáš nic staženého. Vyber si cokoli, všechno je zdarma.' }),
            pocet ? el('button.ob-btn', { text: 'Moje knihovna', onclick: () => prepniZalozku('knihovna') }) : null)),
        nezavisle.length ? el('section.ob-sekce', {},
          el('div.ob-sekce-hlava', {}, el('h2.ob-nadpis', { text: 'Trendy od nezávislých' }), el('span', { text: 'Co se teď nejvíc hraje' })),
          el('div.ob-dlazdice-mrizka', {}, ...[...nezavisle].sort((a, b) => b.vcera - a.vcera).slice(0, 6).map(dlazdice))) : null,
        nezavisle.length ? el('section.ob-sekce', {},
          el('div.ob-sekce-hlava', {}, el('h2.ob-nadpis', { text: 'Nově vydané' }), el('span', { text: 'Čerstvé hry od nezávislých studií' })),
          // tvoje hry tu jsou vždycky, ať je máš po ruce
          el('div.ob-dlazdice-mrizka', {}, ...[...nezavisle].sort((a, b) => (a.rival - b.rival) || (b.vydano - a.vydano))
            .filter((a, i) => !a.rival || i < 6).map(dlazdice))) : null,
        ...SEKCE.map((s) => el('section.ob-sekce', {},
          el('div.ob-sekce-hlava', {}, el('h2.ob-nadpis', { text: s.nazev }), el('span', { text: s.popis })),
          el('div.ob-dlazdice-mrizka', {}, ...KATALOG.filter((a) => a.sekce === s.id).map(dlazdice)))));
    }

    // ---------- Hledání ----------
    function kresliHledani() {
      const bez = (t) => t.toLocaleLowerCase('cs').normalize('NFD').replace(/[̀-ͯ]/g, '');
      const q = bez(st.hledat);
      const nalez = [...KATALOG, ...komunitni()].filter((a) => bez(`${a.name} ${a.kratce} ${a.autor} ${a.popis}`).includes(q));
      return el('div', {},
        el('h2.ob-nadpis', { text: nalez.length ? `Výsledky pro „${st.hledat}“` : `Pro „${st.hledat}“ jsme nic nenašli` }),
        nalez.length ? el('div.ob-dlazdice-mrizka', {}, ...nalez.map(dlazdice)) : el('p.ob-poznamka', { text: 'Zkus jiné slovo, třeba „hra“, „hudba“ nebo „vesmír“.' }));
    }

    // ---------- Knihovna ----------
    function kresliKnihovnu() {
      const moje = KATALOG.filter((a) => jeNainstalovana(a.id));
      const kdy = State.get('oaInstalovano') || {};
      if (!moje.length) {
        return el('div.ob-prazdno', {},
          el('div.ob-prazdno-ic', {}, icon('store')),
          el('h2', { text: 'Knihovna je prázdná' }),
          el('p', { text: 'Aplikace, které si stáhneš, se objeví tady.' }),
          el('button.ob-btn.primary', { text: 'Jít objevovat', onclick: () => prepniZalozku('objevovat') }));
      }
      return el('div', {},
        el('div.ob-knihovna-hlava', {},
          el('h2.ob-nadpis', { text: `Moje aplikace (${moje.length})` }),
          el('span.ob-aktualni', {}, icon('check'), el('span', { text: 'Všechno je aktuální' }))),
        el('div.ob-seznam', {}, ...moje.map((a) => el('div.ob-radek', {},
          glyf(a, '.male'),
          el('div.ob-nazvy', {},
            el('h3', { text: a.name }),
            el('div.ob-autor', { text: `${a.autor} · ${a.velikost}${kdy[a.id] ? ' · staženo ' + cz.datumKratky(new Date(kdy[a.id])) : ''}` })),
          el('button.ob-btn', { text: 'Otevřít', onclick: () => openApp(a.id) }),
          el('button.ob-btn.tich', { text: 'Podrobnosti', onclick: () => otevriDetail(a.id) }),
          el('button.ob-btn.tich', { text: 'Odinstalovat', onclick: () => odinstalovat(a) })))));
    }

    function odinstalovat(a) {
      odinstalujAplikaci(a.id);
      toast({ title: 'Odinstalováno', body: `${a.name} je pryč. Skóre a postup zůstaly uložené, kdyby ses k ní vrátil.`, icon: 'trash' });
      kresli();
    }

    // ---------- Detail ----------
    function kresliDetail(a) {
      const vlastniHra = a.komunita && !a.rival;   // svoji hru hodnotit nejde, hry konkurence ano
      const moje = vlastniHra ? null : mojeHodnoceni()[a.id];
      const pocet = a.hodnoceniPocet + (moje ? 1 : 0);
      const prumer = moje ? (a.hodnoceni * a.hodnoceniPocet + moje.h) / pocet : a.hodnoceni;
      const prumerText = pocet ? prumer.toFixed(1).replace('.', ',') : '–';
      // u her ze Studia skutečné rozložení hvězdiček ze simulace (5 → 1)
      const pruhy = a.hvezdy ? [...a.hvezdy].reverse().map((c) => (pocet ? c / pocet : 0)) : rozlozeni(a.hodnoceni);

      const hvezdyVolba = el('div.ob-volba', {}, ...[1, 2, 3, 4, 5].map((n) => {
        const b = el('button.ob-volba-h' + (moje && n <= moje.h ? '.on' : ''), { text: '★', title: `${n} z 5` });
        b.onmouseenter = () => hvezdyVolba.querySelectorAll('button').forEach((x, i) => x.classList.toggle('nad', i < n));
        b.onmouseleave = () => hvezdyVolba.querySelectorAll('button').forEach((x) => x.classList.remove('nad'));
        b.onclick = () => {
          if (!mamPolozku(a) && !moje) { toast({ title: 'Nejdřív vyzkoušej', body: 'Hodnotit můžeš aplikace, které máš stažené.', icon: 'star' }); return; }
          State.set('oaHodnoceni', { ...mojeHodnoceni(), [a.id]: { h: n, text: mojeHodnoceni()[a.id]?.text || '' } });
          kresli();
        };
        return b;
      }));
      const textRecenze = el('textarea.ob-recenze-pole', { placeholder: 'Napiš pár slov o aplikaci (nepovinné)', maxlength: 240 });
      textRecenze.value = moje?.text || '';
      textRecenze.onchange = () => {
        if (!mojeHodnoceni()[a.id]) return;
        State.set('oaHodnoceni', { ...mojeHodnoceni(), [a.id]: { ...mojeHodnoceni()[a.id], text: textRecenze.value.trim() } });
        toast({ title: 'Díky za recenzi!', body: 'Vývojáři z ní budou mít radost.', icon: 'heart', silent: true });
        kresli();
      };

      const recenze = [
        ...(moje ? [[`${State.get('user')?.name || 'Ty'} (ty)`, moje.h, moje.text || 'Bez komentáře.', true]] : []),
        ...a.recenze,
      ];
      const souvisejici = KATALOG.filter((x) => x.sekce === a.sekce && x.id !== a.id).slice(0, 4);

      return el('div.ob-detail', {},
        el('button.ob-zpet', { onclick: () => { st.detail = null; kresli(); } }, icon('chevronLeft'), el('span', { text: 'Zpět' })),
        el('div.ob-detail-hlava', {},
          glyf(a, '.velky'),
          el('div.ob-detail-nazev', {},
            el('h1', { text: a.name }),
            el('div.ob-detail-autor', { text: a.autor }),
            el('div.ob-detail-akce', {}, obalAkce(a, true),
              !a.komunita && jeNainstalovana(a.id) ? el('button.ob-btn.tich', { text: 'Odinstalovat', onclick: () => odinstalovat(a) }) : null,
              a.komunita ? el('button.ob-btn.tich', { text: 'Profil studia', onclick: () => openApp('studio', a.rival ? { stranka: 'konkurence', studio: a.studioId } : { stranka: 'profil' }) }) : null))),
        el('div.ob-statistiky', {},
          el('div', {}, el('b', {}, `${prumerText} `, el('span.ob-hv', { text: '★' })), el('small', { text: `${cislo(pocet)} hodnocení` })),
          a.komunita ? el('div', {}, el('b', { text: tisice(a.zhlednuti) }), el('small', { text: 'zhlédnutí' })) : null,
          el('div', {}, el('b', { text: tisice(a.stazeni) }), el('small', { text: 'stažení' })),
          el('div', {}, el('b', { text: a.velikost }), el('small', { text: 'velikost' })),
          el('div', {}, el('b', { text: a.vek }), el('small', { text: 'věk' })),
          el('div', {}, el('b', { text: 'Zdarma' }), el('small', { text: 'bez reklam' }))),
        el('section.ob-blok', {}, el('h2.ob-nadpis', { text: 'Popis' }), el('p.ob-detail-popis', { text: a.popis })),
        el('section.ob-blok', {}, el('h2.ob-nadpis', { text: 'Co je nového' }), el('p.ob-detail-popis', { text: a.novinky })),
        el('section.ob-blok', {},
          el('h2.ob-nadpis', { text: 'Hodnocení a recenze' }),
          el('div.ob-hodnoceni', {},
            el('div.ob-hodnoceni-velke', {},
              el('div.ob-hodnoceni-cislo', { text: prumerText }),
              el('div.ob-hv', { text: pocet ? hvezdicky(prumer) : '☆☆☆☆☆' }),
              el('small', { text: `${cislo(pocet)} hodnocení` })),
            el('div.ob-pruhy', {}, ...pruhy.map((p, i) => el('div.ob-pruh-radek', {},
              el('span', { text: String(5 - i) }), el('div.ob-pruh', {}, el('div', { style: { width: (p * 100).toFixed(1) + '%' } }))))),
            vlastniHra
              ? el('div.ob-moje', {},
                el('b', { text: 'Tvoje hra' }),
                el('small', { text: 'Vlastní hru hodnotit nemůžeš 😉 Na recenze hráčů odpovídáš v Astro Studiu.' }),
                el('button.ob-btn', { text: 'Otevřít Astro Studio', onclick: () => openApp('studio', { hra: a.hraId, zalozka: 'recenze' }) }))
              : el('div.ob-moje', {},
                el('b', { text: moje ? 'Tvoje hodnocení' : 'Ohodnoť aplikaci' }),
                hvezdyVolba,
                moje ? textRecenze : el('small', { text: mamPolozku(a) ? 'Klikni na hvězdičky.' : 'Nejdřív si ji stáhni a vyzkoušej.' }))),
          a.komunita && !recenze.length ? el('p.ob-poznamka', { text: 'Zatím žádné recenze. Hra je nová — první hráči ji teprve objevují.' }) : null,
          el('div.ob-recenze', {}, ...recenze.map(([kdo, h, text, ja, odpoved, reakce]) => el('div.ob-recenze-karta' + (ja ? '.moje' : ''), {},
            el('div.ob-recenze-hlava', {}, el('span.ob-avatar', { text: kdo[0].toUpperCase() }), el('b', { text: kdo }), el('span.ob-hv', { text: hvezdicky(h) })),
            el('p', { text }),
            odpoved ? el('div.ob-odpoved-vyvojare', {}, el('b', { text: `Odpověď vývojáře (${a.autor})` }), el('p', { text: odpoved })) : null,
            reakce ? el('div.ob-odpoved-vyvojare.reakce', {}, el('b', { text: kdo }), el('p', { text: reakce })) : null)))),
        souvisejici.length ? el('section.ob-blok', {},
          el('h2.ob-nadpis', { text: 'Mohlo by se ti líbit' }),
          el('div.ob-dlazdice-mrizka', {}, ...souvisejici.map(dlazdice))) : null,
      );
    }

    // ---------- aplikace psané pro AstroOS (složka s index.html + app.json) ----------
    function kresliVlastni() {
      const ukazkoveSlozky = UKAZKOVE.map((u) => u.slozka);
      const moje = zaznamy().filter((z) => !ukazkoveSlozky.includes(z.slozka));

      const karta = (m, akce, znacka) => el('div.ob-karta', { style: { '--barva': m.barva } },
        el('div.ob-hlava', {},
          el('div.ob-ikona', {}, icon(m.ikona)),
          el('div.ob-nazvy', {}, el('h3', { text: m.nazev }), el('div.ob-autor', { text: m.autor })),
          znacka ? el('span.ob-znacka', {}, icon('check'), el('span', { text: 'Nainstalováno' })) : null,
        ),
        el('p.ob-popis', { text: m.popis }),
        el('div.ob-akce', {}, ...akce),
      );

      const ukazky = UKAZKOVE.map((u) => {
        const m = { ...u.soubory['app.json'], autor: 'AstroOS · ukázka s kódem' };
        const z = zaznamPro(u.slozka);
        if (!z) {
          const b = el('button.ob-btn.primary', { text: 'Získat' });
          b.onclick = () => {
            b.disabled = true;
            b.textContent = 'Instaluji…';
            setTimeout(() => {
              try {
                zapisUkazku(u);
                const { zaznam } = nainstaluj(u.slozka, nactiManifest(u.slozka));
                toast({ title: 'Nainstalováno', body: `${m.nazev} je ve Startu i na ploše.`, icon: 'check' });
                openApp(zaznam.id);
              } catch (err) {
                toast({ title: 'Instalace selhala', body: err.message, icon: 'info', timeout: 6000 });
              }
              kresli();
            }, 500);
          };
          return karta(m, [b]);
        }
        return karta(m, [
          el('button.ob-btn', { text: 'Otevřít', onclick: () => openApp(z.id) }),
          el('button.ob-btn.tich', { text: 'Zdrojový kód', onclick: () => openApp('editor', { path: u.slozka + '/app.js' }) }),
          el('button.ob-btn.tich', {
            text: 'Odinstalovat',
            onclick: () => {
              odinstaluj(z.id);
              try { FS.remove(u.slozka); } catch { /* už tam není */ }
              kresli();
            },
          }),
        ], true);
      });

      const mojeKarty = moje.map((z) => karta({ ...z, popis: z.slozka.replace(FS.HOME, '~'), autor: 'Tvoje aplikace' }, [
        el('button.ob-btn', { text: 'Otevřít', onclick: () => openApp(z.id) }),
        el('button.ob-btn.tich', { text: 'Upravit', onclick: () => openApp('editor', { path: z.slozka + '/index.html' }) }),
        el('button.ob-btn.tich', { text: 'Odinstalovat', onclick: () => { odinstaluj(z.id); kresli(); } }),
      ], true));

      return el('div', {},
        el('div.ob-vyzva', {},
          el('div.ob-vyzva-ic', {}, icon('code')),
          el('div', {},
            el('h3', { text: 'Napiš si vlastní aplikaci' }),
            el('p', { text: 'Stačí HTML, CSS a JavaScript. Přes window.astro umí aplikace ukládat na disk, posílat oznámení a ptát se AstroAI.' })),
          el('div.ob-vyzva-akce', {},
            el('button.ob-btn.primary', { text: 'Nová aplikace', onclick: () => openApp('editor', { novaAplikace: true }) }),
            el('button.ob-btn', { text: 'Příručka', onclick: () => openApp('browser', { url: 'astro://vyvojari' }) })),
        ),
        el('h2.ob-nadpis', { text: 'Ukázkové aplikace' }),
        el('div.ob-mrizka', {}, ukazky),
        mojeKarty.length ? el('h2.ob-nadpis', { text: 'Moje aplikace' }) : null,
        mojeKarty.length ? el('div.ob-mrizka', {}, mojeKarty) : null,
      );
    }

    function kresliBalicky() {
      return el('div.ob-mrizka', {}, BALICKY.map((b) => {
        const mam = jeNainstalovan(b.id);
        const tlacitko = el('button.ob-btn' + (mam ? '' : '.primary'), { text: mam ? 'Otevřít' : 'Získat' });
        const odinstal = el('button.ob-btn.tich' + (mam ? '' : '.hidden'), { text: 'Odinstalovat' });

        tlacitko.onclick = () => {
          if (jeNainstalovan(b.id)) return b.otevri();
          tlacitko.disabled = true;
          tlacitko.textContent = 'Instaluji…';
          setTimeout(() => {
            try {
              b.instaluj();
              zapis(b.id, true);
              toast({ title: 'Nainstalováno', body: b.name, icon: 'check' });
            } catch (err) {
              toast({ title: 'Instalace selhala', body: err.message, icon: 'info', timeout: 6000 });
            }
            tlacitko.disabled = false;
            kresli();
          }, 600);
        };

        odinstal.onclick = () => {
          odinstalujBalicek(b);
          zapis(b.id, false);
          toast({ title: 'Odinstalováno', body: `${b.name} — soubory jsou v koši.`, icon: 'trash' });
          kresli();
        };

        return el('div.ob-karta', { style: { '--barva': b.barva } },
          el('div.ob-hlava', {},
            el('div.ob-ikona', {}, icon(b.ikona)),
            el('div.ob-nazvy', {},
              el('h3', { text: b.name }),
              el('div.ob-autor', { text: `${b.autor} · ${b.kategorie} · ${b.velikost}` }),
            ),
            mam ? el('span.ob-znacka', {}, icon('check'), el('span', { text: 'Nainstalováno' })) : null,
          ),
          el('p.ob-popis', { text: b.popis }),
          el('div.ob-akce', {}, tlacitko, odinstal),
        );
      }));
    }

    function kresliAplikace() {
      const seznam = appList().filter((a) => !a.launch);
      return el('div.ob-seznam', {},
        el('div.ob-poznamka', { text: `Tyhle aplikace jsou součástí systému — je jich ${seznam.length} a instalovat se nemusí.` }),
        ...seznam.map((a) => {
          const r = el('div.ob-radek', {},
            glyfAplikace(a, 'div.ob-glyph'),
            el('div.ob-nazvy', {},
              el('h3', { text: a.name }),
              el('div.ob-autor', { text: APPS[a.id]?.soon ? 'Zatím se staví' : 'Součást AstroOS' }),
            ),
            el('button.ob-btn', { text: 'Otevřít', onclick: () => openApp(a.id) }),
          );
          return r;
        }),
      );
    }

    body.append(el('div.ob', {},
      el('div.ob-bar', {},
        el('div.ob-logo', {}, icon('store'), el('span', { text: 'Obchod AstroOS' })),
        hledani,
        el('div.ob-spacer'),
        ...zalozky,
      ),
      obsah,
    ));
    kresli();
    win.title = 'Obchod';
    win.obchodZalozka = prepniZalozku;
    win.obchodDetail = (id) => { st.hledat = ''; hledani.value = ''; otevriDetail(id); };
    win.obchodUklid = () => { odhlas(); stahovani.clear(); };
  },

  unmount(win) { win.obchodUklid?.(); },

  reopen(win, opts) {
    if (opts?.detail) win.obchodDetail?.(opts.detail);
    else if (opts?.zalozka) win.obchodZalozka?.(opts.zalozka);
  },
};
