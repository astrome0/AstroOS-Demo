// AstroTabulky — čísla, data a formáty buněk jako v Excelu (české prostředí)
//
// Formátové kódy se ukládají v „invariantní“ podobě Excelu (desetinná tečka, čárka = tisíce),
// uživateli se ukazují česky (0,00 · # ##0). Datum = pořadové číslo od 1. 1. 1900 včetně
// chyby Excelu, podle které existuje 29. 2. 1900 (číslo 60).

export const MESICE = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];
export const MESICE_2 = ['ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];
export const MESICE_ZKR = ['led', 'úno', 'bře', 'dub', 'kvě', 'čvn', 'čvc', 'srp', 'zář', 'říj', 'lis', 'pro'];
export const DNY = ['neděle', 'pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota'];
export const DNY_ZKR = ['ne', 'po', 'út', 'st', 'čt', 'pá', 'so'];

const DEN = 864e5;
const NULA = Date.UTC(1899, 11, 30);

// ---------------------------------------------------------------- chyby
export class Chyba {
  constructor(kod) { this.kod = kod; }
  toString() { return this.kod; }
}
export const CHYBY = {
  DIV0: '#DĚLENÍ_NULOU!', NAZEV: '#NÁZEV?', HODNOTA: '#HODNOTA!', ODKAZ: '#ODKAZ!',
  NA: '#NENÍ_K_DISPOZICI', CISLO: '#ČÍSLO!', NULL: '#NULL!', PRESAH: '#PŘESAH!', CALC: '#POČÍTÁNÍ!',
};
export const E = Object.fromEntries(Object.entries(CHYBY).map(([k, v]) => [k, new Chyba(v)]));
export const jeChyba = (v) => v instanceof Chyba;

// ---------------------------------------------------------------- datum
export function serial(y, m, d, h = 0, mi = 0, s = 0) {
  const dny = (Date.UTC(y, m - 1, d) - NULA) / DEN;
  const cele = y === 1900 && m === 2 && d === 29 ? 60 : dny < 61 ? dny - 1 : dny;
  return cele + (h * 3600 + mi * 60 + s) / 86400;
}

export function zeSerialu(v) {
  let cele = Math.floor(v);
  let zbytek = Math.round((v - cele) * 86400000);
  if (zbytek >= 86400000) { cele += 1; zbytek -= 86400000; }
  let y, m, d, dow;
  if (cele === 60) { y = 1900; m = 2; d = 29; dow = 3; }
  else {
    const t = NULA + (cele < 61 ? cele + 1 : cele) * DEN;
    const dt = new Date(t);
    y = dt.getUTCFullYear(); m = dt.getUTCMonth() + 1; d = dt.getUTCDate(); dow = dt.getUTCDay();
    if (cele === 0) { y = 1900; m = 1; d = 0; }
  }
  const ms = zbytek % 1000;
  const sek = Math.floor(zbytek / 1000);
  return { y, m, d, dow, h: Math.floor(sek / 3600), mi: Math.floor((sek % 3600) / 60), s: sek % 60, ms };
}

export const dnes = () => { const t = new Date(); return serial(t.getFullYear(), t.getMonth() + 1, t.getDate()); };
export const ted = () => { const t = new Date(); return serial(t.getFullYear(), t.getMonth() + 1, t.getDate(), t.getHours(), t.getMinutes(), t.getSeconds()); };

// ---------------------------------------------------------------- čísla česky
const NBSP = ' ';

/** Číslo jako v obecném formátu Excelu (nejvýš 11 znaků, jinak vědecký zápis). */
export function obecne(n, maxZnaku = 11) {
  if (!isFinite(n)) return CHYBY.CISLO;
  if (n === 0) return '0';
  const a = Math.abs(n);
  let t;
  if (a >= 1e11 || a < 1e-9) t = vedecky(n, 5);
  else {
    const cele = Math.floor(a).toString().length;
    const des = Math.max(0, maxZnaku - cele - 1 - (n < 0 ? 1 : 0));
    t = String(+n.toFixed(Math.min(des, 15)));
    if (/e/.test(t)) t = vedecky(n, 5);
  }
  return t.replace('.', ',');
}

function vedecky(n, des) {
  let [m, e] = n.toExponential(des).split('e');
  m = String(+m);
  const ex = +e;
  return `${m.replace('.', ',')}E${ex < 0 ? '-' : '+'}${String(Math.abs(ex)).padStart(2, '0')}`;
}

// ---------------------------------------------------------------- formátové kódy
const BARVY = {
  black: '#000000', cerna: '#000000', černá: '#000000', blue: '#0000FF', modra: '#0000FF', modrá: '#0000FF',
  cyan: '#00FFFF', green: '#008000', zelena: '#008000', zelená: '#008000', magenta: '#FF00FF',
  red: '#FF0000', cervena: '#FF0000', červená: '#FF0000', white: '#FFFFFF', bila: '#FFFFFF', bílá: '#FFFFFF',
  yellow: '#FFFF00', zluta: '#FFFF00', žlutá: '#FFFF00',
};

const cache = new Map();

function rozdelSekce(kod) {
  const sekce = [];
  let akt = '', uvoz = false;
  for (let i = 0; i < kod.length; i++) {
    const ch = kod[i];
    if (ch === '"') uvoz = !uvoz;
    if (ch === '\\' && !uvoz) { akt += ch + (kod[i + 1] || ''); i++; continue; }
    if (ch === ';' && !uvoz) { sekce.push(akt); akt = ''; continue; }
    akt += ch;
  }
  sekce.push(akt);
  return sekce;
}

/** Rozloží jednu sekci formátu na tokeny. */
function zpracujSekci(s) {
  const o = { barva: null, podminka: null, tokeny: [], datum: false, procenta: 0, text: false, cislo: false, uplynule: false };
  let i = 0;
  const lit = (t) => o.tokeny.push({ t: 'lit', v: t });
  while (i < s.length) {
    const ch = s[i];
    const zbytek = s.slice(i);
    if (ch === '[') {
      const konec = s.indexOf(']', i);
      const obsah = s.slice(i + 1, konec < 0 ? s.length : konec);
      const low = obsah.toLowerCase();
      if (BARVY[low]) o.barva = BARVY[low];
      else if (/^color\d+$/i.test(obsah)) o.barva = null;
      else if (/^[<>=]/.test(obsah)) {
        const m = /^(<=|>=|<>|<|>|=)(-?[\d.]+)$/.exec(obsah);
        if (m) o.podminka = { op: m[1], v: +m[2] };
      } else if (/^(h+|m+|s+)$/i.test(obsah)) { o.tokeny.push({ t: 'uplynule', v: low }); o.datum = true; o.uplynule = true; }
      else if (/^\$/.test(obsah)) lit(obsah.slice(1).split('-')[0]);
      i = konec < 0 ? s.length : konec + 1;
      continue;
    }
    if (ch === '"') {
      const konec = s.indexOf('"', i + 1);
      lit(s.slice(i + 1, konec < 0 ? s.length : konec));
      i = konec < 0 ? s.length : konec + 1;
      continue;
    }
    if (ch === '\\') { lit(s[i + 1] || ''); i += 2; continue; }
    if (ch === '_') { lit(' '); i += 2; continue; }
    if (ch === '*') { i += 2; continue; }
    if (ch === '@') { o.tokeny.push({ t: 'text' }); o.text = true; i++; continue; }
    const dm = /^(yyyy|yy|rrrr|rr|e|dddd|ddd|dd|d|mmmmm|mmmm|mmm|mm|m|hh|h|ss|s|am\/pm|a\/p)/i.exec(zbytek);
    if (dm && !/^e[+-]/i.test(zbytek)) {
      o.tokeny.push({ t: 'dat', v: dm[1].toLowerCase() });
      o.datum = true;
      i += dm[1].length;
      if (/^\.0+/.test(s.slice(i)) && /s/.test(dm[1])) {
        const zl = /^\.(0+)/.exec(s.slice(i))[1];
        o.tokeny.push({ t: 'zlomekS', v: zl.length });
        i += zl.length + 1;
      }
      continue;
    }
    if (/[0#?.,]/.test(ch) || (/[eE]/.test(ch) && /^[eE][+-]/.test(zbytek))) {
      // číselná část — posbírat souvislý úsek
      let j = i, cast = '';
      while (j < s.length && (/[0#?.,/ ]/.test(s[j]) || /^[eE][+-]/.test(s.slice(j)))) {
        if (/[eE]/.test(s[j])) { cast += s.slice(j, j + 2); j += 2; continue; }
        if (s[j] === ' ' && !/[0#?]/.test(s[j + 1] || '')) break;
        cast += s[j]; j++;
      }
      o.tokeny.push({ t: 'cis', v: cast });
      o.cislo = true;
      i = j;
      continue;
    }
    if (ch === '%') { o.procenta++; lit('%'); i++; continue; }
    lit(ch);
    i++;
  }
  // „m“ za hodinami nebo před sekundami = minuty
  const dt = o.tokeny.filter((t) => t.t === 'dat' || t.t === 'uplynule');
  dt.forEach((t, k) => {
    if (t.t !== 'dat' || !/^m{1,2}$/.test(t.v)) return;
    const pred = dt[k - 1], po = dt[k + 1];
    if ((pred && /^h|^\[?h/.test(pred.v)) || (po && /^s/.test(po.v))) t.v = t.v === 'm' ? 'min' : 'mmin';
  });
  if (o.tokeny.some((t) => t.t === 'dat' && /^a/.test(t.v))) o.ampm = true;
  return o;
}

function priprav(kod) {
  if (cache.has(kod)) return cache.get(kod);
  const sekce = rozdelSekce(kod).map(zpracujSekci);
  cache.set(kod, sekce);
  return sekce;
}

function formatCislo(n, maska) {
  // maska: např. "#,##0.00", "0%", "0.00E+00", "# ?/?"
  const exp = /[eE][+-]/.exec(maska);
  if (exp) {
    const [mant, ex] = [maska.slice(0, exp.index), maska.slice(exp.index + 2)];
    const des = (mant.split('.')[1] || '').replace(/[^0#?]/g, '').length;
    if (n === 0) return formatCislo(0, mant) + 'E+' + '0'.repeat(ex.length);
    let e = Math.floor(Math.log10(Math.abs(n)));
    let m = n / 10 ** e;
    if (+Math.abs(m).toFixed(des) >= 10) { m /= 10; e++; }
    return formatCislo(m, mant) + 'E' + (e < 0 ? '-' : '+') + String(Math.abs(e)).padStart(ex.length, '0');
  }
  if (maska.includes('/')) {
    const m = /^(?:([#0?,]+)\s+)?([#0?]+)\/([#0?\d]+)$/.exec(maska.trim());
    if (m) {
      const cele = m[1] ? Math.trunc(n) : 0;
      const zb = Math.abs(n - cele);
      let nejl = [0, 1], chyba = Infinity;
      const pevny = /^\d+$/.test(m[3]) ? +m[3] : 0;
      const maxJm = pevny || 10 ** m[3].length - 1;
      for (let jm = pevny || 1; jm <= maxJm; jm++) {
        const ci = Math.round(zb * jm);
        const ch = Math.abs(zb - ci / jm);
        if (ch < chyba - 1e-12) { chyba = ch; nejl = [ci, jm]; }
        if (pevny) break;
      }
      if (nejl[0] === 0 && m[1]) return String(cele);
      if (nejl[0] === nejl[1] && !pevny) return String(cele + Math.sign(n || 1));
      const zn = n < 0 && !cele ? '-' : '';
      return `${m[1] ? (cele ? cele + ' ' : '') : ''}${zn}${nejl[0]}/${nejl[1]}`;
    }
  }
  const tecka = maska.indexOf('.');
  let celaMaska = tecka >= 0 ? maska.slice(0, tecka) : maska;
  const desMaska = tecka >= 0 ? maska.slice(tecka + 1).replace(/,/g, '') : '';
  const tisice = celaMaska.includes(',');
  // čárky na konci = dělení tisícem
  let del = 0;
  while (celaMaska.endsWith(',')) { del++; celaMaska = celaMaska.slice(0, -1); }
  if (del) n /= 1000 ** del;
  const celaCist = celaMaska.replace(/,/g, '');
  const desMax = desMaska.length;
  const desMin = (desMaska.match(/0/g) || []).length;
  let t = Math.abs(n).toFixed(desMax);
  let [c, d = ''] = t.split('.');
  // desetinná část: vynechat koncové nuly za povinným minimem
  let dd = d;
  while (dd.length > desMin && dd.endsWith('0')) dd = dd.slice(0, -1);
  if (desMaska.includes('?')) dd = dd.padEnd(desMax, ' ');
  const minCelych = (celaCist.match(/0/g) || []).length;
  if (c === '0' && minCelych === 0) c = '';
  c = c.padStart(minCelych, '0');
  if (tisice) c = c.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  // Excel ukáže desetinnou čárku vždy, když ji maska má (0.## a 5 → „5,“)
  return c + (tecka >= 0 ? ',' + dd : '');
}

function formatDatum(v, sekce) {
  const d = zeSerialu(v);
  let h = d.h;
  if (sekce.ampm) h = h % 12 || 12;
  return sekce.tokeny.map((t) => {
    if (t.t === 'lit') return t.v;
    if (t.t === 'uplynule') {
      const celk = v * 86400;
      if (t.v[0] === 'h') return String(Math.floor(celk / 3600)).padStart(t.v.length, '0');
      if (t.v[0] === 'm') return String(Math.floor(celk / 60)).padStart(t.v.length, '0');
      return String(Math.floor(celk)).padStart(t.v.length, '0');
    }
    if (t.t === 'zlomekS') return ',' + String(d.ms).padStart(3, '0').slice(0, t.v);
    if (t.t === 'cis') return t.v;
    if (t.t === 'text') return '';
    switch (t.v) {
      case 'yyyy': case 'rrrr': case 'e': return String(d.y);
      case 'yy': case 'rr': return String(d.y % 100).padStart(2, '0');
      case 'd': return String(d.d);
      case 'dd': return String(d.d).padStart(2, '0');
      case 'ddd': return DNY_ZKR[d.dow];
      case 'dddd': return DNY[d.dow];
      case 'm': return String(d.m);
      case 'mm': return String(d.m).padStart(2, '0');
      case 'mmm': return MESICE_ZKR[d.m - 1];
      case 'mmmm': return MESICE[d.m - 1];
      case 'mmmmm': return MESICE[d.m - 1][0];
      case 'min': return String(d.mi);
      case 'mmin': return String(d.mi).padStart(2, '0');
      case 'h': return String(h);
      case 'hh': return String(h).padStart(2, '0');
      case 's': return String(d.s);
      case 'ss': return String(d.s).padStart(2, '0');
      case 'am/pm': return d.h < 12 ? 'dop.' : 'odp.';
      case 'a/p': return d.h < 12 ? 'A' : 'P';
      default: return t.v;
    }
  }).join('');
}

/**
 * Hodnota + formátový kód → { text, barva }. Text se hodnotí jen sekcí @ (čtvrtou), jinak zůstává.
 */
export function formatuj(v, kod = 'General') {
  if (v === null || v === undefined || v === '') return { text: '' };
  if (jeChyba(v)) return { text: v.kod };
  if (typeof v === 'boolean') return { text: v ? 'PRAVDA' : 'NEPRAVDA' };
  const k = !kod || /^(general|obecný)$/i.test(kod) ? null : kod;
  if (typeof v === 'string') {
    if (!k) return { text: v };
    const sekce = priprav(k);
    const s = sekce.find((x) => x.text) || (sekce.length >= 4 ? sekce[3] : null);
    if (!s) return { text: v };
    return { text: s.tokeny.map((t) => (t.t === 'text' ? v : t.t === 'lit' ? t.v : '')).join(''), barva: s.barva };
  }
  if (typeof v !== 'number') return { text: String(v) };
  if (!k) return { text: obecne(v) };
  const sekce = priprav(k);
  // výběr sekce
  let s = sekce[0], hodnota = v, zapor = false;
  const podm = sekce.some((x) => x.podminka);
  if (podm) {
    const splni = (x) => {
      const p = x.podminka;
      if (!p) return true;
      return { '<': v < p.v, '>': v > p.v, '=': v === p.v, '<=': v <= p.v, '>=': v >= p.v, '<>': v !== p.v }[p.op];
    };
    s = sekce.find((x) => !x.text && splni(x)) || sekce[sekce.length - 1];
    if (v < 0 && s.podminka && s.podminka.v <= 0) { hodnota = Math.abs(v); }
  } else if (v < 0 && sekce.length >= 2 && !sekce[1].text) { s = sekce[1]; hodnota = -v; zapor = true; }
  else if (v === 0 && sekce.length >= 3 && !sekce[2].text) s = sekce[2];
  if (s.text && !s.cislo) return { text: s.tokeny.map((t) => (t.t === 'text' ? obecne(v) : t.t === 'lit' ? t.v : '')).join(''), barva: s.barva };
  if (s.datum) {
    if (hodnota < 0 || hodnota > 2958465.99999) return { text: '#'.repeat(10), prekroceni: true };
    return { text: formatDatum(hodnota, s), barva: s.barva };
  }
  hodnota *= 100 ** s.procenta;
  const cisla = s.tokeny.filter((t) => t.t === 'cis');
  if (!cisla.length) return { text: s.tokeny.map((t) => (t.t === 'lit' ? t.v : '')).join(''), barva: s.barva };
  const maska = cisla.map((t) => t.v).join('');
  let text = formatCislo(hodnota, maska);
  const zaporne = hodnota < 0 && !zapor && !/^-?0?[,.]?0*$/.test(text.replace(/[\s ]/g, '').replace(/E.*/, ''));
  let vystup = '', vlozeno = false;
  for (const t of s.tokeny) {
    if (t.t === 'lit') vystup += t.v;
    else if (t.t === 'cis' && !vlozeno) { vystup += (zaporne ? '-' : '') + text; vlozeno = true; }
    else if (t.t === 'text') vystup += '';
  }
  return { text: vystup, barva: s.barva };
}

export const jeDatovyFormat = (kod) => !!kod && priprav(kod).some((s) => s.datum);
export const jeProcentniFormat = (kod) => !!kod && priprav(kod)[0].procenta > 0;

/** Kód pro uživatele: invariantní → český (0.00 → 0,00; #,##0 → # ##0). */
export function kodCesky(kod) {
  if (!kod || /^general$/i.test(kod)) return 'Obecný';
  let out = '', uvoz = false;
  for (const ch of kod) {
    if (ch === '"') uvoz = !uvoz;
    if (!uvoz && ch === '.') out += ',';
    else if (!uvoz && ch === ',') out += ' ';
    else if (!uvoz && ch === 'y') out += 'r';
    else out += ch;
  }
  return out;
}

/** Český kód od uživatele → invariantní. */
export function kodZCeskeho(kod) {
  if (!kod || /^obecný$/i.test(kod.trim())) return 'General';
  let out = '', uvoz = false, zavorka = false;
  for (let i = 0; i < kod.length; i++) {
    const ch = kod[i];
    if (ch === '"') uvoz = !uvoz;
    if (ch === '[') zavorka = true;
    if (ch === ']') zavorka = false;
    if (!uvoz && !zavorka && ch === ',') out += '.';
    else if (!uvoz && !zavorka && ch === ' ' && /[#0?]/.test(kod[i - 1] || '') && /[#0?]/.test(kod[i + 1] || '')) out += ',';
    else if (!uvoz && !zavorka && ch === 'r') out += 'y';
    else out += ch;
  }
  return out;
}

// ---------------------------------------------------------------- rozpoznání vstupu
const RE_CISLO = /^([+-]?)(\d{1,3}(?:[  ]\d{3})+|\d*)(?:,(\d+))?(?:[eE]([+-]?\d+))?$/;

/** Text z klávesnice → { v, format? } nebo { vzorec } (Excel pozná čísla, data, procenta, měnu, logické hodnoty). */
export function rozpoznej(vstup) {
  const t = String(vstup);
  if (t === '') return { v: null };
  if (t[0] === "'") return { v: t.slice(1), text: true };
  if (t[0] === '=' && t.length > 1) return { vzorec: t };
  const s = t.trim();
  if (/^(pravda|true)$/i.test(s)) return { v: true };
  if (/^(nepravda|false)$/i.test(s)) return { v: false };
  // měna
  let m = /^(-?)\s*(.+?)\s*(Kč|€|\$|CZK|EUR)$/.exec(s) || /^(-?)\s*(\$|€)\s*(.+)$/.exec(s);
  if (m) {
    const cis = m[3] && /^(\$|€)$/.test(m[2]) ? m[3] : m[2];
    const znak = /^(\$|€)$/.test(m[2]) ? m[2] : m[3];
    const n = cislo(cis);
    if (n !== null) {
      const zn = { 'Kč': '"Kč"', CZK: '"Kč"', '€': '"€"', EUR: '"€"', $: '"$"' }[znak];
      const des = cis.includes(',') ? '.00' : '';
      return { v: (m[1] ? -1 : 1) * n, format: `#,##0${des} ${zn};-#,##0${des} ${zn}` };
    }
  }
  // procenta
  m = /^(.+?)\s*%$/.exec(s);
  if (m) {
    const n = cislo(m[1]);
    if (n !== null) return { v: n / 100, format: m[1].includes(',') ? '0.00%' : '0%' };
  }
  const n = cislo(s);
  if (n !== null) {
    const f = /\d[  ]\d{3}/.test(s) ? (s.includes(',') ? '#,##0.00' : '#,##0') : /e/i.test(s) ? '0.00E+00' : null;
    return f ? { v: n, format: f } : { v: n };
  }
  // zlomek 1/2 → Excel by udělal datum; „0 1/2“ = zlomek
  m = /^(-?\d+)\s+(\d+)\/(\d+)$/.exec(s);
  if (m && +m[3]) return { v: +m[1] + Math.sign(+m[1] || 1) * (+m[2] / +m[3]), format: '# ?/?' };
  const dt = datumZTextu(s);
  if (dt) return dt;
  return { v: t };
}

function cislo(s) {
  const m = RE_CISLO.exec(s.trim());
  if (!m || (m[2] === '' && m[3] === undefined)) return null;
  const n = +(`${m[1]}${m[2].replace(/[  ]/g, '') || '0'}.${m[3] || '0'}e${m[4] || 0}`);
  return isFinite(n) ? n : null;
}

const MESICE_VSE = [...MESICE, ...MESICE_2, ...MESICE_ZKR];
function mesicZeSlova(w) {
  const i = MESICE_VSE.findIndex((x) => x === w.toLocaleLowerCase('cs'));
  return i < 0 ? 0 : (i % 12) + 1;
}

/** „1.5.2026“, „1. 5.“, „2026-05-01“, „1. května 2026“, „12:30“, „1.5.2026 8:00“ */
export function datumZTextu(s) {
  let m, datum = null, cas = null, format = null;
  const casM = /(?:^|\s)(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(dop\.|odp\.|am|pm))?$/i.exec(s);
  let zbytek = s;
  if (casM) {
    let h = +casM[1];
    const ap = casM[4]?.toLowerCase();
    if (ap && /^(odp\.|pm)$/.test(ap) && h < 12) h += 12;
    if (ap && /^(dop\.|am)$/.test(ap) && h === 12) h = 0;
    if (h > 23 && !zbytek.slice(0, casM.index).trim()) { /* 25:30 = doba */ }
    if (+casM[2] > 59 || +(casM[3] || 0) > 59) return null;
    cas = (h * 3600 + +casM[2] * 60 + +(casM[3] || 0)) / 86400;
    format = casM[3] ? 'h:mm:ss' : 'h:mm';
    zbytek = s.slice(0, casM.index).trim();
  }
  if (zbytek) {
    const rok = new Date().getFullYear();
    if ((m = /^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{2,4})$/.exec(zbytek))) datum = [+m[3] < 100 ? (+m[3] < 30 ? 2000 : 1900) + +m[3] : +m[3], +m[2], +m[1]];
    else if ((m = /^(\d{1,2})\.\s*(\d{1,2})\.?$/.exec(zbytek))) datum = [rok, +m[2], +m[1]];
    else if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(zbytek))) datum = [+m[1], +m[2], +m[3]];
    else if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(zbytek))) datum = [+m[3], +m[1], +m[2]];
    else if ((m = /^(\d{1,2})\.?\s+(\p{L}+)\s*(\d{4})?$/u.exec(zbytek)) && mesicZeSlova(m[2])) datum = [m[3] ? +m[3] : rok, mesicZeSlova(m[2]), +m[1]];
    else if ((m = /^(\p{L}+)\s+(\d{4})$/u.exec(zbytek)) && mesicZeSlova(m[1])) datum = [+m[2], mesicZeSlova(m[1]), 1];
    else return null;
    const [y, mo, d] = datum;
    if (mo < 1 || mo > 12 || d < 1 || d > new Date(Date.UTC(y, mo, 0)).getUTCDate() || y < 1900 || y > 9999) return null;
    const v = serial(y, mo, d) + (cas || 0);
    return { v, format: cas !== null ? 'd.m.yyyy h:mm' : /\p{L}/u.test(zbytek) ? 'd. mmmm yyyy' : 'd.m.yyyy' };
  }
  if (cas !== null) return { v: cas, format };
  return null;
}

// ---------------------------------------------------------------- nabídka Číselný formát
export const FORMATY = [
  { id: 'obecny', nazev: 'Obecný', kod: 'General', ukazka: (v) => formatuj(v, 'General').text },
  { id: 'cislo', nazev: 'Číslo', kod: '0.00' },
  { id: 'mena', nazev: 'Měna', kod: '#,##0.00 "Kč"' },
  { id: 'ucetni', nazev: 'Účetnický', kod: '_-* #,##0.00 "Kč"_-;-* #,##0.00 "Kč"_-;_-* "-"?? "Kč"_-;_-@_-' },
  { id: 'datum', nazev: 'Krátké datum', kod: 'd.m.yyyy' },
  { id: 'datumDl', nazev: 'Dlouhé datum', kod: 'dddd d. mmmm yyyy' },
  { id: 'cas', nazev: 'Čas', kod: 'h:mm:ss' },
  { id: 'procenta', nazev: 'Procenta', kod: '0.00%' },
  { id: 'zlomek', nazev: 'Zlomky', kod: '# ?/?' },
  { id: 'vedecky', nazev: 'Matematický', kod: '0.00E+00' },
  { id: 'text', nazev: 'Text', kod: '@' },
];

/** Kategorie pro dialog Formát buněk → Číslo. */
export const KATEGORIE = [
  { id: 'obecny', nazev: 'Obecný', popis: 'Buňky s obecným formátem nemají žádný konkrétní číselný formát.' },
  { id: 'cislo', nazev: 'Číslo', popis: 'Číslo slouží pro obecné zobrazení čísel. Pro peněžní hodnoty je vhodnější Měna a Účetnický.' },
  { id: 'mena', nazev: 'Měna', popis: 'Formát Měna se používá pro obecné peněžní hodnoty.' },
  { id: 'ucetni', nazev: 'Účetnický', popis: 'Formát Účetnický zarovná symboly měny a desetinné čárky ve sloupci.' },
  { id: 'datum', nazev: 'Datum', popis: 'Formáty data zobrazují pořadová čísla data a času jako hodnoty data.', kody: ['d.m.yyyy', 'd. mmmm yyyy', 'dddd d. mmmm yyyy', 'd.m.yy', 'dd.mm.yyyy', 'd. m.', 'mmmm yyyy', 'mmm-yy', 'yyyy-mm-dd', 'd.m.yyyy h:mm'] },
  { id: 'cas', nazev: 'Čas', popis: 'Formáty času zobrazují pořadová čísla data a času jako hodnoty času.', kody: ['h:mm', 'h:mm:ss', 'hh:mm', 'h:mm AM/PM', '[h]:mm:ss', 'mm:ss.0', 'd.m.yyyy h:mm'] },
  { id: 'procenta', nazev: 'Procenta', popis: 'Formáty procent vynásobí hodnotu buňky číslem 100 a zobrazí výsledek se symbolem procent.' },
  { id: 'zlomek', nazev: 'Zlomky', popis: 'Zobrazí desetinnou část čísla jako zlomek.', kody: ['# ?/?', '# ??/??', '# ???/???', '# ?/2', '# ?/4', '# ?/8', '# ??/16', '# ?/10', '# ??/100'] },
  { id: 'vedecky', nazev: 'Matematický', popis: 'Zobrazí číslo ve vědeckém (exponenciálním) zápisu.' },
  { id: 'text', nazev: 'Text', popis: 'Buňky ve formátu Text se zobrazují přesně tak, jak byly zadány, i když obsahují číslo.' },
  { id: 'zvlastni', nazev: 'Speciální', popis: 'Speciální formáty jsou užitečné pro sledování seznamů a hodnot databáze.', kody: ['000 00', '000 000 000', '+420 000 000 000', '000000/0000'] },
  { id: 'vlastni', nazev: 'Vlastní', popis: 'Zadejte kód číselného formátu, přičemž jako výchozí bod použijte některý ze stávajících kódů.' },
];

export function kodCislo({ des = 2, tisice = false, zaporne = 0 } = {}) {
  const z = des ? '0.' + '0'.repeat(des) : '0';
  const k = (tisice ? '#,##' : '') + z;
  return [k, `${k};[Red]${k}`, `${k};-${k}`, `${k};[Red]-${k}`][zaporne] || k;
}
export function kodMena({ des = 2, symbol = 'Kč', zaporne = 0 } = {}) {
  const z = '#,##0' + (des ? '.' + '0'.repeat(des) : '');
  const s = symbol === 'Kč' ? ' "Kč"' : symbol === '€' ? ' "€"' : symbol ? '' : '';
  const pred = symbol === '$' ? '"$"' : '';
  const k = `${pred}${z}${s}`;
  return [`${k};-${k}`, `${k};[Red]${k}`, `${k};-${k}`, `${k};[Red]-${k}`][zaporne];
}
export function kodUcetni({ des = 2, symbol = 'Kč' } = {}) {
  const z = '#,##0' + (des ? '.' + '0'.repeat(des) : '');
  const nuly = '?'.repeat(des);
  const s = symbol ? ` "${symbol}"` : '';
  return `_-* ${z}${s}_-;-* ${z}${s}_-;_-* "-"${nuly}${s}_-;_-@_-`;
}

/** Zjistí z kódu kategorii a počet desetinných míst (pro dialog a tlačítka). */
export function rozborKodu(kod) {
  if (!kod || /^general$/i.test(kod)) return { kat: 'obecny', des: 0 };
  if (kod === '@') return { kat: 'text', des: 0 };
  const hlavni = rozdelSekce(kod)[0];
  const des = ((/\.([0#?]+)/.exec(hlavni.replace(/"[^"]*"/g, '')) || [])[1] || '').length;
  if (/^_-\*/.test(kod)) return { kat: 'ucetni', des, symbol: (/"([^"]+)"/.exec(hlavni) || [])[1] || '' };
  if (jeDatovyFormat(kod)) return { kat: /[dy]/.test(hlavni) ? 'datum' : 'cas', des: 0 };
  if (/%/.test(hlavni)) return { kat: 'procenta', des };
  if (/E[+-]/i.test(hlavni)) return { kat: 'vedecky', des };
  if (/\?\/|\/\?|\/\d/.test(hlavni)) return { kat: 'zlomek', des: 0 };
  if (/"(Kč|€|\$)"/.test(kod)) return { kat: 'mena', des, symbol: (/"(Kč|€|\$)"/.exec(kod) || [])[1] };
  if (/^[#,0.]+(;.*)?$/.test(kod.replace(/\[Red\]/g, ''))) return { kat: 'cislo', des, tisice: kod.includes(',') };
  return { kat: 'vlastni', des };
}

/** Přidá/odebere desetinné místo v kódu (tlačítka ,0 → ,00). */
export function zmenDesetinna(kod, smer, hodnota) {
  if (!kod || /^general$/i.test(kod)) {
    // obecný → podle aktuálního počtu míst
    const t = typeof hodnota === 'number' ? obecne(hodnota) : '0';
    const des = (t.split(',')[1] || '').length;
    const nove = Math.max(0, des + smer);
    return nove ? '0.' + '0'.repeat(nove) : '0';
  }
  return rozdelSekce(kod).map((s) => {
    let hotovo = false;
    let out = '', uvoz = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === '"') uvoz = !uvoz;
      if (!uvoz && !hotovo && /[0#?]/.test(ch) && !/[0#?.,]/.test(s[i + 1] || '')) {
        // konec číselné masky
        out += ch;
        const pred = out;
        if (smer > 0) out = pred.includes('.') && /\.[0#?]*$/.test(pred) ? pred + '0' : pred + '.0';
        else {
          out = pred.replace(/\.([0#?]*)[0#?]$/, (m, a) => (a.length ? '.' + a : ''));
        }
        hotovo = true;
        continue;
      }
      out += ch;
    }
    return out;
  }).join(';');
}
