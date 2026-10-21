// AstroTabulky — model sešitu: listy, buňky, styly, přepočet, historie, strukturální úpravy
//
// Buňka je neměnný objekt { v, f, s, kom, pozn, odkaz, t } — každá změna vytvoří nový.
// Díky tomu je snímek pro Zpět jen kopie Map (buňky se sdílí) a nemusí se nic klonovat do hloubky.
// Vypočtené hodnoty vzorců žijí zvlášť (list.hodnoty, list.pole, list.presah) a do snímků nejdou.

import { klic, zKlice, MAX_R, MAX_C, rozeberOblast, textOblasti, obsahuje, prekryva, serad, pismena, jmenoListuVeVzorci, adresa } from './adresy.js';
import { rozpoznej, formatuj, jeChyba, Chyba, E, CHYBY, jeDatovyFormat, zeSerialu, serial, MESICE, MESICE_ZKR, DNY, DNY_ZKR, obecne } from './format.js';
import { parse, vyhodnot, Ref, naPole, normalizujVzorec, posunVzorec, upravPoVlozeni, upravPoPresunu, prejmenujList as prejmenujVeVzorci, smazanyList, FUNKCE, ANGLICKY, porovnej, kriterium, lex, predchudci, odkazyVeVzorci } from './vzorce.js';

export const VYCHOZI_SIRKA = 64;
export const VYCHOZI_VYSKA = 20;
export const VYCHOZI_PISMO = 'Aptos Narrow';
export const VYCHOZI_VELIKOST = 11;

let citacListu = 0;
const stromy = new Map();

function strom(text) {
  let s = stromy.get(text);
  if (s === undefined) {
    try { s = parse(text); } catch { s = null; }
    if (stromy.size > 5000) stromy.clear();
    stromy.set(text, s);
  }
  return s;
}

export function novyList(nazev) {
  return {
    id: ++citacListu, nazev,
    b: new Map(), sirky: new Map(), vysky: new Map(), skryteR: new Set(), skryteC: new Set(),
    stylS: new Map(), stylR: new Map(),
    sloucene: [], ukotveni: null, barva: null, skryty: false,
    mrizka: true, zahlavi: true, zoom: 1, zobrazitVzorce: false,
    podminene: [], validace: [], tabulky: [], filtr: null, grafy: [], obrazky: [], minigrafy: [], kontingencni: [], kresba: [], skupiny: [],
    zamek: null, tisk: {}, vyber: { r: 0, c: 0, oblasti: [{ r1: 0, c1: 0, r2: 0, c2: 0 }] }, posun: { x: 0, y: 0 },
    // vypočtené
    hodnoty: new Map(), pole: new Map(), presah: new Map(), starePresah: new Map(), skryteFiltrem: new Set(),
  };
}

const STRUKTURA = ['sloucene', 'ukotveni', 'podminene', 'validace', 'tabulky', 'filtr', 'grafy', 'obrazky', 'minigrafy', 'kontingencni', 'kresba', 'skupiny', 'zamek', 'tisk', 'vyber', 'posun'];

const zmrazStyl = (s) => (s && Object.keys(s).length ? Object.freeze(s) : null);

/** Sloučí změnu do stylu (null hodnoty mažou vlastnost). */
export function slozStyl(s, zmena) {
  const n = { ...(s || {}) };
  for (const [k, v] of Object.entries(zmena)) {
    if (v === null || v === undefined || v === false && k !== 'zamek') delete n[k];
    else n[k] = v;
  }
  return zmrazStyl(n);
}

export class Sesit {
  constructor() {
    this.listy = [novyList('List1')];
    this.aktivni = 0;
    this.nazvy = new Map();   // VELKÁ → { nazev, vzorec, rozsah: null | idListu, komentar }
    this.vypocet = 'auto';
    this.historie = { list: [], i: -1 };
    this.gen = 0;
    this.cyklus = null;
    this.onZmena = null;
    this.popisKroku = '';
    this.S = this.rozhrani();
    this.prepocitej();
    this.zalozHistorii();
  }

  get list() { return this.listy[this.aktivni]; }
  listPodleJmena(n) { const x = n.toLocaleLowerCase('cs'); return this.listy.find((l) => l.nazev.toLocaleLowerCase('cs') === x) || null; }
  listPodleId(id) { return this.listy.find((l) => l.id === id) || null; }

  // ------------------------------------------------------------ čtení
  bunka(list, r, c) { return list.b.get(klic(r, c)) || null; }

  hodnota(list, r, c) {
    const k = klic(r, c);
    const b = list.b.get(k);
    if (b) {
      if (b.f) return this.hodnotaVzorce(list, k, b);
      return b.v ?? null;
    }
    let a = list.presah.get(k);
    if (a === undefined && this.pocitani) {
      const stara = list.starePresah.get(k);
      if (stara !== undefined && list.b.get(stara)?.f) { this.hodnotaVzorce(list, stara, list.b.get(stara)); a = list.presah.get(k); }
      if (a === undefined) this.ctenePrazdne.add(list.id + ':' + k);
    }
    if (a !== undefined) {
      const pole = list.pole.get(a);
      const [ar, ac] = zKlice(a);
      return pole?.[r - ar]?.[c - ac] ?? null;
    }
    return null;
  }

  hodnotaVzorce(list, k, b) {
    if (list.hodnoty.has(k)) return list.hodnoty.get(k);
    const id = list.id + ':' + k;
    if (this.rozpocitane.has(id)) { this.cyklus = this.cyklus || { list: list.nazev, k }; return 0; }
    this.rozpocitane.add(id);
    const [r, c] = zKlice(k);
    const s = strom(b.f);
    let v;
    if (!s) v = E.NAZEV;
    else {
      const ctx = { S: this.S, list, r, c };
      v = vyhodnot(s, ctx);
      if (ctx.odkaz) list.odkazyVzorcu = (list.odkazyVzorcu || new Map()).set(k, ctx.odkaz);
    }
    if (v instanceof Ref) {
      if (v.jedna) v = this.hodnota(v.list, v.r1, v.c1);
      else v = naPole(v, { S: this.S, list, r, c });
    }
    if (Array.isArray(v)) {
      if (v.length === 1 && v[0].length === 1) v = v[0][0];
      else if (!v.length || !v[0].length) v = E.CALC;
      else v = this.rozlij(list, r, c, v);
    }
    if (v === null || v === undefined) v = 0;
    if (typeof v === 'number' && !isFinite(v)) v = E.CISLO;
    list.hodnoty.set(k, v);
    this.rozpocitane.delete(id);
    return v;
  }

  /** Dynamické pole: rozlije se do sousedních prázdných buněk, jinak #PŘESAH!. */
  rozlij(list, r, c, pole) {
    const R = pole.length, C = pole[0].length;
    if (r + R > MAX_R || c + C > MAX_C) return E.PRESAH;
    const kotva = klic(r, c);
    for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) {
      if (!i && !j) continue;
      const k = klic(r + i, c + j);
      const b = list.b.get(k);
      if ((b && (b.f || (b.v !== null && b.v !== undefined))) || (list.presah.has(k) && list.presah.get(k) !== kotva)) {
        list.blokovano = list.blokovano || new Map();
        list.blokovano.set(kotva, { r: R, c: C });
        return E.PRESAH;
      }
    }
    for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) if (i || j) list.presah.set(klic(r + i, c + j), kotva);
    list.pole.set(kotva, pole.map((row) => row.map((v) => (v === null || v === undefined ? 0 : v))));
    return pole[0][0] ?? 0;
  }

  /** Použitý rozsah listu (poslední řádek/sloupec s obsahem nebo formátem). */
  rozsah(list) {
    if (list._rozsah && list._rozsahGen === this.gen) return list._rozsah;
    let r = 0, c = 0;
    for (const k of list.b.keys()) { const [a, b] = zKlice(k); if (a > r) r = a; if (b > c) c = b; }
    for (const k of list.presah.keys()) { const [a, b] = zKlice(k); if (a > r) r = a; if (b > c) c = b; }
    list._rozsah = { r, c };
    list._rozsahGen = this.gen;
    return list._rozsah;
  }

  /** Oblast s daty (bez prázdných formátovaných buněk). */
  rozsahDat(list) {
    let r = -1, c = -1;
    for (const [k, b] of list.b) { if (b.f || (b.v !== null && b.v !== undefined)) { const [a, x] = zKlice(k); if (a > r) r = a; if (x > c) c = x; } }
    for (const k of list.presah.keys()) { const [a, x] = zKlice(k); if (a > r) r = a; if (x > c) c = x; }
    return { r, c };
  }

  projdi(list, o, fn) {
    const plocha = (o.r2 - o.r1 + 1) * (o.c2 - o.c1 + 1);
    if (plocha <= list.b.size + list.presah.size + 64) {
      for (let r = o.r1; r <= o.r2; r++) for (let c = o.c1; c <= o.c2; c++) {
        const v = this.hodnota(list, r, c);
        if (v !== null && v !== undefined) fn(r, c, v);
      }
      return;
    }
    const klice = [];
    for (const k of list.b.keys()) { const [r, c] = zKlice(k); if (r >= o.r1 && r <= o.r2 && c >= o.c1 && c <= o.c2) klice.push(k); }
    for (const k of list.presah.keys()) { const [r, c] = zKlice(k); if (r >= o.r1 && r <= o.r2 && c >= o.c1 && c <= o.c2) klice.push(k); }
    klice.sort((a, b) => a - b);
    for (const k of klice) {
      const [r, c] = zKlice(k);
      const v = this.hodnota(list, r, c);
      if (v !== null && v !== undefined) fn(r, c, v);
    }
  }

  rozhrani() {
    const S = this;
    return {
      list: (n) => S.listPodleJmena(n),
      hodnota: (l, r, c) => S.hodnota(l, r, c),
      bunka: (l, r, c) => S.bunka(l, r, c),
      rozsah: (l) => S.rozsah(l),
      projdi: (l, o, fn) => S.projdi(l, o, fn),
      skrytyRadek: (l, r) => l.skryteR.has(r) || l.skryteFiltrem.has(r),
      cisloListu: (l) => S.listy.indexOf(l) + 1,
      pocetListu: () => S.listy.length,
      nazev: (n, list) => S.vyhodnotNazev(n, list),
      strukturovany: (tab, spec, ctx) => S.strukturovany(tab, spec, ctx),
    };
  }

  // ------------------------------------------------------------ názvy
  najdiNazev(n, list) {
    const up = n.toLocaleUpperCase('cs');
    const d = this.nazvy.get(up + '@' + (list?.id ?? '')) || this.nazvy.get(up);
    return d || null;
  }
  vyhodnotNazev(n, list) {
    const d = this.najdiNazev(n, list);
    if (!d) {
      // název tabulky = oblast dat
      const t = this.tabulkaPodleJmena(n);
      if (t) return () => { const l = this.listPodleId(t.list); const o = oblastDatTabulky(t); return new Ref(l, o.r1, o.c1, o.r2, o.c2); };
      return null;
    }
    return (ctx) => {
      const s = strom(d.vzorec);
      if (!s) return E.NAZEV;
      const l = d.rozsah ? this.listPodleId(d.rozsah) || ctx.list : ctx.list;
      return vyhodnot(s, { ...ctx, list: l });
    };
  }
  definujNazev(nazev, vzorec, { rozsah = null, komentar = '' } = {}) {
    const up = nazev.toLocaleUpperCase('cs');
    this.nazvy.set(up + (rozsah ? '@' + rozsah : ''), { nazev, vzorec: vzorec[0] === '=' ? vzorec : '=' + vzorec, rozsah, komentar });
  }

  // ------------------------------------------------------------ tabulky (ListObject)
  tabulkaPodleJmena(n) {
    const x = n.toLocaleLowerCase('cs');
    for (const l of this.listy) for (const t of l.tabulky) if (t.nazev.toLocaleLowerCase('cs') === x) return { ...t, list: l.id };
    return null;
  }
  tabulkaV(list, r, c) { return list.tabulky.find((t) => obsahuje(t.oblast, r, c)) || null; }

  strukturovany(tab, spec, ctx) {
    let t = tab ? this.tabulkaPodleJmena(tab) : null;
    let l = t ? this.listPodleId(t.list) : ctx.list;
    if (!t) { const x = this.tabulkaV(ctx.list, ctx.r, ctx.c); if (x) t = { ...x, list: ctx.list.id }; }
    if (!t) return E.ODKAZ;
    const casti = [...spec.matchAll(/\[([^\[\]]*)\]/g)].map((m) => m[1]).filter((s) => s !== '');
    let radek = null, co = 'data', sloupce = [];
    for (const p of casti.length ? casti : [spec.replace(/^\[|\]$/g, '')]) {
      if (/^@/.test(p)) { radek = ctx.r; if (p.length > 1) sloupce.push(p.slice(1)); continue; }
      if (/^#/.test(p)) { co = p.toLowerCase(); continue; }
      if (p) sloupce.push(p);
    }
    const o = t.oblast;
    const hlavicka = t.zahlavi === false ? [] : [...Array(o.c2 - o.c1 + 1)].map((_, i) => String(this.hodnota(l, o.r1, o.c1 + i) ?? ''));
    const najdi = (n) => { const i = hlavicka.findIndex((h) => h.toLocaleLowerCase('cs') === n.replace(/'(.)/g, '$1').toLocaleLowerCase('cs')); if (i < 0) throw E.ODKAZ; return o.c1 + i; };
    let c1 = o.c1, c2 = o.c2;
    if (sloupce.length) { c1 = najdi(sloupce[0]); c2 = najdi(sloupce[sloupce.length - 1]); }
    const d = oblastDatTabulky(t);
    let r1 = d.r1, r2 = d.r2;
    if (co === '#vše' || co === '#all') { r1 = o.r1; r2 = o.r2; }
    else if (co === '#záhlaví' || co === '#headers') { r1 = r2 = o.r1; }
    else if (co === '#souhrny' || co === '#totals') { if (!t.souhrn) return E.ODKAZ; r1 = r2 = o.r2; }
    if (radek !== null) { r1 = r2 = radek; }
    return new Ref(l, r1, Math.min(c1, c2), r2, Math.max(c1, c2));
  }

  // ------------------------------------------------------------ přepočet
  prepocitej({ vynutit = false } = {}) {
    if (this.vypocet === 'rucne' && !vynutit) { this.cekaNaVypocet = true; return; }
    this.cekaNaVypocet = false;
    this.gen++;
    this.cyklus = null;
    for (let pruchod = 0; pruchod < 3; pruchod++) {
      for (const l of this.listy) {
        l.starePresah = pruchod ? l.presah : l.presah;
        l.hodnoty = new Map(); l.pole = new Map(); l.presah = new Map(); l.blokovano = null; l.odkazyVzorcu = null;
      }
      this.rozpocitane = new Set();
      this.ctenePrazdne = new Set();
      this.pocitani = true;
      for (const l of this.listy) for (const [k, b] of l.b) if (b.f) this.hodnotaVzorce(l, k, b);
      this.pocitani = false;
      // když něco četlo buňku, kam se pole rozlilo až později, spočítat znovu
      let znovu = false;
      for (const id of this.ctenePrazdne) {
        const [lid, k] = id.split(':');
        if (this.listPodleId(+lid)?.presah.has(+k)) { znovu = true; break; }
      }
      if (!znovu) break;
    }
    for (const l of this.listy) l.starePresah = new Map();
    this.cf = new Map();
  }

  // ------------------------------------------------------------ historie
  snimek() {
    return {
      listy: this.listy.map((l) => {
        const s = { ...l, b: new Map(l.b), sirky: new Map(l.sirky), vysky: new Map(l.vysky), skryteR: new Set(l.skryteR), skryteC: new Set(l.skryteC), stylS: new Map(l.stylS), stylR: new Map(l.stylR) };
        for (const k of STRUKTURA) s[k] = l[k] === undefined ? undefined : structuredClone(l[k]);
        s.hodnoty = s.pole = s.presah = s.starePresah = null;
        return s;
      }),
      aktivni: this.aktivni, nazvy: new Map(this.nazvy),
    };
  }
  obnovSnimek(s) {
    // objekty listů zůstávají stejné (UI si na ně drží odkazy), jen se jim vrátí obsah
    const puvodni = new Map(this.listy.map((l) => [l.id, l]));
    this.listy = s.listy.map((l) => {
      const n = puvodni.get(l.id) || {};
      for (const k of Object.keys(n)) if (!(k in l)) delete n[k];
      Object.assign(n, l, { b: new Map(l.b), sirky: new Map(l.sirky), vysky: new Map(l.vysky), skryteR: new Set(l.skryteR), skryteC: new Set(l.skryteC), stylS: new Map(l.stylS), stylR: new Map(l.stylR) });
      for (const k of STRUKTURA) n[k] = l[k] === undefined ? undefined : structuredClone(l[k]);
      n.hodnoty = new Map(); n.pole = new Map(); n.presah = new Map(); n.starePresah = new Map(); n.skryteFiltrem = new Set();
      n._rozsah = null;
      return n;
    });
    this.aktivni = Math.min(s.aktivni, this.listy.length - 1);
    this.nazvy = new Map(s.nazvy);
    for (const l of this.listy) if (l.filtr) this.pouzijFiltr(l);
    this.prepocitej();
  }

  /** Počátek historie (po otevření souboru). */
  zalozHistorii() {
    this.historie = { list: [{ snimek: this.snimek(), popis: 'Otevřít' }], i: 0 };
  }

  /** Každá úprava sešitu jde tudy: provede fn, přepočítá a zapíše krok do historie. */
  zmena(popis, fn, { prepocet = true, poVypoctu = null } = {}) {
    let vysledek;
    try { vysledek = fn(); } catch (e) {
      if (e instanceof ChybaUpravy) { this.obnovSnimek(this.historie.list[this.historie.i].snimek); throw e; }
      throw e;
    }
    if (vysledek === false) return false;
    if (prepocet) this.prepocitej();
    try { poVypoctu?.(); } catch (e) { console.warn('AstroTabulky: po výpočtu', e); }
    const h = this.historie;
    h.list = h.list.slice(0, h.i + 1);
    h.list.push({ snimek: this.snimek(), popis });
    if (h.list.length > 120) h.list.shift();
    h.i = h.list.length - 1;
    this.onZmena?.(popis);
    return vysledek ?? true;
  }

  get muzeZpet() { return this.historie.i > 0; }
  get muzeZnovu() { return this.historie.i < this.historie.list.length - 1; }
  get popisZpet() { return this.historie.list[this.historie.i]?.popis; }
  zpet(kroku = 1) {
    const h = this.historie;
    if (h.i <= 0) return false;
    h.i = Math.max(0, h.i - kroku);
    this.obnovSnimek(h.list[h.i].snimek);
    this.onZmena?.('zpet');
    return true;
  }
  znovu() {
    const h = this.historie;
    if (h.i >= h.list.length - 1) return false;
    h.i++;
    this.obnovSnimek(h.list[h.i].snimek);
    this.onZmena?.('znovu');
    return true;
  }

  // ------------------------------------------------------------ styly
  stylBunky(list, r, c) {
    const b = list.b.get(klic(r, c));
    if (b?.s) return b.s;
    return list.stylR.get(r) || list.stylS.get(c) || null;
  }

  /** Efektivní styl včetně podmíněného formátování a stylu tabulky (pro vykreslení). */
  format(list, r, c) {
    return this.stylBunky(list, r, c);
  }

  // ------------------------------------------------------------ zápis buněk
  zapis(list, r, c, bunka) {
    const k = klic(r, c);
    const puvodni = list.b.get(k);
    if (!bunka || (!bunka.f && (bunka.v === null || bunka.v === undefined) && !bunka.s && !bunka.kom && !bunka.pozn && !bunka.odkaz)) {
      // prázdná buňka bez formátu — ale když má řádek/sloupec styl, buňka se styl nepotřebuje
      if (puvodni) list.b.delete(k);
      return;
    }
    const b = {};
    for (const [x, v] of Object.entries(bunka)) if (v !== null && v !== undefined && v !== '' || (x === 'v' && v === '')) b[x] = v;
    list.b.set(k, Object.freeze(b));
  }

  zkontrolujZamek(list, oblasti) {
    if (!list.zamek) return;
    for (const o of oblasti) {
      for (let r = o.r1; r <= Math.min(o.r2, o.r1 + 2000); r++) for (let c = o.c1; c <= Math.min(o.c2, o.c1 + 200); c++) {
        const s = this.stylBunky(list, r, c);
        if (!s || s.zamek !== false) throw new ChybaUpravy('Buňka nebo graf, které se pokoušíte změnit, jsou na zamknutém listu. Změny provedete po odemknutí listu (Revize › Odemknout list). Může být vyžadováno heslo.', 'zamek');
      }
    }
  }

  /** Text od uživatele → buňka (rozpozná vzorec, číslo, datum, procenta…). */
  zadej(list, r, c, text, { vynutitText = false } = {}) {
    const k = klic(r, c);
    const b = list.b.get(k) || {};
    const styl = this.stylBunky(list, r, c);
    const jeTextFormat = styl?.nf === '@';
    if (text === '' || text === null) { this.zapis(list, r, c, { ...b, v: null, f: null, t: null, s: b.s }); return; }
    if (vynutitText || jeTextFormat) { this.zapis(list, r, c, { ...b, v: String(text), f: null, t: null, s: b.s || (list.stylR.get(r) || list.stylS.get(c)) }); return; }
    const p = rozpoznej(text);
    let s = b.s || list.stylR.get(r) || list.stylS.get(c) || null;
    if (p.vzorec) {
      const f = normalizujVzorec(p.vzorec);
      if (!strom(f)) throw new ChybaUpravy('Chyba ve vzorci. Zkontrolujte závorky, středníky a názvy funkcí.', 'vzorec');
      if (!s?.nf) {
        const nf = this.formatZVzorce(list, f);
        if (nf) s = slozStyl(s, { nf });
      }
      this.zapis(list, r, c, { ...b, v: null, f, t: null, s });
      this.rozsirTabulku(list, r, c);
      return;
    }
    if (p.format && (!s?.nf || /^general$/i.test(s.nf))) s = slozStyl(s, { nf: p.format });
    else if (p.format && s?.nf && jeDatovyFormat(p.format) !== jeDatovyFormat(s.nf)) s = slozStyl(s, { nf: p.format });
    if (typeof p.v === 'string' && /\n/.test(p.v) && !s?.zalam) s = slozStyl(s, { zalam: true });
    this.zapis(list, r, c, { ...b, v: p.v, f: null, t: p.text ? 1 : null, s });
    this.rozsirTabulku(list, r, c);
  }

  /** Automatický formát výsledku (DNES → datum, =A1+1 s datem v A1 → datum). */
  formatZVzorce(list, f) {
    const s = strom(f);
    if (!s) return null;
    if (s.t === 'fn') {
      const d = FUNKCE[s.n] || FUNKCE[ANGLICKY[s.n]];
      if (d?.format) return d.format;
    }
    const prvni = (n) => {
      if (!n) return null;
      if (n.t === 'ref') return n;
      if (n.t === 'bin' && ['+', '-'].includes(n.op)) return prvni(n.a);
      if (n.t === 'fn' && ['SUMA', 'MIN', 'MAX', 'PRŮMĚR', 'KDYŽ', 'ZAOKROUHLIT'].includes(n.n)) return prvni(n.args[n.n === 'KDYŽ' ? 1 : 0]);
      return null;
    };
    const ref = prvni(s);
    if (ref) {
      const l = ref.list ? this.listPodleJmena(ref.list) : list;
      const st = l && this.stylBunky(l, ref.r1, ref.c1);
      if (st?.nf && !/^general$/i.test(st.nf) && st.nf !== '@') return st.nf;
    }
    return null;
  }

  vymaz(list, oblasti, co = 'vse') {
    this.zkontrolujZamek(list, oblasti);
    for (const o of oblasti) {
      const klice = this.kliceVOblasti(list, o);
      for (const k of klice) {
        const b = list.b.get(k);
        if (!b) continue;
        const [r, c] = zKlice(k);
        if (co === 'vse') this.zapis(list, r, c, null);
        else if (co === 'obsah') this.zapis(list, r, c, { ...b, v: null, f: null, t: null });
        else if (co === 'formaty') this.zapis(list, r, c, { ...b, s: null });
        else if (co === 'komentare') this.zapis(list, r, c, { ...b, kom: null, pozn: null });
        else if (co === 'odkazy') this.zapis(list, r, c, { ...b, odkaz: null, s: b.s ? slozStyl(b.s, { u: null, barva: null }) : null });
      }
      if (co === 'vse' || co === 'formaty') {
        if (o.c1 === 0 && o.c2 === MAX_C - 1) for (let r = o.r1; r <= o.r2; r++) list.stylR.delete(r);
        if (o.r1 === 0 && o.r2 === MAX_R - 1) for (let c = o.c1; c <= o.c2; c++) list.stylS.delete(c);
        list.podminene = list.podminene.filter((p) => !(p.oblasti || [p.oblast]).every((x) => obsahujeOblast(o, x)));
      }
      if (co === 'vse') list.sloucene = list.sloucene.filter((m) => !prekryva(m, o));
    }
  }

  kliceVOblasti(list, o) {
    const plocha = (o.r2 - o.r1 + 1) * (o.c2 - o.c1 + 1);
    const out = [];
    if (plocha < list.b.size) {
      for (let r = o.r1; r <= o.r2; r++) for (let c = o.c1; c <= o.c2; c++) { const k = klic(r, c); if (list.b.has(k)) out.push(k); }
    } else for (const k of list.b.keys()) { const [r, c] = zKlice(k); if (r >= o.r1 && r <= o.r2 && c >= o.c1 && c <= o.c2) out.push(k); }
    return out;
  }

  /** Změní styl v oblastech. zmena = objekt (sloučí se) nebo funkce (styl, r, c) → styl. */
  stylOblasti(list, oblasti, zmena) {
    const fn = typeof zmena === 'function' ? zmena : (s) => slozStyl(s, zmena);
    for (const o of oblasti) {
      const celeRadky = o.c1 === 0 && o.c2 === MAX_C - 1;
      const celeSloupce = o.r1 === 0 && o.r2 === MAX_R - 1;
      if (celeRadky || celeSloupce) {
        if (celeRadky && !celeSloupce) for (let r = o.r1; r <= o.r2; r++) list.stylR.set(r, fn(list.stylR.get(r) || null, r, -1));
        if (celeSloupce && !celeRadky) for (let c = o.c1; c <= o.c2; c++) list.stylS.set(c, fn(list.stylS.get(c) || null, -1, c));
        if (celeRadky && celeSloupce) {
          for (const [c, s] of list.stylS) list.stylS.set(c, fn(s, -1, c));
          this.vychoziStyl = fn(this.vychoziStyl || null, -1, -1);
        }
        for (const k of this.kliceVOblasti(list, o)) {
          const [r, c] = zKlice(k);
          const b = list.b.get(k);
          this.zapis(list, r, c, { ...b, s: fn(this.stylBunky(list, r, c), r, c) });
        }
        continue;
      }
      for (let r = o.r1; r <= o.r2; r++) for (let c = o.c1; c <= o.c2; c++) {
        const b = list.b.get(klic(r, c)) || {};
        this.zapis(list, r, c, { ...b, s: fn(this.stylBunky(list, r, c), r, c) });
      }
    }
  }

  /** Ohraničení jako tlačítko v Excelu: typ dolni|horni|leve|prave|vsechna|vnejsi|tlusteVnejsi|zadne|… */
  ohranic(list, o, typ, cara = { s: 'tenka', b: '#000000' }) {
    const set = (s, strany) => {
      const ohr = { ...(s?.ohr || {}) };
      for (const [k, v] of Object.entries(strany)) { if (v) ohr[k] = v; else delete ohr[k]; }
      return slozStyl(s, { ohr: Object.keys(ohr).length ? ohr : null });
    };
    const tl = { ...cara, s: 'tlusta' };
    const dvojita = { ...cara, s: 'dvojita' };
    this.stylOblasti(list, [o], (s, r, c) => {
      const h = r === o.r1, d = r === o.r2, l = c === o.c1, p = c === o.c2;
      switch (typ) {
        case 'dolni': return d ? set(s, { b: cara }) : s;
        case 'horni': return h ? set(s, { t: cara }) : s;
        case 'leve': return l ? set(s, { l: cara }) : s;
        case 'prave': return p ? set(s, { r: cara }) : s;
        case 'zadne': return slozStyl(s, { ohr: null });
        case 'vsechna': return set(s, { t: cara, b: cara, l: cara, r: cara });
        case 'vnejsi': return set(s, { ...(h ? { t: cara } : {}), ...(d ? { b: cara } : {}), ...(l ? { l: cara } : {}), ...(p ? { r: cara } : {}) });
        case 'tlusteVnejsi': return set(s, { ...(h ? { t: tl } : {}), ...(d ? { b: tl } : {}), ...(l ? { l: tl } : {}), ...(p ? { r: tl } : {}) });
        case 'dvojitaDolni': return d ? set(s, { b: dvojita }) : s;
        case 'tlustaDolni': return d ? set(s, { b: tl }) : s;
        case 'horniDolni': return set(s, { ...(h ? { t: cara } : {}), ...(d ? { b: cara } : {}) });
        case 'horniTlustaDolni': return set(s, { ...(h ? { t: cara } : {}), ...(d ? { b: tl } : {}) });
        case 'horniDvojitaDolni': return set(s, { ...(h ? { t: cara } : {}), ...(d ? { b: dvojita } : {}) });
        case 'vnitrni': return set(s, { ...(!d ? { b: cara } : {}), ...(!p ? { r: cara } : {}) });
        default: return s;
      }
    });
    // sousední buňky: spodní okraj horní buňky = horní okraj dolní (Excel je spojuje) — kreslí se ze stylu obou
  }

  // ------------------------------------------------------------ sloučení
  sloucenaV(list, r, c) { return list.sloucene.find((m) => obsahuje(m, r, c)) || null; }

  sluc(list, o, typ = 'stred') {
    if (typ === 'zrusit') { list.sloucene = list.sloucene.filter((m) => !prekryva(m, o)); return; }
    const oblasti = typ === 'pres' ? Array.from({ length: o.r2 - o.r1 + 1 }, (_, i) => ({ r1: o.r1 + i, r2: o.r1 + i, c1: o.c1, c2: o.c2 })) : [o];
    for (const m of oblasti) {
      if (m.r1 === m.r2 && m.c1 === m.c2) continue;
      list.sloucene = list.sloucene.filter((x) => !prekryva(x, m));
      // hodnota zůstane jen z levé horní buňky (Excel na to upozorní)
      for (const k of this.kliceVOblasti(list, m)) {
        const [r, c] = zKlice(k);
        if (r === m.r1 && c === m.c1) continue;
        const b = list.b.get(k);
        this.zapis(list, r, c, { ...b, v: null, f: null });
      }
      list.sloucene.push({ ...m });
      if (typ === 'stred') {
        const b = list.b.get(klic(m.r1, m.c1)) || {};
        this.zapis(list, m.r1, m.c1, { ...b, s: slozStyl(this.stylBunky(list, m.r1, m.c1), { h: 'c' }) });
      }
    }
  }

  /** Kolik hodnot by sloučení zahodilo (pro varování). */
  hodnotyKeZtrate(list, o) {
    let n = 0;
    for (const k of this.kliceVOblasti(list, o)) {
      const [r, c] = zKlice(k);
      const b = list.b.get(k);
      if ((r !== o.r1 || c !== o.c1) && (b.f || (b.v !== null && b.v !== undefined))) n++;
    }
    return n;
  }

  // ------------------------------------------------------------ rozměry
  sirka(list, c) { if (list.skryteC.has(c)) return 0; return list.sirky.get(c) ?? list.vychoziSirka ?? VYCHOZI_SIRKA; }
  vyska(list, r) { if (list.skryteR.has(r) || list.skryteFiltrem.has(r)) return 0; return list.vysky.get(r) ?? VYCHOZI_VYSKA; }

  // ------------------------------------------------------------ vkládání a odstraňování
  /** Vloží (n > 0) nebo odstraní (n < 0) řádky/sloupce od indexu. osa 'r' | 'c'. pas = omezení na sloupce/řádky (vložení buněk). */
  vloz(list, osa, od, n, pas = null) {
    if (!n) return;
    if (list.zamek && !list.zamek.povolit?.[osa === 'r' ? (n > 0 ? 'vlozitRadky' : 'odstranitRadky') : (n > 0 ? 'vlozitSloupce' : 'odstranitSloupce')]) {
      throw new ChybaUpravy('List je zamknutý. Řádky a sloupce nelze vkládat ani odstraňovat.', 'zamek');
    }
    const max = osa === 'r' ? MAX_R : MAX_C;
    const posunIdx = (i) => {
      if (n > 0) return i >= od ? (i + n < max ? i + n : null) : i;
      if (i >= od && i < od - n) return null;
      return i >= od - n ? i + n : i;
    };
    const vPasu = (r, c) => !pas || (osa === 'r' ? c >= pas.od && c <= pas.do : r >= pas.od && r <= pas.do);
    // buňky
    const nove = new Map();
    for (const [k, b] of list.b) {
      const [r, c] = zKlice(k);
      if (!vPasu(r, c)) { nove.set(k, b); continue; }
      const i = osa === 'r' ? r : c;
      const ni = posunIdx(i);
      if (ni === null) continue;
      nove.set(osa === 'r' ? klic(ni, c) : klic(r, ni), b);
    }
    list.b = nove;
    if (!pas) {
      // rozměry, skryté a styly řádků/sloupců
      const mapy = osa === 'r' ? [list.vysky, list.stylR] : [list.sirky, list.stylS];
      for (const m of mapy) {
        const kopie = [...m];
        m.clear();
        for (const [i, v] of kopie) { const ni = posunIdx(i); if (ni !== null) m.set(ni, v); }
      }
      const mn = osa === 'r' ? 'skryteR' : 'skryteC';
      list[mn] = new Set([...list[mn]].map(posunIdx).filter((x) => x !== null));
      // nové řádky převezmou formát řádku nad (jako Excel)
      if (n > 0 && od > 0) {
        const zdroj = osa === 'r' ? list.stylR.get(od - 1) : list.stylS.get(od - 1);
        if (zdroj) for (let i = 0; i < n; i++) (osa === 'r' ? list.stylR : list.stylS).set(od + i, zdroj);
      }
    }
    // oblasti (sloučení, podmíněné formáty, ověření, tabulky, filtr, grafy)
    const posunOblast = (o) => {
      if (!o) return o;
      if (pas && !(osa === 'r' ? o.c1 >= pas.od && o.c2 <= pas.do : o.r1 >= pas.od && o.r2 <= pas.do)) return o;
      const [a, b] = osa === 'r' ? ['r1', 'r2'] : ['c1', 'c2'];
      let x1 = o[a], x2 = o[b];
      if (n > 0) { if (x1 >= od) x1 += n; if (x2 >= od) x2 += n; }
      else {
        const k = od - n - 1;
        if (x1 >= od && x2 <= k) return null;
        const p = (v, konec) => (v < od ? v : v > k ? v + n : konec ? od - 1 : od);
        x1 = p(x1, false); x2 = p(x2, true);
        if (x2 < x1) return null;
      }
      return { ...o, [a]: Math.min(x1, max - 1), [b]: Math.min(x2, max - 1) };
    };
    list.sloucene = list.sloucene.map(posunOblast).filter(Boolean);
    list.podminene = list.podminene.map((p) => ({ ...p, oblasti: (p.oblasti || [p.oblast]).map(posunOblast).filter(Boolean) })).filter((p) => p.oblasti.length);
    list.validace = list.validace.map((v) => ({ ...v, oblast: posunOblast(v.oblast) })).filter((v) => v.oblast);
    // tabulky se upravují na místě — příkazy si na ně drží odkazy (řádek souhrnů, návrh tabulky)
    for (const t of list.tabulky) t.oblast = posunOblast(t.oblast);
    list.tabulky = list.tabulky.filter((t) => t.oblast);
    if (list.filtr) { const o = posunOblast(list.filtr.oblast); list.filtr = o ? { ...list.filtr, oblast: o, podminky: posunPodminky(list.filtr.podminky, osa, od, n, list.filtr.oblast) } : null; }
    list.minigrafy = list.minigrafy.map((m) => {
      const o = posunOblast({ r1: m.r, c1: m.c, r2: m.r, c2: m.c });
      return o ? { ...m, r: o.r1, c: o.c1 } : null;   // zdroj přepíše prepisVzorce níž
    }).filter(Boolean);
    if (list.ukotveni) { /* ukotvení se neposouvá (jako Excel) */ }
    // vzorce na všech listech
    this.prepisVzorce((text, l) => upravPoVlozeni(text, { osa, od, n, naListu: list.nazev, listVzorce: l.nazev, pas }));
    // aktivní buňka zůstane
    this.gen++;
  }

  /** Projde všechny vzorce v sešitu (buňky, názvy, grafy, ověření, podmíněné formáty) a přepíše je. */
  prepisVzorce(fn) {
    for (const l of this.listy) {
      for (const [k, b] of l.b) {
        if (!b.f) continue;
        const f = fn(b.f, l);
        if (f !== b.f) l.b.set(k, Object.freeze({ ...b, f }));
      }
      // zdroje grafů, minigrafů a kontingenčních tabulek jsou oblasti bez „=“ — přepíší se jako vzorec
      const oblast = (t) => (t ? fn('=' + t, l).slice(1) : t);
      for (const g of l.grafy) g.zdroj = oblast(g.zdroj);
      for (const m of l.minigrafy) m.zdroj = oblast(m.zdroj);
      for (const k of l.kontingencni || []) k.zdroj = oblast(k.zdroj);
      for (const v of l.validace) { if (v.zdroj && v.zdroj[0] === '=') v.zdroj = fn(v.zdroj, l); if (v.vzorec) v.vzorec = fn(v.vzorec, l); }
      for (const p of l.podminene) if (p.vzorec) p.vzorec = fn(p.vzorec, l);
    }
    for (const [k, d] of this.nazvy) {
      const l = d.rozsah ? this.listPodleId(d.rozsah) : this.listy[0];
      this.nazvy.set(k, { ...d, vzorec: fn(d.vzorec, l || this.listy[0]) });
    }
  }

  // ------------------------------------------------------------ listy
  volneJmenoListu(zaklad = 'List') {
    for (let i = 1; ; i++) if (!this.listPodleJmena(zaklad + i)) return zaklad + i;
  }
  pridejList(za = this.aktivni, nazev = this.volneJmenoListu()) {
    const l = novyList(nazev);
    this.listy.splice(za + 1, 0, l);
    this.aktivni = za + 1;
    return l;
  }
  prejmenujList(list, nove) {
    nove = nove.trim();
    if (!nove || nove.length > 31 || /[\\/?*[\]:]/.test(nove) || /^'|'$/.test(nove)) throw new ChybaUpravy('Zadaný název listu je neplatný. Název nesmí být prázdný, delší než 31 znaků ani obsahovat znaky \\ / ? * [ ] :', 'nazev');
    const jiny = this.listPodleJmena(nove);
    if (jiny && jiny !== list) throw new ChybaUpravy('Tento název už používá jiný list. Zkuste jiný.', 'nazev');
    const stary = list.nazev;
    list.nazev = nove;
    this.prepisVzorce((t) => prejmenujVeVzorci(t, stary, nove));
  }
  smazList(list) {
    if (this.listy.filter((l) => !l.skryty).length <= 1) throw new ChybaUpravy('Sešit musí obsahovat aspoň jeden viditelný list.', 'list');
    const i = this.listy.indexOf(list);
    this.listy.splice(i, 1);
    this.prepisVzorce((t) => smazanyList(t, list.nazev));
    this.aktivni = Math.min(Math.max(0, i - 1), this.listy.length - 1);
    while (this.listy[this.aktivni].skryty) this.aktivni = (this.aktivni + 1) % this.listy.length;
  }
  presunList(z, na) {
    const [l] = this.listy.splice(z, 1);
    this.listy.splice(na, 0, l);
    this.aktivni = this.listy.indexOf(l);
  }
  kopirujList(list, na = this.listy.indexOf(list) + 1) {
    const s = this.snimek().listy[this.listy.indexOf(list)];
    const n = novyList('');
    Object.assign(n, s, { id: n.id, hodnoty: new Map(), pole: new Map(), presah: new Map(), starePresah: new Map(), skryteFiltrem: new Set() });
    let jm = `${list.nazev} (2)`;
    for (let i = 2; this.listPodleJmena(jm); i++) jm = `${list.nazev} (${i})`;
    n.nazev = jm;
    n.grafy = n.grafy.map((g) => ({ ...g, id: 'g' + Math.random().toString(36).slice(2, 8) }));
    n.tabulky = n.tabulky.map((t) => ({ ...t, nazev: this.volnyNazevTabulky() }));
    this.listy.splice(na, 0, n);
    this.aktivni = na;
    return n;
  }
  volnyNazevTabulky() {
    for (let i = 1; ; i++) if (!this.tabulkaPodleJmena('Tabulka' + i)) return 'Tabulka' + i;
  }

  // ------------------------------------------------------------ tabulky (Formátovat jako tabulku)
  vytvorTabulku(list, o, { styl = 'stredni2', zahlavi = true } = {}) {
    if (list.tabulky.some((t) => prekryva(t.oblast, o))) throw new ChybaUpravy('Tabulka se nemůže překrývat s jinou tabulkou.', 'tabulka');
    if (!zahlavi) {
      this.vloz(list, 'r', o.r1, 1, { od: o.c1, do: o.c2 });
      for (let c = o.c1; c <= o.c2; c++) this.zapis(list, o.r1, c, { v: `Sloupec${c - o.c1 + 1}` });
      o = { ...o, r2: o.r2 + 1 };
    } else {
      // prázdné nebo duplicitní záhlaví Excel doplní
      const videne = new Set();
      for (let c = o.c1; c <= o.c2; c++) {
        let h = String(this.hodnota(list, o.r1, c) ?? '').trim() || `Sloupec${c - o.c1 + 1}`;
        let j = 2;
        const zaklad = h;
        while (videne.has(h.toLocaleLowerCase('cs'))) h = zaklad + j++;
        videne.add(h.toLocaleLowerCase('cs'));
        const b = list.b.get(klic(o.r1, c)) || {};
        if (b.f || String(b.v ?? '') !== h) this.zapis(list, o.r1, c, { ...b, v: h, f: null });
      }
    }
    const t = { nazev: this.volnyNazevTabulky(), oblast: { ...o }, styl, zahlavi: true, souhrn: false, pruhyR: true, pruhyS: false, prvniS: false, posledniS: false, filtrTl: true };
    list.tabulky.push(t);
    if (list.filtr && prekryva(list.filtr.oblast, o)) list.filtr = null;
    t.filtr = { podminky: {} };
    return t;
  }

  rozsirTabulku(list, r, c) {
    for (const t of list.tabulky) {
      const o = t.oblast;
      if (t.souhrn) continue;
      if (r === o.r2 + 1 && c >= o.c1 && c <= o.c2) { t.oblast = { ...o, r2: r }; this.doplnVypocetneSloupce(list, t, r); }
      else if (c === o.c2 + 1 && r >= o.r1 && r <= o.r2 && r === o.r1) {
        t.oblast = { ...o, c2: c };
      }
    }
  }
  /** Počítaný sloupec tabulky: nový řádek dostane vzorec z řádku nad ním. */
  doplnVypocetneSloupce(list, t, r) {
    for (let c = t.oblast.c1; c <= t.oblast.c2; c++) {
      const nad = list.b.get(klic(r - 1, c));
      const tu = list.b.get(klic(r, c));
      if (nad?.f && r - 1 > t.oblast.r1 && !(tu?.f || (tu?.v !== null && tu?.v !== undefined))) this.zapis(list, r, c, { ...(tu || {}), f: posunVzorec(nad.f, 1, 0), s: nad.s });
    }
  }

  radekSouhrnu(list, t, zapnout) {
    const o = t.oblast;
    if (zapnout && !t.souhrn) {
      this.vloz(list, 'r', o.r2 + 1, 1, { od: o.c1, do: o.c2 });
      t.oblast = { ...o, r2: o.r2 + 1 };
      const r = t.oblast.r2;
      this.zapis(list, r, o.c1, { v: 'Souhrn' });
      const posledni = o.c2;
      const hlavicka = String(this.hodnota(list, o.r1, posledni) ?? '');
      if (o.c2 > o.c1) this.zapis(list, r, posledni, { f: `=SUBTOTAL(109;${t.nazev}[${hlavicka}])` });
      t.souhrn = true;
    } else if (!zapnout && t.souhrn) {
      const r = o.r2;
      for (let c = o.c1; c <= o.c2; c++) this.zapis(list, r, c, null);
      t.oblast = { ...o, r2: o.r2 - 1 };
      t.souhrn = false;
    }
  }

  // ------------------------------------------------------------ filtr
  pouzijFiltr(list) {
    list.skryteFiltrem = new Set();
    const aplikuj = (oblast, podminky) => {
      for (let r = oblast.r1 + 1; r <= oblast.r2; r++) {
        for (const [c, p] of Object.entries(podminky || {})) {
          if (!p) continue;
          const v = this.hodnota(list, r, +c);
          if (!testFiltru(p, v, this.textBunky(list, r, +c), this, list, r, +c, oblast)) { list.skryteFiltrem.add(r); break; }
        }
      }
    };
    if (list.filtr) aplikuj(list.filtr.oblast, list.filtr.podminky);
    for (const t of list.tabulky) if (t.filtr) aplikuj({ ...t.oblast, r2: t.souhrn ? t.oblast.r2 - 1 : t.oblast.r2 }, t.filtr.podminky);
  }

  /** Oblast okolo buňky ohraničená prázdnými řádky a sloupci (Ctrl+A, automatický filtr, graf). */
  aktualniOblast(list, r, c) {
    let o = { r1: r, c1: c, r2: r, c2: c };
    const plna = (rr, cc) => rr >= 0 && cc >= 0 && this.hodnota(list, rr, cc) !== null;
    for (let krok = 0; krok < 60; krok++) {
      let zmena = false;
      const hranice = () => {
        for (let cc = o.c1 - 1; cc <= o.c2 + 1; cc++) {
          if (plna(o.r1 - 1, cc)) { o.r1--; return true; }
          if (plna(o.r2 + 1, cc)) { o.r2++; return true; }
        }
        for (let rr = o.r1 - 1; rr <= o.r2 + 1; rr++) {
          if (plna(rr, o.c1 - 1)) { o.c1--; return true; }
          if (plna(rr, o.c2 + 1)) { o.c2++; return true; }
        }
        return false;
      };
      while (hranice()) { zmena = true; if (o.r2 - o.r1 > 100000) break; }
      if (!zmena) break;
    }
    return o;
  }

  // ------------------------------------------------------------ text a formát k zobrazení
  textBunky(list, r, c) {
    const v = this.hodnota(list, r, c);
    const s = this.stylBunky(list, r, c);
    return formatuj(v, s?.nf).text;
  }

  // ------------------------------------------------------------ řazení
  serad(list, o, klice, { zahlavi = false } = {}) {
    const r1 = zahlavi ? o.r1 + 1 : o.r1;
    if (r1 > o.r2) return;
    const radky = [];
    for (let r = r1; r <= o.r2; r++) {
      const bunky = [];
      for (let c = o.c1; c <= o.c2; c++) bunky.push(list.b.get(klic(r, c)) || null);
      radky.push({ r, bunky, klic: klice.map((k) => {
        if (k.podle === 'barva') return this.stylBunky(list, r, k.c)?.pozadi || '';
        if (k.podle === 'pismo') return this.stylBunky(list, r, k.c)?.barva || '';
        return this.hodnota(list, r, k.c);
      }) });
    }
    radky.sort((a, b) => {
      for (let i = 0; i < klice.length; i++) {
        const k = klice[i];
        let x = a.klic[i], y = b.klic[i];
        if (k.podle === 'barva' || k.podle === 'pismo') {
          const cil = k.barva || '';
          const ax = x === cil ? 0 : 1, by = y === cil ? 0 : 1;
          if (ax !== by) return k.vzestupne === false ? by - ax : ax - by;
          continue;
        }
        if (k.seznam) {
          const ix = k.seznam.indexOf(String(x ?? '').toLocaleLowerCase('cs')), iy = k.seznam.indexOf(String(y ?? '').toLocaleLowerCase('cs'));
          const d = (ix < 0 ? 999 : ix) - (iy < 0 ? 999 : iy);
          if (d) return k.vzestupne === false ? -d : d;
          continue;
        }
        const prazdneX = x === null || x === undefined || x === '', prazdneY = y === null || y === undefined || y === '';
        if (prazdneX || prazdneY) { if (prazdneX && prazdneY) continue; return prazdneX ? 1 : -1; }   // prázdné vždy na konec
        if (jeChyba(x) || jeChyba(y)) { if (jeChyba(x) && jeChyba(y)) continue; return jeChyba(x) ? 1 : -1; }
        const cmp = porovnej(x, y);
        if (cmp) return k.vzestupne === false ? -cmp : cmp;
      }
      return a.r - b.r;
    });
    radky.forEach((radek, i) => {
      const cil = r1 + i;
      radek.bunky.forEach((b, j) => {
        const c = o.c1 + j;
        if (!b) { list.b.delete(klic(cil, c)); return; }
        const nb = b.f ? { ...b, f: posunVzorec(b.f, cil - radek.r, 0) } : b;
        list.b.set(klic(cil, c), Object.freeze({ ...nb }));
      });
    });
  }

  // ------------------------------------------------------------ vyplňování řad
  /**
   * Úchyt vyplnění: zdroj → cíl (cíl obsahuje zdroj a rozšiřuje ho jedním směrem).
   * kopie = Ctrl (u jednoho čísla řada, jinak kopírování), jenFormat / bezFormatu.
   */
  vypln(list, zdroj, cil, { kopie = false, jenFormat = false, bezFormatu = false, rada = null, nahled = false } = {}) {
    // náhled (bublina při tažení úchytu): nic se nezapíše, vrátí se text poslední buňky
    const zaznam = new Map();
    const zapis = nahled ? (l, r, c, b) => zaznam.set(klic(r, c), b) : (l, r, c, b) => this.zapis(l, r, c, b);
    const vysledek = this.vyplnVnitrne(list, zdroj, cil, { kopie, jenFormat, bezFormatu, rada, zapis });
    if (!nahled) return vysledek;
    const posledni = [...zaznam.values()].pop();
    if (!posledni || posledni.f) return null;
    return formatuj(posledni.v ?? null, posledni.s?.nf).text;
  }

  vyplnVnitrne(list, zdroj, cil, { kopie, jenFormat, bezFormatu, rada, zapis }) {
    const dolu = cil.r2 > zdroj.r2, nahoru = cil.r1 < zdroj.r1, doprava = cil.c2 > zdroj.c2, doleva = cil.c1 < zdroj.c1;
    const svisle = dolu || nahoru;
    const delka = svisle ? zdroj.r2 - zdroj.r1 + 1 : zdroj.c2 - zdroj.c1 + 1;
    const pocetLinek = svisle ? zdroj.c2 - zdroj.c1 + 1 : zdroj.r2 - zdroj.r1 + 1;
    for (let l = 0; l < pocetLinek; l++) {
      const pozice = (i) => (svisle ? [zdroj.r1 + i, zdroj.c1 + l] : [zdroj.r1 + l, zdroj.c1 + i]);
      const bunky = Array.from({ length: delka }, (_, i) => { const [r, c] = pozice(i); return { r, c, b: list.b.get(klic(r, c)) || null, v: this.hodnota(list, r, c), s: this.stylBunky(list, r, c) }; });
      const generator = jenFormat ? null : vytvorRadu(bunky, { kopie, rada });
      const [od, do_] = svisle ? (dolu ? [zdroj.r2 + 1, cil.r2] : [cil.r1, zdroj.r1 - 1]) : (doprava ? [zdroj.c2 + 1, cil.c2] : [cil.c1, zdroj.c1 - 1]);
      const zpet = nahoru || doleva;
      const pocet = do_ - od + 1;
      for (let j = 0; j < pocet; j++) {
        const idx = zpet ? do_ - j : od + j;           // pořadí od zdroje ven
        const krok = j + 1;                            // kolikátá nová buňka
        const vzor = bunky[zpet ? (delka - 1 - (j % delka) + delka) % delka : j % delka];
        const [r, c] = svisle ? [idx, zdroj.c1 + l] : [zdroj.r1 + l, idx];
        const puvodni = list.b.get(klic(r, c)) || {};
        const s = bezFormatu ? puvodni.s : vzor.s;
        if (jenFormat) { zapis(list, r, c, { ...puvodni, s: vzor.s }); continue; }
        let nova;
        if (vzor.b?.f && !generator?.cisla) {
          const dr = r - vzor.r, dc = c - vzor.c;
          nova = { f: posunVzorec(vzor.b.f, dr, dc) };
        } else nova = { v: generator ? generator(zpet ? -krok : krok, zpet) : vzor.v };
        zapis(list, r, c, { ...puvodni, ...nova, f: nova.f || null, v: nova.f ? null : nova.v, s: s || null, kom: null, pozn: null });
      }
    }
  }

  // ------------------------------------------------------------ ostatní úpravy dat
  odstranDuplicity(list, o, sloupce, zahlavi) {
    const r1 = zahlavi ? o.r1 + 1 : o.r1;
    const videne = new Set();
    const zachovat = [];
    let odstraneno = 0;
    for (let r = r1; r <= o.r2; r++) {
      const k = sloupce.map((c) => { const v = this.hodnota(list, r, c); return typeof v === 'string' ? 's' + v.toLocaleLowerCase('cs') : typeof v + String(v); }).join('\u0001');
      if (videne.has(k)) { odstraneno++; continue; }
      videne.add(k);
      zachovat.push(Array.from({ length: o.c2 - o.c1 + 1 }, (_, j) => list.b.get(klic(r, o.c1 + j)) || null));
    }
    for (let r = r1; r <= o.r2; r++) for (let c = o.c1; c <= o.c2; c++) list.b.delete(klic(r, c));
    zachovat.forEach((radek, i) => radek.forEach((b, j) => { if (b) list.b.set(klic(r1 + i, o.c1 + j), b); }));
    return { odstraneno, zbyva: zachovat.length };
  }

  textDoSloupcu(list, o, { oddelovace = [';'], pevne = null, uvozovky = '"' } = {}) {
    for (let r = o.r1; r <= o.r2; r++) {
      const t = String(this.hodnota(list, r, o.c1) ?? '');
      let casti;
      if (pevne) casti = pevne.map((p, i) => t.slice(p, pevne[i + 1]).trim());
      else casti = rozdelText(t, oddelovace, uvozovky);
      casti.forEach((x, j) => this.zadej(list, r, o.c1 + j, x));
    }
  }

  /** Hledání řešení (Goal Seek): změní buňku zmena tak, aby vzorec v cil dal hodnotu. */
  hledaniReseni(list, cil, hodnota, zmena) {
    const vstup = list.b.get(klic(zmena.r, zmena.c)) || {};
    const x0 = typeof vstup.v === 'number' ? vstup.v : 0;
    const f = (x) => {
      list.b.set(klic(zmena.r, zmena.c), Object.freeze({ ...vstup, v: x, f: undefined }));
      this.prepocitej({ vynutit: true });
      const y = this.hodnota(list, cil.r, cil.c);
      return typeof y === 'number' ? y - hodnota : NaN;
    };
    let x = x0, y = f(x);
    let nalezeno = Math.abs(y) < 1e-7;
    for (let i = 0; i < 100 && !nalezeno && isFinite(y); i++) {
      const h = Math.max(1e-6, Math.abs(x) * 1e-6);
      const d = (f(x + h) - y) / h;
      if (!isFinite(d) || d === 0) { x = x + (Math.abs(x) > 1 ? x * 0.5 : 1); y = f(x); continue; }
      x -= y / d;
      y = f(x);
      if (Math.abs(y) < 1e-7) nalezeno = true;
    }
    if (!nalezeno) { list.b.set(klic(zmena.r, zmena.c), Object.freeze({ ...vstup })); this.prepocitej({ vynutit: true }); }
    return { nalezeno, x, y: this.hodnota(list, cil.r, cil.c) };
  }

  // ------------------------------------------------------------ ověření dat
  validaceV(list, r, c) { return list.validace.find((v) => obsahuje(v.oblast, r, c)) || null; }

  /** Ověří vstup, vrací null (v pořádku) nebo validaci, která selhala. */
  overVstup(list, r, c, text) {
    const v = this.validaceV(list, r, c);
    if (!v || v.typ === 'vse') return null;
    if (text === '' && v.ignorovatPrazdne !== false) return null;
    const p = rozpoznej(text);
    const val = p.vzorec ? null : p.v;
    const cislo = (x) => (typeof x === 'number' ? x : null);
    const ctiMez = (m) => {
      if (m === undefined || m === null || m === '') return null;
      if (String(m)[0] === '=') { const s = strom(String(m)); return s ? vyhodnot(s, { S: this.S, list, r, c }) : null; }
      const q = rozpoznej(String(m));
      return q.v;
    };
    const a = ctiMez(v.a), b = ctiMez(v.b);
    const porov = (x) => {
      switch (v.op || 'mezi') {
        case 'mezi': return x >= a && x <= b;
        case 'mimo': return x < a || x > b;
        case '=': return x === a;
        case '<>': return x !== a;
        case '>': return x > a;
        case '<': return x < a;
        case '>=': return x >= a;
        case '<=': return x <= a;
        default: return true;
      }
    };
    let ok = true;
    if (v.typ === 'cele') { const x = cislo(val); ok = x !== null && Number.isInteger(x) && porov(x); }
    else if (v.typ === 'desetinne') { const x = cislo(val); ok = x !== null && porov(x); }
    else if (v.typ === 'datum' || v.typ === 'cas') { const x = cislo(val); ok = x !== null && porov(x); }
    else if (v.typ === 'delka') ok = porov([...String(text)].length);
    else if (v.typ === 'seznam') ok = this.polozkySeznamu(list, v, r, c).some((x) => String(x).toLocaleLowerCase('cs') === String(text).toLocaleLowerCase('cs'));
    else if (v.typ === 'vlastni') {
      const s = strom(v.vzorec || '=PRAVDA');
      // vlastní vzorec se vyhodnotí, jako by v buňce už nová hodnota byla
      const puvodni = list.b.get(klic(r, c));
      list.b.set(klic(r, c), Object.freeze({ ...(puvodni || {}), v: val ?? text, f: undefined }));
      this.prepocitej({ vynutit: true });
      const x = s ? vyhodnot(s, { S: this.S, list, r, c }) : true;
      if (puvodni) list.b.set(klic(r, c), puvodni); else list.b.delete(klic(r, c));
      this.prepocitej({ vynutit: true });
      ok = x === true || (typeof x === 'number' && x !== 0);
    }
    return ok ? null : v;
  }

  polozkySeznamu(list, v, r = 0, c = 0) {
    const z = String(v.zdroj || '');
    if (z[0] === '=') {
      const s = strom(z);
      if (!s) return [];
      const x = vyhodnot(s, { S: this.S, list, r, c });
      const pole = x instanceof Ref ? naPole(x, { S: this.S, list, r, c }) : Array.isArray(x) ? x : [[x]];
      return pole.flat().filter((y) => y !== null && y !== undefined && y !== '').map((y) => (typeof y === 'number' ? obecne(y) : String(y)));
    }
    return z.split(/[;,]/).map((s) => s.trim()).filter(Boolean);
  }

  // ------------------------------------------------------------ podmíněné formátování
  /** Výsledek podmíněného formátu pro buňku: { styl, pruh, ikona } nebo null. Statistiky se počítají jednou za přepočet. */
  podmineny(list, r, c) {
    if (!list.podminene.length) return null;
    let out = null;
    for (let i = 0; i < list.podminene.length; i++) {
      const p = list.podminene[i];
      const oblasti = p.oblasti || [p.oblast];
      const o = oblasti.find((x) => obsahuje(x, r, c));
      if (!o) continue;
      const v = this.hodnota(list, r, c);
      const st = this.statistikaCF(list, p, i);
      let splneno = false;
      switch (p.typ) {
        case 'vetsi': splneno = typeof v === 'number' && v > this.mez(list, p.a, r, c); break;
        case 'mensi': splneno = typeof v === 'number' && v < this.mez(list, p.a, r, c); break;
        case 'mezi': { const a = this.mez(list, p.a, r, c), b = this.mez(list, p.b, r, c); splneno = typeof v === 'number' && v >= Math.min(a, b) && v <= Math.max(a, b); break; }
        case 'rovno': { const a = this.mez(list, p.a, r, c); splneno = v !== null && porovnej(v, a) === 0; break; }
        case 'text': splneno = typeof v === 'string' && v.toLocaleLowerCase('cs').includes(String(p.a).toLocaleLowerCase('cs')); break;
        case 'zacina': splneno = typeof v === 'string' && v.toLocaleLowerCase('cs').startsWith(String(p.a).toLocaleLowerCase('cs')); break;
        case 'datum': splneno = typeof v === 'number' && testDatumCF(p.a, v); break;
        case 'duplicitni': splneno = v !== null && v !== '' && (st.pocty.get(klicHodnoty(v)) || 0) > 1; break;
        case 'jedinecne': splneno = v !== null && v !== '' && (st.pocty.get(klicHodnoty(v)) || 0) === 1; break;
        case 'prvni': splneno = typeof v === 'number' && v >= st.prah(p, true); break;
        case 'posledni': splneno = typeof v === 'number' && v <= st.prah(p, false); break;
        case 'nadPrumerem': splneno = typeof v === 'number' && v > st.prumer; break;
        case 'podPrumerem': splneno = typeof v === 'number' && v < st.prumer; break;
        case 'prazdne': splneno = v === null || v === ''; break;
        case 'chyby': splneno = jeChyba(v); break;
        case 'vzorec': {
          const s = strom(posunVzorec(p.vzorec, r - o.r1, c - o.c1));
          const x = s ? vyhodnot(s, { S: this.S, list, r, c }) : false;
          splneno = x === true || (typeof x === 'number' && x !== 0);
          break;
        }
        case 'pruh':
          if (typeof v === 'number') {
            const lo = Math.min(0, st.min), hi = Math.max(0, st.max);
            const rozsah = hi - lo || 1;
            out = { ...(out || {}), pruh: { od: (Math.min(0, v) - lo) / rozsah, do: (Math.max(0, v) - lo) / rozsah, nula: -lo / rozsah, barva: p.barva || '#638EC6', plny: !!p.plny, zaporny: v < 0 } };
          }
          continue;
        case 'skala':
          if (typeof v === 'number') {
            const t = st.max === st.min ? 0.5 : (v - st.min) / (st.max - st.min);
            const barvy = p.barvy || ['#F8696B', '#FFEB84', '#63BE7B'];
            out = { ...(out || {}), styl: { ...(out?.styl || {}), pozadi: michej(barvy, t) } };
          }
          continue;
        case 'ikony':
          if (typeof v === 'number') {
            const sada = p.sada || 'sipky3';
            const n = /5$/.test(sada) ? 5 : /4$/.test(sada) ? 4 : 3;
            const t = st.max === st.min ? 1 : (v - st.min) / (st.max - st.min);
            const idx = Math.min(n - 1, Math.floor(t * n - 1e-9 < 0 ? 0 : t * n - 1e-9));
            out = { ...(out || {}), ikona: { sada, i: n - 1 - idx, n } };
          }
          continue;
      }
      if (splneno) {
        out = { ...(out || {}), styl: { ...(p.styl || {}), ...(out?.styl || {}) } };
        if (p.zastavit) break;
      }
    }
    return out;
  }

  mez(list, m, r, c) {
    if (typeof m === 'number') return m;
    if (typeof m === 'string' && m[0] === '=') { const s = strom(m); return s ? vyhodnot(s, { S: this.S, list, r, c }) : 0; }
    const p = rozpoznej(String(m ?? ''));
    return p.v;
  }

  statistikaCF(list, p, i) {
    const klicCF = list.id + ':' + i;
    this.cf = this.cf || new Map();
    let st = this.cf.get(klicCF);
    if (st) return st;
    const cisla = [];
    const pocty = new Map();
    for (const o of p.oblasti || [p.oblast]) {
      const oo = { ...o, r2: Math.min(o.r2, this.rozsah(list).r), c2: Math.min(o.c2, this.rozsah(list).c) };
      this.projdi(list, oo, (r, c, v) => {
        if (typeof v === 'number') cisla.push(v);
        const k = klicHodnoty(v);
        pocty.set(k, (pocty.get(k) || 0) + 1);
      });
    }
    const serazena = [...cisla].sort((a, b) => a - b);
    st = {
      min: serazena[0] ?? 0, max: serazena[serazena.length - 1] ?? 0,
      prumer: cisla.length ? cisla.reduce((a, b) => a + b, 0) / cisla.length : 0,
      pocty,
      prah(pr, horni) {
        const n = pr.procenta ? Math.max(1, Math.floor(serazena.length * (pr.pocet || 10) / 100)) : pr.pocet || 10;
        if (!serazena.length) return horni ? Infinity : -Infinity;
        return horni ? serazena[Math.max(0, serazena.length - n)] : serazena[Math.min(serazena.length - 1, n - 1)];
      },
    };
    this.cf.set(klicCF, st);
    return st;
  }

  // ------------------------------------------------------------ závislosti
  zavislosti(list, r, c) {
    const b = this.bunka(list, r, c);
    if (!b?.f) return [];
    return predchudci(b.f).map((x) => ({ list: x.list ? this.listPodleJmena(x.list) : list, oblast: { r1: x.r1, c1: x.c1, r2: x.r2, c2: x.c2 } })).filter((x) => x.list);
  }
  naslednici(list, r, c) {
    const out = [];
    for (const l of this.listy) for (const [k, b] of l.b) {
      if (!b.f) continue;
      for (const x of predchudci(b.f)) {
        const cil = x.list ? this.listPodleJmena(x.list) : l;
        if (cil === list && r >= x.r1 && r <= x.r2 && c >= x.c1 && c <= x.c2) { const [rr, cc] = zKlice(k); out.push({ list: l, r: rr, c: cc }); break; }
      }
    }
    return out;
  }

  // ------------------------------------------------------------ soubor
  serializuj(meta = {}) {
    const styly = [], mapa = new Map();
    const idStylu = (s) => {
      if (!s) return undefined;
      const j = JSON.stringify(s);
      if (!mapa.has(j)) { mapa.set(j, styly.length); styly.push(s); }
      return mapa.get(j);
    };
    const listy = this.listy.map((l) => {
      const bunky = [];
      for (const [k, b] of l.b) {
        const [r, c] = zKlice(k);
        const x = { ...b };
        if (x.s) x.s = idStylu(x.s);
        bunky.push([r, c, x]);
      }
      const o = { nazev: l.nazev, bunky };
      if (l.sirky.size) o.sirky = [...l.sirky];
      if (l.vysky.size) o.vysky = [...l.vysky];
      if (l.skryteR.size) o.skryteR = [...l.skryteR];
      if (l.skryteC.size) o.skryteC = [...l.skryteC];
      if (l.stylS.size) o.stylS = [...l.stylS].map(([c, s]) => [c, idStylu(s)]);
      if (l.stylR.size) o.stylR = [...l.stylR].map(([r, s]) => [r, idStylu(s)]);
      for (const k of [...STRUKTURA, 'barva', 'skryty', 'mrizka', 'zahlavi', 'zoom', 'zobrazitVzorce', 'vychoziSirka']) {
        const v = l[k];
        if (v === null || v === undefined || (Array.isArray(v) && !v.length)) continue;
        o[k] = v;
      }
      return o;
    });
    return JSON.stringify({ format: 'astrotabulky', verze: 1, listy, styly, aktivni: this.aktivni, nazvy: [...this.nazvy.values()].map((d) => ({ ...d, rozsah: d.rozsah ? this.listy.findIndex((l) => l.id === d.rozsah) : null })), vypocet: this.vypocet, meta });
  }

  static rozeber(text) {
    const d = JSON.parse(text);
    if (d.format !== 'astrotabulky') throw new Error('Neznámý formát');
    const s = new Sesit();
    const styly = (d.styly || []).map((x) => Object.freeze(x));
    s.listy = d.listy.map((x) => {
      const l = novyList(x.nazev);
      for (const [r, c, b] of x.bunky || []) {
        if (b.s !== undefined) b.s = styly[b.s] || null;
        l.b.set(klic(r, c), Object.freeze(b));
      }
      l.sirky = new Map(x.sirky || []);
      l.vysky = new Map(x.vysky || []);
      l.skryteR = new Set(x.skryteR || []);
      l.skryteC = new Set(x.skryteC || []);
      l.stylS = new Map((x.stylS || []).map(([c, i]) => [c, styly[i]]));
      l.stylR = new Map((x.stylR || []).map(([r, i]) => [r, styly[i]]));
      for (const k of [...STRUKTURA, 'barva', 'skryty', 'mrizka', 'zahlavi', 'zoom', 'zobrazitVzorce', 'vychoziSirka']) if (x[k] !== undefined) l[k] = x[k];
      if (!l.vyber?.oblasti) l.vyber = { r: 0, c: 0, oblasti: [{ r1: 0, c1: 0, r2: 0, c2: 0 }] };
      return l;
    });
    s.aktivni = Math.min(d.aktivni || 0, s.listy.length - 1);
    s.vypocet = d.vypocet || 'auto';
    for (const n of d.nazvy || []) s.definujNazev(n.nazev, n.vzorec, { rozsah: n.rozsah !== null && n.rozsah !== undefined ? s.listy[n.rozsah]?.id : null, komentar: n.komentar });
    s.prepocitej({ vynutit: true });
    for (const l of s.listy) if (l.filtr || l.tabulky.some((t) => t.filtr)) s.pouzijFiltr(l);
    s.meta = d.meta || {};
    s.zalozHistorii();
    return s;
  }

  static zCsv(text, nazev = 'List1') {
    const s = new Sesit();
    s.listy[0].nazev = nazev.slice(0, 31).replace(/[\\/?*[\]:]/g, '_') || 'List1';
    const odd = uhodniOddelovac(text);
    const radky = rozdelCsv(text, odd);
    const l = s.listy[0];
    radky.forEach((radek, r) => radek.forEach((t, c) => { if (t !== '') s.zadej(l, r, c, t); }));
    // šířky podle obsahu
    for (let c = 0; c < Math.min(60, Math.max(0, ...radky.map((x) => x.length))); c++) {
      const max = Math.max(...radky.slice(0, 200).map((x) => String(x[c] ?? '').length));
      if (max > 9) l.sirky.set(c, Math.min(320, Math.round(max * 7.2 + 12)));
    }
    s.prepocitej();
    s.zalozHistorii();
    return s;
  }

  naCsv(list, oddelovac = ';') {
    const u = this.rozsahDat(list);
    const radky = [];
    for (let r = 0; r <= u.r; r++) {
      const x = [];
      for (let c = 0; c <= u.c; c++) {
        let t = this.textBunky(list, r, c);
        if (/[";\n,]/.test(t) || t.includes(oddelovac)) t = '"' + t.replace(/"/g, '""') + '"';
        x.push(t);
      }
      radky.push(x.join(oddelovac));
    }
    return radky.join('\r\n');
  }
}

export class ChybaUpravy extends Error {
  constructor(zprava, druh) { super(zprava); this.druh = druh; }
}

// ---------------------------------------------------------------- pomocné
export function oblastDatTabulky(t) {
  const o = t.oblast;
  return { r1: o.r1 + (t.zahlavi === false ? 0 : 1), c1: o.c1, r2: o.r2 - (t.souhrn ? 1 : 0), c2: o.c2 };
}

function obsahujeOblast(vnejsi, vnitrni) {
  return vnitrni.r1 >= vnejsi.r1 && vnitrni.r2 <= vnejsi.r2 && vnitrni.c1 >= vnejsi.c1 && vnitrni.c2 <= vnejsi.c2;
}

function posunPodminky(p, osa, od, n, oblast) {
  if (osa !== 'c' || !p) return p;
  const out = {};
  for (const [c, x] of Object.entries(p)) {
    const i = +c;
    if (n > 0) out[i >= od ? i + n : i] = x;
    else if (i < od) out[i] = x;
    else if (i >= od - n) out[i + n] = x;
  }
  return out;
}

const klicHodnoty = (v) => (typeof v === 'string' ? 's' + v.toLocaleLowerCase('cs') : typeof v + String(v));

function hexNaRgb(h) { return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); }
export function michej(barvy, t) {
  t = Math.max(0, Math.min(1, t));
  const n = barvy.length - 1;
  const i = Math.min(n - 1, Math.floor(t * n));
  const u = t * n - i;
  const a = hexNaRgb(barvy[i]), b = hexNaRgb(barvy[i + 1]);
  return '#' + a.map((x, j) => Math.round(x + (b[j] - x) * u).toString(16).padStart(2, '0')).join('');
}

function testDatumCF(druh, v) {
  const d = Math.floor(v);
  const t = new Date();
  const dnes = serial(t.getFullYear(), t.getMonth() + 1, t.getDate());
  const dow = (t.getDay() + 6) % 7;   // pondělí = 0
  switch (druh) {
    case 'vcera': return d === dnes - 1;
    case 'dnes': return d === dnes;
    case 'zitra': return d === dnes + 1;
    case 'poslednich7': return d > dnes - 7 && d <= dnes;
    case 'tentoTyden': return d >= dnes - dow && d < dnes - dow + 7;
    case 'minulyTyden': return d >= dnes - dow - 7 && d < dnes - dow;
    case 'pristiTyden': return d >= dnes - dow + 7 && d < dnes - dow + 14;
    case 'tentoMesic': { const x = zeSerialu(d); return x.y === t.getFullYear() && x.m === t.getMonth() + 1; }
    case 'minulyMesic': { const x = zeSerialu(d); const m = t.getMonth() === 0 ? 12 : t.getMonth(); const y = t.getMonth() === 0 ? t.getFullYear() - 1 : t.getFullYear(); return x.y === y && x.m === m; }
    case 'pristiMesic': { const x = zeSerialu(d); const m = t.getMonth() === 11 ? 1 : t.getMonth() + 2; const y = t.getMonth() === 11 ? t.getFullYear() + 1 : t.getFullYear(); return x.y === y && x.m === m; }
    default: return false;
  }
}

function testFiltru(p, v, text, S, list, r, c, oblast) {
  if (p.hodnoty) {
    const t = v === null || v === undefined || v === '' ? '' : text;
    return p.hodnoty.includes(t);
  }
  if (p.barva !== undefined) return (S.stylBunky(list, r, c)?.pozadi || '') === p.barva;
  if (p.podminka) {
    const test = (x) => {
      if (!x) return true;
      const k = kriterium(x.op === 'obsahuje' ? `=*${x.v}*` : x.op === 'neobsahuje' ? `<>*${x.v}*` : x.op === 'zacina' ? `=${x.v}*` : x.op === 'konci' ? `=*${x.v}` : `${x.op}${x.v}`);
      return k(v);
    };
    const a = test(p.podminka.a), b = p.podminka.b ? test(p.podminka.b) : null;
    return b === null ? a : p.podminka.spoj === 'nebo' ? a || b : a && b;
  }
  if (p.prvnich) {
    const cisla = [];
    S.projdi(list, { r1: oblast.r1 + 1, r2: oblast.r2, c1: c, c2: c }, (r, cc, x) => { if (typeof x === 'number') cisla.push(x); });
    cisla.sort((a, b) => b - a);
    const n = p.prvnich.n || 10;
    if (typeof v !== 'number') return false;
    return p.prvnich.horni !== false ? v >= (cisla[n - 1] ?? -Infinity) : v <= ([...cisla].reverse()[n - 1] ?? Infinity);
  }
  return true;
}

// řady pro úchyt vyplnění
const SEZNAMY = [
  DNY.slice(1).concat(DNY[0]), DNY_ZKR.slice(1).concat(DNY_ZKR[0]), MESICE, MESICE_ZKR,
  ['ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'],
  ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'], ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
  ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'],
  ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'],
  ['q1', 'q2', 'q3', 'q4'], ['1. čtvrtletí', '2. čtvrtletí', '3. čtvrtletí', '4. čtvrtletí'],
];
function vSeznamu(t) {
  const low = t.toLocaleLowerCase('cs');
  for (const s of SEZNAMY) { const i = s.indexOf(low); if (i >= 0) return { s, i }; }
  return null;
}
function velikostJako(vzor, t) {
  if (vzor === vzor.toLocaleUpperCase('cs') && vzor !== vzor.toLocaleLowerCase('cs')) return t.toLocaleUpperCase('cs');
  if (vzor[0] === vzor[0].toLocaleUpperCase('cs')) return t[0].toLocaleUpperCase('cs') + t.slice(1);
  return t;
}

/** Vrátí generátor hodnot pro k-tou buňku za zdrojem (k > 0 ven od zdroje). */
function vytvorRadu(bunky, { kopie, rada }) {
  const vals = bunky.map((x) => x.v);
  const n = vals.length;
  const vsechnaCisla = vals.every((v) => typeof v === 'number') && !bunky.some((x) => x.b?.f);
  const datum = bunky[0].s?.nf && jeDatovyFormat(bunky[0].s.nf);
  if (rada?.typ === 'kopie') return null;
  if (vsechnaCisla) {
    if (n === 1) {
      // jedno číslo: kopie; datum: den po dni; Ctrl přepne
      const krok = rada?.krok ?? 1;
      const radaZap = rada ? true : datum ? !kopie : kopie;
      if (!radaZap) return null;
      if (datum && rada?.jednotka && rada.jednotka !== 'den') return (k) => posunDatum(vals[0], rada.jednotka, krok * k);
      if (datum && rada?.jednotka === 'den' && rada.pracovni) return (k) => pracovniPosun(vals[0], krok * k);
      const g = (k) => (rada?.typ === 'rust' ? vals[0] * krok ** k : vals[0] + krok * k);
      g.cisla = true;
      return g;
    }
    if (kopie) return null;
    // lineární trend (nejmenší čtverce) jako Excel
    const xs = vals.map((_, i) => i);
    const mx = (n - 1) / 2, my = vals.reduce((a, b) => a + b, 0) / n;
    let sxy = 0, sxx = 0;
    xs.forEach((x, i) => { sxy += (x - mx) * (vals[i] - my); sxx += (x - mx) ** 2; });
    const k = sxx ? sxy / sxx : 0;
    const q = my - k * mx;
    const zaokr = (x) => +x.toFixed(10);
    if (datum && n >= 2) {
      // data po měsících / letech (1. 1., 1. 2., …)
      const d = vals.map((v) => zeSerialu(v));
      const mesice = d.map((x) => x.y * 12 + x.m - 1);
      const kroky = mesice.slice(1).map((m, i) => m - mesice[i]);
      if (kroky.every((x) => x === kroky[0] && x !== 0) && d.every((x) => x.d === d[0].d)) {
        const g = (kk, zpet) => posunDatum(zpet ? vals[0] : vals[n - 1], 'mesic', kroky[0] * (zpet ? kk : kk));
        return (kk, zpet) => (zpet ? posunDatum(vals[0], 'mesic', kroky[0] * kk) : posunDatum(vals[n - 1], 'mesic', kroky[0] * kk));
      }
    }
    const g = (kk, zpet) => zaokr(zpet ? q + k * (kk) : q + k * (n - 1 + kk));
    g.cisla = true;
    return g;
  }
  // text s číslem na konci / v seznamu
  if (n === 1 && typeof vals[0] === 'string' && !bunky[0].b?.f) {
    const t = vals[0];
    const sez = vSeznamu(t);
    if (sez && !kopie) return (k) => velikostJako(t, sez.s[((sez.i + k) % sez.s.length + sez.s.length) % sez.s.length]);
    const m = /^(.*?)(\d+)(\D*)$/.exec(t);
    if (m && !kopie) {
      const delka = m[2].length;
      return (k) => { const x = +m[2] + k; return m[1] + (m[2][0] === '0' ? String(Math.abs(x)).padStart(delka, '0') : String(Math.abs(x))) + m[3]; };
    }
    return null;
  }
  // více textů ze seznamu (pondělí, středa → pátek…)
  if (n >= 2 && vals.every((v) => typeof v === 'string') && !kopie) {
    const s = vals.map(vSeznamu);
    if (s.every((x) => x && x.s === s[0].s)) {
      const krok = s[1].i - s[0].i;
      const posl = s[n - 1];
      return (k, zpet) => {
        const i = zpet ? s[0].i + krok * k : posl.i + krok * k;
        return velikostJako(vals[0], posl.s[((i % posl.s.length) + posl.s.length) % posl.s.length]);
      };
    }
  }
  return null;
}

function posunDatum(v, jednotka, k) {
  const d = zeSerialu(v);
  if (jednotka === 'rok') return serial(d.y + k, d.m, Math.min(d.d, new Date(Date.UTC(d.y + k, d.m, 0)).getUTCDate())) + (v % 1);
  const m0 = d.m - 1 + k;
  const y = d.y + Math.floor(m0 / 12), m = ((m0 % 12) + 12) % 12 + 1;
  return serial(y, m, Math.min(d.d, new Date(Date.UTC(y, m, 0)).getUTCDate())) + (v % 1);
}
function pracovniPosun(v, k) {
  let s = Math.floor(v), zbyva = Math.abs(k);
  const krok = k < 0 ? -1 : 1;
  while (zbyva) { s += krok; const dow = zeSerialu(s).dow; if (dow !== 0 && dow !== 6) zbyva--; }
  return s;
}

export function rozdelText(t, oddelovace, uvozovky = '"') {
  const out = [];
  let akt = '', uvoz = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (uvozovky && ch === uvozovky) { if (uvoz && t[i + 1] === uvozovky) { akt += ch; i++; continue; } uvoz = !uvoz; continue; }
    if (!uvoz && oddelovace.includes(ch)) { out.push(akt); akt = ''; continue; }
    akt += ch;
  }
  out.push(akt);
  return out;
}

export function uhodniOddelovac(text) {
  const vzorek = text.split(/\r?\n/).slice(0, 10).join('\n');
  const pocty = [[';', 0], ['\t', 0], [',', 0], ['|', 0]].map(([o]) => [o, (vzorek.match(new RegExp(o === '|' ? '\\|' : o, 'g')) || []).length]);
  pocty.sort((a, b) => b[1] - a[1]);
  return pocty[0][1] ? pocty[0][0] : ';';
}

export function rozdelCsv(text, odd) {
  const radky = [];
  let radek = [], akt = '', uvoz = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (uvoz) {
      if (ch === '"') { if (text[i + 1] === '"') { akt += '"'; i++; } else uvoz = false; }
      else akt += ch;
      continue;
    }
    if (ch === '"' && akt === '') { uvoz = true; continue; }
    if (ch === odd) { radek.push(akt); akt = ''; continue; }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      radek.push(akt); radky.push(radek); radek = []; akt = '';
      continue;
    }
    akt += ch;
  }
  if (akt !== '' || radek.length) { radek.push(akt); radky.push(radek); }
  return radky;
}

export { klic, zKlice, textOblasti, rozeberOblast, obsahuje, prekryva, serad, pismena, adresa, MAX_R, MAX_C, jmenoListuVeVzorci, odkazyVeVzorci };
