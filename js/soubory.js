// AstroOS — sdílené operace se soubory pro plochu, Soubory i Fotky
//
// Otevírání podle typu, schránka mezi okny (Ctrl+C/X/V), koš, nové položky, ikony souborů
// (složka, papír s příponou, náhled obrázku) a okno Vlastnosti.

import { el, bus, cz, plural } from './util.js';
import { icon } from './icons.js';
import * as FS from './fs.js';
import { toast } from './ui.js';
import { jazykSouboru } from './zvyrazneni.js';
import { t } from './i18n.js';
import { barvaSlozky } from './stitky.js';
import * as Vychozi from './vychozi.js';

export const PLOCHA = FS.HOME + '/Plocha';

const openApp = (id, o) => import('./apps.js').then((m) => m.openApp(id, o));

// ---------------------------------------------------------------- otevírání
/** Aplikace, ve které se soubor otevře: [id, název]. */
export function aplikacePro(cesta) {
  const jmeno = FS.basename(cesta);
  if (FS.isDir(FS.get(cesta))) return ['files', 'Soubory'];
  // výchozí aplikace zvolená v Nastavení (vychozi.js) má přednost
  const zvolena = Vychozi.zvolenaPro(cesta);
  if (zvolena) return [zvolena, Vychozi.NAZVY[zvolena] || zvolena];
  if (FS.isImage(jmeno) && FS.imageSrc(cesta)) return ['photos', 'Fotky'];
  // video z Astro 3D (.webm s obrazem) — přehraje ho Astro 3D, ne Diktafon
  if (/\.webm$/i.test(jmeno) && String(FS.audioSrc(cesta) || '').startsWith('data:video/')) return ['astro3d', 'Astro 3D'];
  if (FS.isAudio(jmeno) && FS.audioSrc(cesta)) return ['recorder', 'Diktafon'];
  if (/\.docx$/i.test(jmeno)) return ['pismo', 'AstroPísmo'];
  if (/\.(xlsx|csv)$/i.test(jmeno)) return ['tabulky', 'AstroTabulky'];
  if (/\.pptx$/i.test(jmeno)) return ['prezentace', 'AstroPrezentace'];
  if (/\.(a3d|obj)$/i.test(jmeno)) return ['astro3d', 'Astro 3D'];
  if (/\.zip$/i.test(jmeno)) return ['archiv', 'Archiv ZIP'];
  if (/\.html?$/i.test(jmeno)) return ['browser', 'Nova Prohlížeč'];
  if (jazykSouboru(jmeno)) return ['editor', 'Editor kódu'];
  if (FS.isText(jmeno)) return ['notes', 'Poznámky'];
  return [null, 'Žádná aplikace'];
}

/** Otevře soubor v konkrétní aplikaci (Soubory ▸ Otevřít v programu). */
export function otevriV(cesta, app) {
  if (app === 'browser') return openApp('browser', { url: 'file://' + cesta });
  return openApp(app, { path: cesta });
}

export function otevri(cesta) {
  if (cesta.startsWith(FS.TRASH + '/')) {
    return toast({ title: 'Soubor je v koši', body: 'Nejdřív ho obnov přes pravé tlačítko.', icon: 'trash' });
  }
  const [app] = aplikacePro(cesta);
  if (app === 'files') return openApp('files', { path: cesta });
  if (app === 'browser') return openApp('browser', { url: 'file://' + cesta });
  if (app) return openApp(app, { path: cesta });
  const jmeno = FS.basename(cesta);
  toast({ title: jmeno, body: `${FS.fileInfo(jmeno).kind} — pro tenhle typ zatím není aplikace.`, icon: 'info' });
}

// ---------------------------------------------------------------- schránka
export const schranka = { rezim: null, cesty: [] };

export function doSchranky(rezim, cesty) {
  schranka.rezim = rezim;
  schranka.cesty = [...cesty];
  bus.emit('schranka', schranka);
}

/** Vloží schránku do složky, vrací nové cesty. */
export function vloz(cil) {
  if (!schranka.cesty.length) return [];
  const nove = presun(schranka.cesty, cil, { kopie: schranka.rezim === 'copy' });
  if (schranka.rezim === 'cut') doSchranky(null, []);
  return nove;
}

// ---------------------------------------------------------------- přesun, koš
/** Přesune nebo zkopíruje položky do složky. Chyby hlásí, vrací nové cesty. */
export function presun(cesty, cil, { kopie = false } = {}) {
  const nove = [];
  for (const c of cesty) {
    if (!FS.exists(c)) continue;
    try {
      nove.push(kopie ? FS.copy(c, cil) : FS.move(c, cil));
    } catch (e) {
      toast({ title: kopie ? 'Kopírování selhalo' : 'Přesun selhal', body: e.message, icon: 'info' });
    }
  }
  return nove;
}

export function doKose(cesty) {
  let n = 0;
  for (const c of cesty) {
    try { FS.remove(c); n++; } catch (e) { toast({ title: 'Nešlo smazat', body: e.message, icon: 'info' }); }
  }
  if (n) toast({ title: 'Přesunuto do koše', body: n === 1 ? FS.basename(cesty[0]) : plural(n, ['položka', 'položky', 'položek']), icon: 'trash', timeout: 2600 });
}

export const jeKosPrazdny = () => !Object.keys(FS.get(FS.TRASH)?.d || {}).length;

// ---------------------------------------------------------------- nové položky
export function novaSlozka(kde) {
  const cesta = FS.normalize(kde + '/' + FS.freeName(kde, t('Nová složka')));
  FS.mkdir(cesta);
  return cesta;
}

export function novyTextak(kde) {
  const cesta = FS.normalize(kde + '/' + FS.freeName(kde, t('Nový textový dokument.txt')));
  FS.write(cesta, '');
  return cesta;
}

/** Položky pro podnabídku „Nový ▸“. po(cesta) dostane nově vytvořenou položku. */
export function nabidkaNovy(kde, po) {
  const zkus = (fn) => () => {
    try { po?.(fn(kde)); } catch (e) { toast({ title: 'Nešlo vytvořit', body: e.message, icon: 'info' }); }
  };
  return [
    { icon: 'folder', label: 'Složka', onClick: zkus(novaSlozka) },
    'sep',
    { icon: 'pismo', label: 'Dokument AstroPísma', onClick: zkus((k) => {
      const c = FS.normalize(k + '/' + FS.freeName(k, t('Nový dokument.docx')));
      FS.write(c, JSON.stringify({ format: 'astropismo', verze: 1, html: '<p><br></p>', nast: {}, meta: { vytvoreno: Date.now() } }));
      return c;
    }) },
    { icon: 'tabulky', label: 'Sešit AstroTabulek', onClick: zkus((k) => {
      const c = FS.normalize(k + '/' + FS.freeName(k, t('Nový sešit.xlsx')));
      FS.write(c, JSON.stringify({ format: 'astrotabulky', verze: 1, listy: [{ nazev: 'List1', bunky: [] }], styly: [], aktivni: 0, nazvy: [], meta: { vytvoreno: Date.now() } }));
      return c;
    }) },
    { icon: 'prezentace', label: 'Prezentace AstroPrezentací', onClick: zkus((k) => {
      const c = FS.normalize(k + '/' + FS.freeName(k, t('Nová prezentace.pptx')));
      FS.write(c, JSON.stringify({ format: 'astroprezentace', verze: 1, motiv: 'office', varianta: 0, snimky: [{ id: 's1', rozvrzeni: 'uvodni', objekty: [
        { id: 'o1', typ: 'text', ph: 'nadpis', x: 120, y: 88.4, w: 720, h: 188, rot: 0, html: '' },
        { id: 'o2', typ: 'text', ph: 'podtitul', x: 120, y: 283.6, w: 720, h: 130, rot: 0, html: '' },
      ] }], meta: { vytvoreno: Date.now() } }));
      return c;
    }) },
    { icon: 'fileText', label: 'Textový dokument', onClick: zkus(novyTextak) },
    { icon: 'code', label: 'Webová stránka', onClick: zkus((k) => {
      const c = FS.normalize(k + '/' + FS.freeName(k, t('nová stránka.html')));
      FS.write(c, '<!DOCTYPE html>\n<html lang="cs">\n<head>\n  <meta charset="utf-8">\n  <title>Nová stránka</title>\n</head>\n<body>\n  <h1>Ahoj!</h1>\n</body>\n</html>\n');
      return c;
    }) },
  ];
}

// ---------------------------------------------------------------- ikony souborů
/** barva = id z BARVY_SLOZEK (stitky.js), jinak klasická žlutá. */
function slozkaSvg(plna, barva = null) {
  const b = barvaSlozky(barva) || { zad: '#d9982a', pred: '#f5bf45', hrana: '#ffe08f' };
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 48 40');
  s.setAttribute('class', 'ikona-slozky');
  s.innerHTML = `
    <path d="M3 7.5A3.5 3.5 0 0 1 6.5 4h10.2a3 3 0 0 1 2.2.9L22 8h19.5A3.5 3.5 0 0 1 45 11.5V16H3z" fill="${b.zad}"/>
    ${plna ? '<rect x="7" y="10" width="34" height="16" rx="1.5" fill="#fbfbfb"/><rect x="9" y="12.5" width="30" height="13" rx="1" fill="#e6ecf1"/>' : ''}
    <path d="M3 15.5A3.5 3.5 0 0 1 6.5 12h35a3.5 3.5 0 0 1 3.5 3.5v19a3.5 3.5 0 0 1-3.5 3.5h-35A3.5 3.5 0 0 1 3 34.5z" fill="${b.pred}"/>
    <path d="M3 16.5A3.5 3.5 0 0 1 6.5 13h35a3.5 3.5 0 0 1 3.5 3.5" fill="none" stroke="${b.hrana}" stroke-width="1.2"/>`;
  return s;
}

function strankaSvg(barva, pripona) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 40 48');
  s.setAttribute('class', 'ikona-stranky');
  const text = pripona.replace(/[^A-Z0-9]/g, '').slice(0, 4);
  s.innerHTML = `
    <path d="M8 2h17.5L36 12.5V43a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3z" fill="#f3f6f8" stroke="rgba(0,0,0,.12)"/>
    <path d="M25.5 2v7.5a3 3 0 0 0 3 3H36z" fill="#cdd5db"/>
    <path d="M10 15h12M10 19.5h16M10 24h14" stroke="#c5cdd4" stroke-width="1.7" stroke-linecap="round"/>
    <rect x="5" y="30" width="31" height="11" fill="${barva}"/>
    ${text ? `<text x="20.5" y="38.3" text-anchor="middle" font-size="${text.length > 3 ? 6.2 : 7.2}" font-weight="700" fill="#fff" font-family="Segoe UI, system-ui, sans-serif" letter-spacing=".3">${text}</text>` : ''}`;
  return s;
}

/** Ikona položky: složka, náhled obrázku, nebo papír s barevnou příponou. */
export function glyfSouboru(cesta, uzel = FS.get(cesta)) {
  const jmeno = FS.basename(cesta);
  if (FS.isDir(uzel)) return slozkaSvg(Object.keys(uzel.d).length > 0, uzel.barva);
  const src = FS.isImage(jmeno) ? FS.imageSrc(cesta) : null;
  if (src) return el('span.nahled-souboru', {}, el('img', { src, alt: '', draggable: 'false', loading: 'lazy' }));
  const pripona = jmeno.includes('.') ? jmeno.slice(jmeno.lastIndexOf('.') + 1).toUpperCase() : '';
  return strankaSvg(FS.fileInfo(jmeno).color, pripona);
}

export const druhSouboru = (cesta) => (FS.isDir(FS.get(cesta)) ? 'Složka souborů' : FS.fileInfo(FS.basename(cesta)).kind);

// ---------------------------------------------------------------- vlastnosti
function obsahSlozky(uzel) {
  let soubory = 0, slozky = 0;
  const projdi = (u) => {
    for (const d of Object.values(u.d)) {
      if (FS.isDir(d)) { slozky++; projdi(d); } else soubory++;
    }
  };
  projdi(uzel);
  return `${plural(soubory, ['soubor', 'soubory', 'souborů'])}, ${plural(slozky, ['složka', 'složky', 'složek'])}`;
}

/** Okno Vlastnosti jako ve Windows (s přejmenováním). */
export async function vlastnosti(cesta) {
  const uzel = FS.get(cesta);
  if (!uzel) return;
  const { openWindow } = await import('./wm.js');
  const jmeno = FS.basename(cesta);
  const velikost = FS.size(uzel);
  openWindow({
    id: 'vlastnosti', name: 'Vlastnosti', icon: 'info', color: 'linear-gradient(145deg,#7d8b96,#4a565f)',
    width: 400, height: 480,
    mount(body, win) {
      const pole = el('input.vl-jmeno', { value: jmeno, spellcheck: 'false' });
      pole.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') ok(); if (e.key === 'Escape') win.close(); });
      const [, appNazev] = aplikacePro(cesta);
      const radek = (k, v) => el('div.vl-r', {}, el('span', { text: k }), el('b', { text: v }));
      const radekVelikosti = radek('Velikost', `${FS.humanSize(velikost)} (${velikost.toLocaleString('cs')} bajtů)`);
      // obrázky z projektu jsou na disku jen odkaz „astro-img:…“ — skutečnou velikost řekne server
      if (FS.isFile(uzel) && uzel.c.startsWith('astro-img:')) {
        fetch(uzel.c.slice(10)).then((r) => r.blob()).then(({ size: b }) => {
          if (b) radekVelikosti.lastChild.textContent = `${FS.humanSize(b)} (${b.toLocaleString('cs')} bajtů)`;
        }).catch(() => {});
      }
      const zmeneno = new Date(uzel.m || Date.now());

      function ok() {
        const nove = pole.value.trim();
        if (nove && nove !== jmeno) {
          try { FS.rename(cesta, nove); } catch (e) { return toast({ title: 'Přejmenování selhalo', body: e.message, icon: 'info' }); }
        }
        win.close();
      }

      body.append(el('div.vl', {},
        el('div.vl-hlava', {}, el('div.vl-ic', {}, glyfSouboru(cesta, uzel)), pole),
        el('div.vl-sep'),
        radek('Typ', druhSouboru(cesta)),
        FS.isDir(uzel) ? null : radek('Otevírá se v', appNazev),
        el('div.vl-sep'),
        radek('Umístění', FS.dirname(cesta)),
        radekVelikosti,
        FS.isDir(uzel) ? radek('Obsahuje', obsahSlozky(uzel)) : null,
        el('div.vl-sep'),
        radek('Změněno', `${cz.datumDlouhy(zmeneno)} ${zmeneno.getFullYear()}, ${cz.casS(zmeneno)}`),
        radek('Atributy', jmeno.startsWith('.') ? 'Skrytý' : 'Normální'),
        el('div.vl-tlacitka', {},
          el('button.btn.primary', { text: 'OK', onclick: ok }),
          el('button.btn', { text: 'Zrušit', onclick: () => win.close() })),
      ));
      win.title = `Vlastnosti: ${jmeno}`;
      setTimeout(() => { pole.focus(); const t = jmeno.lastIndexOf('.'); pole.setSelectionRange(0, t > 0 && !FS.isDir(uzel) ? t : jmeno.length); }, 30);
    },
  });
}
