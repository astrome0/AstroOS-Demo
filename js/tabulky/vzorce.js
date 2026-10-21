// AstroTabulky — vzorce: lexer, parser, výpočet a knihovna funkcí (české názvy jako v Excelu)
//
// Vzorec se ukládá jako text („=SUMA(A1:A5)*2“). Lexer drží pozice tokenů, takže posun odkazů
// při kopírování nebo vkládání řádků přepíše jen odkazy a zbytek textu nechá, jak ho uživatel napsal.
// Oddělovač argumentů je středník, desetinná čárka (česky); čárka mezi odkazy/funkcemi se bere
// jako oddělovač, takže projdou i anglicky napsané vzorce.

import { rozeberBunku, sloupecZPismen, pismena, adresa, MAX_R, MAX_C, rozeberOblast, jmenoListuVeVzorci, oddelList } from './adresy.js';
import { Chyba, E, CHYBY, jeChyba, obecne, formatuj, kodZCeskeho, serial, zeSerialu, dnes, ted, rozpoznej, datumZTextu } from './format.js';
import { tt } from '../i18n.js';

// ---------------------------------------------------------------- odkaz
export class Ref {
  constructor(list, r1, c1, r2 = r1, c2 = c1) {
    this.list = list; this.r1 = r1; this.c1 = c1; this.r2 = r2; this.c2 = c2;
  }
  get radku() { return this.r2 - this.r1 + 1; }
  get sloupcu() { return this.c2 - this.c1 + 1; }
  get jedna() { return this.r1 === this.r2 && this.c1 === this.c2; }
}

const jeRef = (v) => v instanceof Ref;
const jePole = (v) => Array.isArray(v);

// ---------------------------------------------------------------- lexer
const RE_REF = /^(\$?[A-Za-z]{1,3}\$?\d{1,7})(?::(\$?[A-Za-z]{1,3}\$?\d{1,7}))?(?![\p{L}\d_.(\[!])/u;
const RE_SLOUPCE = /^(\$?[A-Za-z]{1,3}):(\$?[A-Za-z]{1,3})(?![\p{L}\d_(])/u;
const RE_RADKY = /^(\$?\d{1,7}):(\$?\d{1,7})(?![\d.,])/;
const RE_JMENO = /^[\p{L}_][\p{L}\d_.]*/u;
const RE_CISLO = /^\d+(?:[.,]\d+)?(?:[eE][+-]?\d+)?|^[.,]\d+(?:[eE][+-]?\d+)?/;
const RE_CHYBA = /^#(DĚLENÍ_NULOU!|NÁZEV\?|HODNOTA!|ODKAZ!|NENÍ_K_DISPOZICI|ČÍSLO!|NULL!|PŘESAH!|POČÍTÁNÍ!|DIV\/0!|NAME\?|VALUE!|REF!|N\/A|NUM!|SPILL!|CALC!)/i;
const EN_CHYBY = { '#DIV/0!': CHYBY.DIV0, '#NAME?': CHYBY.NAZEV, '#VALUE!': CHYBY.HODNOTA, '#REF!': CHYBY.ODKAZ, '#N/A': CHYBY.NA, '#NUM!': CHYBY.CISLO, '#SPILL!': CHYBY.PRESAH, '#CALC!': CHYBY.CALC };

/**
 * Anglicky napsaný vzorec (=IF(A1>5,1,0)): žádný středník a aspoň jedna anglická funkce.
 * Pak je čárka vždy oddělovač a tečka desetinná — normalizujVzorec ho přepíše do češtiny.
 */
export function jeAnglicky(src) {
  const bezTextu = src.replace(/"[^"]*"/g, '""');
  if (bezTextu.includes(';')) return false;
  for (const m of bezTextu.matchAll(/([\p{L}_][\p{L}\d_.]*)\s*\(/gu)) {
    const n = m[1].toUpperCase();
    if (!FUNKCE[n] && ANGLICKY[n]) return true;
  }
  return false;
}

/** Rozloží vzorec (bez „=“) na tokeny { typ, v, a, b }. typ: num str bool err ref fn name op ( ) sep struct */
export function lex(src, anglicky = jeAnglicky(src)) {
  const t = [];
  let i = 0;
  const hodnotaPred = () => {
    const p = t[t.length - 1];
    return p && (['num', 'str', 'bool', 'err', 'ref', 'name', 'struct', ')'].includes(p.typ) || (p.typ === 'op' && p.v === '%'));
  };
  while (i < src.length) {
    const ch = src[i];
    if (ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r') { i++; continue; }
    const a = i;
    const zbytek = src.slice(i);
    if (ch === '"') {
      let s = '';
      i++;
      while (i < src.length) {
        if (src[i] === '"') { if (src[i + 1] === '"') { s += '"'; i += 2; continue; } i++; break; }
        s += src[i++];
      }
      t.push({ typ: 'str', v: s, a, b: i });
      continue;
    }
    let m;
    if (ch === '#' && (m = RE_CHYBA.exec(zbytek))) {
      const kod = m[0].toUpperCase();
      t.push({ typ: 'err', v: EN_CHYBY[kod] || kod, a, b: i + m[0].length });
      i += m[0].length;
      continue;
    }
    // list!odkaz
    let list = null, zacatekOdkazu = i;
    if (ch === "'") {
      let j = i + 1, jm = '';
      while (j < src.length) {
        if (src[j] === "'") { if (src[j + 1] === "'") { jm += "'"; j += 2; continue; } j++; break; }
        jm += src[j++];
      }
      if (src[j] === '!') { list = jm; zacatekOdkazu = j + 1; }
    } else if ((m = /^([\p{L}_][\p{L}\d_.]*)!/u.exec(zbytek))) {
      list = m[1]; zacatekOdkazu = i + m[0].length;
    }
    if (list !== null) {
      const z = src.slice(zacatekOdkazu);
      const r = RE_REF.exec(z) || RE_SLOUPCE.exec(z) || RE_RADKY.exec(z);
      if (r) {
        t.push({ typ: 'ref', v: r[0], list, a, b: zacatekOdkazu + r[0].length, ra: zacatekOdkazu });
        i = zacatekOdkazu + r[0].length;
        continue;
      }
      const e = RE_CHYBA.exec(z);
      if (e) { t.push({ typ: 'err', v: CHYBY.ODKAZ, a, b: zacatekOdkazu + e[0].length }); i = zacatekOdkazu + e[0].length; continue; }
    }
    if (!hodnotaPred() && (m = RE_RADKY.exec(zbytek))) { t.push({ typ: 'ref', v: m[0], list: null, a, b: i + m[0].length, ra: a }); i += m[0].length; continue; }
    // „,5“ hned za hodnotou je oddělovač argumentů (anglický zápis), ne desetinné číslo
    if (anglicky && (m = /^\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|^\.\d+/.exec(zbytek))) {
      t.push({ typ: 'num', v: +m[0], a, b: i + m[0].length });
      i += m[0].length;
      continue;
    }
    if (!anglicky && (m = RE_CISLO.exec(zbytek)) && !(ch === ',' && hodnotaPred())) {
      t.push({ typ: 'num', v: +m[0].replace(',', '.'), a, b: i + m[0].length });
      i += m[0].length;
      continue;
    }
    if ((m = RE_REF.exec(zbytek)) || (m = RE_SLOUPCE.exec(zbytek))) {
      t.push({ typ: 'ref', v: m[0], list: null, a, b: i + m[0].length, ra: a });
      i += m[0].length;
      continue;
    }
    if (ch === '[' || ((m = RE_JMENO.exec(zbytek)) && src[i + m[0].length] === '[')) {
      // strukturovaný odkaz Tabulka1[Sloupec] / [@Sloupec]
      const jm = ch === '[' ? '' : m[0];
      let j = i + jm.length, hloubka = 0;
      for (; j < src.length; j++) {
        if (src[j] === '[') hloubka++;
        if (src[j] === ']') { hloubka--; if (!hloubka) { j++; break; } }
      }
      t.push({ typ: 'struct', tab: jm, v: src.slice(i + jm.length, j), a, b: j });
      i = j;
      continue;
    }
    if ((m = RE_JMENO.exec(zbytek))) {
      const jm = m[0];
      let j = i + jm.length;
      while (src[j] === ' ') j++;
      if (src[j] === '(') t.push({ typ: 'fn', v: jm, a, b: i + jm.length });
      else if (/^(pravda|true)$/i.test(jm)) t.push({ typ: 'bool', v: true, a, b: i + jm.length });
      else if (/^(nepravda|false)$/i.test(jm)) t.push({ typ: 'bool', v: false, a, b: i + jm.length });
      else t.push({ typ: 'name', v: jm, a, b: i + jm.length });
      i += jm.length;
      continue;
    }
    if ((m = /^(<>|<=|>=|[+\-*/^&=<>%])/.exec(zbytek))) { t.push({ typ: 'op', v: m[0], a, b: i + m[0].length }); i += m[0].length; continue; }
    if (ch === '(' || ch === ')') { t.push({ typ: ch, v: ch, a, b: i + 1 }); i++; continue; }
    if (ch === ';' || ch === ',') { t.push({ typ: 'sep', v: ch, a, b: i + 1 }); i++; continue; }
    if (ch === '{' || ch === '}') { t.push({ typ: ch, v: ch, a, b: i + 1 }); i++; continue; }
    if (ch === '\\' || ch === '|') { t.push({ typ: 'sepR', v: ch, a, b: i + 1 }); i++; continue; }
    t.push({ typ: 'neznamy', v: ch, a, b: i + 1 });
    i++;
  }
  return t;
}

// ---------------------------------------------------------------- parser
class ChybaSyntaxe extends Error {}

const PRIORITA = { '=': 1, '<>': 1, '<': 1, '>': 1, '<=': 1, '>=': 1, '&': 2, '+': 3, '-': 3, '*': 4, '/': 4, '^': 5 };

/** Text vzorce (s „=“ nebo bez) → strom. Chyba syntaxe → výjimka ChybaSyntaxe. */
export function parse(text) {
  const src = text[0] === '=' ? text.slice(1) : text;
  const t = lex(src);
  let i = 0;
  const pohled = () => t[i];
  const vezmi = () => t[i++];
  const cekej = (typ) => { const x = vezmi(); if (!x || x.typ !== typ) throw new ChybaSyntaxe(`Očekáváno ${typ}`); return x; };

  function vyraz(minP = 0) {
    let lhs = unarni();
    for (;;) {
      const x = pohled();
      if (!x || x.typ !== 'op') break;
      if (x.v === '%') { vezmi(); lhs = { t: 'pct', a: lhs }; continue; }
      const p = PRIORITA[x.v];
      if (p === undefined || p < minP) break;
      vezmi();
      const rhs = vyraz(x.v === '^' ? p : p + 1);
      lhs = { t: 'bin', op: x.v, a: lhs, b: rhs };
    }
    return lhs;
  }
  function unarni() {
    const x = pohled();
    if (x && x.typ === 'op' && (x.v === '-' || x.v === '+')) {
      vezmi();
      const a = unarni();
      // unární minus váže těsněji než ^ (=-2^2 = 4), ale procenta mají přednost
      return x.v === '-' ? { t: 'neg', a } : a;
    }
    return primarni();
  }
  function primarni() {
    const x = vezmi();
    if (!x) throw new ChybaSyntaxe('Neúplný vzorec');
    switch (x.typ) {
      case 'num': return { t: 'num', v: x.v };
      case 'str': return { t: 'str', v: x.v };
      case 'bool': return { t: 'bool', v: x.v };
      case 'err': return { t: 'err', v: x.v };
      case 'ref': {
        const o = rozeberOblast(x.v);
        if (!o) throw new ChybaSyntaxe('Neplatný odkaz');
        return { t: 'ref', list: x.list, ...o, text: x.v };
      }
      case 'struct': return { t: 'struct', tab: x.tab, spec: x.v };
      case 'name': return { t: 'name', n: x.v };
      case 'fn': {
        cekej('(');
        const args = [];
        if (pohled()?.typ === ')') { vezmi(); return { t: 'fn', n: x.v.toUpperCase(), args }; }
        for (;;) {
          if (pohled()?.typ === 'sep' || pohled()?.typ === ')') args.push({ t: 'vynech' });
          else args.push(vyraz());
          const d = vezmi();
          if (!d) throw new ChybaSyntaxe('Chybí závorka');
          if (d.typ === ')') break;
          if (d.typ !== 'sep') throw new ChybaSyntaxe('Očekáván středník');
        }
        return { t: 'fn', n: x.v.toUpperCase(), args };
      }
      case '(': {
        const v = vyraz();
        cekej(')');
        return v;
      }
      case '{': {
        // maticová konstanta: „;“ = nový řádek, „\“ nebo „,“ = další sloupec
        const radky = [[]];
        for (;;) {
          const y = pohled();
          if (!y) throw new ChybaSyntaxe('Chybí }');
          if (y.typ === '}') { vezmi(); break; }
          if (y.typ === 'sep') { vezmi(); if (y.v === ';') radky.push([]); continue; }
          if (y.typ === 'sepR') { vezmi(); continue; }
          const v = unarni();
          radky[radky.length - 1].push(v.t === 'neg' ? -v.a.v : v.v);
        }
        const w = Math.max(...radky.map((r) => r.length));
        return { t: 'pole', v: radky.filter((r) => r.length).map((r) => [...r, ...Array(w - r.length).fill(E.NA)]) };
      }
      default: throw new ChybaSyntaxe('Neočekávaný znak ' + x.v);
    }
  }
  const strom = vyraz();
  if (i < t.length) throw new ChybaSyntaxe('Nadbytečný text ve vzorci');
  return strom;
}

export function jeSpravny(text) {
  try { parse(text); return true; } catch { return false; }
}

// ---------------------------------------------------------------- úpravy textu vzorce
/** Přepíše odkazy ve vzorci funkcí fn(tok, oblast) → nový text odkazu nebo null (beze změny). */
export function prepisOdkazy(text, fn) {
  if (text[0] !== '=') return text;
  const src = text.slice(1);
  const t = lex(src);
  let out = '', pos = 0;
  for (const x of t) {
    if (x.typ !== 'ref') continue;
    const novy = fn(x);
    if (novy === null || novy === undefined) continue;
    out += src.slice(pos, x.a) + novy;
    pos = x.b;
  }
  return '=' + out + src.slice(pos);
}

function rozeberCast(s) {
  // „$A$1“ / „A“ / „$3“
  const m = /^(\$?)([A-Za-z]{1,3})?(\$?)(\d{1,7})?$/.exec(s);
  return {
    absC: !!m[1] && !!m[2], c: m[2] ? sloupecZPismen(m[2]) : null,
    absR: m[2] ? !!m[3] : !!m[1], r: m[4] ? +m[4] - 1 : null,
  };
}
function slozCast(p) {
  return (p.c !== null ? (p.absC ? '$' : '') + pismena(p.c) : '') + (p.r !== null ? (p.absR ? '$' : '') + (p.r + 1) : '');
}
const casti = (v) => v.split(':').map(rozeberCast);

/** Posune relativní odkazy o dr/dc (kopírování, vyplnění). Mimo list → #ODKAZ!. */
export function posunVzorec(text, dr, dc) {
  if (!dr && !dc) return text;
  return prepisOdkazy(text, (x) => {
    const cs = casti(x.v);
    let chyba = false;
    for (const p of cs) {
      if (p.r !== null && !p.absR) { p.r += dr; if (p.r < 0 || p.r >= MAX_R) chyba = true; }
      if (p.c !== null && !p.absC) { p.c += dc; if (p.c < 0 || p.c >= MAX_C) chyba = true; }
    }
    const pref = x.ra > x.a ? zdrojPrefixu(x) : '';
    if (chyba) return pref + '#ODKAZ!';
    return pref + cs.map(slozCast).join(':');
  });
}
const zdrojPrefixu = (x) => jmenoListuVeVzorci(x.list) + '!';

/**
 * Vložení/odstranění řádků či sloupců. osa 'r'|'c', od = index, n = počet (záporný = odstranění).
 * naListu = jméno listu, kde se mění; listVzorce = list, na kterém vzorec leží.
 */
export function upravPoVlozeni(text, { osa, od, n, naListu, listVzorce, pas = null }) {
  return prepisOdkazy(text, (x) => {
    const cilovy = x.list ?? listVzorce;
    if (cilovy.toLocaleLowerCase('cs') !== naListu.toLocaleLowerCase('cs')) return null;
    const cs = casti(x.v);
    const k = osa === 'r' ? 'r' : 'c';
    const k2 = osa === 'r' ? 'c' : 'r';
    if (cs.some((p) => p[k] === null)) return null;   // celé sloupce při vkládání řádků apod.
    // vložení buněk s posunem jen v pásu sloupců/řádků: mění se jen odkazy celé uvnitř pásu
    if (pas && cs.some((p) => p[k2] === null || p[k2] < pas.od || p[k2] > pas.do)) return null;
    const pref = x.list !== null ? zdrojPrefixu(x) : '';
    if (n > 0) {
      for (const p of cs) if (p[k] >= od) p[k] += n;
      if (cs.length === 2 && cs[0][k] < od && cs[1][k] >= od + n) { /* rozšířeno přirozeně */ }
      return pref + cs.map(slozCast).join(':');
    }
    const konec = od - n - 1; // poslední odstraněný
    const pocet = -n;
    if (cs.length === 1) {
      const p = cs[0];
      if (p[k] >= od && p[k] <= konec) return pref + '#ODKAZ!';
      if (p[k] > konec) p[k] -= pocet;
      return pref + slozCast(p);
    }
    let [a, b] = cs;
    const lo = Math.min(a[k], b[k]), hi = Math.max(a[k], b[k]);
    if (lo >= od && hi <= konec) return pref + '#ODKAZ!';
    const posun = (v, jeKonec) => {
      if (v < od) return v;
      if (v > konec) return v - pocet;
      return jeKonec ? od - 1 : od;
    };
    const aKonec = a[k] > b[k];
    a[k] = posun(a[k], aKonec);
    b[k] = posun(b[k], !aKonec);
    return pref + slozCast(a) + ':' + slozCast(b);
  });
}

/** Přesun oblasti (tažení výběru): odkazy, které do ní míří, jdou s ní. */
export function upravPoPresunu(text, { z, dr, dc, naListu, listVzorce }) {
  return prepisOdkazy(text, (x) => {
    const cilovy = x.list ?? listVzorce;
    if (cilovy.toLocaleLowerCase('cs') !== naListu.toLocaleLowerCase('cs')) return null;
    const cs = casti(x.v);
    if (cs.some((p) => p.r === null || p.c === null)) return null;
    const uvnitr = cs.every((p) => p.r >= z.r1 && p.r <= z.r2 && p.c >= z.c1 && p.c <= z.c2);
    if (!uvnitr) return null;
    for (const p of cs) { p.r += dr; p.c += dc; }
    return (x.list !== null ? zdrojPrefixu(x) : '') + cs.map(slozCast).join(':');
  });
}

/** Přejmenování listu v odkazech. */
export function prejmenujList(text, stary, novy) {
  return prepisOdkazy(text, (x) => {
    if (x.list === null || x.list.toLocaleLowerCase('cs') !== stary.toLocaleLowerCase('cs')) return null;
    return jmenoListuVeVzorci(novy) + '!' + x.v;
  });
}

/** Smazaný list → #ODKAZ!. */
export function smazanyList(text, jmeno) {
  return prepisOdkazy(text, (x) => (x.list !== null && x.list.toLocaleLowerCase('cs') === jmeno.toLocaleLowerCase('cs') ? '#ODKAZ!' : null));
}

/** F4 v editaci: A1 → $A$1 → A$1 → $A1 → A1 pro odkaz pod kurzorem. */
export function prepniAbsolutni(text, kurzor) {
  const src = text.slice(1);
  const t = lex(src).filter((x) => x.typ === 'ref');
  const x = t.find((y) => kurzor - 1 >= y.a && kurzor - 1 <= y.b) || t.filter((y) => y.b <= kurzor - 1).pop();
  if (!x) return null;
  const cs = casti(x.v);
  for (const p of cs) {
    if (p.r !== null && p.c !== null) {
      const stav = (p.absC ? 2 : 0) + (p.absR ? 1 : 0);  // 0 A1, 3 $A$1, 1 A$1, 2 $A1
      const dalsi = { 0: 3, 3: 1, 1: 2, 2: 0 }[stav];
      p.absC = dalsi >= 2; p.absR = dalsi === 3 || dalsi === 1;
    } else if (p.r !== null) p.absR = !p.absR;
    else p.absC = !p.absC;
  }
  const novy = cs.map(slozCast).join(':');
  const pref = src.slice(x.a, x.ra);
  const vysledek = '=' + src.slice(0, x.a) + pref + novy + src.slice(x.b);
  return { text: vysledek, kurzor: 1 + x.a + pref.length + novy.length };
}

/** Odkazy ve vzorci s barvami pro zvýraznění při editaci: [{ a, b, text, list, oblast }] (pozice včetně „=“). */
export function odkazyVeVzorci(text) {
  if (text[0] !== '=') return [];
  try {
    return lex(text.slice(1)).filter((x) => x.typ === 'ref').map((x) => ({ a: x.a + 1, b: x.b + 1, text: x.v, list: x.list, oblast: rozeberOblast(x.v) })).filter((x) => x.oblast);
  } catch { return []; }
}

/** Názvy funkcí na velká písmena a anglické názvy na české (jako Excel po potvrzení). */
export function normalizujVzorec(text) {
  if (text[0] !== '=') return text;
  const src = text.slice(1);
  const en = jeAnglicky(src);
  let t;
  try { t = lex(src, en); } catch { return text; }
  let out = '', pos = 0;
  for (const x of t) {
    let novy = null;
    if (en && x.typ === 'sep') novy = ';';
    else if (en && x.typ === 'num') novy = src.slice(x.a, x.b).replace('.', ',');
    else if (x.typ === 'fn') {
      const up = x.v.toUpperCase();
      novy = FUNKCE[up] ? up : ANGLICKY[up] || up;
    } else if (x.typ === 'ref') novy = src.slice(x.a, x.ra) + x.v.toUpperCase();
    else if (x.typ === 'bool') novy = x.v ? 'PRAVDA' : 'NEPRAVDA';
    if (novy === null) continue;
    out += src.slice(pos, x.a) + novy;
    pos = x.b;
  }
  out += src.slice(pos);
  // doplnit chybějící závorky na konci
  const otevrene = t.filter((x) => x.typ === '(').length - t.filter((x) => x.typ === ')').length;
  if (otevrene > 0) out += ')'.repeat(otevrene);
  return '=' + out;
}

// ---------------------------------------------------------------- převody hodnot
export function cisloZTextu(s) {
  if (typeof s !== 'string') return null;
  const r = rozpoznej(s.trim());
  return typeof r.v === 'number' ? r.v : null;
}

function naCislo(v) {
  if (typeof v === 'number') return v;
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (jeChyba(v)) return v;
  if (typeof v === 'string') { const n = cisloZTextu(v); return n === null ? E.HODNOTA : n; }
  return E.HODNOTA;
}
function naText(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return obecne(v, 15);
  if (typeof v === 'boolean') return v ? 'PRAVDA' : 'NEPRAVDA';
  if (jeChyba(v)) return v;
  return String(v);
}
function naBool(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (v === null || v === undefined) return false;
  if (jeChyba(v)) return v;
  if (typeof v === 'string') {
    if (/^(pravda|true)$/i.test(v)) return true;
    if (/^(nepravda|false)$/i.test(v)) return false;
    return E.HODNOTA;
  }
  return E.HODNOTA;
}

// ---------------------------------------------------------------- výpočet
/**
 * ctx = { S, list, r, c } — S je rozhraní sešitu:
 *   S.list(jmeno) → list | null, S.hodnota(list, r, c), S.bunka(list, r, c), S.rozsah(list) → { r, c } (použité),
 *   S.projdi(list, o, fn(r, c, v)) jen neprázdné, S.nazev(jmeno, list) → { vzorec } | null, S.tabulka(jmeno) …
 */
export function vyhodnot(strom, ctx) {
  try {
    return ev(strom, ctx);
  } catch (e) {
    if (e instanceof Chyba) return e;
    if (e && e.cyklus) throw e;
    console.warn('AstroTabulky: chyba výpočtu', e);
    return E.HODNOTA;
  }
}

function listOdkazu(n, ctx) {
  if (n.list === null || n.list === undefined) return ctx.list;
  const l = ctx.S.list(n.list);
  if (!l) throw E.ODKAZ;
  return l;
}

function ev(n, ctx) {
  switch (n.t) {
    case 'num': case 'str': case 'bool': return n.v;
    case 'err': return new Chyba(n.v);
    case 'vynech': return null;
    case 'pole': return n.v.map((r) => r.slice());
    case 'ref': return new Ref(listOdkazu(n, ctx), n.r1, n.c1, n.r2, n.c2);
    case 'struct': return ctx.S.strukturovany(n.tab, n.spec, ctx) || E.ODKAZ;
    case 'name': {
      if (ctx.let && n.n.toUpperCase() in ctx.let) return ctx.let[n.n.toUpperCase()];
      const d = ctx.S.nazev(n.n, ctx.list);
      if (!d) return E.NAZEV;
      return d(ctx);
    }
    case 'neg': return mapuj1(ev(n.a, ctx), ctx, (x) => { const c = naCislo(x); return jeChyba(c) ? c : -c; });
    case 'pct': return mapuj1(ev(n.a, ctx), ctx, (x) => { const c = naCislo(x); return jeChyba(c) ? c : c / 100; });
    case 'bin': return binar(n.op, ev(n.a, ctx), ev(n.b, ctx), ctx);
    case 'fn': return volej(n, ctx);
    default: return E.HODNOTA;
  }
}

/** Hodnota jedné buňky odkazu / skalár z pole. */
function sk(v, ctx) {
  if (jeRef(v)) {
    if (v.jedna) return ctx.S.hodnota(v.list, v.r1, v.c1);
    // implicitní průnik se řádkem/sloupcem vzorce
    if (v.c1 === v.c2 && ctx.r >= v.r1 && ctx.r <= v.r2 && ctx.list === v.list) return ctx.S.hodnota(v.list, ctx.r, v.c1);
    if (v.r1 === v.r2 && ctx.c >= v.c1 && ctx.c <= v.c2 && ctx.list === v.list) return ctx.S.hodnota(v.list, v.r1, ctx.c);
    return E.HODNOTA;
  }
  if (jePole(v)) return v[0]?.[0] ?? null;
  return v;
}

/** Odkaz nebo hodnota → 2D pole (celé sloupce se ořežou na použitou oblast listu). */
export function naPole(v, ctx) {
  if (jePole(v)) return v;
  if (jeRef(v)) {
    // obří oblasti (A:A, 1:1) se ořežou na použitou část listu, malé zůstanou přesně
    const u = ctx.S.rozsah(v.list);
    const r2 = v.radku > 5000 ? Math.min(v.r2, Math.max(v.r1, u.r)) : v.r2;
    const c2 = v.sloupcu > 500 ? Math.min(v.c2, Math.max(v.c1, u.c)) : v.c2;
    const out = [];
    for (let r = v.r1; r <= r2; r++) {
      const radek = [];
      for (let c = v.c1; c <= c2; c++) radek.push(ctx.S.hodnota(v.list, r, c));
      out.push(radek);
    }
    return out;
  }
  return [[v]];
}

const rozmer = (v) => (jeRef(v) ? [v.radku, v.sloupcu] : jePole(v) ? [v.length, v[0]?.length || 0] : [1, 1]);
const jeVicebunkove = (v) => (jeRef(v) && !v.jedna) || (jePole(v) && (v.length > 1 || (v[0] && v[0].length > 1)));

function mapuj1(v, ctx, fn) {
  if (jeVicebunkove(v)) return naPole(v, ctx).map((r) => r.map(fn));
  return fn(sk(v, ctx));
}

function vysilej(a, b, ctx, fn) {
  if (!jeVicebunkove(a) && !jeVicebunkove(b)) return fn(sk(a, ctx), sk(b, ctx));
  const A = naPole(a, ctx), B = naPole(b, ctx);
  const R = Math.max(A.length, B.length), C = Math.max(A[0]?.length || 0, B[0]?.length || 0);
  const val = (M, r, c) => {
    const rr = M.length === 1 ? 0 : r, cc = M[0].length === 1 ? 0 : c;
    return rr < M.length && cc < M[0].length ? M[rr][cc] : E.NA;
  };
  const out = [];
  for (let r = 0; r < R; r++) {
    const radek = [];
    for (let c = 0; c < C; c++) radek.push(fn(val(A, r, c), val(B, r, c)));
    out.push(radek);
  }
  return out;
}

function porovnej(x, y) {
  // pořadí typů: čísla < text < logické; prázdné = 0 nebo ""
  const typ = (v) => (typeof v === 'number' ? 0 : typeof v === 'string' ? 1 : typeof v === 'boolean' ? 2 : -1);
  if (x === null || x === undefined) x = typeof y === 'string' ? '' : typeof y === 'boolean' ? false : 0;
  if (y === null || y === undefined) y = typeof x === 'string' ? '' : typeof x === 'boolean' ? false : 0;
  const tx = typ(x), ty = typ(y);
  if (tx !== ty) return tx < ty ? -1 : 1;
  if (tx === 1) {
    const a = x.toLocaleLowerCase('cs'), b = y.toLocaleLowerCase('cs');
    return a === b ? 0 : a.localeCompare(b, 'cs') < 0 ? -1 : 1;
  }
  if (tx === 2) return x === y ? 0 : x ? 1 : -1;
  return x === y ? 0 : x < y ? -1 : 1;
}

function binar(op, a, b, ctx) {
  return vysilej(a, b, ctx, (x, y) => {
    if (jeChyba(x)) return x;
    if (jeChyba(y)) return y;
    switch (op) {
      case '&': return naText(x) + naText(y);
      case '=': return porovnej(x, y) === 0;
      case '<>': return porovnej(x, y) !== 0;
      case '<': return porovnej(x, y) < 0;
      case '>': return porovnej(x, y) > 0;
      case '<=': return porovnej(x, y) <= 0;
      case '>=': return porovnej(x, y) >= 0;
    }
    const p = naCislo(x), q = naCislo(y);
    if (jeChyba(p)) return p;
    if (jeChyba(q)) return q;
    switch (op) {
      case '+': return p + q;
      case '-': return p - q;
      case '*': return p * q;
      case '/': return q === 0 ? E.DIV0 : p / q;
      case '^': { const v = p ** q; return isFinite(v) ? v : E.CISLO; }
    }
    return E.HODNOTA;
  });
}

// ---------------------------------------------------------------- volání funkcí
function volej(n, ctx) {
  // chyba vyhozená kdekoli uvnitř funkce se stane její hodnotou (IFERROR ji pak umí chytit)
  try { return volejVnitrne(n, ctx); } catch (e) { if (e instanceof Chyba) return e; throw e; }
}
function volejVnitrne(n, ctx) {
  const f = FUNKCE[n.n] || FUNKCE[ANGLICKY[n.n]];
  if (!f) return E.NAZEV;
  const pocet = n.args.length;
  if (pocet < (f.min ?? 0) || (f.max !== undefined && pocet > f.max)) return E.HODNOTA;
  if (f.lazy) return f.fn(n.args.map((a) => () => zkus(() => ev(a, ctx))), ctx, n.args);
  const args = n.args.map((a) => ev(a, ctx));
  if (f.skal) {
    // skalární funkce se přes pole „zvednou“ (dynamická pole)
    if (args.some(jeVicebunkove)) {
      const pole = args.map((a) => (jeVicebunkove(a) ? naPole(a, ctx) : null));
      const R = Math.max(...pole.map((p) => p?.length || 1));
      const C = Math.max(...pole.map((p) => p?.[0]?.length || 1));
      const out = [];
      for (let r = 0; r < R; r++) {
        const radek = [];
        for (let c = 0; c < C; c++) {
          const a = args.map((x, i) => {
            const p = pole[i];
            if (!p) return sk(x, ctx);
            const rr = p.length === 1 ? 0 : r, cc = p[0].length === 1 ? 0 : c;
            return p[rr]?.[cc] ?? E.NA;
          });
          radek.push(zkus(() => f.fn(a, ctx)));
        }
        out.push(radek);
      }
      return out;
    }
    return zkus(() => f.fn(args.map((a) => sk(a, ctx)), ctx));
  }
  return f.fn(args, ctx);
}
function zkus(fn) {
  try { return fn(); } catch (e) { if (e instanceof Chyba) return e; throw e; }
}

// pomocné pro funkce
const C = (v) => { const n = naCislo(v); if (jeChyba(n)) throw n; return n; };
const T = (v) => { const s = naText(v); if (jeChyba(s)) throw s; return s; };
const B = (v) => { const b = naBool(v); if (jeChyba(b)) throw b; return b; };
const opt = (v, d) => (v === null || v === undefined ? d : v);

/** Všechna čísla z argumentů podle pravidel SUMA (z odkazů jen čísla, přímé hodnoty se převádí). */
function cisla(args, ctx, { chyby = true, logicke = false, text = false } = {}) {
  const out = [];
  for (const a of args) {
    if (jeRef(a)) {
      ctx.S.projdi(a.list, a, (r, c, v) => {
        if (typeof v === 'number') out.push(v);
        else if (jeChyba(v)) { if (chyby) throw v; }
        else if (logicke && typeof v === 'boolean') out.push(v ? 1 : 0);
        else if (text && typeof v === 'string') out.push(0);
      });
    } else if (jePole(a)) {
      for (const r of a) for (const v of r) {
        if (typeof v === 'number') out.push(v);
        else if (jeChyba(v)) { if (chyby) throw v; }
        else if (logicke && typeof v === 'boolean') out.push(v ? 1 : 0);
      }
    } else if (a !== null && a !== undefined) {
      if (jeChyba(a)) throw a;
      out.push(C(a));
    }
  }
  return out;
}

/** Všechny hodnoty (i text) — ploše. */
function vse(args, ctx, { prazdne = false } = {}) {
  const out = [];
  for (const a of args) {
    if (jeRef(a) || jePole(a)) {
      for (const r of naPole(a, ctx)) for (const v of r) if (prazdne || (v !== null && v !== undefined)) out.push(v);
    } else out.push(a);
  }
  return out;
}

const plochy = (v, ctx) => naPole(v, ctx).flat();

// kritéria (COUNTIF, SUMIF…)
function kriterium(k) {
  if (jeChyba(k)) return (v) => jeChyba(v) && v.kod === k.kod;
  if (typeof k === 'number') return (v) => (typeof v === 'number' ? v === k : typeof v === 'string' && cisloZTextu(v) === k);
  if (typeof k === 'boolean') return (v) => v === k;
  let s = k === null || k === undefined ? '' : String(k);
  let op = '=';
  const m = /^(<=|>=|<>|<|>|=)([\s\S]*)$/.exec(s);
  if (m) { op = m[1]; s = m[2]; }
  if (s === '') {
    if (op === '=') return (v) => v === null || v === undefined || v === '';
    if (op === '<>') return (v) => !(v === null || v === undefined || v === '');
  }
  let n = cisloZTextu(s);
  if (n === null) { const d = datumZTextu(s); if (d) n = d.v; }
  if (/^(pravda|true)$/i.test(s) && (op === '=' || op === '<>')) return (v) => (op === '=' ? v === true : v !== true);
  if (/^(nepravda|false)$/i.test(s) && (op === '=' || op === '<>')) return (v) => (op === '=' ? v === false : v !== false);
  if (n !== null) {
    return (v) => {
      const x = typeof v === 'number' ? v : typeof v === 'string' && op === '=' ? cisloZTextu(v) : null;
      if (x === null) return op === '<>';
      return { '=': x === n, '<>': x !== n, '<': x < n, '>': x > n, '<=': x <= n, '>=': x >= n }[op];
    };
  }
  const low = s.toLocaleLowerCase('cs');
  if ((op === '=' || op === '<>') && /[*?~]/.test(s)) {
    const re = new RegExp('^' + low.replace(/~([*?~])|([.+^${}()|[\]\\])|(\*)|(\?)/g, (x, esc, spec, hv, ot) => (esc ? '\\' + esc : spec ? '\\' + spec : hv ? '[\\s\\S]*' : '.')) + '$', 's');
    return (v) => { const t = typeof v === 'string' ? re.test(v.toLocaleLowerCase('cs')) : false; return op === '=' ? t : !t; };
  }
  return (v) => {
    if (op === '=') return typeof v === 'string' && v.toLocaleLowerCase('cs') === low;
    if (op === '<>') return !(typeof v === 'string' && v.toLocaleLowerCase('cs') === low);
    if (typeof v !== 'string') return false;
    const c = porovnej(v, s);
    return { '<': c < 0, '>': c > 0, '<=': c <= 0, '>=': c >= 0 }[op];
  };
}

/** Pro SUMIFS/COUNTIFS: páry (oblast, kritérium) → maska indexů vůči tvaru první oblasti. */
function maskaKriterii(pary, ctx) {
  let tvar = null, maska = null;
  for (let i = 0; i < pary.length; i += 2) {
    const oblast = naPole(pary[i], ctx);
    const test = kriterium(sk(pary[i + 1], ctx));
    if (!tvar) { tvar = [oblast.length, oblast[0]?.length || 0]; maska = oblast.map((r) => r.map(() => true)); }
    if (oblast.length !== tvar[0] && jeRef(pary[i]) && pary[i].radku !== tvar[0]) throw E.HODNOTA;
    for (let r = 0; r < tvar[0]; r++) for (let c = 0; c < tvar[1]; c++) if (maska[r][c] && !test(oblast[r]?.[c] ?? null)) maska[r][c] = false;
  }
  return { maska, tvar };
}

/** Oblast stejného tvaru jako „vzor“ začínající v rohu odkazu (SUMIF s kratší oblastí součtu). */
function roztahni(ref, vzor, ctx) {
  if (jeRef(ref) && jeRef(vzor)) return naPole(new Ref(ref.list, ref.r1, ref.c1, ref.r1 + vzor.radku - 1, ref.c1 + vzor.sloupcu - 1), ctx);
  return naPole(ref, ctx);
}

const zaokrouhli = (x, d) => {
  const f = 10 ** d;
  const v = Math.round(Math.abs(x) * f + 1e-9) / f;
  return Math.sign(x) * v;
};

function statistikaRozptyl(xs, vyber) {
  if (xs.length < (vyber ? 2 : 1)) throw E.DIV0;
  const pr = xs.reduce((a, b) => a + b, 0) / xs.length;
  return xs.reduce((a, b) => a + (b - pr) ** 2, 0) / (xs.length - (vyber ? 1 : 0));
}

function percentil(xs, k) {
  if (!xs.length || k < 0 || k > 1) throw E.CISLO;
  const s = [...xs].sort((a, b) => a - b);
  const h = (s.length - 1) * k;
  const lo = Math.floor(h);
  return s[lo] + (h - lo) * ((s[lo + 1] ?? s[lo]) - s[lo]);
}

// vyhledávání
function najdiPresne(pole, hledane, { wildcard = true } = {}) {
  const test = typeof hledane === 'string' && wildcard && /[*?~]/.test(hledane) ? kriterium('=' + hledane) : (v) => porovnej(v, hledane) === 0 && typeof v === typeof hledane;
  for (let i = 0; i < pole.length; i++) if (test(pole[i])) return i;
  return -1;
}
function najdiPriblizne(pole, hledane, sestupne = false) {
  // binární hledání jako Excel: poslední hodnota <= hledané (nebo >= při sestupném řazení)
  let lo = 0, hi = pole.length - 1, vysl = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    let v = pole[mid];
    let k = 0;
    // prázdné a jiného typu přeskočit
    while (v !== null && typeof v !== typeof hledane && mid + k < hi) { k++; v = pole[mid + k]; }
    if (v === null || typeof v !== typeof hledane) { hi = mid - 1; continue; }
    const c = porovnej(v, hledane);
    if (sestupne ? c >= 0 : c <= 0) { vysl = mid + k; lo = mid + k + 1; } else hi = mid - 1;
  }
  return vysl;
}

function vyber1D(v, ctx) {
  const p = naPole(v, ctx);
  if (p.length === 1) return { hodnoty: p[0], vodorovne: true };
  return { hodnoty: p.map((r) => r[0]), vodorovne: false };
}

function datumCasti(v) { return zeSerialu(C(v)); }
const pocetDniMesice = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
function posunMesic(s, mes) {
  const d = zeSerialu(s);
  const m0 = d.m - 1 + mes;
  const y = d.y + Math.floor(m0 / 12);
  const m = ((m0 % 12) + 12) % 12 + 1;
  return { y, m, d: Math.min(d.d, pocetDniMesice(y, m)) };
}
function pracovniDen(s, svatky) {
  const dow = zeSerialu(s).dow;
  return dow !== 0 && dow !== 6 && !svatky.has(Math.floor(s));
}

function svatkySet(a, ctx) { return new Set(a === null || a === undefined ? [] : cisla([a], ctx).map(Math.floor)); }

// finanční
function pmt(r, n, pv, fv = 0, typ = 0) {
  if (r === 0) return -(pv + fv) / n;
  const q = (1 + r) ** n;
  return -(r * (pv * q + fv)) / ((1 + r * typ) * (q - 1));
}
function fv(r, n, p, pv = 0, typ = 0) {
  if (r === 0) return -(pv + p * n);
  const q = (1 + r) ** n;
  return -(pv * q + p * (1 + r * typ) * (q - 1) / r);
}
function pv(r, n, p, f = 0, typ = 0) {
  if (r === 0) return -(f + p * n);
  const q = (1 + r) ** n;
  return -(f + p * (1 + r * typ) * (q - 1) / r) / q;
}
function ipmt(r, per, n, pvv, f = 0, typ = 0) {
  const p = pmt(r, n, pvv, f, typ);
  if (per === 1 && typ === 1) return 0;
  let i = fv(r, per - 1, p, pvv, typ) * r;
  if (typ === 1) i /= 1 + r;
  return i;
}
function newton(f, x0) {
  let x = x0;
  for (let i = 0; i < 100; i++) {
    const y = f(x);
    const d = (f(x + 1e-7) - y) / 1e-7;
    if (!isFinite(d) || d === 0) break;
    const nx = x - y / d;
    if (Math.abs(nx - x) < 1e-10) return nx;
    x = nx;
  }
  if (Math.abs(f(x)) < 1e-6) return x;
  throw E.CISLO;
}

function textZHodnoty(v, kod) {
  const k = kodZCeskeho(String(kod));
  if (typeof v === 'string') { const n = cisloZTextu(v); if (n !== null) v = n; }
  return formatuj(v, k).text;
}

const razeni = (a, b) => {
  if (jeChyba(a) || jeChyba(b)) return jeChyba(a) ? (jeChyba(b) ? 0 : 1) : -1;
  if (a === null || a === undefined || a === '') return b === null || b === undefined || b === '' ? 0 : 1;
  if (b === null || b === undefined || b === '') return -1;
  return porovnej(a, b);
};

// ---------------------------------------------------------------- knihovna funkcí
// kat: fin, dat, mat, stat, vyhl, text, log, info
// a: názvy argumentů pro nápovědu (… = opakování), p: popis
const F = {};
const def = (n, en, kat, a, p, fn, o = {}) => { F[n] = { n, en, kat, a, p, fn, ...o }; };

// ---------- matematické
def('SUMA', 'SUM', 'mat', ['číslo1', '[číslo2]', '…'], 'Sečte všechna čísla v oblasti buněk.', (a, ctx) => cisla(a, ctx).reduce((x, y) => x + y, 0), { min: 1 });
def('SUMIF', 'SUMIF', 'mat', ['oblast', 'kritérium', '[součet]'], 'Sečte buňky vybrané podle zadaného kritéria.', (a, ctx) => {
  const obl = naPole(a[0], ctx);
  const sum = a[2] !== undefined && a[2] !== null ? roztahni(a[2], a[0], ctx) : obl;
  const test = kriterium(sk(a[1], ctx));
  let s = 0;
  obl.forEach((r, i) => r.forEach((v, j) => { if (test(v)) { const x = sum[i]?.[j]; if (jeChyba(x)) throw x; if (typeof x === 'number') s += x; } }));
  return s;
}, { min: 2, max: 3 });
def('SUMIFS', 'SUMIFS', 'mat', ['součet', 'oblast_kritérií1', 'kritérium1', '…'], 'Sečte buňky, které splňují několik kritérií.', (a, ctx) => {
  const sum = naPole(a[0], ctx);
  const { maska } = maskaKriterii(a.slice(1), ctx);
  let s = 0;
  maska.forEach((r, i) => r.forEach((ok, j) => { if (ok) { const x = sum[i]?.[j]; if (jeChyba(x)) throw x; if (typeof x === 'number') s += x; } }));
  return s;
}, { min: 3 });
def('SOUČIN', 'PRODUCT', 'mat', ['číslo1', '[číslo2]', '…'], 'Vynásobí všechna čísla zadaná jako argumenty.', (a, ctx) => { const x = cisla(a, ctx); return x.length ? x.reduce((p, q) => p * q, 1) : 0; }, { min: 1 });
def('SOUČIN.SKALÁRNÍ', 'SUMPRODUCT', 'mat', ['pole1', '[pole2]', '…'], 'Vrátí součet součinů odpovídajících prvků oblastí nebo polí.', (a, ctx) => {
  const P = a.map((x) => naPole(x, ctx));
  const [R, Cc] = [P[0].length, P[0][0]?.length || 0];
  if (P.some((p) => p.length !== R || (p[0]?.length || 0) !== Cc)) return E.HODNOTA;
  let s = 0;
  for (let r = 0; r < R; r++) for (let c = 0; c < Cc; c++) {
    let q = 1;
    for (const p of P) { const v = p[r][c]; if (jeChyba(v)) return v; q *= typeof v === 'number' ? v : typeof v === 'boolean' ? +v : 0; }
    s += q;
  }
  return s;
}, { min: 1 });
def('ZAOKROUHLIT', 'ROUND', 'mat', ['číslo', 'číslice'], 'Zaokrouhlí číslo na zadaný počet číslic.', ([x, d]) => zaokrouhli(C(x), C(d)), { skal: true, min: 2, max: 2 });
def('ROUNDUP', 'ROUNDUP', 'mat', ['číslo', 'číslice'], 'Zaokrouhlí číslo nahoru (směrem od nuly).', ([x, d]) => { const f = 10 ** C(d); const v = C(x); return Math.sign(v) * Math.ceil(Math.abs(v) * f - 1e-9) / f; }, { skal: true, min: 2, max: 2 });
def('ROUNDDOWN', 'ROUNDDOWN', 'mat', ['číslo', 'číslice'], 'Zaokrouhlí číslo dolů (směrem k nule).', ([x, d]) => { const f = 10 ** C(d); const v = C(x); return Math.sign(v) * Math.floor(Math.abs(v) * f + 1e-9) / f; }, { skal: true, min: 2, max: 2 });
def('ZAOKR.NAHORU', 'CEILING', 'mat', ['číslo', 'významnost'], 'Zaokrouhlí číslo nahoru na nejbližší násobek významnosti.', ([x, s]) => { const v = C(x), n = C(opt(s, 1)); return n === 0 ? 0 : Math.ceil(v / n - 1e-12) * n; }, { skal: true, min: 1, max: 2 });
def('ZAOKR.DOLŮ', 'FLOOR', 'mat', ['číslo', 'významnost'], 'Zaokrouhlí číslo dolů na nejbližší násobek významnosti.', ([x, s]) => { const v = C(x), n = C(opt(s, 1)); if (n === 0) return E.DIV0; return Math.floor(v / n + 1e-12) * n; }, { skal: true, min: 1, max: 2 });
def('MROUND', 'MROUND', 'mat', ['číslo', 'násobek'], 'Vrátí číslo zaokrouhlené na požadovaný násobek.', ([x, m]) => { const n = C(m); return n === 0 ? 0 : Math.round(C(x) / n) * n; }, { skal: true, min: 2, max: 2 });
def('CELÁ.ČÁST', 'INT', 'mat', ['číslo'], 'Zaokrouhlí číslo dolů na nejbližší celé číslo.', ([x]) => Math.floor(C(x)), { skal: true, min: 1, max: 1 });
def('USEKNOUT', 'TRUNC', 'mat', ['číslo', '[číslice]'], 'Zkrátí číslo na celé číslo odstraněním desetinné části.', ([x, d]) => { const f = 10 ** C(opt(d, 0)); return Math.trunc(C(x) * f) / f; }, { skal: true, min: 1, max: 2 });
def('ABS', 'ABS', 'mat', ['číslo'], 'Vrátí absolutní hodnotu čísla.', ([x]) => Math.abs(C(x)), { skal: true, min: 1, max: 1 });
def('ODMOCNINA', 'SQRT', 'mat', ['číslo'], 'Vrátí druhou odmocninu čísla.', ([x]) => { const v = C(x); return v < 0 ? E.CISLO : Math.sqrt(v); }, { skal: true, min: 1, max: 1 });
def('POWER', 'POWER', 'mat', ['číslo', 'mocnina'], 'Umocní číslo na zadanou mocninu.', ([x, y]) => { const v = C(x) ** C(y); return isFinite(v) ? v : E.CISLO; }, { skal: true, min: 2, max: 2 });
def('EXP', 'EXP', 'mat', ['číslo'], 'Vrátí e umocněné na zadané číslo.', ([x]) => Math.exp(C(x)), { skal: true, min: 1, max: 1 });
def('LN', 'LN', 'mat', ['číslo'], 'Vrátí přirozený logaritmus čísla.', ([x]) => { const v = C(x); return v <= 0 ? E.CISLO : Math.log(v); }, { skal: true, min: 1, max: 1 });
def('LOG', 'LOG', 'mat', ['číslo', '[základ]'], 'Vrátí logaritmus čísla o zadaném základu.', ([x, b]) => { const v = C(x), z = C(opt(b, 10)); return v <= 0 || z <= 0 || z === 1 ? E.CISLO : Math.log(v) / Math.log(z); }, { skal: true, min: 1, max: 2 });
def('LOG10', 'LOG10', 'mat', ['číslo'], 'Vrátí dekadický logaritmus čísla.', ([x]) => { const v = C(x); return v <= 0 ? E.CISLO : Math.log10(v); }, { skal: true, min: 1, max: 1 });
def('MOD', 'MOD', 'mat', ['číslo', 'dělitel'], 'Vrátí zbytek po dělení.', ([x, d]) => { const a = C(x), b = C(d); if (b === 0) return E.DIV0; return a - b * Math.floor(a / b); }, { skal: true, min: 2, max: 2 });
def('QUOTIENT', 'QUOTIENT', 'mat', ['čitatel', 'jmenovatel'], 'Vrátí celou část dělení.', ([x, d]) => { const b = C(d); return b === 0 ? E.DIV0 : Math.trunc(C(x) / b); }, { skal: true, min: 2, max: 2 });
def('PI', 'PI', 'mat', [], 'Vrátí hodnotu čísla pí.', () => Math.PI, { min: 0, max: 0 });
def('NÁHČÍSLO', 'RAND', 'mat', [], 'Vrátí náhodné číslo mezi 0 a 1.', () => Math.random(), { min: 0, max: 0, volatilni: true });
def('RANDBETWEEN', 'RANDBETWEEN', 'mat', ['dolní', 'horní'], 'Vrátí náhodné celé číslo mezi zadanými čísly.', ([a, b]) => { const lo = Math.ceil(C(a)), hi = Math.floor(C(b)); if (lo > hi) return E.CISLO; return lo + Math.floor(Math.random() * (hi - lo + 1)); }, { skal: true, min: 2, max: 2, volatilni: true });
def('SIGN', 'SIGN', 'mat', ['číslo'], 'Vrátí znaménko čísla: 1, 0 nebo -1.', ([x]) => Math.sign(C(x)), { skal: true, min: 1, max: 1 });
def('FAKTORIÁL', 'FACT', 'mat', ['číslo'], 'Vrátí faktoriál čísla.', ([x]) => { let n = Math.floor(C(x)); if (n < 0) return E.CISLO; let f = 1; while (n > 1) f *= n--; return f; }, { skal: true, min: 1, max: 1 });
def('KOMBINACE', 'COMBIN', 'mat', ['počet', 'vybráno'], 'Vrátí počet kombinací pro zadaný počet položek.', ([n, k]) => { const a = Math.floor(C(n)), b = Math.floor(C(k)); if (b > a || b < 0) return E.CISLO; let r = 1; for (let i = 1; i <= b; i++) r = r * (a - b + i) / i; return Math.round(r); }, { skal: true, min: 2, max: 2 });
def('SIN', 'SIN', 'mat', ['číslo'], 'Vrátí sinus úhlu v radiánech.', ([x]) => Math.sin(C(x)), { skal: true, min: 1, max: 1 });
def('COS', 'COS', 'mat', ['číslo'], 'Vrátí kosinus úhlu v radiánech.', ([x]) => Math.cos(C(x)), { skal: true, min: 1, max: 1 });
def('TG', 'TAN', 'mat', ['číslo'], 'Vrátí tangens úhlu v radiánech.', ([x]) => Math.tan(C(x)), { skal: true, min: 1, max: 1 });
def('ARCSIN', 'ASIN', 'mat', ['číslo'], 'Vrátí arkussinus čísla.', ([x]) => { const v = C(x); return Math.abs(v) > 1 ? E.CISLO : Math.asin(v); }, { skal: true, min: 1, max: 1 });
def('ARCCOS', 'ACOS', 'mat', ['číslo'], 'Vrátí arkuskosinus čísla.', ([x]) => { const v = C(x); return Math.abs(v) > 1 ? E.CISLO : Math.acos(v); }, { skal: true, min: 1, max: 1 });
def('ARCTG', 'ATAN', 'mat', ['číslo'], 'Vrátí arkustangens čísla.', ([x]) => Math.atan(C(x)), { skal: true, min: 1, max: 1 });
def('ARCTG2', 'ATAN2', 'mat', ['x', 'y'], 'Vrátí arkustangens ze souřadnic x a y.', ([x, y]) => Math.atan2(C(y), C(x)), { skal: true, min: 2, max: 2 });
def('RADIANS', 'RADIANS', 'mat', ['úhel'], 'Převede stupně na radiány.', ([x]) => C(x) * Math.PI / 180, { skal: true, min: 1, max: 1 });
def('DEGREES', 'DEGREES', 'mat', ['úhel'], 'Převede radiány na stupně.', ([x]) => C(x) * 180 / Math.PI, { skal: true, min: 1, max: 1 });
def('SUMA.ČTVERCŮ', 'SUMSQ', 'mat', ['číslo1', '[číslo2]', '…'], 'Vrátí součet druhých mocnin argumentů.', (a, ctx) => cisla(a, ctx).reduce((s, x) => s + x * x, 0), { min: 1 });
def('GCD', 'GCD', 'mat', ['číslo1', '[číslo2]', '…'], 'Vrátí největší společný dělitel.', (a, ctx) => cisla(a, ctx).map(Math.floor).reduce((x, y) => { while (y) [x, y] = [y, x % y]; return x; }, 0), { min: 1 });
def('LCM', 'LCM', 'mat', ['číslo1', '[číslo2]', '…'], 'Vrátí nejmenší společný násobek.', (a, ctx) => cisla(a, ctx).map(Math.floor).reduce((x, y) => { let p = x, q = y; while (q) [p, q] = [q, p % q]; return p ? x / p * y : 0; }, 1), { min: 1 });
def('ZAOKROUHLIT.NA.SUDÉ', 'EVEN', 'mat', ['číslo'], 'Zaokrouhlí číslo nahoru na nejbližší sudé celé číslo.', ([x]) => { const v = C(x); const s = Math.sign(v) || 1; let n = Math.ceil(Math.abs(v)); if (n % 2) n++; return s * n; }, { skal: true, min: 1, max: 1 });
def('ZAOKROUHLIT.NA.LICHÉ', 'ODD', 'mat', ['číslo'], 'Zaokrouhlí číslo nahoru na nejbližší liché celé číslo.', ([x]) => { const v = C(x); const s = Math.sign(v) || 1; let n = Math.ceil(Math.abs(v)); if (n % 2 === 0) n++; return s * n; }, { skal: true, min: 1, max: 1 });
def('ROMAN', 'ROMAN', 'mat', ['číslo'], 'Převede arabské číslo na římské.', ([x]) => {
  let n = Math.floor(C(x)); if (n < 0 || n > 3999) return E.HODNOTA;
  const t = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let s = ''; for (const [v, z] of t) while (n >= v) { s += z; n -= v; } return s;
}, { skal: true, min: 1, max: 2 });
def('SUBTOTAL', 'SUBTOTAL', 'mat', ['funkce', 'odkaz1', '…'], 'Vrátí souhrn v seznamu (1 průměr, 2 počet, 3 počet2, 4 max, 5 min, 9 součet…).', (a, ctx) => {
  const k = C(sk(a[0], ctx)) % 100;
  const map = { 1: 'PRŮMĚR', 2: 'POČET', 3: 'POČET2', 4: 'MAX', 5: 'MIN', 6: 'SOUČIN', 7: 'SMODCH.VÝBĚR.S', 8: 'SMODCH.P', 9: 'SUMA', 10: 'VAR.S', 11: 'VAR.P' };
  const f = F[map[k]];
  if (!f) return E.HODNOTA;
  // skryté (vyfiltrované) řádky a jiné mezisoučty (SUBTOTAL v buňce) se nepočítají
  const viditelne = a.slice(1).map((x) => {
    if (!jeRef(x)) return x;
    const out = [];
    naPole(x, ctx).forEach((r, i) => {
      if (ctx.S.skrytyRadek(x.list, x.r1 + i)) return;
      out.push(r.map((v, j) => (/SUBTOTAL\(/i.test(ctx.S.bunka(x.list, x.r1 + i, x.c1 + j)?.f || '') ? null : v)));
    });
    return out;
  });
  return f.fn(viditelne, ctx);
}, { min: 2 });
def('SEQUENCE', 'SEQUENCE', 'mat', ['řádky', '[sloupce]', '[začátek]', '[krok]'], 'Vytvoří pole po sobě jdoucích čísel.', (a, ctx) => {
  const r = C(sk(opt(a[0], 1), ctx)), c = C(sk(opt(a[1], 1), ctx)), z = C(sk(opt(a[2], 1), ctx)), k = C(sk(opt(a[3], 1), ctx));
  if (r < 1 || c < 1 || r * c > 1e6) return E.CALC;
  return Array.from({ length: r }, (_, i) => Array.from({ length: c }, (__, j) => z + (i * c + j) * k));
}, { min: 1, max: 4 });
def('RANDARRAY', 'RANDARRAY', 'mat', ['[řádky]', '[sloupce]', '[min]', '[max]', '[celé]'], 'Vrátí pole náhodných čísel.', (a, ctx) => {
  const r = C(sk(opt(a[0], 1), ctx)), c = C(sk(opt(a[1], 1), ctx)), lo = C(sk(opt(a[2], 0), ctx)), hi = C(sk(opt(a[3], 1), ctx)), cele = a[4] ? B(sk(a[4], ctx)) : false;
  return Array.from({ length: r }, () => Array.from({ length: c }, () => (cele ? Math.floor(lo + Math.random() * (hi - lo + 1)) : lo + Math.random() * (hi - lo))));
}, { min: 0, max: 5, volatilni: true });

// ---------- statistické
def('PRŮMĚR', 'AVERAGE', 'stat', ['číslo1', '[číslo2]', '…'], 'Vrátí průměrnou hodnotu (aritmetický průměr) argumentů.', (a, ctx) => { const x = cisla(a, ctx); return x.length ? x.reduce((p, q) => p + q, 0) / x.length : E.DIV0; }, { min: 1 });
def('AVERAGEA', 'AVERAGEA', 'stat', ['hodnota1', '[hodnota2]', '…'], 'Vrátí průměr, text a NEPRAVDA počítá jako 0, PRAVDA jako 1.', (a, ctx) => { const x = cisla(a, ctx, { logicke: true, text: true }); return x.length ? x.reduce((p, q) => p + q, 0) / x.length : E.DIV0; }, { min: 1 });
def('AVERAGEIF', 'AVERAGEIF', 'stat', ['oblast', 'kritérium', '[průměr]'], 'Vrátí průměr buněk, které splňují kritérium.', (a, ctx) => {
  const obl = naPole(a[0], ctx);
  const src = a[2] !== undefined && a[2] !== null ? roztahni(a[2], a[0], ctx) : obl;
  const test = kriterium(sk(a[1], ctx));
  let s = 0, n = 0;
  obl.forEach((r, i) => r.forEach((v, j) => { if (test(v)) { const x = src[i]?.[j]; if (typeof x === 'number') { s += x; n++; } } }));
  return n ? s / n : E.DIV0;
}, { min: 2, max: 3 });
def('AVERAGEIFS', 'AVERAGEIFS', 'stat', ['průměr', 'oblast_kritérií1', 'kritérium1', '…'], 'Vrátí průměr buněk, které splňují více kritérií.', (a, ctx) => {
  const src = naPole(a[0], ctx);
  const { maska } = maskaKriterii(a.slice(1), ctx);
  let s = 0, n = 0;
  maska.forEach((r, i) => r.forEach((ok, j) => { const x = src[i]?.[j]; if (ok && typeof x === 'number') { s += x; n++; } }));
  return n ? s / n : E.DIV0;
}, { min: 3 });
def('POČET', 'COUNT', 'stat', ['hodnota1', '[hodnota2]', '…'], 'Spočítá buňky, které obsahují čísla.', (a, ctx) => {
  let n = 0;
  for (const x of a) {
    if (jeRef(x)) ctx.S.projdi(x.list, x, (r, c, v) => { if (typeof v === 'number') n++; });
    else if (jePole(x)) n += x.flat().filter((v) => typeof v === 'number').length;
    else if (typeof x === 'number' || (typeof x === 'string' && cisloZTextu(x) !== null) || typeof x === 'boolean') n++;
  }
  return n;
}, { min: 1 });
def('POČET2', 'COUNTA', 'stat', ['hodnota1', '[hodnota2]', '…'], 'Spočítá buňky, které nejsou prázdné.', (a, ctx) => {
  let n = 0;
  for (const x of a) {
    if (jeRef(x)) ctx.S.projdi(x.list, x, (r, c, v) => { if (v !== null && v !== undefined) n++; });
    else if (jePole(x)) n += x.flat().filter((v) => v !== null && v !== undefined).length;
    else if (x !== null && x !== undefined) n++;
  }
  return n;
}, { min: 1 });
def('COUNTBLANK', 'COUNTBLANK', 'stat', ['oblast'], 'Spočítá prázdné buňky v oblasti.', (a, ctx) => {
  const x = a[0];
  if (!jeRef(x)) return E.HODNOTA;
  let plne = 0;
  ctx.S.projdi(x.list, x, (r, c, v) => { if (v !== null && v !== undefined && v !== '') plne++; });
  return x.radku * x.sloupcu - plne;
}, { min: 1, max: 1 });
def('COUNTIF', 'COUNTIF', 'stat', ['oblast', 'kritérium'], 'Spočítá buňky v oblasti, které odpovídají kritériu.', (a, ctx) => {
  const test = kriterium(sk(a[1], ctx));
  const x = a[0];
  if (jeRef(x)) {
    // prochází se jen neprázdné buňky; prázdné se dopočítají, když je kritérium bere
    let n = 0, plne = 0;
    ctx.S.projdi(x.list, x, (r, c, v) => { plne++; if (test(v)) n++; });
    if (test(null)) n += x.radku * x.sloupcu - plne;
    return n;
  }
  return plochy(x, ctx).filter(test).length;
}, { min: 2, max: 2 });
def('COUNTIFS', 'COUNTIFS', 'stat', ['oblast_kritérií1', 'kritérium1', '…'], 'Spočítá buňky, které splňují několik kritérií.', (a, ctx) => {
  const { maska } = maskaKriterii(a, ctx);
  return maska.flat().filter(Boolean).length;
}, { min: 2 });
def('MAX', 'MAX', 'stat', ['číslo1', '[číslo2]', '…'], 'Vrátí největší hodnotu z množiny hodnot.', (a, ctx) => { const x = cisla(a, ctx); return x.length ? Math.max(...x) : 0; }, { min: 1 });
def('MIN', 'MIN', 'stat', ['číslo1', '[číslo2]', '…'], 'Vrátí nejmenší hodnotu z množiny hodnot.', (a, ctx) => { const x = cisla(a, ctx); return x.length ? Math.min(...x) : 0; }, { min: 1 });
def('MAXIFS', 'MAXIFS', 'stat', ['max_oblast', 'oblast_kritérií1', 'kritérium1', '…'], 'Vrátí maximum z buněk splňujících kritéria.', (a, ctx) => {
  const src = naPole(a[0], ctx); const { maska } = maskaKriterii(a.slice(1), ctx);
  const x = []; maska.forEach((r, i) => r.forEach((ok, j) => { const v = src[i]?.[j]; if (ok && typeof v === 'number') x.push(v); }));
  return x.length ? Math.max(...x) : 0;
}, { min: 3 });
def('MINIFS', 'MINIFS', 'stat', ['min_oblast', 'oblast_kritérií1', 'kritérium1', '…'], 'Vrátí minimum z buněk splňujících kritéria.', (a, ctx) => {
  const src = naPole(a[0], ctx); const { maska } = maskaKriterii(a.slice(1), ctx);
  const x = []; maska.forEach((r, i) => r.forEach((ok, j) => { const v = src[i]?.[j]; if (ok && typeof v === 'number') x.push(v); }));
  return x.length ? Math.min(...x) : 0;
}, { min: 3 });
def('MEDIAN', 'MEDIAN', 'stat', ['číslo1', '[číslo2]', '…'], 'Vrátí medián (prostřední hodnotu) zadaných čísel.', (a, ctx) => { const x = cisla(a, ctx).sort((p, q) => p - q); if (!x.length) return E.CISLO; const m = x.length >> 1; return x.length % 2 ? x[m] : (x[m - 1] + x[m]) / 2; }, { min: 1 });
def('MODE.SNGL', 'MODE.SNGL', 'stat', ['číslo1', '[číslo2]', '…'], 'Vrátí nejčastěji se vyskytující hodnotu.', (a, ctx) => {
  const x = cisla(a, ctx); const n = new Map(); let best = null, bn = 1;
  for (const v of x) { const k = (n.get(v) || 0) + 1; n.set(v, k); if (k > bn) { bn = k; best = v; } }
  return best === null ? E.NA : best;
}, { min: 1 });
def('LARGE', 'LARGE', 'stat', ['pole', 'k'], 'Vrátí k-tou největší hodnotu.', (a, ctx) => { const x = cisla([a[0]], ctx).sort((p, q) => q - p); const k = Math.ceil(C(sk(a[1], ctx))); return k < 1 || k > x.length ? E.CISLO : x[k - 1]; }, { min: 2, max: 2 });
def('SMALL', 'SMALL', 'stat', ['pole', 'k'], 'Vrátí k-tou nejmenší hodnotu.', (a, ctx) => { const x = cisla([a[0]], ctx).sort((p, q) => p - q); const k = Math.ceil(C(sk(a[1], ctx))); return k < 1 || k > x.length ? E.CISLO : x[k - 1]; }, { min: 2, max: 2 });
def('RANK.EQ', 'RANK.EQ', 'stat', ['číslo', 'odkaz', '[pořadí]'], 'Vrátí pořadí čísla v seznamu čísel.', (a, ctx) => {
  const v = C(sk(a[0], ctx)); const x = cisla([a[1]], ctx); const vzes = a[2] ? C(sk(a[2], ctx)) : 0;
  if (!x.includes(v)) return E.NA;
  return 1 + x.filter((y) => (vzes ? y < v : y > v)).length;
}, { min: 2, max: 3 });
def('SMODCH.VÝBĚR.S', 'STDEV.S', 'stat', ['číslo1', '[číslo2]', '…'], 'Odhadne směrodatnou odchylku výběru.', (a, ctx) => Math.sqrt(statistikaRozptyl(cisla(a, ctx), true)), { min: 1 });
def('SMODCH.P', 'STDEV.P', 'stat', ['číslo1', '[číslo2]', '…'], 'Vypočte směrodatnou odchylku základního souboru.', (a, ctx) => Math.sqrt(statistikaRozptyl(cisla(a, ctx), false)), { min: 1 });
def('VAR.S', 'VAR.S', 'stat', ['číslo1', '[číslo2]', '…'], 'Odhadne rozptyl výběru.', (a, ctx) => statistikaRozptyl(cisla(a, ctx), true), { min: 1 });
def('VAR.P', 'VAR.P', 'stat', ['číslo1', '[číslo2]', '…'], 'Vypočte rozptyl základního souboru.', (a, ctx) => statistikaRozptyl(cisla(a, ctx), false), { min: 1 });
def('PERCENTIL.INC', 'PERCENTILE.INC', 'stat', ['pole', 'k'], 'Vrátí k-tý percentil hodnot v oblasti (k od 0 do 1).', (a, ctx) => percentil(cisla([a[0]], ctx), C(sk(a[1], ctx))), { min: 2, max: 2 });
def('QUARTIL.INC', 'QUARTILE.INC', 'stat', ['pole', 'kvartil'], 'Vrátí kvartil množiny dat (0–4).', (a, ctx) => { const q = Math.floor(C(sk(a[1], ctx))); return q < 0 || q > 4 ? E.CISLO : percentil(cisla([a[0]], ctx), q / 4); }, { min: 2, max: 2 });
def('CORREL', 'CORREL', 'stat', ['pole1', 'pole2'], 'Vrátí korelační koeficient mezi dvěma množinami dat.', (a, ctx) => {
  const x = plochy(a[0], ctx), y = plochy(a[1], ctx);
  const p = x.map((v, i) => [v, y[i]]).filter(([u, w]) => typeof u === 'number' && typeof w === 'number');
  if (p.length < 2) return E.DIV0;
  const mx = p.reduce((s, [u]) => s + u, 0) / p.length, my = p.reduce((s, [, w]) => s + w, 0) / p.length;
  let sxy = 0, sxx = 0, syy = 0;
  for (const [u, w] of p) { sxy += (u - mx) * (w - my); sxx += (u - mx) ** 2; syy += (w - my) ** 2; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : E.DIV0;
}, { min: 2, max: 2 });
function regrese(a, ctx, yi = 0, xi = 1) {
  const y = plochy(a[yi], ctx), x = plochy(a[xi], ctx);
  const p = x.map((v, i) => [v, y[i]]).filter(([u, w]) => typeof u === 'number' && typeof w === 'number');
  if (p.length < 2) throw E.DIV0;
  const mx = p.reduce((s, [u]) => s + u, 0) / p.length, my = p.reduce((s, [, w]) => s + w, 0) / p.length;
  let sxy = 0, sxx = 0;
  for (const [u, w] of p) { sxy += (u - mx) * (w - my); sxx += (u - mx) ** 2; }
  if (!sxx) throw E.DIV0;
  const k = sxy / sxx;
  return { k, q: my - k * mx };
}
def('SLOPE', 'SLOPE', 'stat', ['pole_y', 'pole_x'], 'Vrátí směrnici lineární regresní přímky.', (a, ctx) => regrese(a, ctx).k, { min: 2, max: 2 });
def('INTERCEPT', 'INTERCEPT', 'stat', ['pole_y', 'pole_x'], 'Vrátí úsek lineární regresní přímky na ose y.', (a, ctx) => regrese(a, ctx).q, { min: 2, max: 2 });
def('FORECAST.LINEAR', 'FORECAST.LINEAR', 'stat', ['x', 'pole_y', 'pole_x'], 'Předpoví hodnotu pomocí lineárního trendu.', (a, ctx) => { const { k, q } = regrese(a, ctx, 1, 2); return k * C(sk(a[0], ctx)) + q; }, { min: 3, max: 3 });
def('GEOMEAN', 'GEOMEAN', 'stat', ['číslo1', '[číslo2]', '…'], 'Vrátí geometrický průměr.', (a, ctx) => { const x = cisla(a, ctx); if (!x.length || x.some((v) => v <= 0)) return E.CISLO; return Math.exp(x.reduce((s, v) => s + Math.log(v), 0) / x.length); }, { min: 1 });

// ---------- logické
def('KDYŽ', 'IF', 'log', ['podmínka', '[ano]', '[ne]'], 'Ověří, zda je splněna podmínka, a vrátí jednu hodnotu, pokud PRAVDA, a jinou, pokud NEPRAVDA.', (a, ctx) => {
  const p = a[0]();
  if (jeVicebunkove(p)) {
    const P = naPole(p, ctx);
    const ano = a[1] ? a[1]() : true, ne = a[2] ? a[2]() : false;
    const A = jeVicebunkove(ano) ? naPole(ano, ctx) : null, N = jeVicebunkove(ne) ? naPole(ne, ctx) : null;
    return P.map((r, i) => r.map((v, j) => {
      const b = naBool(v); if (jeChyba(b)) return b;
      return b ? (A ? A[i]?.[j] ?? E.NA : sk(ano, ctx)) : (N ? N[i]?.[j] ?? E.NA : sk(ne, ctx));
    }));
  }
  const b = naBool(sk(p, ctx));
  if (jeChyba(b)) return b;
  if (b) return a[1] ? a[1]() ?? 0 : true;
  return a[2] ? a[2]() ?? 0 : false;
}, { min: 1, max: 3, lazy: true });
def('IFS', 'IFS', 'log', ['podmínka1', 'hodnota1', '…'], 'Ověří, zda je splněna jedna nebo více podmínek, a vrátí hodnotu první pravdivé.', (a, ctx) => {
  for (let i = 0; i + 1 < a.length; i += 2) { const b = naBool(sk(a[i](), ctx)); if (jeChyba(b)) return b; if (b) return a[i + 1](); }
  return E.NA;
}, { min: 2, lazy: true });
def('A', 'AND', 'log', ['logická1', '[logická2]', '…'], 'Vrátí PRAVDA, pokud mají všechny argumenty hodnotu PRAVDA.', (a, ctx) => {
  const x = vse(a, ctx).filter((v) => typeof v !== 'string' || /^(pravda|nepravda|true|false)$/i.test(v));
  if (!x.length) return E.HODNOTA;
  for (const v of x) { const b = naBool(v); if (jeChyba(b)) return b; if (!b) return false; }
  return true;
}, { min: 1 });
def('NEBO', 'OR', 'log', ['logická1', '[logická2]', '…'], 'Vrátí PRAVDA, pokud má alespoň jeden argument hodnotu PRAVDA.', (a, ctx) => {
  const x = vse(a, ctx).filter((v) => typeof v !== 'string' || /^(pravda|nepravda|true|false)$/i.test(v));
  if (!x.length) return E.HODNOTA;
  let out = false;
  for (const v of x) { const b = naBool(v); if (jeChyba(b)) return b; if (b) out = true; }
  return out;
}, { min: 1 });
def('XOR', 'XOR', 'log', ['logická1', '[logická2]', '…'], 'Vrátí logický exkluzivní součet všech argumentů.', (a, ctx) => vse(a, ctx).reduce((s, v) => s !== B(v), false), { min: 1 });
def('NE', 'NOT', 'log', ['logická'], 'Změní NEPRAVDA na PRAVDA a PRAVDA na NEPRAVDA.', ([x]) => !B(x), { skal: true, min: 1, max: 1 });
def('PRAVDA', 'TRUE', 'log', [], 'Vrátí logickou hodnotu PRAVDA.', () => true, { min: 0, max: 0 });
def('NEPRAVDA', 'FALSE', 'log', [], 'Vrátí logickou hodnotu NEPRAVDA.', () => false, { min: 0, max: 0 });
def('IFERROR', 'IFERROR', 'log', ['hodnota', 'hodnota_při_chybě'], 'Vrátí hodnotu_při_chybě, pokud je výsledkem výrazu chyba, jinak vrátí hodnotu výrazu.', (a, ctx) => {
  const v = a[0]();
  if (jeVicebunkove(v)) { const alt = a[1](); return naPole(v, ctx).map((r) => r.map((x) => (jeChyba(x) ? sk(alt, ctx) : x))); }
  const x = sk(v, ctx);
  return jeChyba(x) ? a[1]() : v;
}, { min: 2, max: 2, lazy: true });
def('IFNA', 'IFNA', 'log', ['hodnota', 'hodnota_při_na'], 'Vrátí zadanou hodnotu, pokud je výsledkem #NENÍ_K_DISPOZICI.', (a, ctx) => { const v = a[0](); const x = sk(v, ctx); return jeChyba(x) && x.kod === CHYBY.NA ? a[1]() : v; }, { min: 2, max: 2, lazy: true });
def('SWITCH', 'SWITCH', 'log', ['výraz', 'hodnota1', 'výsledek1', '…', '[výchozí]'], 'Porovná výraz se seznamem hodnot a vrátí výsledek první shody.', (a, ctx) => {
  const v = sk(a[0](), ctx);
  let i = 1;
  for (; i + 1 < a.length; i += 2) if (porovnej(sk(a[i](), ctx), v) === 0) return a[i + 1]();
  return i < a.length ? a[i]() : E.NA;
}, { min: 3, lazy: true });
def('LET', 'LET', 'log', ['název1', 'hodnota1', '…', 'výpočet'], 'Přiřadí názvy výsledkům výpočtů, aby šly ve vzorci použít.', (a, ctx, uzly) => {
  const scope = { ...(ctx.let || {}) };
  const c2 = { ...ctx, let: scope };
  for (let i = 0; i + 1 < uzly.length; i += 2) {
    if (uzly[i].t !== 'name') return E.HODNOTA;
    scope[uzly[i].n.toUpperCase()] = ev(uzly[i + 1], c2);
  }
  return ev(uzly[uzly.length - 1], c2);
}, { min: 3, lazy: true });

// ---------- textové
def('CONCAT', 'CONCAT', 'text', ['text1', '[text2]', '…'], 'Spojí seznam nebo oblast textových řetězců.', (a, ctx) => vse(a, ctx).map((v) => T(v)).join(''), { min: 1 });
def('CONCATENATE', 'CONCATENATE', 'text', ['text1', '[text2]', '…'], 'Spojí několik textových řetězců do jednoho.', (a, ctx) => a.map((v) => T(sk(v, ctx))).join(''), { min: 1 });
def('TEXTJOIN', 'TEXTJOIN', 'text', ['oddělovač', 'ignorovat_prázdné', 'text1', '…'], 'Spojí texty s oddělovačem.', (a, ctx) => {
  const odd = T(sk(a[0], ctx)), ign = B(sk(a[1], ctx));
  return vse(a.slice(2), ctx, { prazdne: true }).map((v) => T(v)).filter((s) => !ign || s !== '').join(odd);
}, { min: 3 });
def('ZLEVA', 'LEFT', 'text', ['text', '[znaky]'], 'Vrátí zadaný počet znaků od začátku textu.', ([t, n]) => { const k = C(opt(n, 1)); return k < 0 ? E.HODNOTA : [...T(t)].slice(0, k).join(''); }, { skal: true, min: 1, max: 2 });
def('ZPRAVA', 'RIGHT', 'text', ['text', '[znaky]'], 'Vrátí zadaný počet znaků od konce textu.', ([t, n]) => { const k = C(opt(n, 1)); if (k < 0) return E.HODNOTA; const s = [...T(t)]; return k ? s.slice(-k).join('') : ''; }, { skal: true, min: 1, max: 2 });
def('ČÁST', 'MID', 'text', ['text', 'start', 'znaky'], 'Vrátí znaky z prostředka textu od zadané pozice.', ([t, s, n]) => { const a = C(s), k = C(n); if (a < 1 || k < 0) return E.HODNOTA; return [...T(t)].slice(a - 1, a - 1 + k).join(''); }, { skal: true, min: 3, max: 3 });
def('DÉLKA', 'LEN', 'text', ['text'], 'Vrátí počet znaků textového řetězce.', ([t]) => [...T(t)].length, { skal: true, min: 1, max: 1 });
def('VELKÁ', 'UPPER', 'text', ['text'], 'Převede text na velká písmena.', ([t]) => T(t).toLocaleUpperCase('cs'), { skal: true, min: 1, max: 1 });
def('MALÁ', 'LOWER', 'text', ['text'], 'Převede text na malá písmena.', ([t]) => T(t).toLocaleLowerCase('cs'), { skal: true, min: 1, max: 1 });
def('VELKÁ2', 'PROPER', 'text', ['text'], 'Převede první písmeno každého slova na velké.', ([t]) => T(t).toLocaleLowerCase('cs').replace(/(^|[^\p{L}])(\p{L})/gu, (m, a, b) => a + b.toLocaleUpperCase('cs')), { skal: true, min: 1, max: 1 });
def('PROČISTIT', 'TRIM', 'text', ['text'], 'Odstraní z textu mezery kromě jednoduchých mezer mezi slovy.', ([t]) => T(t).replace(/ +/g, ' ').trim(), { skal: true, min: 1, max: 1 });
def('VYČISTIT', 'CLEAN', 'text', ['text'], 'Odstraní z textu netisknutelné znaky.', ([t]) => T(t).replace(/[\x00-\x1f]/g, ''), { skal: true, min: 1, max: 1 });
def('DOSADIT', 'SUBSTITUTE', 'text', ['text', 'starý', 'nový', '[instance]'], 'Nahradí v textu starý text novým.', ([t, s, n, k]) => {
  const txt = T(t), st = T(s), nv = T(n);
  if (!st) return txt;
  if (k === null || k === undefined) return txt.split(st).join(nv);
  const kk = C(k); let i = -1;
  for (let j = 0; j < kk; j++) { i = txt.indexOf(st, i + 1); if (i < 0) return txt; }
  return txt.slice(0, i) + nv + txt.slice(i + st.length);
}, { skal: true, min: 3, max: 4 });
def('NAHRADIT', 'REPLACE', 'text', ['starý_text', 'start', 'znaky', 'nový_text'], 'Nahradí část textu jiným textem.', ([t, s, n, nv]) => { const a = [...T(t)]; a.splice(C(s) - 1, C(n), T(nv)); return a.join(''); }, { skal: true, min: 4, max: 4 });
def('NAJÍT', 'FIND', 'text', ['co', 'kde', '[start]'], 'Vrátí pozici textu v jiném textu (rozlišuje velikost písmen).', ([co, kde, st]) => { const i = T(kde).indexOf(T(co), C(opt(st, 1)) - 1); return i < 0 ? E.HODNOTA : i + 1; }, { skal: true, min: 2, max: 3 });
def('HLEDAT', 'SEARCH', 'text', ['co', 'kde', '[start]'], 'Vrátí pozici textu v jiném textu (nerozlišuje velikost, umí * a ?).', ([co, kde, st]) => {
  const s = T(kde).toLocaleLowerCase('cs'), q = T(co).toLocaleLowerCase('cs');
  const re = new RegExp(q.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[\\s\\S]*').replace(/\?/g, '.'));
  const zac = C(opt(st, 1)) - 1;
  const m = re.exec(s.slice(zac));
  return m ? m.index + zac + 1 : E.HODNOTA;
}, { skal: true, min: 2, max: 3 });
def('OPAKOVAT', 'REPT', 'text', ['text', 'počet'], 'Zopakuje text zadaný počet krát.', ([t, n]) => { const k = Math.floor(C(n)); return k < 0 ? E.HODNOTA : T(t).repeat(Math.min(k, 32767)); }, { skal: true, min: 2, max: 2 });
def('STEJNÉ', 'EXACT', 'text', ['text1', 'text2'], 'Ověří, zda jsou dva texty stejné (rozlišuje velikost písmen).', ([a, b]) => T(a) === T(b), { skal: true, min: 2, max: 2 });
def('HODNOTA.NA.TEXT', 'TEXT', 'text', ['hodnota', 'formát'], 'Převede hodnotu na text v zadaném číselném formátu.', ([v, f]) => textZHodnoty(v, T(f)), { skal: true, min: 2, max: 2 });
def('HODNOTA', 'VALUE', 'text', ['text'], 'Převede text představující číslo na číslo.', ([t]) => { if (typeof t === 'number') return t; const n = cisloZTextu(T(t)); if (n !== null) return n; const d = datumZTextu(T(t)); return d ? d.v : E.HODNOTA; }, { skal: true, min: 1, max: 1 });
def('ZNAK', 'CHAR', 'text', ['číslo'], 'Vrátí znak určený číslem kódu.', ([n]) => String.fromCharCode(C(n)), { skal: true, min: 1, max: 1 });
def('UNICHAR', 'UNICHAR', 'text', ['číslo'], 'Vrátí znak Unicode podle čísla.', ([n]) => String.fromCodePoint(C(n)), { skal: true, min: 1, max: 1 });
def('KÓD', 'CODE', 'text', ['text'], 'Vrátí číselný kód prvního znaku textu.', ([t]) => { const s = T(t); return s ? s.codePointAt(0) : E.HODNOTA; }, { skal: true, min: 1, max: 1 });
def('T', 'T', 'text', ['hodnota'], 'Vrátí text, pokud je hodnota text, jinak prázdný řetězec.', ([v]) => (typeof v === 'string' ? v : ''), { skal: true, min: 1, max: 1 });
def('TEXTBEFORE', 'TEXTBEFORE', 'text', ['text', 'oddělovač', '[instance]'], 'Vrátí text před oddělovačem.', ([t, d, k]) => { const s = T(t), o = T(d); const n = C(opt(k, 1)); const casti = s.split(o); if (casti.length <= Math.abs(n)) return E.NA; return n > 0 ? casti.slice(0, n).join(o) : casti.slice(0, casti.length + n).join(o); }, { skal: true, min: 2, max: 3 });
def('TEXTAFTER', 'TEXTAFTER', 'text', ['text', 'oddělovač', '[instance]'], 'Vrátí text za oddělovačem.', ([t, d, k]) => { const s = T(t), o = T(d); const n = C(opt(k, 1)); const casti = s.split(o); if (casti.length <= Math.abs(n)) return E.NA; return n > 0 ? casti.slice(n).join(o) : casti.slice(casti.length + n).join(o); }, { skal: true, min: 2, max: 3 });
def('TEXTSPLIT', 'TEXTSPLIT', 'text', ['text', 'oddělovač_sloupců', '[oddělovač_řádků]'], 'Rozdělí text do sloupců (a řádků) podle oddělovačů.', (a, ctx) => {
  const s = T(sk(a[0], ctx)), os = T(sk(opt(a[1], ''), ctx)), or = a[2] !== undefined && a[2] !== null ? T(sk(a[2], ctx)) : null;
  const radky = or ? s.split(or) : [s];
  const out = radky.map((r) => (os ? r.split(os) : [r]));
  const w = Math.max(...out.map((r) => r.length));
  return out.map((r) => [...r, ...Array(w - r.length).fill(E.NA)]);
}, { min: 2, max: 3 });

// ---------- datum a čas
def('DNES', 'TODAY', 'dat', [], 'Vrátí dnešní datum.', () => dnes(), { min: 0, max: 0, volatilni: true, format: 'd.m.yyyy' });
def('NYNÍ', 'NOW', 'dat', [], 'Vrátí aktuální datum a čas.', () => ted(), { min: 0, max: 0, volatilni: true, format: 'd.m.yyyy h:mm' });
def('DATUM', 'DATE', 'dat', ['rok', 'měsíc', 'den'], 'Vrátí pořadové číslo data z roku, měsíce a dne.', ([y, m, d]) => {
  let yy = Math.floor(C(y)); if (yy < 1900) yy += 1900;
  const t = new Date(Date.UTC(yy, Math.floor(C(m)) - 1, Math.floor(C(d))));
  const v = serial(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
  return v < 0 ? E.CISLO : v;
}, { skal: true, min: 3, max: 3, format: 'd.m.yyyy' });
def('ČAS', 'TIME', 'dat', ['hodina', 'minuta', 'sekunda'], 'Vrátí desetinné číslo představující čas.', ([h, m, s]) => (((C(h) * 3600 + C(m) * 60 + C(s)) / 86400) % 1 + 1) % 1, { skal: true, min: 3, max: 3, format: 'h:mm' });
def('ROK', 'YEAR', 'dat', ['datum'], 'Vrátí rok z data.', ([d]) => datumCasti(d).y, { skal: true, min: 1, max: 1 });
def('MĚSÍC', 'MONTH', 'dat', ['datum'], 'Vrátí měsíc (1–12) z data.', ([d]) => datumCasti(d).m, { skal: true, min: 1, max: 1 });
def('DEN', 'DAY', 'dat', ['datum'], 'Vrátí den v měsíci (1–31).', ([d]) => datumCasti(d).d, { skal: true, min: 1, max: 1 });
def('HODINA', 'HOUR', 'dat', ['čas'], 'Vrátí hodinu (0–23).', ([d]) => datumCasti(d).h, { skal: true, min: 1, max: 1 });
def('MINUTA', 'MINUTE', 'dat', ['čas'], 'Vrátí minutu (0–59).', ([d]) => datumCasti(d).mi, { skal: true, min: 1, max: 1 });
def('SEKUNDA', 'SECOND', 'dat', ['čas'], 'Vrátí sekundu (0–59).', ([d]) => datumCasti(d).s, { skal: true, min: 1, max: 1 });
def('DENTÝDNE', 'WEEKDAY', 'dat', ['datum', '[typ]'], 'Vrátí číslo dne v týdnu (1 = neděle; typ 2: 1 = pondělí).', ([d, t]) => {
  const w = datumCasti(d).dow; const typ = C(opt(t, 1));
  if (typ === 2) return w === 0 ? 7 : w;
  if (typ === 3) return w === 0 ? 6 : w - 1;
  return w + 1;
}, { skal: true, min: 1, max: 2 });
def('WEEKNUM', 'WEEKNUM', 'dat', ['datum', '[typ]'], 'Vrátí číslo týdne v roce.', ([d, t]) => {
  const s = C(d); const { y } = zeSerialu(s); const typ = C(opt(t, 1));
  const zac = serial(y, 1, 1); const dow = zeSerialu(zac).dow;
  const posun = typ === 2 ? (dow + 6) % 7 : dow;
  return Math.floor((s - zac + posun) / 7) + 1;
}, { skal: true, min: 1, max: 2 });
def('ISOWEEKNUM', 'ISOWEEKNUM', 'dat', ['datum'], 'Vrátí číslo týdne podle ISO 8601.', ([d]) => {
  const { y, m, d: dd } = datumCasti(d);
  const t = new Date(Date.UTC(y, m - 1, dd));
  const den = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - den);
  const zac = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - zac) / 864e5 + 1) / 7);
}, { skal: true, min: 1, max: 1 });
def('DATEDIF', 'DATEDIF', 'dat', ['začátek', 'konec', 'jednotka'], 'Vypočítá počet dní, měsíců nebo let mezi dvěma daty ("Y", "M", "D", "MD", "YM", "YD").', ([a, b, j]) => {
  const s1 = Math.floor(C(a)), s2 = Math.floor(C(b)); if (s2 < s1) return E.CISLO;
  const d1 = zeSerialu(s1), d2 = zeSerialu(s2);
  const u = T(j).toUpperCase();
  let mes = (d2.y - d1.y) * 12 + d2.m - d1.m; if (d2.d < d1.d) mes--;
  if (u === 'D') return s2 - s1;
  if (u === 'M') return mes;
  if (u === 'Y') return Math.floor(mes / 12);
  if (u === 'YM') return mes % 12;
  if (u === 'MD') { let x = d2.d - d1.d; if (x < 0) x += pocetDniMesice(d2.m === 1 ? d2.y - 1 : d2.y, d2.m === 1 ? 12 : d2.m - 1); return x; }
  if (u === 'YD') { let x = s2 - serial(d2.y, d1.m, Math.min(d1.d, pocetDniMesice(d2.y, d1.m))); if (x < 0) x = s2 - serial(d2.y - 1, d1.m, Math.min(d1.d, pocetDniMesice(d2.y - 1, d1.m))); return x; }
  return E.CISLO;
}, { skal: true, min: 3, max: 3 });
def('EDATE', 'EDATE', 'dat', ['začátek', 'měsíce'], 'Vrátí datum posunuté o zadaný počet měsíců.', ([s, m]) => { const x = posunMesic(C(s), Math.trunc(C(m))); return serial(x.y, x.m, x.d); }, { skal: true, min: 2, max: 2, format: 'd.m.yyyy' });
def('EOMONTH', 'EOMONTH', 'dat', ['začátek', 'měsíce'], 'Vrátí poslední den měsíce posunutého o zadaný počet měsíců.', ([s, m]) => { const x = posunMesic(C(s), Math.trunc(C(m))); return serial(x.y, x.m, pocetDniMesice(x.y, x.m)); }, { skal: true, min: 2, max: 2, format: 'd.m.yyyy' });
def('DAYS', 'DAYS', 'dat', ['konec', 'začátek'], 'Vrátí počet dní mezi dvěma daty.', ([k, z]) => Math.floor(C(k)) - Math.floor(C(z)), { skal: true, min: 2, max: 2 });
def('NETWORKDAYS', 'NETWORKDAYS', 'dat', ['začátek', 'konec', '[svátky]'], 'Vrátí počet celých pracovních dní mezi dvěma daty.', (a, ctx) => {
  let s1 = Math.floor(C(sk(a[0], ctx))), s2 = Math.floor(C(sk(a[1], ctx)));
  const zn = s2 < s1 ? -1 : 1; if (zn < 0) [s1, s2] = [s2, s1];
  const sv = svatkySet(a[2], ctx);
  let n = 0; for (let s = s1; s <= s2; s++) if (pracovniDen(s, sv)) n++;
  return n * zn;
}, { min: 2, max: 3 });
def('WORKDAY', 'WORKDAY', 'dat', ['začátek', 'dny', '[svátky]'], 'Vrátí datum po zadaném počtu pracovních dní.', (a, ctx) => {
  let s = Math.floor(C(sk(a[0], ctx))); let d = Math.trunc(C(sk(a[1], ctx)));
  const sv = svatkySet(a[2], ctx); const krok = d < 0 ? -1 : 1;
  while (d) { s += krok; if (pracovniDen(s, sv)) d -= krok; }
  return s;
}, { min: 2, max: 3, format: 'd.m.yyyy' });
def('DATUMHODN', 'DATEVALUE', 'dat', ['text'], 'Převede datum ve formě textu na pořadové číslo.', ([t]) => { const d = datumZTextu(T(t)); return d ? Math.floor(d.v) : E.HODNOTA; }, { skal: true, min: 1, max: 1 });
def('ČASHODN', 'TIMEVALUE', 'dat', ['text'], 'Převede čas ve formě textu na desetinné číslo.', ([t]) => { const d = datumZTextu(T(t)); return d ? d.v % 1 : E.HODNOTA; }, { skal: true, min: 1, max: 1 });
def('YEARFRAC', 'YEARFRAC', 'dat', ['začátek', 'konec', '[základ]'], 'Vrátí část roku mezi dvěma daty.', ([a, b, z]) => {
  let s1 = C(a), s2 = C(b); if (s2 < s1) [s1, s2] = [s2, s1];
  const zakl = C(opt(z, 0));
  if (zakl === 1) return (s2 - s1) / 365.25;
  if (zakl === 2) return (s2 - s1) / 360;
  if (zakl === 3) return (s2 - s1) / 365;
  const d1 = zeSerialu(s1), d2 = zeSerialu(s2);
  const dd1 = Math.min(d1.d, 30), dd2 = d2.d === 31 && dd1 >= 30 ? 30 : d2.d;
  return ((d2.y - d1.y) * 360 + (d2.m - d1.m) * 30 + dd2 - dd1) / 360;
}, { skal: true, min: 2, max: 3 });

// ---------- vyhledávací a odkazy
def('SVYHLEDAT', 'VLOOKUP', 'vyhl', ['hledat', 'tabulka', 'sloupec', '[typ]'], 'Vyhledá hodnotu v prvním sloupci tabulky a vrátí hodnotu ze zadaného sloupce ve stejném řádku.', (a, ctx) => {
  const h = sk(a[0], ctx); if (jeChyba(h)) return h;
  const tab = naPole(a[1], ctx); const s = Math.floor(C(sk(a[2], ctx)));
  const pribl = a[3] === undefined || a[3] === null ? true : B(sk(a[3], ctx));
  if (s < 1) return E.HODNOTA;
  if (s > (tab[0]?.length || 0)) return E.ODKAZ;
  const prvni = tab.map((r) => r[0]);
  const i = pribl ? najdiPriblizne(prvni, h) : najdiPresne(prvni, h);
  if (i < 0) return E.NA;
  return tab[i][s - 1] ?? 0;
}, { min: 3, max: 4 });
def('VVYHLEDAT', 'HLOOKUP', 'vyhl', ['hledat', 'tabulka', 'řádek', '[typ]'], 'Vyhledá hodnotu v prvním řádku tabulky a vrátí hodnotu ze zadaného řádku.', (a, ctx) => {
  const h = sk(a[0], ctx); const tab = naPole(a[1], ctx); const s = Math.floor(C(sk(a[2], ctx)));
  const pribl = a[3] === undefined || a[3] === null ? true : B(sk(a[3], ctx));
  if (s < 1) return E.HODNOTA;
  if (s > tab.length) return E.ODKAZ;
  const i = pribl ? najdiPriblizne(tab[0], h) : najdiPresne(tab[0], h);
  return i < 0 ? E.NA : tab[s - 1][i] ?? 0;
}, { min: 3, max: 4 });
def('XLOOKUP', 'XLOOKUP', 'vyhl', ['hledat', 'pole_hledat', 'pole_vrátit', '[pokud_nenalezeno]', '[režim_shody]', '[režim_hledání]'], 'Vyhledá hodnotu v oblasti a vrátí odpovídající položku z druhé oblasti.', (a, ctx) => {
  const h = sk(a[0], ctx);
  const { hodnoty, vodorovne } = vyber1D(a[1], ctx);
  const vr = naPole(a[2], ctx);
  const rezim = a[4] !== undefined && a[4] !== null ? C(sk(a[4], ctx)) : 0;
  const smer = a[5] !== undefined && a[5] !== null ? C(sk(a[5], ctx)) : 1;
  let idx = -1;
  const poradi = smer < 0 ? [...hodnoty.keys()].reverse() : [...hodnoty.keys()];
  if (rezim === 0 || rezim === 2) {
    const test = rezim === 2 && typeof h === 'string' ? kriterium('=' + h) : (v) => porovnej(v, h) === 0 && (typeof v === typeof h || v === null);
    idx = poradi.find((i) => hodnoty[i] !== null && test(hodnoty[i])) ?? -1;
  } else {
    let nejl = -1;
    for (const i of poradi) {
      const v = hodnoty[i]; if (v === null || typeof v !== typeof h) continue;
      const c = porovnej(v, h);
      if (c === 0) { nejl = i; break; }
      if (rezim === -1 && c < 0 && (nejl < 0 || porovnej(v, hodnoty[nejl]) > 0)) nejl = i;
      if (rezim === 1 && c > 0 && (nejl < 0 || porovnej(v, hodnoty[nejl]) < 0)) nejl = i;
    }
    idx = nejl;
  }
  if (idx < 0) return a[3] !== undefined && a[3] !== null ? a[3] : E.NA;
  if (vodorovne) return vr.length === 1 ? vr[0][idx] ?? null : vr.map((r) => [r[idx]]);
  return vr[idx] ? (vr[idx].length === 1 ? vr[idx][0] : [vr[idx]]) : E.NA;
}, { min: 3, max: 6 });
def('POZVYHLEDAT', 'MATCH', 'vyhl', ['hledat', 'prohledat', '[typ]'], 'Vrátí relativní pozici položky v poli, která odpovídá zadané hodnotě.', (a, ctx) => {
  const h = sk(a[0], ctx); const { hodnoty } = vyber1D(a[1], ctx);
  const typ = a[2] === undefined || a[2] === null ? 1 : C(sk(a[2], ctx));
  const i = typ === 0 ? najdiPresne(hodnoty, h) : najdiPriblizne(hodnoty, h, typ < 0);
  return i < 0 ? E.NA : i + 1;
}, { min: 2, max: 3 });
def('XMATCH', 'XMATCH', 'vyhl', ['hledat', 'prohledat', '[režim_shody]', '[režim_hledání]'], 'Vrátí relativní pozici položky v poli.', (a, ctx) => {
  const h = sk(a[0], ctx); const { hodnoty } = vyber1D(a[1], ctx);
  const smer = a[3] !== undefined && a[3] !== null ? C(sk(a[3], ctx)) : 1;
  const idx = (smer < 0 ? [...hodnoty.keys()].reverse() : [...hodnoty.keys()]).find((i) => porovnej(hodnoty[i], h) === 0 && typeof hodnoty[i] === typeof h);
  return idx === undefined ? E.NA : idx + 1;
}, { min: 2, max: 4 });
def('INDEX', 'INDEX', 'vyhl', ['pole', 'řádek', '[sloupec]'], 'Vrátí hodnotu nebo odkaz na buňku v průsečíku řádku a sloupce oblasti.', (a, ctx) => {
  const p = a[0];
  let r = Math.floor(C(sk(opt(a[1], 0), ctx))), c = a[2] !== undefined && a[2] !== null ? Math.floor(C(sk(a[2], ctx))) : null;
  const [R, Cc] = rozmer(p);
  if (c === null) { if (R === 1) { c = r; r = 1; } else c = Cc === 1 ? 1 : 0; }
  if (r < 0 || c < 0 || r > R || c > Cc) return E.ODKAZ;
  if (jeRef(p)) {
    if (r === 0 && c === 0) return p;
    if (r === 0) return new Ref(p.list, p.r1, p.c1 + c - 1, p.r2, p.c1 + c - 1);
    if (c === 0) return new Ref(p.list, p.r1 + r - 1, p.c1, p.r1 + r - 1, p.c2);
    return new Ref(p.list, p.r1 + r - 1, p.c1 + c - 1);
  }
  const P = naPole(p, ctx);
  if (r === 0) return P.map((x) => [x[c - 1]]);
  if (c === 0) return [P[r - 1]];
  return P[r - 1][c - 1];
}, { min: 2, max: 3 });
def('ZVOLIT', 'CHOOSE', 'vyhl', ['index', 'hodnota1', '…'], 'Zvolí hodnotu ze seznamu hodnot podle indexu.', (a, ctx) => { const i = Math.floor(C(sk(a[0](), ctx))); return i < 1 || i >= a.length ? E.HODNOTA : a[i](); }, { min: 2, lazy: true });
def('ŘÁDEK', 'ROW', 'vyhl', ['[odkaz]'], 'Vrátí číslo řádku odkazu.', (a, ctx) => (a[0] === undefined || a[0] === null ? ctx.r + 1 : jeRef(a[0]) ? (a[0].jedna ? a[0].r1 + 1 : Array.from({ length: a[0].radku }, (_, i) => [a[0].r1 + i + 1])) : E.HODNOTA), { min: 0, max: 1 });
def('SLOUPEC', 'COLUMN', 'vyhl', ['[odkaz]'], 'Vrátí číslo sloupce odkazu.', (a, ctx) => (a[0] === undefined || a[0] === null ? ctx.c + 1 : jeRef(a[0]) ? (a[0].jedna ? a[0].c1 + 1 : [Array.from({ length: a[0].sloupcu }, (_, i) => a[0].c1 + i + 1)]) : E.HODNOTA), { min: 0, max: 1 });
def('ŘÁDKY', 'ROWS', 'vyhl', ['pole'], 'Vrátí počet řádků v odkazu nebo poli.', (a) => rozmer(a[0])[0], { min: 1, max: 1 });
def('SLOUPCE', 'COLUMNS', 'vyhl', ['pole'], 'Vrátí počet sloupců v odkazu nebo poli.', (a) => rozmer(a[0])[1], { min: 1, max: 1 });
def('NEPŘÍMÝ.ODKAZ', 'INDIRECT', 'vyhl', ['text_odkazu'], 'Vrátí odkaz určený textovým řetězcem.', (a, ctx) => {
  const t = T(sk(a[0], ctx)); const o = rozeberOblast(t);
  if (!o) { const d = ctx.S.nazev(t, ctx.list); return d ? d(ctx) : E.ODKAZ; }
  const l = o.list ? ctx.S.list(o.list) : ctx.list; if (!l) return E.ODKAZ;
  return new Ref(l, o.r1, o.c1, o.r2, o.c2);
}, { min: 1, max: 2, volatilni: true });
def('POSUN', 'OFFSET', 'vyhl', ['odkaz', 'řádky', 'sloupce', '[výška]', '[šířka]'], 'Vrátí odkaz posunutý od zadaného odkazu o daný počet řádků a sloupců.', (a, ctx) => {
  const p = a[0]; if (!jeRef(p)) return E.HODNOTA;
  const dr = Math.floor(C(sk(a[1], ctx))), dc = Math.floor(C(sk(a[2], ctx)));
  const v = a[3] !== undefined && a[3] !== null ? Math.floor(C(sk(a[3], ctx))) : p.radku;
  const s = a[4] !== undefined && a[4] !== null ? Math.floor(C(sk(a[4], ctx))) : p.sloupcu;
  const r1 = p.r1 + dr, c1 = p.c1 + dc;
  if (r1 < 0 || c1 < 0 || v < 1 || s < 1) return E.ODKAZ;
  return new Ref(p.list, r1, c1, r1 + v - 1, c1 + s - 1);
}, { min: 3, max: 5, volatilni: true });
def('ODKAZ', 'ADDRESS', 'vyhl', ['řádek', 'sloupec', '[typ]', '[a1]', '[list]'], 'Vytvoří textový odkaz na buňku.', (a, ctx) => {
  const r = Math.floor(C(sk(a[0], ctx))) - 1, c = Math.floor(C(sk(a[1], ctx))) - 1;
  const typ = a[2] !== undefined && a[2] !== null ? C(sk(a[2], ctx)) : 1;
  const l = a[4] !== undefined && a[4] !== null ? jmenoListuVeVzorci(T(sk(a[4], ctx))) + '!' : '';
  return l + adresa(r, c, typ === 1 || typ === 2, typ === 1 || typ === 3);
}, { min: 2, max: 5 });
def('HYPERTEXTOVÝ.ODKAZ', 'HYPERLINK', 'vyhl', ['umístění', '[text]'], 'Vytvoří odkaz, který otevře dokument nebo web.', (a, ctx) => {
  const u = T(sk(a[0], ctx));
  ctx.odkaz = u;
  return a[1] !== undefined && a[1] !== null ? sk(a[1], ctx) : u;
}, { min: 1, max: 2 });
def('TRANSPOZICE', 'TRANSPOSE', 'vyhl', ['pole'], 'Převede svislou oblast na vodorovnou a naopak.', (a, ctx) => { const P = naPole(a[0], ctx); return P[0].map((_, j) => P.map((r) => r[j])); }, { min: 1, max: 1 });
def('UNIQUE', 'UNIQUE', 'vyhl', ['pole', '[podle_sloupců]', '[právě_jednou]'], 'Vrátí jedinečné hodnoty z oblasti.', (a, ctx) => {
  const P = naPole(a[0], ctx); const jednou = a[2] ? B(sk(a[2], ctx)) : false;
  const klic = (r) => r.map((v) => (typeof v === 'string' ? 's' + v.toLocaleLowerCase('cs') : typeof v + String(v))).join('\u0001');
  const pocty = new Map();
  for (const r of P) pocty.set(klic(r), (pocty.get(klic(r)) || 0) + 1);
  const videno = new Set(); const out = [];
  for (const r of P) { const k = klic(r); if (videno.has(k)) continue; videno.add(k); if (!jednou || pocty.get(k) === 1) out.push(r.map((v) => v ?? 0)); }
  return out.length ? out : E.CALC;
}, { min: 1, max: 3 });
def('SORT', 'SORT', 'vyhl', ['pole', '[index]', '[pořadí]', '[podle_sloupce]'], 'Seřadí obsah oblasti nebo pole.', (a, ctx) => {
  const P = naPole(a[0], ctx).map((r) => r.slice());
  const i = (a[1] !== undefined && a[1] !== null ? C(sk(a[1], ctx)) : 1) - 1;
  const por = a[2] !== undefined && a[2] !== null ? C(sk(a[2], ctx)) : 1;
  return P.sort((x, y) => razeni(x[i], y[i]) * (por < 0 ? -1 : 1));
}, { min: 1, max: 4 });
def('SORTBY', 'SORTBY', 'vyhl', ['pole', 'podle_pole1', '[pořadí1]', '…'], 'Seřadí oblast podle hodnot v jiné oblasti.', (a, ctx) => {
  const P = naPole(a[0], ctx);
  const klice = [];
  for (let i = 1; i < a.length; i += 2) klice.push([plochy(a[i], ctx), a[i + 1] !== undefined && a[i + 1] !== null ? C(sk(a[i + 1], ctx)) : 1]);
  const idx = P.map((_, i) => i).sort((x, y) => { for (const [k, s] of klice) { const c = razeni(k[x], k[y]); if (c) return c * (s < 0 ? -1 : 1); } return 0; });
  return idx.map((i) => P[i]);
}, { min: 2 });
def('FILTER', 'FILTER', 'vyhl', ['pole', 'zahrnout', '[pokud_prázdné]'], 'Vyfiltruje oblast podle zadané podmínky.', (a, ctx) => {
  const P = naPole(a[0], ctx), M = naPole(a[1], ctx);
  let out;
  if (M.length === P.length && (M[0]?.length || 0) === 1) out = P.filter((_, i) => naBool(M[i][0]) === true);
  else if (M.length === 1 && M[0].length === (P[0]?.length || 0)) out = P.map((r) => r.filter((_, j) => naBool(M[0][j]) === true));
  else return E.HODNOTA;
  if (!out.length || !out[0].length) return a[2] !== undefined && a[2] !== null ? a[2] : E.CALC;
  return out;
}, { min: 2, max: 3 });
def('VSTACK', 'VSTACK', 'vyhl', ['pole1', '[pole2]', '…'], 'Spojí pole svisle pod sebe.', (a, ctx) => {
  const P = a.map((x) => naPole(x, ctx)); const w = Math.max(...P.map((p) => p[0]?.length || 0));
  return P.flatMap((p) => p.map((r) => [...r, ...Array(w - r.length).fill(E.NA)]));
}, { min: 1 });
def('HSTACK', 'HSTACK', 'vyhl', ['pole1', '[pole2]', '…'], 'Spojí pole vodorovně vedle sebe.', (a, ctx) => {
  const P = a.map((x) => naPole(x, ctx)); const h = Math.max(...P.map((p) => p.length));
  return Array.from({ length: h }, (_, i) => P.flatMap((p) => p[i] || Array(p[0]?.length || 0).fill(E.NA)));
}, { min: 1 });
def('TAKE', 'TAKE', 'vyhl', ['pole', 'řádky', '[sloupce]'], 'Vrátí zadaný počet řádků/sloupců od začátku nebo konce pole.', (a, ctx) => {
  let P = naPole(a[0], ctx); const r = C(sk(opt(a[1], P.length), ctx)); const c = a[2] !== undefined && a[2] !== null ? C(sk(a[2], ctx)) : null;
  P = r >= 0 ? P.slice(0, r) : P.slice(r);
  if (c !== null) P = P.map((x) => (c >= 0 ? x.slice(0, c) : x.slice(c)));
  return P.length ? P : E.CALC;
}, { min: 2, max: 3 });
def('DROP', 'DROP', 'vyhl', ['pole', 'řádky', '[sloupce]'], 'Vynechá zadaný počet řádků/sloupců ze začátku nebo konce pole.', (a, ctx) => {
  let P = naPole(a[0], ctx); const r = C(sk(opt(a[1], 0), ctx)); const c = a[2] !== undefined && a[2] !== null ? C(sk(a[2], ctx)) : null;
  P = r >= 0 ? P.slice(r) : P.slice(0, r);
  if (c !== null) P = P.map((x) => (c >= 0 ? x.slice(c) : x.slice(0, c)));
  return P.length ? P : E.CALC;
}, { min: 2, max: 3 });
def('CHOOSECOLS', 'CHOOSECOLS', 'vyhl', ['pole', 'sloupec1', '…'], 'Vrátí zadané sloupce z pole.', (a, ctx) => { const P = naPole(a[0], ctx); const s = a.slice(1).map((x) => C(sk(x, ctx))); return P.map((r) => s.map((i) => (i > 0 ? r[i - 1] : r[r.length + i]) ?? E.HODNOTA)); }, { min: 2 });
def('CHOOSEROWS', 'CHOOSEROWS', 'vyhl', ['pole', 'řádek1', '…'], 'Vrátí zadané řádky z pole.', (a, ctx) => { const P = naPole(a[0], ctx); return a.slice(1).map((x) => { const i = C(sk(x, ctx)); return P[i > 0 ? i - 1 : P.length + i] || [E.HODNOTA]; }); }, { min: 2 });
def('VYHLEDAT', 'LOOKUP', 'vyhl', ['hledat', 'vektor', '[výsledek]'], 'Vyhledá hodnotu v jednom řádku/sloupci a vrátí hodnotu na stejné pozici.', (a, ctx) => {
  const h = sk(a[0], ctx); const v = plochy(a[1], ctx); const vys = a[2] ? plochy(a[2], ctx) : v;
  const i = najdiPriblizne(v, h);
  return i < 0 ? E.NA : vys[i] ?? E.NA;
}, { min: 2, max: 3 });
def('FORMULATEXT', 'FORMULATEXT', 'vyhl', ['odkaz'], 'Vrátí vzorec jako text.', (a, ctx) => { const x = a[0]; if (!jeRef(x)) return E.HODNOTA; const b = ctx.S.bunka(x.list, x.r1, x.c1); return b?.f || E.NA; }, { min: 1, max: 1 });

// ---------- informační
const info = (n, en, p, fn) => def(n, en, 'info', ['hodnota'], p, (a, ctx) => fn(jeRef(a[0]) ? ctx.S.hodnota(a[0].list, a[0].r1, a[0].c1) : sk(a[0], ctx), a[0], ctx), { min: 1, max: 1 });
info('JE.PRÁZDNÉ', 'ISBLANK', 'Ověří, zda odkaz vede na prázdnou buňku.', (v) => v === null || v === undefined);
info('JE.ČISLO', 'ISNUMBER', 'Ověří, zda je hodnota číslo.', (v) => typeof v === 'number');
info('JE.TEXT', 'ISTEXT', 'Ověří, zda je hodnota text.', (v) => typeof v === 'string');
info('JE.NETEXT', 'ISNONTEXT', 'Ověří, zda hodnota není text.', (v) => typeof v !== 'string');
info('JE.CHYBA', 'ISERROR', 'Ověří, zda je hodnota chyba.', (v) => jeChyba(v));
info('JE.CHYBHODN', 'ISERR', 'Ověří, zda je hodnota jiná chyba než #NENÍ_K_DISPOZICI.', (v) => jeChyba(v) && v.kod !== CHYBY.NA);
info('JE.NEDEF', 'ISNA', 'Ověří, zda je hodnota #NENÍ_K_DISPOZICI.', (v) => jeChyba(v) && v.kod === CHYBY.NA);
info('JE.LOGHODN', 'ISLOGICAL', 'Ověří, zda je hodnota logická.', (v) => typeof v === 'boolean');
info('JE.SUDÉ', 'ISEVEN', 'Vrátí PRAVDA pro sudé číslo.', (v) => Math.floor(C(v)) % 2 === 0);
info('JE.LICHÉ', 'ISODD', 'Vrátí PRAVDA pro liché číslo.', (v) => Math.abs(Math.floor(C(v)) % 2) === 1);
info('JE.VZOREC', 'ISFORMULA', 'Ověří, zda buňka obsahuje vzorec.', (v, x, ctx) => jeRef(x) && !!ctx.S.bunka(x.list, x.r1, x.c1)?.f);
info('JE.ODKAZ', 'ISREF', 'Ověří, zda je hodnota odkaz.', (v, x) => jeRef(x));
info('N', 'N', 'Převede hodnotu na číslo.', (v) => (typeof v === 'number' ? v : v === true ? 1 : 0));
info('TYP', 'TYPE', 'Vrátí číslo typu hodnoty (1 číslo, 2 text, 4 logická, 16 chyba, 64 pole).', (v) => (typeof v === 'number' || v === null ? 1 : typeof v === 'string' ? 2 : typeof v === 'boolean' ? 4 : jeChyba(v) ? 16 : 64));
info('CHYBA.TYP', 'ERROR.TYPE', 'Vrátí číslo odpovídající typu chyby.', (v) => (jeChyba(v) ? [CHYBY.NULL, CHYBY.DIV0, CHYBY.HODNOTA, CHYBY.ODKAZ, CHYBY.NAZEV, CHYBY.CISLO, CHYBY.NA].indexOf(v.kod) + 1 || 8 : E.NA));
def('NEDOSTUPNÝ', 'NA', 'info', [], 'Vrátí chybovou hodnotu #NENÍ_K_DISPOZICI.', () => E.NA, { min: 0, max: 0 });
def('LIST', 'SHEET', 'info', ['[hodnota]'], 'Vrátí číslo listu.', (a, ctx) => ctx.S.cisloListu(jeRef(a[0]) ? a[0].list : ctx.list), { min: 0, max: 1 });
def('LISTY', 'SHEETS', 'info', [], 'Vrátí počet listů v sešitu.', (a, ctx) => ctx.S.pocetListu(), { min: 0, max: 1 });

// ---------- finanční
def('PLATBA', 'PMT', 'fin', ['sazba', 'pper', 'souč_hod', '[bud_hod]', '[typ]'], 'Vypočte splátku půjčky při konstantních splátkách a úrokové sazbě.', ([r, n, p, f, t]) => pmt(C(r), C(n), C(p), C(opt(f, 0)), C(opt(t, 0))), { skal: true, min: 3, max: 5, format: '#,##0.00 "Kč";[Red]-#,##0.00 "Kč"' });
def('BUDHODNOTA', 'FV', 'fin', ['sazba', 'pper', 'splátka', '[souč_hod]', '[typ]'], 'Vrátí budoucí hodnotu investice.', ([r, n, p, v, t]) => fv(C(r), C(n), C(p), C(opt(v, 0)), C(opt(t, 0))), { skal: true, min: 3, max: 5, format: '#,##0.00 "Kč";[Red]-#,##0.00 "Kč"' });
def('SOUČHODNOTA', 'PV', 'fin', ['sazba', 'pper', 'splátka', '[bud_hod]', '[typ]'], 'Vrátí současnou hodnotu investice.', ([r, n, p, f, t]) => pv(C(r), C(n), C(p), C(opt(f, 0)), C(opt(t, 0))), { skal: true, min: 3, max: 5, format: '#,##0.00 "Kč";[Red]-#,##0.00 "Kč"' });
def('POČET.OBDOBÍ', 'NPER', 'fin', ['sazba', 'splátka', 'souč_hod', '[bud_hod]', '[typ]'], 'Vrátí počet období pro investici.', ([r, p, v, f, t]) => {
  const rr = C(r), pp = C(p), vv = C(v), ff = C(opt(f, 0)), tt = C(opt(t, 0));
  if (rr === 0) return -(vv + ff) / pp;
  const x = (pp * (1 + rr * tt) - ff * rr) / (pp * (1 + rr * tt) + vv * rr);
  return x <= 0 ? E.CISLO : Math.log(x) / Math.log(1 + rr);
}, { skal: true, min: 3, max: 5 });
def('ÚROKOVÁ.MÍRA', 'RATE', 'fin', ['pper', 'splátka', 'souč_hod', '[bud_hod]', '[typ]', '[odhad]'], 'Vrátí úrokovou sazbu za období.', ([n, p, v, f, t, g]) => {
  const nn = C(n), pp = C(p), vv = C(v), ff = C(opt(f, 0)), tt = C(opt(t, 0));
  return newton((r) => (Math.abs(r) < 1e-12 ? vv + pp * nn + ff : vv * (1 + r) ** nn + pp * (1 + r * tt) * ((1 + r) ** nn - 1) / r + ff), C(opt(g, 0.1)));
}, { skal: true, min: 3, max: 6, format: '0.00%' });
def('PLATBA.ÚROK', 'IPMT', 'fin', ['sazba', 'za', 'pper', 'souč_hod', '[bud_hod]', '[typ]'], 'Vrátí výši úroku v daném období.', ([r, o, n, v, f, t]) => ipmt(C(r), C(o), C(n), C(v), C(opt(f, 0)), C(opt(t, 0))), { skal: true, min: 4, max: 6 });
def('PLATBA.ZÁKLAD', 'PPMT', 'fin', ['sazba', 'za', 'pper', 'souč_hod', '[bud_hod]', '[typ]'], 'Vrátí splátku jistiny v daném období.', ([r, o, n, v, f, t]) => pmt(C(r), C(n), C(v), C(opt(f, 0)), C(opt(t, 0))) - ipmt(C(r), C(o), C(n), C(v), C(opt(f, 0)), C(opt(t, 0))), { skal: true, min: 4, max: 6 });
def('ČISTÁSOUČHODNOTA', 'NPV', 'fin', ['sazba', 'hodnota1', '…'], 'Vrátí čistou současnou hodnotu investice.', (a, ctx) => { const r = C(sk(a[0], ctx)); return cisla(a.slice(1), ctx).reduce((s, v, i) => s + v / (1 + r) ** (i + 1), 0); }, { min: 2 });
def('MÍRA.VÝNOSNOSTI', 'IRR', 'fin', ['hodnoty', '[odhad]'], 'Vrátí vnitřní výnosové procento řady peněžních toků.', (a, ctx) => {
  const v = cisla([a[0]], ctx);
  return newton((r) => v.reduce((s, x, i) => s + x / (1 + r) ** i, 0), a[1] !== undefined && a[1] !== null ? C(sk(a[1], ctx)) : 0.1);
}, { min: 1, max: 2, format: '0.00%' });
def('ODPIS.LIN', 'SLN', 'fin', ['náklady', 'zůstatek', 'životnost'], 'Vrátí lineární odpis aktiva za jedno období.', ([c, s, l]) => { const z = C(l); return z === 0 ? E.DIV0 : (C(c) - C(s)) / z; }, { skal: true, min: 3, max: 3 });
def('EFFECT', 'EFFECT', 'fin', ['nominální_sazba', 'období'], 'Vrátí efektivní roční úrokovou sazbu.', ([r, n]) => { const p = Math.floor(C(n)); return p < 1 ? E.CISLO : (1 + C(r) / p) ** p - 1; }, { skal: true, min: 2, max: 2, format: '0.00%' });

export const FUNKCE = F;
export const ANGLICKY = Object.fromEntries(Object.values(F).flatMap((f) => [[f.en, f.n], [f.en.replace(/\..*$/, ''), f.n]]));
// starší názvy, které Excel pořád zná
Object.assign(ANGLICKY, {
  MODE: 'MODE.SNGL', RANK: 'RANK.EQ', STDEV: 'SMODCH.VÝBĚR.S', STDEVP: 'SMODCH.P', VAR: 'VAR.S', VARP: 'VAR.P',
  PERCENTILE: 'PERCENTIL.INC', QUARTILE: 'QUARTIL.INC', FORECAST: 'FORECAST.LINEAR',
  'SMODCH.VÝBĚR': 'SMODCH.VÝBĚR.S', PERCENTIL: 'PERCENTIL.INC', QUARTIL: 'QUARTIL.INC', TAN: 'TG',
});

export const KATEGORIE_FUNKCI = [
  ['nedavne', 'Naposledy použité'], ['vse', 'Vše'], ['fin', 'Finanční'], ['dat', 'Datum a čas'], ['mat', 'Matematické a trigonometrické'],
  ['stat', 'Statistické'], ['vyhl', 'Vyhledávací'], ['text', 'Textové'], ['log', 'Logické'], ['info', 'Informační'],
];

// názvy argumentů jsou jen nápověda, takže v angličtině anglicky (funkce sama zůstává česká)
export const syntaxe = (f) => `${f.n}(${f.a.map(tt).join('; ')})`;

/** Funkce, jejíž argument je pod kurzorem při psaní vzorce: { f, arg } */
export function funkcePodKurzorem(text, kurzor) {
  if (text[0] !== '=') return null;
  const src = text.slice(1, kurzor);
  let t;
  try { t = lex(src); } catch { return null; }
  const zasobnik = [];
  for (let i = 0; i < t.length; i++) {
    const x = t[i];
    if (x.typ === 'fn' && t[i + 1]?.typ === '(') { zasobnik.push({ n: x.v.toUpperCase(), arg: 0 }); i++; continue; }
    if (x.typ === '(') zasobnik.push(null);
    if (x.typ === ')') zasobnik.pop();
    if (x.typ === 'sep' && zasobnik.length && zasobnik[zasobnik.length - 1]) zasobnik[zasobnik.length - 1].arg++;
  }
  for (let i = zasobnik.length - 1; i >= 0; i--) {
    const z = zasobnik[i];
    if (z) {
      const f = FUNKCE[z.n] || FUNKCE[ANGLICKY[z.n]];
      return f ? { f, arg: z.arg } : null;
    }
  }
  return null;
}

/** Rozepsané jméno funkce na konci textu (pro našeptávač). */
export function rozepsaneJmeno(text, kurzor) {
  if (text[0] !== '=') return null;
  const m = /[\p{L}_][\p{L}\d_.]*$/u.exec(text.slice(0, kurzor));
  if (!m) return null;
  const pred = text.slice(0, m.index);
  if (/[$\d]$/.test(pred) || /"[^"]*$/.test(pred.replace(/"[^"]*"/g, ''))) return null;
  return { jmeno: m[0], od: m.index };
}

/** Oblasti, na které vzorec odkazuje (pro šipky předchůdců). */
export function predchudci(text) {
  return odkazyVeVzorci(text).map((x) => ({ list: x.list, ...x.oblast }));
}

export { naText, naCislo, naBool, porovnej, kriterium, sk as skalar, oddelList };
