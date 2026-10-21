// AstroOS — aktualizace systému (jako Windows Update)
//
// Nastavení ▸ Aktualizace: Vyhledat → Stáhnout a nainstalovat (rychlost podle Wi-Fi z sit.js) →
// „Čeká na restart“. Při restartu (nebo vypnutí) černá obrazovka „Práce na aktualizacích 0–30 %“,
// po startu dojede 30–100 % a po přihlášení se otevře okno Co je nového (aplikace `novinky` v apps.js).
// Verze systému (boot, O systému, terminál, verze.txt) se bere odsud — verzeOS().
//
// Stav v State.aktualizace: { nainstalovano: [{ id, cas }], cekaRestart: [id], posledniKontrola,
// auto, druhaFaze, novinky, definiceCas }. Průběh stahování žije jen v paměti (bus 'aktualizace').

import { el, bus, sleep } from './util.js';
import { logo } from './icons.js';
import { State } from './state.js';
import * as Sit from './sit.js';
import * as FS from './fs.js';
import { toast } from './ui.js';

export const ZAKLAD = { verze: '1.0', kodnazev: 'Nova', sestaveni: '2026.09.20', jadro: '6.9.2-astro' };

/** Balíčky v pořadí, v jakém se instalují. `po` = nabídne se až po instalaci jiného balíčku. */
export const BALICKY = [
  {
    id: 'astroos-1.1', typ: 'funkce', nazev: 'AstroOS 1.1 „Kometa“', popis: 'Aktualizace funkcí',
    verze: '1.1', kodnazev: 'Kometa', sestaveni: '2026.10.19', jadro: '7.0.1-astro', mb: 486, restart: true,
  },
  {
    id: 'astroos-1.1.1', typ: 'kumulativni', nazev: 'Kumulativní aktualizace AstroOS 1.1.1',
    popis: 'Opravy zabezpečení a stability', verze: '1.1.1', sestaveni: '2026.10.21', jadro: '7.0.2-astro',
    mb: 38, restart: true, po: 'astroos-1.1',
  },
  {
    id: 'defender-definice', typ: 'definice', nazev: 'Astro Defender — definice hrozeb',
    popis: 'Nové definice pro ochranu v reálném čase', mb: 3, restart: false, opakovat: 6 * 3600e3,
  },
];
const balicek = (id) => BALICKY.find((b) => b.id === id);

/** Co je nového — karty v okně po aktualizaci. app = co otevře „Vyzkoušet“. */
export const NOVINKY = {
  '1.1': [
    { i: 'pismo', t: 'Astro Office', p: 'Písmo, Tabulky a Prezentace — dokumenty, vzorce, grafy i snímky s přechody Morph.', app: 'pismo' },
    { i: 'box', t: 'Astro 3D', p: 'Modelování jako v Blenderu: režim úprav, světla, Render Pro, animace a procházka scénou.', app: 'astro3d' },
    { i: 'mic', t: 'Jirka', p: 'Hlasový asistent, který umí ovládat AstroOS — otevře aplikaci, najde soubor, zapne motiv.', app: 'jirka' },
    { i: 'game', t: 'Astro Studio', p: 'Vydej vlastní hru do Obchodu a sleduj, jak ji hráči objevují a hodnotí.', app: 'studio' },
    { i: 'store', t: 'Obchod', p: 'Dvacet nových her a nástrojů, od Pexesa po Planetárium.', app: 'obchod' },
    { i: 'globe', t: 'Nova se představuje', p: 'Weby teď vidí, že k nim přišla Nova na AstroOS, ne obyčejný Chrome.', app: 'browser' },
    { i: 'shield', t: 'Astro Defender', p: 'Ochrana v reálném čase, SmartScreen v Nově a karanténa podezřelých aplikací.', app: 'defender' },
    { i: 'keyboard', t: 'AstroOS anglicky', p: 'Systém mluví česky i anglicky. Přepneš to v Nastavení ▸ Čas a jazyk.', app: 'settings', opts: { section: 'jazyk' } },
  ],
  '1.1.1': [
    'Kurzor už neutíká před tlačítkem Zrušit.',
    'Hodiny v panelu se nepletou o sekundu v přestupném roce na Marsu.',
    'Spouštění je o 0,3 s rychlejší.',
    'Opravy zabezpečení (AstroSec-2026-1021).',
  ],
};

// ---------------------------------------------------------------- uložený stav
const data = () => ({ nainstalovano: [], cekaRestart: [], posledniKontrola: 0, auto: true, ...(State.get('aktualizace') || {}) });
const uloz = (zmena) => State.set('aktualizace', { ...data(), ...zmena });

export const jeNainstalovano = (id) => data().nainstalovano.some((n) => n.id === id);
export const historie = () => [...data().nainstalovano].sort((a, b) => b.cas - a.cas).map((n) => ({ ...n, bal: balicek(n.id) })).filter((n) => n.bal);
export const cekaNaRestart = () => data().cekaRestart.length > 0;
export const autoHledani = () => data().auto !== false;
export const nastavAuto = (v) => uloz({ auto: !!v });
export const posledniKontrola = () => data().posledniKontrola || 0;

/** Současná verze systému (podle nainstalovaných balíčků s číslem verze). */
export function verzeOS() {
  const v = { ...ZAKLAD };
  for (const b of BALICKY) {
    if (!b.verze || !jeNainstalovano(b.id)) continue;
    for (const k of ['verze', 'kodnazev', 'sestaveni', 'jadro']) if (b[k]) v[k] = b[k];
  }
  return v;
}
export const nazevOS = () => { const v = verzeOS(); return `AstroOS ${v.verze} „${v.kodnazev}“`; };

/** Balíčky, které teď server „nabízí“. */
function dostupne() {
  const d = data();
  return BALICKY.filter((b) => {
    if (d.cekaRestart.includes(b.id)) return false;
    if (b.opakovat) return Date.now() - (d.definiceCas || 0) > b.opakovat;
    return !jeNainstalovano(b.id) && (!b.po || jeNainstalovano(b.po));
  });
}

// ---------------------------------------------------------------- průběh (jen v paměti)
// stav: klid | hledam | k-dispozici | pracuji | restart | aktualni | chyba
let stav = 'klid';
let polozky = [];     // { bal, faze: ceka|stahuje|instaluje|hotovo|restart|chyba, p, stazeno }
let chyba = '';
const zmena = () => bus.emit('aktualizace');

export function stavTed() {
  if (stav === 'klid' && cekaNaRestart()) {
    stav = 'restart';
    polozky = data().cekaRestart.map((id) => ({ bal: balicek(id), faze: 'restart', p: 100, stazeno: 0 })).filter((x) => x.bal);
  }
  return { stav, polozky, chyba };
}

export async function hledej({ tise = false } = {}) {
  if (stav === 'hledam' || stav === 'pracuji') return [];
  stavTed();   // po obnovení stránky vrátí do seznamu balíčky čekající na restart
  stav = 'hledam'; chyba = '';
  zmena();
  await sleep(tise ? 400 : 1600 + Math.random() * 1400);
  if (!Sit.online()) {
    stav = 'chyba';
    chyba = Sit.letadlo() ? 'Je zapnutý režim Letadlo.' : 'Nejsi připojený k internetu.';
    zmena();
    return [];
  }
  uloz({ posledniKontrola: Date.now() });
  const cekajici = polozky.filter((x) => x.faze === 'restart');
  polozky = [...cekajici, ...dostupne().map((bal) => ({ bal, faze: 'ceka', p: 0, stazeno: 0 }))];
  stav = polozky.some((x) => x.faze === 'ceka') ? 'k-dispozici' : cekajici.length ? 'restart' : 'aktualni';
  zmena();
  return polozky.filter((x) => x.faze === 'ceka');
}

/** MB/s podle Wi-Fi: AstroNet ~45, veřejná síť kavárny ~5 (rychlost v sit.js je v Mb/s). */
function rychlost() {
  const mbit = Sit.aktualni()?.rychlost || 100;
  return Math.min(60, Math.max(5, mbit / 8 * 0.15)) * (0.75 + Math.random() * 0.5);
}

export async function nainstaluj() {
  if (stav === 'pracuji') return;
  stav = 'pracuji'; chyba = '';
  zmena();
  for (const x of polozky) {
    if (x.faze !== 'ceka' && x.faze !== 'chyba') continue;
    // stahování
    x.faze = 'stahuje';
    while (x.stazeno < x.bal.mb) {
      await sleep(250);
      if (!Sit.online()) {
        x.faze = 'chyba'; stav = 'chyba';
        chyba = 'Stahování se přerušilo — počítač ztratil připojení.';
        zmena();
        return;
      }
      x.stazeno = Math.min(x.bal.mb, x.stazeno + rychlost() / 4);
      x.p = Math.floor(x.stazeno / x.bal.mb * 100);
      zmena();
    }
    // instalace
    x.faze = 'instaluje'; x.p = 0;
    const krok = 100 / Math.max(6, (2 + x.bal.mb / 60) * 4);
    while (x.p < 100) {
      await sleep(250 + Math.random() * 200);
      x.p = Math.min(100, Math.round(x.p + krok * (0.4 + Math.random() * 1.2)));
      zmena();
    }
    if (x.bal.restart) {
      x.faze = 'restart';
      uloz({ cekaRestart: [...data().cekaRestart, x.bal.id] });
    } else {
      x.faze = 'hotovo';
      oznacNainstalovano([x.bal.id]);
      if (x.bal.id === 'defender-definice') {
        uloz({ definiceCas: Date.now() });
        import('./obrana.js').then((m) => m.aktualizujDefinice()).catch(() => {});
      }
    }
    zmena();
  }
  stav = cekaNaRestart() ? 'restart' : 'aktualni';
  zmena();
  if (stav === 'restart') {
    toast({
      title: 'Aktualizace čekají na restart', icon: 'restart', timeout: 9000,
      body: 'Restartuj počítač, aby se dokončila instalace.',
      onClick: () => import('./apps.js').then(({ openApp }) => openApp('settings', { section: 'aktualizace' })),
    });
  }
}

function oznacNainstalovano(ids) {
  const d = data();
  const cas = Date.now();
  // opakované balíčky (definice) drží v historii jen poslední instalaci
  const zbytek = d.nainstalovano.filter((n) => !ids.includes(n.id));
  uloz({ nainstalovano: [...zbytek, ...ids.map((id) => ({ id, cas }))] });
}

/** Použije balíčky čekající na restart: zapíše je jako nainstalované a přepíše verze.txt. */
function aplikuj() {
  const ids = data().cekaRestart;
  if (!ids.length) return;
  const funkce = ids.map(balicek).find((b) => b?.typ === 'funkce');
  const posledni = ids.map(balicek).filter((b) => b?.verze).pop();
  oznacNainstalovano(ids);
  uloz({ cekaRestart: [], druhaFaze: true, novinky: funkce?.verze || (posledni ? '~' + posledni.verze : null) });
  const v = verzeOS();
  const cesta = '/system/astroos/verze.txt';
  try { if (FS.exists(cesta)) FS.write(cesta, `${nazevOS()}\njádro nova ${v.jadro}\nsestavení ${v.sestaveni}\n`); } catch { /* disk plný — nevadí */ }
  stav = 'klid'; polozky = [];
}

// ---------------------------------------------------------------- obrazovka „Práce na aktualizacích“
async function obrazovka(od, kam, ms, konec) {
  const scr = el('div.oobe.oobe-reset', { 'data-faze': 'cerna' });
  const t = el('div.oobe-restart-t', { text: `Práce na aktualizacích ${od} %` });
  scr.append(el('div.oobe-restart', {}, logo('oobe-restart-logo'),
    el('div.spinner', {}, el('i'), el('i'), el('i'), el('i'), el('i')),
    el('div.akt-obrazovka', {}, t, el('div.akt-pozn', { text: 'Nevypínej počítač. Může to chvíli trvat.' }))));
  document.body.append(scr);
  let p = od;
  const kroku = Math.max(1, kam - od);
  while (p < kam) {
    await sleep(ms / kroku * (0.4 + Math.random() * 1.2));
    p = Math.min(kam, p + 1 + (Math.random() < 0.25 ? Math.floor(Math.random() * 3) : 0));
    t.textContent = `Práce na aktualizacích ${p} %`;
  }
  if (konec) {
    await sleep(700);
    scr.querySelector('.akt-pozn').remove();
    t.textContent = konec;
    await sleep(1600);
  }
  return scr;
}

/** Restart nebo vypnutí s čekajícími aktualizacemi: 0–30 %, pak se aktualizace použijí. */
export async function predRestartem(vypnout = false) {
  if (!cekaNaRestart()) return;
  const scr = await obrazovka(0, 30, 4200, vypnout ? 'Vypínání' : 'Restartování');
  aplikuj();
  scr.remove();
}

/** Po startu: dojede 30–100 %. Když se počítač vypnul bez restartu (zavřené okno), použije je teď. */
export async function poStartu() {
  if (cekaNaRestart()) aplikuj();
  if (!data().druhaFaze) return;
  const scr = await obrazovka(30, 100, 5600);
  uloz({ druhaFaze: false });
  await sleep(500);
  scr.remove();
}

/** Po přihlášení: okno Co je nového po velké aktualizaci, jinak občas tichá kontrola na pozadí. */
export function poPrihlaseni() {
  const d = data();
  if (d.novinky) {
    const verze = d.novinky;
    uloz({ novinky: null });
    setTimeout(() => {
      if (verze.startsWith('~')) {
        toast({ title: `AstroOS je aktualizovaný na ${verze.slice(1)}`, body: NOVINKY[verze.slice(1)]?.[0] || 'Opravy zabezpečení a stability.', icon: 'check', timeout: 8000,
          onClick: () => import('./apps.js').then(({ openApp }) => openApp('settings', { section: 'aktualizace' })) });
      } else {
        import('./apps.js').then(({ openApp }) => openApp('novinky', { verze }));
      }
    }, 1300);
    return;
  }
  if (!autoHledani() || cekaNaRestart() || Date.now() - posledniKontrola() < 6 * 3600e3) return;
  setTimeout(async () => {
    if ($desktopSkryty()) return;
    const nove = (await hledej({ tise: true })).filter((x) => x.bal.typ !== 'definice');
    if (!nove.length) return;
    toast({
      title: 'Je k dispozici aktualizace', icon: 'download', timeout: 12000,
      body: `${nove[0].bal.nazev} — klikni a nainstaluj ji v Nastavení.`,
      onClick: () => import('./apps.js').then(({ openApp }) => openApp('settings', { section: 'aktualizace' })),
    });
  }, 15000);
}
const $desktopSkryty = () => document.getElementById('desktop')?.classList.contains('hidden');
