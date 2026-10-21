// AstroOS — co doopravdy zabírá místo (Nastavení ▸ Úložiště)
//
// „NOVA NVMe 2 TB“ je jen kulisa (fs.js usage()). Skutečně se plní localStorage prohlížeče, kde leží disk
// (astroos.fs.v1), nastavení (astroos.v1), Astro Studio a data her — limit ~5 MB (5 Mi znaků UTF-16).
// Tady se to spočítá po kategoriích, najdou se největší soubory a co jde vyčistit.

import { State } from './state.js';
import * as FS from './fs.js';

export const LIMIT = 5 * 1024 * 1024;
const DEN = 864e5;

export const KATEGORIE = [
  { id: 'dokumenty', nazev: 'Dokumenty', barva: '#4aa3e8', icon: 'fileText' },
  { id: 'obrazky', nazev: 'Obrázky', barva: '#a077f0', icon: 'image' },
  { id: 'zvuk', nazev: 'Hudba a nahrávky', barva: '#ef6f8e', icon: 'music' },
  { id: 'videa', nazev: 'Videa', barva: '#ef6a5a', icon: 'play' },
  { id: '3d', nazev: '3D scény a modely', barva: '#e8873a', icon: 'box' },
  { id: 'kod', nazev: 'Kód a aplikace', barva: '#e0c25c', icon: 'code' },
  { id: 'stazene', nazev: 'Stažené', barva: '#3fd0c8', icon: 'download' },
  { id: 'aplikace', nazev: 'Data aplikací', barva: '#54d98a', icon: 'grid' },
  { id: 'kos', nazev: 'Koš', barva: '#8a97a0', icon: 'trash' },
  { id: 'system', nazev: 'Systém a dočasné', barva: '#56656e', icon: 'settings' },
];

/** Klíče localStorage mimo disk, které umíme pojmenovat (zbytek = „Ostatní data“). */
const KLICE = {
  'astroos.v1': ['aplikace', 'Nastavení systému'],
  'astroos.studio.v1': ['aplikace', 'Astro Studio — hry a statistiky'],
  'astroos-jazyk': ['system', 'Jazyk systému'],
};

function kategorie(path, name, c) {
  if (path.startsWith(FS.TRASH + '/')) return 'kos';
  if (path.startsWith('/system/') || path.startsWith('/dočasné/')) return 'system';
  // mimo domovskou složku jsou kód aplikací z Obchodu (/.obchod) apod. — data aplikací, nemazat
  if (!path.startsWith(FS.HOME + '/')) return 'aplikace';
  if (path.startsWith(FS.HOME + '/Stažené/')) return 'stazene';
  if (path.startsWith(FS.HOME + '/') && path.slice(FS.HOME.length + 1).split('/').some((s) => s.startsWith('.'))) return 'aplikace';
  if (c.startsWith('data:video/') || /\.(mp4|mov)$/i.test(name) || (path.startsWith(FS.HOME + '/Videa/') && /\.webm$/i.test(name))) return 'videa';
  if (FS.isAudio(name)) return 'zvuk';
  if (FS.isImage(name)) return 'obrazky';
  if (/\.(a3d|obj)$/i.test(name)) return '3d';
  if (/\.(js|css|html|json)$/i.test(name) || path.startsWith(FS.HOME + '/Aplikace/') || path.startsWith(FS.HOME + '/projekty/')) return 'kod';
  return 'dokumenty';
}

/** Uživatelův soubor, který jde poslat do koše (ne data aplikací, systém ani to, co už v koši je). */
export const jdeSmazat = (s) => !!s.path && !['kos', 'system', 'aplikace'].includes(s.kat);

/** Všechny soubory na disku: { path, name, size, m, kat }. */
function souboryDisku() {
  const out = [];
  const walk = (node, path) => {
    for (const [name, n] of Object.entries(node.d)) {
      const p = path === '/' ? '/' + name : path + '/' + name;
      if (FS.isDir(n)) walk(n, p);
      else if (FS.isFile(n)) out.push({ path: p, name, size: n.c.length, m: n.m || 0, smazano: n._smazano || 0, kat: kategorie(p, name, n.c) });
    }
  };
  walk(FS.get('/'), '/');
  return out;
}

const delkaKlice = (k) => {
  try { return k.length + (localStorage.getItem(k) || '').length; } catch { return 0; }
};

export function analyza() {
  const soubory = souboryDisku().sort((a, b) => b.size - a.size);
  const kat = Object.fromEntries(KATEGORIE.map((k) => [k.id, { ...k, velikost: 0, polozky: [] }]));
  for (const s of soubory) { kat[s.kat].velikost += s.size; kat[s.kat].polozky.push(s); }

  // disk v localStorage je JSON — závorky, názvy, časy: „struktura disku“ jde do systému
  let klice = [];
  try { klice = Object.keys(localStorage); } catch { /* bez úložiště */ }
  const obsahDisku = soubory.reduce((s, x) => s + x.size, 0);
  const rezie = Math.max(0, delkaKlice('astroos.fs.v1') - obsahDisku);
  kat.system.velikost += rezie;
  kat.system.polozky.push({ name: 'Struktura disku', size: rezie, virtualni: true });

  for (const k of klice) {
    if (k === 'astroos.fs.v1') continue;
    const [id, nazev] = KLICE[k] || ['aplikace', `Ostatní data (${k})`];
    const size = delkaKlice(k);
    kat[id].velikost += size;
    kat[id].polozky.push({ name: nazev, size, virtualni: true });
  }
  for (const k of Object.values(kat)) k.polozky.sort((a, b) => b.size - a.size);

  const celkem = Object.values(kat).reduce((s, k) => s + k.velikost, 0);
  return {
    celkem, limit: LIMIT, procenta: Math.min(100, celkem / LIMIT * 100),
    kategorie: KATEGORIE.map((k) => kat[k.id]),
    nejvetsi: soubory.filter((s) => jdeSmazat(s)).slice(0, 8),
    soubory,
  };
}

// ---------------------------------------------------------------- vyčištění
/** Co jde smazat. vychozi = předvybrané v nabídce (bezpečné), ostatní si uživatel musí zaškrtnout. */
export function navrhy(a = analyza()) {
  const stari = (s, dny) => Date.now() - s.m > dny * DEN;
  const kos = a.soubory.filter((s) => s.kat === 'kos');
  const docasne = a.soubory.filter((s) => s.path.startsWith('/dočasné/'));
  const stazene = a.soubory.filter((s) => s.kat === 'stazene' && stari(s, 30));
  const ai = a.soubory.filter((s) => s.path.startsWith(FS.HOME + '/.astroai/') && stari(s, 30));
  return [
    { id: 'kos', nazev: 'Koš', popis: 'Soubory, které jsi smazal. Po vysypání už nepůjdou obnovit.', polozky: kos, vychozi: true },
    { id: 'docasne', nazev: 'Dočasné soubory', popis: 'Pozůstatky po aplikacích ve složce /dočasné.', polozky: docasne, vychozi: true },
    { id: 'stazene', nazev: 'Stažené starší než 30 dní', popis: 'Soubory ve Stažených, na které už dlouho nikdo nesáhl.', polozky: stazene, vychozi: false },
    { id: 'ai', nazev: 'Konverzace AstroAI starší než 30 dní', popis: 'Staré chaty z AstroAI.', polozky: ai, vychozi: false },
  ].map((n) => ({ ...n, velikost: n.polozky.reduce((s, x) => s + x.size, 0) }));
}

/** Smaže vybrané návrhy natrvalo. Vrací uvolněné místo. */
export function vycisti(ids) {
  const a = analyza();
  let uvolneno = 0;
  for (const n of navrhy(a).filter((x) => ids.includes(x.id))) {
    if (n.id === 'kos') { FS.emptyTrash(); uvolneno += n.velikost; continue; }
    for (const s of n.polozky) {
      try { FS.remove(s.path, { toTrash: false }); uvolneno += s.size; } catch { /* už není */ }
    }
  }
  return uvolneno;
}

/** Nastavení ▸ Úložiště ▸ „Vysypávat koš po 30 dnech“ — volá se po přihlášení. */
export function automatickyUklid() {
  if (!State.get('uklidKose')) return 0;
  const kos = FS.get(FS.TRASH);
  let n = 0;
  for (const [name, node] of Object.entries(kos.d)) {
    // starší položky nemají čas smazání — počítá se od jejich poslední změny
    if (Date.now() - (node._smazano || node.m || 0) > 30 * DEN) { delete kos.d[name]; n++; }
  }
  if (n) FS.save(FS.TRASH);
  return n;
}
