// AstroOS — plocha: zástupci aplikací + obsah složky ~/Plocha, tažení, výběr, nabídky
//
// Jako ve Windows je plocha zároveň složka: soubory a složky z ~/Plocha se tu ukazují
// jako ikony (fotky s náhledem), jdou otevírat, přejmenovat, mazat, táhnout do složek,
// do koše i do oken Souborů. Zástupci aplikací mají šipku a dají se smazat (systémové ikony ne).
// Id ikon: aplikace = její id, soubor = 'f:' + cesta. Pozice v nastavení `iconPos`.

import { $, el, clamp, drag, bus } from './util.js';
import { icon, glyfAplikace } from './icons.js';
import { State } from './state.js';
import * as FS from './fs.js';
import { APPS, openApp, prepniPin, jePripnuto } from './apps.js';
import { contextMenu, toast, closeMenu } from './ui.js';
import { wallpaperList, applyWallpaper, vyberTapetuZPocitace } from './wallpapers.js';
import { minimizeAll } from './wm.js';
import { panelMisto, mrizkaIkon } from './vzhled.js';
import { initWidgety, nabidkaWidgetu } from './widgety.js';
import {
  PLOCHA, otevri, glyfSouboru, druhSouboru, schranka, doSchranky, vloz, presun, doKose,
  jeKosPrazdny, nabidkaNovy, vlastnosti,
} from './soubory.js';
import { registrujPlochu, najdiCil, zvyrazni } from './prenos.js';
import { tx, jazykTed } from './i18n.js';

const PAD_X = 12, PAD_Y = 12;
const CELL = () => mrizkaIkon();

const DEFAULT_ICONS = ['computer', 'files', 'trash', 'terminal', 'notes', 'astroai', 'browser', 'settings'];
const SYSTEMOVE = ['computer', 'trash'];

const nodes = new Map();   // id → element
const selected = new Set();
let aktivni = false;       // plocha má „fokus“ (poslední klik byl na ni) — pro klávesy
let podpis = '';

const cols = () => Math.max(1, Math.floor((innerWidth - PAD_X) / CELL().w));
const rows = () => Math.max(1, Math.floor((innerHeight - panelMisto() - PAD_Y) / CELL().h));
const cestaZId = (id) => (id.startsWith('f:') ? id.slice(2) : null);
const layer = () => $('#icons');

let navazano = false;
export function initDesktop() {
  const l = layer();
  l.innerHTML = '';
  nodes.clear();
  selected.clear();
  l.classList.toggle('skryte', !!State.get('skrytIkony'));
  podpis = podpisPlochy();
  doplnIkony();
  if (!navazano) {
    navazano = true;
    l.addEventListener('pointerdown', onBandStart);
    l.addEventListener('contextmenu', onDesktopMenu);
  }
  initWidgety();
}

// ---------------------------------------------------------------- co je na ploše
function zakladniZastupci() {
  const z = State.get('plochaIkony');
  return Array.isArray(z) ? z : DEFAULT_ICONS;
}

const zastupci = () => [...new Set([...zakladniZastupci(), ...(State.get('plochaAplikace') || [])])].filter((id) => APPS[id]);
export const jeNaPlose = (id) => zastupci().includes(id);

function souboryPlochy() {
  if (!FS.isDir(FS.get(PLOCHA))) {
    try { FS.mkdir(PLOCHA, { parents: true }); } catch { return []; }
  }
  return FS.list(PLOCHA);
}

function polozky() {
  return [
    ...zastupci().map((id) => ({ id, app: APPS[id] })),
    ...souboryPlochy().map((s) => ({ id: 'f:' + s.path, soubor: s })),
  ];
}

function podpisPlochy() {
  try {
    return JSON.stringify(FS.list(PLOCHA).map((i) => [i.name, i.modified, i.count])) + jeKosPrazdny();
  } catch { return ''; }
}

/** Přidá chybějící ikony (nové dostanou první volnou buňku), odebere ty, co už nemají být. */
function doplnIkony() {
  const l = layer();
  if (!l) return;
  const vsechny = polozky();
  const chci = new Set(vsechny.map((p) => p.id));
  for (const [id, n] of nodes) {
    if (!chci.has(id)) { n.remove(); nodes.delete(id); selected.delete(id); }
  }
  const pos = { ...State.get('iconPos') };
  for (const id of Object.keys(pos)) if (id.startsWith('f:') && !chci.has(id)) delete pos[id];
  let auto = 0;
  const taken = new Set(Object.entries(pos).filter(([id]) => chci.has(id)).map(([, p]) => `${p.col},${p.row}`));
  for (const p of vsechny) {
    if (!pos[p.id]) {
      while (taken.has(`${Math.floor(auto / rows())},${auto % rows()}`)) auto++;
      pos[p.id] = { col: Math.floor(auto / rows()), row: auto % rows() };
      taken.add(`${pos[p.id].col},${pos[p.id].row}`);
      auto++;
    }
    const stary = nodes.get(p.id);
    const novy = makeIcon(p, pos[p.id]);
    if (stary) stary.replaceWith(novy); else l.append(novy);
  }
  State.set('iconPos', pos);
}

function prekresli() {
  podpis = podpisPlochy();
  doplnIkony();
}

bus.on('aplikace', () => { if (nodes.size) prekresli(); });
bus.on('fs:change', () => {
  if (!nodes.size) return;
  const p = podpisPlochy();
  if (p !== podpis) { podpis = p; doplnIkony(); }
});

export function pridejNaPlochu(id, bunka) {
  State.set('plochaIkony', [...zakladniZastupci().filter((x) => x !== id), id]);
  if (bunka) {
    const pos = { ...State.get('iconPos') };
    pos[id] = freeCell(bunka.col, bunka.row, id, pos);
    State.set('iconPos', pos);
  }
  prekresli();
}

export function odeberZPlochy(id) {
  if (SYSTEMOVE.includes(id)) return;
  State.set('plochaIkony', zakladniZastupci().filter((x) => x !== id));
  State.set('plochaAplikace', (State.get('plochaAplikace') || []).filter((x) => x !== id));
  const pos = { ...State.get('iconPos') };
  delete pos[id];
  State.set('iconPos', pos);
  prekresli();
}

// ---------------------------------------------------------------- ikony
function place(node, p) {
  node.style.left = (PAD_X + p.col * CELL().w) + 'px';
  node.style.top = (PAD_Y + p.row * CELL().h) + 'px';
}

function bunkaZBodu({ x, y }) {
  return {
    col: clamp(Math.floor((x - PAD_X) / CELL().w), 0, cols() - 1),
    row: clamp(Math.floor((y - PAD_Y) / CELL().h), 0, rows() - 1),
  };
}

function popisek(p) {
  if (p.soubor) return p.soubor.name;
  return State.get('iconNames')[p.id] || p.app.name;
}

function makeIcon(p, pos) {
  const { id, soubor } = p;
  let glyph;
  if (soubor) {
    glyph = el('div.glyph', {}, glyfSouboru(soubor.path, soubor.node));
  } else {
    const ic = id === 'trash' && !jeKosPrazdny() ? 'trashFull' : p.app.icon;
    glyph = glyfAplikace(p.app, 'div.glyph', { ikona: ic,
      deti: [SYSTEMOVE.includes(id) ? null : el('span.dicon-sipka', {}, icon('sipkaZastupce'))] });
  }
  const data = { id };
  if (soubor) {
    data.cesta = soubor.path;
    if (soubor.dir) data.slozka = '1';
  }
  // názvy souborů jsou uživatelská data — nepřekládají se (zástupci aplikací ano)
  const node = el('div.dicon' + (soubor ? '.soubor' : '') + (selected.has(id) ? '.sel' : ''), { dataset: data },
    glyph, el('div.label', { text: popisek(p), 'data-no-i18n': !!soubor }));
  if (soubor) {
    node.title = `${soubor.name}\nTyp: ${druhSouboru(soubor.path)}\n`
      + (soubor.dir ? `Obsahuje: ${soubor.count} položek` : `Velikost: ${FS.humanSize(soubor.size)}`)
      + `\nZměněno: ${new Date(soubor.modified).toLocaleString(jazykTed() === 'en' ? 'en-US' : 'cs')}`;
  }
  place(node, pos);

  node.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    aktivni = true;
    closeMenu();
    if (e.button === 2) { if (!selected.has(id)) select(id, false); return; }
    const pridat = e.ctrlKey || e.shiftKey;
    if (pridat) select(id, true);
    else if (!selected.has(id)) select(id, false);
    // už označenou ikonu výběr neruší — jinak by nešlo táhnout celou skupinu
    if (selected.has(id)) startDrag(node, id, e, pridat);
  });
  node.addEventListener('dblclick', () => spust(id));
  node.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    menuIkony(p, node, e);
  });

  nodes.set(id, node);
  return node;
}

function spust(id) {
  const node = nodes.get(id);
  node?.classList.add('launch');
  setTimeout(() => node?.classList.remove('launch'), 340);
  const cesta = cestaZId(id);
  if (cesta) otevri(cesta);
  else openApp(id);
}

function select(id, add) {
  if (!add) { selected.forEach((s) => nodes.get(s)?.classList.remove('sel')); selected.clear(); }
  if (selected.has(id) && add) { selected.delete(id); nodes.get(id)?.classList.remove('sel'); return; }
  selected.add(id);
  nodes.get(id)?.classList.add('sel');
}

export function clearSelection() {
  selected.forEach((s) => nodes.get(s)?.classList.remove('sel'));
  selected.clear();
}

/** Soubory, kterých se týká akce na ikoně id (celý výběr, pokud je v něm). */
function cestyAkce(id) {
  const ids = selected.has(id) ? [...selected] : [id];
  return ids.map(cestaZId).filter(Boolean);
}

function smazVyber(ids = [...selected]) {
  const cesty = ids.map(cestaZId).filter(Boolean);
  if (cesty.length) doKose(cesty);
  ids.filter((id) => !cestaZId(id)).forEach(odeberZPlochy);
}

// ---------------------------------------------------------------- přejmenování
function rename(id) {
  const node = nodes.get(id);
  if (!node) return;
  const cesta = cestaZId(id);
  const label = node.querySelector('.label');
  const puvodni = label.textContent;
  const input = el('textarea.rename', { spellcheck: 'false', rows: 1 });
  input.value = puvodni;
  label.replaceWith(input);
  input.focus();
  const tecka = puvodni.lastIndexOf('.');
  input.setSelectionRange(0, cesta && tecka > 0 && !FS.isDir(FS.get(cesta)) ? tecka : puvodni.length);

  let hotovo = false;
  const done = (save) => {
    if (hotovo) return;
    hotovo = true;
    const v = input.value.trim().replace(/\n/g, ' ');
    if (cesta) {
      input.replaceWith(label);
      if (!save || !v || v === puvodni) return;
      if (/[/\\]/.test(v)) return toast({ title: 'Neplatný název', body: 'Název nesmí obsahovat lomítko.', icon: 'info' });
      const nova = FS.normalize(FS.dirname(cesta) + '/' + v);
      const pos = { ...State.get('iconPos') };      // ikona zůstane na svém místě
      if (pos[id]) { pos['f:' + nova] = pos[id]; State.set('iconPos', pos); }
      try { FS.rename(cesta, v); } catch (e) { toast({ title: 'Přejmenování selhalo', body: e.message, icon: 'info' }); }
      return;
    }
    const names = { ...State.get('iconNames') };
    // beze změny nic neukládat — popisek může být přeložený název aplikace
    if (save && v && v !== puvodni) names[id] = v; else if (save && !v) delete names[id];
    State.set('iconNames', names);
    label.textContent = names[id] || APPS[id].name;
    input.replaceWith(label);
  };
  input.onblur = () => done(true);
  input.onkeydown = (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); done(true); }
    if (e.key === 'Escape') done(false);
  };
}

// ---------------------------------------------------------------- tažení ikon
function startDrag(node, id, e, pridat = false) {
  if (e.button !== 0) return;
  const startX = e.clientX, startY = e.clientY;

  const skupina = selected.size > 1 ? [...selected] : [id];
  const items = skupina
    .map((gid) => nodes.get(gid))
    .filter(Boolean)
    .map((n) => ({
      node: n,
      id: n.dataset.id,
      base: { left: parseInt(n.style.left, 10), top: parseInt(n.style.top, 10) },
    }));
  const cesty = items.map((i) => cestaZId(i.id)).filter(Boolean);

  const minL = Math.min(...items.map((i) => i.base.left));
  const maxL = Math.max(...items.map((i) => i.base.left));
  const minT = Math.min(...items.map((i) => i.base.top));
  const maxT = Math.max(...items.map((i) => i.base.top));
  let moved = false;
  let cil = null;

  const step = (ev) => {
    const dx = ev.clientX - startX, dy = ev.clientY - startY;
    if (!moved && Math.hypot(dx, dy) < 5) return;
    if (!moved) {
      moved = true;
      items.forEach((i) => i.node.classList.add('dragging'));
    }
    // mimo plochu (nad oknem) ikony nechávají pozici u okraje, cíl hledáme pod kurzorem
    const cdx = clamp(dx, -minL, innerWidth - CELL().w - maxL);
    const cdy = clamp(dy, -minT, innerHeight - panelMisto() - CELL().h - maxT);
    for (const i of items) {
      i.node.style.left = (i.base.left + cdx) + 'px';
      i.node.style.top = (i.base.top + cdy) + 'px';
    }
    cil = najdiCil(ev.clientX, ev.clientY, cesty);
    if (cil?.typ === 'slozka' && !cesty.length) cil = null;       // aplikace do složek nejdou
    zvyrazni(cil?.typ === 'plocha' ? null : cil);
  };

  drag(step, (ev) => {
    if (!moved) {
      if (!pridat && selected.size > 1) select(id, false);
      return;
    }
    step(ev);
    zvyrazni(null);
    items.forEach((i) => i.node.classList.remove('dragging'));

    const zpet = () => items.forEach((i) => { i.node.style.left = i.base.left + 'px'; i.node.style.top = i.base.top + 'px'; });
    if (cil && (cil.typ === 'kos' || cil.typ === 'slozka' || cil.typ === 'nejde')) {
      zpet();
      if (cil.typ === 'kos') smazVyber(items.map((i) => i.id));
      else if (cil.typ === 'slozka' && !cil.stejna) presun(cesty, cil.cesta, { kopie: ev.ctrlKey });
      return;
    }

    const pos = { ...State.get('iconPos') };
    for (const i of items) delete pos[i.id];
    for (const i of items) {
      const col = clamp(Math.round((parseInt(i.node.style.left, 10) - PAD_X) / CELL().w), 0, cols() - 1);
      const row = clamp(Math.round((parseInt(i.node.style.top, 10) - PAD_Y) / CELL().h), 0, rows() - 1);
      const cell = freeCell(col, row, i.id, pos);
      pos[i.id] = cell;
      place(i.node, cell);
    }
    State.set('iconPos', pos);
  });
}

/** Najde nejbližší volnou buňku (spirálou od cílové). */
function freeCell(col, row, id, pos) {
  // jen buňky, na kterých opravdu něco je — uložená poloha odstraněné ikony nesmí držet prázdné místo
  const jsou = new Set(polozky().map((p) => p.id));
  const busy = new Set(Object.entries(pos).filter(([k]) => k !== id && (nodes.has(k) || jsou.has(k)))
    .map(([, p]) => `${p.col},${p.row}`));
  if (!busy.has(`${col},${row}`)) return { col, row };
  for (let r = 1; r < 30; r++) {
    for (let dc = -r; dc <= r; dc++) {
      for (let dr = -r; dr <= r; dr++) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== r) continue;
        const c = col + dc, rr = row + dr;
        if (c < 0 || rr < 0 || c >= cols() || rr >= rows()) continue;
        if (!busy.has(`${c},${rr}`)) return { col: c, row: rr };
      }
    }
  }
  return { col, row };
}

/** Umístí soubory/aplikaci přetažené odjinud (Soubory, Fotky, Start) na místo puštění. */
function umisti({ cesty = [], aplikace, kopie, bod }) {
  const bunka = bunkaZBodu(bod);
  if (aplikace) return pridejNaPlochu(aplikace, bunka);
  let kam = bunka;
  for (const c of cesty) {
    if (!FS.exists(c)) continue;
    if (!kopie && FS.dirname(c) === PLOCHA) continue;
    // jméno spočítáme dopředu, ať ikona přistane tam, kde se pustila
    const nova = FS.normalize(PLOCHA + '/' + FS.freeName(PLOCHA, FS.basename(c)));
    const pos = { ...State.get('iconPos') };
    pos['f:' + nova] = freeCell(kam.col, kam.row, 'f:' + nova, pos);
    kam = pos['f:' + nova];
    State.set('iconPos', pos);
    presun([c], PLOCHA, { kopie });
  }
}
registrujPlochu({ umisti });

// ---------------------------------------------------------------- řazení
const RAZENI = {
  nazev: (a, b) => a.label.localeCompare(b.label, 'cs'),
  velikost: (a, b) => (b.soubor?.size || 0) - (a.soubor?.size || 0),
  typ: (a, b) => a.druh.localeCompare(b.druh, 'cs') || a.label.localeCompare(b.label, 'cs'),
  datum: (a, b) => (b.soubor?.modified || 0) - (a.soubor?.modified || 0),
};

export function seradPodle(krit = 'nazev') {
  const vse = polozky().map((p) => ({
    ...p, label: popisek(p),
    druh: p.soubor ? druhSouboru(p.soubor.path) : 'Zástupce',
    skupina: SYSTEMOVE.includes(p.id) ? 0 : p.app ? 1 : p.soubor.dir ? 2 : 3,
  }));
  vse.sort((a, b) => a.skupina - b.skupina || (a.skupina === 0 ? SYSTEMOVE.indexOf(a.id) - SYSTEMOVE.indexOf(b.id) : RAZENI[krit](a, b)));
  const pos = {};
  vse.forEach((p, i) => { pos[p.id] = { col: Math.floor(i / rows()), row: i % rows() }; });
  State.set('iconPos', pos);
  prekresli();
}
export const arrangeIcons = () => seradPodle('nazev');

// ---------------------------------------------------------------- označovací rámeček
function onBandStart(e) {
  aktivni = true;
  if (e.button !== 0 || e.target.closest('.dicon')) return;
  clearSelection();
  closeMenu();
  const band = $('#band');
  const x0 = e.clientX, y0 = e.clientY;
  let active = false;

  drag((ev) => {
    if (!active && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return;
    if (!active) { active = true; band.classList.remove('hidden'); }
    const x = Math.min(x0, ev.clientX), y = Math.min(y0, ev.clientY);
    const w = Math.abs(ev.clientX - x0), h = Math.abs(ev.clientY - y0);
    Object.assign(band.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });

    for (const [id, node] of nodes) {
      const r = node.getBoundingClientRect();
      const hit = r.left < x + w && r.right > x && r.top < y + h && r.bottom > y;
      node.classList.toggle('sel', hit);
      if (hit) selected.add(id); else selected.delete(id);
    }
  }, () => band.classList.add('hidden'));
}

// ---------------------------------------------------------------- nabídky
function menuIkony(p, node, e) {
  const { id, soubor } = p;
  if (!selected.has(id)) select(id, false);
  const at = { x: e.clientX, y: e.clientY };

  if (soubor) {
    const cesty = cestyAkce(id);
    const obrazek = !soubor.dir && FS.isImage(soubor.name) && FS.imageSrc(soubor.path);
    const odeslat = (nazev, slozka) => ({
      icon: 'folder', label: nazev,
      onClick: () => { presun(cesty, FS.HOME + '/' + slozka, { kopie: true }); toast({ title: `Zkopírováno do ${nazev}`, icon: 'copy', timeout: 2200 }); },
    });
    return contextMenu([
      { icon: soubor.dir ? 'folderOpen' : 'arrowRight', label: 'Otevřít', key: 'Enter', onClick: () => cesty.forEach(otevri) },
      obrazek ? { icon: 'palette', label: 'Nastavit jako pozadí plochy', onClick: () => nastavTapetu(soubor) } : null,
      obrazek ? { icon: 'brush', label: 'Upravit v Malování', onClick: () => openApp('malovani', { path: soubor.path }) } : null,
      !soubor.dir && /\.(html?|css|js|json|md|txt)$/i.test(soubor.name)
        ? { icon: 'code', label: 'Upravit v Editoru kódu', onClick: () => openApp('editor', { path: soubor.path }) } : null,
      'sep',
      { icon: 'cut', label: 'Vyjmout', key: 'Ctrl+X', onClick: () => doSchranky('cut', cesty) },
      { icon: 'copy', label: 'Kopírovat', key: 'Ctrl+C', onClick: () => doSchranky('copy', cesty) },
      soubor.dir && schranka.cesty.length ? { icon: 'paste', label: 'Vložit do složky', onClick: () => vloz(soubor.path) } : null,
      'sep',
      { icon: 'send', label: 'Odeslat do', sub: [odeslat('Dokumenty', 'Dokumenty'), odeslat('Obrázky', 'Obrázky'), odeslat('Stažené', 'Stažené')] },
      { icon: 'shield', label: 'Zkontrolovat pomocí Astro Defenderu', onClick: () => openApp('defender', { stranka: 'viry', kontrola: { typ: 'vlastni', cesta: soubor.path } }) },
      'sep',
      { icon: 'notes', label: 'Přejmenovat', key: 'F2', disabled: cesty.length > 1, onClick: () => rename(id) },
      { icon: 'trash', label: 'Odstranit', key: 'Del', danger: true, onClick: () => smazVyber(selected.has(id) ? [...selected] : [id]) },
      'sep',
      { icon: 'info', label: 'Vlastnosti', key: 'Alt+Enter', onClick: () => vlastnosti(soubor.path) },
    ], at);
  }

  if (id === 'trash') {
    return contextMenu([
      { icon: 'folderOpen', label: 'Otevřít', onClick: () => spust(id) },
      { icon: 'trash', label: 'Vysypat koš', danger: true, disabled: jeKosPrazdny(), onClick: () => { FS.emptyTrash(); toast({ title: 'Koš vysypán', icon: 'trash' }); } },
      'sep',
      { icon: 'notes', label: 'Přejmenovat', key: 'F2', onClick: () => rename(id) },
    ], at);
  }

  const a = APPS[id];
  contextMenu([
    { icon: 'arrowRight', label: 'Otevřít', key: 'Enter', onClick: () => spust(id) },
    id === 'computer' ? { icon: 'cpu', label: 'Spravovat', onClick: () => openApp('monitor') } : null,
    'sep',
    {
      icon: 'pin',
      label: jePripnuto('pinyPanel', id) ? 'Odepnout z hlavního panelu' : 'Připnout na hlavní panel',
      onClick: () => {
        const pripnuto = prepniPin('pinyPanel', id);
        bus.emit('piny', 'pinyPanel');
        toast({ title: pripnuto ? 'Připnuto na panel' : 'Odepnuto z panelu', body: a.name, icon: 'pin', timeout: 2200 });
      },
    },
    {
      icon: 'star',
      label: jePripnuto('pinyStart', id) ? 'Odepnout ze Startu' : 'Připnout do Startu',
      onClick: () => { prepniPin('pinyStart', id); bus.emit('piny', 'pinyStart'); },
    },
    ...(a.uzivatelska ? [
      'sep',
      { icon: 'code', label: 'Upravit v Editoru', onClick: () => openApp('editor', { path: a.slozka + '/index.html' }) },
      { icon: 'trash', label: 'Odinstalovat', danger: true, onClick: () => import('./aplikace.js').then((m) => m.odinstaluj(id)) },
    ] : []),
    'sep',
    { icon: 'notes', label: 'Přejmenovat', key: 'F2', onClick: () => rename(id) },
    SYSTEMOVE.includes(id) ? null : { icon: 'trash', label: 'Odstranit zástupce', key: 'Del', danger: true, onClick: () => smazVyber(selected.has(id) ? [...selected] : [id]) },
    'sep',
    { icon: 'info', label: 'Vlastnosti', onClick: () => openApp('about') },
  ], at);
}

function nastavTapetu(soubor) {
  const src = FS.imageSrc(soubor.path);
  if (!src) return;
  State.patch({ customWallpaper: src, customWallpaperName: soubor.name, wallpaper: 'vlastni' });
  applyWallpaper('vlastni');
  toast({ title: 'Pozadí plochy změněno', body: soubor.name, icon: 'image' });
}

/** Nová položka z nabídky: přistane na místě kliknutí a hned se přejmenovává. */
function umistiNovou(cesta, bunka) {
  const id = 'f:' + cesta;
  const pos = { ...State.get('iconPos') };
  pos[id] = freeCell(bunka.col, bunka.row, id, pos);
  State.set('iconPos', pos);
  const n = nodes.get(id);
  if (n) place(n, pos[id]);
  select(id, false);
  setTimeout(() => rename(id), 30);
}

function vlozNaPlochu(bunka) {
  const pred = new Set(nodes.keys());
  const nove = vloz(PLOCHA);
  if (!bunka || !nove.length) return;
  const pos = { ...State.get('iconPos') };
  let kam = bunka;
  for (const c of nove) {
    const id = 'f:' + c;
    if (pred.has(id)) continue;
    pos[id] = freeCell(kam.col, kam.row, id, pos);
    kam = pos[id];
    const n = nodes.get(id);
    if (n) place(n, pos[id]);
  }
  State.set('iconPos', pos);
}

function onDesktopMenu(e) {
  if (e.target.closest('.dicon')) return;
  e.preventDefault();
  clearSelection();
  const bunka = bunkaZBodu({ x: e.clientX, y: e.clientY });
  const velikost = State.get('ikony') || 'stredni';
  const skryte = !!State.get('skrytIkony');
  const tapeta = State.get('wallpaper');
  const zaskrtnuto = (ano) => (ano ? 'check' : null);

  contextMenu([
    { icon: 'grid', label: 'Zobrazit', sub: [
      { icon: zaskrtnuto(velikost === 'velke'), label: 'Velké ikony', onClick: () => State.set('ikony', 'velke') },
      { icon: zaskrtnuto(velikost === 'stredni'), label: 'Střední ikony', onClick: () => State.set('ikony', 'stredni') },
      { icon: zaskrtnuto(velikost === 'male'), label: 'Malé ikony', onClick: () => State.set('ikony', 'male') },
      'sep',
      { icon: zaskrtnuto(!skryte), label: 'Zobrazit ikony na ploše', onClick: () => { State.set('skrytIkony', !skryte); layer().classList.toggle('skryte', !skryte); } },
    ] },
    { icon: 'sort', label: 'Seřadit podle', sub: [
      { label: 'Název', onClick: () => seradPodle('nazev') },
      { label: 'Velikost', onClick: () => seradPodle('velikost') },
      { label: 'Typ položky', onClick: () => seradPodle('typ') },
      { label: 'Datum změny', onClick: () => seradPodle('datum') },
    ] },
    { icon: 'refresh', label: tx('Obnovit', 'Refresh'), key: 'F5', onClick: obnov },
    'sep',
    { icon: 'paste', label: 'Vložit', key: 'Ctrl+V', disabled: !schranka.cesty.length, onClick: () => vlozNaPlochu(bunka) },
    'sep',
    { icon: 'plus', label: 'Nový', sub: nabidkaNovy(PLOCHA, (c) => umistiNovou(c, bunka)) },
    'sep',
    { icon: 'palette', label: 'Změnit pozadí', sub: [...Object.entries(wallpaperList()).map(([wid, w]) => ({
      icon: wid === tapeta ? 'check' : 'image',
      label: w.name,
      onClick: () => { State.set('wallpaper', wid); applyWallpaper(wid); },
    })), 'sep', { icon: 'plus', label: 'Z tohoto počítače…', onClick: () => vyberTapetuZPocitace() }] },
    { icon: 'grid', label: 'Přidat widget…', onClick: () => nabidkaWidgetu({ x: e.clientX, y: e.clientY }) },
    { icon: 'monitor', label: 'Zobrazit plochu', key: 'Win+D', onClick: minimizeAll },
    'sep',
    { icon: 'terminal', label: 'Otevřít v terminálu', onClick: () => openApp('terminal', { cwd: PLOCHA }) },
    { icon: 'settings', label: 'Přizpůsobit', onClick: () => openApp('settings', { section: 'vzhled' }) },
  ], { x: e.clientX, y: e.clientY });
}

function obnov() {
  prekresli();
  const l = layer();
  l.classList.remove('obnova');
  void l.offsetWidth;
  l.classList.add('obnova');
}

bus.on('state:wallpaper', (id) => applyWallpaper(id));

// ---------------------------------------------------------------- klávesnice
addEventListener('pointerdown', (e) => {
  if (!e.target.closest?.('#icons')) aktivni = false;
}, true);

addEventListener('keydown', (e) => {
  if (!aktivni || $('#desktop')?.classList.contains('hidden')) return;
  if (e.target.closest?.('input, textarea, [contenteditable]')) return;
  const ids = [...selected];
  const cesty = ids.map(cestaZId).filter(Boolean);
  const k = e.key;

  if (k === 'Delete' && ids.length) { e.preventDefault(); smazVyber(ids); }
  else if (k === 'F2' && ids.length === 1) { e.preventDefault(); rename(ids[0]); }
  else if (k === 'Enter' && e.altKey && cesty.length === 1) { e.preventDefault(); vlastnosti(cesty[0]); }
  else if (k === 'Enter' && ids.length) { e.preventDefault(); ids.forEach(spust); }
  else if (k === 'F5') { e.preventDefault(); obnov(); }
  else if (k === 'Escape') clearSelection();
  else if (e.ctrlKey && k.toLowerCase() === 'a') {
    e.preventDefault();
    for (const id of nodes.keys()) { selected.add(id); nodes.get(id).classList.add('sel'); }
  } else if (e.ctrlKey && k.toLowerCase() === 'c' && cesty.length) doSchranky('copy', cesty);
  else if (e.ctrlKey && k.toLowerCase() === 'x' && cesty.length) doSchranky('cut', cesty);
  else if (e.ctrlKey && k.toLowerCase() === 'v') { e.preventDefault(); vlozNaPlochu(null); }
});

addEventListener('resize', () => {
  // po zmenšení okna se ikony vejdou zpět do mřížky (uložené pozice zůstanou)
  const pos = State.get('iconPos');
  for (const [id, node] of nodes) {
    if (!pos[id]) continue;
    place(node, {
      col: clamp(pos[id].col, 0, cols() - 1),
      row: clamp(pos[id].row, 0, rows() - 1),
    });
  }
});
