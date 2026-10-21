// AstroOS — tažení souborů a aplikací myší (plocha, Soubory, Fotky, Start)
//
// Vlastní tažení přes pointer události. Pod kurzorem jede „duch“ s náhledem a popisem akce
// („Přesunout do Dokumenty“, „Kopírovat na Plochu“…), cíl se zvýrazní. Ctrl = kopírovat,
// u zdrojů, které výchozí kopírují (Fotky), Shift = přesunout — jako ve Windows.

import { el, drag } from './util.js';
import * as FS from './fs.js';
import { presun, doKose, PLOCHA } from './soubory.js';

let plocha = null;   // desktop.js: { umisti({ cesty, aplikace, kopie, bod }) }
export const registrujPlochu = (p) => { plocha = p; };

const nazevSlozky = (c) => (c === FS.HOME ? 'Domů' : c === PLOCHA ? 'Plochu' : FS.basename(c) || 'Disk');

/** Cíl pod kurzorem: { typ: 'slozka' | 'kos' | 'plocha' | 'nejde', cesta?, prvek?, stejna? } nebo null. */
export function najdiCil(x, y, cesty = []) {
  const p = document.elementFromPoint(x, y);
  if (!p) return null;
  let cil = null;
  const ikona = p.closest('.dicon');
  if (ikona) {
    if (ikona.dataset.id === 'trash') cil = { typ: 'kos', prvek: ikona };
    else if (ikona.dataset.slozka) cil = { typ: 'slozka', cesta: ikona.dataset.cesta, prvek: ikona };
    else cil = { typ: 'plocha' };
  } else if (p.closest('#icons')) {
    cil = { typ: 'plocha' };
  } else {
    const polozka = p.closest('.fm-item[data-dir="1"]');
    const misto = p.closest('.fm-place');
    const pohled = p.closest('.fm-view');
    const cesta = polozka?.dataset.path || misto?.dataset.path || pohled?.dataset.cwd;
    const prvek = polozka || misto || pohled;
    if (cesta) cil = cesta === FS.TRASH ? { typ: 'kos', prvek } : { typ: 'slozka', cesta, prvek };
  }
  if (cil?.typ === 'slozka') {
    if (cesty.some((c) => cil.cesta === c || cil.cesta.startsWith(c + '/'))) return { typ: 'nejde', prvek: cil.prvek };
    if (cesty.length && cesty.every((c) => FS.dirname(c) === cil.cesta)) cil.stejna = true;
  }
  return cil;
}

let zvyrazneny = null;
export function zvyrazni(cil) {
  const prvek = cil && !cil.stejna && cil.typ !== 'nejde' ? cil.prvek : null;
  if (zvyrazneny === prvek) return;
  zvyrazneny?.classList.remove('pr-cil');
  zvyrazneny = prvek || null;
  zvyrazneny?.classList.add('pr-cil');
}

function popis(cil, kopie, aplikace) {
  if (!cil) return '';
  if (cil.typ === 'nejde') return 'Sem to nejde';
  if (aplikace) return cil.typ === 'plocha' ? 'Vytvořit zástupce na ploše' : '';
  if (cil.stejna) return '';
  if (cil.typ === 'kos') return 'Přesunout do koše';
  const co = kopie ? 'Kopírovat' : 'Přesunout';
  return cil.typ === 'plocha' ? `${co} na Plochu` : `${co} do ${nazevSlozky(cil.cesta)}`;
}

/**
 * Začne tahat (až po posunu o pár pixelů, klik zůstane klikem).
 * o = { cesty, aplikace, nahled (element), vychoziKopie, zacatek() }
 */
export function tahni(e, { cesty = [], aplikace = null, nahled = null, vychoziKopie = false, zacatek } = {}) {
  if (e.button !== 0) return;
  const x0 = e.clientX, y0 = e.clientY;
  let duch = null, text = null, cil = null, kopie = vychoziKopie;

  drag((ev) => {
    if (!duch) {
      if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return;
      text = el('span.pr-text');
      duch = el('div.pr-duch', {},
        el('div.pr-obr', {}, nahled),
        cesty.length > 1 ? el('b.pr-pocet', { text: String(cesty.length) }) : null,
        text);
      document.body.append(duch);
      document.body.classList.add('pr-tahne');
      zacatek?.();
    }
    duch.style.transform = `translate(${ev.clientX + 12}px, ${ev.clientY + 10}px)`;
    kopie = vychoziKopie ? !ev.shiftKey : ev.ctrlKey;
    cil = najdiCil(ev.clientX, ev.clientY, cesty);
    if (aplikace && cil && cil.typ !== 'plocha') cil = null;
    zvyrazni(cil);
    const t = popis(cil, kopie, aplikace);
    text.textContent = t;
    text.hidden = !t;
    duch.classList.toggle('nejde', cil?.typ === 'nejde');
  }, (ev) => {
    if (!duch) return;
    duch.remove();
    document.body.classList.remove('pr-tahne');
    zvyrazni(null);
    if (!cil || cil.typ === 'nejde' || cil.stejna) return;
    if (aplikace) return plocha?.umisti({ aplikace, bod: { x: ev.clientX, y: ev.clientY } });
    if (cil.typ === 'kos') return doKose(cesty);
    if (cil.typ === 'plocha') return plocha?.umisti({ cesty, kopie, bod: { x: ev.clientX, y: ev.clientY } });
    presun(cesty, cil.cesta, { kopie });
  });
}
