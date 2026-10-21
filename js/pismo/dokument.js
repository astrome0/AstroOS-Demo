// AstroPísmo — jádro dokumentu: editovatelná plocha, stránkování, historie, výběr, formát souboru
//
// Stránkování nemění DOM textu: bloky, které přetečou přes konec stránky, se posunou na další
// přes pravidla v <style> (nth-child cesta → margin-top). Díky tomu se nemíchá do historie
// ani do uloženého HTML. Historie Zpět/Znovu je vlastní (snímky innerHTML + výběr), takže si
// můžeme DOM upravovat, jak potřebujeme (velikost písma, komentáře, obrázky).

import { el } from '../util.js';

export const MM = 96 / 25.4;
export const MEZERA = 16;          // mezera mezi stránkami v px při 100 %
export const PT = 96 / 72;

export const VELIKOSTI = {
  A4: { nazev: 'A4', w: 210, h: 297, popis: '21 cm × 29,7 cm' },
  A5: { nazev: 'A5', w: 148, h: 210, popis: '14,8 cm × 21 cm' },
  A3: { nazev: 'A3', w: 297, h: 420, popis: '29,7 cm × 42 cm' },
  B5: { nazev: 'B5 (JIS)', w: 182, h: 257, popis: '18,2 cm × 25,7 cm' },
  Letter: { nazev: 'Letter', w: 215.9, h: 279.4, popis: '21,59 cm × 27,94 cm' },
  Legal: { nazev: 'Legal', w: 215.9, h: 355.6, popis: '21,59 cm × 35,56 cm' },
};

export const OKRAJE = {
  normalni: { nazev: 'Normální', t: 25, b: 25, l: 25, r: 25 },
  uzke: { nazev: 'Úzké', t: 12.7, b: 12.7, l: 12.7, r: 12.7 },
  stredni: { nazev: 'Střední', t: 25.4, b: 25.4, l: 19.1, r: 19.1 },
  siroke: { nazev: 'Široké', t: 25.4, b: 25.4, l: 50.8, r: 50.8 },
  office2003: { nazev: 'Výchozí nastavení Office 2003', t: 25.4, b: 25.4, l: 31.8, r: 31.8 },
};

export const PISMA = ['Aptos', 'Aptos Display', 'Arial', 'Arial Black', 'Bahnschrift', 'Calibri', 'Calibri Light', 'Cambria',
  'Candara', 'Comic Sans MS', 'Consolas', 'Constantia', 'Corbel', 'Courier New', 'Franklin Gothic Medium', 'Gabriola',
  'Georgia', 'Impact', 'Lucida Console', 'Palatino Linotype', 'Segoe Print', 'Segoe Script', 'Segoe UI', 'Sitka Text',
  'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana'];

const ZALOHA = { Aptos: 'Aptos, "Segoe UI Variable Text", "Segoe UI", Calibri, sans-serif', 'Aptos Display': '"Aptos Display", "Segoe UI Variable Display", "Segoe UI", Calibri, sans-serif' };
export const zasobnikPisma = (p) => ZALOHA[p] || `"${p}", ${/Courier|Consolas|Lucida Console/.test(p) ? 'monospace' : /Times|Georgia|Cambria|Palatino|Constantia|Sitka/.test(p) ? 'serif' : 'sans-serif'}`;

export const VELIKOSTI_PISMA = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];

// styly odstavců: tag → název (pořadí = galerie na kartě Domů)
export const STYLY = [
  { id: 'p', nazev: 'Normální', klavesa: 'Ctrl+Shift+N' },
  { id: 'div', nazev: 'Bez mezer' },
  { id: 'h1', nazev: 'Nadpis 1', klavesa: 'Ctrl+Alt+1' },
  { id: 'h2', nazev: 'Nadpis 2', klavesa: 'Ctrl+Alt+2' },
  { id: 'h3', nazev: 'Nadpis 3', klavesa: 'Ctrl+Alt+3' },
  { id: 'h5', nazev: 'Název' },
  { id: 'h6', nazev: 'Podtitul' },
  { id: 'jemne', nazev: 'Zdůraznění jemné', znak: true },
  { id: 'zduraz', nazev: 'Zdůraznění', znak: true },
  { id: 'silne', nazev: 'Silné', znak: true },
  { id: 'blockquote', nazev: 'Citace' },
  { id: 'h4', nazev: 'Nadpis 4' },
];

export function vychoziNastaveni() {
  return {
    velikost: 'A4', orientace: 'na-vysku', okraje: 'normalni',
    barvaStranky: null, ohraniceni: false, vodoznak: null,
    zahlavi: '', zapati: '', komentare: [],
  };
}

export function geometrie(n) {
  const v = VELIKOSTI[n.velikost] || VELIKOSTI.A4;
  let w = v.w * MM, h = v.h * MM;
  if (n.orientace === 'na-sirku') [w, h] = [h, w];
  const o = (n.okraje === 'vlastni' && n.vlastniOkraje) || OKRAJE[n.okraje] || OKRAJE.normalni;
  const mt = o.t * MM, mb = o.b * MM, ml = o.l * MM, mr = o.r * MM;
  return { w, h, mt, mb, ml, mr, sirka: w - ml - mr, vyska: h - mt - mb, rozestup: h + MEZERA };
}

// ---------------------------------------------------------------- soubor
export function serializuj(html, nast, meta) {
  return JSON.stringify({ format: 'astropismo', verze: 1, html, nast, meta });
}

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function rozeber(text) {
  try {
    const d = JSON.parse(text);
    if (d && d.format === 'astropismo') return { html: d.html || '<p><br></p>', nast: { ...vychoziNastaveni(), ...d.nast }, meta: d.meta || {} };
  } catch { /* není JSON */ }
  const html = /<(p|div|h\d|ul|ol|table|br|b|span)\b/i.test(text)
    ? text
    : text.split(/\r?\n/).map((r) => `<p>${esc(r) || '<br>'}</p>`).join('');
  return { html: html || '<p><br></p>', nast: vychoziNastaveni(), meta: {} };
}

/** Vyčistí HTML z disku nebo schránky: žádné skripty ani on* atributy. */
export function vycisti(html) {
  const t = document.createElement('template');
  t.innerHTML = html;
  t.content.querySelectorAll('script, iframe, object, embed, link, meta, style, base, form, input, button, textarea, select').forEach((n) => n.remove());
  t.content.querySelectorAll('*').forEach((n) => {
    for (const a of [...n.attributes]) {
      if (/^on/i.test(a.name) || (/^(href|src)$/i.test(a.name) && /^\s*javascript:/i.test(a.value))) n.removeAttribute(a.name);
    }
    if (n.hasAttribute('contenteditable') && !n.matches('hr, .ps-toc, sup.ps-pozn-ref')) n.removeAttribute('contenteditable');
  });
  return t.innerHTML;
}

export function htmlNaText(html) {
  const d = document.createElement('div');
  d.innerHTML = html.replace(/<\/(p|div|h\d|li|tr|blockquote)>/gi, '$&\n');
  return d.textContent.replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

// ---------------------------------------------------------------- dokument
const BLOK = 'p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, td, th, div';

export class Dokument {
  constructor({ onZmena, onVyber, onStrankovani, onObnova, onHistorie } = {}) {
    this.id = 'd' + Math.random().toString(36).slice(2, 8);
    this.onZmena = onZmena;
    this.onObnova = onObnova;
    this.onHistorie = onHistorie;
    this.uprava = null;             // právě upravované záhlaví/zápatí { kde, strana }
    this.onVyber = onVyber;
    this.onStrankovani = onStrankovani;
    this.nast = vychoziNastaveni();
    this.g = geometrie(this.nast);
    this.rezim = 'tisk';           // tisk | web | cteni
    this.meritko = 1;
    this.pocetStran = 1;
    this.rozsah = null;
    this.hist = { list: [], i: -1 };
    this.cekani = null;
    this.velikostCeka = null;       // velikost písma pro „xxx-large“ z execCommand

    this.ed = el('div.ps-ed.ps-obsah', { contenteditable: 'true', spellcheck: 'true', lang: 'cs', 'data-ps': this.id, role: 'textbox', 'aria-multiline': 'true' });
    this.pravidla = el('style');
    this.stranky = el('div.ps-stranky');
    this.list = el('div.ps-list', {}, this.pravidla, this.stranky, this.ed);
    this.obal = el('div.ps-obal', {}, this.list);     // má rozměr po zvětšení (transform nemění layout)

    this.ed.addEventListener('input', (e) => this.priVstupu(e));
    this.ed.addEventListener('focus', () => { try { document.execCommand('styleWithCSS', false, true); document.execCommand('defaultParagraphSeparator', false, 'p'); } catch { /* starý prohlížeč */ } });
    this.naVyber = () => {
      const s = getSelection();
      if (s.rangeCount && this.ed.contains(s.anchorNode)) {
        this.rozsah = s.getRangeAt(0).cloneRange();
        this.onVyber?.();
      }
    };
    document.addEventListener('selectionchange', this.naVyber);
    this.ro = new ResizeObserver(() => this.planujStrankovani());
    this.ro.observe(this.ed);
  }

  znic() {
    document.removeEventListener('selectionchange', this.naVyber);
    this.ro.disconnect();
    clearTimeout(this.cekani);
  }

  // ------------------------------------------------ obsah
  nacti(html, nast) {
    this.nast = { ...vychoziNastaveni(), ...nast };
    this.ed.innerHTML = vycisti(html);
    this.normalizuj();
    this.hist = { list: [], i: -1 };
    this.zaznam('Otevřít');
    this.rozsah = null;
    this.prekresli();
  }

  get html() {
    const k = this.ed.cloneNode(true);
    k.querySelectorAll('.ps-vybrany').forEach((n) => n.classList.remove('ps-vybrany'));
    k.querySelectorAll('[class=""]').forEach((n) => n.removeAttribute('class'));
    return k.innerHTML;
  }

  get text() { return this.ed.innerText; }

  /** Opraví to, co po sobě nechává contenteditable. */
  normalizuj() {
    const ed = this.ed;
    // mezery mezi bloky by při white-space: pre-wrap byly vidět jako prázdné řádky
    for (const n of [...ed.childNodes]) {
      if (n.nodeType === 3 && !n.data.trim()) n.remove();
    }
    ed.querySelectorAll('ul, ol, table, tbody, tr').forEach((b) => {
      for (const n of [...b.childNodes]) if (n.nodeType === 3 && !n.data.trim()) n.remove();
    });
    // holý text nebo inline prvky přímo v editoru → odstavec
    let p = null;
    for (const n of [...ed.childNodes]) {
      const inline = n.nodeType === 3 || (n.nodeType === 1 && !n.matches('p, h1, h2, h3, h4, h5, h6, ul, ol, table, blockquote, pre, div, hr, figure'));
      if (inline) {
        if (!p) { p = document.createElement('p'); ed.insertBefore(p, n); }
        p.append(n);
      } else p = null;
    }
    // seznam vnořený do odstavce (vložený obsah, starší dokumenty) → seznam
    ed.querySelectorAll(':scope > p > ul, :scope > p > ol').forEach((s) => {
      const p = s.parentElement;
      const jenSeznam = [...p.childNodes].every((n) => n === s || (n.nodeType === 3 ? !n.data.trim() : n.tagName === 'BR'));
      if (jenSeznam) p.replaceWith(s); else p.after(s);
    });
    if (!ed.firstElementChild) ed.innerHTML = '<p><br></p>';
    // velikost písma z execCommand('fontSize', 7)
    ed.querySelectorAll('span[style*="xxx-large"], font[size="7"]').forEach((s) => {
      const v = this.velikostCeka || 12;
      if (s.tagName === 'FONT') {
        const sp = document.createElement('span');
        sp.style.fontSize = v + 'pt';
        sp.append(...s.childNodes);
        s.replaceWith(sp);
      } else s.style.fontSize = v + 'pt';
    });
    // prázdné spany bez stylu
    ed.querySelectorAll('span:not([class]):not([style])').forEach((s) => s.replaceWith(...s.childNodes));
  }

  // ------------------------------------------------ vstup a historie
  priVstupu(e) {
    if (e.inputType === 'historyUndo' || e.inputType === 'historyRedo') return;
    if (this.ed.querySelector('span[style*="xxx-large"], font[size="7"]')) this.normalizuj();
    if (!this.ed.firstElementChild) this.ed.innerHTML = '<p><br></p>';
    clearTimeout(this.cekani);
    this.cekani = setTimeout(() => { this.cekani = null; this.zaznam('Psaní'); }, 600);
    this.planujStrankovani();
    this.onZmena?.();
  }

  dokonciPsani() {
    if (!this.cekani) return;
    clearTimeout(this.cekani);
    this.cekani = null;
    this.zaznam('Psaní');
  }

  zaznam(popis) {
    const html = this.ed.innerHTML;
    const nast = JSON.stringify(this.nast);
    const h = this.hist;
    const vyber = this.ulozVyber();
    const posl = h.list[h.i];
    if (posl && posl.html === html && posl.nast === nast) { posl.vyber = vyber; this.onHistorie?.(); return false; }
    h.list.splice(h.i + 1);
    h.list.push({ html, nast, vyber, popis });
    if (h.list.length > 150) h.list.shift();
    h.i = h.list.length - 1;
    this.onHistorie?.();
    return true;
  }

  get muzeZpet() { return this.hist.i > 0 || !!this.cekani; }
  get muzeZnovu() { return this.hist.i < this.hist.list.length - 1; }
  get popisZpet() { return this.cekani ? 'Psaní' : this.hist.list[this.hist.i]?.popis; }

  zpet(kroku = 1) {
    this.dokonciPsani();
    if (this.hist.i <= 0) return;
    this.hist.i = Math.max(0, this.hist.i - kroku);
    this.obnovStav(this.hist.list[this.hist.i]);
  }

  znovu() {
    if (!this.muzeZnovu) return;
    this.hist.i++;
    this.obnovStav(this.hist.list[this.hist.i]);
  }

  obnovStav(s) {
    this.ed.innerHTML = s.html;
    if (s.nast) this.nast = JSON.parse(s.nast);
    this.obnovVyber(s.vyber);
    this.onObnova?.();
    this.prekresli();
    this.onZmena?.();
    this.onHistorie?.();
  }

  // ------------------------------------------------ výběr
  cesta(n) {
    const p = [];
    while (n && n !== this.ed) {
      if (!n.parentNode) return null;
      p.unshift([...n.parentNode.childNodes].indexOf(n));
      n = n.parentNode;
    }
    return n === this.ed ? p : null;
  }

  uzel(p) {
    let n = this.ed;
    for (const i of p) { n = n?.childNodes[i]; }
    return n || null;
  }

  ulozVyber() {
    const r = this.aktualniRozsah();
    if (!r) return null;
    const a = this.cesta(r.startContainer), b = this.cesta(r.endContainer);
    return a && b ? { a, ao: r.startOffset, b, bo: r.endOffset } : null;
  }

  obnovVyber(v) {
    if (!v) return;
    const a = this.uzel(v.a), b = this.uzel(v.b);
    if (!a || !b) return;
    try {
      const r = document.createRange();
      r.setStart(a, Math.min(v.ao, a.length ?? a.childNodes.length));
      r.setEnd(b, Math.min(v.bo, b.length ?? b.childNodes.length));
      this.nastavRozsah(r);
    } catch { /* neplatná pozice */ }
  }

  aktualniRozsah() {
    const s = getSelection();
    if (s.rangeCount && this.ed.contains(s.anchorNode)) return s.getRangeAt(0);
    return this.rozsah && this.ed.contains(this.rozsah.startContainer) ? this.rozsah : null;
  }

  nastavRozsah(r) {
    this.rozsah = r.cloneRange();
    if (document.activeElement !== this.ed) this.ed.focus({ preventScroll: true });
    const s = getSelection();
    s.removeAllRanges();
    s.addRange(r);
  }

  /** Vrátí fokus a výběr do editoru (po kliknutí do pásu karet nebo pole). */
  vratVyber() {
    const s = getSelection();
    if (s.rangeCount && this.ed.contains(s.anchorNode) && document.activeElement === this.ed) return;
    this.ed.focus({ preventScroll: true });
    if (this.rozsah && this.ed.contains(this.rozsah.startContainer)) {
      s.removeAllRanges();
      s.addRange(this.rozsah);
    } else {
      const r = document.createRange();
      r.selectNodeContents(this.ed.firstElementChild || this.ed);
      r.collapse(true);
      s.removeAllRanges();
      s.addRange(r);
      this.rozsah = r.cloneRange();
    }
  }

  kurzorNaKonec() {
    const r = document.createRange();
    const posl = this.ed.lastElementChild || this.ed;
    r.selectNodeContents(posl);
    r.collapse(false);
    this.nastavRozsah(r);
  }

  get vybranyText() {
    const r = this.aktualniRozsah();
    return r && !r.collapsed ? r.toString() : '';
  }

  /** Nejvnitřnější bloky, kterých se výběr dotýká. */
  vybraneBloky() {
    const r = this.aktualniRozsah();
    if (!r) return [];
    const vse = [...this.ed.querySelectorAll(BLOK)].filter((e) => {
      try { return r.intersectsNode(e); } catch { return false; }
    });
    return vse.filter((e) => !vse.some((o) => o !== e && e.contains(o)));
  }

  /** Prvek, ve kterém stojí kurzor. */
  prvekKurzoru() {
    const r = this.aktualniRozsah();
    if (!r) return null;
    let n = r.startContainer;
    if (n.nodeType === 1 && n.childNodes[r.startOffset] && n.childNodes[r.startOffset].nodeType === 1 && r.collapsed) n = n.childNodes[r.startOffset];
    return n.nodeType === 3 ? n.parentElement : n;
  }

  blokKurzoru() {
    const p = this.prvekKurzoru();
    return p?.closest?.('p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, td, th, div:not(.ps-ed)') || null;
  }

  /** Projde textové uzly výběru a přepíše je funkcí (délka textu se nemění). */
  upravText(fn) {
    const r = this.aktualniRozsah();
    if (!r || r.collapsed) return false;
    const koren = r.commonAncestorContainer.nodeType === 3 ? r.commonAncestorContainer.parentNode : r.commonAncestorContainer;
    const w = document.createTreeWalker(koren, NodeFilter.SHOW_TEXT);
    const kusy = [];
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (!r.intersectsNode(n)) continue;
      const a = n === r.startContainer ? r.startOffset : 0;
      const b = n === r.endContainer ? r.endOffset : n.length;
      if (b > a) kusy.push({ n, a, b });
    }
    const cely = kusy.map((k) => k.n.data.slice(k.a, k.b)).join('');
    const novy = fn(cely);
    let i = 0;
    for (const k of kusy) {
      const d = k.b - k.a;
      k.n.data = k.n.data.slice(0, k.a) + novy.slice(i, i + d) + k.n.data.slice(k.b);
      i += d;
    }
    return true;
  }

  /** Pozice v bloku jako počet znaků od jeho začátku (přežije přestavbu DOM). */
  textovaPozice(blok, uzel, offset) {
    const r = document.createRange();
    r.setStart(blok, 0);
    try { r.setEnd(uzel, offset); } catch { return 0; }
    return r.toString().length;
  }

  bodZPozice(blok, o) {
    const w = document.createTreeWalker(blok, NodeFilter.SHOW_TEXT);
    let posl = null;
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (o <= n.length) return [n, o];
      o -= n.length;
      posl = n;
    }
    return posl ? [posl, posl.length] : [blok, 0];
  }

  /**
   * Odrážky / číslování bez execCommand — Chrome jinak vkládá <ul> dovnitř <p>.
   * typ 'ul' | 'ol'; styl = list-style-type (undefined = jen přepnout).
   */
  prepniSeznam(typ, styl) {
    const r = this.aktualniRozsah();
    const bloky = this.vybraneBloky().filter((b) => !b.matches('td, th, div.ps-textpole, .ps-toc, .ps-titulni'));
    if (!r || !bloky.length) return;
    const najdi = (uzel) => bloky.findIndex((b) => b.contains(uzel)) ;
    const ia = Math.max(0, najdi(r.startContainer)), ib = Math.max(0, najdi(r.endContainer));
    const pa = this.textovaPozice(bloky[ia], r.startContainer, r.startOffset);
    const pb = this.textovaPozice(bloky[ib], r.endContainer, r.endOffset);
    const TAG = typ.toUpperCase();
    const nove = [];

    const zrusit = styl === undefined && bloky.every((b) => b.tagName === 'LI' && b.parentElement.tagName === TAG);
    if (zrusit) {
      for (const li of bloky) {
        const seznam = li.parentElement;
        const p = document.createElement('p');
        p.append(...[...li.childNodes].filter((n) => !(n.nodeType === 1 && n.matches('ul, ol'))));
        if (!p.firstChild) p.innerHTML = '<br>';
        const za = [...seznam.children].slice([...seznam.children].indexOf(li) + 1);
        const vnorene = [...li.children].filter((n) => n.matches('ul, ol'));
        seznam.after(p);
        if (za.length || vnorene.length) {
          const druhy = seznam.cloneNode(false);
          vnorene.forEach((v) => druhy.append(...v.children));
          druhy.append(...za);
          p.after(druhy);
        }
        li.remove();
        if (!seznam.children.length) seznam.remove();
        nove.push(p);
      }
    } else {
      let seznam = null;
      for (const b of bloky) {
        if (b.tagName === 'LI') {
          let s = b.parentElement;
          if (s.tagName !== TAG) {
            const n = document.createElement(typ);
            n.append(...s.childNodes);
            s.replaceWith(n);
            s = n;
          }
          seznam = s;
          nove.push(b);
          continue;
        }
        const li = document.createElement('li');
        li.append(...b.childNodes);
        if (!li.firstChild) li.innerHTML = '<br>';
        const pred = b.previousElementSibling;
        if (seznam && seznam.nextElementSibling === b) seznam.append(li);
        else if (!seznam && pred && pred.tagName === TAG && pred.parentElement === b.parentElement) { seznam = pred; seznam.append(li); }
        else {
          seznam = document.createElement(typ);
          b.before(seznam);
          seznam.append(li);
        }
        b.remove();
        nove.push(li);
      }
      // navázat na následující seznam stejného typu
      const dalsi = seznam?.nextElementSibling;
      if (dalsi && dalsi.tagName === TAG && styl === undefined) { seznam.append(...dalsi.children); dalsi.remove(); }
      if (seznam && styl !== undefined) {
        seznam.classList.toggle('ps-viceur', styl === 'viceur');
        seznam.style.listStyleType = styl && styl !== 'viceur' ? styl : '';
      }
    }
    const [a, ao] = this.bodZPozice(nove[ia] || nove[0], pa);
    const [z, zo] = this.bodZPozice(nove[ib] || nove[nove.length - 1], pb);
    const nr = document.createRange();
    try { nr.setStart(a, ao); nr.setEnd(z, zo); } catch { nr.selectNodeContents(nove[0]); nr.collapse(true); }
    this.nastavRozsah(nr);
  }

  /** Obalí výběr (i přes více odstavců) spanem se stylem — trik přes dočasný odkaz. */
  obalVyber(nastav) {
    const znacka = '#ps-obal-' + Math.random().toString(36).slice(2, 8);
    document.execCommand('createLink', false, znacka);
    const nove = [...this.ed.querySelectorAll(`a[href="${znacka}"]`)];
    for (const a of nove) {
      const s = document.createElement('span');
      nastav(s);
      s.append(...a.childNodes);
      a.replaceWith(s);
    }
    return nove.length;
  }

  // ------------------------------------------------ stránky
  nastavGeometrii(nast) {
    Object.assign(this.nast, nast);
    this.prekresli();
  }

  prekresli() {
    this.g = geometrie(this.nast);
    const g = this.g;
    const web = this.rezim !== 'tisk';
    this.list.classList.toggle('ps-web', web);
    Object.assign(this.ed.style, web ? { left: '', top: '', width: '' } : { left: g.ml + 'px', top: g.mt + 'px', width: g.sirka + 'px' });
    this.ed.style.minHeight = web ? '' : g.vyska + 'px';
    this.list.style.width = web ? '' : g.w + 'px';
    this.strankuj();
  }

  planujStrankovani() {
    if (this.ceka) return;
    this.ceka = requestAnimationFrame(() => { this.ceka = null; this.strankuj(); });
  }

  bloky() {
    const out = [];
    [...this.ed.children].forEach((c, i) => {
      if (c.matches('ul, ol')) [...c.children].forEach((li, j) => out.push({ el: li, sel: `:nth-child(${i + 1}) > :nth-child(${j + 1})` }));
      else out.push({ el: c, sel: `:nth-child(${i + 1})` });
    });
    return out;
  }

  strankuj() {
    const g = this.g;
    const pref = `.ps-ed[data-ps="${this.id}"] > `;
    if (this.rezim !== 'tisk') {
      this.pravidla.textContent = '';
      this.pocetStran = 1;
      this.kresliStranky();
      return;
    }
    const pravidla = [];
    this.pravidla.textContent = '';
    let vynutit = -1;
    let konecDok = 0;
    for (const b of this.bloky()) {
      const e = b.el;
      if (e.matches('hr.ps-zlom')) {
        vynutit = Math.floor(e.offsetTop / g.rozestup) + 1;
        konecDok = Math.max(konecDok, vynutit * g.rozestup + 1);
        continue;
      }
      const top = e.offsetTop, vys = e.offsetHeight;
      const k = Math.floor(top / g.rozestup);
      const konec = k * g.rozestup + g.vyska;
      let cil = null;
      if (vynutit > k) cil = vynutit * g.rozestup;
      else if (top >= konec - 1) cil = (k + 1) * g.rozestup;
      else if (top + vys > konec + 1 && vys <= g.vyska && top > k * g.rozestup + 1) cil = (k + 1) * g.rozestup;
      vynutit = -1;
      if (cil !== null) {
        let m = (parseFloat(getComputedStyle(e).marginTop) || 0) + (cil - top);
        pravidla.push(`${pref}${b.sel} { margin-top: ${m.toFixed(2)}px !important; }`);
        this.pravidla.textContent = pravidla.join('\n');
        const odchylka = cil - e.offsetTop;
        if (Math.abs(odchylka) > 0.5) {
          m += odchylka;
          pravidla[pravidla.length - 1] = `${pref}${b.sel} { margin-top: ${m.toFixed(2)}px !important; }`;
          this.pravidla.textContent = pravidla.join('\n');
        }
      }
      konecDok = Math.max(konecDok, e.offsetTop + e.offsetHeight);
    }
    this.pocetStran = Math.max(1, Math.floor(Math.max(0, konecDok - 1) / g.rozestup) + 1);
    this.kresliStranky();
  }

  kresliStranky() {
    const g = this.g, n = this.nast;
    const web = this.rezim !== 'tisk';
    const upravovane = () => this.uprava && this.stranky.querySelector(`.ps-strana[data-strana="${this.uprava.strana}"] .ps-${this.uprava.kde}`);
    const rozepsane = upravovane();
    if (rozepsane) n[this.uprava.kde] = rozepsane.innerHTML;
    this.stranky.replaceChildren();
    if (web) {
      this.list.style.height = '';
      this.list.style.background = n.barvaStranky || '';
      this.nastavMeritko(this.meritko);
      this.onStrankovani?.();
      return;
    }
    this.list.style.background = '';
    for (let k = 0; k < this.pocetStran; k++) {
      const s = el('div.ps-strana', {
        style: { top: k * g.rozestup + 'px', width: g.w + 'px', height: g.h + 'px', background: n.barvaStranky || '#fff' },
        dataset: { strana: k + 1 },
      });
      if (n.ohraniceni) s.append(el('div.ps-ramecek'));
      if (n.vodoznak) s.append(el('div.ps-vodoznak', {}, el('span', { text: n.vodoznak })));
      const hlava = el('div.ps-zahlavi.ps-obsah', { style: { left: g.ml + 'px', width: g.sirka + 'px', top: 12.5 * MM + 'px' } });
      const pata = el('div.ps-zapati.ps-obsah', { style: { left: g.ml + 'px', width: g.sirka + 'px', bottom: 12.5 * MM + 'px' } });
      hlava.innerHTML = n.zahlavi || '';
      pata.innerHTML = n.zapati || '';
      for (const c of [...hlava.querySelectorAll('.ps-pole-cislo'), ...pata.querySelectorAll('.ps-pole-cislo')]) c.textContent = k + 1;
      for (const c of [...hlava.querySelectorAll('.ps-pole-pocet'), ...pata.querySelectorAll('.ps-pole-pocet')]) c.textContent = this.pocetStran;
      s.append(hlava, pata);
      this.stranky.append(s);
    }
    this.list.style.height = this.pocetStran * g.rozestup - MEZERA + 'px';
    const nove = upravovane();
    if (nove) nove.contentEditable = 'true';
    this.nastavMeritko(this.meritko);
    this.onStrankovani?.();
  }

  nastavMeritko(m) {
    this.meritko = m;
    this.list.style.transform = m === 1 ? '' : `scale(${m})`;
    if (this.rezim === 'tisk') {
      this.obal.style.width = this.g.w * m + 'px';
      this.obal.style.height = (this.pocetStran * this.g.rozestup - MEZERA) * m + 'px';
    } else {
      this.obal.style.width = '';
      this.obal.style.height = '';
    }
  }

  /** Stránka, na které je kurzor (1…). */
  stranaKurzoru() {
    if (this.rezim !== 'tisk') return 1;
    const r = this.aktualniRozsah();
    if (!r) return 1;
    let rect = r.getClientRects()[0];
    if (!rect) rect = (r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement).getBoundingClientRect();
    const lr = this.list.getBoundingClientRect();
    const y = (rect.top - lr.top) / this.meritko;
    return Math.min(this.pocetStran, Math.max(1, Math.floor(y / this.g.rozestup) + 1));
  }

  /** Statistika jako v dialogu Počet slov. */
  statistika(jenVyber = false) {
    const text = jenVyber ? this.vybranyText : this.ed.innerText;
    const slova = (text.match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu) || []).length;
    const odstavce = [...this.ed.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote, div')].filter((b) => b.textContent.trim()).length;
    const radky = [...this.ed.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote, div')].reduce((s, b) => {
      if (!b.textContent.trim()) return s;
      const lh = parseFloat(getComputedStyle(b).lineHeight) || 20;
      return s + Math.max(1, Math.round(b.offsetHeight / lh));
    }, 0);
    return {
      stranky: this.pocetStran, slova,
      znaky: text.replace(/\s/g, '').length,
      znakyMezery: text.replace(/\n/g, '').length,
      odstavce, radky,
    };
  }
}
