// AstroOS — virtuální souborový systém (uložený v localStorage)
//
// Uzly: složka = { d: { název: uzel }, m: čas }, soubor = { c: 'obsah', m: čas }
// Cesty jsou absolutní a oddělené lomítkem: /domov/uzivatel/Dokumenty/pozn.txt

import { bus } from './util.js';
import { klic, home } from './profil.js';

// každý účet má vlastní disk (profil.js); hlavní účet má domov /domov/uzivatel jako dřív
const KEY = klic('astroos.fs.v1');
export const HOME = home();
export const TRASH = '/.koš';

const dir = (children = {}) => ({ d: children, m: Date.now() });
const file = (c = '') => ({ c, m: Date.now() });

// Pár obrázků na disk. SVG je text, takže se dá uložit přímo do souboru;
// fotky z projektu se odkazují přes „astro-img:cesta“.
const ART = {
  'kruhy.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
  <defs><radialGradient id="g" cx="50%" cy="45%"><stop offset="0" stop-color="#6be0a8"/><stop offset="1" stop-color="#0b2230"/></radialGradient></defs>
  <rect width="800" height="600" fill="url(#g)"/>
  <g fill="none" stroke="#e8fff4" stroke-opacity=".5">
    <circle cx="400" cy="270" r="60" stroke-width="3"/><circle cx="400" cy="270" r="120" stroke-width="2.4"/>
    <circle cx="400" cy="270" r="185" stroke-width="1.8"/><circle cx="400" cy="270" r="255" stroke-width="1.2"/>
  </g></svg>`,

  'vlnovka.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
  <rect width="800" height="600" fill="#0c1424"/>
  <g fill="none" stroke-width="6" stroke-linecap="round">
    <path d="M-20 420 C 160 300 240 520 420 400 S 700 260 820 360" stroke="#4aa3e8" stroke-opacity=".85"/>
    <path d="M-20 470 C 160 350 240 570 420 450 S 700 310 820 410" stroke="#a077f0" stroke-opacity=".7"/>
    <path d="M-20 520 C 160 400 240 620 420 500 S 700 360 820 460" stroke="#46c36f" stroke-opacity=".6"/>
  </g></svg>`,

  'mrizka.svg': (() => {
    let r = '';
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 10; x++) {
        const o = (0.12 + ((x * 7 + y * 13) % 11) / 13).toFixed(2);
        r += `<rect x="${20 + x * 78}" y="${20 + y * 70}" width="58" height="50" rx="10" fill="#f0b95c" fill-opacity="${o}"/>`;
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><rect width="800" height="600" fill="#141a1f"/>${r}</svg>`;
  })(),

  'zapad.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
  <defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b1a4a"/><stop offset=".55" stop-color="#e0654a"/><stop offset="1" stop-color="#f0b95c"/></linearGradient></defs>
  <rect width="800" height="600" fill="url(#s)"/>
  <circle cx="400" cy="360" r="88" fill="#ffe9b0" fill-opacity=".9"/>
  <path d="M0 420 L170 300 L280 380 L420 250 L560 400 L690 330 L800 400 L800 600 L0 600Z" fill="#2a1430" fill-opacity=".85"/>
  <path d="M0 500 L200 420 L380 500 L560 430 L800 510 L800 600 L0 600Z" fill="#160a1c"/></svg>`,
};

function defaultTree() {
  return dir({
    domov: dir({
      [HOME.split('/')[2]]: dir({
        'Dokumenty': dir({
          'cti-me.txt': file(
            'Vítej v AstroOS!\n\n' +
            'Tohle je obyčejný textový soubor na virtuálním disku.\n' +
            'Můžeš ho upravit v Poznámkách nebo vypsat v terminálu:\n\n' +
            `    cat ${HOME}/Dokumenty/cti-me.txt\n\n` +
            'Všechno, co tu vytvoříš, přežije i restart systému.\n'),
          'napady.md': file(
            '# Nápady\n\n' +
            '- [x] rozběhat systém\n' +
            '- [ ] dopsat prohlížeč\n' +
            '- [ ] napojit AstroAI na lokální model\n' +
            '- [ ] přidat hry\n'),
          'rozpocet.csv': file('polozka;cena\nmonitor;12990\nklavesnice;2490\nmyš;990\n'),
        }),
        'Obrázky': dir({
          'tapety': dir({
            'vlny.webp': file('astro-img:img/vlny.webp'),
            'oblouky.webp': file('astro-img:img/oblouky.webp'),
            'hedvabi.webp': file('astro-img:img/hedvabi.webp'),
            'mesic.webp': file('astro-img:img/mesic.webp'),
            'krivky.webp': file('astro-img:img/krivky.webp'),
          }),
          'kruhy.svg': file(ART['kruhy.svg']),
          'vlnovka.svg': file(ART['vlnovka.svg']),
          'mrizka.svg': file(ART['mrizka.svg']),
          'zapad.svg': file(ART['zapad.svg']),
        }),
        'Hudba': dir({ 'playlist.txt': file('1. nic zatím\n') }),
        'Stažené': dir({ 'astroos-1.0.iso': file('[obraz systému, 2,4 GB]') }),
        'Plocha': dir({}),
        'projekty': dir({
          'ahoj.js': file("console.log('Ahoj z AstroOS!');\n"),
          'styl.css': file('body {\n  background: #0a0f12;\n  color: #eef3f5;\n}\n'),
        }),
        '.nastaveni': file('téma=tmavé\njazyk=cs\n'),
      }),
    }),
    system: dir({
      'astroos': dir({
        'verze.txt': file('AstroOS 1.0 „Nova“\njádro nova 6.9.2-astro\nsestavení 2026.09.20\n'),
        'licence.txt': file('AstroOS DEMO — not a finished product.\n© 2026 AstroMeo. All rights reserved.\nFor viewing and trying out only. Do not copy, modify or redistribute.\n'),
      }),
      'log': dir({ 'boot.log': file('[ ok ] jádro nova 6.9.2\n[ ok ] připojen NVMe0\n[ ok ] spuštěn astro-shell\n') }),
    }),
    'dočasné': dir({}),
    '.koš': dir({}),
  });
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* poškozená data → nový disk */ }
  return defaultTree();
}

let root = load();

// ---------------------------------------------------------------- cesty
export const join = (...parts) => normalize(parts.join('/'));

export function normalize(path, cwd = '/') {
  if (!path) path = '.';
  const abs = path.startsWith('/') ? path : cwd + '/' + path;
  const out = [];
  for (const seg of abs.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') out.pop();
    else out.push(seg);
  }
  return '/' + out.join('/');
}

export const dirname = (p) => {
  const n = normalize(p);
  const i = n.lastIndexOf('/');
  return i <= 0 ? '/' : n.slice(0, i);
};

export const basename = (p) => {
  const n = normalize(p);
  return n === '/' ? '/' : n.slice(n.lastIndexOf('/') + 1);
};

// ---------------------------------------------------------------- čtení
export const isDir = (node) => !!node && typeof node === 'object' && 'd' in node;
export const isFile = (node) => !!node && typeof node === 'object' && 'c' in node;

export function get(path) {
  const n = normalize(path);
  if (n === '/') return root;
  let node = root;
  for (const seg of n.slice(1).split('/')) {
    if (!isDir(node)) return null;
    node = node.d[seg];
    if (!node) return null;
  }
  return node;
}

export const exists = (path) => !!get(path);

export function size(node) {
  if (isFile(node)) return node.c.length;
  if (!isDir(node)) return 0;
  return Object.values(node.d).reduce((s, n) => s + size(n), 0);
}

/** Seznam položek ve složce, složky první, pak abecedně. */
export function list(path, { hidden = false } = {}) {
  const node = get(path);
  if (!isDir(node)) throw new Error(`Není složka: ${path}`);
  return Object.entries(node.d)
    .filter(([name]) => hidden || !name.startsWith('.'))
    .map(([name, n]) => ({
      name,
      path: normalize(path + '/' + name),
      node: n,
      dir: isDir(n),
      size: size(n),
      modified: n.m || 0,
      count: isDir(n) ? Object.keys(n.d).length : 0,
    }))
    .sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name, 'cs') : a.dir ? -1 : 1));
}

export function read(path) {
  const node = get(path);
  if (!node) throw new Error(`Soubor neexistuje: ${path}`);
  if (isDir(node)) throw new Error(`${path} je složka`);
  return node.c;
}

// ---------------------------------------------------------------- zápis
function parentOf(path) {
  const p = get(dirname(path));
  if (!isDir(p)) throw new Error(`Cesta neexistuje: ${dirname(path)}`);
  return p;
}

// Historie verzí (verze.js) se sem přihlásí: před přepsáním souboru dostane starý uzel a vrátí
// { meta: { id, verzeCas }, ulozit() } — nebo nic, když verzi teď ukládat nechce.
let hlidacZapisu = null;
export const nastavHlidaceZapisu = (fn) => { hlidacZapisu = fn; };
const META = ['tagy', 'barva', 'id', 'verzeCas'];   // přežijí uložení nového obsahu (stitky.js, verze.js)

/** o.snimek = verzi uložit vždy (např. před obnovením starší verze, ať jde vrátit). */
export function write(path, content = '', o = {}) {
  const p = parentOf(path);
  const name = basename(path);
  const cur = p.d[name];
  if (isDir(cur)) throw new Error(`${path} je složka`);
  const puvodniCas = p.m;
  const meta = cur ? Object.fromEntries(META.filter((k) => cur[k] !== undefined).map((k) => [k, cur[k]])) : {};
  let verze = null;
  if (hlidacZapisu && isFile(cur) && cur.c !== String(content)) {
    try { verze = hlidacZapisu(normalize(path), cur, o); } catch { verze = null; }
    if (verze) Object.assign(meta, verze.meta);
  }
  p.d[name] = { ...meta, c: String(content), m: Date.now() };
  p.m = Date.now();
  if (!save(path)) {
    // Disk je plný. Vrátíme strom do původního stavu, ať si paměť a
    // localStorage neodporují, a teprve pak řekneme, že to nešlo.
    if (cur) p.d[name] = cur; else delete p.d[name];
    p.m = puvodniCas;
    save(path);
    throw new Error('Na disku už není místo (úložiště prohlížeče je plné).');
  }
  verze?.ulozit();
  return p.d[name];
}

export function mkdir(path, { parents = false } = {}) {
  const n = normalize(path);
  if (exists(n)) throw new Error(`Už existuje: ${n}`);
  if (parents) {
    let cur = '';
    for (const seg of n.slice(1).split('/')) {
      cur += '/' + seg;
      if (!exists(cur)) parentOf(cur).d[seg] = dir();
    }
  } else {
    parentOf(n).d[basename(n)] = dir();
  }
  save(n);
}

export function remove(path, { toTrash = true } = {}) {
  const n = normalize(path);
  const node = get(n);
  if (!node) throw new Error(`Neexistuje: ${n}`);
  if (n === '/' || n === TRASH) throw new Error('Tohle smazat nejde');

  delete parentOf(n).d[basename(n)];
  if (toTrash && !n.startsWith(TRASH)) {
    const trash = get(TRASH);
    let name = basename(n);
    while (trash.d[name]) name = name.replace(/(\.[^.]+)?$/, (e) => '-1' + e);
    node._from = n;
    node._smazano = Date.now();   // pro „vysypávat koš po 30 dnech“ (uloziste.js)
    trash.d[name] = node;
  }
  save(n);
}

export function emptyTrash() {
  get(TRASH).d = {};
  save(TRASH);
}

export function restore(name) {
  const trash = get(TRASH);
  const node = trash.d[name];
  if (!node) return;
  const target = node._from || HOME + '/' + name;
  delete node._from;
  delete node._smazano;
  delete trash.d[name];
  try { parentOf(target).d[basename(target)] = node; }
  catch { get(HOME).d[basename(target)] = node; }
  save(target);
}

export function rename(path, newName) {
  const n = normalize(path);
  const p = parentOf(n);
  const old = basename(n);
  if (!p.d[old]) throw new Error(`Neexistuje: ${n}`);
  if (newName === old) return n;
  if (p.d[newName]) throw new Error(`Už existuje: ${newName}`);
  p.d[newName] = p.d[old];
  delete p.d[old];
  save(n);
  return normalize(dirname(n) + '/' + newName);
}

export function move(from, toDir) {
  const f = normalize(from), t = normalize(toDir);
  const node = get(f);
  if (!node) throw new Error(`Neexistuje: ${f}`);
  const target = get(t);
  if (!isDir(target)) throw new Error(`Není složka: ${t}`);
  if (t === f || t.startsWith(f + '/')) throw new Error('Složku nelze přesunout do sebe');
  if (dirname(f) === t) return f;
  const name = uniqueName(target, basename(f));
  delete parentOf(f).d[basename(f)];
  target.d[name] = node;
  save(t);
  return normalize(t + '/' + name);
}

export function copy(from, toDir) {
  const f = normalize(from), t = normalize(toDir);
  const node = get(f);
  if (!node) throw new Error(`Neexistuje: ${f}`);
  const target = get(t);
  if (!isDir(target)) throw new Error(`Není složka: ${t}`);
  if (isDir(node) && (t === f || t.startsWith(f + '/'))) throw new Error('Složku nelze zkopírovat do sebe');
  const name = uniqueName(target, basename(f));
  target.d[name] = JSON.parse(JSON.stringify(node));
  target.d[name].m = Date.now();
  // kopie je nový soubor — bez historie verzí originálu (verze.js)
  const bezId = (n) => { delete n.id; delete n.verzeCas; if (isDir(n)) Object.values(n.d).forEach(bezId); };
  bezId(target.d[name]);
  save(t);
  return normalize(t + '/' + name);
}

function uniqueName(parent, name) {
  if (!parent.d[name]) return name;
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  let i = 2;
  while (parent.d[`${base} (${i})${ext}`]) i++;
  return `${base} (${i})${ext}`;
}

/** Volné jméno pro novou položku ve složce. */
export function freeName(path, name) {
  return uniqueName(get(path), name);
}

// ---------------------------------------------------------------- uložení
/** Uloží celý strom; vrací false, když se do localStorage nevešel. */
export function save(changed = '/') {
  try {
    localStorage.setItem(KEY, JSON.stringify(root));
  } catch {
    return false;                       // plný disk — volající to musí ošetřit
  }
  bus.emit('fs:change', changed);
  return true;
}

export function resetDisk() {
  root = defaultTree();
  save('/');
}

const TOTAL = 2 * 1024 ** 4;              // „2 TB“
const SYSTEM_USED = 412.7 * 1024 ** 3;    // co zabírá systém (naoko)

export function usage() {
  const files = size(root);
  const used = SYSTEM_USED + files;
  return { used, files, total: TOTAL, percent: (used / TOTAL) * 100 };
}

// ---------------------------------------------------------------- typy souborů
const TYPES = {
  txt: { icon: 'fileText', color: '#8fa3ae', kind: 'Textový soubor', text: true },
  docx: { icon: 'pismo', color: '#185abd', kind: 'Dokument AstroPísma', text: true },
  md: { icon: 'fileText', color: '#7fb3d5', kind: 'Markdown', text: true },
  xlsx: { icon: 'tabulky', color: '#107c41', kind: 'Sešit AstroTabulek', text: true },
  csv: { icon: 'tabulky', color: '#6fbf8a', kind: 'Soubor CSV (hodnoty oddělené středníkem)', text: true },
  pptx: { icon: 'prezentace', color: '#c43e1c', kind: 'Prezentace AstroPrezentací', text: true },
  log: { icon: 'fileText', color: '#8fa3ae', kind: 'Záznam', text: true },
  js: { icon: 'code', color: '#e0c25c', kind: 'JavaScript', text: true },
  css: { icon: 'code', color: '#5aa9e6', kind: 'Styl', text: true },
  html: { icon: 'code', color: '#e08a5c', kind: 'Stránka', text: true },
  json: { icon: 'code', color: '#c99adf', kind: 'Data', text: true },
  png: { icon: 'image', color: '#a077f0', kind: 'Obrázek', image: true },
  jpg: { icon: 'image', color: '#a077f0', kind: 'Obrázek', image: true },
  webp: { icon: 'image', color: '#a077f0', kind: 'Obrázek', image: true },
  svg: { icon: 'image', color: '#6fd4a8', kind: 'Obrázek SVG', image: true, text: true },
  mp3: { icon: 'music', color: '#ef6f8e', kind: 'Zvuk MP3', audio: true },
  webm: { icon: 'mic', color: '#ef6a5a', kind: 'Zvuková nahrávka', audio: true },
  ogg: { icon: 'mic', color: '#ef6a5a', kind: 'Zvuková nahrávka', audio: true },
  m4a: { icon: 'mic', color: '#ef6a5a', kind: 'Zvuková nahrávka', audio: true },
  wav: { icon: 'music', color: '#ef6f8e', kind: 'Zvuk WAV', audio: true },
  iso: { icon: 'hdd', color: '#7d8b96', kind: 'Obraz disku' },
  zip: { icon: 'box', color: '#d9a43a', kind: 'Komprimovaná složka (ZIP)' },
  pdf: { icon: 'fileText', color: '#d9463a', kind: 'Dokument PDF' },
  a3d: { icon: 'b3krychle', color: '#e8873a', kind: 'Scéna Astro 3D' },
  obj: { icon: 'b3krychle', color: '#5aa9e6', kind: '3D model OBJ', text: true },
};

export function fileInfo(name) {
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '';
  return TYPES[ext] || { icon: 'fileText', color: '#7d8b96', kind: ext ? `Soubor ${ext.toUpperCase()}` : 'Soubor', text: true };
}

export const isText = (name) => !!fileInfo(name).text;
export const isImage = (name) => !!fileInfo(name).image;
export const isAudio = (name) => !!fileInfo(name).audio;

/** Adresa použitelná v <audio src> (nahrávky se ukládají jako dataURL), nebo null. */
export function audioSrc(path) {
  if (!isAudio(basename(path))) return null;
  let c;
  try { c = read(path); } catch { return null; }
  return c.startsWith('data:audio/') || c.startsWith('data:video/webm') ? c : null;
}

/** Adresa použitelná v <img src>, nebo null když soubor obrázek není. */
export function imageSrc(path) {
  const name = basename(path);
  if (!isImage(name)) return null;
  let c;
  try { c = read(path); } catch { return null; }
  if (c.startsWith('astro-img:')) return c.slice(10);
  if (c.startsWith('data:')) return c;
  if (c.trimStart().startsWith('<svg')) return 'data:image/svg+xml;utf8,' + encodeURIComponent(c);
  return null;
}

/** Projde disk a vrátí všechny obrázky pod danou cestou. */
export function findImages(root = HOME) {
  const out = [];
  const walk = (p) => {
    let items;
    try { items = list(p); } catch { return; }
    for (const it of items) {
      if (it.dir) walk(it.path);
      else if (isImage(it.name) && imageSrc(it.path)) out.push(it);
    }
  };
  walk(root);
  return out;
}

export function humanSize(bytes) {
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} kB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes < 1024 ** 4) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  return `${(bytes / 1024 ** 4).toFixed(2)} TB`;
}

export const FS = {
  HOME, TRASH, get, list, read, write, mkdir, remove, rename, move, copy,
  exists, isDir, isFile, normalize, dirname, basename, size, humanSize,
  freeName, emptyTrash, restore, resetDisk, usage, fileInfo, isText, save,
  isImage, imageSrc, findImages, isAudio, audioSrc,
};
