// AstroOS — nabídka Start (mřížka připnutých + všechny aplikace po kategoriích)

import { el, bus } from './util.js';
import { icon, glyfAplikace } from './icons.js';
import { State } from './state.js';
import { APPS, CATEGORIES, startPins, prepniPin, jePripnuto, appList, openApp } from './apps.js';
import { closePopup, contextMenu, toast } from './ui.js';
import { jeNaPlose, pridejNaPlochu, odeberZPlochy } from './desktop.js';
import { tahni } from './prenos.js';
import { t } from './i18n.js';
import { cekaNaRestart } from './aktualizace.js';
import * as Ucty from './ucty.js';

let lastCat = 'fav';

/** Položka nabídky „Přidat na plochu / Odebrat z plochy“. */
function polozkaPlochy(a) {
  if (a.launch || a.hidden) return null;
  const naPlose = jeNaPlose(a.id);
  return {
    icon: 'monitor',
    label: naPlose ? 'Odebrat z plochy' : 'Přidat na plochu',
    onClick: () => {
      if (naPlose) odeberZPlochy(a.id); else pridejNaPlochu(a.id);
      toast({ title: naPlose ? 'Odebráno z plochy' : 'Zástupce přidán na plochu', body: a.name, icon: 'monitor', timeout: 2200 });
    },
  };
}

/** Aplikaci jde ze Startu přetáhnout na plochu — vznikne zástupce tam, kde se pustí. */
function tahniAplikaci(prvek, a) {
  prvek.addEventListener('pointerdown', (e) => tahni(e, {
    aplikace: a.id,
    nahled: glyfAplikace(a, 'div.glyph.pr-app'),
    zacatek: () => closePopup(),
  }));
}

export function buildStartMenu() {
  const wrap = el('div.start');

  // ---------- hledání ----------
  const input = el('input', { placeholder: 'Hledat aplikace a nastavení', spellcheck: 'false' });
  const search = el('div.start-search', {}, icon('search'), input);

  // ---------- přepínač zobrazení ----------
  const headTitle = el('span', { text: 'Připnuté' });
  const toggle = el('button', {}, el('span', { text: 'Všechny aplikace' }), icon('chevronRight'));
  const head = el('div.start-head', {}, headTitle, toggle);

  const body = el('div.start-body');
  let mode = 'pinned';

  const render = () => {
    body.innerHTML = '';
    const q = input.value.trim().toLowerCase();
    if (q) {
      headTitle.textContent = 'Výsledky hledání';
      toggle.style.visibility = 'hidden';
      body.append(searchView(q));
      return;
    }
    toggle.style.visibility = '';
    if (mode === 'pinned') {
      headTitle.textContent = 'Připnuté';
      toggle.replaceChildren(el('span', { text: 'Všechny aplikace' }), icon('chevronRight'));
      body.append(pinnedView());
    } else {
      headTitle.textContent = 'Všechny aplikace';
      toggle.replaceChildren(icon('chevronLeft'), el('span', { text: 'Zpět' }));
      body.append(allAppsView());
    }
  };

  toggle.onclick = () => { mode = mode === 'pinned' ? 'all' : 'pinned'; render(); };
  input.oninput = render;
  input.onkeydown = (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      const first = body.querySelector('.app-row, .pin');
      first?.click();
    }
    if (e.key === 'Escape') { if (input.value) { input.value = ''; render(); } else closePopup(); }
  };

  // ---------- patička ----------
  const user = State.get('user');
  const userBtn = el('button.start-user', {},
    el('div.av', { text: user.avatar || user.name[0] }),
    el('div.n', { text: user.name }),
  );
  userBtn.onclick = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    contextMenu([
      { icon: 'settings', label: 'Změnit nastavení účtu', onClick: () => { closePopup(); openApp('settings', { section: 'ucet' }); } },
      { icon: 'lock', label: 'Uzamknout', key: 'Win+L', onClick: () => power('lock') },
      { icon: 'logout', label: 'Odhlásit se', onClick: () => power('logout') },
      // přepnutí na jiný účet (ucty.js) — obnoví systém rovnou na jeho zámek
      ...(Ucty.vsichni().length > 1 ? ['sep', ...Ucty.vsichni().filter((u) => !u.aktivni).map((u) => ({
        icon: 'user', label: u.jmeno, onClick: () => Ucty.prepni(u.id),
      }))] : []),
    ], { x: r.left, y: r.top, align: 'br' });
  };

  const powerBtn = el('button.start-power' + (cekaNaRestart() ? '.ceka' : ''), { title: cekaNaRestart() ? 'Napájení · aktualizace čekají na restart' : 'Napájení' }, icon('power'));
  powerBtn.onclick = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    contextMenu([
      { icon: 'sleep', label: 'Uspat', onClick: () => power('sleep') },
      // čekající aktualizace (aktualizace.js) se dokončí při restartu i vypnutí, jako ve Windows
      { icon: 'restart', label: cekaNaRestart() ? 'Aktualizovat a restartovat' : 'Restartovat', onClick: () => power('restart') },
      { icon: 'power', label: cekaNaRestart() ? 'Aktualizovat a vypnout' : 'Vypnout', onClick: () => power('shutdown') },
      'sep',
      { icon: 'lock', label: 'Uzamknout', onClick: () => power('lock') },
    ], { x: r.right, y: r.top, align: 'br' });
  };

  wrap.append(search, head, body, el('div.start-foot', {}, userBtn, powerBtn));
  render();
  setTimeout(() => input.focus(), 60);
  return wrap;
}

function power(kind) {
  closePopup();
  bus.emit('power', kind);
}

function launch(id) {
  closePopup();
  openApp(id);
}

function appTile(a) {
  const t = el('button.pin', {},
    glyfAplikace(a),
    el('div.label', { text: a.name }),
  );
  t.onclick = () => launch(a.id);
  tahniAplikaci(t, a);
  t.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    contextMenu([
      { icon: 'arrowRight', label: 'Otevřít', onClick: () => launch(a.id) },
      { icon: 'pin', label: 'Odepnout ze Startu', onClick: () => pin('pinyStart', a) },
      {
        icon: 'pin',
        label: jePripnuto('pinyPanel', a.id) ? 'Odepnout z panelu' : 'Připnout na panel',
        onClick: () => pin('pinyPanel', a),
      },
      polozkaPlochy(a),
      ...vlastniPolozky(a),
      a.uzivatelska ? null : { icon: 'info', label: 'O aplikaci', onClick: () => launch('about') },
    ].filter(Boolean), { x: e.clientX, y: e.clientY });
  });
  return t;
}

/** Připne/odepne a rovnou překreslí nabídku i panel. */
function pin(kam, a) {
  const pripnuto = prepniPin(kam, a.id);
  bus.emit('piny', kam);
  toast({
    title: pripnuto ? (kam === 'pinyPanel' ? 'Připnuto na panel' : 'Připnuto do Startu') : 'Odepnuto',
    body: a.name, icon: 'pin', timeout: 2200,
  });
}

function appRow(a) {
  const r = el('button.app-row', {},
    glyfAplikace(a),
    el('div', {}, el('div.t', { text: a.name }), el('div.s', { text: CATEGORIES.find((c) => c.id === a.cat)?.name || '' })),
    a.soon ? el('span.soon', { text: 'brzy' }) : null,
  );
  r.onclick = () => launch(a.id);
  tahniAplikaci(r, a);
  r.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    contextMenu([
      { icon: 'arrowRight', label: 'Otevřít', onClick: () => launch(a.id) },
      {
        icon: 'pin',
        label: jePripnuto('pinyStart', a.id) ? 'Odepnout ze Startu' : 'Připnout do Startu',
        onClick: () => pin('pinyStart', a),
      },
      {
        icon: 'pin',
        label: jePripnuto('pinyPanel', a.id) ? 'Odepnout z panelu' : 'Připnout na panel',
        onClick: () => pin('pinyPanel', a),
      },
      polozkaPlochy(a),
      ...vlastniPolozky(a),
    ], { x: e.clientX, y: e.clientY });
  });
  return r;
}

/** Nabídka navíc pro aplikace nainstalované ze složky na disku. */
function vlastniPolozky(a) {
  if (!a.uzivatelska) return [];
  return [
    'sep',
    { icon: 'code', label: 'Upravit v Editoru', onClick: () => { closePopup(); openApp('editor', { path: a.slozka + '/index.html' }); } },
    { icon: 'folderOpen', label: 'Otevřít složku', onClick: () => { closePopup(); openApp('files', { path: a.slozka }); } },
    { icon: 'trash', label: 'Odinstalovat', danger: true, onClick: () => { closePopup(); import('./aplikace.js').then((m) => m.odinstaluj(a.id)); } },
  ];
}

function pinnedView() {
  const view = el('div.start-view');
  const grid = el('div.pin-grid');
  startPins().forEach((id) => grid.append(appTile(APPS[id])));
  if (!startPins().length) grid.append(el('div.no-res', { text: 'Žádná připnutá aplikace. Připni ji pravým tlačítkem ve „Všech aplikacích“.' }));

  const reco = el('div.reco');
  [
    { id: 'welcome', s: 'Přidáno dnes' },
    { id: 'about', s: 'Informace o systému' },
    { id: 'notes', s: 'Naposledy otevřeno' },
    { id: 'terminal', s: 'Doporučeno' },
  ].forEach(({ id, s }) => {
    const a = APPS[id];
    if (!a) return;
    const item = el('button.reco-item', {},
      glyfAplikace(a),
      el('div', {}, el('div.t', { text: a.name }), el('div.s', { text: s })),
    );
    item.onclick = () => launch(id);
    reco.append(item);
  });

  view.append(grid, el('div.start-sub', { text: 'Doporučené' }), reco);
  return view;
}

function allAppsView() {
  const view = el('div.start-view');
  const list = el('div.app-list');
  const cats = el('div.cats');

  const draw = (catId) => {
    lastCat = catId;
    [...cats.children].forEach((c) => c.classList.toggle('on', c.dataset.id === catId));
    list.innerHTML = '';
    const apps = appList(catId === 'fav' ? null : catId)
      .filter((a) => (catId === 'fav' ? ['astroai', 'files', 'terminal', 'browser', 'notes', 'settings'].includes(a.id) : true));
    apps.forEach((a) => list.append(appRow(a)));
    if (!apps.length) list.append(el('div.no-res', { text: 'V této kategorii zatím nic není.' }));
  };

  for (const c of [...CATEGORIES, { id: 'all', name: 'Vše', icon: 'grid' }]) {
    const b = el('button.cat', { dataset: { id: c.id } }, icon(c.icon), el('span', { text: c.name }));
    b.onclick = () => draw(c.id);
    cats.append(b);
  }
  draw(lastCat);

  view.append(el('div.all-apps', {}, cats, list));
  return view;
}

function searchView(q) {
  const view = el('div.start-view');
  // hledá v českém i přeloženém názvu
  const hits = appList().filter((a) => a.name.toLowerCase().includes(q) || t(a.name).toLowerCase().includes(q));
  if (!hits.length) {
    view.append(el('div.no-res', { text: `Pro „${q}“ jsme nic nenašli.` }));
    return view;
  }
  const list = el('div.app-list', { style: { paddingTop: '4px' } });
  hits.forEach((a) => list.append(appRow(a)));
  view.append(list);
  return view;
}
