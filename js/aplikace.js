// AstroOS — vlastní aplikace (nainstalované ze složky na disku)
//
// Aplikace = složka s index.html (+ css, js, obrázky) a app.json s názvem, ikonou
// a velikostí okna. Instalace ji zapíše do nastavení (`mojeAplikace`) a zaregistruje
// v APPS, takže se chová jako každá jiná: Start, plocha, panel, Alt+Tab, Správce úloh.
// Běží v rámu z proxy portu (vlastní původ, vlastní localStorage) a se systémem mluví
// přes window.astro (viz js/hostitel.js a sdk/most.js).

import { el, bus } from './util.js';
import { icon, hasIcon } from './icons.js';
import { State } from './state.js';
import * as FS from './fs.js';
import { toast } from './ui.js';
import { windows } from './wm.js';
import { APPS, CATEGORIES, openApp, prepniPin, jePripnuto } from './apps.js';
import { nahrajSlozku, adresaWebu, pripojMost } from './hostitel.js';

const KLIC = 'mojeAplikace';
export const SLOZKA_APLIKACI = FS.HOME + '/Aplikace';

export const IKONY = ['grid', 'star', 'weather', 'clock', 'check', 'notes', 'fileText', 'code', 'game', 'music',
  'image', 'palette', 'calc', 'globe', 'mail', 'book', 'home', 'heart', 'ai', 'cpu', 'monitor', 'mic', 'brush', 'user']
  .filter((i) => hasIcon(i));
export const BARVY = ['#46c36f', '#4aa3e8', '#a077f0', '#f0b95c', '#f07f9c', '#3fd0c8', '#ef6a5a', '#7d8b96'];

export const zaznamy = () => (State.get(KLIC) || []).filter((z) => z && z.id && z.slozka);
export const zaznamPro = (slozka) => zaznamy().find((z) => z.slozka === FS.normalize(slozka));
export const zaznam = (id) => zaznamy().find((z) => z.id === id);
export const jeAplikaceSlozka = (slozka) => FS.isFile(FS.get(FS.normalize(slozka) + '/index.html'));

// ---------------------------------------------------------------- barvy a jména
function ztmav(hex, o = 0.72) {
  const n = parseInt(hex.slice(1), 16);
  const k = (x) => Math.round(x * o).toString(16).padStart(2, '0');
  return '#' + k((n >> 16) & 255) + k((n >> 8) & 255) + k(n & 255);
}
const platnaBarva = (b) => (typeof b === 'string' && /^#[0-9a-f]{6}$/i.test(b) ? b : BARVY[0]);
const gradient = (b) => `linear-gradient(145deg,${platnaBarva(b)},${ztmav(platnaBarva(b))})`;

function slug(text) {
  return String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'aplikace';
}

// ---------------------------------------------------------------- app.json
/** Přečte app.json ze složky (chybějící hodnoty doplní). */
export function nactiManifest(slozka) {
  let m = {};
  try { m = JSON.parse(FS.read(slozka + '/app.json')); } catch { /* bez manifestu nebo rozbitý */ }
  const cislo = (v, d, min, max) => Math.min(max, Math.max(min, Number(v) || d));
  return {
    nazev: String(m.nazev || m.name || FS.basename(slozka)).slice(0, 40),
    popis: String(m.popis || m.description || ''),
    ikona: hasIcon(m.ikona || m.icon) ? (m.ikona || m.icon) : 'grid',
    barva: platnaBarva(m.barva || m.color),
    kategorie: CATEGORIES.some((c) => c.id === m.kategorie && c.id !== 'fav') ? m.kategorie : 'tools',
    sirka: cislo(m.sirka ?? m.width, 720, 320, 1600),
    vyska: cislo(m.vyska ?? m.height, 520, 200, 1200),
  };
}

function zapisManifest(slozka, m) {
  const data = {
    nazev: m.nazev, popis: m.popis || undefined, ikona: m.ikona, barva: m.barva,
    kategorie: m.kategorie, sirka: m.sirka, vyska: m.vyska,
  };
  FS.write(slozka + '/app.json', JSON.stringify(data, null, 2) + '\n');
}

// ---------------------------------------------------------------- definice pro APPS
/** Záznam z nastavení → aplikace pro správce oken. */
export function definice(z) {
  return {
    id: z.id, name: z.nazev, icon: z.ikona, color: gradient(z.barva), cat: z.kategorie,
    width: z.sirka, height: z.vyska, uzivatelska: true, slozka: z.slozka,
    mount: (body, win) => spustVOkne(z, body, win),
    unmount: (win) => win.onClose?.(),
  };
}

function registruj(z) {
  APPS[z.id] = { width: 780, height: 540, cat: 'tools', ...definice(z) };
}

/** Pro registr při startu systému. */
export const uzivatelskeDefinice = () => zaznamy().map(definice);

// ---------------------------------------------------------------- běh v okně
function spustVOkne(z, body, win) {
  const web = 'app-' + z.id.slice(2);
  // Stejný sandbox jako skutečné weby v Nově: vlastní původ (proxy port) je od AstroOS
  // oddělený, sandbox jí navíc bere přepsání celého systému přes top.location.
  const ramec = el('iframe.app-ramec', {
    sandbox: 'allow-scripts allow-forms allow-same-origin allow-modals',
    allow: 'autoplay; fullscreen; microphone; camera; clipboard-write; geolocation',
  });
  const nacitani = el('div.app-nacitani', {}, el('div.app-toc'), el('span', { text: `Spouštím ${z.nazev}…` }));
  const obal = el('div.app-hostitel', {}, ramec, nacitani);
  body.append(obal);

  const chyba = (text) => {
    nacitani.replaceChildren(
      el('div.app-chyba-ic', {}, icon('info')),
      el('b', { text: 'Aplikaci se nepodařilo spustit' }),
      el('span', { text }),
      el('div.app-chyba-akce', {},
        el('button.btn', { text: 'Zkusit znovu', onclick: () => spust() }),
        el('button.btn', { text: 'Odinstalovat', onclick: () => { odinstaluj(z.id); } }),
      ),
    );
    nacitani.hidden = false;
  };

  const zablokovano = (hrozby) => {
    nacitani.replaceChildren(
      el('div.app-chyba-ic.df-blok-ic', {}, icon('shieldX')),
      el('b', { text: 'Astro Defender zablokoval spuštění' }),
      el('span', { text: `Aplikace ${z.nazev} obsahuje ${hrozby.length > 1 ? 'hrozby' : 'hrozbu'}: ${hrozby.map((h) => `${h.nazev} (${FS.basename(h.cesta)})`).join(', ')}.` }),
      el('div.app-chyba-akce', {},
        el('button.btn.primary', { text: 'Otevřít Astro Defender', onclick: () => openApp('defender', { stranka: 'viry' }) }),
        el('button.btn', { text: 'Zkusit znovu', onclick: () => spust() }),
      ),
    );
    nacitani.hidden = false;
  };

  async function spust() {
    nacitani.hidden = false;
    try {
      if (!jeAplikaceSlozka(z.slozka)) throw new Error(`Ve složce ${z.slozka} chybí index.html.`);
      const { kontrolaPredSpustenim } = await import('./obrana.js');
      const hrozby = kontrolaPredSpustenim(z.slozka, z.nazev);
      if (hrozby.length) { ramec.removeAttribute('src'); return zablokovano(hrozby); }
      await nahrajSlozku(web, z.slozka);
      ramec.src = adresaWebu(web, '') + '?spusteno=' + Date.now();
    } catch (e) {
      chyba(e.message);
    }
  }
  ramec.addEventListener('load', () => { if (ramec.src) nacitani.hidden = true; });

  const odpoj = pripojMost(ramec, {
    rezim: 'aplikace', web, koren: z.slozka, win, app: z,
    onObnov: () => spust(),
    onOdkaz: (url) => openApp('browser', { url }),
  });

  // klik do rámu se ke správci oken nedostane — okno vytáhneme dopředu, když rám získá fokus
  const priBlur = () => setTimeout(() => {
    if (document.activeElement === ramec) import('./wm.js').then((wm) => wm.focus(win));
  }, 0);
  window.addEventListener('blur', priBlur);

  win.obnovAplikaci = spust;
  win.onClose = () => {
    odpoj();
    window.removeEventListener('blur', priBlur);
    ramec.src = 'about:blank';
  };
  spust();
}

// ---------------------------------------------------------------- instalace
function unikatniId(nazev, slozka) {
  const zaklad = 'u-' + slug(nazev);
  let id = zaklad, i = 2;
  while (APPS[id] && APPS[id].slozka !== slozka) id = `${zaklad}-${i++}`;
  return id;
}

/**
 * Nainstaluje (nebo aktualizuje) aplikaci ze složky. m = manifest, o = { plocha, panel }.
 * Vrací záznam.
 */
export function nainstaluj(slozka, m, o = {}) {
  slozka = FS.normalize(slozka);
  if (!jeAplikaceSlozka(slozka)) throw new Error('Ve složce musí být soubor index.html.');
  zapisManifest(slozka, m);

  const puvodni = zaznamPro(slozka);
  const z = {
    id: puvodni?.id || unikatniId(m.nazev, slozka),
    slozka, nazev: m.nazev, ikona: m.ikona, barva: m.barva, kategorie: m.kategorie,
    sirka: m.sirka, vyska: m.vyska, nainstalovano: puvodni?.nainstalovano || Date.now(),
  };
  State.set(KLIC, [...zaznamy().filter((x) => x.slozka !== slozka), z]);
  registruj(z);

  if (!puvodni) {
    if (!jePripnuto('pinyStart', z.id)) prepniPin('pinyStart', z.id);
    if (o.plocha !== false) State.set('plochaAplikace', [...new Set([...(State.get('plochaAplikace') || []), z.id])]);
  }
  if (o.panel && !jePripnuto('pinyPanel', z.id)) prepniPin('pinyPanel', z.id);
  bus.emit('piny', 'pinyStart');
  bus.emit('piny', 'pinyPanel');
  bus.emit('aplikace', z);

  // běžící okno se překreslí s novou ikonou/názvem až po novém spuštění — obsah obnovíme hned
  for (const w of windows.filter((x) => x.app.id === z.id)) w.obnovAplikaci?.();
  return { zaznam: z, nova: !puvodni };
}

/** Odinstaluje aplikaci — soubory na disku zůstanou. */
export function odinstaluj(id) {
  const z = zaznam(id);
  if (!z) return;
  for (const w of windows.filter((x) => x.app.id === id)) w.close();
  State.set(KLIC, zaznamy().filter((x) => x.id !== id));
  if (jePripnuto('pinyStart', id)) prepniPin('pinyStart', id);
  if (jePripnuto('pinyPanel', id)) prepniPin('pinyPanel', id);
  State.set('plochaAplikace', (State.get('plochaAplikace') || []).filter((x) => x !== id));
  delete APPS[id];
  bus.emit('piny', 'pinyStart');
  bus.emit('piny', 'pinyPanel');
  bus.emit('aplikace', null);
  toast({ title: 'Odinstalováno', body: `${z.nazev} — soubory zůstaly v ${z.slozka.replace(FS.HOME, '~')}.`, icon: 'trash' });
}

// ---------------------------------------------------------------- okno instalátoru
export const instalatorApp = {
  id: 'instalator', name: 'Instalace aplikace', icon: 'store', color: 'linear-gradient(145deg,#f0b95c,#c47f26)',
  cat: 'system', width: 560, height: 640, hidden: true,

  mount(body, win) {
    win.kresli = (slozka) => kresliInstalator(body, win, slozka);
    win.kresli(win.opts?.slozka);
  },
  reopen(win, opts) { if (opts?.slozka) win.kresli(opts.slozka); },
};

function kresliInstalator(body, win, slozka) {
  body.replaceChildren();
  slozka = slozka ? FS.normalize(slozka) : null;
  if (!slozka || !jeAplikaceSlozka(slozka)) {
    body.append(el('div.ins', {}, el('p.ins-pozn', { text: 'Ve složce není index.html, takže z ní aplikace být nemůže.' })));
    return;
  }
  // ukázková verze: vlastní aplikace jde vyzkoušet v Editoru nebo otevřít v Nově, instalace je v plné verzi
  if (!zaznamPro(slozka)) {
    body.append(el('div.ins', {}, el('p.ins-pozn', { text: 'Instalace vlastních aplikací je jen v plné verzi AstroOS. Aplikaci si můžeš vyzkoušet v Editoru kódu nebo otevřít jako stránku v Nově.' })));
    return;
  }

  const m = nactiManifest(slozka);
  const puvodni = zaznamPro(slozka);
  win.title = puvodni ? `Aktualizovat ${m.nazev}` : 'Instalace aplikace';

  const nahled = el('div.ins-glyph');
  const nahledNazev = el('b');
  const prekresli = () => {
    nahled.style.background = gradient(m.barva);
    nahled.replaceChildren(icon(m.ikona));
    nahledNazev.textContent = m.nazev || 'Bez názvu';
    ikony.forEach((b) => b.classList.toggle('on', b.dataset.i === m.ikona));
    barvy.forEach((b) => b.classList.toggle('on', b.dataset.b === m.barva));
  };

  const pole = (typ, hodnota, zmena, extra = {}) => {
    const p = el('input.ins-pole', { type: typ, value: hodnota, spellcheck: 'false', ...extra });
    p.addEventListener('input', () => { zmena(p.value); prekresli(); });
    p.addEventListener('keydown', (e) => e.stopPropagation());
    return p;
  };

  const ikony = IKONY.map((i) => {
    const b = el('button.ins-ikona', { title: i, dataset: { i } }, icon(i));
    b.onclick = () => { m.ikona = i; prekresli(); };
    return b;
  });
  const barvy = BARVY.map((b) => {
    const t = el('button.ins-barva', { style: { background: b }, dataset: { b } });
    t.onclick = () => { m.barva = b; prekresli(); };
    return t;
  });
  const vlastniBarva = el('input.ins-vlastni', { type: 'color', value: m.barva, title: 'Vlastní barva' });
  vlastniBarva.oninput = () => { m.barva = vlastniBarva.value; prekresli(); };

  const kategorie = el('select.ins-pole', {}, CATEGORIES.filter((c) => c.id !== 'fav').map((c) =>
    el('option', { value: c.id, text: c.name, selected: c.id === m.kategorie })));
  kategorie.onchange = () => { m.kategorie = kategorie.value; };

  const naPlochu = el('input', { type: 'checkbox', checked: !puvodni });
  const naPanel = el('input', { type: 'checkbox', checked: !!puvodni && jePripnuto('pinyPanel', puvodni.id) });

  const bInstaluj = el('button.btn.primary', { text: puvodni ? 'Aktualizovat' : 'Nainstalovat' });
  bInstaluj.onclick = () => {
    m.nazev = m.nazev.trim();
    if (!m.nazev) return toast({ title: 'Chybí název', body: 'Aplikace musí mít jméno.', icon: 'info' });
    let vysledek;
    try {
      vysledek = nainstaluj(slozka, m, { plocha: naPlochu.checked, panel: naPanel.checked });
    } catch (e) {
      return toast({ title: 'Instalace selhala', body: e.message, icon: 'info', timeout: 6000 });
    }
    toast({
      title: vysledek.nova ? 'Nainstalováno' : 'Aktualizováno',
      body: vysledek.nova ? `${m.nazev} najdeš ve Startu i na ploše.` : m.nazev,
      icon: 'check',
    });
    win.close();
    openApp(vysledek.zaznam.id);
  };

  const radek = (popisek, ...obsah) => el('label.ins-radek', {}, el('span.ins-popisek', { text: popisek }), ...obsah);

  body.append(el('div.ins', {},
    el('div.ins-hlava', {}, nahled, el('div', {}, nahledNazev,
      el('span', { text: slozka.replace(FS.HOME, '~') }))),
    radek('Název', pole('text', m.nazev, (v) => { m.nazev = v; }, { maxlength: 40 })),
    radek('Popis', pole('text', m.popis, (v) => { m.popis = v; }, { placeholder: 'Co aplikace dělá (nepovinné)' })),
    el('div.ins-radek', {}, el('span.ins-popisek', { text: 'Ikona' }), el('div.ins-ikony', {}, ikony)),
    el('div.ins-radek', {}, el('span.ins-popisek', { text: 'Barva' }), el('div.ins-barvy', {}, barvy, vlastniBarva)),
    radek('Kategorie', kategorie),
    el('div.ins-radek', {}, el('span.ins-popisek', { text: 'Okno' }), el('div.ins-velikost', {},
      pole('number', m.sirka, (v) => { m.sirka = Math.max(320, Number(v) || 720); }, { min: 320, max: 1600 }),
      el('span', { text: '×' }),
      pole('number', m.vyska, (v) => { m.vyska = Math.max(200, Number(v) || 520); }, { min: 200, max: 1200 }),
      el('span.ins-jednotka', { text: 'px' }))),
    el('div.ins-volby', {},
      puvodni ? null : el('label', {}, naPlochu, el('span', { text: 'Ikona na ploše' })),
      el('label', {}, naPanel, el('span', { text: 'Připnout na hlavní panel' }))),
    el('p.ins-pozn', {}, icon('shield'), el('span', {
      text: 'Aplikace poběží ve vlastním okně a oddělená od systému. Přes astro.fs může číst '
        + 'a zapisovat soubory na tvém disku, přes astro.ai se ptát AstroAI.',
    })),
    el('div.ins-akce', {},
      el('button.btn', { text: 'Zrušit', onclick: () => win.close() }),
      bInstaluj),
  ));
  prekresli();
}
