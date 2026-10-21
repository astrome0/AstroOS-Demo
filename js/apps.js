// AstroOS — registr aplikací
// Hotové aplikace mají mount(); ostatní zatím ukážou obrazovku „připravujeme“.

import { el, cz, bus } from './util.js';
import { icon, logo } from './icons.js';
import { State } from './state.js';
import { openWindow, windows, focus } from './wm.js';
import { filesApp } from './apps/files.js';
import { terminalApp } from './apps/terminal.js';
import { notesApp } from './apps/notes.js';
import { settingsApp } from './apps/settings.js';
import { photosApp } from './apps/photos.js';
import { calcApp } from './apps/calc.js';
import { monitorApp } from './apps/monitor.js';
import { zamceneAplikace } from './demo.js';
import { browserApp } from './apps/browser.js';
import { malovaniApp } from './apps/malovani.js';
import { editorApp } from './apps/editor.js';
import { hryApp } from './apps/hry.js';
import { hudbaApp } from './apps/hudba.js';
import { diktafonApp } from './apps/diktafon.js';
import { postaApp } from './apps/posta.js';
import { obchodApp } from './apps/obchod.js';
import { pocasiApp } from './apps/pocasi.js';
import { defenderApp } from './apps/defender.js';
import * as Ovladace from './ovladace.js';
import { astrogpuApp } from './apps/astrogpu.js';
import { pismoApp } from './apps/pismo.js';
import { tabulkyApp } from './apps/tabulky.js';
import { prezentaceApp } from './apps/prezentace.js';
import { astro3dApp } from './apps/astro3d.js';
import { archivApp } from './apps/archiv.js';
import { astroMinecraftApp, launcherApp } from './apps/minecraft.js';
import { historieApp } from './apps/historie.js';
import { instalatorApp, uzivatelskeDefinice } from './aplikace.js';
import { webAplikaceApps } from './webaplikace.js';
import { KATALOG, nainstalovane as obchodNainstalovane } from './obchod/katalog.js';
import { TRASH } from './fs.js';
import { t, jazykTed } from './i18n.js';
import * as Akt from './aktualizace.js';

export const CATEGORIES = [
  { id: 'fav', name: 'Oblíbené', icon: 'star' },
  { id: 'net', name: 'Internet', icon: 'globe' },
  { id: 'office', name: 'Kancelář', icon: 'fileText' },
  { id: 'media', name: 'Zábava', icon: 'music' },
  { id: 'tools', name: 'Nástroje', icon: 'grid' },
  { id: 'system', name: 'Systém', icon: 'settings' },
];

const G = {
  blue: 'linear-gradient(145deg,#4aa3e8,#2563a8)',
  green: 'linear-gradient(145deg,#54d98a,#2b9b53)',
  amber: 'linear-gradient(145deg,#f0b95c,#c47f26)',
  violet: 'linear-gradient(145deg,#a077f0,#6a43c0)',
  rose: 'linear-gradient(145deg,#f07f9c,#c04a6a)',
  teal: 'linear-gradient(145deg,#3fd0c8,#1e8f92)',
  slate: 'linear-gradient(145deg,#7d8b96,#4a565f)',
  dark: 'linear-gradient(145deg,#2c3338,#14181b)',
  red: 'linear-gradient(145deg,#ef6a5a,#b8382c)',
};

/** @type {Record<string, any>} */
export const APPS = {};

function app(def) { APPS[def.id] = { width: 780, height: 540, cat: 'tools', ...def }; return APPS[def.id]; }

// ---------------------------------------------------------------- hotové aplikace
[filesApp, terminalApp, notesApp, settingsApp, photosApp, calcApp, monitorApp, browserApp,
  malovaniApp, editorApp, hryApp, hudbaApp, diktafonApp, postaApp, obchodApp, pocasiApp, defenderApp, astrogpuApp, pismoApp, tabulkyApp, prezentaceApp, astro3dApp, archivApp, historieApp, astroMinecraftApp, launcherApp, instalatorApp,
  ...webAplikaceApps].forEach(app);

// ukázková verze: AstroAI, Jirka a Astro Studio jen jako zamčená obrazovka (js/demo.js)
zamceneAplikace.forEach(app);

// vlastní aplikace nainstalované ze složek na disku (js/aplikace.js)
uzivatelskeDefinice().forEach(app);

// aplikace stažené z Obchodu (js/obchod/) — kód je v systému, v nabídkách jsou až po instalaci
KATALOG.filter((a) => obchodNainstalovane().includes(a.id)).forEach(app);

app({
  id: 'welcome', name: 'Vítejte', icon: 'star', color: G.green, cat: 'system',
  width: 660, height: 624, hidden: true,
  mount(body, win) {
    const cards = [
      { i: 'grid', t: 'Plocha', p: 'Ikony táhni kamkoli, pravým tlačítkem vyvoláš nabídku, tažením myši je označíš.' },
      { i: 'star', t: 'Nabídka Start', p: 'Otevři ji klávesou Win nebo logem v panelu. Hledání funguje hned od prvního písmene.' },
      { i: 'settings', t: 'Rychlá nastavení', p: 'Vpravo dole klikni na ikonky sítě a hlasitosti. Změníš tam i barvu systému.' },
      { i: 'ai', t: 'AstroAI', p: 'V plné verzi asistent na lokálním modelu. V téhle ukázce není.' },
    ];
    body.append(el('div.welcome', {},
      el('div.hero', {},
        logo('logo'),
        el('h1', { html: 'Vítej v <b>AstroOS</b>' }),
        el('p', { text: `Tohle je ukázková verze AstroOS, ${State.get('user').name}. Vyzkoušet si můžeš plochu, okna i většinu aplikací — AI, Render Pro v Astro 3D, exporty a část her a motivů jsou jen v plné verzi.` }),
      ),
      el('div.cards', {}, cards.map((c) => el('div.wcard', {},
        el('div.ic', {}, icon(c.i)),
        el('h3', { text: c.t }),
        el('p', { text: c.p }),
      ))),
      el('div.foot', {},
        el('span', { text: `Nainstalováno ${cz.datumKratky(new Date(State.get('installed')))}` }),
        el('button.btn.primary', { text: 'Jasně, jdeme na to', onclick: () => win.close() }),
      ),
    ));
  },
});

// Co je nového — otevře se samo po velké aktualizaci (aktualizace.js), jinak z Nastavení ▸ Aktualizace
app({
  id: 'novinky', name: 'Co je nového', icon: 'star', color: G.violet, cat: 'system',
  width: 720, height: 660, hidden: true,
  mount(body, win) {
    const verze = win.opts?.verze || Akt.verzeOS().verze.split('.').slice(0, 2).join('.');
    const bal = Akt.BALICKY.find((b) => b.verze === verze);
    const karty = Akt.NOVINKY[verze] || [];
    win.title = `Co je nového v AstroOS ${verze}`;
    body.append(el('div.welcome.novinky', {},
      el('div.hero', {},
        el('div.nov-verze', {}, logo('logo'), el('span', { text: verze })),
        el('h1', { html: `AstroOS <b>${verze}</b> „${bal?.kodnazev || ''}“` }),
        el('p', { text: `Systém je aktualizovaný, ${State.get('user').name}. Tohle všechno přibylo od verze ${Akt.ZAKLAD.verze}:` }),
      ),
      el('div.cards', {}, karty.map((c) => el('div.wcard', {},
        el('div.ic', {}, icon(c.i)),
        el('h3', { text: c.t }),
        el('p', { text: c.p }),
        c.app && APPS[c.app] ? el('button.btn.nov-zkus', { text: 'Vyzkoušet', onclick: () => openApp(c.app, c.opts) }) : null,
      ))),
      el('div.foot', {},
        el('span', { text: bal ? `Sestavení ${bal.sestaveni} · jádro nova ${bal.jadro}` : '' }),
        el('button.btn.primary', { text: 'Super, díky', onclick: () => win.close() }),
      ),
    ));
  },
});

app({
  id: 'about', name: 'O systému', icon: 'info', color: G.slate, cat: 'system',
  width: 560, height: 540, hidden: true,
  mount(body, win) {
    const v = Akt.verzeOS();
    const specs = [
      ['Název systému', Akt.nazevOS()],
      ['Edice', 'Ukázková verze (není to plná verze)'],
      ['Copyright', '© 2026 AstroMeo · All rights reserved'],
      ['License', 'Demo for viewing only — no copying, modification or redistribution'],
      ['Sestavení', `${v.sestaveni} · kanál stabilní`],
      ['Jádro', `nova ${v.jadro}`],
      ['Procesor', 'Astro Core X7-9900 @ 4.20 GHz'],
      ['Paměť', '32 GB DDR5'],
      ['Grafika', `${Ovladace.GPU.nazev} · ${Ovladace.GPU.pamet} GB`],
      ['Úložiště', 'NOVA NVMe 2 TB · ASTRO SSD 1 TB'],
      ['Síť', 'AstroNet 2.5G'],
      ['Uživatel', State.get('user').name],
      ['Prostředí', 'Astro Shell (web)'],
    ];

    const gpuBox = el('div.gpu-box');
    function kresliGpu() {
      const o = Ovladace.nastaveni();
      gpuBox.replaceChildren(
        el('div.gpu-box-hlava', {},
          el('div.gpu-box-ic', {}, icon('gpu')),
          el('div', {},
            el('b', { text: `${Ovladace.GPU.nazev} · ovladač ${o.verze}` }),
            el('span', { text: o.cekajici ? `K dispozici je verze ${o.cekajici.verze}` : `Nainstalováno ${cz.datumKratky(new Date(o.nainstalovano))}` }))),
        el('button.btn' + (o.cekajici ? '.primary' : ''), { text: 'Otevřít AstroGPU', onclick: () => openApp('astrogpu') }),
      );
    }
    kresliGpu();
    win.onClose = bus.on('ovladac', kresliGpu);

    body.append(el('div.about', {},
      el('div.top', {},
        logo('logo'),
        el('div', {},
          el('h2', { text: 'AstroOS' }),
          el('div.sub', { text: `Verze ${v.verze} · ukázková verze` }),
        ),
      ),
      specs.map(([k, v]) => el('div.spec', {}, el('div.k', { text: k }), el('div.v', { text: v }))),
      gpuBox,
    ));
  },
  unmount(win) { win.onClose?.(); },
});

// ---------------------------------------------------------------- chystané aplikace
// Zatím prázdné — všechny aplikace už mají svoje okno. Nová se sem dá přidat
// jedním řádkem a bude mít obrazovku „připravujeme“, než ji napíšeme.
const SOON = [];

for (const s of SOON) {
  app({
    ...s, soon: true, width: 640, height: 440,
    mount(body) {
      body.append(el('div.soon-app', {},
        el('div.big', { style: { background: s.color } }, icon(s.icon)),
        el('h2', { text: s.name }),
        el('p', { text: s.note }),
        el('div.tag', { text: 'Přijde v dalším kroku' }),
      ));
    },
  });
}

// ---------------------------------------------------------------- zástupci
// Nemají vlastní okno — jen otevřou Soubory na správném místě.
app({
  id: 'computer', name: 'Tento počítač', icon: 'computer', color: G.slate, cat: 'system',
  launch: () => openApp('files', { path: '/' }),
});
app({
  id: 'trash', name: 'Koš', icon: 'trash', color: G.slate, cat: 'system',
  launch: () => openApp('files', { path: TRASH }),
});

// ---------------------------------------------------------------- spouštění
/** Aplikace běží v jedné instanci: pokud už okno existuje, jen ho vytáhne dopředu. */
export function openApp(id, opts) {
  const a = APPS[id];
  if (!a) return null;
  if (a.launch) return a.launch(opts);
  // soukromé okno Novy se nepoužije pro odkazy odjinud — ty patří do běžného okna
  const existing = windows.find((w) => w.app.id === id && !w.opts?.soukrome);
  if (existing) {
    focus(existing);
    if (opts) a.reopen?.(existing, opts);   // např. otevření dalšího souboru
    return existing;
  }
  return openWindow(a, opts);
}

export const appList = (cat) =>
  Object.values(APPS)
    .filter((a) => !a.hidden && (!cat || cat === 'all' || a.cat === cat))
    .sort((a, b) => t(a.name).localeCompare(t(b.name), jazykTed()));

export const FAVORITES = ['astroai', 'files', 'terminal', 'browser', 'notes', 'settings'];

// Připnuté aplikace si uživatel mění sám, takže žijí v nastavení.
const VYCHOZI_START = ['astroai', 'jirka', 'files', 'browser', 'mapy', 'pismo', 'tabulky', 'prezentace', 'editor', 'terminal', 'notes', 'photos', 'malovani', 'astro3d',
  'calc', 'weather', 'monkeytype', 'monitor', 'defender', 'astrogpu', 'music', 'recorder', 'games', 'mail', 'store', 'settings'];
const VYCHOZI_PANEL = ['files', 'browser', 'terminal', 'notes', 'astroai', 'jirka'];

const seznam = (klic, vychozi) => {
  const ulozeno = State.get(klic);
  return (Array.isArray(ulozeno) ? ulozeno : vychozi).filter((id) => APPS[id]);
};

export const startPins = () => seznam('pinyStart', VYCHOZI_START);

// Počasí přibylo až později — kdo už má vlastní seznam připnutých, dostane ho do Startu jednou.
if (!State.get('pripnutoPocasi')) {
  const ulozene = State.get('pinyStart');
  if (Array.isArray(ulozene) && !ulozene.includes('weather')) {
    const i = ulozene.indexOf('calc');
    State.set('pinyStart', i >= 0 ? [...ulozene.slice(0, i + 1), 'weather', ...ulozene.slice(i + 1)] : [...ulozene, 'weather']);
  }
  State.set('pripnutoPocasi', true);
}
if (!State.get('pripnutoDefender')) {
  const ulozene = State.get('pinyStart');
  if (Array.isArray(ulozene) && !ulozene.includes('defender')) {
    const i = ulozene.indexOf('monitor');
    State.set('pinyStart', i >= 0 ? [...ulozene.slice(0, i + 1), 'defender', ...ulozene.slice(i + 1)] : [...ulozene, 'defender']);
  }
  State.set('pripnutoDefender', true);
}
if (!State.get('pripnutoAstroGpu')) {
  const ulozene = State.get('pinyStart');
  if (Array.isArray(ulozene) && !ulozene.includes('astrogpu')) {
    const i = ulozene.indexOf('defender');
    State.set('pinyStart', i >= 0 ? [...ulozene.slice(0, i + 1), 'astrogpu', ...ulozene.slice(i + 1)] : [...ulozene, 'astrogpu']);
  }
  State.set('pripnutoAstroGpu', true);
}
// Mapy a Monkeytype (webové aplikace) — do vlastního seznamu připnutých jednou, za Novu a Počasí
if (!State.get('pripnutoWebAplikace')) {
  let ulozene = State.get('pinyStart');
  if (Array.isArray(ulozene)) {
    for (const [id, za] of [['mapy', 'browser'], ['monkeytype', 'weather']]) {
      if (ulozene.includes(id)) continue;
      const i = ulozene.indexOf(za);
      ulozene = i >= 0 ? [...ulozene.slice(0, i + 1), id, ...ulozene.slice(i + 1)] : [...ulozene, id];
    }
    State.set('pinyStart', ulozene);
  }
  State.set('pripnutoWebAplikace', true);
}
// AstroPísmo — do vlastního seznamu připnutých jednou, za Mapy
if (!State.get('pripnutoPismo')) {
  const ulozene = State.get('pinyStart');
  if (Array.isArray(ulozene) && !ulozene.includes('pismo')) {
    const i = ulozene.indexOf('mapy');
    State.set('pinyStart', i >= 0 ? [...ulozene.slice(0, i + 1), 'pismo', ...ulozene.slice(i + 1)] : [...ulozene, 'pismo']);
  }
  State.set('pripnutoPismo', true);
}
// AstroTabulky — do vlastního seznamu připnutých jednou, za Písmo
if (!State.get('pripnutoTabulky')) {
  const ulozene = State.get('pinyStart');
  if (Array.isArray(ulozene) && !ulozene.includes('tabulky')) {
    const i = ulozene.indexOf('pismo');
    State.set('pinyStart', i >= 0 ? [...ulozene.slice(0, i + 1), 'tabulky', ...ulozene.slice(i + 1)] : [...ulozene, 'tabulky']);
  }
  State.set('pripnutoTabulky', true);
}
// AstroPrezentace — do vlastního seznamu připnutých jednou, za Tabulky
if (!State.get('pripnutoPrezentace')) {
  const ulozene = State.get('pinyStart');
  if (Array.isArray(ulozene) && !ulozene.includes('prezentace')) {
    const i = ulozene.indexOf('tabulky');
    State.set('pinyStart', i >= 0 ? [...ulozene.slice(0, i + 1), 'prezentace', ...ulozene.slice(i + 1)] : [...ulozene, 'prezentace']);
  }
  State.set('pripnutoPrezentace', true);
}
// Astro 3D — do vlastního seznamu připnutých jednou, za Malování
if (!State.get('pripnuto3D')) {
  const ulozene = State.get('pinyStart');
  if (Array.isArray(ulozene) && !ulozene.includes('astro3d')) {
    const i = ulozene.indexOf('malovani');
    State.set('pinyStart', i >= 0 ? [...ulozene.slice(0, i + 1), 'astro3d', ...ulozene.slice(i + 1)] : [...ulozene, 'astro3d']);
  }
  State.set('pripnuto3D', true);
}
export const panelPins = () => seznam('pinyPanel', VYCHOZI_PANEL);

/** Připne nebo odepne aplikaci; kam = 'pinyStart' | 'pinyPanel'. */
export function prepniPin(kam, id) {
  const vychozi = kam === 'pinyPanel' ? VYCHOZI_PANEL : VYCHOZI_START;
  const nyni = seznam(kam, vychozi);
  const pripnuto = nyni.includes(id);
  State.set(kam, pripnuto ? nyni.filter((x) => x !== id) : [...nyni, id]);
  return !pripnuto;
}

export const jePripnuto = (kam, id) => (kam === 'pinyPanel' ? panelPins() : startPins()).includes(id);
