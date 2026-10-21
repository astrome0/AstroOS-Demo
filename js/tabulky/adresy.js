// AstroTabulky — adresy buněk a oblastí (A1, $B$3, A1:C10, List2!A1, A:A, 1:3)
//
// Uvnitř se počítá od nuly: řádek 0 = „1“, sloupec 0 = „A“. Buňka v mapě listu má
// číselný klíč r * MAX_C + c (rychlejší než řetězec, vejde se do bezpečného celého čísla).

export const MAX_R = 1048576;
export const MAX_C = 16384;

export const klic = (r, c) => r * MAX_C + c;
export const zKlice = (k) => [Math.floor(k / MAX_C), k % MAX_C];

export function pismena(c) {
  let s = '';
  c += 1;
  while (c > 0) {
    const m = (c - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    c = Math.floor((c - 1) / 26);
  }
  return s;
}

export function sloupecZPismen(p) {
  let c = 0;
  for (const ch of p.toUpperCase()) c = c * 26 + (ch.charCodeAt(0) - 64);
  return c - 1;
}

export const adresa = (r, c, absR = false, absC = false) => `${absC ? '$' : ''}${pismena(c)}${absR ? '$' : ''}${r + 1}`;

const RE_BUNKA = /^(\$?)([A-Za-z]{1,3})(\$?)(\d{1,7})$/;
const RE_SLOUPCE = /^(\$?)([A-Za-z]{1,3}):(\$?)([A-Za-z]{1,3})$/;
const RE_RADKY = /^(\$?)(\d{1,7}):(\$?)(\d{1,7})$/;

/** 'B3' → { r: 2, c: 1 }; neplatná adresa → null */
export function rozeberBunku(t) {
  const m = RE_BUNKA.exec(t.trim());
  if (!m) return null;
  const c = sloupecZPismen(m[2]);
  const r = +m[4] - 1;
  if (c < 0 || c >= MAX_C || r < 0 || r >= MAX_R) return null;
  return { r, c, absC: !!m[1], absR: !!m[3] };
}

/** Rozdělí „'Můj list'!A1:B2“ na název listu a zbytek. */
export function oddelList(t) {
  t = t.trim();
  let m = /^'((?:[^']|'')+)'!(.+)$/.exec(t);
  if (m) return { list: m[1].replace(/''/g, "'"), zbytek: m[2] };
  m = /^([^!'"\s:]+)!(.+)$/.exec(t);
  if (m) return { list: m[1], zbytek: m[2] };
  return { list: null, zbytek: t };
}

/** Text oblasti → { r1, c1, r2, c2, list? } (seřazené). Umí A1, A1:B2, A:C, 2:5. */
export function rozeberOblast(t) {
  const { list, zbytek } = oddelList(t);
  let o = null;
  const casti = zbytek.split(':');
  if (casti.length === 1) {
    const b = rozeberBunku(casti[0]);
    if (b) o = { r1: b.r, c1: b.c, r2: b.r, c2: b.c };
  } else if (casti.length === 2) {
    const a = rozeberBunku(casti[0]);
    const b = rozeberBunku(casti[1]);
    if (a && b) o = { r1: a.r, c1: a.c, r2: b.r, c2: b.c };
    else if (RE_SLOUPCE.test(zbytek)) {
      const m = RE_SLOUPCE.exec(zbytek);
      o = { r1: 0, c1: sloupecZPismen(m[2]), r2: MAX_R - 1, c2: sloupecZPismen(m[4]) };
    } else if (RE_RADKY.test(zbytek)) {
      const m = RE_RADKY.exec(zbytek);
      o = { r1: +m[2] - 1, c1: 0, r2: +m[4] - 1, c2: MAX_C - 1 };
    }
  }
  if (!o) return null;
  o = serad(o);
  if (list) o.list = list;
  return o;
}

export const serad = (o) => ({
  r1: Math.min(o.r1, o.r2), r2: Math.max(o.r1, o.r2),
  c1: Math.min(o.c1, o.c2), c2: Math.max(o.c1, o.c2),
});

export function textOblasti(o, abs = false) {
  if (!o) return '';
  if (o.r1 === 0 && o.r2 === MAX_R - 1) return `${abs ? '$' : ''}${pismena(o.c1)}:${abs ? '$' : ''}${pismena(o.c2)}`;
  if (o.c1 === 0 && o.c2 === MAX_C - 1) return `${abs ? '$' : ''}${o.r1 + 1}:${abs ? '$' : ''}${o.r2 + 1}`;
  const a = adresa(o.r1, o.c1, abs, abs);
  return o.r1 === o.r2 && o.c1 === o.c2 ? a : `${a}:${adresa(o.r2, o.c2, abs, abs)}`;
}

export const jmenoListuVeVzorci = (n) => (/^[\p{L}_][\p{L}\d_.]*$/u.test(n) && !RE_BUNKA.test(n) ? n : `'${n.replace(/'/g, "''")}'`);

export const obsahuje = (o, r, c) => r >= o.r1 && r <= o.r2 && c >= o.c1 && c <= o.c2;
export const prekryva = (a, b) => a.r1 <= b.r2 && a.r2 >= b.r1 && a.c1 <= b.c2 && a.c2 >= b.c1;
export const velikost = (o) => (o.r2 - o.r1 + 1) * (o.c2 - o.c1 + 1);
export const stejne = (a, b) => a && b && a.r1 === b.r1 && a.r2 === b.r2 && a.c1 === b.c1 && a.c2 === b.c2;
